import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, Edit2, Save, X, AlertCircle, Trash2, PlusCircle, Paperclip, ScanLine } from 'lucide-react';

interface ManualEntry {
    id: number;
    formValues: Record<string, string>;
    file: File | null;
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
        case 'Retention': return [ { key: 'valorRetido', label: 'Valor Retido (INSS)', type: 'number', isTotal: true }, { key: 'competencia', label: 'Competência', type: 'text' }, { key: 'empresa', label: 'Empresa', type: 'text' }, ];
        case 'Empenho': return [ { key: 'valor', label: 'Valor do Empenho', type: 'number', isTotal: true }, { key: 'numeroEmpenho', label: 'Número do Empenho', type: 'text' }, ];
        case 'Liquidacao': return [ { key: 'valorBruto', label: 'Valor Bruto', type: 'number', isTotal: true }, { key: 'numeroEmpenho', label: 'Nº de Empenho', type: 'text' }, { key: 'salarioFamilia', label: 'Salário Família', type: 'number' }, { key: 'salarioMaternidade', label: 'Salário Maternidade', type: 'number' }, ];
        default: return [];
    }
};

const StepUpload: React.FC<StepUploadProps> = ({ title, description, manualTitle, type, allowMultiple, data, files, isLoading, error, onFileUpload, onConfirm, onClear, blankDataFactory }) => {
    const [editableData, setEditableData] = useState<any>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [mode, setMode] = useState<'choice' | 'ia' | 'manual'>('choice');
    const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
    
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
        if (data) {
            setEditableData(data);
            setFormValues(dataToFormValues(data));
            setMode('ia'); // Default to IA/summary view when data is present
            setIsEditing(false); // Default to non-editing mode
            if (error) setIsEditing(true);
        } else {
            setMode('choice');
            setManualEntries([]);
        }
    }, [data, error]);
    
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
        const newEntry: ManualEntry = { id: Date.now(), formValues: dataToFormValues(blankDataFactory()), file: null };
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
                const value = isEditing ? formValues[field.key] : editableData[field.key];
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

    if (mode === 'choice' && !isLoading) return (
        <div className="w-full max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-zinc-800">{title}</h2>
            <p className="text-zinc-600 mt-2">{description}</p>
            <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-lg flex flex-col md:flex-row gap-6 mt-6">
                <div className="flex-1 flex flex-col items-center p-6 bg-zinc-50 rounded-lg border border-zinc-200">
                    <ScanLine className="h-10 w-10 text-indigo-600 mb-4" />
                    <h3 className="font-bold text-lg text-zinc-800 mb-2">Extrair de Documento</h3>
                    <p className="text-sm text-zinc-500 mb-6 text-center">Envie um PDF ou imagem para extração automática.</p>
                    <button onClick={handleIAMode} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition w-full">Usar Extração</button>
                </div>
                <div className="flex-1 flex flex-col items-center p-6 bg-zinc-50 rounded-lg border border-zinc-200">
                    <Edit2 className="h-10 w-10 text-green-600 mb-4" />
                    <h3 className="font-bold text-lg text-zinc-800 mb-2">Inserir Manualmente</h3>
                    <p className="text-sm text-zinc-500 mb-6 text-center">Insira os valores diretamente nos campos do formulário.</p>
                    <button onClick={handleManualMode} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition w-full">Modo Manual</button>
                </div>
            </div>
        </div>
    );
    
    if (mode === 'ia' && !data && !isLoading) return (
        <div className="w-full max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-zinc-800 text-center">{title}</h2>
            <p className="text-zinc-600 text-center mt-2 mb-6">{description}</p>
            <div onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); onFileUpload(e.dataTransfer.files);}} className="border-2 border-dashed border-zinc-300 rounded-xl p-12 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer bg-white">
                <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-indigo-600 bg-indigo-100 p-4 rounded-full box-content mb-4" />
                    <p className="text-lg font-medium text-zinc-700 mb-2">Arraste e solte o arquivo aqui</p>
                    <p className="text-sm text-zinc-500 mb-6">ou clique para selecionar</p>
                    <label className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 cursor-pointer transition">
                        Selecionar Arquivo
                        <input type="file" className="hidden" accept=".pdf,image/*" multiple={false} onChange={(e) => e.target.files && onFileUpload(e.target.files)} />
                    </label>
                </div>
            </div>
        </div>
    );
    
    if (isLoading) return <div className="flex flex-col items-center justify-center p-12"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div><p className="text-lg font-medium text-zinc-700 animate-pulse">Analisando documento...</p><p className="text-sm text-zinc-500 mt-2">Isso pode levar alguns segundos...</p></div>;

    if (error && mode === 'ia' && !data) return (
        <div className="w-full max-w-2xl mx-auto">
           <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1"><p className="font-semibold">Ocorreu um erro</p><div className="text-sm mt-2 space-y-1">{error.split('\n').map((line, i) => (<p key={i}>{line}</p>))}</div></div>
                </div>
            </div>
            <div className="mt-4 flex justify-center"><button onClick={onClear} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">Tentar Novamente</button></div>
       </div>
    );

    return (
      <div className="w-full max-w-3xl mx-auto">
        {error && !data && <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg"><div className="flex items-start"><AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" /><div className="flex-1"><p className="font-semibold">Atenção</p><div className="text-sm mt-2 space-y-1">{error.split('\n').map((l, i) => (<p key={i}>{l}</p>))}</div></div></div></div>}
        <div className="bg-white rounded-xl shadow-lg border border-zinc-200">
            <div className="bg-zinc-50 p-4 border-b border-zinc-200 flex justify-between items-center"><h3 className="font-semibold text-lg text-zinc-800 flex items-center"><FileText className="h-5 w-5 mr-2 text-indigo-600" />{mode === 'manual' ? manualTitle : `Dados Extraídos - ${type}`}</h3><button onClick={onClear} className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center"><Trash2 className="h-4 w-4 mr-1" />Limpar</button></div>
            
            {mode === 'ia' && files.length > 0 && (
                <div className="p-3 text-sm text-zinc-600 bg-zinc-100 border-b border-zinc-200">
                    <strong>Arquivos Anexados:</strong>
                    <ul className="list-disc list-inside ml-2 mt-1">
                        {files.map((file, index) => (
                            <li key={index} className="truncate" title={file.name}>{file.name}</li>
                        ))}
                    </ul>
                </div>
            )}
            
            <div className="p-6">
                {mode === 'ia' && data && (
                    <div className="flex justify-end items-center gap-2 mb-4">
                        <button 
                            onClick={() => { if (window.confirm("Isso limpará os dados desta etapa e permitirá um novo envio. Deseja continuar?")) { onClear(); } }}
                            className="flex items-center text-sm font-medium text-zinc-600 hover:text-red-600 px-3 py-1 rounded-md hover:bg-red-50 transition"
                            title={allowMultiple ? "Limpar todos os lançamentos e começar de novo" : "Substituir o arquivo atual"}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {allowMultiple ? "Refazer Lançamentos" : "Trocar Arquivo"}
                        </button>

                        {!allowMultiple && (
                            !isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-md hover:bg-indigo-50 transition">
                                    <Edit2 className="h-4 w-4 mr-1" />Editar Valores
                                </button>
                            ) : (
                                <button onClick={() => setIsEditing(false)} className="flex items-center text-sm font-medium text-green-600 hover:text-green-800 px-3 py-1 rounded-md hover:bg-green-50 transition">
                                    <Save className="h-4 w-4 mr-1" />Salvar Valores
                                </button>
                            )
                        )}
                    </div>
                )}
                
                {mode === 'ia' && !isEditing && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields.map(f => <div key={f.key} className="bg-zinc-50 p-4 rounded-lg border"><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{f.label}</label><div className="text-xl font-bold text-zinc-800 pl-1">{formatValue(editableData?.[f.key], f.type)}</div></div>)}</div>}
                {mode === 'ia' && isEditing && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields.map(f => <div key={f.key} className="bg-zinc-50 p-4 rounded-lg border"><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{f.label}</label><div className="relative">{f.type === 'number' && <span className="absolute left-3 top-2 text-zinc-500">R$</span>}<input type="text" readOnly={f.isCalculated} value={formValues[f.key] || ''} onChange={(e) => setFormValues(handleAutoSum({...formValues, [f.key]: e.target.value}))} className={`w-full py-1.5 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-zinc-800 ${f.type === 'number' ? 'pl-8 pr-3' : 'px-3'} ${f.isCalculated ? 'bg-zinc-100' : ''}`} /></div></div>)}</div>}
                
                {mode === 'manual' && (
                    <div className="space-y-6">
                        {manualEntries.map((entry, index) => (
                            <div key={entry.id} className="p-4 border border-zinc-200 rounded-lg bg-zinc-50 relative">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-zinc-700">Lançamento #{index + 1}</h4>
                                    {manualEntries.length > 1 && <button onClick={() => removeEntry(entry.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {fields.map(f => <div key={f.key}><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{f.label}</label><div className="relative">{f.type === 'number' && <span className="absolute left-3 top-2 text-zinc-500">R$</span>}<input type="text" readOnly={f.isCalculated} value={entry.formValues[f.key] || ''} onChange={(e) => handleInputChange(entry.id, f.key, e.target.value)} className={`w-full py-1.5 border border-zinc-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-zinc-800 ${f.type === 'number' ? 'pl-8 pr-3' : 'px-3'} ${f.isCalculated ? 'bg-zinc-100' : ''}`} /></div></div>)}
                                </div>
                                <div className="mt-4">
                                    <label className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium"><Paperclip className="h-4 w-4" /><span>{entry.file ? entry.file.name : "Anexar PDF ou Imagem"}</span><input type="file" className="hidden" onChange={e => handleFileChange(entry.id, e.target.files ? e.target.files[0] : null)} /></label>
                                </div>
                            </div>
                        ))}
                        {allowMultiple && <div className="flex justify-center mt-4"><button onClick={addEntry} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"><PlusCircle className="h-5 w-5" />Adicionar Lançamento</button></div>}
                        
                        {manualEntries.length > 0 && (
                            <div className="mt-6 p-4 bg-indigo-50 border-t-4 border-indigo-500 rounded-b-lg">
                                <h4 className="text-lg font-bold text-zinc-800 mb-2">Totais desta Etapa</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {fields.filter(f => f.type === 'number').map(f => (
                                        <div key={f.key} className="flex justify-between items-baseline"><span className="text-zinc-600">{f.label}:</span><span className="font-bold text-zinc-800 text-base">{Number(manualTotals[f.key]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="mt-8 flex justify-center"><button onClick={handleConfirm} disabled={mode === 'manual' && manualEntries.length === 0} className="flex items-center justify-center px-8 py-3 bg-green-600 text-white font-bold rounded-full shadow-lg hover:bg-green-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"><Check className="h-6 w-6 mr-2" />Confirmar e Continuar</button></div>
            </div>
        </div>
      </div>
    );
};

export default StepUpload;