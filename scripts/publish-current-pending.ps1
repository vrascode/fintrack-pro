#requires -Version 5.1
[CmdletBinding()]
param([switch]$Publish)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if ($root -ine 'C:\Projetos\fintrack-pro') { throw 'Unexpected repository root.' }
Set-Location -LiteralPath $root
function Checked([string[]]$Arguments) {
    & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed; stopped without resetting files." }
}
if ((git branch --show-current) -ne 'main') { throw 'Expected branch main.' }
if ((git remote get-url origin) -notin @('https://github.com/vrascode/fintrack-pro.git', 'https://github.com/vrascode/fintrack-pro')) { throw 'Unexpected origin.' }
if (git diff --cached --name-only) { throw 'Review existing staged changes before publication.' }
$units = @(
    @{ message = 'fix(csv): neutralizar fórmulas em exportações financeiras'; files = @('packages/shared/src/finance.ts','apps/mobile/src/personal/reports.ts','tests/finance.test.ts','tests/personal-reports.test.ts') },
    @{ message = 'feat(bills): persistir obrigações e pagamentos idempotentes'; files = @('apps/api/prisma/schema.prisma','apps/api/prisma/migrations/202611040001_bills/migration.sql','apps/api/src/bills/bills.service.ts','apps/api/src/bills/bills.controller.ts','apps/api/src/bills/bills.module.ts','apps/api/src/app.ts','apps/api/src/transactions/transaction-changes.service.ts','packages/shared/src/bill.ts','packages/shared/src/index.ts','tests/bill-calendar.test.ts','tests/bills-api.test.mjs','tests/integration/bills.test.mjs','scripts/database.mjs') },
    @{ message = 'feat(mobile): integrar contas mensais pessoais'; files = @('apps/mobile/app/(tabs)/bills.tsx','apps/mobile/app/(tabs)/_layout.tsx','apps/mobile/src/personal/PersonalBills.tsx','apps/mobile/src/api/client.ts','apps/mobile/src/i18n/pt-BR.ts','apps/mobile/src/i18n/en.ts') },
    @{ message = 'docs(bills): registrar validação e limites da entrega'; files = @('docs/FULL_PROJECT_AUDIT.md','docs/FEATURE_MATRIX.md','docs/TEST_REPORT.md','docs/CSV_EXPORT_SPEC.md','PORTFOLIO_PROGRESS.md','COMMITS.md','scripts/publish-pending-commits.ps1','scripts/publish-current-pending.ps1') }
)
$allowed = @($units | ForEach-Object { $_.files } | ForEach-Object { $_ })
$pending = @(git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3).Replace('\\','/') })
$unexpected = @($pending | Where-Object { $_ -notin $allowed })
if ($unexpected.Count) { throw "Unexpected pending files: $($unexpected -join ', ')" }
Write-Host 'Pending files:'; $pending | ForEach-Object { Write-Host "  $_" }
$units | ForEach-Object { Write-Host ("Commit: {0}" -f $_.message) }
if (!$Publish) { Write-Host 'Review only. Pass -CurrentPending -Publish to publish.'; return }
& npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw 'Quality gate failed.' }
foreach ($unit in $units) {
    Checked @('fetch','origin')
    $remote = (& git ls-remote origin refs/heads/main).Split()[0]
    if (!$remote -or (git rev-parse HEAD) -ne $remote) { throw 'Remote main diverged; stopped.' }
    $paths = @($unit.files | Where-Object { $_ -in $pending })
    if (!$paths.Count) { continue }
    Checked (@('add','--') + $paths)
    Checked @('diff','--cached','--check')
    $staged = @(git diff --cached --name-only)
    if (($staged -join '|') -ne ((@($staged | Where-Object { $_ -in $paths })) -join '|')) { throw 'Unexpected staged path; stopped.' }
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'Quality gate failed before commit.' }
    Checked @('commit','-m',$unit.message)
    Checked @('push','origin','main')
    $advertised = (& git ls-remote origin refs/heads/main).Split()[0]
    if ((git rev-parse HEAD) -ne $advertised) { throw 'Push not confirmed; inspect remote before continuing.' }
    Write-Host "Confirmed: $($unit.message) $advertised"
}
