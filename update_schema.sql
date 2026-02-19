-- Adicionar colunas faltantes para o novo sistema
ALTER TABLE public.reconciliacoes 
ADD COLUMN IF NOT EXISTS rh_relatorio_entries JSONB,
ADD COLUMN IF NOT EXISTS retention_entries JSONB,
ADD COLUMN IF NOT EXISTS empenho_entries JSONB,
ADD COLUMN IF NOT EXISTS liquidacao_entries JSONB,
ADD COLUMN IF NOT EXISTS guia_entries JSONB,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Garantir que as colunas aceitem NULL
ALTER TABLE public.reconciliacoes ALTER COLUMN rh_relatorio_entries DROP NOT NULL;
ALTER TABLE public.reconciliacoes ALTER COLUMN retention_entries DROP NOT NULL;
ALTER TABLE public.reconciliacoes ALTER COLUMN empenho_entries DROP NOT NULL;
ALTER TABLE public.reconciliacoes ALTER COLUMN liquidacao_entries DROP NOT NULL;
ALTER TABLE public.reconciliacoes ALTER COLUMN guia_entries DROP NOT NULL;
ALTER TABLE public.reconciliacoes ALTER COLUMN observacoes DROP NOT NULL;

-- Atualizar o cache do schema imediatamente
NOTIFY pgrst, 'reload schema';
