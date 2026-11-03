# Validation and remaining gates — 2026-10-31

## Current result / Resultado atual

The personal installation is **not accepted as functional**. Both configured
PostgreSQL connections reject authentication (`28P01`, mapped by Prisma to
`P1000`). Services PostgreSQL 17 and 18 are running; no administrative password
or HBA was changed. Existing databases and pre-existing working-tree changes
were preserved. Do not infer the server version on 5432/5433 from service names.

A instalação pessoal **não está aprovada como funcional**. A API e o Expo foram
iniciados em 3000/8081. Saúde do processo responde 200; prontidão e login respondem
503 porque o banco rejeita as credenciais. CORS permite `http://localhost:8081`.
Nenhuma senha administrativa foi redefinida e nenhum HBA foi alterado.

## Implemented changes / Alterações

- `npm.cmd run doctor` reports safe database targets and actionable errors.
- `npm.cmd run dev` builds, checks database authentication/tables, waits for API
  readiness and launches Expo in its actual workspace. It refuses duplicate web
  listeners and preserves existing API processes. PostgreSQL must already run;
  this command never starts or changes Windows services implicitly.
- Five-second database connection and fifteen-second HTTP request bounds.
- Development web API URLs preserve the page's loopback hostname for SameSite
  cookies. Android emulator defaults to 10.0.2.2; physical devices still require
  an explicit LAN API URL, API HOST binding and allowed CORS origin.
- Existing session rotation now serves `/v1/auth/refresh` and identity `/auth/me`.
  SecureStore grants renew on native hydration; browser refresh stays HttpOnly.
  Concurrent requests share renewal, reuse newer grants and retry once with the
  same idempotency key. Rejected renewal clears authentication. Failed remote
  logout retains the session and reports the failure for retry.
- Login/register use an authentication-only lime/graphite theme scope over the
  existing theme system, confirmation, show/hide password, loading, transitions,
  keyboard submission, bilingual messages and persisted theme/language controls.
- Authentication endpoints limit bursts to 30 requests/minute/IP in one process.
  Shared multi-instance limiting and trusted-proxy configuration remain open.
- Database exceptions return safe 503 responses; raw SQL, URLs and driver error
  payloads are omitted from application logs/responses.
- Account PATCH supports owner-scoped metadata and archive/reactivation without
  rewriting opening balances. Archived accounts remain in history/totals and are
  excluded from new transaction selectors. Entries still require active accounts.
- Personal activity now reads server history with description/date filters.
  API search and transaction detail enforce authenticated ownership.
- CI source adds real PostgreSQL 17 integration with a dedicated unprivileged
  role and ephemeral random application credentials. Remote execution pending.

As mudanças reutilizam autenticação, schema, quatro migrações e domínio monetário
existentes. Não houve migração nova desnecessária, reset, db push ou dados fictícios
inseridos nas contas pessoais. Arquivamento preserva patrimônio e histórico.

## Validation evidence / Evidências

- `npm.cmd run check`: passed lint, typecheck, builds, **89 tests**, formatting.
- `npm.cmd run db:validate`: schema valid; Prisma Client 7.10.1 generated in builds.
- `npm.cmd run bundle`: web, Android and iOS exports passed; no APK/device test.
- `npm.cmd run test:e2e`: final **14/14 passed**, including login confirmation,
  unavailable-API feedback and persisted authentication theme/language preferences.
- Before permission restrictions changed, `npm.cmd run test:e2e:isolated` passed:
  PostgreSQL **17.11**, four migrations applied, redeploy was a no-op, nine SQL
  tests and two desktop/mobile real financial browser cases passed. They verified
  registration, password hashing, login, 1,000 BRL opening + 500 income − 200
  expense = 1,300 BRL, reload, API restart, logout/login, ownership and idempotency.
- After additional account/UI/security changes, the isolated repeat could not
  start PostgreSQL in the restricted execution environment. Newly expanded real
  scenarios (expired-access renewal, archive, rename and filtered history) remain
  **unverified against SQL**. Unit coverage is not a substitute for this gate.
- `node scripts/doctor.mjs`: failed correctly on both 5432 and 5433 with 28P01.
- Live HTTP: process health 200, readiness 503, login 503 with allowed CORS origin.
- Live browser on localhost:8081 submitted to localhost:3000 and displayed the
  distinct database-unavailable error after the real 503 response. Screenshot
  reviewed locally. An initial inline probe failed because PowerShell stdin
  encoding replaced accented assertion text; an ASCII-regex repeat passed.

## Git and publication / Git e publicação

Four commits were created and pushed to origin/main in this task:

| Hash    | Message                                                         |
| ------- | --------------------------------------------------------------- |
| 175fe6e | fix(dev): diagnose PostgreSQL and orchestrate local services    |
| 20e9791 | fix(api): bound connection waits and preserve same-site cookies |
| 8f882c2 | feat(auth): expose current identity and native refresh grants   |
| 22f7e30 | fix(auth): renew expired grants and validate restored sessions  |

Later Git writes failed creating `.git/index.lock` with permission denied; the
current execution policy disallows requesting elevation. Remaining changes are
local and uncommitted. Do not claim the worktree is synchronized with GitHub.
GitHub CLI's workflow lookup was blocked by network permissions; connected status
lookup returned no status entries, which does not establish a passing Actions run.

A meta de 20–30 commits não foi atingida. Funcionalidades prontas foram reutilizadas,
e as permissões interromperam os commits incrementais. Não foi fabricado histórico.

## Next actions / Próximas ações

1. Set valid application credentials in ignored `.env` without sending passwords
   in chat. Provision separately with `node scripts/setup-local-postgres.mjs
--development` and `--test` in an interactive terminal. Reconcile an existing
   dedicated application role only deliberately; do not reset admin credentials.
2. Run doctor, `npm.cmd run db:migrate`, `npm.cmd run db:status`, integration and
   updated real E2E. Confirm readiness 200 before accepting personal registration.
3. Validate the whole personal browser workflow, then Android on an actual device.
4. With Git writes restored, review and commit the remaining coherent units from
   `implementation-plan.md`, preserving unrelated recovery edits, then push and
   inspect both Actions jobs. No force push or historical date changes.

Email verification/recovery delivery, distributed limiting, deployment TLS,
dependency review, signed native releases and broader billing/planning lifecycle
remain outside acceptance of the minimal personal finance workflow.
