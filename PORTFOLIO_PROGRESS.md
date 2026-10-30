# FinTrack Pro progress / Progresso

Updated / Atualizado: 2026-10-27

## Local PostgreSQL verification — 2026-10-30

Cookie/session checks: four dedicated HTTP/cookie security tests and eight focused
auth-store/API-URL tests passed. Typecheck passed after separating native refresh
grants from browser payloads. Browser JSON never contains the refresh credential;
it is issued through an HttpOnly cookie. Source implementation only: actual persisted
rotation remains behind the PostgreSQL authentication gate described below.

API source now loads the ignored root `.env` for local startup. Added a browser
session restore endpoint that rotates the existing opaque refresh grant under a
PostgreSQL row lock, with HttpOnly/SameSite cookies, production Secure cookies and
explicit CORS/origin checks. No tokens are written to browser localStorage.
`npm.cmd run check` passed (69 tests) before adding dedicated cookie/CORS cases.
Readiness on port 3000 returns 503; development migration and the real E2E command
both stopped at P1000 authentication (5432 and 5433). No successful database writes
or real end-to-end authentication are claimed. / Sessão web implementada no código,
mas a validação real permanece bloqueada pelas credenciais locais.

Confirmed installed/running Windows services: PostgreSQL 17.11 on 5432 and PostgreSQL
18 on 5433. Existing application URLs in the ignored `.env` reach the servers but
both return authentication code `28P01`. Added `scripts/setup-local-postgres.mjs`
for interactive local admin-password entry and creation of missing project roles and
databases, preserving existing role passwords and records. `.local/` is now ignored.
Validation: `node --check scripts/setup-local-postgres.mjs` passed. Provisioning and
migrations still depend on successful local credential entry; no persistence success
is claimed at this point.

Serviços e portas confirmados; as duas credenciais de aplicação foram recusadas.
O comando de configuração solicita senhas apenas no terminal local e preserva dados.
Próxima etapa: validar provisionamento/migrações com as credenciais administrativas.

## Pending-work review / Revisão do trabalho pendente

- Auth error classification: versioned the existing distinction between invalid
  credentials, validation errors, duplicate email and network failures. Added a
  regression test proving failures do not save a session or continue registration
  with login. `node --import tsx --test tests/auth-store.test.ts`: 4 passed; targeted
  ESLint and Prettier checks passed. / Classificação de erros de autenticação
  revisada e validada: falhas não salvam sessão nem prosseguem com login após erro
  de cadastro. Os quatro testes passaram, assim como lint e formatação específicos.
- Registration/routing checkpoint (WIP): saved the existing bilingual login and
  registration screen, auth hydration, selector hook and guarded navigation with a
  secondary demo entry. Moved its existing onboarding scenario to
  `e2e/onboarding.spec.ts`; assertions are unchanged. `npm run check`: passed (67
  tests); `npm run bundle`: web/Android/iOS exports passed.
  `npm run test:e2e -- e2e/onboarding.spec.ts`: 2 failed (desktop and mobile viewport).
  A direct browser probe confirmed an empty page and
  `EXPO_PUBLIC_API_URL must point to the deployed HTTPS API.` before render: the
  API client resolves the URL at module import. Export success is not runtime
  acceptance. / Checkpoint em andamento da tela bilíngue e navegação protegida:
  check completo e três exports aprovados, mas os dois E2E de entrada falharam.
  O cliente exige a URL de produção antes de renderizar a tela; não há integração
  real de cadastro/login com PostgreSQL comprovada.

- Demo E2E checkpoint (WIP): preserved the existing test changes that enter the demo
  through the new login screen before exercising preferences, charts and recovery.
  A diagnostic web export using the reserved `https://api.fintrack.invalid/v1` URL
  succeeded; no real API was contacted or validated. The subsequent E2E run was
  interrupted at the user's request to stop testing (partial output: two passed,
  one failed). No full-suite success is claimed. / Checkpoint dos testes existentes
  de demonstração: export de diagnóstico aprovado com URL reservada, sem backend
  real. A execução E2E foi interrompida por solicitação do usuário, após resultados
  parciais de dois aprovados e um reprovado; não houve aprovação da suíte completa.
  The demo scenario still expects the pre-demo title after entering the demo, and
  the chart scenario attempts to enter it a second time; these assertions need
  follow-up. / Permanecem expectativas antigas de título e uma segunda tentativa
  de entrar na demonstração; a correção fica para a próxima tarefa.

Review follow-ups / Pendências da revisão: the root treats auth/demo loading as a
preferences error when preferences are already ready, and submitting auth unmounts
the form; the sign-in subtitle lacks the heading role required by its E2E assertion.
/ O carregamento de auth/demo pode mostrar erro de preferências e desmonta o
formulário ao enviar; o subtítulo de login não tem o papel acessível esperado no teste.
These findings are recorded, not fixed in this versioning-only task.
/ Essas constatações foram registradas, sem desenvolvimento nesta tarefa de versionamento.

This review publishes existing work only to `feature/own-finance-flow`; no merge
to `main`. PostgreSQL persistence and the complete own-data flow remain unverified.
/ Esta revisão publica o trabalho existente somente na branch de desenvolvimento,
sem merge na main. Persistência PostgreSQL e fluxo completo continuam sem validação.

## Mobile authentication state — 2026-10-30

Added an authentication store that hydrates validated session credentials, registers
then signs in, stores only tokens (never passwords), and clears local credentials on
logout. Native storage resolves to Expo SecureStore; web remains memory-only. Unit
tests cover restoration, first-time registration/login, corrupt storage and logout.
Full `npm run check` passed (lint, typecheck/build, 66 tests, formatting). The UI is
not yet switched to require this store, and server session restore/refresh remains
incomplete.

## Mobile API and secure session foundation — 2026-10-30

