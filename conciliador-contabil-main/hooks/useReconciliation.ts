import { useState, useEffect, useCallback } from 'react';
import {
    Step,
    RhRelatorioData,
    RhGuiaData,
    RetentionReportData,
    EmpenhoData,
    LiquidacaoData,
    ComparisonResult,
    ReconciliationRecord
} from '../types';
import { supabase } from '../services/supabaseClient';
import { logger } from '../services/logger';
import { ReconciliationRecordSchema } from '../services/validationSchema';

export function useReconciliation() {
    const [currentStep, setCurrentStep] = useState<Step>('UPLOAD_RH');
    const [orgao, setOrgao] = useState('');
    const [competencia, setCompetencia] = useState('');
    const [history, setHistory] = useState<ReconciliationRecord[]>([]);
    const [viewingRecord, setViewingRecord] = useState<ReconciliationRecord | null>(null);

    // Estados de Dados
    const [relatorioData, setRelatorioData] = useState<RhRelatorioData[]>([]);
    const [retentionData, setRetentionData] = useState<RetentionReportData[]>([]);
    const [empenhoData, setEmpenhoData] = useState<EmpenhoData[]>([]);
    const [liquidacaoData, setLiquidacaoData] = useState<LiquidacaoData[]>([]);
    const [guiaData, setGuiaData] = useState<RhGuiaData[]>([]);

    // Estados de Arquivos
    const [rhFiles, setRhFiles] = useState<File[]>([]);
    const [retentionFiles, setRetentionFiles] = useState<File[]>([]);
    const [empenhoFiles, setEmpenhoFiles] = useState<File[]>([]);
    const [liquidacaoFiles, setLiquidacaoFiles] = useState<File[]>([]);
    const [guiaFiles, setGuiaFiles] = useState<File[]>([]);

    // Estado de Processamento
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
    const [notaTecnicaText, setNotaTecnicaText] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Agregadores
    const aggregateRelatorio = (data: RhRelatorioData[]): RhRelatorioData => ({
        valorSegurados: data.reduce((acc, curr) => acc + curr.valorSegurados, 0),
        valorEmpresa: data.reduce((acc, curr) => acc + curr.valorEmpresa, 0),
        valorAcidente: data.reduce((acc, curr) => acc + curr.valorAcidente, 0),
        deducaoFpas: data.reduce((acc, curr) => acc + curr.deducaoFpas, 0),
        totalARecolher: data.reduce((acc, curr) => acc + curr.totalARecolher, 0),
    });

    const aggregateRetention = (data: RetentionReportData[]): RetentionReportData => ({
        valorRetido: data.reduce((acc, curr) => acc + (curr.valorRetido || 0), 0)
    });

    const aggregateEmpenho = (data: EmpenhoData[]): EmpenhoData => ({
        numeroEmpenho: data.map(d => d.numeroEmpenho).join(', '),
        valor: data.reduce((acc, curr) => acc + curr.valor, 0)
    });

    const aggregateLiquidacao = (data: LiquidacaoData[]): LiquidacaoData => ({
        numeroEmpenho: data.map(d => d.numeroEmpenho).join(', '),
        valorBruto: data.reduce((acc, curr) => acc + curr.valorBruto, 0),
        salarioFamilia: data.reduce((acc, curr) => acc + curr.salarioFamilia, 0),
        salarioMaternidade: data.reduce((acc, curr) => acc + curr.salarioMaternidade, 0)
    });

    const aggregateGuia = (data: RhGuiaData[]): RhGuiaData => ({
        valorSegurados: data.reduce((acc, curr) => acc + curr.valorSegurados, 0),
        valorEmpresa: data.reduce((acc, curr) => acc + curr.valorEmpresa, 0),
        valorRiscoAmbiental: data.reduce((acc, curr) => acc + curr.valorRiscoAmbiental, 0),
        valorContribIndividual: data.reduce((acc, curr) => acc + (curr.valorContribIndividual || 0), 0),
        totalGuia: data.reduce((acc, curr) => acc + curr.totalGuia, 0)
    });

    // Motor de Comparação
    const performComparison = useCallback((
        rel: RhRelatorioData[],
        ret: RetentionReportData[],
        emp: EmpenhoData[],
        liq: LiquidacaoData[],
        gui: RhGuiaData[]
    ) => {
        if (rel.length === 0) return null;

        const finalRelatorio = aggregateRelatorio(rel);
        const finalRetention = aggregateRetention(ret);
        const finalEmpenho = aggregateEmpenho(emp);
        const finalLiquidacao = aggregateLiquidacao(liq);
        const finalGuia = aggregateGuia(gui);

        const tolerance = 0.01; // Rigor absoluto: tolerância de apenas 1 centavo

        // Cálculo de Brutos para conferência de empenho/liquidação
        const brutoRhPatronal = (finalRelatorio.valorEmpresa + finalRelatorio.valorAcidente);
        const liquidoContabilPatronal = (finalLiquidacao.valorBruto - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade));
        
        // Nova lógica: se a contabilidade não informou deduções mas o valor bate com o BRUTO do RH, consideramos íntegro
        const patronalMatch = Math.abs(liquidoContabilPatronal - (brutoRhPatronal - finalRelatorio.deducaoFpas)) < tolerance || 
                             Math.abs(finalLiquidacao.valorBruto - brutoRhPatronal) < tolerance;

        const internalMatches = {
            seguradosMatch: Math.abs((finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0)) - finalRetention.valorRetido) < tolerance,
            empresaMatch: Math.abs(finalGuia.valorEmpresa - (finalRelatorio.valorEmpresa - finalRelatorio.deducaoFpas)) < tolerance,
            acidenteMatch: Math.abs(finalGuia.valorRiscoAmbiental - finalRelatorio.valorAcidente) < tolerance,
            totalMatch: Math.abs(finalGuia.totalGuia - finalRelatorio.totalARecolher) < tolerance
        };

        const result: ComparisonResult = {
            relatorioData: finalRelatorio,
            retentionData: finalRetention,
            retentionMatch: Math.abs(finalRetention.valorRetido - finalRelatorio.valorSegurados) < tolerance,
            retentionDifference: finalRetention.valorRetido - finalRelatorio.valorSegurados,
            empenhoData: finalEmpenho,
            empenhoMatch: Math.abs(finalEmpenho.valor - finalRetention.valorRetido) < tolerance || Math.abs(finalEmpenho.valor - finalRelatorio.valorSegurados) < tolerance,
            empenhoDifference: finalEmpenho.valor - finalRetention.valorRetido,
            liquidacaoData: finalLiquidacao,
            liquidacaoBrutoMatch: patronalMatch,
            liquidacaoBrutoDifference: finalLiquidacao.valorBruto - brutoRhPatronal,
            liquidacaoRetencaoMatch: true, 
            liquidacaoRetencaoDifference: 0,
            deducaoFpas: finalRelatorio.deducaoFpas,
            segurados: {
                rh: finalRelatorio.valorSegurados,
                guia: finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0),
                diff: (finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0)) - finalRelatorio.valorSegurados,
                status: Math.abs((finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0)) - finalRelatorio.valorSegurados) < tolerance ? 'MATCH' : 'MISMATCH'
            },
            empresa: {
                rh: finalRelatorio.valorEmpresa - finalRelatorio.deducaoFpas,
                guia: finalGuia.valorEmpresa,
                diff: finalGuia.valorEmpresa - (finalRelatorio.valorEmpresa - finalRelatorio.deducaoFpas),
                status: Math.abs(finalGuia.valorEmpresa - (finalRelatorio.valorEmpresa - finalRelatorio.deducaoFpas)) < tolerance ? 'MATCH' : 'MISMATCH'
            },
            acidente: {
                rh: finalRelatorio.valorAcidente,
                guia: finalGuia.valorRiscoAmbiental,
                diff: finalGuia.valorRiscoAmbiental - finalRelatorio.valorAcidente,
                status: Math.abs(finalGuia.valorRiscoAmbiental - finalRelatorio.valorAcidente) < tolerance ? 'MATCH' : 'MISMATCH'
            },
            total: {
                rh: finalRelatorio.totalARecolher,
                guia: finalGuia.totalGuia,
                diff: finalGuia.totalGuia - finalRelatorio.totalARecolher,
                status: Math.abs(finalGuia.totalGuia - finalRelatorio.totalARecolher) < tolerance ? 'MATCH' : 'MISMATCH'
            },
            triangulation: {
                rh_vs_contab: {
                    segurados: Math.abs(finalRelatorio.valorSegurados - finalRetention.valorRetido) < tolerance,
                    empresa: Math.abs((finalRelatorio.valorEmpresa + finalRelatorio.valorAcidente - finalRelatorio.deducaoFpas) - (finalLiquidacao.valorBruto - finalLiquidacao.salarioFamilia - finalLiquidacao.salarioMaternidade)) < tolerance,
                    total: Math.abs(finalRelatorio.totalARecolher - ((finalRetention.valorRetido + finalLiquidacao.valorBruto) - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade))) < tolerance
                },
                contab_vs_darf: {
                    segurados: Math.abs(finalRetention.valorRetido - (finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0))) < tolerance,
                    empresa: Math.abs((finalLiquidacao.valorBruto - finalLiquidacao.salarioFamilia - finalLiquidacao.salarioMaternidade) - (finalGuia.valorEmpresa + finalGuia.valorRiscoAmbiental)) < tolerance,
                    total: Math.abs(((finalRetention.valorRetido + finalLiquidacao.valorBruto) - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade)) - finalGuia.totalGuia) < tolerance
                }
            },
            internalMatches,
            totalContab: (finalRetention.valorRetido + finalLiquidacao.valorBruto) - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade),
            guiaData: finalGuia,
            finalStatus: 'DIVERGENTE',
            analyticalData: {
                rh: rel,
                retention: ret,
                empenho: emp,
                liquidacao: liq,
                guia: gui
            }
        };

        const rhMatches = Object.values(result.triangulation!.rh_vs_contab).every(Boolean);
        const accountingGuiaMatches = Object.values(result.triangulation!.contab_vs_darf).every(Boolean);
        const directRhGuiaMatches = [
            result.segurados.status === 'MATCH',
            result.empresa.status === 'MATCH',
            result.acidente.status === 'MATCH',
            result.total.status === 'MATCH'
        ].every(Boolean);

        // Elo de Ferro: Alerta de Divergência Crítica
        if (Math.abs(result.total.diff) > 1000) {
            logger.warn('DIVERGÊNCIA CRÍTICA: Diferença entre RH e Guia excede R$ 1.000,00.', { diff: result.total.diff });
        }

        if (rhMatches && accountingGuiaMatches && directRhGuiaMatches) {
            result.finalStatus = 'CONCILIADO';
        } else if (directRhGuiaMatches) {
            result.finalStatus = 'CONCILIADO_COM_RESSALVA';
        } else {
            result.finalStatus = 'DIVERGENTE';
        }

        return result;
    }, []);

    // Sistema de Persistência Blindada
    const fetchHistory = useCallback(async () => {
        if (!supabase) {
            setIsHistoryLoading(false);
            logger.warn('Modo Offline: Supabase não configurado.');
            return;
        }
        setIsHistoryLoading(true);
        try {
            const { data, error: dbError } = await supabase
                .from('reconciliacoes')
                .select('*')
                .order('created_at', { ascending: false });

            if (dbError) throw dbError;
            setHistory(data as unknown as ReconciliationRecord[]);
            logger.info('Histórico carregado com sucesso.');
        } catch (err) {
            logger.error('Erro ao carregar histórico', err);
            setError('Falha ao sincronizar com o banco de dados.');
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const savePartialReconciliation = async (partialData: Partial<ReconciliationRecord>) => {
        if (!supabase) {
            logger.error('Supabase não inicializado.', null);
            return;
        }

        try {
            const id = viewingRecord?.id || partialData.id || crypto.randomUUID();
            setSaveStatus('saving');

            // Preparar dados - sempre como arrays, nunca como null
            const rhEntries = partialData.rh_relatorio_entries ?? relatorioData;
            const retEntries = partialData.retention_entries ?? retentionData;
            const empEntries = partialData.empenho_entries ?? empenhoData;
            const liqEntries = partialData.liquidacao_entries ?? liquidacaoData;
            const guiEntries = partialData.guia_entries ?? guiaData;

            // Calcula o resultado apenas se não foi fornecido já calculado (evita race condition)
            const currentResult = (partialData.comparison_result as ComparisonResult | null | undefined)
                ?? performComparison(
                    rhEntries,
                    retEntries,
                    empEntries,
                    liqEntries,
                    guiEntries
                );

            const recordData = {
                id,
                orgao: partialData.orgao || orgao,
                competencia: partialData.competencia || competencia,
                status: partialData.status || (currentResult?.finalStatus || 'EM_ANDAMENTO'),
                comparison_result: currentResult || comparisonResult,
                nota_tecnica: partialData.nota_tecnica || notaTecnicaText,
                rh_relatorio_entries: rhEntries.length > 0 ? rhEntries : [],
                retention_entries: retEntries.length > 0 ? retEntries : [],
                empenho_entries: empEntries.length > 0 ? empEntries : [],
                liquidacao_entries: liqEntries.length > 0 ? liqEntries : [],
                guia_entries: guiEntries.length > 0 ? guiEntries : [],
                created_at: viewingRecord?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                files: partialData.files || [],
                observacoes: partialData.observacoes || null,
            };

            logger.debug('[DEBUG] Salvando reconciliação com dados', {
                rhCount: recordData.rh_relatorio_entries.length,
                retCount: recordData.retention_entries.length,
                empCount: recordData.empenho_entries.length,
                liqCount: recordData.liquidacao_entries.length,
                guiCount: recordData.guia_entries.length,
                hasResult: !!recordData.comparison_result
            });

            const validatedData = ReconciliationRecordSchema.parse(recordData);

            const { data, error: upsertError } = await supabase
                .from('reconciliacoes')
                .upsert(validatedData as any)
                .select()
                .single();

            if (upsertError) throw upsertError;

            const saved = data as unknown as ReconciliationRecord;
            setViewingRecord(saved);
            setComparisonResult(currentResult);

            setHistory(prev => {
                const idx = prev.findIndex(h => h.id === saved.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = saved;
                    return updated;
                }
                return [saved, ...prev];
            });

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            logger.audit('SAVE_RECONCILIATION', true);
            return saved;
        } catch (err) {
            logger.error('Erro na blindagem de salvamento', err);
            setSaveStatus('error');
            throw err;
        }
    };

    const deleteReconciliation = async (id: string) => {
        if (!supabase) return;
        try {
            const { error: deleteError } = await supabase
                .from('reconciliacoes')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            setHistory(prev => prev.filter(h => h.id !== id));
            logger.info(`Reconciliação ${id} deletada com sucesso.`);
        } catch (err) {
            logger.error('Erro ao deletar reconciliação', err);
            setError('Falha ao deletar a reconciliação.');
        }
    };

    return {
        // Estados
        currentStep, setCurrentStep,
        orgao, setOrgao,
        competencia, setCompetencia,
        history,
        viewingRecord, setViewingRecord,
        relatorioData, setRelatorioData,
        retentionData, setRetentionData,
        empenhoData, setEmpenhoData,
        liquidacaoData, setLiquidacaoData,
        guiaData, setGuiaData,
        rhFiles, setRhFiles,
        retentionFiles, setRetentionFiles,
        empenhoFiles, setEmpenhoFiles,
        liquidacaoFiles, setLiquidacaoFiles,
        guiaFiles, setGuiaFiles,
        comparisonResult, setComparisonResult,
        notaTecnicaText, setNotaTecnicaText,
        isLoading, setIsLoading,
        isHistoryLoading,
        error, setError,
        saveStatus,

        // Ações
        savePartialReconciliation,
        deleteReconciliation,
        refreshHistory: fetchHistory,
        performComparison,
    };
}
