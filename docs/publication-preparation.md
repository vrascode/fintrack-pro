# Publication preparation / Preparação da publicação

Publication is still blocked inside the current sandbox. The original branch is
`main` at `22f7e30ac8324dda07e8aac426b825a29228b131`. Git index-lock creation is
denied and GitHub fetch/HTTPS queries fail here. The user's successful normal
PowerShell read establishes a separate environment; it is not evidence of a push
from this session. No replacement repository or permission workaround was used.

The deliverable is a Windows PowerShell publisher with an exact manifest and seven
verified patches, covering all pending corrections, prior safety/finance changes,
orange/black redesign, tests, screenshots and current READMEs. Its concrete plan
uses nineteen coherent functional units instead of manufacturing twenty-five.
Run instructions and recovery rules are in [publishing.md](publishing.md).

## Current evidence / Evidências atuais — 2026-11-03

| Check                                             | Executed result                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root build, lint, typecheck                       | Passed; helper lint findings were corrected and rerun                                                                                                                 |
| `npm.cmd test`                                    | 108 passed, zero failures; includes five new publisher tests                                                                                                          |
| `npm.cmd run test:e2e`                            | 34 passed with fresh web/Android/iOS exports                                                                                                                          |
| `npm.cmd run format:check` and `git diff --check` | Passed after formatting the generated manifest with the existing Prettier configuration                                                                               |
| Publisher tests                                   | Five passed: safe paths, secret redaction, exact patches, Windows PowerShell AST parsing and prohibited-operation checks                                              |
| Candidate simulation                              | All 19 successive TypeScript candidates passed using Git HEAD blobs and planned changes in memory                                                                     |
| Read-only Git patch checks                        | The terminal CORS and Expo package patches passed `git apply --check --reverse` against their exact final working files                                               |
| Plan audit                                        | Covers 100 paths including the manifest and the old theme-file deletion; seven exact before/after patches; no uncovered changed paths or detected credential patterns |
| PowerShell `-ReviewOnly` execution                | Blocked before execution by the machine's script-execution policy; no policy change/bypass was attempted                                                              |
| Git staging/publication                           | Index-lock creation denied; no commit or push created                                                                                                                 |
| GitHub read/fetch                                 | Failed in this sandbox; the user's normal-terminal read is separately acknowledged                                                                                    |

The first in-memory run exposed missing YAML content in the candidate loader when
validating the CI split. The loader was corrected, a complete new run passed all
19 candidates, and the final snapshot was audited again. The publisher's own
PowerShell end-to-end workflow could not be executed under the policy restriction;
syntax checks and read-only Node validation do not establish actual push success.

No login, dashboard, README content, application dependency or database was changed
by the publication tooling. Main-database smoke and blocked test-database evidence
remain historical; no new SQL acceptance or CI success is claimed in this task.
All original pending work remains present and unstaged.

## Actual Git result / Resultado Git real

| Commit # | Hash | Message           | Main files                                          | Tests                                          | Push                           |
| -------- | ---- | ----------------- | --------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| —        | —    | No commit created | Pending work preserved; publisher/manifest prepared | 108 unit/HTTP, 34 E2E, 19 candidate typechecks | Not attempted: staging blocked |

- New commits: **0**. Pushes: **0**. Commits confirmed on GitHub: **0**.
- Local HEAD: `22f7e30ac8324dda07e8aac426b825a29228b131`, branch `main`.
- Cached `origin/main`: same hash; cached divergence `0 0`.
- Actual remote HEAD: not reverified here; the user reported this same hash from
  normal PowerShell. Remote freshness and authenticated push permission remain unknown.
- Remaining pending paths: all 100 paths covered by the concrete manifest; no
  ambiguous remainder was automatically staged. The paths include the former theme
  deletion and its replacement, rather than one hundred newly authored features.
- GitHub Actions: **unverified**, no remote run claimed.
- Remaining blockers: sandbox Git writes/HTTPS and this machine's PowerShell script
  policy. Use the existing approved normal-terminal policy, never an automatic override.

## Concrete units / Unidades concretas

The following are reviewable future units, **not created commits**. Their hashes
and actual test/push outcomes are recorded only by the running publisher under
ignored `.local/publication/` after successful commands. Each row is dependent on
the preceding applicable API/shared/UI changes; no count-only splits are included.

Nenhum commit/push foi criado nesta sessão. O script é a alternativa executável no
PowerShell normal solicitada pelo usuário, sem refazer o produto ou apagar trabalho.

