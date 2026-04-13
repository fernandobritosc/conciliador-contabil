import { GoogleGenerativeAI } from "@google/generative-ai";
import { RhRelatorioData, RhGuiaData, RetentionReportData, ComparisonResult, EmpenhoData, LiquidacaoData } from '../types';
import { RhRelatorioSchema, RhGuiaSchema, RetentionReportSchema, EmpenhoSchema, LiquidacaoSchema } from './validationSchema';
import { logger } from './logger';

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
        OBJETIVO: Extrair o número do empenho, valor bruto e deduções (Salário Família/Maternidade).
        
        INSTRUÇÕES DE CAMPO:
        1. "numeroEmpenho": Procure pelo rótulo "Empenho", "Nota de Empenho" ou "NE". Formato esperado: "000/0000". Se não encontrar de jeito nenhum, retorne "NÃO LOCALIZADO". NÃO retorne vazio.
        2. "valorBruto": É o valor total da liquidação ANTES das deduções. Procure por "VALOR BRUTO" ou "TOTAL DA NOTA".
        3. "salarioFamilia": Valor específico de "Salário Família". Se não encontrar, use 0.
        4. "salarioMaternidade": Valor específico de "Salário Maternidade". Se não encontrar, use 0.

        REGRAS CRÍTICAS:
        - O valorBruto DEVE ser maior ou igual à soma das deduções.
        - Retorne APENAS o JSON.
        - Use ponto (.) como separador decimal. NUNCA use vírgula.
        - Se um valor for "R$ 1.234,56", retorne apenas 1234.56.
        
        FORMATO JSON: {"numeroEmpenho": "string", "valorBruto": 0.00, "salarioFamilia": 0.00, "salarioMaternidade": 0.00}
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
  if (!apiKey) throw new Error("API Key is required. Please check sua configuração de ambiente no .env.local.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = getExtractionPrompt(type);
  const imagePart = { inlineData: { mimeType, data: base64Data } };

  try {
    // Tenta modelos em ordem de preferência REALIZANDO a requisição baseada na documentação de Abril/2026
    const modelsToTry = [
      'gemini-3.1-flash-lite-preview', // Preview ativo (lançado Mar/2026, sem data de encerramento)
      'gemini-3-flash-preview',        // Preview ativo (lançado Dez/2025, sem data de encerramento)
      'gemini-2.5-flash',              // Estável (encerra Jun/2026)
      'gemini-2.0-flash',              // Estável (encerra Jun/2026)
    ];
    
    let response;
    let lastError;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[INFO] Tentando extração com modelo: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt, imagePart]);
        response = await result.response;
        if (response) {
          console.log(`[SUCESSO] Extração concluída com: ${modelName}`);
          break;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[AVISO] Falha no modelo ${modelName}: ${e.message}`);
        // Se for erro de permissão (403), tenta o próximo modelo
        if (e.message?.includes('403') || e.message?.includes('PERMISSION_DENIED')) {
          continue;
        }
        // Se for erro de cota, para imediatamente
        if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
          break;
        }
      }
    }

    if (!response) {
      // Se todos falharem com 403, acionamos o modo manual (valores zerados)
      if (lastError?.message?.includes('403') || lastError?.message?.includes('denied access')) {
        console.error("[ERRO CRÍTICO] Todos os modelos retornaram 403. Ativando modo manual.");
        if (type === 'Relatorio') return { valorSegurados: 0, valorEmpresa: 0, valorAcidente: 0, deducaoFpas: 0, totalARecolher: 0 };
        if (type === 'Guia') return { valorSegurados: 0, valorEmpresa: 0, valorRiscoAmbiental: 0, valorContribIndividual: 0, totalGuia: 0 };
        if (type === 'Liquidacao') return { numeroEmpenho: 'NÃO LOCALIZADO', valorBruto: 0, salarioFamilia: 0, salarioMaternidade: 0 };
        if (type === 'Empenho') return { numeroEmpenho: 'NÃO LOCALIZADO', valor: 0 };
        if (type === 'Retention') return { valorRetido: 0, competencia: undefined, empresa: undefined };
      }
      throw lastError || new Error(`Falha ao processar o documento (${type}).`);
    }

    const textContent = response.text();
    if (!textContent) throw new Error("A API não retornou conteúdo válido.");

    const cleanedJson = cleanJsonString(textContent);
    let rawData = JSON.parse(cleanedJson);

    // Normalização agressiva de números
    const normalize = (val: any) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        let cleaned = val.trim();
        cleaned = cleaned.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    if (type === 'Liquidacao' || type === 'Relatorio' || type === 'Guia' || type === 'Empenho') {
      Object.keys(rawData).forEach(key => {
        if (key !== 'numeroEmpenho' && key !== 'competencia' && key !== 'empresa') {
          rawData[key] = normalize(rawData[key]);
        }
      });
    }

    // Validação de Dados Pós-IA
    try {
      switch (type) {
        case 'Relatorio': return RhRelatorioSchema.parse(rawData) as RhRelatorioData;
        case 'Guia': return RhGuiaSchema.parse(rawData) as RhGuiaData;
        case 'Retention': return RetentionReportSchema.parse(rawData) as RetentionReportData;
        case 'Empenho': return EmpenhoSchema.parse(rawData) as EmpenhoData;
        case 'Liquidacao': return LiquidacaoSchema.parse(rawData) as LiquidacaoData;
      }
    } catch (validationError: any) {
      logger.warn(`[FALLBACK] Validação falhou para ${type}, usando normalização manual.`);
      if (type === 'Relatorio') {
        return {
          valorSegurados: rawData.valorSegurados || 0,
          valorEmpresa: rawData.valorEmpresa || 0,
          valorAcidente: rawData.valorAcidente || 0,
          deducaoFpas: rawData.deducaoFpas || 0,
          totalARecolher: (rawData.valorSegurados || 0) + (rawData.valorEmpresa || 0) + (rawData.valorAcidente || 0) - (rawData.deducaoFpas || 0)
        } as RhRelatorioData;
      } else if (type === 'Guia') {
        return {
          valorSegurados: rawData.valorSegurados || 0,
          valorEmpresa: rawData.valorEmpresa || 0,
          valorRiscoAmbiental: rawData.valorRiscoAmbiental || 0,
          valorContribIndividual: rawData.valorContribIndividual || 0,
          totalGuia: (rawData.valorSegurados || 0) + (rawData.valorEmpresa || 0) + (rawData.valorRiscoAmbiental || 0) + (rawData.valorContribIndividual || 0)
        } as RhGuiaData;
      } else if (type === 'Liquidacao') {
        const valorBruto = rawData.valorBruto || 0;
        const salarioFamilia = Math.min(rawData.salarioFamilia || 0, valorBruto);
        const salarioMaternidade = Math.min(rawData.salarioMaternidade || 0, valorBruto - salarioFamilia);
        return { numeroEmpenho: rawData.numeroEmpenho || 'NÃO LOCALIZADO', valorBruto, salarioFamilia, salarioMaternidade } as LiquidacaoData;
      } else if (type === 'Empenho') {
        return { numeroEmpenho: rawData.numeroEmpenho || 'NÃO LOCALIZADO', valor: rawData.valor || 0 } as EmpenhoData;
      } else if (type === 'Retention') {
        return { valorRetido: rawData.valorRetido || 0, competencia: rawData.competencia, empresa: rawData.empresa } as RetentionReportData;
      }
      throw validationError;
    }
  } catch (error: any) {
    console.error(`Erro na extração Gemini para o tipo ${type}:`, error);

    const isQuotaError = error?.error?.status === 'RESOURCE_EXHAUSTED' || error?.error?.code === 429 || error?.message?.includes('quota');
    const is403Error = error?.error?.status === 'PERMISSION_DENIED' || error?.message?.includes('403') || error?.message?.includes('denied access');

    if (is403Error) {
      console.warn(`[FALLBACK FINAL] API bloqueada. Retornando zeros para ${type}`);
      if (type === 'Relatorio') return { valorSegurados: 0, valorEmpresa: 0, valorAcidente: 0, deducaoFpas: 0, totalARecolher: 0 };
      if (type === 'Guia') return { valorSegurados: 0, valorEmpresa: 0, valorRiscoAmbiental: 0, valorContribIndividual: 0, totalGuia: 0 };
      if (type === 'Liquidacao') return { numeroEmpenho: 'NÃO LOCALIZADO', valorBruto: 0, salarioFamilia: 0, salarioMaternidade: 0 };
      if (type === 'Empenho') return { numeroEmpenho: 'NÃO LOCALIZADO', valor: 0 };
      if (type === 'Retention') return { valorRetido: 0, competencia: undefined, empresa: undefined };
    }

    if (isQuotaError) {
      throw new Error('Cota da API excedida. Tente novamente em alguns minutos.');
    }

    throw new Error(error?.message || `Falha ao processar o documento (${type}).`);
  }
};

export const generateNotaTecnica = async (finalData: ComparisonResult): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key is required. Please check sua configuração de ambiente no .env.local.");
  const genAI = new GoogleGenerativeAI(apiKey);
  
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
    4. ACHADOS DE AUDITORIA: Lista de inconsistências específicas detectadas (se houver).
    5. CONCLUSÃO: Parecer final (Conciliado, Divergente ou Conciliado com Ressalva) e recomendações de ajuste, se houver.

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

  // Tenta modelos em ordem de preferência para gerar o parecer técnico
  const modelsToTry = [
    'gemini-3.1-pro-preview', // Preview ativo (lançado Fev/2026, sem data de encerramento)
    // 'gemini-3-pro-preview' — ENCERRADO em 09/03/2026, redireciona para gemini-3.1-pro-preview
    'gemini-2.5-pro',         // Estável (encerra Jun/2026)
    'gemini-2.5-flash',       // Fallback estável (encerra Jun/2026) — gemini-1.5-pro encerrado em 29/09/2025
  ];

  let response;
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[INFO] Tentando gerar Nota Técnica com: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      response = await result.response;
      if (response) break;
    } catch (e: any) {
      lastError = e;
      console.warn(`[AVISO] Falha ao usar ${modelName} para Nota Técnica: ${e.message}`);
      if (e.message?.includes('403') || e.message?.includes('PERMISSION_DENIED')) continue;
      break; 
    }
  }

  try {
    if (!response) throw lastError || new Error("Falha ao gerar o parecer técnico.");
    
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
    return "Não foi possível gerar a Nota Técnica automaticamente devido a um erro de conexão ou permissão da API. Por favor, insira o parecer manualmente.";
  }
};
