# Commits and publication / Commits e publicação

No new commit or push was created in this session. Git cannot write
`.git/index.lock` or `.git/objects` under the current read-only sandbox.
`git ls-remote origin refs/heads/main` also failed to connect to GitHub over HTTPS.
No ACL changes, alternate object stores, history rewrites or publication bypasses
were attempted. The user has authorized publication; permissions/connectivity are
the blockers. Cached `HEAD` and `origin/main` matched at
`22f7e30ac8324dda07e8aac426b825a29228b131`; live remote synchronization is unverified.

Nenhum commit/push novo. A meta de 25 commits não foi atingida; não foram criados
commits vazios ou divisões artificiais. O trabalho permanece no diretório original,
incluindo todas as alterações anteriores do usuário.

## Executable publisher / Publicador executável

The current publication plan supersedes the earlier boundaries below. It covers
all pending work in **19 coherent units**, including older database/auth/finance
changes, and uses seven checked patches for shared files. Browser fixture/CI setup
precedes the stricter HTTP client to keep those intermediate browser checks valid.
No commit was created: Git writes and HTTPS remain blocked in this session, and
the local PowerShell execution policy also refuses `.ps1` execution. It was not changed.

The complete fallback is [scripts/publish-pending-commits.ps1](scripts/publish-pending-commits.ps1),
with [the concrete manifest](scripts/publish-pending-plan.json),
[instructions](docs/publishing.md) and [current evidence](docs/publication-preparation.md).
The script defaults to review, requires approval of the exact plan SHA256 to publish,
checks the real staged TypeScript candidate, pushes one commit at a time, verifies
the advertised remote hash and stops on any failure. Reports go to ignored
`.local/publication/`; confirmed commits and push attempts are distinguished.

No PowerShell normal com execução de scripts autorizada:

```powershell
Set-Location C:\Projetos\fintrack-pro
powershell.exe -NoProfile -File .\scripts\publish-pending-commits.ps1 -ReviewOnly -ShowDiff -ValidatePlan
$planHash = (Get-FileHash -LiteralPath .\scripts\publish-pending-plan.json -Algorithm SHA256).Hash.ToLowerInvariant()
powershell.exe -NoProfile -File .\scripts\publish-pending-commits.ps1 -Publish -PlanHash $planHash
```

Review first, then approve the immutable snapshot. No policy override, elevated
permissions or alternate repository is used. A working normal-terminal HTTPS read
does not prove authenticated push access; the publisher checks actual results.

## Reviewable units / Unidades revisáveis

These are proposed commit boundaries, **not an executed history**. Keep dependent
code and tests together. Several files already contained unrelated edits before
the repair; use `git add -p` on shared files and inspect the staged diff.

| Unit / Unidade | Suggested message / Mensagem                                                          | Files or hunks / Arquivos ou trechos                                                                                                                                                        | Validation / Validação                                                                                 |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1              | `fix(api): compartilhar política segura de origem com autenticação`                   | `apps/api/src/config/cors.ts`, origin/CORS hunks in `app.ts` and `identity/web-session.ts`, `tests/cors.test.mjs`                                                                           | Build, CORS HTTP tests, real preflight                                                                 |
| 2              | `fix(expo): carregar URL pública do monorepo e preservar argumentos`                  | `scripts/expo.mjs`, mobile workspace script changes, root `web`/`mobile` scripts, `tests/expo-environment.test.mjs`                                                                         | Environment tests, actual `npm run web -- --port 8081`, native/web exports                             |
| 3              | `fix(mobile): resolver rede e distinguir falhas HTTP da autenticação`                 | `src/api/url.ts`, `transport.ts`, client transport wiring, error mapping in `auth/core.ts`, corresponding feedback in `app/login.tsx`, `tests/api-url.test.ts`, `tests/http-client.test.ts` | URL/transport/auth tests, types, real login, UI error E2E                                              |
| 4              | `fix(database): preservar instantes de sessão em conexões UTC`                        | `database/adapter.ts`, `prisma.service.ts`, adapter use in integration identity/ledger tests, `database-timezone.test.mjs`, integration test list in `scripts/database.mjs`                 | Build and main-database smoke verified exact timestamps/refresh; isolated SQL regression still blocked |
| 5              | `test(auth): validar autenticação e finanças reais sem apagar registros`              | `scripts/validate-local-auth.mjs`                                                                                                                                                           | 14 real browser/SQL checkpoints on 3107/8084 and 3000/8081                                             |
| 6              | `test(database): selecionar PostgreSQL 18 isolado e explicar falhas de inicialização` | Only version selection, timezone and startup-diagnostic hunks in `scripts/test-isolated-postgres.mjs`                                                                                       | Version 18 initdb completed; pg_ctl blocked by restricted-token error 87/3; full suite pending         |
| 7              | `test(web): isolar requisições e validar mensagens de erro HTTP`                      | `e2e/fixtures.ts`, fixture imports, error scenarios in onboarding, fixture API URL in CI bundle step                                                                                        | 24 desktop/mobile browser cases passed                                                                 |
| 8              | `docs(dev): registrar configuração e validação real da comunicação`                   | `.env.example`, current README/DATABASE/progress updates, `docs/local-development.md`, repair plan, validation report and this file                                                         | Formatting, diff review and documented command results                                                 |