| Unit                | Proposed message                                                           | Main files                                                                                                                                     | Targeted gates                                         | State                   |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------- |
| 01-auth-limit       | `fix(auth): limitar tentativas antes de consultar credenciais`             | `apps/api/src/identity/auth-rate-limit.guard.ts`, `apps/api/src/identity/auth.controller.ts`, `apps/api/src/identity/auth.module.ts` + 1 paths | build, staged types, auth                              | Prepared; not committed |
| 02-database-errors  | `fix(api): responder falhas de banco sem expor dados sensíveis`            | `apps/api/src/database/database-error.filter.ts`, `tests/database-error.test.mjs`, `apps/api/src/app.ts`                                       | build, staged types, database                          | Prepared; not committed |
| 03-cors             | `fix(api): compartilhar política segura de origem com autenticação`        | `apps/api/src/config/cors.ts`, `apps/api/src/identity/web-session.ts`, `tests/cors.test.mjs` + 1 paths                                         | build, staged types, cors                              | Prepared; not committed |
| 04-database-utc     | `fix(database): preservar instantes de sessão em conexões UTC`             | `apps/api/src/database/adapter.ts`, `apps/api/src/database/prisma.service.ts`, `scripts/database.mjs` + 3 paths                                | build, staged types, auth, cors                        | Prepared; not committed |
| 05-accounts         | `feat(accounts): atualizar metadados e preservar contas arquivadas`        | `packages/shared/src/finance.ts`, `apps/api/src/accounts/accounts.controller.ts`, `apps/api/src/accounts/accounts.service.ts` + 1 paths        | build, staged types, accounts                          | Prepared; not committed |
| 06-transactions     | `feat(transactions): consultar histórico e detalhes com isolamento`        | `apps/api/src/transactions/transactions.controller.ts`, `apps/api/src/transactions/transactions.service.ts`, `tests/transactions-api.test.mjs` | build, staged types, transactions                      | Prepared; not committed |
| 07-postgres-tools   | `fix(database): proteger auditoria recuperação e aceite PostgreSQL local`  | `scripts/recover-postgres-admin.mjs`, `scripts/setup-local-postgres.mjs`, `scripts/test-isolated-postgres.mjs` + 6 paths                       | build, staged types, postgres                          | Prepared; not committed |
| 08-expo             | `fix(expo): carregar URL pública do monorepo e preservar argumentos`       | `scripts/expo.mjs`, `apps/mobile/package.json`, `tests/expo-environment.test.mjs` + 1 paths                                                    | build, staged types, environment                       | Prepared; not committed |
| 09-browser-fixtures | `test(web): isolar requisições e configurar URL de teste na CI`            | `e2e/fixtures.ts`, `e2e/foundation.spec.ts`, `e2e/onboarding.spec.ts` + 1 paths                                                                | build, staged types, browser                           | Prepared; not committed |
| 10-development      | `fix(dev): iniciar Expo no workspace e diagnosticar destinos locais`       | `scripts/dev.mjs`, `scripts/doctor.mjs`, `scripts/inspect-local-blockers.ps1`                                                                  | build, staged types, environment, postgres             | Prepared; not committed |
| 11-http-session     | `fix(mobile): preservar sessão e distinguir falhas HTTP e de conexão`      | `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/url.ts`, `apps/mobile/src/api/transport.ts` + 5 paths                                    | build, staged types, transport, environment            | Prepared; not committed |
| 12-theme            | `style(theme): alinhar identidade laranja e superfícies escuras`           | `apps/mobile/src/theme.ts`, `apps/mobile/src/theme.tsx`, `apps/mobile/src/theme-colors.ts` + 1 paths                                           | build, staged types, theme                             | Prepared; not committed |
| 13-auth-ui          | `feat(auth): apresentar login e cadastro responsivos e acessíveis`         | `apps/mobile/src/components/ui.tsx`, `apps/mobile/src/auth/layout.tsx`, `apps/mobile/src/auth/PasswordField.tsx` + 5 paths                     | build, staged types, browser                           | Prepared; not committed |
| 14-personal-finance | `feat(finance): editar contas e consultar movimentações persistidas`       | `apps/mobile/src/personal/screens.tsx`, `apps/mobile/app/(tabs)/activity.tsx`, `e2e/real/financial.spec.ts`                                    | build, staged types, accounts, transactions, transport | Prepared; not committed |
| 15-ci               | `ci: validar integração PostgreSQL e interface com ambiente isolado`       | `.github/workflows/ci.yml`, `scripts/ci-postgres.mjs`, `tsconfig.json`                                                                         | build, staged types, lint, types                       | Prepared; not committed |
| 16-real-smoke       | `test(auth): verificar autenticação e finanças reais sem apagar registros` | `scripts/validate-local-auth.mjs`                                                                                                              | build, staged types, auth, accounts, transactions      | Prepared; not committed |
| 17-screenshots      | `docs(auth): capturar telas reais de login e cadastro`                     | `scripts/capture-auth-screenshots.mjs`, `docs/screenshots/auth-login-desktop.png`, `docs/screenshots/auth-login-mobile.png` + 2 paths          | build, staged types, lint                              | Prepared; not committed |
| 18-documentation    | `docs(project): registrar produto execução e validação em dois idiomas`    | `.env.example`, `README.md`, `README.pt-BR.md` + 12 paths                                                                                      | build, staged types, format                            | Prepared; not committed |
| 19-publication      | `feat(dev): publicar unidades verificadas com push e relatório individual` | `scripts/publish-pending-commits.ps1`, `scripts/publish-pending-check.mjs`, `scripts/prepare-pending-plan.mjs` + 11 paths                      | build, staged types, publisher, format                 | Prepared; not committed |
