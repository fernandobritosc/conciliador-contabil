import React, { useState, useEffect } from 'react';
import { ComparisonResult } from '../types';
import { CheckCircle, XCircle, FileText, Download, Loader2, Edit2, Save, Check, AlertCircle, History, PlusCircle } from 'lucide-react';
import { generatePdf } from '../services/pdfService';
import RichTextEditor from './RichTextEditor';

// --- Sub-componentes (Padrão de Decomposição - cc-skill-frontend-patterns) ---

const TriangulationDashboard: React.FC<{ result: ComparisonResult }> = ({ result }) => {
    const pillars = [
        { 
            label: 'Elo RH ↔ Contab', 
            status: result.triangulation?.rh_vs_contab.total ?? (Math.abs(result.total.rh - result.totalContab) < 0.01), 
            desc: 'Conferência interna de folha e lançamentos' 
        },
        { 
            label: 'Elo Contab ↔ DARF', 
            status: result.triangulation?.contab_vs_darf.total ?? (Math.abs(result.totalContab - result.total.guia) < 0.01), 
            desc: 'Conferência de pagamentos e obrigações' 
        },
        { 
            label: 'Elo Final RH ↔ DARF', 
            status: result.total.status === 'MATCH', 
            desc: 'Cruzamento final de origem e destino' 
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {pillars.map((p, i) => (
                <div key={i} className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${p.status ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{p.label}</h4>
                    <div className="flex items-center gap-3">
                        {p.status ? <CheckCircle className="h-6 w-6 text-emerald-500" /> : <XCircle className="h-6 w-6 text-red-500" />}
                        <span className={`text-lg font-bold ${p.status ? 'text-emerald-400' : 'text-red-400'}`}>
                            {p.status ? 'Íntegro' : 'Divergente'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">{p.desc}</p>
                </div>
            ))}
        </div>
    );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const isDivergente = status === 'DIVERGENTE';
    return (
        <div className={`px-6 py-2 rounded-2xl border font-bold text-sm tracking-widest uppercase ${isDivergente ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            {status || 'PROCESSANDO'}
        </div>
    );
};

const ComparisonCard: React.FC<{ item: any }> = ({ item }) => {
    const isRessalva = !item.match && item.linkB;
    return (
        <div className={`p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${item.match ? 'bg-[#0F172A] border-slate-800' : isRessalva ? 'bg-amber-950/20 border-amber-900/50' : 'bg-red-950/20 border-red-900/50'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                    <div className={`w-fit p-2 rounded-md ${item.match ? 'bg-emerald-500/10 text-emerald-500' : isRessalva ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                        {item.match ? <CheckCircle className="h-5 w-5" /> : isRessalva ? <AlertCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{item.label}</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">{item.desc}</p>
                    </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-3">
                    <div className="flex gap-1.5">
                        <div title="RH ↔ Contab" className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 ${item.linkA ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                            RH {item.linkA ? <Check className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                        </div>
                        <div title="Contab ↔ DARF" className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 ${item.linkB ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                            {item.labelB || 'CONTAB.'} {item.linkB ? <Check className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                        </div>
                    </div>
                    <p className={`text-base font-black font-mono tracking-tighter ${item.match ? 'text-emerald-400' : isRessalva ? 'text-cyan-400' : 'text-red-400'}`}>
                        {(item.valB - item.valA).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-white/5 mt-auto">
                <div className="flex-1 bg-slate-900/40 p-2 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">RH</p>
                    <p className="text-[11px] font-bold text-white font-mono">{item.valA.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="flex-1 bg-slate-900/40 p-2 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-right">{item.labelB || 'CONTAB.'}</p>
                    <p className="text-[11px] font-bold text-white font-mono text-right">{item.valB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>
        </div>
    );
};

interface ComparisonTableProps {
    finalData: ComparisonResult | undefined;
    onGenerateNotaTecnica: () => void;
    notaTecnicaText: string | null;
    isLoadingNotaTecnica: boolean;
    onReset: () => void;
    onRectify: () => void;
    isHistoryView: boolean;
    files: (File | string | null)[];
    onSaveNotaTecnica: (nota: string) => Promise<void>;
    onNotaChange: (nota: string) => void;
}

const AttachmentItem: React.FC<{ file: File | string }> = ({ file }) => {
    const isUrl = typeof file === 'string';
    const name = isUrl ? decodeURIComponent(file.split('/').pop()?.split('?')[0] || 'Anexo') : (file as File).name;
    const type = isUrl ? 'Documento Salvo' : (file as File).type;

    return (
        <div className="glass-card p-4 rounded-xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center overflow-hidden mr-3">
                <div className="bg-slate-800 p-2 rounded-lg mr-3 text-indigo-400 shrink-0">
                    <FileText className="h-5 w-5" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-slate-300 truncate" title={name}>{name}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{type}</span>
                </div>
            </div>
            {isUrl && (
                <a
                    href={file as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                    title="Baixar Anexo"
                >
                    <Download className="h-4 w-4" />
                </a>
            )}
        </div>
    );
};

const ComparisonTable: React.FC<ComparisonTableProps> = ({
    finalData,
    onGenerateNotaTecnica,
    notaTecnicaText,
    isLoadingNotaTecnica,
    onReset,
    onRectify,
    isHistoryView,
    files,
    onSaveNotaTecnica,
    onNotaChange
}) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [editableNotaTecnica, setEditableNotaTecnica] = useState<string>('');
    const [loadingTimeout, setLoadingTimeout] = useState(false);

    // Timeout: se após 8 segundos não houver dados, mostrar erro (MAS NÃO EM REGISTROS LEGADOS)
    useEffect(() => {
        if (!finalData && isHistoryView && !notaTecnicaText) {
            const timeoutId = setTimeout(() => {
                console.error('[TIMEOUT] Dados não chegaram após 8 segundos em registro histórico');
                setLoadingTimeout(true);
            }, 8000);
            return () => clearTimeout(timeoutId);
        }
    }, [finalData, isHistoryView, notaTecnicaText]);

    // Monitor de chegada de dados
    useEffect(() => {
        if (finalData && isHistoryView) {
            console.log('[DEBUG] ComparisonTable recebeu dados históricos com sucesso');
            setLoadingTimeout(false);
        }
    }, [finalData, isHistoryView]);

    useEffect(() => {
        if (notaTecnicaText) {
            const htmlContent = notaTecnicaText.startsWith('<') ? notaTecnicaText : notaTecnicaText
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => `<p>${line}</p>`)
                .join('');
            setEditableNotaTecnica(htmlContent);
        } else {
            setEditableNotaTecnica('<p>Clique em "Gerar Parecer Técnico" para que a análise seja preenchida ou insira seu texto diretamente aqui...</p>');
        }
    }, [notaTecnicaText]);

    const handleGeneratePdf = async () => {
        if (!editableNotaTecnica) return;
        setIsGeneratingPdf(true);
        try {
            await generatePdf(editableNotaTecnica, files, finalData);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSaveNote = async () => {
        setIsSavingNote(true);
        try {
            await onSaveNotaTecnica(editableNotaTecnica);
        } catch (error) {
            console.error("Save note failed:", error);
        } finally {
            setIsSavingNote(false);
        }
    };

    // Fallback para registro legado sem dados de comparação
    if (!finalData && isHistoryView && notaTecnicaText) {
        return (
            <div className="w-full animate-scale-in">
                <div className="flex items-center justify-between mb-10 p-6 bg-amber-950/20 border border-amber-900/50 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <AlertCircle className="h-8 w-8 text-amber-400" />
                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold text-amber-300">Registro Legado</h2>
                            <p className="text-xs text-amber-200 mt-1">Este registro foi criado antes das melhorias de auditoria e não contém dados de comparação.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onReset}
                        className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-widest border border-amber-500/30 px-4 py-2 rounded-full"
                    >
                        ← Voltar
                    </button>
                </div>

                <div className="mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col">
                            <h2 className="text-3xl font-extrabold text-white tracking-tighter">Nota Técnica</h2>
                            <p className="text-slate-400 font-medium mt-1">Parecer técnico registrado no sistema</p>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                        <RichTextEditor 
                            value={editableNotaTecnica}
                            onChange={(content) => {
                                setEditableNotaTecnica(content);
                                onNotaChange(content);
                            }}
                        />
                    </div>

                    <div className="mt-8 flex gap-4 justify-end">
                        <button
                            onClick={handleSaveNote}
                            disabled={isSavingNote}
                            className="flex items-center text-xs font-semibold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-6 py-3 rounded-lg border border-indigo-500/20 disabled:opacity-50"
                        >
                            {isSavingNote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isSavingNote ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    // Fallback para timeout - mostrar erro em vez de loading infinito
    if (loadingTimeout) {
        return (
            <div className="w-full flex flex-col justify-center items-center py-20 bg-red-950/20 rounded-3xl border border-red-900/50 border-dashed">
                <AlertCircle className="h-12 w-12 text-red-400 mb-6" />
                <p className="text-red-300 font-bold text-lg">Erro ao carregar dados</p>
                <p className="text-red-400 text-sm mt-2">Os dados do registro não chegaram a tempo. Tente novamente.</p>
                <button 
                    onClick={onReset}
                    className="mt-8 text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest border border-red-500/30 px-6 py-2 rounded-full"
                >
                    Voltar e Tentar Novamente
                </button>
            </div>
        );
    }

    if (!finalData) {
        return (
            <div className="w-full flex flex-col justify-center items-center py-20 bg-slate-900/50 rounded-3xl border border-white/5 border-dashed">
                <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-6" />
                <p className="text-slate-300 font-bold text-lg">Processando dados da conciliação...</p>
                <p className="text-slate-500 text-sm mt-2">Isso pode levar alguns segundos dependendo do volume de dados.</p>
                <button 
                    onClick={onReset}
                    className="mt-8 text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest border border-indigo-500/30 px-6 py-2 rounded-full"
                >
                    Cancelar e Reiniciar
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto animate-scale-in">
            <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-extrabold text-white tracking-tighter">Relatório de Auditoria</h2>
                    <p className="text-slate-400 font-medium mt-1">Análise multidimensional da conformidade previdenciária.</p>
                </div>
                <StatusBadge status={finalData?.finalStatus} />
            </div>

            <TriangulationDashboard result={finalData} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {[
                    { 
                        label: 'Segurados vs Retenção', 
                        valA: finalData.segurados.rh, 
                        valB: finalData.retentionData?.valorRetido || 0, 
                        match: finalData.triangulation?.rh_vs_contab.segurados ?? (Math.abs(finalData.segurados.rh - (finalData.retentionData?.valorRetido || 0)) < 0.01), 
                        linkA: finalData.triangulation?.rh_vs_contab.segurados ?? (Math.abs(finalData.segurados.rh - (finalData.retentionData?.valorRetido || 0)) < 0.01), 
                        linkB: finalData.triangulation?.contab_vs_darf.segurados ?? (Math.abs((finalData.retentionData?.valorRetido || 0) - finalData.segurados.guia) < 0.01), 
                        desc: 'RH vs Retenção Contábil' 
                    },
                    { 
                        label: 'Retenção vs Empenho', 
                        valA: finalData.retentionData?.valorRetido || 0, 
                        valB: finalData.empenhoData?.valor || 0, 
                        match: finalData.empenhoMatch, 
                        linkA: true, 
                        linkB: true, 
                        desc: 'Retenção vs Empenho' 
                    },
                    { 
                        label: 'Patronal (RH vs Liquidação)', 
                        valA: finalData.empresa.rh + finalData.acidente.rh, 
                        valB: (finalData.liquidacaoData?.valorBruto || 0) - (finalData.liquidacaoData?.salarioFamilia || 0) - (finalData.liquidacaoData?.salarioMaternidade || 0), 
                        match: finalData.liquidacaoBrutoMatch, 
                        linkA: finalData.liquidacaoBrutoMatch, 
                        linkB: finalData.triangulation?.contab_vs_darf.empresa ?? (Math.abs(((finalData.liquidacaoData?.valorBruto || 0) - (finalData.liquidacaoData?.salarioFamilia || 0) - (finalData.liquidacaoData?.salarioMaternidade || 0)) - (finalData.empresa.guia + finalData.acidente.guia)) < 0.01),
                        desc: 'RH vs Liquidação (Bruto/Líquido)' 
                    },
                    { 
                        label: 'RH vs Guia (Segurados)', 
                        valA: finalData.segurados.rh, 
                        valB: finalData.segurados.guia, 
                        match: finalData.segurados.status === 'MATCH', 
                        linkA: finalData.triangulation?.rh_vs_contab.segurados ?? (Math.abs(finalData.segurados.rh - (finalData.retentionData?.valorRetido || 0)) < 0.01), 
                        linkB: finalData.triangulation?.contab_vs_darf.segurados ?? (Math.abs((finalData.retentionData?.valorRetido || 0) - finalData.segurados.guia) < 0.01), 
                        desc: 'RH vs DARF 1082', 
                        labelB: 'GUIA' 
                    },
                    { 
                        label: 'RH vs Guia (Patronal)', 
                        valA: finalData.empresa.rh, 
                        valB: finalData.empresa.guia, 
                        match: finalData.empresa.status === 'MATCH', 
                        linkA: finalData.triangulation?.rh_vs_contab.empresa ?? (Math.abs((finalData.empresa.rh + finalData.acidente.rh) - ((finalData.liquidacaoData?.valorBruto || 0) - (finalData.liquidacaoData?.salarioFamilia || 0) - (finalData.liquidacaoData?.salarioMaternidade || 0))) < 0.01), 
                        linkB: finalData.triangulation?.contab_vs_darf.empresa ?? (Math.abs(((finalData.liquidacaoData?.valorBruto || 0) - (finalData.liquidacaoData?.salarioFamilia || 0) - (finalData.liquidacaoData?.salarioMaternidade || 0)) - (finalData.empresa.guia + finalData.acidente.guia)) < 0.01), 
                        desc: 'RH vs DARF 1138', 
                        labelB: 'GUIA' 
                    },
                    { 
                        label: 'RH vs Guia (Total)', 
                        valA: finalData.total.rh, 
                        valB: finalData.total.guia, 
                        match: finalData.total.status === 'MATCH', 
                        linkA: finalData.triangulation?.rh_vs_contab.total ?? (Math.abs(finalData.total.rh - finalData.totalContab) < 0.01), 
                        linkB: finalData.triangulation?.contab_vs_darf.total ?? (Math.abs(finalData.totalContab - finalData.total.guia) < 0.01), 
                        desc: 'Cruzamento Final', 
                        labelB: 'GUIA' 
                    },
                ].map((item: any, idx) => (
                    <ComparisonCard key={idx} item={item} />
                ))}

                <div className={`sm:col-span-2 lg:col-span-3 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-6 border transition-colors duration-200 ${finalData.finalStatus === 'CONCILIADO' ? 'bg-emerald-950/20 border-emerald-900/50' :
                    finalData.finalStatus === 'CONCILIADO_COM_RESSALVA' ? 'bg-amber-950/20 border-amber-900/50' :
                        'bg-red-950/20 border-red-900/50'}`}>
                    <div className="flex items-center">
                        <div className={`p-4 rounded-xl mr-5 ${finalData.finalStatus === 'CONCILIADO' ? 'bg-emerald-500/10 text-emerald-400' :
                            finalData.finalStatus === 'CONCILIADO_COM_RESSALVA' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-red-500/10 text-red-500'}`}>
                            {finalData.finalStatus === 'CONCILIADO' ? <CheckCircle className="h-7 w-7" /> :
                                finalData.finalStatus === 'CONCILIADO_COM_RESSALVA' ? <AlertCircle className="h-7 w-7" /> :
                                    <XCircle className="h-7 w-7" />}
                        </div>
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${finalData.finalStatus === 'CONCILIADO' ? 'text-emerald-400' :
                                finalData.finalStatus === 'CONCILIADO_COM_RESSALVA' ? 'text-cyan-400' :
                                    'text-red-400'}`}>Dossiê Consolidado</p>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase whitespace-nowrap">
                                {finalData.finalStatus.replace(/_/g, ' ')}
                            </h3>
                        </div>
                    </div>

                    <div className="flex gap-8">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total RH</p>
                            <p className="text-lg font-bold text-white font-mono">{finalData.total.rh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Contab.</p>
                            <p className="text-lg font-bold text-white font-mono">{finalData.totalContab.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Guia</p>
                            <p className="text-lg font-bold text-white font-mono">{finalData.total.guia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                </div>
            </div>

            <AnalyticalPanel finalData={finalData} />

            <div className="flex flex-col md:flex-row justify-center gap-6 mb-16">
                <button
                    onClick={onGenerateNotaTecnica}
                    disabled={isLoadingNotaTecnica}
                    className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 border border-indigo-500"
                >
                    {isLoadingNotaTecnica ? <><Loader2 className="h-5 w-5 mr-3 animate-spin" />Processando...</> : <><FileText className="h-5 w-5 mr-3" />Gerar Parecer IA</>}
                </button>
                {isHistoryView ? (
                    <button
                        onClick={onRectify}
                        className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                        <Edit2 className="h-5 w-5 mr-3" />Retificar Dossiê
                    </button>
                ) : (
                    <button
                        onClick={onReset}
                        className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                        Nova Auditoria
                    </button>
                )}
            </div>

            <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-white/5 text-indigo-400">
                        <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Anexos do Processo</h3>
                </div>

                {files && files.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {files.filter((f): f is File | string => !!f).map((file, idx) => (
                            <AttachmentItem key={idx} file={file} />
                        ))}
                    </div>
                ) : (
                    <div className="glass-card p-8 rounded-2xl border-dashed border-white/5 text-center">
                        <p className="text-slate-500 font-medium text-sm">Nenhum anexo disponível neste processo.</p>
                    </div>
                )}
            </div>

            <div className="glass-card p-8 rounded-xl animate-slide-up">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8">
                    <div className="flex items-center space-x-3">
                        <div className="bg-slate-800 p-2.5 rounded-xl border border-white/5 text-indigo-400">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Parecer Técnico</h3>
                    </div>
                    <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                        className="flex items-center justify-center px-6 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl hover:bg-emerald-600/30 transition-all disabled:opacity-50 text-sm"
                    >
                        {isSavingNote ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />SALVANDO...</> : <><Save className="h-4 w-4 mr-2" />SALVAR ALTERAÇÕES</>}
                    </button>
                </div>

                <div className="rounded-2xl overflow-hidden border border-white/5 bg-slate-900/50 p-1">
                    <RichTextEditor
                        value={editableNotaTecnica}
                        onChange={(val) => {
                            setEditableNotaTecnica(val);
                            onNotaChange(val);
                        }}
                    />
                </div>

                <div className="mt-10 flex justify-center">
                    <button
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf || !editableNotaTecnica}
                        className="w-full sm:w-auto flex items-center justify-center px-10 py-4 bg-slate-200 text-slate-900 font-semibold rounded-xl hover:bg-white transition-colors disabled:opacity-50 text-sm uppercase tracking-wider"
                    >
                        {isGeneratingPdf ? <><Loader2 className="h-5 w-5 mr-4 animate-spin" />Processando PDF...</> : <><Download className="h-5 w-5 mr-4" />Exportar Relatório Final</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Componente Analítico ---
const AnalyticalPanel: React.FC<{ finalData: ComparisonResult }> = ({ finalData }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!finalData.analyticalData) {
        return (
            <div className="mb-10 p-6 bg-slate-900/30 border border-slate-800/50 rounded-2xl border-dashed text-center">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">
                    Dados analíticos indisponíveis para este registro legado.
                </p>
                <p className="text-[10px] text-slate-600 mt-1">
                    Clique em "Retificar Dossiê" para processar os lançamentos individuais.
                </p>
            </div>
        );
    }

    const { rh, retention, empenho, liquidacao, guia } = finalData.analyticalData;

    return (
        <div className="mb-10 animate-slide-up">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800/50 transition-all group"
            >
                <div className="flex items-center space-x-4">
                    <div className="bg-indigo-500/10 p-3 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                        <History className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-white tracking-tight">Painel de Conferência Analítica</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Detalhamento individual de cada lançamento processado</p>
                    </div>
                </div>
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <PlusCircle className="h-6 w-6 text-slate-500" />
                </div>
            </button>

            {isOpen && (
                <div className="mt-4 grid grid-cols-1 gap-6">
                    {/* RH Analytical */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Detalhamento RH (Origem)</h4>
                            <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">{rh.length} Lançamentos</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Segurados</th>
                                        <th className="px-6 py-3">Patronal</th>
                                        <th className="px-6 py-3">RAT/FAP</th>
                                        <th className="px-6 py-3">Deduções</th>
                                        <th className="px-6 py-3 text-right">Líquido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {rh.map((item, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono">{item.valorSegurados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorEmpresa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorAcidente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono text-amber-500">-{item.deducaoFpas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono">{item.totalARecolher.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Contabilidade Analytical */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Detalhamento Contábil (Execução)</h4>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md">Ret: {retention.length}</span>
                                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md">Emp: {empenho.length}</span>
                                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md">Liq: {liquidacao.length}</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Tipo</th>
                                        <th className="px-6 py-3">Ref/Documento</th>
                                        <th className="px-6 py-3">Bruto/Original</th>
                                        <th className="px-6 py-3">Deduções</th>
                                        <th className="px-6 py-3 text-right">Impacto Guia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {retention.map((item, i) => (
                                        <tr key={`ret-${i}`} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-bold text-blue-400">RETENÇÃO</td>
                                            <td className="px-6 py-4 text-slate-400">{item.empresa || 'Retenção Direta'}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 text-slate-600">--</td>
                                            <td className="px-6 py-4 text-right font-bold text-white font-mono">{item.valorRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    {liquidacao.map((item, i) => (
                                        <tr key={`liq-${i}`} className="hover:bg-white/5 transition-colors border-t-2 border-slate-800/50">
                                            <td className="px-6 py-4 font-bold text-emerald-400">LIQUIDAÇÃO</td>
                                            <td className="px-6 py-4 text-slate-400">NE {item.numeroEmpenho}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 text-amber-500 font-mono">-{ (item.salarioFamilia + item.salarioMaternidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }</td>
                                            <td className="px-6 py-4 text-right font-bold text-white font-mono">{ (item.valorBruto - (item.salarioFamilia + item.salarioMaternidade)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Guia Analytical */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">DARF Previdenciário (Pagamento)</h4>
                            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md">{guia.length} Guias</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Código 1082</th>
                                        <th className="px-6 py-3">Código 1138</th>
                                        <th className="px-6 py-3">Código 1646</th>
                                        <th className="px-6 py-3">Indiv. (1099)</th>
                                        <th className="px-6 py-3 text-right">TOTAL PAGO</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {guia.map((item, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono">{item.valorSegurados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorEmpresa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono">{item.valorRiscoAmbiental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 font-mono">{ (item.valorContribIndividual || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }</td>
                                            <td className="px-6 py-4 text-right font-bold text-white font-mono">{item.totalGuia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparisonTable;