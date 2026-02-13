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
            <tr className={`border-b border-zinc-200 ${isError ? 'bg-red-50' : ''} hover:bg-zinc-50 transition-colors`}>
                <td className="py-4 px-6 font-medium text-zinc-700">{label}</td>
                <td className="py-4 px-6 text-zinc-600 font-mono" title={titleA}>
                    {rhValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-4 px-6 text-zinc-600 font-mono" title={titleB}>
                    {guiaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className={`py-4 px-6 font-bold font-mono ${isError ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.abs(diff) < 0.01 ? '-' : diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-4 px-6 text-center">
                    {isError ? <XCircle className="inline h-6 w-6 text-red-500" /> : <CheckCircle className="inline h-6 w-6 text-green-500" />}
                </td>
            </tr>
        );
    };
    
    return (
        <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-zinc-800 mb-2">Resultado da Conciliação</h2>
                <p className="text-zinc-600">Comparativo detalhado dos valores extraídos dos documentos.</p>
            </div>

            <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-zinc-200 mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50">
                            <tr className="border-b border-zinc-200">
                                <th className="py-3 px-6 font-semibold text-zinc-600 uppercase text-xs tracking-wider">Item de Conferência</th>
                                <th className="py-3 px-6 font-semibold text-zinc-600 uppercase text-xs tracking-wider">Fonte A (Valor)</th>
                                <th className="py-3 px-6 font-semibold text-zinc-600 uppercase text-xs tracking-wider">Fonte B (Valor)</th>
                                <th className="py-3 px-6 font-semibold text-zinc-600 uppercase text-xs tracking-wider">Diferença</th>
                                <th className="py-3 px-6 font-semibold text-zinc-600 uppercase text-xs tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {finalData.retentionMatch !== undefined && renderRow('1. Segurados (RH) vs Retenção (Contábil)', finalData.segurados.rh, finalData.retentionData!.valorRetido, finalData.retentionDifference!, finalData.retentionMatch ? 'MATCH' : 'MISMATCH', 'Valor dos Segurados do Relatório RH', 'Valor do Relatório de Retenção')}
                            {finalData.empenhoMatch !== undefined && renderRow('2. Retenção (Contábil) vs Empenho (Contábil)', finalData.retentionData!.valorRetido, finalData.empenhoData!.valor, finalData.empenhoDifference!, finalData.empenhoMatch ? 'MATCH' : 'MISMATCH', 'Valor do Relatório de Retenção', 'Valor do Empenho')}
                            {finalData.liquidacaoBrutoMatch !== undefined && renderRow('3. Patronal (RH) vs Liquidação Bruta (Contábil)', (finalData.empresa.rh + finalData.acidente.rh), finalData.liquidacaoData!.valorBruto, finalData.liquidacaoBrutoDifference!, finalData.liquidacaoBrutoMatch ? 'MATCH' : 'MISMATCH', 'Soma de Valor Empresa + Acidente do RH', 'Valor Bruto da Nota de Liquidação')}
                            {finalData.liquidacaoRetencaoMatch !== undefined && renderRow('4. Deduções (RH) vs Retenção (Liquidação)', finalData.deducaoFpas, (finalData.liquidacaoData!.salarioFamilia + finalData.liquidacaoData!.salarioMaternidade), finalData.liquidacaoRetencaoDifference!, finalData.liquidacaoRetencaoMatch ? 'MATCH' : 'MISMATCH', 'Dedução FPAS do Relatório RH', 'Soma de Sal. Família + Maternidade da Liquidação')}
                            
                            {renderRow('5. Segurados (RH vs Guia 1082)', finalData.segurados.rh, finalData.segurados.guia, finalData.segurados.diff, finalData.segurados.status, 'Valor Segurados do Relatório RH', 'Valor Segurados da Guia DARF')}
                            {renderRow('6. Empresa (RH vs Guia 1138)', finalData.empresa.rh, finalData.empresa.guia, finalData.empresa.diff, finalData.empresa.status, 'Valor Empresa do Relatório RH', 'Valor Empresa da Guia DARF')}
                            {renderRow('7. Acidente/RAT (RH vs Guia 1646)', finalData.acidente.rh, finalData.acidente.guia, finalData.acidente.diff, finalData.acidente.status, 'Valor Acidente/RAT do Relatório RH', 'Valor Risco Ambiental da Guia DARF')}

                            <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-300">
                                <td className="py-4 px-6 text-zinc-900">TOTAL GERAL (RH vs Guia)</td>
                                <td className="py-4 px-6 text-zinc-900" title="Valor Total a Recolher do Relatório RH">{finalData.total.rh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="py-4 px-6 text-zinc-900" title="Valor Total da Guia DARF">{finalData.total.guia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className={`py-4 px-6 ${finalData.total.status === 'MISMATCH' ? 'text-red-700' : 'text-green-700'}`}>{Math.abs(finalData.total.diff) < 0.01 ? '-' : finalData.total.diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="py-4 px-6 text-center">
                                    {finalData.finalStatus === 'DIVERGENTE' ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">DIVERGENTE</span>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">CONCILIADO</span>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-4">
                <button
                    onClick={onGenerateNotaTecnica}
                    disabled={isLoadingNotaTecnica}
                    className="flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoadingNotaTecnica ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gerando...</> : <><FileText className="h-5 w-5 mr-2" />Gerar Parecer Técnico</>}
                </button>
                {isHistoryView ? (
                    <button
                        onClick={onRectify}
                        className="flex items-center justify-center px-8 py-3 bg-orange-500 text-white font-bold rounded-lg shadow-lg hover:bg-orange-600 hover:shadow-xl transition-all"
                    >
                        <Edit2 className="h-5 w-5 mr-2" />Retificar
                    </button>
                ) : (
                    <button
                        onClick={onReset}
                        className="flex items-center justify-center px-8 py-3 bg-white text-zinc-600 border border-zinc-300 font-semibold rounded-lg hover:bg-zinc-50 transition-all"
                    >
                        Nova Conciliação
                    </button>
                )}
            </div>

            <div className="mt-8 bg-white p-8 rounded-xl border border-zinc-200 shadow-lg animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                    <h3 className="text-xl font-bold text-zinc-800 flex items-center mb-2 sm:mb-0"><FileText className="h-6 w-6 mr-2 text-zinc-500" />Parecer Técnico (Editável)</h3>
                    <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                        className="flex items-center justify-center px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {isSavingNote ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Parecer</>}
                    </button>
                </div>
                <RichTextEditor
                    value={editableNotaTecnica}
                    onChange={setEditableNotaTecnica}
                />
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf || !editableNotaTecnica}
                        className="flex items-center justify-center px-6 py-3 bg-zinc-700 text-white font-bold rounded-lg shadow-md hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                        {isGeneratingPdf ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gerando PDF...</> : <><Download className="h-5 w-5 mr-2" />Download PDF com Anexos</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComparisonTable;