# ADR 0001 — Foundation boundary / Limite da fundação

Date / Data: 2026-10-25. Accepted / Aceito.

The supplied FinTrack Pro prompt supersedes the preliminary demo roadmap.
Deliver monorepo and design system first: empty financial screens, persisted
non-sensitive preferences, exact money/date primitives and process-health API.
Authentication and database integration are phase 2. No fixtures, fake users or
success responses for unavailable operations.

O prompt recebido substitui o roteiro preliminar. Primeiro: monorepo, design system,
telas vazias, preferências persistidas, primitivas exatas e API de saúde. Banco e
autenticação na fase 2. Sem usuários fictícios nem sucesso artificial.

This foundation is testable, not a completed financial product. Preference tests
cover restart, corruption and failed writes. Money/calendar tests cover exact
rounding and month boundaries. Bundling does not replace native device validation.
Unavailable dependencies/checks must be recorded, without replacing the stack.

A fundação não conclui módulos financeiros. Testar falhas, persistência e precisão;
gerar bundle não equivale a testar em aparelho. Registrar bloqueios explicitamente.