Earlier changes remain separate work: authentication throttling/database errors,
account metadata/archive, transaction search/detail, login/theme/confirmation,
PostgreSQL provisioning/recovery hardening, prior CI work and earlier documentation.
Do not silently include those hunks in the repair commits. Review them as their own
functional units, rerun their required acceptance checks, then commit/push each
completed unit. Prior local tests are not evidence that a remote CI run passed.

As alterações anteriores continuam preservadas. Sua publicação deve respeitar
dependências e os bloqueios reais de integração; os comandos abaixo não resolvem
as credenciais de testes nem concedem permissões de escrita ao sandbox.

## Authentication redesign units / Unidades do redesign

The orange/black redesign and bilingual README rewrite were added after the
communication acceptance. They also remain uncommitted because the same Git
permission and HTTPS failures were reproduced. These are additional review
boundaries, not executed commits; the total is twelve proposed repair/design
units, not twenty-five manufactured commits.

| Unit | Suggested message                                                           | Scope                                                                                                                                                                                                 | Evidence                                                                                                                                            |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9    | `style(theme): alinhar laranja e superfícies escuras do aplicativo`         | `theme-colors.ts`, `theme.tsx`, `tests/theme-colors.test.ts`                                                                                                                                          | Actual palette contrast tests, 103 unit tests and dashboard browser regression                                                                      |
| 10   | `feat(auth): redesenhar formulários responsivos com acessibilidade`         | Shared `components/ui.tsx` field/button improvements; `auth/layout.tsx`, `PasswordField.tsx`, `useReducedMotion.ts`; login presentation; new `e2e/auth-design.spec.ts` and updated heading assertions | 34 E2E cases including keyboard, visibility, 44 px targets, focus, loading, reduced motion and narrow/short screens; 14 real PostgreSQL checkpoints |
| 11   | `docs(auth): capturar telas reais de login e cadastro`                      | `scripts/capture-auth-screenshots.mjs` and four `docs/screenshots/auth-*.png` files                                                                                                                   | Actual Edge captures with empty fields, visually inspected desktop and mobile                                                                       |
| 12   | `docs(readme): documentar produto configuração e validação em dois idiomas` | Both READMEs, redesign plan/report, current progress and this publication record                                                                                                                      | Existing npm scripts checked, documentation links/files reviewed and formatting checked                                                             |

Keep the shared field/button changes with the redesigned form and its tests.
`login.tsx` contains earlier feedback changes as well as the redesign: if those
hunks cannot be staged independently into a compiling unit, combine the related
auth portions of units 3 and 10. Never preserve a numerical target at the expense
of a coherent commit. Previous pending source unrelated to this redesign remains intact.

For the new theme unit, normal PowerShell commands are:

```powershell
git diff -- apps/mobile/src/theme-colors.ts apps/mobile/src/theme.tsx tests/theme-colors.test.ts
node --import tsx --test tests/theme-colors.test.ts
if ($LASTEXITCODE -ne 0) { throw 'Contrast tests failed' }
git add -- apps/mobile/src/theme-colors.ts tests/theme-colors.test.ts
git add -p -- apps/mobile/src/theme.tsx
# ThemeScope was already pending: stage the brand-token import/reference only.
git diff --cached --check
git diff --cached
git commit -m "style(theme): alinhar laranja e superfícies escuras do aplicativo"
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
git fetch origin
git rev-parse HEAD
git ls-remote origin refs/heads/main
git rev-list --left-right --count HEAD...origin/main
```

Complete the earlier dependent units and ensure remote freshness before this
example. Verify equality and record each actual hash/message/push before moving
to the next unit. No new hashes or remote CI results exist from this session.

## Normal PowerShell workflow / Fluxo no PowerShell normal

Run outside this restricted session, where Git writes and HTTPS are permitted.
The first unit can be staged precisely with:

```powershell
Set-Location C:\Projetos\fintrack-pro
git status --short --branch
git diff
git add -- apps/api/src/config/cors.ts apps/api/src/identity/web-session.ts tests/cors.test.mjs
git add -p -- apps/api/src/app.ts
# Select only the createCorsOptions import and enableCors replacement.
npm.cmd run build
node --test tests/cors.test.mjs tests/web-session.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
git diff --cached --check
git diff --cached
git commit -m "fix(api): compartilhar política segura de origem com autenticação"
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; preserve the local commit and stop publication' }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Remote verification failed' }
git rev-parse HEAD
git ls-remote origin refs/heads/main
git rev-list --left-right --count HEAD...origin/main
```

Compare the two hashes and confirm `0 0` before proceeding to the next unit.
For each subsequent unit, use explicit `git add -- <paths>` for clean/new files
and `git add -p -- <shared-paths>` for existing mixed changes, run the relevant
checks, inspect `git diff --cached`, then commit and push immediately. Record the
actual hash/result in this file. Never use `git add .`, force push, fake dates or
an automatic merge/rebase while unrelated working-tree changes remain unreviewed.
If the remote advanced, preserve the work and reconcile it explicitly before pushing.

Compare os hashes e confirme `0 0` após cada push. Se o remoto avançar ou qualquer
verificação falhar, pare a publicação daquela unidade e preserve o trabalho.
