import { z } from 'zod';

// Esquema para dados extraídos pela IA do Relatório RH (Blindado com Regras Matemáticas)
export const RhRelatorioSchema = z.object({
    valorSegurados: z.number().nonnegative(),
    valorEmpresa: z.number().nonnegative(),
    valorAcidente: z.number().nonnegative(),
    deducaoFpas: z.number().nonnegative(),
    totalARecolher: z.number().nonnegative(),
}).refine((data) => {
    const somaCalculada = data.valorSegurados + data.valorEmpresa + data.valorAcidente - data.deducaoFpas;
    return Math.abs(somaCalculada - data.totalARecolher) < 0.10;
}, {
    message: "Inconsistência no Relatório RH: A soma dos componentes não bate com o Total a Recolher."
}).refine((data) => {
    // Limite lógico: RAT/FAP raramente passa de 4-5% da base. 
    // Usamos uma margem de segurança de 10% do total da folha para detectar erros grosseiros de OCR.
    const baseEstimada = data.valorSegurados + data.valorEmpresa;
    if (baseEstimada === 0) return true;
    return data.valorAcidente <= (baseEstimada * 0.15);
}, {
    message: "Valor de Acidente (RAT) detectado como absurdamente alto (provável erro de leitura da IA)."
});

// Esquema para dados extraídos pela IA do DARF (Guia) (Blindado com Regras Matemáticas)
export const RhGuiaSchema = z.object({
    valorSegurados: z.number().nonnegative(),
    valorEmpresa: z.number().nonnegative(),
    valorRiscoAmbiental: z.number().nonnegative(),
    valorContribIndividual: z.number().nonnegative(),
    totalGuia: z.number().nonnegative(),
}).refine((data) => {
    const somaCalculada = data.valorSegurados + data.valorEmpresa + data.valorRiscoAmbiental + data.valorContribIndividual;
    return Math.abs(somaCalculada - data.totalGuia) < 0.10;
}, {
    message: "Inconsistência na Guia DARF: A soma dos códigos informados não confere com o Valor Total do Documento."
});

// Esquema para dados de Retenção
export const RetentionReportSchema = z.object({
    valorRetido: z.number().nonnegative(),
    competencia: z.string().optional(),
    empresa: z.string().optional(),
});

// Esquema para Empenho
export const EmpenhoSchema = z.object({
    numeroEmpenho: z.string().min(1),
    valor: z.number().nonnegative(),
});

// Esquema para Liquidação (Blindado contra limites lógicos)
export const LiquidacaoSchema = z.object({
    numeroEmpenho: z.string().min(1),
    valorBruto: z.number().nonnegative(),
    salarioFamilia: z.number().nonnegative().default(0),
    salarioMaternidade: z.number().nonnegative().default(0),
}).refine((data) => {
    return (data.salarioFamilia + data.salarioMaternidade) <= data.valorBruto;
}, {
    message: "Erro na Liquidação: O valor das deduções (Salário Família/Maternidade) não pode ser maior que o Valor Bruto."
});

// Esquema Raiz da Conciliação (Blindagem do Banco de Dados)
export const ReconciliationRecordSchema = z.object({
    id: z.string().uuid(),
    orgao: z.string().min(1),
    competencia: z.string().min(1),
    status: z.enum(['CONCILIADO', 'CONCILIADO_COM_RESSALVA', 'DIVERGENTE', 'PAGO', 'EM_ANDAMENTO', 'PENDENTE']),
    comparison_result: z.any().nullable(), // Pode ser tipado mais profundamente depois
    nota_tecnica: z.string().nullable(),
    observacoes: z.string().nullable().optional(),
    rh_relatorio_entries: z.array(RhRelatorioSchema).nullable().optional(),
    retention_entries: z.array(RetentionReportSchema).nullable().optional(),
    empenho_entries: z.array(EmpenhoSchema).nullable().optional(),
    liquidacao_entries: z.array(LiquidacaoSchema).nullable().optional(),
    guia_entries: z.array(RhGuiaSchema).nullable().optional(),
    created_at: z.string().datetime(),
    files: z.array(z.string()).default([]),
});

export type ValidatedReconciliation = z.infer<typeof ReconciliationRecordSchema>;
