import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, Edit2, Save, X, AlertCircle, Trash2, PlusCircle, Paperclip, ScanLine, ArrowLeft } from 'lucide-react';

interface ManualEntry {
    id: number;
    formValues: Record<string, string>;
    file: File | null;
    source: 'RH' | 'Contabilidade';
    reportType: string;
}

interface StepUploadProps {
    title: string;
    description: string;
    manualTitle: string;
    type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao';
    allowMultiple: boolean;
    data: any | null;
    files: File[];
    isLoading: boolean;
    error: string | null;
    onFileUpload: (files: FileList) => void;
    onConfirm: (aggregatedData: any, files: File[]) => void;
    onClear: () => void;
    blankDataFactory: () => any;
    expectedValue?: {
        label: string;
        value: number;
        keyToMatch?: string;
    };
    section?: string;
    availableReportTypes?: { key: string; label: string }[];
}

const getFieldsForType = (type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao') => {
    switch (type) {
        case 'Relatorio': return [
            { key: 'valorSegurados', label: 'Valor Segurados', type: 'number' },
            { key: 'valorEmpresa', label: 'Valor Empresa', type: 'number' },
            { key: 'valorAcidente', label: 'Valor Acidente (RAT)', type: 'number' },
            { key: 'deducaoFpas', label: 'Dedução FPAS', type: 'number' },
            { key: 'totalARecolher', label: 'Total a Recolher', type: 'number', isCalculated: true },
        ];
        case 'Guia': return [
            { key: 'valorSegurados', label: 'Cód 1082 (Segurados)', type: 'number' },
            { key: 'valorEmpresa', label: 'Cód 1138 (Empresa)', type: 'number' },
            { key: 'valorRiscoAmbiental', label: 'Cód 1646 (RAT)', type: 'number' },
            { key: 'totalGuia', label: 'Total da Guia', type: 'number', isCalculated: true },
        ];
        case 'Retention': return [{ key: 'valorRetido', label: 'Valor Retido (INSS)', type: 'number', isTotal: true }, { key: 'competencia', label: 'Competência', type: 'text' }, { key: 'empresa', label: 'Empresa', type: 'text' },];
        case 'Empenho': return [{ key: 'valor', label: 'Valor do Empenho', type: 'number', isTotal: true }, { key: 'numeroEmpenho', label: 'Número do Empenho', type: 'text' },];
        case 'Liquidacao': return [{ key: 'valorBruto', label: 'Valor Bruto', type: 'number', isTotal: true }, { key: 'numeroEmpenho', label: 'Nº de Empenho', type: 'text' }, { key: 'salarioFamilia', label: 'Salário Família', type: 'number' }, { key: 'salarioMaternidade', label: 'Salário Maternidade', type: 'number' },];
        default: return [];
    }
};

