# Validation and pending publication / Validação e publicação pendente

## Changes / Alterações

1. Transaction creation rejects dates before either participating account opened.
   / Criação de lançamentos rejeita datas anteriores à abertura das contas envolvidas.
2. Personal dashboard derives current and previous monthly totals and category
   spending from API records, excludes planned/future entries, and handles future
   account openings without throwing during rendering. Account cards explain when
   their balance becomes available. / Dashboard apresenta comparação mensal e
   gastos por categoria; contas futuras não interrompem a renderização.

## Evidence / Evidências

- `npm.cmd run check`: passed, 111 tests, lint, TypeScript and formatting.
- `npm.cmd run bundle`: Web, Android and iOS exports passed. This does not validate
  execution on native devices. / Exportação não equivale a teste em dispositivo.
- `npm.cmd run test:e2e`: 34/34 passed after exporting Web with the reserved HTTPS
  test URL below. The first run failed with the local HTTP production configuration.
  These tests intercept API traffic; they do not prove PostgreSQL authentication.
- `npm.cmd run doctor`: development PostgreSQL 17.11 authenticated on port 5432;
  application tables readable. Test database on 5433 rejected credentials (28P01).
- `npm.cmd run db:status`: all four migrations already applied; no migration needed.
- `npm.cmd run test:e2e:isolated`: blocked before database startup; Windows pg_ctl
  could not create a restricted token (87). No installed service was modified.
- `npm.cmd run dev`: database ready, but binding port 8081 failed with EACCES.
- Browser preview on port 4173 is available to the UI suite. The generated empty
  desktop registration screenshot was inspected; personal dashboard visual
  acceptance and real PostgreSQL browser acceptance remain pending.
- Git staging failed with permission denied creating `.git/index.lock`. No lock
  existed and no Git process was observed. GitHub port 443 was also unreachable.
  No commit or push was completed. / Nenhum commit ou push foi concluído.

The production export rejects a local HTTP API URL by design. For isolated UI
tests, export Web using a reserved HTTPS endpoint; test fixtures intercept API
requests. This address is only for testing, never a production API configuration:

```powershell
$previousApiUrl = $env:EXPO_PUBLIC_API_URL
try {
  $env:EXPO_PUBLIC_API_URL='https://fintrack-api.invalid/v1'
  node scripts/expo.mjs export --platform web
  if ($LASTEXITCODE -ne 0) { throw 'Web export failed' }
  npm.cmd run test:e2e
  if ($LASTEXITCODE -ne 0) { throw 'E2E failed' }
} finally {
  $env:EXPO_PUBLIC_API_URL = $previousApiUrl
}
```

## Publish locally / Publicar no terminal local

Run in an authorized PowerShell terminal. Stop on any failed command. Fetch first
and verify that HEAD equals origin/main before committing; integrate concurrent
remote changes separately. Do not force push. Ensure no unrelated staged files.
The progress log belongs to the second unit because it describes both deliveries.

```powershell
Set-Location C:\Projetos\fintrack-pro
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
git diff --cached --stat
git add -- apps/api/src/transactions/transactions.service.ts tests/transactions-api.test.mjs
git diff --cached --check
git diff --cached
git commit -m "fix(transactions): impedir lançamentos anteriores à abertura da conta"
git push origin main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

Only after confirming matching hashes, publish the dashboard unit:

```powershell
git add -- apps/mobile/src/personal/screens.tsx apps/mobile/src/personal/summary.ts tests/personal-summary.test.ts PORTFOLIO_PROGRESS.md docs/validation-2026-11-03.md
git diff --cached --check
git diff --cached
git commit -m "feat(dashboard): comparar meses e detalhar gastos por categoria"
git push origin main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

## Remaining work / Pendências

Configure test database credentials locally in the ignored environment file,
without sharing passwords in chat. Complete real integration and restart
acceptance, transaction editing/deletion, persisted budgets/goals/recurrence,
personal dashboard visual acceptance and native-device testing. Production
security and release readiness are not certified by this checkpoint.
