import React, { useState } from 'react';
import { Step, ReconciliationRecord } from './types';
import { extractData, generateNotaTecnica } from './services/geminiService';
import { logger } from './services/logger';
import { useReconciliation } from './hooks/useReconciliation';

// Componentes
import StepUpload from './components/StepUpload';
import ComparisonTable from './components/ComparisonTable';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import Settings from './components/Settings';

// Ícones
import { PlusCircle, History, Loader2, Eye, Trash2, ArrowLeft } from 'lucide-react';

const ORGAOS = [
  "PREFEITURA MUNICIPAL DE SENADOR CANEDO",
  "FMAS - FUNDO MUNICIPAL ASSISTENCIA SOCIAL",
  "FMDCA - FUNDO MUNICIPAL DA INFANCIA E DA ADOLESCENCIA",
  "FME - FUNDO MUNICIPAL DE EDUCAÇÃO, CULTURA, ESPORTE",
  "FMS - FUNDO MUNICIPAL DE SAUDE",
  "FUMDEC - FUNDO MUNICIPAL DE PROTEÇÃO E DEFESA CIVIL",
  "FUNDEB - SENADOR CANEDO",
  "FUNDI - FUNDO MUNICIPAL DOS DIREITOS DO IDOSO",
  "IAMESC - INSTITUTO DE ASSISTÊNCIA A SAUDE DO SERV PUBLICO",
  "INSTITUTO DE PREVIDENCIA DO SERVIDOR PUBLICO DE SENADOR CANEDO - SENAPR",
];

const App: React.FC = () => {
  const [view, setView] = useState<'new' | 'history' | 'process' | 'settings'>('new');

  const {
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
    savePartialReconciliation,
    performComparison,
    deleteReconciliation,
  } = useReconciliation();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const createBlankData = (type: string) => {
    switch (type) {
      case 'Relatorio': return { valorSegurados: 0, valorEmpresa: 0, valorAcidente: 0, deducaoFpas: 0, totalARecolher: 0 };
      case 'Guia': return { valorSegurados: 0, valorEmpresa: 0, valorRiscoAmbiental: 0, valorContribIndividual: 0, totalGuia: 0 };
      case 'Retention': return { valorRetido: 0 };
      case 'Empenho': return { numeroEmpenho: '', valor: 0 };
      case 'Liquidacao': return { numeroEmpenho: '', valorBruto: 0, salarioFamilia: 0, salarioMaternidade: 0 };
      default: return {};
    }
  };

  const handleFileUpload = async (files: FileList | File[], type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    const fileArray = Array.from(files);
    setIsLoading(true);
    setError(null);
    try {
      const data = await Promise.all(fileArray.map(async f => {
        const base64 = await fileToBase64(f);
        return extractData(base64, f.type, type as any);
      }));

      switch (type) {
        case 'Relatorio': setRelatorioData(data as any); setRhFiles(fileArray); break;
        case 'Retention': setRetentionData(data as any); setRetentionFiles(fileArray); break;
        case 'Empenho': setEmpenhoData(data as any); setEmpenhoFiles(fileArray); break;
        case 'Liquidacao': setLiquidacaoData(data as any); setLiquidacaoFiles(fileArray); break;
        case 'Guia': setGuiaData(data as any); setGuiaFiles(fileArray); break;
      }
    } catch (err: any) {
      logger.error(`Erro no upload (${type})`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmData = async (data: any, files: File[], type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    // Atualiza os dados e arquivos
    let updatedRel = relatorioData;
    let updatedRet = retentionData;
    let updatedEmp = empenhoData;
    let updatedLiq = liquidacaoData;
    let updatedGui = guiaData;

    switch (type) {
      case 'Relatorio': updatedRel = data; setRelatorioData(data); setRhFiles(files); break;
      case 'Retention': updatedRet = data; setRetentionData(data); setRetentionFiles(files); break;
      case 'Empenho': updatedEmp = data; setEmpenhoData(data); setEmpenhoFiles(files); break;
      case 'Liquidacao': updatedLiq = data; setLiquidacaoData(data); setLiquidacaoFiles(files); break;
      case 'Guia': updatedGui = data; setGuiaData(data); setGuiaFiles(files); break;
    }

    const nextStepMap: Record<string, Step> = {
      'UPLOAD_RH': 'UPLOAD_RETENTION',
      'UPLOAD_RETENTION': 'UPLOAD_EMPENHO',
      'UPLOAD_EMPENHO': 'UPLOAD_LIQUIDACAO',
      'UPLOAD_LIQUIDACAO': 'UPLOAD_GUIA',
      'UPLOAD_GUIA': 'COMPARISON',
    };

    const nextStep = nextStepMap[currentStep];
    if (nextStep) {
      if (nextStep === 'COMPARISON') {
        logger.debug('[DEBUG] Iniciando cálculo final da conciliação...');
        const result = performComparison(updatedRel, updatedRet, updatedEmp, updatedLiq, updatedGui);
        
        if (!result) {
          logger.error('Falha ao gerar o resultado da comparação', null);
          setError('Os dados fornecidos são insuficientes para gerar o relatório final. Verifique os uploads.');
          return;
        }

        setComparisonResult(result);
        logger.debug('[DEBUG] Resultado gerado com sucesso', result);
        
        await savePartialReconciliation({ 
          comparison_result: result, 
          status: result.finalStatus,
          rh_relatorio_entries: updatedRel,
          retention_entries: updatedRet,
          empenho_entries: updatedEmp,
          liquidacao_entries: updatedLiq,
          guia_entries: updatedGui
        });
      }
      setCurrentStep(nextStep);
    }
  };

  const handleClearStep = (type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    switch (type) {
      case 'Relatorio': setRelatorioData([]); setRhFiles([]); break;
      case 'Retention': setRetentionData([]); setRetentionFiles([]); break;
      case 'Empenho': setEmpenhoData([]); setEmpenhoFiles([]); break;
      case 'Liquidacao': setLiquidacaoData([]); setLiquidacaoFiles([]); break;
      case 'Guia': setGuiaData([]); setGuiaFiles([]); break;
    }
  };

  const handleGenerateNotaTecnica = async () => {
    const data = viewingRecord?.comparison_result || comparisonResult;
    if (!data) return;
    setIsLoading(true);
    try {
      const text = await generateNotaTecnica(data);
      setNotaTecnicaText(text);
      // Salva explicitamente o texto gerado no banco de dados
      await savePartialReconciliation({ nota_tecnica: text });
    } catch (err) {
      logger.error('Erro ao gerar nota técnica', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRecord = (rec: ReconciliationRecord) => {
    logger.debug('[DEBUG] Abrindo registro', { id: rec.id, orgao: rec.orgao });
    logger.debug('[DEBUG] Dados disponíveis no registro', {
      hasSavedResult: !!rec.comparison_result,
      rhCount: rec.rh_relatorio_entries?.length ?? 0,
      retCount: rec.retention_entries?.length ?? 0,
      empCount: rec.empenho_entries?.length ?? 0,
      liqCount: rec.liquidacao_entries?.length ?? 0,
      guiCount: rec.guia_entries?.length ?? 0,
    });
    
    // 1. PRIORIDADE: se há resultado salvo, usar diretamente
    if (rec.comparison_result) {
      logger.debug('[DEBUG] Usando resultado salvo no registro');
      setComparisonResult(rec.comparison_result);
      setViewingRecord(rec);
      setNotaTecnicaText(rec.nota_tecnica || null);
      setError(null);
      setView('process');
      setCurrentStep('COMPARISON');
      return;
    }
    
    // 2. ALTERNATIVA: tentar recalcular se houver dados disponíveis
    const hasData = (rec.rh_relatorio_entries?.length ?? 0) > 0 || 
                    (rec.retention_entries?.length ?? 0) > 0 ||
                    (rec.empenho_entries?.length ?? 0) > 0 ||
                    (rec.liquidacao_entries?.length ?? 0) > 0 ||
                    (rec.guia_entries?.length ?? 0) > 0;

    if (hasData) {
      console.log('[DEBUG] Recalculando comparação para registro histórico...');
      const finalResult = performComparison(
        rec.rh_relatorio_entries || [],
        rec.retention_entries || [],
        rec.empenho_entries || [],
        rec.liquidacao_entries || [],
        rec.guia_entries || []
      );
      
      if (finalResult) {
        console.log('[DEBUG] Resultado recalculado com sucesso');
        setComparisonResult(finalResult);
        setViewingRecord({ ...rec, comparison_result: finalResult });
        setNotaTecnicaText(rec.nota_tecnica || null);
        setError(null);
        setView('process');
        setCurrentStep('COMPARISON');
        return;
      }
    }

    // 3. FALLBACK: Se chegou aqui e tem nota técnica, permitir visualização mesmo sem dados
    if (rec.nota_tecnica) {
      console.warn('[AVISO] Registro sem dados de comparação, mas com nota técnica. Permitindo visualização limitada.');
      setViewingRecord(rec);
      setNotaTecnicaText(rec.nota_tecnica);
      setError(`Ⓘ Registro legado: sem dados suficientes para análise, mas nota técnica disponível.`);
      setComparisonResult(null);
      setView('process');
      setCurrentStep('COMPARISON');
      return;
    }

    // 4. FALHA FINAL: registro completamente inválido
    console.error('[ERRO] Registro incompleto - sem resultado, sem dados e sem nota técnica');
    setError(`Registro "${rec.orgao}" (${rec.competencia}) está corrompido e não pode ser recuperado. Status: ${rec.status}. Recomenda-se exclusão.`);
  };

  const renderNewScreen = () => (
    <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-xl animate-scale-in max-w-4xl mx-auto mt-10">
      <div className="flex items-center mb-10">
        <div className="bg-slate-800 p-4 rounded-lg mr-6 border border-slate-700">
          <PlusCircle className="h-10 w-10 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Iniciar Auditoria</h2>
          <p className="text-slate-400 font-medium">Configure os parâmetros básicos para sua conciliação.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label htmlFor="select-orgao" className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 font-mono">Entidade / Órgão</label>
          <select
            id="select-orgao"
            name="orgao"
            value={orgao}
            onChange={e => setOrgao(e.target.value)}
            className="bg-slate-800 text-slate-200 w-full px-4 py-3 border border-slate-700 rounded-lg focus:border-indigo-500 transition-colors"
          >
            <option value="">Selecione a entidade...</option>
            {ORGAOS.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="input-competencia" className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 font-mono">Competência (MM/AAAA)</label>
          <input
            id="input-competencia"
            name="competencia"
            value={competencia}
            onChange={e => setCompetencia(e.target.value)}
            placeholder="01/2026"
            maxLength={7}
            className={`bg-slate-800 text-slate-200 w-full px-4 py-3 border rounded-lg focus:outline-none transition-colors ${
              competencia && !/^\d{2}\/\d{4}$/.test(competencia)
                ? 'border-red-500 focus:border-red-400'
                : 'border-slate-700 focus:border-indigo-500'
            }`}
          />
          {competencia && !/^\d{2}\/\d{4}$/.test(competencia) && (
            <p className="text-xs text-red-400 font-medium">Formato inválido. Use MM/AAAA (ex: 01/2026)</p>
          )}
        </div>
      </div>
      <button
        onClick={() => { setView('process'); setCurrentStep('UPLOAD_RH'); }}
        disabled={!orgao || !competencia || !/^\d{2}\/\d{4}$/.test(competencia)}
        className="w-full bg-indigo-600 p-4 rounded-lg mt-10 font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Configurar Processo de Auditoria
      </button>
    </div>
  );

  const renderHistoryScreen = () => (
    <div className="max-w-5xl mx-auto animate-fade-in mt-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <div className="bg-slate-800 p-3 rounded-lg mr-4 border border-slate-700">
            <History className="h-6 w-6 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Dossiê de Conciliações</h2>
        </div>
        <div className="bg-indigo-500/10 px-4 py-1.5 rounded-lg border border-indigo-500/20">
          <span className="text-xs font-semibold text-indigo-400">{history.length} REGISTROS</span>
        </div>
      </div>
      {isHistoryLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
          <p className="text-slate-400 font-semibold mt-6 tracking-wide uppercase text-xs">Sincronizando...</p>
        </div>
      ) : history.length > 0 ? (
        <div className="grid gap-3">
          {history.map(rec => (
            <div key={rec.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex justify-between items-center group transition-colors hover:border-slate-700">
              <div className="flex items-center space-x-6">
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <History className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">{rec.orgao}</h3>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <span className="text-xs text-slate-500 font-mono">REF: {rec.competencia}</span>
                    <span className="text-[10px] font-bold uppercase text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/20">{rec.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-2 border-t border-white/5">
                    <div className="flex items-center text-[10px] text-slate-500">
                      <span className="font-bold uppercase tracking-tighter mr-2 text-slate-600">Inclusão:</span>
                      {new Date(rec.created_at).toLocaleString('pt-BR')}
                    </div>
                    {rec.updated_at && (
                      <div className="flex items-center text-[10px] text-slate-500">
                        <span className="font-bold uppercase tracking-tighter mr-2 text-amber-500/70">Alteração:</span>
                        {new Date(rec.updated_at).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm('Tem certeza que deseja excluir permanentemente este dossiê?')) deleteReconciliation(rec.id); }}
                  className="flex items-center text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                  title="Excluir Dossiê"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleViewRecord(rec)}
                  className="flex items-center text-xs font-semibold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20"
                >
                  Detalhes <Eye className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 border-dashed p-20 rounded-xl text-center">
          <History className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-300">Nenhum registro encontrado</h3>
          <p className="text-slate-500 mt-2">Inicie uma nova conciliação ou verifique suas configurações de banco de dados.</p>
        </div>
      )}
    </div>
  );

  const getActiveStepConfig = () => {
    const configs: Record<Step, any> = {
      'UPLOAD_RH': {
        title: '1. Relatório do RH',
        description: "Envie a 'Relação da Contribuição Previdenciária'.",
        manualTitle: "Relação da Contribuição Previdenciária",
        type: 'Relatorio',
        data: relatorioData,
        files: rhFiles
      },
      'UPLOAD_RETENTION': {
        title: '2. Retenção de INSS',
        description: "Envie o relatório de retenção de INSS.",
        manualTitle: "Relação de Retenção",
        type: 'Retention',
        data: retentionData,
        files: retentionFiles
      },
      'UPLOAD_EMPENHO': {
        title: '3. Empenho Extra-Orçamentário',
        description: "Envie a nota de empenho.",
        manualTitle: "Nota de Empenho",
        type: 'Empenho',
        data: empenhoData,
        files: empenhoFiles
      },
      'UPLOAD_LIQUIDACAO': {
        title: '4. Nota de Liquidação',
        description: "Envie a nota de liquidação.",
        manualTitle: "Nota de Liquidação",
        type: 'Liquidacao',
        data: liquidacaoData,
        files: liquidacaoFiles
      },
      'UPLOAD_GUIA': {
        title: '5. Guia DARF',
        description: "Envie a guia de recolhimento DARF.",
        manualTitle: "DARF Previdenciário",
        type: 'Guia',
        data: guiaData,
        files: guiaFiles
      },
      'COMPARISON': {}
    };
    return configs[currentStep] || configs['UPLOAD_RH'];
  };

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      <Sidebar currentView={view} onViewChange={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header orgao={orgao} competencia={competencia} saveStatus={saveStatus} />
        <main className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
          {view === 'new' && renderNewScreen()}
          {view === 'history' && renderHistoryScreen()}
          {view === 'settings' && <Settings />}
          {view === 'process' && currentStep !== 'COMPARISON' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
              <button
                onClick={() => { setView('new'); setCurrentStep('UPLOAD_RH'); }}
                className="mb-8 flex items-center text-slate-400 hover:text-white transition-colors group"
              >
                <div className="bg-white/5 p-2 rounded-lg mr-3 group-hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Reiniciar</span>
              </button>
              <StepUpload
                {...getActiveStepConfig()}
                isLoading={isLoading}
                error={error}
                allowMultiple={true}
                onFileUpload={(files) => handleFileUpload(files, getActiveStepConfig().type)}
                onConfirm={(data, files) => handleConfirmData(data, files, getActiveStepConfig().type)}
                onClear={() => handleClearStep(getActiveStepConfig().type)}
                blankDataFactory={() => createBlankData(getActiveStepConfig().type)}
              />
            </div>
          )}
          {view === 'process' && currentStep === 'COMPARISON' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-6xl mx-auto">
              <button
                onClick={() => { if (viewingRecord) { setViewingRecord(null); setView('history'); } else { setCurrentStep('UPLOAD_GUIA'); } }}
                className="mb-8 flex items-center text-slate-400 hover:text-white transition-colors group"
              >
                <div className="bg-white/5 p-2 rounded-lg mr-3 group-hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">
                  {viewingRecord ? "Voltar ao Dossiê" : "Retornar ao Upload"}
                </span>
              </button>
              <ComparisonTable
                finalData={viewingRecord?.comparison_result ?? comparisonResult ?? undefined}
                onGenerateNotaTecnica={handleGenerateNotaTecnica}
                notaTecnicaText={notaTecnicaText}
                onNotaChange={setNotaTecnicaText}
                isLoadingNotaTecnica={isLoading}
                onReset={() => { setView('new'); setViewingRecord(null); setCurrentStep('UPLOAD_RH'); }}
                onRectify={() => {
                  if (viewingRecord) {
                    setOrgao(viewingRecord.orgao);
                    setCompetencia(viewingRecord.competencia);
                    if (viewingRecord.rh_relatorio_entries) setRelatorioData(viewingRecord.rh_relatorio_entries);
                    if (viewingRecord.retention_entries) setRetentionData(viewingRecord.retention_entries);
                    if (viewingRecord.empenho_entries) setEmpenhoData(viewingRecord.empenho_entries);
                    if (viewingRecord.liquidacao_entries) setLiquidacaoData(viewingRecord.liquidacao_entries);
                    if (viewingRecord.guia_entries) setGuiaData(viewingRecord.guia_entries);
                    setNotaTecnicaText(viewingRecord.nota_tecnica || null);
                    setCurrentStep('UPLOAD_RH');
                  }
                }}
                onSaveNotaTecnica={async (nota) => {
                  await savePartialReconciliation({ nota_tecnica: nota });
                }}
                isHistoryView={!!viewingRecord}
                files={viewingRecord?.files || []}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;