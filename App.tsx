import React, { useState, useEffect } from 'react';
import { RhRelatorioData, RhGuiaData, RetentionReportData, ComparisonResult, Step, EmpenhoData, LiquidacaoData, ReconciliationRecord } from './types';
import { generateNotaTecnica, extractData } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import StepUpload from './components/StepUpload';
import ComparisonTable from './components/ComparisonTable';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import Settings from './components/Settings';
import { ArrowLeft, PlusCircle, History, Eye, CheckCircle, XCircle, Loader2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const ORGAOS = [
  "PREFEITURA MUNICIPAL DE SENADOR CANEDO",
  "FMAS - FUNDO MUNICIPAL ASSISTENCIA SOCIAL",
  "FMDCA - FUNDO MUNICIPAL DA INFANCIA E DA ADOLESCENCIA",
  "FME - FUNDO MUNICIPAL DE EDUCAÇÃO, CULTURA, ESPORTE",
  "FMS - FUNDO MUNICIPAL DE SAUDE",
  "FUMDEC - FUNDO MUNICIPAL DE PROTEÇÃO E DEFESA CIVIL",
  "FUNDEB - SENADOR CANEDO",
  "FUNDI - FUNDO MUNICIPAL DOS DIREITOS DO IDOSO",
  "FUNDO MUNICIPAL DE BEM-ESTAR E PROTECAO ANIMAL - FUMBEPA",
  "IAMESC - INSTITUTO DE ASSISTÊNCIA A SAUDE DO SERV PUBLICO",
  "INSTITUTO DE PREVIDENCIA DO SERVIDOR PUBLICO DE SENADOR CANEDO - SENAPR",
];

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const createBlankData = (type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    switch (type) {
        case 'Relatorio': return { valorSegurados: 0, valorEmpresa: 0, valorAcidente: 0, deducaoFpas: 0, totalARecolher: 0 };
        case 'Guia': return { valorSegurados: 0, valorEmpresa: 0, valorRiscoAmbiental: 0, totalGuia: 0 };
        case 'Retention': return { valorRetido: 0, competencia: '', empresa: '' };
        case 'Empenho': return { numeroEmpenho: '', valor: 0 };
        case 'Liquidacao': return { numeroEmpenho: '', valorBruto: 0, salarioFamilia: 0, salarioMaternidade: 0 };
        default: return {};
    }
};

type View = 'new' | 'history' | 'process';

const App: React.FC = () => {
  if (!supabase) {
    return <Settings />;
  }

  const [view, setView] = useState<View>('new');
  const [currentStep, setCurrentStep] = useState<Step>('UPLOAD_RH');
  
  const [orgao, setOrgao] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [history, setHistory] = useState<ReconciliationRecord[]>([]);
  const [viewingRecord, setViewingRecord] = useState<ReconciliationRecord | null>(null);

  const [relatorioData, setRelatorioData] = useState<RhRelatorioData | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionReportData | null>(null);
  const [empenhoData, setEmpenhoData] = useState<EmpenhoData | null>(null);
  const [liquidacaoData, setLiquidacaoData] = useState<LiquidacaoData | null>(null);
  const [guiaData, setGuiaData] = useState<RhGuiaData | null>(null);
  
  const [rhFiles, setRhFiles] = useState<File[]>([]);
  const [retentionFiles, setRetentionFiles] = useState<File[]>([]);
  const [empenhoFiles, setEmpenhoFiles] = useState<File[]>([]);
  const [liquidacaoFiles, setLiquidacaoFiles] = useState<File[]>([]);
  const [guiaFiles, setGuiaFiles] = useState<File[]>([]);
  
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [notaTecnicaText, setNotaTecnicaText] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNotaTecnica, setIsLoadingNotaTecnica] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);


  useEffect(() => {
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      setDbError(null);
      try {
        const { data, error } = await supabase
          .from('reconciliacoes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHistory(data as ReconciliationRecord[]);
      } catch (err: any) {
        console.error("Failed to load history from Supabase", err);
        setDbError("Falha ao carregar histórico do banco de dados. Verifique sua conexão e as configurações do Supabase.");
      } finally {
        setIsHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const saveReconciliation = async (result: ComparisonResult) => {
    const newRecordData = {
      orgao,
      competencia,
      status: result.finalStatus,
      comparison_result: result,
      nota_tecnica: null,
    };
    
    try {
        const { data, error } = await supabase
            .from('reconciliacoes')
            .insert(newRecordData)
            .select()
            .single();

        if (error) throw error;

        setHistory(prev => [data as ReconciliationRecord, ...prev]);
    } catch (err) {
        console.error("Failed to save reconciliation to Supabase", err);
        setError("Erro ao salvar a conciliação no banco de dados.");
    }
  };

  const handleSaveNotaTecnica = async (nota: string) => {
    const recordId = viewingRecord?.id || history.find(h => h.comparison_result === comparisonResult)?.id;
    if (!recordId) {
        console.error("Não foi possível encontrar o ID do registro para salvar a nota.");
        return;
    }

    try {
        const { error } = await supabase
            .from('reconciliacoes')
            .update({ nota_tecnica: nota })
            .eq('id', recordId);

        if (error) throw error;

        // Update local state to reflect the change immediately
        setHistory(prev => prev.map(rec => rec.id === recordId ? { ...rec, nota_tecnica: nota } : rec));
        if (viewingRecord?.id === recordId) {
            setViewingRecord(prev => prev ? { ...prev, nota_tecnica: nota } : null);
        }

    } catch (err) {
        console.error("Failed to save note to Supabase", err);
        // Optionally, show an error to the user
        alert("Erro ao salvar o parecer técnico.");
    }
  };

  const handleStartReconciliation = () => {
    if (orgao && competencia) {
      resetAll(false);
      setCurrentStep('UPLOAD_RH');
      setView('process');
    }
  };

  const createUploadHandler = (
    setFiles: (files: File[]) => void,
    setData: (data: any) => void,
    docType: 'Relatorio' | 'Retention' | 'Empenho' | 'Liquidacao' | 'Guia',
    docName: string
  ) => async (files: FileList) => {
    setIsLoading(true);
    setError(null);
    try {
      const fileToProcess = files[0];
      setFiles([fileToProcess]);
      const base64Data = await fileToBase64(fileToProcess);
      const data = await extractData(base64Data, fileToProcess.type, docType as any);
      setData(data);
    } catch (err: any) {
      console.error("Erro detalhado:", err);
      const isQuotaError = err?.message?.includes('Sua cota de uso da API foi excedida');
      setError(isQuotaError 
          ? err.message + '\n\nPor favor, preencha os valores manualmente para continuar.'
          : `Falha ao ler o ${docName}: ${err?.message || "Erro desconhecido"}`
      );
      setData(createBlankData(docType));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRhUpload = createUploadHandler(setRhFiles, setRelatorioData, 'Relatorio', 'Relatório RH');
  const handleRetentionUpload = createUploadHandler(setRetentionFiles, setRetentionData, 'Retention', 'Relatório de Retenção');
  const handleEmpenhoUpload = createUploadHandler(setEmpenhoFiles, setEmpenhoData, 'Empenho', 'Empenho');
  const handleLiquidacaoUpload = createUploadHandler(setLiquidacaoFiles, setLiquidacaoData, 'Liquidacao', 'Nota de Liquidação');
  const handleGuiaUpload = createUploadHandler(setGuiaFiles, setGuiaData, 'Guia', 'Guia DARF');

  const confirmRhData = (data: RhRelatorioData, files: File[]) => { setRelatorioData(data); setRhFiles(files); setCurrentStep('UPLOAD_RETENTION'); };
  const confirmRetentionData = (data: RetentionReportData, files: File[]) => { setRetentionData(data); setRetentionFiles(files); setCurrentStep('UPLOAD_EMPENHO'); };
  const confirmEmpenhoData = (data: EmpenhoData, files: File[]) => { setEmpenhoData(data); setEmpenhoFiles(files); setCurrentStep('UPLOAD_LIQUIDACAO'); };
  const confirmLiquidacaoData = (data: LiquidacaoData, files: File[]) => { setLiquidacaoData(data); setLiquidacaoFiles(files); setCurrentStep('UPLOAD_GUIA'); }

  const confirmGuiaData = async (data: RhGuiaData, files: File[]) => {
    setGuiaData(data);
    setGuiaFiles(files);
    if (relatorioData && retentionData && empenhoData && liquidacaoData) {
      const tolerance = 0.05;
      const result: ComparisonResult = {
        retentionData, retentionMatch: Math.abs(retentionData.valorRetido - relatorioData.valorSegurados) < tolerance, retentionDifference: retentionData.valorRetido - relatorioData.valorSegurados,
        empenhoData, empenhoMatch: Math.abs(empenhoData.valor - retentionData.valorRetido) < tolerance, empenhoDifference: empenhoData.valor - retentionData.valorRetido,
        liquidacaoData, liquidacaoBrutoMatch: Math.abs(liquidacaoData.valorBruto - (relatorioData.valorEmpresa + relatorioData.valorAcidente)) < tolerance, liquidacaoBrutoDifference: liquidacaoData.valorBruto - (relatorioData.valorEmpresa + relatorioData.valorAcidente),
        liquidacaoRetencaoMatch: Math.abs((liquidacaoData.salarioFamilia + liquidacaoData.salarioMaternidade) - relatorioData.deducaoFpas) < tolerance, liquidacaoRetencaoDifference: (liquidacaoData.salarioFamilia + liquidacaoData.salarioMaternidade) - relatorioData.deducaoFpas,
        deducaoFpas: relatorioData.deducaoFpas,
        segurados: { rh: relatorioData.valorSegurados, guia: data.valorSegurados, diff: data.valorSegurados - relatorioData.valorSegurados, status: Math.abs(data.valorSegurados - relatorioData.valorSegurados) < tolerance ? 'MATCH' : 'MISMATCH' },
        empresa: { rh: relatorioData.valorEmpresa, guia: data.valorEmpresa, diff: data.valorEmpresa - relatorioData.valorEmpresa, status: Math.abs(data.valorEmpresa - relatorioData.valorEmpresa) < tolerance ? 'MATCH' : 'MISMATCH' },
        acidente: { rh: relatorioData.valorAcidente, guia: data.valorRiscoAmbiental, diff: data.valorRiscoAmbiental - relatorioData.valorAcidente, status: Math.abs(data.valorRiscoAmbiental - relatorioData.valorAcidente) < tolerance ? 'MATCH' : 'MISMATCH' },
        total: { rh: relatorioData.totalARecolher, guia: data.totalGuia, diff: data.totalGuia - relatorioData.totalARecolher, status: Math.abs(data.totalGuia - relatorioData.totalARecolher) < tolerance ? 'MATCH' : 'MISMATCH' },
        finalStatus: [
            Math.abs(retentionData.valorRetido - relatorioData.valorSegurados) < tolerance,
            Math.abs(empenhoData.valor - retentionData.valorRetido) < tolerance,
            Math.abs(liquidacaoData.valorBruto - (relatorioData.valorEmpresa + relatorioData.valorAcidente)) < tolerance,
            Math.abs((liquidacaoData.salarioFamilia + liquidacaoData.salarioMaternidade) - relatorioData.deducaoFpas) < tolerance,
            Math.abs(data.valorSegurados - relatorioData.valorSegurados) < tolerance,
            Math.abs(data.valorEmpresa - relatorioData.valorEmpresa) < tolerance,
            Math.abs(data.valorRiscoAmbiental - relatorioData.valorAcidente) < tolerance,
            Math.abs(data.totalGuia - relatorioData.totalARecolher) < tolerance,
        ].every(Boolean) ? 'CONCILIADO' : 'DIVERGENTE'
      };
      setComparisonResult(result);
      await saveReconciliation(result);
      setCurrentStep('COMPARISON');
    }
  };
  
  const generateNotaTecnicaText = async () => {
    const dataToUse = viewingRecord ? viewingRecord.comparison_result : comparisonResult;
    if (!dataToUse) return;
    setIsLoadingNotaTecnica(true);
    try {
      const report = await generateNotaTecnica(dataToUse);
      setNotaTecnicaText(report);
    } catch (err) { console.error(err); setNotaTecnicaText("Erro ao gerar parecer técnico."); } finally { setIsLoadingNotaTecnica(false); }
  };
  
  const resetAll = (goToNew = true) => {
    setRelatorioData(null); setRetentionData(null); setEmpenhoData(null); setLiquidacaoData(null); setGuiaData(null);
    setRhFiles([]); setRetentionFiles([]); setEmpenhoFiles([]); setLiquidacaoFiles([]); setGuiaFiles([]);
    setComparisonResult(null); setNotaTecnicaText(null); setError(null); setViewingRecord(null);
    if(goToNew) {
      setView('new');
      setOrgao('');
      setCompetencia('');
    }
  };

  const handleViewHistory = (recordId: string) => {
    const record = history.find(h => h.id === recordId);
    if (record) {
        setViewingRecord(record);
        setNotaTecnicaText(record.nota_tecnica);
        setCurrentStep('COMPARISON');
        setView('process');
    }
  };

  const handleRectify = (record: ReconciliationRecord) => {
    setOrgao(record.orgao);
    setCompetencia(record.competencia);

    const res = record.comparison_result;

    setRelatorioData({
        valorSegurados: res.segurados.rh,
        valorEmpresa: res.empresa.rh,
        valorAcidente: res.acidente.rh,
        deducaoFpas: res.deducaoFpas,
        totalARecolher: res.total.rh,
    });

    setRetentionData(res.retentionData || null);
    setEmpenhoData(res.empenhoData || null);
    setLiquidacaoData(res.liquidacaoData || null);

    setGuiaData({
        valorSegurados: res.segurados.guia,
        valorEmpresa: res.empresa.guia,
        valorRiscoAmbiental: res.acidente.guia,
        totalGuia: res.total.guia,
    });

    setRhFiles([]);
    setRetentionFiles([]);
    setEmpenhoFiles([]);
    setLiquidacaoFiles([]);
    setGuiaFiles([]);
    
    setComparisonResult(null);
    setNotaTecnicaText(null);
    setError(null);
    setViewingRecord(null);

    setView('process');
    setCurrentStep('UPLOAD_RH');
  };

  const renderNewScreen = () => (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-zinc-200">
      <div className="flex items-center mb-6">
        <FileSpreadsheet className="h-8 w-8 text-indigo-600 mr-4" />
        <div>
          <h2 className="text-2xl font-bold text-zinc-800">Nova Conciliação Previdenciária</h2>
          <p className="text-sm text-zinc-500">Preencha os campos abaixo para iniciar a análise.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
        <div>
          <label htmlFor="orgao" className="block text-sm font-medium text-zinc-700 mb-1">Órgão</label>
          <select id="orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)} className="bg-white text-zinc-800 w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Selecione um órgão...</option>
            {ORGAOS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="competencia" className="block text-sm font-medium text-zinc-700 mb-1">Competência</label>
          <input type="text" id="competencia" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="MM/AAAA" className="bg-white text-zinc-800 w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <button onClick={handleStartReconciliation} disabled={!orgao || !competencia} className="w-full md:w-auto flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
          Iniciar Análise
        </button>
      </div>
    </div>
  );

  const renderHistoryScreen = () => {
    if (isHistoryLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
          <p className="text-lg font-medium text-zinc-700">Carregando histórico...</p>
        </div>
      );
    }

    if (dbError) {
      return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Erro de Conexão</p>
              <p className="text-sm mt-1">{dbError}</p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div>
        <div className="flex items-center mb-6">
          <History className="h-8 w-8 text-zinc-600 mr-4" />
          <h2 className="text-2xl font-bold text-zinc-800">Histórico de Conciliações</h2>
        </div>
        <div className="space-y-4">
          {history.length > 0 ? history.map(rec => (
            <div key={rec.id} className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between hover:border-indigo-400 hover:shadow-md transition-all">
              <div>
                <p className="font-bold text-zinc-800">{rec.orgao}</p>
                <p className="text-sm text-zinc-500">Competência: {rec.competencia} | Data: {new Date(rec.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex items-center gap-4">
                {rec.status === 'CONCILIADO' ? <span className="flex items-center text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full"><CheckCircle className="h-4 w-4 mr-1"/>CONCILIADO</span> : <span className="flex items-center text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full"><XCircle className="h-4 w-4 mr-1"/>DIVERGENTE</span>}
                <button onClick={() => handleViewHistory(rec.id)} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"><Eye className="h-4 w-4 mr-1"/>Ver Detalhes</button>
              </div>
            </div>
          )) : <p className="text-center text-zinc-500 bg-white p-6 rounded-lg shadow-sm border">Nenhuma conciliação salva.</p>}
        </div>
      </div>
    );
  }

  const renderProcessScreen = () => {
    const steps = [
      { step: 'UPLOAD_RH', title: '1. Relatório do RH', description: "Envie a 'Relação da Contribuição Previdenciária'.", manualTitle: "Lançamento - Relação da Contribuição Previdenciária", type: 'Relatorio', allowMultiple: false, data: relatorioData, files: rhFiles, onFileUpload: handleRhUpload, onConfirm: confirmRhData, onClear: () => { setRelatorioData(null); setRhFiles([]); setError(null); }, back: 'new', stepLabel: "1 de 5", section: "Dados do RH" },
      { step: 'UPLOAD_RETENTION', title: '2. Relatório de Retenção (Contabilidade)', description: "Envie o relatório de retenção de INSS dos segurados.", manualTitle: "Lançamentos - Relação de Retenção", type: 'Retention', allowMultiple: true, data: retentionData, files: retentionFiles, onFileUpload: handleRetentionUpload, onConfirm: confirmRetentionData, onClear: () => { setRetentionData(null); setRetentionFiles([]); setError(null); }, back: 'UPLOAD_RH', stepLabel: "2 de 5", section: "Dados da Contabilidade" },
      { step: 'UPLOAD_EMPENHO', title: '3. Empenho Extra-Orçamentário', description: "Envie o empenho para os segurados.", manualTitle: "Lançamentos - Empenho Extraorçamentário", type: 'Empenho', allowMultiple: true, data: empenhoData, files: empenhoFiles, onFileUpload: handleEmpenhoUpload, onConfirm: confirmEmpenhoData, onClear: () => { setEmpenhoData(null); setEmpenhoFiles([]); setError(null); }, back: 'UPLOAD_RETENTION', stepLabel: "3 de 5", section: "Dados da Contabilidade" },
      { step: 'UPLOAD_LIQUIDACAO', title: '4. Nota de Liquidação', description: "Envie a liquidação da parte patronal e deduções.", manualTitle: "Lançamentos - Nota de Liquidação", type: 'Liquidacao', allowMultiple: true, data: liquidacaoData, files: liquidacaoFiles, onFileUpload: handleLiquidacaoUpload, onConfirm: confirmLiquidacaoData, onClear: () => { setLiquidacaoData(null); setLiquidacaoFiles([]); setError(null); }, back: 'UPLOAD_EMPENHO', stepLabel: "4 de 5", section: "Dados da Contabilidade" },
      { step: 'UPLOAD_GUIA', title: '5. Guia de Recolhimento (DARF)', description: "Envie o 'Documento de Arrecadação' (DARF).", manualTitle: "Lançamentos - DARF", type: 'Guia', allowMultiple: true, data: guiaData, files: guiaFiles, onFileUpload: handleGuiaUpload, onConfirm: confirmGuiaData, onClear: () => { setGuiaData(null); setGuiaFiles([]); setError(null); }, back: 'UPLOAD_LIQUIDACAO', stepLabel: "5 de 5", section: "Guia de Recolhimento" },
    ] as const;
    
    const activeStep = steps.find(s => s.step === currentStep);

    if (activeStep) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={() => activeStep.back === 'new' ? setView('new') : setCurrentStep(activeStep.back as Step)} className="mb-4 flex items-center text-zinc-500 hover:text-zinc-800 transition"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</button>
          <div className="flex items-center space-x-2 text-sm text-zinc-500 mb-6">
            <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Etapa {activeStep.stepLabel}</span>
            <span>{activeStep.section}</span>
          </div>
          <StepUpload {...activeStep} isLoading={isLoading} error={error} blankDataFactory={() => createBlankData(activeStep.type)} />
        </div>
      );
    }

    if (currentStep === 'COMPARISON' && (comparisonResult || viewingRecord)) {
      const finalDataToShow = viewingRecord ? viewingRecord.comparison_result : comparisonResult!;
      return (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
          <button onClick={() => { if (viewingRecord) { setViewingRecord(null); setView('history'); } else { setCurrentStep('UPLOAD_GUIA'); } }} className="mb-4 flex items-center text-zinc-500 hover:text-zinc-800 transition"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</button>
          <ComparisonTable
            finalData={finalDataToShow}
            onGenerateNotaTecnica={generateNotaTecnicaText}
            notaTecnicaText={notaTecnicaText}
            isLoadingNotaTecnica={isLoadingNotaTecnica}
            onReset={() => resetAll(true)}
            onRectify={() => handleRectify(viewingRecord!)}
            isHistoryView={!!viewingRecord}
            onSaveNotaTecnica={handleSaveNotaTecnica}
            files={[...rhFiles, ...retentionFiles, ...empenhoFiles, ...liquidacaoFiles, ...guiaFiles]}
          />
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="flex h-screen bg-zinc-50 font-sans">
      <Sidebar currentView={view} setView={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header orgao={view === 'process' ? orgao : undefined} competencia={view === 'process' ? competencia : undefined} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50 p-4 md:p-8">
          {view === 'new' && renderNewScreen()}
          {view === 'history' && renderHistoryScreen()}
          {view === 'process' && renderProcessScreen()}
        </main>
      </div>
    </div>
  );
};

export default App;