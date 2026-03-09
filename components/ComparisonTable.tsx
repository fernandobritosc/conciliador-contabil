import React, { useState, useEffect } from 'react';
import { ComparisonResult } from '../types';
import { CheckCircle, XCircle, FileText, Download, Loader2, Edit2, Save, Check, AlertCircle } from 'lucide-react';
import { generatePdf } from '../services/pdfService';
import RichTextEditor from './RichTextEditor';

interface ComparisonTableProps {
    finalData: ComparisonResult;
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
    const [editableNotaTecnica, setEditableNotaTecnica] = useState<string>('<p>Clique em "Gerar Parecer Técnico" para que a análise seja preenchida ou insira seu texto diretamente aqui...</p>');

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

    if (!finalData) {
        return (
            <div className="w-full flex justify-center items-center py-20">
                <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400">Processando dados da conciliação...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto animate-scale-in">
            <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-extrabold text-white tracking-tighter">Resumo Executivo</h2>
                    <p className="text-slate-400 font-medium mt-1">Checklist de conformidade da auditoria previdenciária.</p>
                </div>
                <div className={`px-6 py-2 rounded-2xl border font-bold text-sm tracking-widest uppercase ${finalData?.finalStatus === 'DIVERGENTE' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {finalData?.finalStatus || 'PROCESSANDO'}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {[
                    { label: 'Segurados vs Retenção', valA: finalData.segurados.rh, valB: finalData.retentionData?.valorRetido || 0, match: finalData.retentionMatch, linkA: finalData.retentionMatch, linkB: finalData.internalMatches?.seguradosMatch, desc: 'RH vs Retenção Contábil' },
                    { label: 'Retenção vs Empenho', valA: finalData.retentionData?.valorRetido || 0, valB: finalData.empenhoData?.valor || 0, match: finalData.empenhoMatch, linkA: true, linkB: true, desc: 'Retenção vs Empenho' },
                    { label: 'Patronal (RH vs Liquidação)', valA: finalData.empresa.rh + finalData.acidente.rh, valB: (finalData.liquidacaoData?.valorBruto || 0) - (finalData.liquidacaoData?.salarioFamilia || 0) - (finalData.liquidacaoData?.salarioMaternidade || 0), match: finalData.liquidacaoBrutoMatch, linkA: finalData.liquidacaoBrutoMatch, linkB: finalData.internalMatches?.empresaMatch, desc: 'RH vs Liquidação Líquida' },
                    { label: 'RH vs Guia (Segurados)', valA: finalData.segurados.rh, valB: finalData.segurados.guia, match: finalData.segurados.status === 'MATCH', linkA: finalData.retentionMatch, linkB: finalData.internalMatches?.seguradosMatch, desc: 'RH vs DARF 1082', labelB: 'GUIA' },
                    { label: 'RH vs Guia (Patronal)', valA: finalData.empresa.rh, valB: finalData.empresa.guia, match: finalData.empresa.status === 'MATCH', linkA: finalData.liquidacaoBrutoMatch, linkB: finalData.internalMatches?.empresaMatch, desc: 'RH vs DARF 1138', labelB: 'GUIA' },
                    { label: 'RH vs Guia (Total)', valA: finalData.total.rh, valB: finalData.total.guia, match: finalData.total.status === 'MATCH', linkA: finalData.retentionMatch && finalData.liquidacaoBrutoMatch, linkB: finalData.internalMatches?.totalMatch, desc: 'Cruzamento Final', labelB: 'GUIA' },
                ].map((item: any, idx) => {
                    const isRessalva = !item.match && item.linkB;
                    return (
                        <div key={idx} className={`p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${item.match ? 'bg-[#0F172A] border-slate-800' : isRessalva ? 'bg-amber-950/20 border-amber-900/50' : 'bg-red-950/20 border-red-900/50'}`}>
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
                })}

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
                        {files.filter((f): f is File | string => !!f).map((file, idx) => {
                            const isUrl = typeof file === 'string';
                            const name = isUrl ? decodeURIComponent(file.split('/').pop()?.split('?')[0] || 'Anexo') : (file as File).name;
                            const type = isUrl ? 'Documento Salvo' : (file as File).type;

                            return (
                                <div key={idx} className="glass-card p-4 rounded-xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
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
                            )
                        })}
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

export default ComparisonTable;