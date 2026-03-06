import React, { useState } from 'react';
import { Step } from './types';
import { extractData, generateNotaTecnica } from './services/geminiService';
import { logger } from './services/logger';
import { useReconciliation } from './hooks/useReconciliation';

// Componentes
import StepUpload from './components/StepUpload';
import ComparisonTable from './components/ComparisonTable';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

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
  const [view, setView] = useState<'new' | 'history' | 'process'>('new');

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
    comparisonResult,
    notaTecnicaText, setNotaTecnicaText,
    isLoading, setIsLoading,
    isHistoryLoading,
    error, setError,
    saveStatus,
    savePartialReconciliation,
    performComparison,
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
    // Atualiza os dados e arquivos (podem ter vindo de edição manual ou novos anexos)
    switch (type) {
      case 'Relatorio': setRelatorioData(data); setRhFiles(files); break;
      case 'Retention': setRetentionData(data); setRetentionFiles(files); break;
      case 'Empenho': setEmpenhoData(data); setEmpenhoFiles(files); break;
      case 'Liquidacao': setLiquidacaoData(data); setLiquidacaoFiles(files); break;
      case 'Guia': setGuiaData(data); setGuiaFiles(files); break;
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
        const result = performComparison(relatorioData, retentionData, empenhoData, liquidacaoData, guiaData);
        if (result) {
          await savePartialReconciliation({ comparison_result: result, status: result.finalStatus });
        }
      }
      setCurrentStep(nextStep);
    }
  };

  const handleClearStep = (type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    switch (type) {
      case 'Relatorio': setRelatorioData(null); setRhFiles([]); break;
      case 'Retention': setRetentionData(null); setRetentionFiles([]); break;
      case 'Empenho': setEmpenhoData(null); setEmpenhoFiles([]); break;
      case 'Liquidacao': setLiquidacaoData(null); setLiquidacaoFiles([]); break;
      case 'Guia': setGuiaData(null); setGuiaFiles([]); break;
    }
  };

  const handleGenerateNotaTecnica = async () => {
    const data = viewingRecord?.comparison_result || comparisonResult;
    if (!data) return;
    setIsLoading(true);
    try {
      const text = await generateNotaTecnica(data);
      setNotaTecnicaText(text);
      await savePartialReconciliation({ nota_tecnica: text });
    } catch (err) {
      logger.error('Erro ao gerar nota técnica', err);
    } finally {
      setIsLoading(false);
    }
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
            className="bg-slate-800 text-slate-200 w-full px-4 py-3 border border-slate-700 rounded-lg focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>
      <button
        onClick={() => { setView('process'); setCurrentStep('UPLOAD_RH'); }}
        disabled={!orgao || !competencia}
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
      ) : (
        <div className="grid gap-3">
          {history.map(rec => (
            <div key={rec.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex justify-between items-center group transition-colors hover:border-slate-700">
              <div className="flex items-center space-x-6">
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <History className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">{rec.orgao}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-slate-500 font-mono">REF: {rec.competencia}</span>
                    <span className="text-[10px] font-bold uppercase text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/20">{rec.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setViewingRecord(rec); setView('process'); setCurrentStep('COMPARISON'); }}
                className="flex items-center text-xs font-semibold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Detalhes <Eye className="h-4 w-4 ml-2" />
              </button>
            </div>
          ))}
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
    <div className="flex h-screen bg-[#0F172A] font-sans text-slate-200">
      <Sidebar currentView={view} setView={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header orgao={orgao} competencia={competencia} saveStatus={saveStatus} />
        <main className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
          {view === 'new' && renderNewScreen()}
          {view === 'history' && renderHistoryScreen()}
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
                finalData={viewingRecord?.comparison_result || comparisonResult!}
                onGenerateNotaTecnica={handleGenerateNotaTecnica}
                notaTecnicaText={notaTecnicaText}
                onNotaChange={setNotaTecnicaText}
                isLoadingNotaTecnica={isLoading}
                onReset={() => { setView('new'); setViewingRecord(null); setCurrentStep('UPLOAD_RH'); }}
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