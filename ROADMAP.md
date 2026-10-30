# FinTrack Pro — Roadmap / Roteiro

Scope: FinTrack Pro MASTER DEVELOPMENT PROMPT supplied on 2026-10-25.
The earlier five-project portfolio prompt remains unavailable. / Escopo: prompt
do FinTrack Pro recebido; não presume o prompt anterior de cinco projetos.

| Phase / Fase | Delivery / Entrega                                                                                                                                                          | Status / Estado                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1            | Monorepo, design system, navigation, local preferences, shared contracts, minimal health API / Fundação                                                                     | Local checks passed; source published / Validação local aprovada; código publicado                |
| 2            | PostgreSQL, Prisma, registration, login, email verification, recovery, rotating/revocable refresh tokens, device logout, deletion, SecureStore, biometrics / Identidade     | In progress: schema and tested security core; real integration pending / Em andamento, sem aceite |
| 3            | Accounts, balances, categories/subcategories, tags, transactions, transfers, reconciliation, attachments; ownership, atomicity, idempotency, audit, concurrency / Operações | Pending / Pendente                                                                                |
| 4            | Consolidated balance, income/expenses, wealth evolution, category charts, period comparison, filters, upcoming dues / Dashboard                                             | Pending / Pendente                                                                                |
| 5            | Cards, limits, closing/due dates, installments, statements, partial/full payments, refunds, no double counting / Cartões                                                    | Pending / Pendente                                                                                |
| 6            | Monthly budgets/alerts, recurring transactions/bills, calendar/payment states, goals with deposits/withdrawals/history/projections / Planejamento                           | Pending / Pendente                                                                                |
| 7            | Redis/BullMQ reminders, Expo Notifications, validated/deduplicated CSV/OFX import, monthly/yearly reports, cash flow, CSV/PDF export / Relatórios                           | Pending / Pendente                                                                                |
| 8            | Opt-in AI summaries, patterns, savings suggestions, explained forecasts, data minimization, cost/usage limits; no financial writes / IA                                     | Pending / Pendente                                                                                |
| 9            | Threat review, rate limiting, authorization audit, retention, recovery drills, failure/concurrency tests, performance, observability / Segurança                            | Pending / Pendente                                                                                |
| 10           | GitHub Actions, native release validation, signing, deployment/runbooks, bilingual docs, publication preparation / Entrega                                                  | Pending / Pendente                                                                                |

## Isolated financial demo — 2026-10-29

Delivered an explicitly fictional, deterministic six-month dashboard scenario
with the R$ 5,000 income and R$ 4,200 budget. The dashboard derives actual demo
balances, paid/remaining obligations, budget categories and six-month cash flow
from one dataset. The demo supports local income/expense/transfer entries,
filtered CSV export, partial obligation payments, virtual envelope events and
an unsaved savings simulator with four scenarios. Demo state uses a dedicated
AsyncStorage key and restore cannot clear unrelated user keys. Portuguese copy
encoding was corrected and demo fixture labels are localized.

This is an opt-in UI/domain sandbox only. It does not fulfill phase 2 or 3:
PostgreSQL is still unavailable, financial endpoints/repositories and authenticated
ownership do not exist, and demo entries never sync. Card, subscription, real
recurrence, reminders, reports, real account CRUD and production financial flows
remain pending. No phase is marked complete by this demo work.

Security, tests and docs apply to every phase; phase 9 deepens them. / Segurança,
testes e documentação são obrigatórios em cada fase, com aprofundamento na fase 9.

## Phase 1 acceptance / Aceite da fase 1

### Interface refresh — 2026-10-29

Implemented: shared dark/light palettes and tokens, system theme support,
persisted language and desktop sidebar preferences, English and Brazilian
Portuguese dictionaries, responsive desktop shell with collapsible navigation,
mobile bottom tabs, redesigned overview and honest financial empty states.
Localized currency/date helpers and UI preference tests are included. This is a
presentation and local-preferences improvement; it does not complete the
PostgreSQL, account, transaction, or real-data dashboard roadmap phases.

- npm workspaces, strict TypeScript, generated lockfile, shared lint/format config.
- Expo pt-BR app: overview, activity, accounts, cards and preferences tabs;
  responsive light/dark theme, accessible controls, honest empty states.