const StepUpload: React.FC<StepUploadProps> = ({ title, description, manualTitle, type, allowMultiple, data, files, isLoading, error, onFileUpload, onConfirm, onClear, blankDataFactory, expectedValue, section, availableReportTypes }) => {
    const [editableData, setEditableData] = useState<any>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [mode, setMode] = useState<'choice' | 'ia' | 'manual'>('choice');
    const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
    const [iaSource, setIaSource] = useState<'RH' | 'Contabilidade'>(section?.includes('RH') ? 'RH' : 'Contabilidade');
    const [iaReportType, setIaReportType] = useState<string>(type);

    const fields = getFieldsForType(type);

    const formatValue = (val: any, fieldType: string) => {
        if (fieldType === 'number') {
            return (val as number)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00';
        }
        return (val as string) ?? '';
    };

    const dataToFormValues = (dataObj: any) => {
        const values: Record<string, string> = {};
        fields.forEach(field => {
            values[field.key] = formatValue(dataObj?.[field.key], field.type);
        });
        return values;
    };

    useEffect(() => {
        if (Array.isArray(data)) {
            const entries: ManualEntry[] = data.map((item, idx) => ({
                id: Date.now() + idx,
                formValues: dataToFormValues(item),
                file: files[idx] || null,
                source: iaSource,
                reportType: iaReportType
            }));
            setManualEntries(entries);
            setMode('manual');
            setIsEditing(false);
        } else if (data) {
            setEditableData(data);
            setFormValues(dataToFormValues(data));
            setMode('ia');
            setIsEditing(false);
            if (error) setIsEditing(true);
        } else {
            setMode('choice');
            setManualEntries([]);
        }
    }, [data, error, files]);

    const parse = (val: string) => parseFloat(String(val || '0').replace(/\./g, '').replace(',', '.')) || 0;

    const handleAutoSum = (currentFormValues: Record<string, string>): Record<string, string> => {
        const updated = { ...currentFormValues };
        const format = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (type === 'Relatorio') updated.totalARecolher = format(parse(updated.valorSegurados) + parse(updated.valorEmpresa) + parse(updated.valorAcidente) - parse(updated.deducaoFpas));
        if (type === 'Guia') updated.totalGuia = format(parse(updated.valorSegurados) + parse(updated.valorEmpresa) + parse(updated.valorRiscoAmbiental));
        return updated;
    };

    const handleInputChange = (id: number, key: string, value: string) => {
        setManualEntries(prev => prev.map(entry => entry.id === id ? { ...entry, formValues: handleAutoSum({ ...entry.formValues, [key]: value }) } : entry));
    };

    const handleFileChange = (id: number, file: File | null) => {
        setManualEntries(prev => prev.map(entry => entry.id === id ? { ...entry, file } : entry));
    };

    const addEntry = () => {
        const newEntry: ManualEntry = {
            id: Date.now(),
            formValues: dataToFormValues(blankDataFactory()),
            file: null,
            source: section?.includes('RH') ? 'RH' : 'Contabilidade',
            reportType: type
        };
        setManualEntries(prev => [...prev, newEntry]);
    };

    const removeEntry = (id: number) => setManualEntries(prev => prev.filter(entry => entry.id !== id));

    const handleConfirm = () => {
        if (mode === 'manual') {
            const aggregatedData = blankDataFactory();
            const allFiles: File[] = [];

            manualEntries.forEach(entry => {
                fields.forEach(field => {
                    if (field.type === 'number') {
                        aggregatedData[field.key] = (aggregatedData[field.key] || 0) + parse(entry.formValues[field.key]);
                    } else {
                        if (!aggregatedData[field.key]) aggregatedData[field.key] = entry.formValues[field.key];
                    }
                });
                if (entry.file) allFiles.push(entry.file);
            });
            onConfirm(aggregatedData, allFiles);
        } else {
            const finalData = blankDataFactory();
            fields.forEach(field => {
                const value = isEditing ? formValues[field.key] : (editableData ? editableData[field.key] : null);
                if (field.type === 'number') finalData[field.key] = typeof value === 'string' ? parse(value) : value;
                else finalData[field.key] = value;
            });
            onConfirm(finalData, files);
        }
    };

    const handleManualMode = () => {
        addEntry();
        setMode('manual');
    };

    const handleIAMode = () => setMode('ia');

    const manualTotals = React.useMemo(() => {
        const totals: Record<string, number> = {};
        const totalizableFields = fields.filter(f => f.type === 'number');

        totalizableFields.forEach(field => {
            totals[field.key] = manualEntries.reduce((acc, entry) => acc + parse(entry.formValues[field.key]), 0);
        });
        return totals;
    }, [manualEntries, fields]);

    const isConformant = React.useMemo(() => {
        if (!expectedValue) return null;

        let currentVal = 0;
        if (mode === 'manual') {
            currentVal = manualTotals[expectedValue.keyToMatch || 'valor'] || 0;
        } else if (data || editableData) {
            const dataSource = isEditing ? formValues : dataToFormValues(editableData);
            currentVal = parse(dataSource[expectedValue.keyToMatch || 'valor'] || '0');
        } else {
            return null;
        }

        return Math.abs(currentVal - expectedValue.value) < 0.05;
    }, [expectedValue, mode, manualTotals, data, editableData, isEditing, formValues]);

    if (mode === 'choice' && !isLoading) return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase sm:text-4xl">{title}</h2>
                <div className="h-1 w-20 bg-indigo-500 mx-auto mt-4 rounded-full" />
                <p className="text-slate-400 mt-6 font-medium max-w-lg mx-auto">{description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                <button
                    onClick={handleIAMode}
                    className="group relative glass-card p-10 rounded-3xl border-white/5 hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-500 overflow-hidden text-left"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                        <ScanLine className="h-24 w-24 text-indigo-400" />
                    </div>
                    <div className="bg-indigo-600/20 p-4 rounded-2xl w-fit mb-6 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <ScanLine className="h-10 w-10 text-indigo-400" />
                    </div>
                    <h3 className="font-black text-xl text-white mb-3">Extração por Inteligência Artificial</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-8">Processamento neural e OCR avançado. Basta enviar o PDF para conferência automática.</p>
                    <div className="flex items-center text-xs font-bold text-indigo-400 uppercase tracking-widest">
                        Ativar Scanner <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </div>
                </button>

                <button
                    onClick={handleManualMode}
                    className="group relative glass-card p-10 rounded-3xl border-white/5 hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all duration-500 overflow-hidden text-left"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                        <Edit2 className="h-24 w-24 text-emerald-400" />
                    </div>
                    <div className="bg-emerald-600/20 p-4 rounded-2xl w-fit mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                        <Edit2 className="h-10 w-10 text-emerald-400" />
                    </div>
                    <h3 className="font-black text-xl text-white mb-3">Inclusão de Dados Manual</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-8">Controle total sobre o lançamento. Ideal para correções pontuais ou guias avulsas.</p>
                    <div className="flex items-center text-xs font-bold text-emerald-400 uppercase tracking-widest">
                        Lançamento Direto <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </div>
                </button>
            </div>
        </div>
    );

    if (mode === 'ia' && !data && !isLoading) return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">{title}</h2>
                <p className="text-slate-400 font-medium">{description}</p>
            </div>

            <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); onFileUpload(e.dataTransfer.files); }}
                className="w-full group relative glass-card rounded-[3rem] p-4 cursor-pointer hover:border-indigo-500/30 transition-all duration-700"
            >
                <div className="border-2 border-dashed border-white/5 rounded-[2.5rem] p-16 flex flex-col items-center group-hover:bg-indigo-500/[0.03] transition-colors">
                    <div className="relative mb-10">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 group-hover:scale-[2] transition-transform duration-700" />
                        <div className="relative bg-gradient-to-br from-indigo-500 to-cyan-400 p-6 rounded-3xl shadow-2xl group-hover:rotate-6 transition-transform">
                            <Upload className="h-10 w-10 text-white" />
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-indigo-300 transition-colors">Arraste seu documento aqui</h3>
                    <p className="text-slate-400 font-medium mb-10">Suporta PDF e imagens de alta resolução.</p>

                    <label className="relative overflow-hidden px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer group-active:scale-95">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 hover:opacity-100 transition-opacity" />
                        <span className="relative z-10 flex items-center tracking-tighter text-lg uppercase">
                            Procurar Arquivo <Paperclip className="h-5 w-5 ml-2" />
                        </span>
                        <input type="file" className="hidden" accept=".pdf,image/*" multiple={false} onChange={(e) => e.target.files && onFileUpload(e.target.files)} />
                    </label>
                </div>
            </div>
        </div>
    );

    if (isLoading) return <div className="flex flex-col items-center justify-center p-12"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div><p className="text-lg font-medium text-zinc-700 animate-pulse">Analisando documento...</p><p className="text-sm text-zinc-500 mt-2">Isso pode levar alguns segundos...</p></div>;

    if (error && mode === 'ia' && !data) return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">{title}</h2>
                <p className="text-slate-400 font-medium">{description}</p>
            </div>

            <div className="w-full glass-card rounded-3xl p-8 border-red-500/30 bg-red-500/10">
                <div className="flex items-start gap-4 mb-6">
                    <div className="bg-red-500/20 p-3 rounded-xl border border-red-500/30">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-xl text-red-400 mb-2">Erro na Extração Automática</h3>
                        <div className="text-sm text-slate-300 space-y-2 leading-relaxed">
                            {error.split('\n').map((line, i) => (
                                <p key={i} className="font-medium">{line}</p>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-white/10">
                    <button
                        onClick={onClear}
                        className="flex-1 px-6 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-wider text-sm"
                    >
                        Tentar Novamente
                    </button>
                    <button
                        onClick={handleManualMode}
                        className="flex-1 px-6 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-wider text-sm"
                    >
                        Lançamento Manual
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="glass-card rounded-[2.5rem] overflow-hidden border-white/10 shadow-2xl">
                <div className="bg-white/5 p-6 border-b border-white/10 flex justify-between items-center sm:px-10">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/20">
                            <FileText className="h-5 w-5 text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-lg text-white tracking-tight">
                            {mode === 'manual' ? manualTitle : `Diagnóstico Extraído`}
                        </h3>
                    </div>
                    <div className="flex items-center gap-4">
                        {section && (
                            <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">{section}</span>
                            </div>
                        )}
                        <button onClick={onClear} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors flex items-center">
                            <Trash2 className="h-3 w-3 mr-2" /> Limpar Etapa
                        </button>
                    </div>
                </div>

                {expectedValue && (
                    <div className="px-10 py-4 bg-indigo-500/5 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center">
                            <div className="bg-indigo-500/20 p-2 rounded-lg mr-3 border border-indigo-500/20">
                                <ScanLine className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Valor Alvo (RH)</p>
                                <p className="text-sm font-bold text-white tracking-tight">
                                    {expectedValue.label}: <span className="text-white ml-1 font-mono">{expectedValue.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </p>
                            </div>
                        </div>

                        {isConformant !== null && (
                            <div className={`px-4 py-2 rounded-xl flex items-center space-x-2 border transition-all duration-500 ${isConformant
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]'}`}
                            >
                                {isConformant ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isConformant ? 'Conferência OK' : 'Divergência Detectada'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="p-8 sm:p-12">
                    {mode === 'ia' && data && (
                        <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); onFileUpload(e.dataTransfer.files); }}
                            className="relative group animate-fade-in"
                        >
                            <div className="flex flex-col mb-10">
                                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-4">
                                    Dados da Seção: {section}
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Origem da Informação</label>
                                        <select
                                            value={iaSource}
                                            onChange={(e) => setIaSource(e.target.value as 'RH' | 'Contabilidade')}
                                            className="w-full bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                                        >
                                            <option value="RH" className="bg-slate-900">RH</option>
                                            <option value="Contabilidade" className="bg-slate-900">Contabilidade</option>
                                        </select>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02]">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Relatório</label>
                                        <select
                                            value={iaReportType}
                                            onChange={(e) => setIaReportType(e.target.value)}
                                            className="w-full bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                                        >
                                            {(availableReportTypes || [{ key: type, label: manualTitle }]).map(rt => (
                                                <option key={rt.key} value={rt.key} className="bg-slate-900">{rt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition-all cursor-pointer">
                                        <Upload className="h-3 w-3 mr-2" /> Substituir Fonte
                                        <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files && onFileUpload(e.target.files)} />
                                    </label>

                                    {!isEditing ? (
                                        <button onClick={() => setIsEditing(true)} className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-4 py-2 rounded-xl bg-white/5 border border-white/10 transition-all">
                                            <Edit2 className="h-3 w-3 mr-2" />Editar
                                        </button>
                                    ) : (
                                        <button onClick={() => setIsEditing(false)} className="flex items-center text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 transition-all">
                                            <Save className="h-3 w-3 mr-2" />Salvar
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!isEditing && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
                                    {fields.map(f => (
                                        <div key={f.key} className="glass-card p-5 rounded-2xl border-white/5 flex flex-col justify-between group-hover:border-indigo-500/20 transition-all">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 opacity-60">{f.label}</label>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-white flex items-baseline justify-end">
                                                        {f.type === 'number' && <span className="text-xs font-normal text-slate-500 mr-2">R$</span>}
                                                        {formatValue(editableData?.[f.key], f.type)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isEditing && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                                    {fields.map(f => (
                                        <div key={f.key} className="glass-card p-6 rounded-2xl border-indigo-500/30 bg-indigo-500/[0.02]">
                                            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">{f.label}</label>
                                            <div className="relative">
                                                {f.type === 'number' && <span className="absolute left-3 top-3 text-slate-500 text-sm">R$</span>}
                                                <input
                                                    type="text"
                                                    readOnly={f.isCalculated}
                                                    value={formValues[f.key] || ''}
                                                    onChange={(e) => setFormValues(handleAutoSum({ ...formValues, [f.key]: e.target.value }))}
                                                    className={`w-full py-2 bg-transparent border-b-2 border-white/10 focus:border-indigo-500 focus:outline-none text-white text-xl font-bold transition-colors ${f.type === 'number' ? 'pl-8' : ''} ${f.isCalculated ? 'text-slate-500' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'manual' && (
                        <div className="space-y-8">
                            {manualEntries.map((entry, index) => (
                                <div key={entry.id} className="glass-card p-8 rounded-3xl border-white/5 relative bg-white/[0.01]">
                                    <div className="flex justify-between items-center mb-8">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-6 w-1 bg-emerald-500 rounded-full" />
                                            <h4 className="font-black text-white uppercase tracking-tighter">Lançamento #{index + 1}</h4>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                                <select
                                                    value={entry.source}
                                                    onChange={(e) => {
                                                        const newEntries = [...manualEntries];
                                                        newEntries[index].source = e.target.value as 'RH' | 'Contabilidade';
                                                        setManualEntries(newEntries);
                                                    }}
                                                    className="bg-transparent text-emerald-400 font-black text-sm uppercase tracking-widest focus:outline-none cursor-pointer"
                                                >
                                                    <option value="RH" className="bg-slate-900">RH</option>
                                                    <option value="Contabilidade" className="bg-slate-900">Contabilidade</option>
                                                </select>
                                            </div>
                                            {manualEntries.length > 1 && (
                                                <button onClick={() => removeEntry(entry.id)} className="text-red-400 hover:text-red-300 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {fields.map(f => (
                                            <div key={f.key}>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{f.label}</label>
                                                <div className="relative">
                                                    {f.type === 'number' && <span className="absolute left-0 top-2 text-slate-600 font-bold">R$</span>}
                                                    <input
                                                        type="text"
                                                        readOnly={f.isCalculated}
                                                        value={entry.formValues[f.key] || ''}
                                                        onChange={(e) => handleInputChange(entry.id, f.key, e.target.value)}
                                                        className={`w-full py-2 bg-transparent border-b border-white/10 focus:border-emerald-500 focus:outline-none text-white font-bold transition-all ${f.type === 'number' ? 'pl-8' : ''} ${f.isCalculated ? 'opacity-40' : ''}`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-white/5">
                                        <label className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 cursor-pointer group w-fit">
                                            <div className="bg-indigo-500/10 p-2 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                                                <Paperclip className="h-4 w-4" />
                                            </div>
                                            <span>{entry.file ? entry.file.name : "Anexar Comprovante"}</span>
                                            <input type="file" className="hidden" onChange={e => handleFileChange(entry.id, e.target.files ? e.target.files[0] : null)} />
                                        </label>
                                    </div>
                                </div>
                            ))}

                            {allowMultiple && (
                                <div className="flex justify-center mt-6">
                                    <button onClick={addEntry} className="flex items-center space-x-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/5 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/10 transition-all">
                                        <PlusCircle className="h-4 w-4" /> <span>Novo Lançamento</span>
                                    </button>
                                </div>
                            )}

                            {manualEntries.length > 0 && (
                                <div className="mt-12 p-8 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10">
                                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-6">Consolidado da Etapa</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {fields.filter(f => f.type === 'number').map(f => (
                                            <div key={f.key} className="flex justify-between items-center p-3 border-b border-white/5">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{f.label}</span>
                                                <span className="font-black text-white font-mono">{Number(manualTotals[f.key]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-16 flex justify-center">
                        <button
                            onClick={handleConfirm}
                            disabled={(mode === 'manual' && manualEntries.length === 0) || (mode === 'ia' && !data)}
                            className="group relative overflow-hidden flex items-center justify-center px-12 py-5 bg-emerald-600 text-white font-black rounded-[1.5rem] shadow-2xl hover:shadow-emerald-500/20 transition-all text-lg w-full md:w-auto disabled:opacity-20 uppercase tracking-tighter"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative z-10 flex items-center">
                                <Check className="h-6 w-6 mr-3" /> Confirmar Auditoria
                            </span>
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default StepUpload;