Added the SDK 58 `expo-secure-store` native module, platform-specific token storage,
and a schema-validated API client for auth, accounts, categories, and transactions.
Production API URLs must use HTTPS and cannot point to loopback; the Android emulator
has a development default. Web credentials stay in memory and do not survive reload,
avoiding localStorage token exposure while the backend lacks an HttpOnly cookie flow.
Full `npm run check` passed (lint, TypeScript/build, 63 tests, formatting), and
`npm run bundle` exported web, Android and iOS bundles. This does not compile an APK
or validate a live API/database.

## Idempotent transaction API — 2026-10-30

Added authenticated transaction listing with bounded date/type/account/category
filters and posted transaction creation using exact cents. Writes require a
per-user idempotency key; matching retries return the prior entry and mismatched
retries conflict. Account and category ownership are checked before writes, and
future-dated records are rejected until planned entries have a distinct model.
Validation has passed at service level with Prisma-shaped fakes; real PostgreSQL
constraints and duplicate races still require integration testing.

## Owner-scoped category API — 2026-10-30

Added list/create endpoints for user-owned categories, including expense/income
kind and the essential-for-reserve flag. A non-destructive migration adds that flag
with a conservative default for existing rows. Service tests cover owner scoping,
mapping and validation before writes. Full `npm run check` passed (lint, types/build,
58 tests, formatting), and Prisma schema validation succeeded. Neither migration has
been applied because PostgreSQL is unavailable; fake-backed tests do not validate DB
constraints or actual persistence.

## Owner-scoped account API — 2026-10-30

Added authenticated account listing and creation endpoints. The owner ID comes from
the verified session, input is validated with the shared finance schema, and opening
balances remain exact integer cents with an explicit reference date and planning
flag. Service tests cover mapping, owner filtering and rejection before writes; HTTP
tests confirm unauthenticated account access returns 401. Full suite results follow
validation. Persistence has not been tested against PostgreSQL because the database
service is still unavailable.

## Session authorization and logout — 2026-10-30

Added a bearer access-token guard that verifies the stored token digest and session
expiry, then derives the user and session IDs from the persisted session. Added
authenticated logout with idempotent revocation and HTTP coverage for unauthenticated
requests. Full `npm run check` passed (lint, types/build, 54 tests, formatting).
Guard tests use a fake Prisma boundary; database-backed authorization is not yet
verified. Refresh-token rotation and rate limiting remain open.

## Registration and login API — 2026-10-30

Added validated registration and login endpoints. Passwords use the existing scrypt
hasher; login creates a session and refresh-token digest in one Prisma transaction
and returns opaque credentials only in the response. Added service tests using a
Prisma-shaped fake and an HTTP test for request validation. Full `npm run check`
passed (lint, types/build, 52 tests, formatting). The fake-backed test does not prove
database persistence; PostgreSQL integration remains blocked by P1001. Rate limiting,
access-token authorization middleware, and financial APIs are still pending.

## Account opening state — 2026-10-30

Added a non-destructive Prisma migration for exact-cent opening balances, their
reference date, and whether an account participates in planning. Existing account
rows receive conservative defaults; the migration does not recalculate or remove
ledger entries. Prisma validation and client generation passed, as did the full
repository check (lint, TypeScript, 51 tests, and formatting). The migration itself
has not been applied because PostgreSQL remains unavailable (P1001); database
integration is still pending.

## Prisma runtime foundation — 2026-10-30

Moved Prisma Client generation into the API TypeScript source boundary and made
API builds generate the client reproducibly without requiring a live database.
Added a lazy Prisma PostgreSQL adapter service and `/v1/health/ready`, which
checks database connectivity separately from process liveness and returns a
generic unavailable response without exposing connection details. The API build,
full repository check, and HTTP health/readiness test passed (51 tests). Database
integration remains unvalidated: PostgreSQL is unavailable at `127.0.0.1:5433`
and the prior integration run failed with Prisma P1001. No migration or financial
write/read has been confirmed against PostgreSQL.

## Responsive UI and localization — 2026-10-29

Implemented a tokenized light/dark palette with system-following behavior, a
responsive Expo web desktop shell and collapsible sidebar, mobile bottom-tab
navigation, bilingual English/pt-BR navigation and settings, locale-aware exact
cent/date helpers, and truthful empty states for financial areas. Theme, language,
privacy, and sidebar preferences persist locally; older valid preference records
receive defaults for the newly added fields. Added unit tests for translation
parity/use, exact-cent formatting, localized civil dates, and preference
migration/persistence. Financial analytics, account and transaction operations
remain unavailable because there is no connected financial API/database.

## Continuous-development audit and CI — 2026-10-27 / Auditoria e CI

Audited the repository at `89ec17e`. CI was the highest-value missing improvement:
there was no `.github/workflows` configuration, so pull requests did not run the
existing quality and browser checks automatically. Added a least-privilege CI
workflow for pushes and pull requests to `main`. It uses the Node 24 project
runtime, `npm ci`, `npm run check`, all Android/iOS/web exports, and desktop/mobile
Microsoft Edge E2E. The Windows 2025 runner supplies the Edge channel already used
by Playwright. The only two actions are pinned to verified full commit SHAs. The
workflow requests `contents: read` and uses no secrets or database access.

The ten audit candidates were checked against implemented behavior:

| Candidate                         | Audit result                                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication coverage           | Password hashing, contracts, opaque tokens, expiry, rotation, replay and revocation already have focused tests. Database integration is already authored but awaits Prisma/PostgreSQL. No duplicate tests added. |
| API error handling                | The only HTTP endpoint is `/v1/health`; it has an HTTP test and Nest’s standard errors. Auth and financial routes are not mounted, so global mutation/error machinery has no real flows to protect yet.          |
| Transaction search/filtering      | Activity is an explicit empty state. No transactions or transaction API exist, so a filter would invent functionality.                                                                                           |
| CSV export                        | No stored transactions exist to export. Defer until the transaction ledger is implemented.                                                                                                                       |
| Financial edge tests              | Existing money and calendar tests cover integer bounds, overflow, rounding, negative values, installment conservation, leap years, date limits and time zones.                                                   |
| Reusable dashboard UI             | Shared `Screen`, `Card`, `Button`, `Field` and theme components already exist. Financial dashboard data is not yet available.                                                                                    |
| Loading/empty/error states        | Shared accessible state components and preference recovery/error flows exist. Empty-state E2E covers activity, accounts and cards.                                                                               |
| GitHub Actions CI                 | Missing. Implemented in `.github/workflows/ci.yml`.                                                                                                                                                              |
| API documentation                 | The health endpoint and truthful scope are already documented in both READMEs. OpenAPI would describe just one liveness endpoint; add it with the auth API routes.                                               |
| Transaction rendering performance | No transaction list or large result set exists, so profiling and premature list optimization have no target.                                                                                                     |

