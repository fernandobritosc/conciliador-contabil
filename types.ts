

export type ComparisonStatus = 'CONCILIADO' | 'DIVERGENTE';

export interface RhRelatorioData {
  valorSegurados: number;
  valorEmpresa: number;
  valorAcidente: number; // RAT/FAP
  deducaoFpas: number;
  totalARecolher: number;
}

export interface RetentionReportData {
  valorRetido: number;
  competencia?: string;
  empresa?: string;
}

export interface EmpenhoData {
  numeroEmpenho: string;
  valor: number;
}

export interface LiquidacaoData {
  numeroEmpenho: string;
  valorBruto: number;
  salarioFamilia: number;
  salarioMaternidade: number;
}

export interface RhGuiaData {
  valorSegurados: number; // Cód 1082
  valorEmpresa: number;   // Cód 1138
  valorRiscoAmbiental: number; // Cód 1646
  totalGuia: number;
}

export interface ComparisonResult {
  retentionData?: RetentionReportData;
  retentionMatch?: boolean;
  retentionDifference?: number;
  empenhoData?: EmpenhoData;
  empenhoMatch?: boolean;
  empenhoDifference?: number;
  liquidacaoData?: LiquidacaoData;
  liquidacaoBrutoMatch?: boolean;
  liquidacaoBrutoDifference?: number;
  liquidacaoRetencaoMatch?: boolean;
  liquidacaoRetencaoDifference?: number;
  deducaoFpas: number;
  segurados: { rh: number; guia: number; diff: number; status: 'MATCH' | 'MISMATCH' };
  empresa: { rh: number; guia: number; diff: number; status: 'MATCH' | 'MISMATCH' };
  acidente: { rh: number; guia: number; diff: number; status: 'MATCH' | 'MISMATCH' };
  total: { rh: number; guia: number; diff: number; status: 'MATCH' | 'MISMATCH' };
  finalStatus: ComparisonStatus;
}

export type Step = 'UPLOAD_RH' | 'UPLOAD_RETENTION' | 'UPLOAD_EMPENHO' | 'UPLOAD_LIQUIDACAO' | 'UPLOAD_GUIA' | 'COMPARISON';

export interface ReconciliationRecord {
  id: string;
  orgao: string;
  competencia: string;
  status: ComparisonStatus;
  created_at: string;
  comparison_result: ComparisonResult;
  nota_tecnica: string | null;
}