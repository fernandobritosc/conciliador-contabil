import React, { useState, useEffect } from 'react';
import { RhRelatorioData, RhGuiaData, RetentionReportData, ComparisonResult, Step, EmpenhoData, LiquidacaoData, ReconciliationRecord } from './types';
import { generateNotaTecnica, extractData } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import StepUpload from './components/StepUpload';
import ComparisonTable from './components/ComparisonTable';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import Settings from './components/Settings';
import { ArrowLeft, PlusCircle, History, Eye, CheckCircle, XCircle, Loader2, AlertTriangle, FileSpreadsheet, Trash2 } from 'lucide-react';

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

  const savePartialReconciliation = async (partialData: Partial<ReconciliationRecord>) => {
    const id = viewingRecord?.id || partialData.id || crypto.randomUUID();
    const newRecordData = {
      id,
      orgao: partialData.orgao || orgao,
      competencia: partialData.competencia || competencia,
      status: partialData.status || 'EM_ANDAMENTO',
      comparison_result: partialData.comparison_result || comparisonResult || null,
      nota_tecnica: partialData.nota_tecnica || viewingRecord?.nota_tecnica || notaTecnicaText || null,
      created_at: viewingRecord?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      files: partialData.files || viewingRecord?.files || [
        ...rhFiles.map(f => f.name),
        ...retentionFiles.map(f => f.name),
        ...empenhoFiles.map(f => f.name),
        ...liquidacaoFiles.map(f => f.name),
        ...guiaFiles.map(f => f.name)
      ]
    };

    try {
      const { data, error } = await supabase
        .from('reconciliacoes')
        .upsert(newRecordData)
        .select()
        .single();

      if (error) throw error;
      const savedRecord = data as ReconciliationRecord;

      setHistory(prev => {
        const index = prev.findIndex(h => h.id === savedRecord.id);
        if (index >= 0) {
          const newHistory = [...prev];
          newHistory[index] = savedRecord;
          return newHistory;
        }
        return [savedRecord, ...prev];
      });

      if (!viewingRecord || viewingRecord.id !== savedRecord.id) {
        setViewingRecord(savedRecord);
      }
      return savedRecord;
    } catch (err) {
      console.error("Failed to save partial reconciliation", err);
    }
  };

  const saveReconciliation = async (result: ComparisonResult) => {
    await savePartialReconciliation({
      status: result.finalStatus,
      comparison_result: result
    });
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

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente esta conciliação?")) return;

    try {
      const { error } = await supabase
        .from('reconciliacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHistory(prev => prev.filter(h => h.id !== id));
      if (viewingRecord?.id === id) {
        setViewingRecord(null);
        setView('history');
      }
    } catch (err) {
      console.error("Failed to delete record", err);
      alert("Erro ao excluir o registro.");
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
      const actualFiles = Array.from(files);
      setFiles(actualFiles);

      const extractedResults = await Promise.all(actualFiles.map(async (file) => {
        const base64Data = await fileToBase64(file);
        return await extractData(base64Data, file.type, docType as any);
      }));

      // Pass the list if multiple, or single if one
      setData(extractedResults.length > 1 ? extractedResults : extractedResults[0]);
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

  const confirmRhData = (data: RhRelatorioData, files: File[]) => {
    setRelatorioData(data);
    setRhFiles(files);
    setCurrentStep('UPLOAD_RETENTION');
    savePartialReconciliation({ files: files.map(f => f.name) });
  };
  const confirmRetentionData = (data: RetentionReportData, files: File[]) => {
    setRetentionData(data);
    setRetentionFiles(files);
    setCurrentStep('UPLOAD_EMPENHO');
    savePartialReconciliation({ files: [...rhFiles, ...files].map(f => f.name) });
  };
  const confirmEmpenhoData = (data: EmpenhoData, files: File[]) => {
    setEmpenhoData(data);
    setEmpenhoFiles(files);
    setCurrentStep('UPLOAD_LIQUIDACAO');
    savePartialReconciliation({ files: [...rhFiles, ...retentionFiles, ...files].map(f => f.name) });
  };
  const confirmLiquidacaoData = (data: LiquidacaoData, files: File[]) => {
    setLiquidacaoData(data);
    setLiquidacaoFiles(files);
    setCurrentStep('UPLOAD_GUIA');
    savePartialReconciliation({ files: [...rhFiles, ...retentionFiles, ...empenhoFiles, ...files].map(f => f.name) });
  };

  const confirmGuiaData = async (data: RhGuiaData, files: File[]) => {
    setGuiaData(data);
    setGuiaFiles(files);
    if (relatorioData && retentionData && empenhoData && liquidacaoData) {
      const tolerance = 0.05;

      const internalMatches = {
        seguradosMatch: Math.abs(data.valorSegurados - retentionData.valorRetido) < tolerance,
        empresaMatch: Math.abs(data.valorEmpresa - (liquidacaoData.valorBruto - liquidacaoData.salarioFamilia - liquidacaoData.salarioMaternidade)) < tolerance, // Ajuste para bater com patronal líquida
        acidenteMatch: Math.abs(data.valorRiscoAmbiental - (relatorioData.valorAcidente)) < tolerance, // RAT geralmente é direto do RH ou Contabilidade
        totalMatch: Math.abs(data.totalGuia - (retentionData.valorRetido + (liquidacaoData.valorBruto - liquidacaoData.salarioFamilia - liquidacaoData.salarioMaternidade) + relatorioData.valorAcidente)) < tolerance
      };

      const result: ComparisonResult = {
        relatorioData,
        retentionData, retentionMatch: Math.abs(retentionData.valorRetido - relatorioData.valorSegurados) < tolerance, retentionDifference: retentionData.valorRetido - relatorioData.valorSegurados,
        empenhoData, empenhoMatch: Math.abs(empenhoData.valor - retentionData.valorRetido) < tolerance, empenhoDifference: empenhoData.valor - retentionData.valorRetido,
        liquidacaoData, liquidacaoBrutoMatch: Math.abs(liquidacaoData.valorBruto - (relatorioData.valorEmpresa + relatorioData.valorAcidente)) < tolerance, liquidacaoBrutoDifference: liquidacaoData.valorBruto - (relatorioData.valorEmpresa + relatorioData.valorAcidente),
        liquidacaoRetencaoMatch: Math.abs((liquidacaoData.salarioFamilia + liquidacaoData.salarioMaternidade) - relatorioData.deducaoFpas) < tolerance, liquidacaoRetencaoDifference: (liquidacaoData.salarioFamilia + liquidacaoData.salarioMaternidade) - relatorioData.deducaoFpas,
        deducaoFpas: relatorioData.deducaoFpas,
        segurados: { rh: relatorioData.valorSegurados, guia: data.valorSegurados, diff: data.valorSegurados - relatorioData.valorSegurados, status: Math.abs(data.valorSegurados - relatorioData.valorSegurados) < tolerance ? 'MATCH' : 'MISMATCH' },
        empresa: { rh: relatorioData.valorEmpresa, guia: data.valorEmpresa, diff: data.valorEmpresa - relatorioData.valorEmpresa, status: Math.abs(data.valorEmpresa - relatorioData.valorEmpresa) < tolerance ? 'MATCH' : 'MISMATCH' },
        acidente: { rh: relatorioData.valorAcidente, guia: data.valorRiscoAmbiental, diff: data.valorRiscoAmbiental - relatorioData.valorAcidente, status: Math.abs(data.valorRiscoAmbiental - relatorioData.valorAcidente) < tolerance ? 'MATCH' : 'MISMATCH' },
        total: { rh: relatorioData.totalARecolher, guia: data.totalGuia, diff: data.totalGuia - relatorioData.totalARecolher, status: Math.abs(data.totalGuia - relatorioData.totalARecolher) < tolerance ? 'MATCH' : 'MISMATCH' },
        internalMatches,
        triangulation: {
          rh_vs_contab: {
            segurados: Math.abs(relatorioData.valorSegurados - retentionData.valorRetido) < tolerance,
            empresa: Math.abs(relatorioData.valorEmpresa - (liquidacaoData.valorBruto - liquidacaoData.salarioFamilia - liquidacaoData.salarioMaternidade)) < tolerance,
            total: Math.abs(relatorioData.totalARecolher - (retentionData.valorRetido + (liquidacaoData.valorBruto - liquidacaoData.salarioFamilia - liquidacaoData.salarioMaternidade))) < tolerance
          },
          contab_vs_darf: {
            segurados: internalMatches.seguradosMatch,
            empresa: internalMatches.empresaMatch,
            total: internalMatches.totalMatch
          }
        },
        totalContab: (retentionData.valorRetido + (liquidacaoData.valorBruto - liquidacaoData.salarioFamilia - liquidacaoData.salarioMaternidade)),
        finalStatus: 'DIVERGENTE' // Default
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
        internalMatches.totalMatch
      ].every(Boolean);

      if (rhMatches) {
        result.finalStatus = 'CONCILIADO';
      } else if (accountingGuiaMatches) {
        result.finalStatus = 'CONCILIADO_COM_RESSALVA';
      }

      setComparisonResult(result);
      await saveReconciliation(result);
      setCurrentStep('COMPARISON');
    }
  };

  const generateNotaTecnicaText = async () => {
    const dataToUse = viewingRecord ? viewingRecord.comparison_result : comparisonResult;
    if (!dataToUse) {
      console.error("Nenhum dado disponível para gerar a nota técnica.");
      return;
    }

    console.log("Gerando nota técnica para:", {
      origem: viewingRecord ? "Histórico" : "Nova Conciliação",
      id: viewingRecord?.id,
      tipoData: typeof dataToUse
    });

    setIsLoadingNotaTecnica(true);
    try {
      const report = await generateNotaTecnica(dataToUse);

      if (!report || report.includes("Não foi possível gerar")) {
        throw new Error("Resposta inválida da IA");
      }

      setNotaTecnicaText(report);

      // Se estiver visualizando histórico, já tenta salvar a nova nota
      if (viewingRecord) {
        await handleSaveNotaTecnica(report);
      }
    } catch (err) {
      console.error("Erro na geração da nota:", err);
      setNotaTecnicaText("Dificuldade na conexão com a IA. Por favor, tente novamente em instantes.");
    } finally {
      setIsLoadingNotaTecnica(false);
    }
  };

  const resetAll = (goToNew = true) => {
    setRelatorioData(null); setRetentionData(null); setEmpenhoData(null); setLiquidacaoData(null); setGuiaData(null);
    setRhFiles([]); setRetentionFiles([]); setEmpenhoFiles([]); setLiquidacaoFiles([]); setGuiaFiles([]);
    setComparisonResult(null); setNotaTecnicaText(null); setError(null); setViewingRecord(null);
    if (goToNew) {
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
    <div className="glass-card p-10 rounded-[2rem] animate-scale-in max-w-4xl mx-auto">
      <div className="flex items-center mb-10">
        <div className="bg-indigo-600/20 p-4 rounded-2xl mr-6 border border-indigo-500/20">
          <PlusCircle className="h-10 w-10 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Iniciar Auditoria</h2>
          <p className="text-slate-400 font-medium">Configure os parâmetros básicos para sua nova conciliação.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
        <div className="space-y-2">
          <label htmlFor="orgao" className="block text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Entidade / Órgão</label>
          <select id="orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)} className="bg-slate-800/50 text-slate-100 w-full px-4 py-3 border border-white/5 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer transition-all">
            <option value="">Selecione a entidade...</option>
            {ORGAOS.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="competencia" className="block text-xs font-bold uppercase tracking-[0.1em] text-indigo-400">Competência (MM/AAAA)</label>
          <input type="text" id="competencia" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="01/2026" className="bg-slate-800/50 text-slate-100 w-full px-4 py-3 border border-white/5 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
        </div>
      </div>
      <div className="mt-12">
        <button
          onClick={handleStartReconciliation}
          disabled={!orgao || !competencia}
          className="w-full relative group overflow-hidden px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="relative z-10 flex items-center justify-center">
            Configurar Processo <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
          </span>
        </button>
      </div>
    </div>
  );

  const renderHistoryScreen = () => {
    if (isHistoryLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-20 animate-fade-in">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
            <div className="absolute inset-0 blur-lg bg-indigo-500/20 animate-pulse" />
          </div>
          <p className="text-slate-400 font-semibold mt-6 tracking-wide uppercase text-xs">Acessando banco de dados...</p>
        </div>
      );
    }

    if (dbError) {
      return (
        <div className="max-w-2xl mx-auto glass-card border-red-500/20 p-6 rounded-2xl animate-scale-in">
          <div className="flex items-start">
            <div className="bg-red-500/10 p-3 rounded-xl mr-4">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Indisponibilidade de Conexão</p>
              <p className="text-slate-400 text-sm mt-1">{dbError}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="bg-slate-800 p-3 rounded-xl mr-4 border border-white/5">
              <History className="h-6 w-6 text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Dossiê de Conciliações</h2>
          </div>
          <div className="bg-indigo-600/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
            <span className="text-xs font-bold text-indigo-400">{history.length} REGISTROS</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {history.length > 0 ? history.map(rec => (
            <div key={rec.id} className="glass-card p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all duration-300">
              <div className="flex items-center space-x-6">
                <div className={`p-3 rounded-xl ${rec.status === 'CONCILIADO' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {rec.status === 'CONCILIADO' ? <CheckCircle className="h-6 w-6 text-emerald-400" /> : <AlertTriangle className="h-6 w-6 text-red-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 group-hover:text-white transition-colors">{rec.orgao}</h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-medium">
                    <span className="bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">REF: {rec.competencia}</span>
                    <span>•</span>
                    <span>Finalizado em {new Date(rec.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <button onClick={() => handleViewHistory(rec.id)} className="flex items-center text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">
                  Detalhes <Eye className="h-4 w-4 ml-2" />
                </button>
                <button onClick={() => handleDeleteRecord(rec.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Excluir Conciliação">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )) : (
            <div className="glass-card p-12 rounded-3xl border-dashed border-white/5 text-center">
              <History className="h-12 w-12 text-slate-600 mx-auto mb-4 opacity-20" />
              <p className="text-slate-500 font-medium">Nenhum dossiê encontrado no sistema.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderProcessScreen = () => {
    const steps = [
      {
        step: 'UPLOAD_RH',
        title: '1. Relatório do RH',
        description: "Envie a 'Relação da Contribuição Previdenciária'.",
        manualTitle: "Relação da Contribuição Previdenciária",
        type: 'Relatorio',
        allowMultiple: false,
        data: relatorioData,
        files: rhFiles,
        onFileUpload: handleRhUpload,
        onConfirm: confirmRhData,
        onClear: () => { setRelatorioData(null); setRhFiles([]); setError(null); },
        back: 'new',
        stepLabel: "1 de 5",
        section: "RH",
        availableReportTypes: [{ key: 'Relatorio', label: 'Relação Contrib. Previdenciária' }]
      },
      {
        step: 'UPLOAD_RETENTION',
        title: '2. Retenção de INSS',
        description: "Envie o relatório de retenção de INSS dos segurados.",
        manualTitle: "Relação de Retenção",
        type: 'Retention',
        allowMultiple: true,
        data: retentionData,
        files: retentionFiles,
        onFileUpload: handleRetentionUpload,
        onConfirm: confirmRetentionData,
        onClear: () => { setRetentionData(null); setRetentionFiles([]); setError(null); },
        back: 'UPLOAD_RH',
        stepLabel: "2 de 5",
        section: "Contabilidade",
        expectedValue: relatorioData ? { label: "Segurados (RH)", value: relatorioData.valorSegurados, keyToMatch: 'valorRetido' } : undefined,
        availableReportTypes: [{ key: 'Retention', label: 'Relatório de Retenção' }]
      },
      {
        step: 'UPLOAD_EMPENHO',
        title: '3. Empenho Extra-Orçamentário',
        description: "Envie o empenho para os segurados.",
        manualTitle: "Empenho Extraorçamentário",
        type: 'Empenho',
        allowMultiple: true,
        data: empenhoData,
        files: empenhoFiles,
        onFileUpload: handleEmpenhoUpload,
        onConfirm: confirmEmpenhoData,
        onClear: () => { setEmpenhoData(null); setEmpenhoFiles([]); setError(null); },
        back: 'UPLOAD_RETENTION',
        stepLabel: "3 de 5",
        section: "Contabilidade",
        expectedValue: relatorioData ? { label: "Alvo Segurados (RH)", value: relatorioData.valorSegurados, keyToMatch: 'valor' } : undefined,
        availableReportTypes: [{ key: 'Empenho', label: 'Nota de Empenho' }]
      },
      {
        step: 'UPLOAD_LIQUIDACAO',
        title: '4. Nota de Liquidação',
        description: "Envie a liquidação da parte patronal e deduções.",
        manualTitle: "Nota de Liquidação",
        type: 'Liquidacao',
        allowMultiple: true,
        data: liquidacaoData,
        files: liquidacaoFiles,
        onFileUpload: handleLiquidacaoUpload,
        onConfirm: confirmLiquidacaoData,
        onClear: () => { setLiquidacaoData(null); setLiquidacaoFiles([]); setError(null); },
        back: 'UPLOAD_EMPENHO',
        stepLabel: "4 de 5",
        section: "Contabilidade",
        expectedValue: relatorioData ? { label: "Patronal (RH)", value: relatorioData.valorEmpresa + relatorioData.valorAcidente, keyToMatch: 'valorBruto' } : undefined,
        availableReportTypes: [{ key: 'Liquidacao', label: 'Nota de Liquidação' }]
      },
      {
        step: 'UPLOAD_GUIA',
        title: '5. Guia de Recolhimento (DARF)',
        description: "Envie o 'Documento de Arrecadação' (DARF).",
        manualTitle: "DARF Previdenciário",
        type: 'Guia',
        allowMultiple: true,
        data: guiaData,
        files: guiaFiles,
        onFileUpload: handleGuiaUpload,
        onConfirm: confirmGuiaData,
        onClear: () => { setGuiaData(null); setGuiaFiles([]); setError(null); },
        back: 'UPLOAD_LIQUIDACAO',
        stepLabel: "5 de 5",
        section: "Contabilidade",
        expectedValue: relatorioData ? { label: "Total a Recolher (RH)", value: relatorioData.totalARecolher, keyToMatch: 'totalGuia' } : undefined,
        availableReportTypes: [
          { key: 'Guia', label: 'DARF Previdenciário' },
          { key: 'GuiaOutros', label: 'Outras Guias' }
        ]
      },
    ] as const;

    const activeStep = steps.find(s => s.step === currentStep);

    if (activeStep) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
          <button
            onClick={() => activeStep.back === 'new' ? setView('new') : setCurrentStep(activeStep.back as Step)}
            className="mb-8 flex items-center text-slate-400 hover:text-white transition-colors group"
          >
            <div className="bg-white/5 p-2 rounded-lg mr-3 group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Retornar</span>
          </button>

          <div className="flex items-center space-x-4 mb-10">
            <div className="bg-indigo-600/20 px-4 py-1.5 rounded-full border border-indigo-500/30">
              <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Etapa {activeStep.stepLabel}</span>
            </div>
            <div className="h-px w-8 bg-white/10" />
            <span className="text-sm font-bold text-slate-300 uppercase tracking-tight">{activeStep.section}</span>
          </div>

          <StepUpload {...activeStep} isLoading={isLoading} error={error} blankDataFactory={() => createBlankData(activeStep.type)} />
        </div>
      );
    }

    if (currentStep === 'COMPARISON' && (comparisonResult || viewingRecord)) {
      const finalDataToShow = viewingRecord ? viewingRecord.comparison_result : comparisonResult!;
      return (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-6xl mx-auto">
          <button
            onClick={() => { if (viewingRecord) { setViewingRecord(null); setView('history'); } else { setCurrentStep('UPLOAD_GUIA'); } }}
            className="mb-8 flex items-center text-slate-400 hover:text-white transition-colors group"
          >
            <div className="bg-white/5 p-2 rounded-lg mr-3 group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{viewingRecord ? "Voltar ao Dossiê" : "Retornar ao Upload"}</span>
          </button>
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
    <div className="flex h-screen bg-[#0b0f19] font-sans text-slate-200">
      <Sidebar currentView={view} setView={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header orgao={view === 'process' ? orgao : undefined} competencia={view === 'process' ? competencia : undefined} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {view === 'new' && renderNewScreen()}
          {view === 'history' && renderHistoryScreen()}
          {view === 'process' && renderProcessScreen()}
        </main>
      </div>
    </div>
  );
};

export default App;