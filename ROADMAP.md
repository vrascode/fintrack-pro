# FinTrack Pro — Roadmap / Roteiro

Scope: FinTrack Pro MASTER DEVELOPMENT PROMPT supplied on 2026-10-25.
The earlier five-project portfolio prompt remains unavailable. / Escopo: prompt
do FinTrack Pro recebido; não presume o prompt anterior de cinco projetos.

| Phase / Fase | Delivery / Entrega                                                                                                                                                          | Status / Estado            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1            | Monorepo, design system, navigation, local preferences, shared contracts, minimal health API / Fundação                                                                     | In progress / Em andamento |
| 2            | PostgreSQL, Prisma, registration, login, email verification, recovery, rotating/revocable refresh tokens, device logout, deletion, SecureStore, biometrics / Identidade     | Pending / Pendente         |
| 3            | Accounts, balances, categories/subcategories, tags, transactions, transfers, reconciliation, attachments; ownership, atomicity, idempotency, audit, concurrency / Operações | Pending / Pendente         |
| 4            | Consolidated balance, income/expenses, wealth evolution, category charts, period comparison, filters, upcoming dues / Dashboard                                             | Pending / Pendente         |
| 5            | Cards, limits, closing/due dates, installments, statements, partial/full payments, refunds, no double counting / Cartões                                                    | Pending / Pendente         |
| 6            | Monthly budgets/alerts, recurring transactions/bills, calendar/payment states, goals with deposits/withdrawals/history/projections / Planejamento                           | Pending / Pendente         |
| 7            | Redis/BullMQ reminders, Expo Notifications, validated/deduplicated CSV/OFX import, monthly/yearly reports, cash flow, CSV/PDF export / Relatórios                           | Pending / Pendente         |
| 8            | Opt-in AI summaries, patterns, savings suggestions, explained forecasts, data minimization, cost/usage limits; no financial writes / IA                                     | Pending / Pendente         |
| 9            | Threat review, rate limiting, authorization audit, retention, recovery drills, failure/concurrency tests, performance, observability / Segurança                            | Pending / Pendente         |
| 10           | GitHub Actions, native release validation, signing, deployment/runbooks, bilingual docs, publication preparation / Entrega                                                  | Pending / Pendente         |

Security, tests and docs apply to every phase; phase 9 deepens them. / Segurança,
testes e documentação são obrigatórios em cada fase, com aprofundamento na fase 9.

## Phase 1 acceptance / Aceite da fase 1

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
→ versionar. Não publicar nem enviar commits a remotos nesta fase.
