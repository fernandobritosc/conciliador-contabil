# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-02-18

### Added
- **Múltiplos Lançamentos**: Adicionada a opção de incluir vários registros em todas as etapas de auditoria (RH, Retenção, Empenho, Liquidação e DARF).
- **Upload Múltiplo**: Suporte para seleção de múltiplos arquivos PDF/Imagens simultaneamente para extração via IA.
- **Cód. 1099 no DARF**: Incluído o campo "CP Segurado - Contrib. Individual" na etapa de DARF e nos relatórios gerados.

### Fixed
- **Integridade de Tipos**: Correção de erros de tipagem do TypeScript no `App.tsx` e `supabaseClient.ts`.
- **Interface de Upload**: Ajuste nos rótulos de botões para refletir as novas capacidades de múltiplos arquivos.

### Changed
- **Relatório PDF**: Atualização do quadro de conformidade para incluir Gilrat/RAT e Contribuição Individual de forma explícita.
