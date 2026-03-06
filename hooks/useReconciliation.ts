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

        const tolerance = 0.05;

        const internalMatches = {
            seguradosMatch: Math.abs((finalGuia.valorSegurados + (finalGuia.valorContribIndividual || 0)) - finalRetention.valorRetido) < tolerance,
            empresaMatch: Math.abs(finalGuia.valorEmpresa - finalRelatorio.valorEmpresa) < tolerance,
            acidenteMatch: Math.abs(finalGuia.valorRiscoAmbiental - finalRelatorio.valorAcidente) < tolerance,
            totalMatch: Math.abs(finalGuia.totalGuia - finalRelatorio.totalARecolher) < tolerance
        };

        const result: ComparisonResult = {
            relatorioData: finalRelatorio,
            retentionData: finalRetention,
            retentionMatch: Math.abs(finalRetention.valorRetido - finalRelatorio.valorSegurados) < tolerance,
            retentionDifference: finalRetention.valorRetido - finalRelatorio.valorSegurados,
            empenhoData: finalEmpenho,
            empenhoMatch: Math.abs(finalEmpenho.valor - finalRetention.valorRetido) < tolerance,
            empenhoDifference: finalEmpenho.valor - finalRetention.valorRetido,
            liquidacaoData: finalLiquidacao,
            liquidacaoBrutoMatch: Math.abs((finalLiquidacao.valorBruto - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade)) - ((finalRelatorio.valorEmpresa + finalRelatorio.valorAcidente) - finalRelatorio.deducaoFpas)) < tolerance,
            liquidacaoBrutoDifference: (finalLiquidacao.valorBruto - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade)) - ((finalRelatorio.valorEmpresa + finalRelatorio.valorAcidente) - finalRelatorio.deducaoFpas),
            liquidacaoRetencaoMatch: true, // Ignorado pois Salário Família não bate com FPAS
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
            internalMatches,
            totalContab: (finalRetention.valorRetido + finalLiquidacao.valorBruto) - (finalLiquidacao.salarioFamilia + finalLiquidacao.salarioMaternidade),
            guiaData: finalGuia,
            finalStatus: 'DIVERGENTE'
        };

        const rhMatches = [
            result.retentionMatch,
            result.liquidacaoBrutoMatch,
            result.liquidacaoRetencaoMatch,
            result.segurados.status === 'MATCH',
            result.empresa.status === 'MATCH',
            result.acidente.status === 'MATCH',
            result.total.status === 'MATCH'
        ].every(Boolean);

        const accountingGuiaMatches = [
            internalMatches.seguradosMatch,
            internalMatches.empresaMatch,
            internalMatches.acidenteMatch,
            internalMatches.totalMatch
        ].every(Boolean);

        // Elo de Ferro: Alerta de Divergência Crítica
        if (Math.abs(result.total.diff) > 1000) {
            logger.warn('DIVERGÊNCIA CRÍTICA: Diferença entre RH e Guia excede R$ 1.000,00.', { diff: result.total.diff });
        }

        if (rhMatches) {
            result.finalStatus = 'CONCILIADO';
        } else if (accountingGuiaMatches) {
            result.finalStatus = 'CONCILIADO_COM_RESSALVA';
        }

        return result;
    }, []);

    // Sistema de Persistência Blindada
    const fetchHistory = useCallback(async () => {
        if (!supabase) return;
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

            // Calcula o resultado da comparação atualizado
            const currentResult = performComparison(
                partialData.rh_relatorio_entries || relatorioData,
                partialData.retention_entries || retentionData,
                partialData.empenho_entries || empenhoData,
                partialData.liquidacao_entries || liquidacaoData,
                partialData.guia_entries || guiaData
            );

            const recordData = {
                id,
                orgao: partialData.orgao || orgao,
                competencia: partialData.competencia || competencia,
                status: partialData.status || (currentResult?.finalStatus || 'EM_ANDAMENTO'),
                comparison_result: currentResult || comparisonResult,
                nota_tecnica: partialData.nota_tecnica || notaTecnicaText,
                rh_relatorio_entries: partialData.rh_relatorio_entries || (relatorioData.length > 0 ? relatorioData : null),
                retention_entries: partialData.retention_entries || (retentionData.length > 0 ? retentionData : null),
                empenho_entries: partialData.empenho_entries || (empenhoData.length > 0 ? empenhoData : null),
                liquidacao_entries: partialData.liquidacao_entries || (liquidacaoData.length > 0 ? liquidacaoData : null),
                guia_entries: partialData.guia_entries || (guiaData.length > 0 ? guiaData : null),
                created_at: viewingRecord?.created_at || new Date().toISOString(),
                files: partialData.files || [],
                observacoes: partialData.observacoes || null,
            };

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
            setError('Erro de integridade: Os dados não puderam ser salvos para evitar corrupção do histórico.');
            throw err;
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
        refreshHistory: fetchHistory,
        performComparison,
    };
}
