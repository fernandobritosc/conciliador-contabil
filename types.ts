

export type ComparisonStatus = 'CONCILIADO' | 'CONCILIADO_COM_RESSALVA' | 'DIVERGENTE';

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
  valorContribIndividual: number; // Cód 1099
  totalGuia: number;
}

export interface ComparisonResult {
  relatorioData?: RhRelatorioData;
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
  internalMatches?: {
    seguradosMatch: boolean;
    empresaMatch: boolean;
    acidenteMatch: boolean;
    totalMatch: boolean;
  };
  // Elos da Triangulação (Mãos Dadas)
  triangulation?: {
    rh_vs_contab: {
      segurados: boolean;
      empresa: boolean;
      total: boolean;
    };
    contab_vs_darf: {
      segurados: boolean;
      empresa: boolean;
      total: boolean;
    };
  };
  totalContab: number;
  guiaData?: RhGuiaData;
  finalStatus: ComparisonStatus;
}

export type Step = 'UPLOAD_RH' | 'UPLOAD_RETENTION' | 'UPLOAD_EMPENHO' | 'UPLOAD_LIQUIDACAO' | 'UPLOAD_GUIA' | 'COMPARISON';

export interface ReconciliationRecord {
  id: string;
  orgao: string;
  competencia: string;
  status: 'CONCILIADO' | 'CONCILIADO_COM_RESSALVA' | 'DIVERGENTE' | 'EM_ANDAMENTO';
  comparison_result: ComparisonResult | null;
  nota_tecnica: string | null;
  observacoes?: string | null;
  rh_relatorio_entries?: any[] | null;
  retention_entries?: any[] | null;
  empenho_entries?: any[] | null;
  liquidacao_entries?: any[] | null;
  guia_entries?: any[] | null;
  created_at: string;
  files: string[];
}