# Validation / Validação — 2026-11-02

## Outcome / Resultado

Real registration, login, session restoration, refresh, logout and financial
dashboard persistence **passed on the main PostgreSQL database**, using headless
Microsoft Edge and synthetic users. The final smoke used Expo at
`http://localhost:8081` and the corrected API at `http://127.0.0.1:3000/v1`.
An earlier complete run also passed on 8084/3107. This is local development
acceptance; native-device execution and production deployment are not claimed.
The final 3000/8081 services remain running; only the alternative 3107/8084
processes created during this repair were stopped.

Cadastro, login, sessão e dashboard reais passaram no PostgreSQL principal.
Git/publicação e o banco de testes continuam bloqueados, conforme evidências abaixo.

## Causes and fixes / Causas e correções

1. The previous `webOrigins()` default authorized only 8081 (plus the preview
   origin); Expo 8083 preflight returned 204 without allow-origin. Authentication
   also rejected that Origin. A shared exact-origin policy now covers both layers,
   permits trusted development loopback hosts on dynamic ports and keeps production
   restricted to explicitly configured origins.
2. Expo commands launched inside the mobile workspace did not read the monorepo
   root `.env`. The new launcher forwards only the public API URL. Root npm `web`
   and `mobile` commands now call it directly, preserving forwarded port arguments
   that the nested npm invocation previously stripped.
3. Central API URL resolution preserves browser same-site cookies and distinguishes
   Android emulator, iOS simulator, Expo LAN and explicit remote endpoints. HTTP
   transport distinguishes bad configuration, connection failures, validation,
   credentials, duplicate email, origin rejection, throttling and server failure.
4. The installed Prisma pg adapter serialized timestamps without their UTC offset
   under the server's São Paulo timezone. A synthetic session was stored three
   hours ahead and failed SQL expiry checks. Application pool startup now pins UTC,
   preserving the existing server timezone and historical rows. Fresh-session SQL
   timestamps match the actual instant, and forced access expiry/refresh passed.
   Old timestamps were not bulk-repaired; signing in again may be required for
   sessions created under the earlier adapter behavior.

## Files in this repair / Arquivos desta correção

Pre-existing unrelated edits remain in the working tree and are not presented as
new work from this repair. The following files contain repair changes:

| Area / Área      | Files / Arquivos                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS             | `apps/api/src/config/cors.ts`, `apps/api/src/app.ts`, `apps/api/src/identity/web-session.ts`, `tests/cors.test.mjs`                                                                                         |
| Database time    | `apps/api/src/database/adapter.ts`, `prisma.service.ts`, `tests/integration/database-timezone.test.mjs`, adapter wiring in `identity.test.mjs` and `ledger.test.mjs`, `scripts/database.mjs`                |
| HTTP/network     | `apps/mobile/src/api/client.ts`, `url.ts`, `transport.ts`, `apps/mobile/src/auth/core.ts`, error feedback in `apps/mobile/app/login.tsx`, `tests/api-url.test.ts`, `tests/http-client.test.ts`              |
| Expo/environment | `scripts/expo.mjs`, `apps/mobile/package.json`, root `package.json`, `.env.example`, `tests/expo-environment.test.mjs`                                                                                      |
| Real validation  | `scripts/validate-local-auth.mjs`, version/diagnostics changes in `scripts/test-isolated-postgres.mjs`                                                                                                      |
| Browser/CI       | `e2e/fixtures.ts`, fixture imports in `foundation.spec.ts`, HTTP feedback in `onboarding.spec.ts`, fixture URL in `.github/workflows/ci.yml`                                                                |
| Documentation    | `README.md`, `README.pt-BR.md`, `DATABASE.md`, `PORTFOLIO_PROGRESS.md`, `COMMITS.md`, `docs/communication-repair-plan.md`, `docs/local-development.md`, `docs/postgresql-local-credentials.md`, this report |

## Executed checks / Verificações executadas

| Command / Comando                                                                                                       | Actual result / Resultado real                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run build`                                                                                                     | Passed, shared package and Nest API; Prisma client generated                                                                                                        |
| `npm.cmd run lint`                                                                                                      | Passed with zero warnings                                                                                                                                           |
| `npm.cmd run typecheck`                                                                                                 | Passed API/shared builds and mobile/test TypeScript checks                                                                                                          |
| `npm.cmd test`                                                                                                          | **102 passed**, 0 failed, 0 skipped in the final full run                                                                                                           |
| Focused CORS/HTTP/auth/URL/environment commands                                                                         | Passed; covered production allowlist, denied origins, credentials, OPTIONS, invalid local input and bounded refresh retry                                           |
| `npm.cmd run bundle`                                                                                                    | Passed web, Android and iOS exports; final UI fixture export supplied `EXPO_PUBLIC_API_URL=https://api.example.test/v1`                                             |
| `npm.cmd run test:e2e`                                                                                                  | **24 passed** on desktop/mobile browser viewports; API requests intercepted, no real accounts created by this suite                                                 |
| `node scripts/validate-local-auth.mjs --api http://127.0.0.1:3000/v1 --web http://localhost:8081 --keep-synthetic-data` | **14 real browser/SQL checkpoints passed**, no mock API                                                                                                             |
| Same smoke on `3107/v1` and `8084`                                                                                      | 14 checkpoints passed before final standard-port run                                                                                                                |
| `npm.cmd run db:status`                                                                                                 | Four migrations applied; database schema up to date                                                                                                                 |
| `npm.cmd run doctor`                                                                                                    | Main PostgreSQL 17.11 tables/authentication ready; overall diagnostic fails because test target returns **28P01**                                                   |
| `npm.cmd run test:integration`                                                                                          | Prisma validate/generate passed; migration deploy on 5433 failed with **P1000**; SQL suite did not execute                                                          |
| `npm.cmd run test:e2e:isolated -- --version 18`                                                                         | Fresh initdb completed under `.local`; pg_ctl startup blocked by Windows restricted-token **87**, then **3**; full isolated SQL/financial E2E did not execute       |
| `node scripts/setup-local-postgres.mjs --test --inspect`                                                                | Safe target metadata confirmed 127.0.0.1:5433, fintrack_test role/database and configured password presence; no password printed or administrative access attempted |
| Git ignore and diff checks                                                                                              | `.env`, local logs and diagnostic artifacts ignored; `git diff --check` passed                                                                                      |

`npm.cmd run format:check` also passed for the entire repository after the final
documentation updates.

Initial browser runs exposed a missing production fixture API URL and external
session lookup delays. Those test preparation issues were corrected with an
explicit fixture URL and isolated routes; the final run is 24/24. The first real
smoke stopped on the timestamp constraint, leading to the UTC fix; it is not
counted as a successful run. No failed run is represented as passing.

## Real CORS result / Resultado real do CORS

The corrected runtime returns:

| Origin / Origem             | OPTIONS | Allow-Origin           | Credentials |
| --------------------------- | ------- | ---------------------- | ----------- |
| `http://localhost:8081`     | 204     | Exact requested origin | true        |
| `http://localhost:8082`     | 204     | Exact requested origin | true        |
| `http://localhost:8083`     | 204     | Exact requested origin | true        |
| `http://localhost:8084`     | 204     | Exact requested origin | true        |
| `https://untrusted.example` | 404     | Absent                 | Absent      |

Methods: `GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`. Headers:
`Accept,Content-Type,Authorization,Idempotency-Key`. HTTP regression also verified
an untrusted registration POST receives 403. Production HTTP tests authorize only
the exact configured HTTPS origin and deny default local/external origins.

## Real authentication and finance / Autenticação e finanças reais

The Edge smoke verified invalid email/short-password API rejection, frontend
password confirmation, new-user PostgreSQL persistence with a scrypt hash, empty
initial accounts and redirect to `/accounts`. It verified HttpOnly Strict cookies,
no auth grant in localStorage, restoration after reload, `/auth/me` authorization,
access expiry with refresh rotation, duplicate email 409, wrong and nonexistent
credentials 401, server revocation on logout, cookie removal and private-route
protection. Browser invalid-login and connection-failure messages were exercised.

It created and renamed an account, created two categories, posted 500 BRL income
and 200 BRL expense over a 1,000 BRL opening balance, listed persisted transactions
and confirmed **1,300 BRL** after reload and login. A second user's account,
category and transaction lists were empty; cross-owner transaction creation was
rejected. Direct SQL verified persisted records and actual session timestamps.

Five synthetic users were retained across the initial partial run and two full
runs, identified by `communication-*@example.test` and
`communication-peer-*@example.test`: three accounts and six transactions in total.
The last complete run used `communication-a0a4b1b0-bbe4-4768-a89b-8be5859d618e@example.test`
and `communication-peer-deed9e23-3e6c-47de-9c4d-3fd89d659c5e@example.test`.
Passwords and token values were not saved in this report. No existing user,
transaction or database was deleted. Only the smoke's own synthetic session was
temporarily expired to verify refresh.

## Remaining gates / Pendências

- **PostgreSQL 18 configured service:** running on 5433 but rejects application
  login. This does not establish role/database existence or privileges. An authorized
  operator must enter the existing administrative password in the read-only local
  audit; no guessing, administrative reset or HBA edit was performed.
- **SQL integration:** including the new exact-epoch timezone regression, remains
  unexecuted because 5433 rejects authentication and the isolated server cannot
  start inside this Windows sandbox. Main-database smoke is separately proven.
- **Native devices/production:** URL branches and native exports were tested;
  actual Android/iOS devices, tunnel networking and a production deployment were not.
- **Historical timestamps:** no automatic data migration was performed. Review
  separately if existing records created before UTC pinning require correction.
- **GitHub:** 0 new commits, 0 pushes, no new hashes or published branch. Local
  branch is `main`; HEAD/cached origin match
  `22f7e30ac8324dda07e8aac426b825a29228b131`. Git write attempts failed at
  `.git/index.lock`/objects. HTTPS `git ls-remote` failed; live remote synchronization
  and authentication could not be verified. The requested 25 commits were not
  fabricated. [COMMITS.md](../COMMITS.md) provides eight coherent repair units,
  distinguishes prior changes and gives normal-PowerShell commit/push commands.

See [local setup](local-development.md) for runnable commands and security boundaries.
