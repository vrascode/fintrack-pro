#requires -Version 5.1
<##
Runs only in the original repository. Default: read-only review.
Publication requires -Publish -PlanHash <SHA256 printed by review>.
No elevation, execution-policy changes, stash, reset, cleanup or force push.
##>
[CmdletBinding()]
param(
    [switch]$ReviewOnly,
    [switch]$ShowDiff,
    [switch]$ValidatePlan,
    [switch]$Publish,
    [string]$PlanHash,
    [string]$ResumeReport,
    [switch]$RunIntegration
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if ($repoRoot -ine 'C:\Projetos\fintrack-pro') { throw 'Use the original C:\Projetos\fintrack-pro repository.' }
if ($ReviewOnly -and $Publish) { throw 'Choose review or publication.' }
$originalLocation = Get-Location
$originalPrompt = [Environment]::GetEnvironmentVariable('GIT_TERMINAL_PROMPT', 'Process')
$script:state = $null
$script:reportFile = $null
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-Captured {
    param([string]$Program, [string[]]$Arguments)
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $Program @Arguments 2>&1 | ForEach-Object { $_.ToString() })
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($code -ne 0) { throw "$Program failed (exit $code). No retry or automatic reconciliation was performed. $($output -join [Environment]::NewLine)" }
    return ($output -join [Environment]::NewLine).Trim()
}
function Get-Git { param([string[]]$Arguments) return Invoke-Captured -Program 'git' -Arguments $Arguments }
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    Write-Host ("Running: {0} {1}" -f $Program, ($Arguments -join ' '))
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). Publication stopped." }
}
function Save-Report {
    if ($null -eq $script:state -or !$script:reportFile) { return }
    $script:state.updatedUtc = [DateTime]::UtcNow.ToString('o')
    $script:state.localHead = Get-Git @('rev-parse', 'HEAD')
    $json = $script:state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($script:reportFile, $json, $utf8)
    $lines = @('# FinTrack Pro publication report', '', ('Status: ' + $script:state.status), ('Local HEAD: ' + $script:state.localHead), ('Verified remote HEAD: ' + $script:state.remoteHead), '', '| # | Hash | Message | Files | Tests | Push |', '| --- | --- | --- | --- | --- | --- |')
    $number = 0
    foreach ($commit in @($script:state.commits)) {
        $number++
        $lines += "| $number | $($commit.hash) | $($commit.message) | $($commit.files -join ', ') | $($commit.tests -join ', ') | $($commit.status) |"
    }
    if ($number -eq 0) { $lines += '| - | - | No commit created | Working files preserved | See JSON test results | Not published |' }
    $lines += @('', ('Push attempts: ' + $script:state.pushAttempts), ('Confirmed commits: ' + @($script:state.commits | Where-Object { $_.status -eq 'confirmed' }).Count), ('Failure: ' + $script:state.failure), '', 'CI: not verified by this script. Integration is optional and reported separately.', 'All test timings, results, units and errors are in the adjacent JSON report.')
    [IO.File]::WriteAllText([IO.Path]::ChangeExtension($script:reportFile, '.md'), ($lines -join [Environment]::NewLine), $utf8)
}
function Assert-Identity {
    foreach ($variable in @('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES')) {
        if ([Environment]::GetEnvironmentVariable($variable, 'Process')) { throw 'Alternate Git paths/stores are not allowed by this publisher.' }
    }
    if ((Get-Git @('rev-parse', '--show-toplevel')).Replace('/', '\') -ine $repoRoot) { throw 'Wrong Git root.' }
    if ((Get-Git @('rev-parse', '--absolute-git-dir')).Replace('/', '\') -ine (Join-Path $repoRoot '.git')) { throw 'Expected the original .git directory.' }
    if ((Get-Git @('branch', '--show-current')) -ne 'main') { throw 'Expected main. No branch switch was performed.' }
    foreach ($arguments in @(@('remote', 'get-url', 'origin'), @('remote', 'get-url', '--push', 'origin'))) {
        $url = Get-Git $arguments
        if ($url -notin @('https://github.com/vrascode/fintrack-pro.git', 'https://github.com/vrascode/fintrack-pro')) { throw 'Unexpected fetch/push remote. No remote configuration was changed.' }
    }
    if (Get-Git @('ls-files', '-u')) { throw 'Unmerged files must be reviewed first.' }
    if (!(Get-Git @('config', 'user.name')) -or !(Get-Git @('config', 'user.email'))) { throw 'Configure your real Git identity before publication.' }
    foreach ($variable in @('GIT_AUTHOR_DATE', 'GIT_COMMITTER_DATE')) {
        if ([Environment]::GetEnvironmentVariable($variable, 'Process')) { throw 'Remove artificial date overrides before publishing.' }
    }
}
function Read-Remote {
    Assert-Identity
    Invoke-Checked 'git' @('fetch', 'origin')
    $advertised = Get-Git @('ls-remote', 'origin', 'refs/heads/main')
    if ($advertised -notmatch '^([a-f0-9]{40})\s+refs/heads/main$') { throw 'Cannot establish the remote main hash.' }
    $remoteHash = $Matches[1]
    if ((Get-Git @('rev-parse', 'origin/main')) -ne $remoteHash) { throw 'Remote moved during verification. No merge/rebase was performed.' }
    return $remoteHash
}
function Assert-Synchronized {
    $remoteHash = Read-Remote
    if ((Get-Git @('rev-parse', 'HEAD')) -ne $remoteHash -or (Get-Git @('rev-list', '--left-right', '--count', 'HEAD...origin/main')) -notmatch '^0\s+0$') { throw 'Local/remote main diverged. Preserve changes and reconcile explicitly.' }
    $script:state.remoteHead = $remoteHash
    Save-Report
}
function Run-Test {
    param([string]$Name, [string]$Unit)
    $commands = @{
        build = @('npm.cmd', 'run', 'build'); lint = @('npm.cmd', 'run', 'lint'); types = @('npm.cmd', 'run', 'typecheck'); unit = @('npm.cmd', 'test'); format = @('npm.cmd', 'run', 'format:check'); bundle = @('npm.cmd', 'run', 'bundle'); browser = @('npm.cmd', 'run', 'test:e2e'); integration = @('npm.cmd', 'run', 'test:integration');
        auth = @('node', '--test', 'tests/auth-endpoints.test.mjs', 'tests/auth-service.test.mjs');
        database = @('node', '--test', 'tests/database-error.test.mjs');
        cors = @('node', '--test', 'tests/cors.test.mjs', 'tests/web-session.test.mjs');
        accounts = @('node', '--test', 'tests/accounts-api.test.mjs');
        transactions = @('node', '--test', 'tests/transactions-api.test.mjs');
        postgres = @('node', '--test', 'tests/postgres-setup.test.mjs', 'tests/postgres-recovery.test.mjs');
        environment = @('node', '--import', 'tsx', '--test', 'tests/api-url.test.ts', 'tests/expo-environment.test.mjs');
        transport = @('node', '--import', 'tsx', '--test', 'tests/http-client.test.ts', 'tests/auth-store.test.ts');
        theme = @('node', '--import', 'tsx', '--test', 'tests/theme-colors.test.ts');
        publisher = @('node', '--test', 'tests/publish-pending.test.mjs')
    }
    if (!$commands.ContainsKey($Name)) { throw "Unknown test ID: $Name" }
    $result = [pscustomobject]@{ name = $Name; unit = $Unit; startedUtc = [DateTime]::UtcNow.ToString('o'); finishedUtc = ''; status = 'running' }
    $script:state.tests = @($script:state.tests) + @($result)
    Save-Report
    try {
        $command = $commands[$Name]
        Invoke-Checked $command[0] $command[1..($command.Length - 1)]
        $result.status = 'passed'
    } catch { $result.status = 'failed'; throw }
    finally { $result.finishedUtc = [DateTime]::UtcNow.ToString('o'); Save-Report }
}
function Run-Browser-Gate {
    $previous = [Environment]::GetEnvironmentVariable('EXPO_PUBLIC_API_URL', 'Process')
    try {
        $env:EXPO_PUBLIC_API_URL = 'https://api.example.test/v1'
        Run-Test 'bundle' 'preflight'
        Run-Test 'browser' 'preflight'
    } finally { [Environment]::SetEnvironmentVariable('EXPO_PUBLIC_API_URL', $previous, 'Process') }
}
function Publish-And-Verify {
    param($Record)
    if ((Get-Git @('rev-parse', 'HEAD')) -ne $Record.hash) { throw 'Local HEAD changed after commit. Publication stopped.' }
    if (!$Record.candidateVerified -or (Get-Git @('rev-parse', 'HEAD^{tree}')) -ne $Record.tree -or (Get-Git @('rev-parse', 'HEAD^')) -ne $Record.parent -or (Get-Git @('log', '-1', '--format=%s')) -cne $Record.message) { throw 'The recorded commit is not the validated candidate. It was preserved, not pushed.' }
    $remoteHash = Read-Remote
    if ($remoteHash -ne $Record.hash) {
        if ($remoteHash -ne $Record.parent) { throw 'Remote moved unexpectedly before push.' }
        $Record.status = 'push-pending'
        $script:state.pushAttempts++
        Save-Report
        Invoke-Checked 'git' @('push', 'origin', 'main')
        $Record.pushCommandSucceeded = $true
        $Record.status = 'pushed-unverified'
        Save-Report
    }
    $remoteHash = Read-Remote
    if ($remoteHash -ne $Record.hash -or (Get-Git @('rev-list', '--left-right', '--count', 'HEAD...origin/main')) -notmatch '^0\s+0$') { throw 'Push has not been confirmed on remote main.' }
    $Record.status = 'confirmed'
    $Record.confirmedUtc = [DateTime]::UtcNow.ToString('o')
    $script:state.remoteHead = $remoteHash
    Save-Report
}

try {
    Set-Location -LiteralPath $repoRoot
    $env:GIT_TERMINAL_PROMPT = '0'
    Assert-Identity
    $auditJson = Invoke-Captured 'node' @('scripts/publish-pending-check.mjs', 'audit')
    $audit = $auditJson | ConvertFrom-Json
    $plan = Get-Content -LiteralPath (Join-Path $repoRoot 'scripts/publish-pending-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host "Reviewed plan SHA256: $($audit.hash)"
    foreach ($unit in $plan.units) { Write-Host ("{0}: {1}`n  Files: {2}" -f $unit.id, $unit.message, (($unit.files + @($unit.patches | ForEach-Object { $_.path })) -join ', ')) }
    if ($ValidatePlan) { Invoke-Checked 'node' @('scripts/publish-pending-check.mjs', 'simulate') }
    if (!$Publish) {
        if ($ShowDiff) {
            Invoke-Checked 'git' @('diff', '--no-ext-diff')
            foreach ($path in (Get-Git @('ls-files', '--others', '--exclude-standard')).Split([Environment]::NewLine.ToCharArray(), [StringSplitOptions]::RemoveEmptyEntries)) {
                if ($path -notlike '*.png') { Write-Host "New file: $path"; Get-Content -LiteralPath $path -Encoding UTF8 }
            }
        }
        Write-Host 'Review only: no staging, commit, fetch or push was performed.'
        Write-Host 'Review files/patches, then pass -Publish -PlanHash <the exact SHA256 above>.'
        return
    }
    if (!$PlanHash -or $PlanHash -cne $audit.hash) { throw 'Publication needs explicit review of the exact current plan: use -Publish -PlanHash <SHA256>.' }
    if (Get-Git @('diff', '--cached', '--name-only')) { throw 'Existing staged changes preserved. Review/unstage only the intended paths before rerunning.' }
    $reportDirectory = Join-Path $repoRoot '.local\publication'
    [IO.Directory]::CreateDirectory($reportDirectory) | Out-Null
    if ($ResumeReport) {
        $resolvedReport = (Resolve-Path -LiteralPath $ResumeReport).Path
        if (!$resolvedReport.StartsWith($reportDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Resume only an original .local/publication report.' }
        $script:state = Get-Content -LiteralPath $resolvedReport -Raw -Encoding UTF8 | ConvertFrom-Json
        $script:reportFile = $resolvedReport
        if ($script:state.planHash -cne $audit.hash -or $script:state.repository -ine $repoRoot -or $script:state.base -ne $plan.base) { throw 'Resume report identity differs.' }
        if ((Get-Git @('rev-parse', 'HEAD')) -ne $script:state.localHead) { throw 'HEAD changed since report. Review it explicitly.' }
        $expectedIds = @($plan.units | Select-Object -First @($script:state.commits).Count | ForEach-Object { $_.id })
        if (($expectedIds -join ',') -ne ((@($script:state.commits) | ForEach-Object { $_.unit }) -join ',')) { throw 'Report commit order differs from the plan.' }
        foreach ($record in @($script:state.commits)) {
            if ((Get-Git @('log', '-1', '--format=%s', $record.hash)) -cne $record.message) { throw 'Recorded commit differs.' }
        }
        $pending = @($script:state.commits | Where-Object { $_.status -ne 'confirmed' })
        if ($pending.Count -gt 1) { throw 'More than one unconfirmed commit in report.' }
        if ($pending.Count -eq 1) { Publish-And-Verify $pending[0] }
    } else {
        $script:reportFile = Join-Path $reportDirectory ((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + '.json')
        $script:state = [pscustomobject]@{ schema = 1; repository = $repoRoot; branch = 'main'; base = $plan.base; planHash = $audit.hash; status = 'preflight'; localHead = Get-Git @('rev-parse', 'HEAD'); remoteHead = ''; pushAttempts = 0; commits = @(); tests = @(); failure = ''; updatedUtc = ''; integration = 'not requested; no database acceptance claimed'; ci = 'not verified' }
        Save-Report
        if ($script:state.localHead -ne $plan.base) { throw 'Plan base is stale. No automatic merge, rebase or replanning.' }
    }
    Assert-Synchronized
    foreach ($test in @('build', 'lint', 'types', 'unit', 'format')) { Run-Test $test 'preflight' }
    Run-Browser-Gate
    if ($RunIntegration) { Run-Test 'integration' 'preflight'; $script:state.integration = 'passed'; Save-Report }
    $script:state.failure = ''
    $script:state.status = 'publishing'
    Save-Report
    foreach ($unit in $plan.units) {
        if (@($script:state.commits | Where-Object { $_.unit -eq $unit.id -and $_.status -eq 'confirmed' }).Count -eq 1) { continue }
        Assert-Synchronized
        # Revalidate every reviewed file before staging, including unknown changes.
        Invoke-Captured 'node' @('scripts/publish-pending-check.mjs', 'audit') | Out-Null
        foreach ($path in $unit.files) { Invoke-Checked 'git' @('add', '--', $path) }
        foreach ($patch in @($unit.patches)) {
            Invoke-Checked 'git' @('apply', '--cached', '--check', '--', $patch.file)
            Invoke-Checked 'git' @('apply', '--cached', '--', $patch.file)
        }
        Invoke-Checked 'git' @('diff', '--cached', '--check')
        Invoke-Checked 'node' @('scripts/publish-pending-check.mjs', 'staged', $unit.id)
        Invoke-Checked 'git' @('diff', '--cached', '--stat')
        Invoke-Checked 'git' @('diff', '--cached', '--no-ext-diff')
        Run-Test 'build' $unit.id
        foreach ($test in $unit.tests) { Run-Test $test $unit.id }
        Assert-Synchronized
        Invoke-Checked 'node' @('scripts/publish-pending-check.mjs', 'verify', $unit.id)
        $parent = Get-Git @('rev-parse', 'HEAD')
        $candidateTree = Get-Git @('write-tree')
        Invoke-Checked 'git' @('commit', '-m', $unit.message)
        $hash = Get-Git @('rev-parse', 'HEAD')
        $record = [pscustomobject]@{ unit = $unit.id; hash = $hash; parent = $parent; tree = $candidateTree; candidateVerified = $false; message = $unit.message; files = @($unit.files) + @($unit.patches | ForEach-Object { $_.path }); tests = @('staged TypeScript', 'build') + @($unit.tests); status = 'committed'; pushCommandSucceeded = $false; confirmedUtc = '' }
        $script:state.commits = @($script:state.commits) + @($record)
        Save-Report
        if ((Get-Git @('rev-parse', 'HEAD^')) -ne $parent -or (Get-Git @('rev-parse', 'HEAD^{tree}')) -ne $candidateTree -or (Get-Git @('log', '-1', '--format=%s')) -cne $unit.message) { throw 'Commit hooks changed the reviewed candidate. Commit preserved; not pushed.' }
        $record.candidateVerified = $true
        Save-Report
        Publish-And-Verify $record
    }
    Assert-Synchronized
    if (Get-Git @('status', '--porcelain')) { throw 'Unexpected files remain pending. They were preserved.' }
    $script:state.status = 'complete'
    Save-Report
    Write-Host "Publication verified. Report: $script:reportFile"
} catch {
    if ($null -ne $script:state) {
        $script:state.status = 'stopped'
        $script:state.failure = $_.Exception.Message
        Save-Report
        Write-Host "Stopped; files/index/commits preserved. Report: $script:reportFile"
    }
    throw
} finally {
    [Environment]::SetEnvironmentVariable('GIT_TERMINAL_PROMPT', $originalPrompt, 'Process')
    Set-Location -LiteralPath $originalLocation.Path
}