- Real local preference persistence, recovery from read/write failures.
- Reusable buttons, cards, fields, loading, error and empty components.
- Exact integer money and timezone-independent calendar primitives with tests.
- NestJS process-health endpoint tested through HTTP.
- No fabricated balances, transactions, identity or database readiness.
- Lint, typecheck, tests and bundles executed where dependencies/tools permit;
  essential unavailable checks keep the acceptance gate open.
- Bilingual setup, examples, architecture, decisions, limitations and next step.

Fundação não equivale a produto financeiro concluído. Autenticação e persistência
financeira começam na fase 2; dashboard e gráficos reais na fase 4.

## Implementation order / Ordem de implementação

1. Inspect work; update research, architecture and acceptance.
2. Configure workspaces and compatible dependencies from official docs.
3. Implement shared primitives, health API and behavior tests.
4. Implement design system, navigation and persisted preferences.
5. Run checks, fix failures, document results, make scoped Conventional Commits.

Inspecionar → documentar → configurar → implementar → testar → corrigir → registrar
→ versionar → enviar commits validados para `origin/main`, conforme autorização
do usuário em 2026-10-26. Não reescrever histórico nem usar force push.

## Phase 2 acceptance / Aceite da fase 2

- [x] Strict identity input contracts; real password hashing and verification tests.
- [x] Opaque token generation and session expiry/rotation/replay/revocation transitions tested locally.
- [x] Initial Prisma schema, SQL migration and isolated PostgreSQL Compose configuration written.
- [x] Install and lock compatible Prisma dependencies; validate schema/client generation.
- [ ] Apply versioned migrations to real PostgreSQL and pass integration suite without mocks.
- [ ] Transactional repository, ownership checks, concurrent rotation/logout and replay revocation.
- [ ] HTTP registration/login, rate limits, generic authentication failures and lifecycle tests.
- [ ] Single-use email verification/recovery, real delivery, session invalidation on password reset.
- [ ] Device session management and account deletion through authenticated HTTP.
- [ ] Mobile auth UI, SecureStore, biometric validation on native devices.
- [ ] Dependency audit and complete validation; scoped commits and authorized push.

The first three checks describe code and local unit behavior, not production identity.
The identity and ledger migrations are hand-authored and have not been applied.
Phase 2 remains open until all its
criteria pass. / Os primeiros itens representam código e testes locais, não identidade
integrada. Migração manual ainda não validada; todos os critérios são obrigatórios.

## Current gates / Bloqueios atuais — 2026-10-27

Phase 1 functional checks passed locally: lint, strict types, 14 foundation tests,
Android/iOS/web exports and 8 browser tests. Native device behavior is not verified.
Source publication to GitHub was verified on 2026-10-27. The earlier npm audit did
not complete; dependency review and release acceptance remain open.
See [progress](PORTFOLIO_PROGRESS.md).

A fase 1 passou nas verificações funcionais locais, e a publicação do código no
GitHub foi confirmada em 27/10/2026. Auditoria, revisão de dependências e aceite de
release seguem pendentes. Não há validação em aparelho nativo.

Phase 2 has started with 13 additional local tests, identity primitives, schema,
migration and an integration suite. PostgreSQL/container tooling is unavailable on
PATH; Prisma installation failed with EACCES. The database suite fails its prerequisite
gate, not a passing integration. Git staging and publication succeeded through
approved operations after the earlier sandbox restrictions.
Do not skip to phase 3 or substitute mock persistence to declare phase 2 complete.

## PostgreSQL setup check — 2026-10-29

Prisma 7 dependencies, the owner-scoped ledger schema and migration were published
in `5872d9f`. Local schema validation and client generation passed, but the prior
real integration attempt returned PostgreSQL `P1001`. This environment has no
Docker Desktop, PostgreSQL installation, WSL, or listener on ports 5432/5433.
The local `.env` was safely created with separate random development/test
credentials and is ignored by Git. `infra/compose.yaml` binds both databases to
loopback, persists development storage in a named volume, and uses ephemeral test
storage. No migration has run against either database.

Starting PostgreSQL now requires installing WSL/Docker Desktop or native PostgreSQL,
which changes software outside the project and may require administrator approval.
The installation step is pending explicit user authorization; see
[portfolio progress](PORTFOLIO_PROGRESS.md).

A fase 2 começou com 13 testes locais adicionais e código de identidade/banco.
PostgreSQL, Prisma, entrega de email, SecureStore e testes nativos seguem pendentes.
A suíte real não passou: encerra por pré-requisitos ausentes. Commits e push foram
concluídos por operações autorizadas. O aceite da fase 2 permanece aberto.
