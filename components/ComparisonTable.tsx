import React, { useState, useEffect } from 'react';
import { ComparisonResult } from '../types';
import { CheckCircle, XCircle, FileText, Download, Loader2, Edit2, Save } from 'lucide-react';
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
    files: (File | null)[];
    onSaveNotaTecnica: (nota: string) => Promise<void>;
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
    onSaveNotaTecnica
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
            await generatePdf(editableNotaTecnica, files);
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

    const renderRow = (label: string, rhValue: number, guiaValue: number, diff: number, status: 'MATCH' | 'MISMATCH', titleA: string, titleB: string) => {
        const isError = status === 'MISMATCH';
        return (
            <tr className={`border-b border-white/5 ${isError ? 'bg-red-500/5' : ''} hover:bg-white/5 transition-colors group`}>
                <td className="py-5 px-6 font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</td>
                <td className="py-5 px-6 text-slate-400 font-mono text-sm" title={titleA}>
                    {rhValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-5 px-6 text-slate-400 font-mono text-sm" title={titleB}>
                    {guiaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className={`py-5 px-6 font-bold font-mono text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
                    {Math.abs(diff) < 0.01 ? <span className="opacity-20">-</span> : diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-5 px-6 text-center">
                    <div className="flex justify-center">
                        {isError ? (
                            <div className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
                                <XCircle className="h-5 w-5 text-red-400" />
                            </div>
                        ) : (
                            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                            </div>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="w-full max-w-6xl mx-auto animate-scale-in">
            <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-extrabold text-white tracking-tighter">Análise Diagnóstica</h2>
                    <p className="text-slate-400 font-medium mt-1">Comparativo técnico de integridade documental.</p>
                </div>
                <div className={`px-6 py-2 rounded-2xl border font-bold text-sm tracking-widest uppercase ${finalData.finalStatus === 'DIVERGENTE' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {finalData.finalStatus}
                </div>
            </div>

            <div className="glass-card rounded-[2rem] overflow-hidden mb-12 border-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="py-4 px-6 font-bold text-indigo-400 uppercase text-[10px] tracking-[0.2em]">Ponto de Auditoria</th>
                                <th className="py-4 px-6 font-bold text-indigo-400 uppercase text-[10px] tracking-[0.2em]">Origem RH</th>
                                <th className="py-4 px-6 font-bold text-indigo-400 uppercase text-[10px] tracking-[0.2em]">Origem EXTERNA</th>
                                <th className="py-4 px-6 font-bold text-indigo-400 uppercase text-[10px] tracking-[0.2em]">Diferença Apurada</th>
                                <th className="py-4 px-6 font-bold text-indigo-400 uppercase text-[10px] tracking-[0.2em] text-center">Conformidade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {finalData.retentionMatch !== undefined && renderRow('01. Segurados vs Retenção Contábil', finalData.segurados.rh, finalData.retentionData!.valorRetido, finalData.retentionDifference!, finalData.retentionMatch ? 'MATCH' : 'MISMATCH', 'Valor dos Segurados do Relatório RH', 'Valor do Relatório de Retenção')}
                            {finalData.empenhoMatch !== undefined && renderRow('02. Retenção vs Empenho Extra', finalData.retentionData!.valorRetido, finalData.empenhoData!.valor, finalData.empenhoDifference!, finalData.empenhoMatch ? 'MATCH' : 'MISMATCH', 'Valor do Relatório de Retenção', 'Valor do Empenho')}
                            {finalData.liquidacaoBrutoMatch !== undefined && renderRow('03. Patronal vs Liquidação Bruta', (finalData.empresa.rh + finalData.acidente.rh), finalData.liquidacaoData!.valorBruto, finalData.liquidacaoBrutoDifference!, finalData.liquidacaoBrutoMatch ? 'MATCH' : 'MISMATCH', 'Soma de Valor Empresa + Acidente do RH', 'Valor Bruto da Nota de Liquidação')}
                            {finalData.liquidacaoRetencaoMatch !== undefined && renderRow('04. Deduções vs Liquidação (Sal.Fam/Mat)', finalData.deducaoFpas, (finalData.liquidacaoData!.salarioFamilia + finalData.liquidacaoData!.salarioMaternidade), finalData.liquidacaoRetencaoDifference!, finalData.liquidacaoRetencaoMatch ? 'MATCH' : 'MISMATCH', 'Dedução FPAS do Relatório RH', 'Soma de Sal. Família + Maternidade da Liquidação')}

                            {renderRow('05. Conciliação Segurados (Guia 1082)', finalData.segurados.rh, finalData.segurados.guia, finalData.segurados.diff, finalData.segurados.status, 'Valor Segurados do Relatório RH', 'Valor Segurados da Guia DARF')}
                            {renderRow('06. Conciliação Patronal (Guia 1138)', finalData.empresa.rh, finalData.empresa.guia, finalData.empresa.diff, finalData.empresa.status, 'Valor Empresa do Relatório RH', 'Valor Empresa da Guia DARF')}
                            {renderRow('07. Conciliação RAT/RAT (Guia 1646)', finalData.acidente.rh, finalData.acidente.guia, finalData.acidente.diff, finalData.acidente.status, 'Valor Acidente/RAT do Relatório RH', 'Valor Risco Ambiental da Guia DARF')}

                            <tr className="bg-indigo-600/10 border-t border-white/10">
                                <td className="py-6 px-6 font-extrabold text-white text-lg">TOTAL CONSOLIDADO</td>
                                <td className="py-6 px-6 text-white font-mono font-bold">{finalData.total.rh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="py-6 px-6 text-white font-mono font-bold">{finalData.total.guia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className={`py-6 px-6 font-mono font-bold text-lg ${finalData.total.status === 'MISMATCH' ? 'text-red-400' : 'text-emerald-400'}`}>{Math.abs(finalData.total.diff) < 0.01 ? 'R$ 0,00' : finalData.total.diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="py-6 px-6 text-center">
                                    <div className="flex justify-center">
                                        {finalData.finalStatus === 'DIVERGENTE' ?
                                            <div className="flex items-center space-x-2 bg-red-500/20 text-red-400 px-4 py-1.5 rounded-xl border border-red-500/30 font-bold text-xs"><XCircle className="h-4 w-4" /><span>REVISÃO</span></div> :
                                            <div className="flex items-center space-x-2 bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-xl border border-emerald-500/30 font-bold text-xs"><CheckCircle className="h-4 w-4" /><span>APROVADO</span></div>
                                        }
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-6 mb-16">
                <button
                    onClick={onGenerateNotaTecnica}
                    disabled={isLoadingNotaTecnica}
                    className="flex-1 max-w-xs group relative overflow-hidden flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                    <span className="relative z-10 flex items-center">
                        {isLoadingNotaTecnica ? <><Loader2 className="h-5 w-5 mr-3 animate-spin" />AGUARDE...</> : <><FileText className="h-5 w-5 mr-3" />Gerar Parecer IA</>}
                    </span>
                </button>
                {isHistoryView ? (
                    <button
                        onClick={onRectify}
                        className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-slate-800 text-slate-200 font-bold rounded-2xl border border-white/10 hover:bg-slate-700 transition-all"
                    >
                        <Edit2 className="h-5 w-5 mr-3" />Retificar Dossiê
                    </button>
                ) : (
                    <button
                        onClick={onReset}
                        className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-slate-800 text-slate-200 font-bold rounded-2xl border border-white/10 hover:bg-slate-700 transition-all"
                    >
                        Nova Auditoria
                    </button>
                )}
            </div>

            <div className="glass-card p-10 rounded-[2.5rem] border-white/10 animate-slide-up">
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
                        onChange={setEditableNotaTecnica}
                    />
                </div>

                <div className="mt-10 flex justify-center">
                    <button
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf || !editableNotaTecnica}
                        className="w-full sm:w-auto flex items-center justify-center px-10 py-5 bg-slate-100 text-slate-900 font-black rounded-2xl shadow-2xl hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-50 text-base uppercase tracking-tighter"
                    >
                        {isGeneratingPdf ? <><Loader2 className="h-5 w-5 mr-4 animate-spin" />Processando PDF...</> : <><Download className="h-5 w-5 mr-4" />Exportar Relatório Final</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComparisonTable;