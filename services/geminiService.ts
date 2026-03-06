import { GoogleGenerativeAI } from "@google/generative-ai";
import { RhRelatorioData, RhGuiaData, RetentionReportData, ComparisonResult, EmpenhoData, LiquidacaoData } from '../types';

const cleanJsonString = (text: string): string => {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : text.trim();
};

const getExtractionPrompt = (type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao'): string => {
  switch (type) {
    case 'Relatorio':
      return `
        Analise a imagem do relatório "Relação da Contribuição Previdenciária".
        OBJETIVO: Extrair os valores do "TOTAL GERAL".
        CAMPOS: "Valor dos Segurados", "Valor da Empresa", "Valor de Acidente" (pode ser RAT ou FAP), "Dedução do FPAS", "Total a Recolher".
        FORMATO JSON: {"valorSegurados": 0.00, "valorEmpresa": 0.00, "valorAcidente": 0.00, "deducaoFpas": 0.00, "totalARecolher": 0.00}.
        REGRAS: Retorne APENAS o JSON. Use ponto (.) como separador decimal.
      `;
    case 'Guia':
      return `
        Analise a imagem do "Documento de Arrecadação de Receitas Federais" (DARF).
        OBJETIVO: Extrair valores da coluna "Principal".
        CAMPOS: "Valor Segurados" (Cód 1082), "Valor Empresa" (Cód 1138), "Valor Risco Ambiental" (Cód 1646), "Valor Contrib Individual" (Cód 1099), "Total da Guia" (Valor Total do Documento).
        FORMATO JSON: {"valorSegurados": 0.00, "valorEmpresa": 0.00, "valorRiscoAmbiental": 0.00, "valorContribIndividual": 0.00, "totalGuia": 0.00}.
        REGRAS: Retorne APENAS o JSON. Use ponto (.) como separador decimal. Ignore multas e juros.
      `;
    case 'Empenho':
      return `
        Analise a imagem do "Empenho Extra-Orçamentário".
        OBJETIVO: Extrair número e valor total.
        CAMPOS: "numeroEmpenho" (formato "NÚMERO/ANO", ex: "1/2026"), "valor" (VALOR TOTAL).
        FORMATO JSON: {"numeroEmpenho": "1/2026", "valor": 0.00}.
        REGRAS: Retorne APENAS o JSON. numeroEmpenho é string, valor é float com ponto (.).
      `;
    case 'Liquidacao':
      return `
        Analise a imagem da "Nota de Liquidação".
        OBJETIVO: Extrair o número do empenho, valor bruto e retenções.
        CAMPOS:
        1. "numeroEmpenho": O número do empenho associado (ex: "1234/2024").
        2. "valorBruto": O valor bruto total da liquidação. Procure por "VALOR BRUTO".
        3. "salarioFamilia": O valor da retenção de "Salário Família". Se não houver, retorne 0.
        4. "salarioMaternidade": O valor da retenção de "Salário Maternidade". Se não houver, retorne 0.
        FORMATO JSON: {"numeroEmpenho": "1234/2024", "valorBruto": 0.00, "salarioFamilia": 0.00, "salarioMaternidade": 0.00}.
        REGRAS: Retorne APENAS o JSON. Use ponto (.) para decimais.
      `;
    case 'Retention':
      return `
        Analise a imagem do relatório de retenção contábil.
        OBJETIVO: Extrair o valor total retido de INSS.
        FORMATO JSON: {"valorRetido": 0.00}.
        REGRAS: Retorne APENAS o JSON. Use ponto (.) como separador decimal.
      `;
  }
};

export function extractData(base64Data: string, mimeType: string, type: 'Relatorio'): Promise<RhRelatorioData>;
export function extractData(base64Data: string, mimeType: string, type: 'Guia'): Promise<RhGuiaData>;
export function extractData(base64Data: string, mimeType: string, type: 'Retention'): Promise<RetentionReportData>;
export function extractData(base64Data: string, mimeType: string, type: 'Empenho'): Promise<EmpenhoData>;
export function extractData(base64Data: string, mimeType: string, type: 'Liquidacao'): Promise<LiquidacaoData>;
export async function extractData(
  base64Data: string,
  mimeType: string,
  type: 'Relatorio' | 'Guia' | 'Retention' | 'Empenho' | 'Liquidacao'
): Promise<RhRelatorioData | RhGuiaData | RetentionReportData | EmpenhoData | LiquidacaoData> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key is required. Please check your environment configuration.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = getExtractionPrompt(type);

  const imagePart = { inlineData: { mimeType, data: base64Data } };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const textContent = response.text();
    if (!textContent) throw new Error("A API não retornou conteúdo válido.");

    const cleanedJson = cleanJsonString(textContent);
    return JSON.parse(cleanedJson);
  } catch (error: any) {
    console.error(`Erro na extração Gemini para o tipo ${type}:`, error);

    let isQuotaError = false;

    // Case 1: The error object itself contains the status (common for direct API errors).
    if (error?.error?.status === 'RESOURCE_EXHAUSTED' || error?.error?.code === 429) {
      isQuotaError = true;
    }
    // Case 2: The error.message property contains the error info as a string (common for SDK-wrapped errors).
    else if (typeof error?.message === 'string' && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota'))) {
      isQuotaError = true;
    }

    if (isQuotaError) {
      throw new Error(
        'Sua cota de uso da API foi excedida.\n' +
        'Isso geralmente ocorre com chaves do plano gratuito, que possuem um limite de requisições por minuto.'
      );
    }

    // If it's not a quota error, re-throw a more specific or generic error.
    const errorMessage = error?.error?.message || error?.message || `Falha ao processar o documento (${type}).`;
    throw new Error(errorMessage);
  }
};

export const generateNotaTecnica = async (finalData: ComparisonResult): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key is required. Please check your environment configuration.");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const format = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const retentionSection = finalData.retentionData ? `- Conferência RH vs Retenção Contábil: ${finalData.retentionMatch ? 'OK' : 'DIVERGENTE'} (Diferença: R$ ${format(finalData.retentionDifference || 0)})` : '';
  const empenhoSection = finalData.empenhoData ? `- Conferência Retenção vs Empenho Contábil: ${finalData.empenhoMatch ? 'OK' : 'DIVERGENTE'} (Diferença: R$ ${format(finalData.empenhoDifference || 0)})` : '';
  const liquidacaoBrutoSection = finalData.liquidacaoData ? `- Conferência Parte Patronal (RH vs Liquidação): ${finalData.liquidacaoBrutoMatch ? 'OK' : 'DIVERGENTE'} (Diferença: R$ ${format(finalData.liquidacaoBrutoDifference || 0)})` : '';
  const liquidacaoRetencaoSection = finalData.liquidacaoData ? `- Conferência Deduções (RH vs Liquidação): ${finalData.liquidacaoRetencaoMatch ? 'OK' : 'DIVERGENTE'} (Diferença: R$ ${format(finalData.liquidacaoRetencaoDifference || 0)})` : '';

  const prompt = `
    Aja como um Auditor Fiscal ou Analista de Contabilidade Pública Sênior.
    OBJETIVO: Gerar uma Nota Técnica de Conciliação Previdenciária formal e estruturada.

    ESTRUTURA OBRIGATÓRIA:
    1. ASSUNTO: Descrição sucinta do objeto da conciliação.
    2. REFERÊNCIA: Listagem dos documentos analisados (RH, Contabilidade, Guia de Recolhimento).
    3. ANÁLISE: Detalhamento técnico da conferência, citando valores e eventuais divergências encontradas.
    4. CONCLUSÃO: Parecer final (Conciliado, Divergente ou Conciliado com Ressalva) e recomendações de ajuste, se houver.

    DADOS PARA A ANÁLISE:
    - Validações Contábeis:
      ${retentionSection}
      ${empenhoSection}
      ${liquidacaoBrutoSection}
      ${liquidacaoRetencaoSection}

    - Comparativo Final (RH vs GUIA):
      * Segurados: ${finalData.segurados.status} (RH: R$ ${format(finalData.segurados.rh)} vs Guia: R$ ${format(finalData.segurados.guia)})
      * Patronal: ${finalData.empresa.status} (RH: R$ ${format(finalData.empresa.rh)} vs Guia: R$ ${format(finalData.empresa.guia)})
      * SAT/RAT: ${finalData.acidente.status} (RH: R$ ${format(finalData.acidente.rh)} vs Guia: R$ ${format(finalData.acidente.guia)})
      * GERAL: ${finalData.total.status} (RH: R$ ${format(finalData.total.rh)} vs Guia: R$ ${format(finalData.total.guia)})

    RESULTADO FINAL: ${finalData.finalStatus}

    REGRAS DE FORMATAÇÃO:
    - Use linguagem formal e impessoal (terceira pessoa).
    - NÃO utilize formatação markdown (sem '**', '*', '#').
    - O texto deve ser estruturado em parágrafos claros.
    - O título principal e o timbre serão adicionados externamente, comece direto nas seções.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    if (!text) throw new Error("A API não retornou o parecer técnico.");

    // Cleanup any lingering markdown characters and horizontal rules
    text = text.replace(/\*\*/g, '').replace(/\*/g, '');
    text = text.replace(/^-{3,}\s*$/gm, ''); // Remove lines like ---
    text = text.replace(/^_{3,}\s*$/gm, ''); // Remove lines like ___
    text = text.replace(/^\*{3,}\s*$/gm, ''); // Remove lines like ***

    return text.trim();
  } catch (error) {
    console.error("Erro ao gerar parecer técnico:", error);
    return "Não foi possível gerar o parecer técnico automaticamente devido a um erro de conexão.";
  }
};