Validation: `npm.cmd run check` passed (lint, strict types, build, 27/27 unit
tests and formatting); `npm.cmd run bundle` passed Android, iOS and web exports;
`npm.cmd run test:e2e` passed 8/8 in desktop/mobile Edge. The workflow YAML parsed
locally and its format check passed. The initial hosted run also passed installation,
lint, types, build and all 27 unit tests, but Prettier rejected CRLF-normalized files
in the fresh Windows checkout. Added `.gitattributes` to match the repository's LF
editor setting and keep GitHub checkouts consistent. The follow-up hosted run for
`8557caa` passed every step: `npm ci`, lint/types/build/tests/format, all three app
exports, screenshot directory setup and desktop/mobile browser tests. See the
[successful hosted run](https://github.com/vrascode/fintrack-pro/actions/runs/40529548463).
No Prisma migration, real database suite or fresh npm audit is claimed. Branch
protection remains a recommendation after the successful run.

## Auditoria de desenvolvimento contínuo e CI — 2026-10-27

A única lacuna imediata foi CI: o repositório ainda não tinha um workflow do GitHub
Actions. Adicionei execução de instalação reproduzível, lint, tipos, build, testes,
formatação, exports Android/iOS/web e os oito cenários E2E em Windows 2025 com Edge.
As actions usam hashes completos verificados; o token do workflow só lê o conteúdo
do repositório e nenhum segredo ou banco é acessado. A primeira execução do CI
confirmou lint, tipos, build e 27 testes, mas identificou diferenças CRLF no checkout
Windows. Adicionei `.gitattributes` para fixar LF como define o `.editorconfig`; a
execução seguinte passou em todas as etapas. Consulte o
[workflow hospedado](https://github.com/vrascode/fintrack-pro/actions/runs/40529548463).

Os testes extensos de autenticação, cálculos monetários, calendário, componentes,
estados visuais e documentação existente foram preservados sem duplicação. Busca,
filtros, CSV e otimização de listas ficam para depois do CRUD transacional. A API
oferece apenas saúde do processo, então não há fluxos para tratar ou documentar com
erros de negócio ou OpenAPI por enquanto. Confira o resultado de CI no GitHub antes
de exigir esse status na proteção da branch.

## Verified GitHub publication — 2026-10-27 / Publicação confirmada

The existing work was published to
`https://github.com/vrascode/fintrack-pro.git`, branch `main`, using the configured
Git identity and actual commit timestamps. Approved Git operations resolved the
earlier sandbox restrictions without changing filesystem permissions or deleting
a lock file. `git fetch origin` confirmed the original remote history; no merge,
history rewrite or force push was needed.

| Commit                                     | Message                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `baf942f9ae6b8541332c26f3e120e412c5575dcc` | `test(e2e): manage preview server lifecycle in global setup`         |
| `8299b9a9233d3300989846e5d3c2288daa79fe26` | `feat(auth): add password hashing and session security primitives`   |
| `30ac8c74a0ad3e1ca0f3bec44a301b1b365b61b7` | `chore(db): prepare PostgreSQL schema and integration harness`       |
| `ffeeaf0b283d5b5b67fe19f23a545d06e1e4ee1d` | `docs: describe implemented features and phase two validation gates` |

`git push origin main` succeeded (`86c0557..ffeeaf0`). A subsequent
`git ls-remote origin refs/heads/main` returned
`ffeeaf0b283d5b5b67fe19f23a545d06e1e4ee1d`, matching both HEAD and `origin/main`.
`git rev-list --left-right --count HEAD...origin/main` returned `0 0`, and
`git status --porcelain=v1` was empty before this publication-record update.
All 30 pending files were included: 21 additions and 9 modifications, no deletions.

Validation in this publication task: `npm.cmd run check` passed lint, strict types,
builds, all 27 local tests and formatting. Every staged diff passed
`git diff --cached --check`. Source/history pattern review covered 70 working files
and the 49 file contents of the original commit; all 15 flags were reviewed as
code, schema, documentation placeholders or test data. No real credential was
identified. Only the blank configuration template `.env.example` was included;
local environments, dependencies, caches and generated outputs remained ignored.

This task organized and published existing work. It did not add application
features, install dependencies, run database migrations or claim new database,
browser or native-device validation. The database and dependency-review limitations
remain open. This documentation update records the successful publication above.

O GitHub recebeu os quatro commits acima, cobrindo os 30 arquivos pendentes.
O hash remoto foi conferido diretamente e coincidiu com HEAD e `origin/main`, sem
divergência e com a árvore limpa antes desta atualização documental. Os 27 testes
locais passaram; nenhum segredo real foi identificado na revisão. A publicação
preservou o histórico e todas as alterações, sem mudar permissões globais ou
desenvolver funcionalidades. Banco, dependências e validação nativa seguem pendentes.

The records below describe earlier attempts and development checks; their Git
publication blockers and proposed commits are superseded by the verified result
above. / Os registros abaixo são históricos; seus bloqueios Git e commits propostos
foram superados pela publicação confirmada acima.

## Publication retry — 2026-10-27 / Nova tentativa de publicação

The latest request is limited to organizing and publishing existing work. The Git
root and branch were confirmed; both origin URLs are
`https://github.com/vrascode/fintrack-pro.git`. Review found 30 pending files:
9 modified, 21 new, none deleted. The existing staged `.env.example` was preserved.
The ignore rules exclude local environments, dependencies and generated outputs.
Pattern review of 70 working files and 49 historical file contents produced 15
flags, manually reviewed as code, schema, documentation placeholders and test data;
no actual credentials were identified. `npm.cmd run check` passed lint, types,
builds, all 27 tests and formatting. Both diff whitespace checks passed.

`git add -- playwright.config.ts scripts/serve.mjs e2e/setup.mjs` failed with
`.git/index.lock: Permission denied`; the lock file does not exist. The session
profile makes `.git` read-only and does not permit permission escalation.
`git fetch origin` failed opening `.git/FETCH_HEAD`. Both
`git ls-remote origin refs/heads/main` and `git push origin main` failed connecting
to GitHub port 443. No commit was created or published. HEAD and the cached
`origin/main` remain `86c055707d614bf6aeb919acdaa83c41f2ce4ba4`; this does not verify
the live remote. The scoped commit groups below still await a session allowing
Git metadata writes and GitHub access. No application source was changed in this retry.

A tentativa atual revisou os 30 arquivos pendentes e passou nas verificações locais,
incluindo 27 testes. As alterações e o staging anterior foram preservados. Não há
lock abandonado para remover: a gravação Git é bloqueada pelo perfil da sessão.
Fetch e push falharam; nenhum novo hash ou envio é declarado. É necessário retomar
com escrita em `.git` e acesso ao GitHub; esta sessão não permite elevar permissões.
Os registros de desenvolvimento abaixo descrevem as verificações anteriores.

## Current outcome / Resultado atual

Development continued inside `C:\Projetos\fintrack-pro` only. Existing E2E work
was preserved and validated. Phase 2 now has executable password/token/session
primitives, 13 additional local tests, a PostgreSQL/Prisma model, initial migration
and an integration suite that requires a real database. READMEs and operating docs
were updated in English and Brazilian Portuguese.

O desenvolvimento avançou somente no FinTrack Pro. O trabalho E2E anterior foi
preservado e validado. A fase 2 ganhou código de senhas/tokens/sessões, 13 testes
locais adicionais, modelo PostgreSQL/Prisma, migração e suíte para banco real.
READMEs e guias foram atualizados nos dois idiomas. Nenhum outro projeto foi alterado.

**Phase 2 is in progress, not complete.** The identity repository and HTTP auth
remain unimplemented; the database migration and integration suite have not run
against PostgreSQL. No mock persistence, generated lock entries or passing
integration result was substituted for unavailable infrastructure.

**Fase 2 em andamento, sem aceite.** Repositório transacional e autenticação HTTP
seguem pendentes. Migração e integração não foram executadas no PostgreSQL.
Não houve substituição por mocks, lockfile inventado ou aprovação fictícia.

## Delivered code / Código entregue

- Preserved `playwright.config.ts`, `scripts/serve.mjs`, `e2e/setup.mjs` and existing
  foundation behavior; verified all eight browser scenarios.
- Added strict registration/login contracts, normalized email, preserved passwords
  with 15–128 Unicode code points and rejection of malformed surrogate input.
- Implemented asynchronous scrypt with random salts, fixed work factors, constant-time
  verification, missing-user derivation and bounded concurrent memory use.
- Implemented random opaque tokens separated by purpose and persisted as digests.
  Session transitions cover exact expiration boundaries, idle/absolute limits,
  rotation, consumed-token replay and idempotent device revocation.
- Added Prisma 7 configuration/schema and `202610270001_identity/migration.sql`
  with users, sessions, refresh/action tokens, foreign keys, uniqueness and CHECKs.
  These are source artifacts awaiting Prisma/PostgreSQL validation and Git staging.
- Added separate loopback development/test PostgreSQL services and database commands.
  The integration command rejects unsafe targets, requires installed dependencies,
  reapplies migrations without reset and has no mock/skip fallback.
- Wrote real-database tests for persistence across reconnects, constraints, concurrent
  token consumption, rollback and cascade deletion. These tests remain **unexecuted**.
- Fixed `typecheck` so API declarations are built before test typechecking.
- Reworked bilingual READMEs, database/security/development guides, architecture and
  phase 2 acceptance criteria; retained the previous progress snapshot below.

Implementados contratos, derivação de senhas, tokens e transições de sessão, além
da preparação do banco e da suíte real. O `typecheck` deixou de depender de um build
anterior. Persistência/autenticação integradas não são declaradas concluídas.

## Validation — 2026-10-27 / Validação

Environment / Ambiente: Node `v24.20.0`, npm `11.19.0`, Windows PowerShell.
Used `npm.cmd` and `npx.cmd` without changing execution policy. Existing installed
dependencies were used; `npm ci` was not run while the registry was inaccessible.

| Command / Comando                                                                                                                                     | Actual result / Resultado real                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run check` — baseline                                                                                                                        | Passed: lint, types/build, 14 tests, formatting / Aprovado                                                                                                                                                             |
| `npm.cmd run check` — database preparation                                                                                                            | Passed: 15 tests plus lint/types/formatting / Aprovado                                                                                                                                                                 |
| `npm.cmd run check` — first identity pass                                                                                                             | Failed: new API declaration files did not exist before test typecheck; corrected build order / Falha de ordem de build corrigida                                                                                       |
| `npm.cmd run check` — after correction and documentation                                                                                              | Passed: zero lint warnings, strict types, builds, **27/27 tests**, formatting; zero skipped / Aprovado                                                                                                                 |
| `npm.cmd run bundle` — final source                                                                                                                   | Android, iOS and web exports passed / Três exports aprovados                                                                                                                                                           |
| `npm.cmd run test:e2e` — final bundle                                                                                                                 | **8/8 passed**, headless Edge, desktop/mobile viewports / Aprovado                                                                                                                                                     |
| `npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000`                                                                                        | Exit 1: npm advisory connection failed; no fresh audit / Falha de conexão                                                                                                                                              |
| `npm.cmd view prisma version --fetch-retries=0 --fetch-timeout=10000`                                                                                 | EACCES fetching registry metadata / Metadados indisponíveis                                                                                                                                                            |
| `npm.cmd install --workspace @fintrack/api @prisma/client@7 @prisma/adapter-pg@7 --fetch-retries=0 --fetch-timeout=10000 --ignore-scripts --no-audit` | Exit 1: EACCES; no manifest/lockfile dependency change / Instalação bloqueada                                                                                                                                          |
| `npm.cmd run db:validate`                                                                                                                             | Exit 1: missing `DATABASE_URL`; Prisma validation did not run / Validação não executada                                                                                                                                |
| `npm.cmd run test:integration` — no environment                                                                                                       | Exit 1: explicit test URL required / Sem configuração de teste                                                                                                                                                         |
| `npm.cmd run test:integration` — credential-free loopback test URL                                                                                    | Build passed, then exit 1: Prisma dependencies absent; **no database test ran** / Nenhum teste de banco executado                                                                                                      |
| `npm.cmd ls multer node-forge zod --all`                                                                                                              | Existing multer 2.5.0 override, forge 1.4.0, CLI Zod 3.25.76, shared Zod 4.6.7 confirmed                                                                                                                               |
| `git diff --check`                                                                                                                                    | Passed / Aprovado                                                                                                                                                                                                      |
| `node .cache/review-sensitive.mjs`                                                                                                                    | 70 working files + 49 historical file contents inspected; 15 heuristic flags manually reviewed as code, schema, placeholder URL and reserved test emails; no actual credential identified / Revisão manual dos alertas |
| `git ls-remote origin refs/heads/main`                                                                                                                | Failed to connect to GitHub port 443 / Falha de conexão                                                                                                                                                                |
| `git add -- playwright.config.ts scripts/serve.mjs e2e/setup.mjs`                                                                                     | Failed: `.git/index.lock`: Permission denied / Staging bloqueado                                                                                                                                                       |

For the second integration attempt, `TEST_DATABASE_URL` was temporarily set to
`postgresql://127.0.0.1:5433/fintrack_test`, without credentials, solely to verify
that missing dependencies fail explicitly. No connection or integration was claimed.

A URL local sem credenciais foi usada apenas para confirmar a falha explícita de
pré-requisitos; nenhuma conexão foi estabelecida. A revisão por padrões não equivale
a scanner de segredos especializado. Bundles/navegador não validam aparelhos nativos.

Bundle environment / Ambiente dos exports:

```powershell
$env:EXPO_OFFLINE = '1'
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:TEMP = Join-Path (Get-Location) '.cache'
$env:TMP = $env:TEMP
npm.cmd run bundle
npm.cmd run test:e2e
```

## Blockers and dependency review / Bloqueios e dependências

1. The permission profile makes `.git` read-only. Staging failed, so no new commit
   exists. No alternate Git directory, permission bypass or history rewrite was used.
2. Shell access to GitHub/npm failed. The cached `origin/main` equals HEAD (0 ahead,
   0 behind), but remote freshness could not be established. No push was attempted
   after staging and connectivity failed.
3. Docker, Podman, psql, postgres and initdb are unavailable on PATH. No database
   environment variables were supplied. Prisma packages are not installed or cached.
4. Fresh npm audit is unavailable. Advisory pages were separately checked through
   the web tool: the existing multer version meets its patch; node-forge has no
   patch listed; the Zod 3 dependency in Expo remains affected. See [SECURITY.md](SECURITY.md).
   No incompatible override, downgrade or unverified dependency fix was introduced.

O perfil bloqueia escrita em `.git`; conexões npm/GitHub falharam no terminal.
Sem runtime PostgreSQL nem Prisma, a validação real permanece pendente. A consulta
aos avisos públicos não substitui auditoria npm. O trabalho independente avançou
apesar desses bloqueios e o lockfile foi preservado.

## Pending commits / Commits pendentes

Only the original commit `86c0557` (`chore: initialize FinTrack Pro project`) exists.
No new commit or push occurred. These are **proposed groups**, not executed history:

1. `test(e2e): manage preview server lifecycle in global setup`
   — existing Playwright config, preview server and E2E setup.
2. `feat(auth): add password hashing and session security primitives`
   — identity contracts, password/tokens/sessions, local tests, typecheck build-order fix.
3. `chore(db): prepare PostgreSQL schema and integration harness`
   — Compose, Prisma config/schema/migration, database scripts/tests, environment
   example and generated-code lint ignore. Apply the relevant package script hunks
   separately from group 2. Validate with real Prisma/PostgreSQL before accepting it.
4. `docs: describe implemented features and phase two validation gates`
   — READMEs, architecture, database/security/development guides, roadmap and progress.

Nenhum commit foi fabricado. O agrupamento acima serve à próxima sessão com escrita
Git disponível; selecione os hunks de `package.json` por finalidade e valide cada
commit antes do push autorizado para `origin/main`, sem force push.

## Next concrete action / Próxima ação concreta

Restore Git writes and npm/GitHub connectivity; install matching Prisma 7 packages
and produce the real lockfile. Provision the isolated PostgreSQL services using
[DATABASE.md](DATABASE.md), validate/generate Prisma and run migration/integration
checks. Then implement the transactional identity repository and HTTP flows with
ownership, throttling and concurrency tests, followed by email and native storage.
Resolve the dependency review, make scoped validated commits and push without force.

Restabelecer escrita Git e conectividade, instalar Prisma e validar migrações com
PostgreSQL real. Depois implementar repositório transacional, fluxos HTTP, email,
SecureStore e biometria. Não avançar à fase 3 nem encerrar a fase 2 antes de cumprir
seus critérios. O aceite completo está em [ROADMAP.md](ROADMAP.md).

<details>
<summary>Historical snapshot — 2026-10-26 / Registro histórico preservado</summary>

The following is the previous session's record, not the current status.
/ O conteúdo abaixo registra a sessão anterior, não o estado atual.

# FinTrack Pro progress / Progresso

Updated / Atualizado: 2026-10-26

## Scope / Escopo

Work is restricted to `C:\Projetos\fintrack-pro`. This is now an independent Git
repository on `main`, with `origin` pointing to
`https://github.com/vrascode/fintrack-pro.git`. The current user instruction
explicitly authorizes real commits grouped by functionality and validated pushes
to `origin/main`. It prohibits history rewriting, force push and modifications to
Nubank or other directories. The earlier five-project prompt is not inferred.

O trabalho está restrito ao FinTrack Pro, repositório independente na branch
`main`. A instrução atual autoriza commits e push após validação. Nenhum arquivo
de outro projeto foi alterado; não houve reescrita de histórico ou force push.

## Milestones / Marcos

| Milestone / Marco                                                           | Status / Estado                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| F00: inspection, configuration, research, roadmap / inspeção e planejamento | Existing research preserved; repository state and roadmap updated / Pesquisa preservada; estado e roteiro atualizados |
| F01: shared domain and NestJS foundation / domínio e API                    | Local validation passed / Validação local aprovada                                                                    |
| F02: mobile navigation and design system / navegação e design system        | Bundles and browser checks passed; native device checks pending / Bundles e navegador aprovados; aparelho pendente    |
| F03: validation and bilingual handoff / validação e documentação bilíngue   | Documentation updated; commit/publication blocked / Documentação atualizada; commit/publicação bloqueados             |
| Phase 2: PostgreSQL and identity / PostgreSQL e identidade                  | Pending infrastructure, dependencies and integration tests / Infraestrutura, dependências e integração pendentes      |

Phase 1 has passed its local functional checks; publication and dependency
security review remain open. Phase 2 has not been declared implemented, and later
phases have not been started out of order.

A fase 1 passou nas verificações funcionais locais. A publicação e a revisão de
segurança das dependências seguem abertas. A fase 2 não foi declarada entregue,
e as fases posteriores não foram antecipadas.

## Reviewed changes / Alterações revisadas

All nine initially changed/untracked files belonged to FinTrack Pro: Playwright
configuration, preview server lifecycle, global E2E setup, root READMEs, database
and security notes, and English/Portuguese development guides.

- Validated the existing preview-server refactor: Playwright starts a loopback
  server in global setup, waits for listening and closes it after the run. Direct
  `node scripts/serve.mjs` execution remains supported.
- Fixed Prettier failures in `e2e/setup.mjs` and `scripts/serve.mjs`.
- Corrected obsolete parent-repository and push-authorization statements in the
  documentation; documented actual validation, security and infrastructure limits.
- Preserved existing navigation, themes, local privacy preferences, storage-error
  recovery, exact money/calendar primitives and HTTP process-health functionality.
  No new authentication or financial operations are claimed.

As nove alterações iniciais pertencem ao projeto. O ciclo de vida do servidor E2E
foi validado, duas falhas de formatação foram corrigidas e a documentação bilíngue
foi atualizada. As funcionalidades existentes foram verificadas; autenticação e
operações financeiras continuam pendentes.

## Validation — 2026-10-26 / Validação

Environment: Node `v24.20.0`, npm `11.19.0`, Windows PowerShell. `npm.cmd` and
`npx.cmd` were used without changing the execution policy. Existing installed
dependencies were used; `npm ci` was not run under the network restriction.

| Command / Comando                                                                                                                                      | Result / Resultado                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run check` (initial / inicial)                                                                                                                | Lint, typecheck, build and 14 tests passed; Prettier failed in two files / Lint, tipos, build e 14 testes aprovados; duas falhas de formatação |
| `npx.cmd --no-install prettier --write e2e/setup.mjs scripts/serve.mjs`                                                                                | Both formatting failures corrected / Duas falhas corrigidas                                                                                    |
| `npm.cmd run check` (after correction / após correção)                                                                                                 | Passed: ESLint with zero warnings, strict TypeScript, shared/API builds, 14/14 tests and Prettier / Aprovado                                   |
| `npm.cmd run bundle`                                                                                                                                   | Android, iOS and web exports passed / Três exports aprovados                                                                                   |
| `npm.cmd run test:e2e`                                                                                                                                 | 8/8 passed in headless Edge, desktop and mobile viewports / Oito aprovados                                                                     |
| `npm.cmd ls multer node-forge zod --all`                                                                                                               | Installed multer 2.5.0, node-forge 1.4.0, CLI Zod 3.25.76, application Zod 4.6.7 / Versões instaladas conferidas                               |
| `npm.cmd audit --json`                                                                                                                                 | Failed to reach npm advisory endpoint; no current audit result / Falha de conexão; auditoria não aprovada                                      |
| `node .cache/review-sensitive.mjs`                                                                                                                     | Pattern scan passed: 56 current files and 49 file contents in the existing commit; no findings / Sem ocorrências                               |
| `git diff --check`                                                                                                                                     | Passed / Aprovado                                                                                                                              |
| `git check-ignore .env .env.production .cache/review-sensitive.mjs node_modules/ apps/api/dist/ apps/mobile/dist/ packages/shared/dist/ test-results/` | All listed private/generated paths ignored; `.env.example` separately verified as not ignored / Exclusões conferidas                           |
| `git ls-remote --heads origin main`                                                                                                                    | Failed to connect to github.com:443 / Falha de conexão                                                                                         |
| `git add -- playwright.config.ts scripts/serve.mjs e2e/setup.mjs`                                                                                      | Failed: `.git/index.lock`: Permission denied / Gravação no Git negada                                                                          |

Bundle environment (PowerShell, project root) / Ambiente do bundle:

```powershell
$env:EXPO_OFFLINE = '1'
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:TEMP = Join-Path (Get-Location) '.cache'
$env:TMP = $env:TEMP
npm.cmd run bundle
```

Tests cover money precision and limits, calendar boundaries and timezones, HTTP
health responses, real disk preference persistence, concurrent updates, corruption
and read/write failures. Browser checks cover navigation/empty states, theme and
privacy persistence, corruption recovery, and quota failure. Browser viewports and
exports do not verify native runtime behavior, biometrics or release signing.

Os testes cobrem precisão monetária, limites de datas/fusos, HTTP, persistência
real em disco, concorrência nas preferências e falhas de armazenamento. No
navegador: navegação, estados vazios, persistência, corrupção e falta de espaço.
Não houve validação nativa em aparelho, de biometria ou assinatura de release.

## Security and publication blockers / Bloqueios de segurança e publicação

1. Git metadata is read-only under the current permission profile. The first
   scoped staging attempt failed before a commit could be created. No permission
   bypass, alternate Git directory or fabricated commit was used.
2. GitHub and npm registry connections failed. The local `origin/main` reference
   equals `HEAD`, but remote freshness could not be verified. No push was attempted
   after the security/connectivity blockers were established.
3. A prior local dependency report contains eight high findings before the multer
   override. Existing notes report five remaining findings after that change;
   a fresh audit could not confirm remediation. Publication remains suspended.
4. Docker, Podman, psql, postgres and initdb are unavailable on PATH. Prisma,
   SecureStore and biometric packages are not installed. Phase 2 requires real
   database integration, email flows and device validation; mocks do not complete it.

O perfil atual impede gravar em `.git`; a tentativa de staging falhou. GitHub e
registro npm estão inacessíveis, e a auditoria de dependências permanece aberta.
Não foram identificados segredos ou dados pessoais nos arquivos revisados; essa
inspeção por padrões e revisão manual não garante ausência absoluta de segredos
nem substitui scanner especializado. Consulte [SECURITY.md](SECURITY.md).
A fase 2 exige infraestrutura e dependências ainda indisponíveis.

## Commits / Commits

No new commits were created or pushed. The sole existing commit is `86c0557`
(`chore: initialize FinTrack Pro project`). The working changes remain intact.

Nenhum commit novo foi criado ou enviado. O único commit existente é `86c0557`.
As alterações permanecem preservadas no diretório de trabalho, sem staging.

Prepared grouping for a future writable Git session; these are proposed messages,
not real commit identifiers / Agrupamento preparado, ainda não executado:

1. `test(e2e): manage preview server lifecycle in global setup`
   — `playwright.config.ts`, `scripts/serve.mjs`, `e2e/setup.mjs`.
2. `docs: document foundation setup and security boundaries`
   — `README.md`, `README.pt-BR.md`, `DATABASE.md`, `SECURITY.md`,
   `docs/en-US/DEVELOPMENT.md`, `docs/pt-BR/DEVELOPMENT.md`.
3. `docs: record foundation validation and publication blockers`
   — `ROADMAP.md`, `PORTFOLIO_PROGRESS.md`.

## Next action / Próxima ação

Resume in a session with Git metadata writes and GitHub/npm connectivity allowed.
Review a fresh dependency audit and resolve the publication gate. Recheck the diff
and remote state, make the scoped real commits with the configured identity and
actual timestamps, then push without force. Continue phase 2 in roadmap order with
a real PostgreSQL runtime, Prisma migrations, identity/email/session flows and
native secure-storage/biometric validation before declaring that phase complete.

Retomar com gravação de metadados Git e conexão GitHub/npm disponíveis. Refazer a
auditoria, resolver o bloqueio de publicação, revisar o remoto e criar/enviar os
commits reais separados. Depois, seguir a fase 2 com PostgreSQL e testes reais,
sem antecipar fases nem declarar funcionalidades não implementadas.

</details>

## Ledger foundation update — 2026-10-29

Installed and locked Prisma CLI, client and PostgreSQL adapter at 7.10.1. The
database command now resolves Prisma 7 through its explicit CLI package subpath.
Extended the Prisma schema and added a versioned migration for owner-scoped
accounts, categories and ledger transactions. Amounts use `BIGINT` cents,
account balances are intended to be derived from entries, composite foreign keys
bind financial records to their owner, and transaction idempotency is unique per
user. Added a real-PostgreSQL integration suite for amount persistence, ownership,
idempotency and invalid transfers. This is schema groundwork; there are no financial
routes, repositories, balance services or mobile flows yet.

Validation: Prisma schema validation and client generation passed. After compatible
dependency updates, `npm run check` passed lint, types, build, 27/27 local tests and
formatting; Android/iOS/web export and 8/8 browser E2E tests also passed. The earlier
`npm run test:integration` built and generated the client, then failed with PostgreSQL
`P1001` because no server is available at `127.0.0.1:5433`; migration application and
integration assertions did not run. Docker/PostgreSQL tooling and the development
database are unavailable.

Dependency review: `npm audit fix` updated compatible packages and removed the
`node-forge` advisory. Its resulting report still lists eight Expo tooling findings
(three high, five low); resolving them automatically would downgrade Expo to 54.0.38,
so that breaking change was not applied. A later direct audit request could not reach
the registry. See [SECURITY.md](SECURITY.md).

Files changed: `apps/api/package.json`, `apps/api/prisma/schema.prisma`,
`apps/api/prisma/migrations/202610290001_ledger/migration.sql`,
`scripts/database.mjs`, `tests/integration/ledger.test.mjs`, `package.json`,
`package-lock.json`, `DATABASE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `README.md`,
`README.pt-BR.md` and `SECURITY.md`. Published in commit
`5872d9fa9cee9c28be83f1bebe351de3c8b7e576`; `main` and `origin/main` were verified
synchronized. The PostgreSQL integration gate remains open. Next priority: run both
migrations and the integration suites against real PostgreSQL, then implement the
authenticated repository/API flow without introducing mock persistence.

## Local PostgreSQL availability check — 2026-10-29

At the start of the next integration task, `main` was clean at
`5872d9fa9cee9c28be83f1bebe351de3c8b7e576`. `docker`, `podman`, `psql`, `postgres`,
`pg_ctl` and `initdb` are unavailable; Docker Desktop and PostgreSQL install paths
were not found; WSL reports that it is not installed; both expected TCP ports are
closed. The Windows `winget.exe` app execution alias could not be run in this
environment. No existing database was altered.

Created a local `.env` with cryptographically random, distinct development and test
passwords, loopback URLs, and the expected database names. Verified the file is
ignored by Git without printing its values. Compose already keeps both services on
loopback, uses a persistent named development volume and ephemeral test storage.
No service was started and no migration was applied because a PostgreSQL runtime is
not installed. The remaining blocker is authorization to install WSL/Docker Desktop
(which can require administrator privileges and a restart) or native PostgreSQL.

## Fictional finance experience — 2026-10-29

Implemented an opt-in demo path from the empty dashboard. The deterministic
October 20, 2026 snapshot shows R$ 5,000 planned/received income, R$ 4,200
budgeted expense, R$ 3,660 posted expense, R$ 540 remaining obligations
(including R$ 100 overdue), R$ 7,340 current account balance and R$ 6,800
projected month-end balance. These values come from one six-month fictional
dataset with a dated R$ 2,000 opening balance. The R$ 800 planned monthly
surplus is clearly distinguished from available cash. Suggested goal allocations
are R$ 500 emergency reserve, R$ 200 personal goal and R$ 100 buffer; no automatic
cash movement is performed.

The local demo now supports account balance views, income/expense/transfer entry,
activity search and kind filters, safe filtered CSV export, partial or full
fictional bill payment, virtual envelope contributions/withdrawals, and an
unsaved what-if simulator. Demo persistence is isolated under `fintrack.demo.v1`;
tests verify unrelated keys survive restore. Localized input and exact currency
formatting avoid floating-point money conversion. An original SVG orange identity,
generated app/adaptive/monochrome/web icons, PWA manifest, social artwork, splash,
Expo config and EAS preview APK profile were added. Portuguese translations and
demo labels are now correctly encoded/localized.

### Validation

- `npm run check`: passed lint, strict type checks, builds, 46 unit tests and Prettier.
- `npm run bundle`: passed web, Android and iOS Expo exports after the final app routes.
- `npm run test:e2e`: passed 6/6 desktop/mobile tests, including demo entry, balance
  changes, bill payment, CSV download, envelope contribution, theme/language/privacy,
  and horizontal overflow checks.
- APK: not built. EAS preview config is present, but an authenticated Expo project
  link/build is still required. Icon changes need a new native build and reinstall.
- PostgreSQL integration and real-user persistence: still blocked/unimplemented;
  demo behavior must not be represented as real server-backed finance.

Next priorities: provision PostgreSQL and apply the migrations safely; implement
authenticated owner-scoped repositories and financial API routes; then connect
the app to real accounts and transactions. Cards, recurring billing, notifications,
budget editing, full reports, native-device verification and release signing remain
open. The 11 commits available at the first publication checkpoint were pushed
individually to `https://github.com/vrascode/fintrack-pro.git` on its default
branch `main`, authored as `matheussulino12@gmail.com`. GitHub reported
`195b1d218455014cee2a6aa89cdf03e4fbfb5229`; the local branch and `origin/main`
matched with a clean worktree. A follow-up documentation commit records this
publication check and is published separately.

## Expense color contrast — 2026-10-30

Replaced salmon expense and negative-state colors with a vivid red scale in both
themes. Financial text uses solid colors with WCAG AA contrast on relevant
surfaces; expense bars use a platform-neutral red gradient. Income green and the
orange brand remain unchanged. This presentation-only change does not alter
financial calculations.

Validation: `npm run check` passed (lint, builds, type checks, 49 unit tests and
formatting); `npm run bundle` exported web, Android and iOS; `npm run test:e2e`
passed 6/6 desktop and mobile tests. The generated desktop screenshot was reviewed.

## Brand orange and demo banner — 2026-10-30

Updated the orange identity token to `#C84A01` across both themes, navigation,
financial highlights, demo banner borders, browser theme metadata, PWA metadata,
and the source/generated brand assets. The dashboard, accounts, and activity
fictional-data banners now use the orange identity; unrelated amber warnings
remain unchanged. Orange text uses accessible theme-specific shades where the
exact brand color would not provide sufficient contrast. Income green and
financial calculations are unchanged in this stage.

Validation: `npm run check` passed with 50 unit tests; `npm run bundle` exported
web, Android and iOS; `npm run test:e2e` passed 6/6 desktop and mobile tests;
`npm run brand:assets` regenerated icons successfully. The desktop dashboard and
generated app icon were visually reviewed. Next: update the positive green palette.

## Positive green palette — 2026-10-30

Changed the principal positive token to `#22C55E` in both themes and applied it
to income bars, planned surplus, and positive indicators. Added a darker light
theme text variant for income values, transaction totals, success messages, and
other small text; dark mode retains the requested main green. Financial rules
and calculations are unchanged.

Validation: `npm run check` passed (lint, builds, type checks, 50 unit tests and
formatting); `npm run bundle` exported web, Android and iOS; `npm run test:e2e`
passed 6/6 desktop and mobile tests. The generated desktop dashboard screenshot
was reviewed.

## Orange, white and neutral financial interface — 2026-10-30

Replaced traffic-light financial emphasis with orange, white and neutral tokens.
Income remains identifiable by its plus sign, localized entry label and arrow;
expenses use a minus sign, exit label and a neutral chart series. Charts use
orange/white in dark mode and orange/graphite in light mode, with a shape-based
legend. Overdue bills have an attention mark and orange border; inline errors
and success messages include symbols and explicit text. Demo envelope accents
are orange. Amounts, calculations, demo isolation and external artwork are unchanged.

Validation: `npm run check` passed with 51 unit tests; `npm run bundle` exported
web, Android and iOS; `npm run test:e2e` passed 8/8 desktop and mobile tests,
including computed income/expense series colors in both themes. The light
dashboard screenshot was reviewed.

### Persistence readiness remains blocked

`npm run test:integration` validated the Prisma schema and generated Prisma
Client, then failed before applying migrations with PostgreSQL `P1001` at
`127.0.0.1:5433`. Both database ports are closed; Docker and PostgreSQL commands
are unavailable. The API currently exposes process health only; authentication
primitives and financial schema are not HTTP persistence. Demo records remain
device-local and must not be presented as server-backed data. Next: authorize or
provision a local PostgreSQL runtime, apply migrations non-destructively, pass
the real integration suite, then implement authenticated repositories and
owner-scoped financial endpoints before connecting mobile CRUD.
