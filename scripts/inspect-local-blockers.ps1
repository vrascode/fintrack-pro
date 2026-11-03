# Read-only Windows inspection. Never load .env, connect to SQL or change ACLs.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$instances = foreach ($majorVersion in @('17', '18')) {
    $serviceName = "postgresql-x64-$majorVersion"
    $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'"
    if (-not $service) { throw "Service not found: $serviceName" }
    $dataMatch = [regex]::Match($service.PathName, '(?i)-D\s+"([^"]+)"')
    if (-not $dataMatch.Success) { throw "Unrecognized data path for $serviceName; inspect manually." }
    $dataPath = $dataMatch.Groups[1].Value
    $binaryPath = "C:\Program Files\PostgreSQL\$majorVersion\bin\postgres.exe"
    $majorOnDisk = (Get-Content -LiteralPath (Join-Path $dataPath 'PG_VERSION') -Raw).Trim()
    if ($majorOnDisk -ne $majorVersion) { throw "Version mismatch for $serviceName" }
    $serverProcessId = $null
    $runtimePort = $null
    if ($service.State -eq 'Running') {
        $pidLines = @(Get-Content -LiteralPath (Join-Path $dataPath 'postmaster.pid'))
        $serverProcessId = [int]$pidLines[0]
        $runtimePort = [int]$pidLines[3]
    }
    $configuredPort = & $binaryPath -D $dataPath -C port
    if ($LASTEXITCODE -ne 0) { throw "Could not read configured port for $serviceName" }
    $hbaSetting = & $binaryPath -D $dataPath -C hba_file
    if ($LASTEXITCODE -ne 0) { throw "Could not read HBA location for $serviceName" }
    $hbaPath = if ([IO.Path]::IsPathRooted($hbaSetting.Trim())) {
        $hbaSetting.Trim()
    } else { Join-Path $dataPath $hbaSetting.Trim() }
    $rules = @(Get-Content -LiteralPath $hbaPath | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') })
    # Summarize methods only: raw HBA lines may contain LDAP secrets.
    $knownMethods = @('trust','reject','scram-sha-256','md5','password','gss','sspi','ident','peer','ldap','radius','cert','pam','bsd')
    $methods = @($rules | ForEach-Object {
        $fields = $_.Trim() -split '\s+'
        $candidate = if ($fields[0] -eq 'local') { $fields[3] }
        elseif ($fields[0] -match '^host') { $fields[4] }
        else { $null }
        if ($knownMethods -contains $candidate) { $candidate }
        else { 'include-or-complex-rule: manual review needed' }
    } | Sort-Object -Unique)
    $listeners = if ($null -ne $runtimePort) {
        @(Get-NetTCPConnection -State Listen -LocalPort $runtimePort)
    } else { @() }
    $listenerProcessIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    $process = if ($null -ne $serverProcessId) {
        Get-CimInstance Win32_Process -Filter "ProcessId=$serverProcessId"
    } else { $null }
    [pscustomobject]@{
        Service = $serviceName
        State = $service.State
        ServiceProcessId = $service.ProcessId
        DataDirectory = $dataPath
        MajorVersion = $majorOnDisk
        ConfiguredPort = [int]$configuredPort.Trim()
        RuntimePort = $runtimePort
        ServerProcessId = $serverProcessId
        ParentProcessId = $process.ParentProcessId
        Executable = $process.ExecutablePath
        ListenerProcessIds = $listenerProcessIds
        ListenerMatchesData = ($null -ne $serverProcessId -and $listenerProcessIds -contains $serverProcessId)
        ParentMatchesService = ($null -ne $process -and $process.ParentProcessId -eq $service.ProcessId)
        HbaPath = $hbaPath
        AuthenticationMethods = $methods
        LoopbackPostgresTrustRulePresent = [bool]($rules -match '^host\s+postgres\s+postgres\s+127\.0\.0\.1/32\s+trust')
    }
}
$gitDirectory = Join-Path $projectRoot '.git'
$gitProcesses = @(Get-Process -Name git,git-remote-https,git-remote-http -ErrorAction SilentlyContinue | Select-Object Id,ProcessName)
[pscustomobject]@{
    Instances = @($instances)
    Git = [pscustomobject]@{
        LockExists = Test-Path -LiteralPath (Join-Path $gitDirectory 'index.lock')
        Processes = $gitProcesses
        DirectoryAcl = (Get-Acl -LiteralPath $gitDirectory).Sddl
        IndexAcl = (Get-Acl -LiteralPath (Join-Path $gitDirectory 'index')).Sddl
    }
} | ConvertTo-Json -Depth 7
