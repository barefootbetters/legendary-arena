<#
.SYNOPSIS
    Tests the deployed Legendary Arena game server (api.legendary-arena.com)
    against its catalogued HTTP API surface, and optionally proves the droplet
    origin is reachable only through Cloudflare.

.DESCRIPTION
    Production runs on a DigitalOcean droplet behind Cloudflare (D-24707):
    Cloudflare edge -> Nginx (Cloudflare Origin Certificate) -> Node on
    127.0.0.1:3000. This script checks that path from the outside, in four
    sections:

    ASSETS  — the card-metadata file browser clients load from R2.
    SERVER  — the public endpoints listed in docs/ai/REFERENCE/api-endpoints.md
              that don't need a Hanko session, plus auth-gate probes that
              expect 401 on protected routes.
    EDGE    — a request that brings its own `cf-connecting-ip` must get 403
              from Cloudflare. The guest rate limiters key on that header
              (resolveRateLimitKey, D-24635 §3), so this proves a client can't
              pick its own bucket. Skipped for a localhost target.
    ORIGIN  — only with -OriginIp. The droplet's own IP must refuse or drop
              443 and 3000, and port 80 must only redirect to HTTPS. Together
              with EDGE this proves the origin lock (UFW admits 443 only from
              Cloudflare; Node listens on loopback only).

    Reports status, response time, and basic body shape for each probe.
    Exits 0 when all probes pass; exits 1 when one or more fail.

    This script is read-only. It never POSTs state-changing requests, never
    creates resources, never authenticates. It is safe to run against
    production at any time and its output reveals no secrets.

    On-box checks (la-server active, /health/db, loopback bind, disk, backup
    age) are the lab repo's infra/scripts/60-monitor.ps1, which the la-health
    timer runs every 5 minutes.

.PARAMETER BaseUrl
    Origin of the deployed server. Defaults to production. Override for local
    dev (e.g., http://localhost:8000); the EDGE section is skipped there.

.PARAMETER OriginIp
    The droplet's public IPv4 address. When set, the ORIGIN section probes it
    directly. Look it up with `doctl compute droplet list`. It is a parameter,
    not a default, because a rebuilt droplet gets a new IP (DR-02).

.PARAMETER IncludeWebhookProbe
    If set, probes POST /api/billing/webhook/stripe with a deliberately
    bad signature and expects 400. Disabled by default because the exact
    failure-status surface depends on which Stripe SDK error path the
    server takes for malformed payloads.

.EXAMPLE
    pwsh scripts/Test-ApiDeployment.ps1

.EXAMPLE
    pwsh scripts/Test-ApiDeployment.ps1 -OriginIp 203.0.113.10

.EXAMPLE
    pwsh scripts/Test-ApiDeployment.ps1 -BaseUrl http://localhost:8000
#>

[CmdletBinding()]
param(
    [string] $BaseUrl = 'https://api.legendary-arena.com',
    [string] $OriginIp,
    [switch] $IncludeWebhookProbe
)

$ErrorActionPreference = 'Stop'

# why: an explicit User-Agent matches the lasting fix applied to
# scripts/check-connections.mjs. Cloudflare bot detection blocks generic
# curl/* and bare 'node' UAs. Identifying our tooling explicitly avoids that
# block and makes our traffic legible in Cloudflare logs.
$script:UserAgent = 'legendary-arena-smoke-test/1.0'

# why: the droplet does not sleep (Render's starter tier did), so one short
# timeout covers every HTTP probe.
$script:RequestTimeoutSec = 10

# why: a closed origin port either refuses at once or (UFW's default deny)
# drops the SYN and never answers. Five seconds is long enough to tell a slow
# open port from a dropped one without making the ORIGIN section drag.
$script:PortProbeTimeoutMs = 5000

# Strip any trailing slash from BaseUrl so probe paths concatenate cleanly.
$BaseUrl = $BaseUrl.TrimEnd('/')

# ---------------------------------------------------------------------------
# Probe definitions
# ---------------------------------------------------------------------------

# why: browser clients (play., cards.) load card metadata from R2 at runtime.
# The server itself loads data/ from local files at startup (server.mjs
# loadRegistry), so this probes the client asset path, not a server dependency.
$assetProbes = @(
    @{
        Name           = 'R2 metadata (images.legendary-arena.com/metadata/sets.json)'
        Url            = 'https://images.legendary-arena.com/metadata/sets.json'
        Method         = 'GET'
        ExpectStatus   = 200
        ExpectContains = '"abbr"'
    }
)

# Server endpoint probes — every entry corresponds to a row in
# docs/ai/REFERENCE/api-endpoints.md. Guest endpoints expect 200; the
# auth-gate probe expects 401, which verifies session middleware is wired
# and rejecting unauthenticated requests on protected routes.
$serverProbes = @(
    @{
        Name           = 'health endpoint (GET /health)'
        Path           = '/health'
        Method         = 'GET'
        ExpectStatus   = 200
        ExpectContains = '"status":"ok"'
    }
    @{
        Name           = 'database health (GET /health/db)'
        Path           = '/health/db'
        Method         = 'GET'
        ExpectStatus   = 200
        ExpectContains = '"database":"ok"'
    }
    @{
        Name           = 'leaderboards scenarios (GET /api/leaderboards/scenarios)'
        Path           = '/api/leaderboards/scenarios'
        Method         = 'GET'
        ExpectStatus   = 200
    }
    @{
        Name           = 'profile auth gate (GET /api/me/profile)'
        Path           = '/api/me/profile'
        Method         = 'GET'
        ExpectStatus   = 401
    }
    @{
        Name           = 'entitlements auth gate (GET /api/me/entitlements)'
        Path           = '/api/me/entitlements'
        Method         = 'GET'
        ExpectStatus   = 401
    }
    # why: the /api/dash/* admin family (WP-373/374/439/517) had zero smoke
    # coverage — the profile/entitlements probes above exercise the
    # authenticated-session gate, not the admin-session gate. These two probe
    # the admin-gated dashboard feeds unauthenticated: requireAdminSession's
    # upstream session check fails with no bearer, so the route returns 401
    # (admin `forbidden`/403 only fires for an authenticated non-admin, which a
    # tokenless probe cannot produce). A 401 here proves both that the route is
    # registered on the deployed server AND that the admin gate is active — the
    # exact "is the endpoint deployed / is the gate wired" signal.
    @{
        Name           = 'dashboard runtime-health admin gate (GET /api/dash/system/runtime)'
        Path           = '/api/dash/system/runtime'
        Method         = 'GET'
        ExpectStatus   = 401
    }
    @{
        Name           = 'dashboard DR-readiness admin gate (GET /api/dash/dr-readiness)'
        Path           = '/api/dash/dr-readiness'
        Method         = 'GET'
        ExpectStatus   = 401
    }
)

if ($IncludeWebhookProbe) {
    $serverProbes += @{
        Name           = 'billing webhook (POST /api/billing/webhook/stripe, unsigned body)'
        Path           = '/api/billing/webhook/stripe'
        Method         = 'POST'
        Body           = '{"id":"evt_test","type":"ping"}'
        ContentType    = 'application/json'
        ExpectStatus   = 400
    }
}

# ---------------------------------------------------------------------------
# Probe runners
# ---------------------------------------------------------------------------

# why: Invoke-WebRequest's -SkipHttpErrorCheck (PowerShell 7+) lets us inspect
# 4xx/5xx responses without try/catch noise. The auth-gate and edge probes
# expect 401 / 403, so treating non-2xx as a thrown exception would invert the
# pass/fail semantics for those cases.
function Invoke-Probe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Url,
        [Parameter(Mandatory)] [string] $Method,
        [Parameter(Mandatory)] [int] $ExpectStatus,
        [string] $ExpectContains,
        [hashtable] $Headers,
        [string] $Body,
        [string] $ContentType
    )

    $startTime = Get-Date
    $invokeArgs = @{
        Uri                  = $Url
        Method               = $Method
        UserAgent            = $script:UserAgent
        TimeoutSec           = $script:RequestTimeoutSec
        SkipHttpErrorCheck   = $true
        MaximumRedirection   = 0
        ErrorAction          = 'Stop'
    }
    if ($Headers) {
        $invokeArgs.Headers = $Headers
    }
    if ($Body) {
        $invokeArgs.Body = $Body
    }
    if ($ContentType) {
        $invokeArgs.ContentType = $ContentType
    }

    try {
        $response = Invoke-WebRequest @invokeArgs
        $elapsedMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        $statusOk = $response.StatusCode -eq $ExpectStatus
        $bodyOk = -not $ExpectContains -or ($response.Content -and $response.Content -match [regex]::Escape($ExpectContains))
        return [PSCustomObject]@{
            StatusCode = $response.StatusCode
            ElapsedMs  = $elapsedMs
            StatusOk   = $statusOk
            BodyOk     = $bodyOk
            Error      = $null
        }
    }
    catch {
        $elapsedMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        return [PSCustomObject]@{
            StatusCode = 'ERROR'
            ElapsedMs  = $elapsedMs
            StatusOk   = $false
            BodyOk     = $false
            Error      = $_.Exception.Message
        }
    }
}

# why: Invoke-WebRequest in PowerShell 7.6 throws InvalidOperationException on
# any 3xx when -MaximumRedirection is 0, even with -SkipHttpErrorCheck, so a
# probe that expects a redirect reads it through HttpClient with auto-redirect
# off. Returns the same shape as Invoke-Probe.
function Invoke-RedirectProbe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Url,
        [Parameter(Mandatory)] [int] $ExpectStatus,
        [Parameter(Mandatory)] [string] $ExpectLocationPrefix
    )

    $startTime = Get-Date
    $httpHandler = [System.Net.Http.HttpClientHandler]::new()
    $httpHandler.AllowAutoRedirect = $false
    $httpClient = [System.Net.Http.HttpClient]::new($httpHandler)
    $httpClient.Timeout = [timespan]::FromSeconds($script:RequestTimeoutSec)
    $httpClient.DefaultRequestHeaders.UserAgent.ParseAdd($script:UserAgent)
    try {
        $response = $httpClient.GetAsync($Url).GetAwaiter().GetResult()
        $elapsedMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        $location = [string]$response.Headers.Location
        return [PSCustomObject]@{
            StatusCode = [int]$response.StatusCode
            ElapsedMs  = $elapsedMs
            StatusOk   = [int]$response.StatusCode -eq $ExpectStatus
            BodyOk     = $location.StartsWith($ExpectLocationPrefix)
            Error      = $null
        }
    }
    catch {
        $elapsedMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        return [PSCustomObject]@{
            StatusCode = 'ERROR'
            ElapsedMs  = $elapsedMs
            StatusOk   = $false
            BodyOk     = $false
            Error      = $_.Exception.Message
        }
    }
    finally {
        $httpClient.Dispose()
    }
}

# why: a closed origin port has no HTTP answer to check, so this opens a bare
# TCP connection. "Closed" covers both a refusal and UFW silently dropping the
# SYN (the connect never completes within the timeout).
function Test-PortClosed {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $HostAddress,
        [Parameter(Mandatory)] [int] $Port
    )

    $startTime = Get-Date
    $tcpClient = [System.Net.Sockets.TcpClient]::new()
    try {
        $connectTask = $tcpClient.ConnectAsync($HostAddress, $Port)
        $hasCompleted = $connectTask.Wait($script:PortProbeTimeoutMs)
        $isOpen = $hasCompleted -and $tcpClient.Connected
    }
    catch {
        # why: a refused connection surfaces as an AggregateException from
        # Wait(); for this probe a refusal is the passing answer, not an error.
        $isOpen = $false
    }
    finally {
        $tcpClient.Dispose()
    }
    $elapsedMs = [int]((Get-Date) - $startTime).TotalMilliseconds

    return [PSCustomObject]@{
        IsOpen    = $isOpen
        ElapsedMs = $elapsedMs
    }
}

function Write-CheckLine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [bool] $Passed,
        [Parameter(Mandatory)] [string] $StatusText,
        [Parameter(Mandatory)] [int] $ElapsedMs
    )

    $marker = if ($Passed) { '✓' } else { '✗' }
    $color = if ($Passed) { 'Green' } else { 'Red' }
    Write-Host ("  {0} {1,-65} {2,-40} {3,5}ms" -f $marker, $Name, $StatusText, $ElapsedMs) -ForegroundColor $color
}

function Format-ProbeLine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [int] $ExpectStatus,
        [string] $ExpectContains,
        [string] $ExpectLocationPrefix,
        [Parameter(Mandatory)] $Result
    )

    $passed = $Result.StatusOk -and $Result.BodyOk

    $statusText = if ($Result.StatusCode -eq 'ERROR') {
        "ERROR: $($Result.Error)"
    }
    elseif (-not $Result.StatusOk) {
        "$($Result.StatusCode) (expected $ExpectStatus)"
    }
    elseif ($ExpectLocationPrefix -and -not $Result.BodyOk) {
        "$($Result.StatusCode) but Location not '$ExpectLocationPrefix…'"
    }
    elseif ($ExpectContains -and -not $Result.BodyOk) {
        "$($Result.StatusCode) but body missing '$ExpectContains'"
    }
    else {
        "$($Result.StatusCode) ok"
    }

    Write-CheckLine -Name $Name -Passed $passed -StatusText $statusText -ElapsedMs $Result.ElapsedMs
    return $passed
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "=== Legendary Arena — API Deployment Smoke Test ===" -ForegroundColor Cyan
Write-Host "  Target : $BaseUrl" -ForegroundColor Gray
if ($OriginIp) {
    Write-Host "  Origin : $OriginIp" -ForegroundColor Gray
}
Write-Host "  Run at : $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))" -ForegroundColor Gray
Write-Host ""

$failureCount = 0
$totalProbes = 0

Write-Host "ASSETS" -ForegroundColor Cyan
foreach ($probe in $assetProbes) {
    $totalProbes++
    $result = Invoke-Probe -Url $probe.Url -Method $probe.Method `
        -ExpectStatus $probe.ExpectStatus `
        -ExpectContains $probe.ExpectContains
    $passed = Format-ProbeLine -Name $probe.Name `
        -ExpectStatus $probe.ExpectStatus `
        -ExpectContains $probe.ExpectContains `
        -Result $result
    if (-not $passed) { $failureCount++ }
}

Write-Host ""
Write-Host "SERVER" -ForegroundColor Cyan
foreach ($probe in $serverProbes) {
    $totalProbes++
    $invokeParams = @{
        Url            = "$BaseUrl$($probe.Path)"
        Method         = $probe.Method
        ExpectStatus   = $probe.ExpectStatus
    }
    if ($probe.ExpectContains) { $invokeParams.ExpectContains = $probe.ExpectContains }
    if ($probe.Body) { $invokeParams.Body = $probe.Body }
    if ($probe.ContentType) { $invokeParams.ContentType = $probe.ContentType }

    $result = Invoke-Probe @invokeParams
    $passed = Format-ProbeLine -Name $probe.Name `
        -ExpectStatus $probe.ExpectStatus `
        -ExpectContains $probe.ExpectContains `
        -Result $result
    if (-not $passed) { $failureCount++ }
}

Write-Host ""
Write-Host "EDGE" -ForegroundColor Cyan
$targetHost = ([uri]$BaseUrl).Host
$isLocalTarget = $targetHost -in @('localhost', '127.0.0.1', '::1', '[::1]')
if ($isLocalTarget) {
    Write-Host "  - skipped: $targetHost is not behind Cloudflare" -ForegroundColor Gray
}
else {
    $totalProbes++
    # why: Cloudflare answers 403 ("error code: 1000") to a request that
    # supplies its own cf-connecting-ip, before it reaches the origin. A 200
    # here would mean a caller could choose its own rate-limit key.
    $edgeName = 'client-supplied cf-connecting-ip is refused (GET /health)'
    $result = Invoke-Probe -Url "$BaseUrl/health" -Method 'GET' `
        -ExpectStatus 403 `
        -Headers @{ 'cf-connecting-ip' = '203.0.113.77' }
    $passed = Format-ProbeLine -Name $edgeName -ExpectStatus 403 -Result $result
    if (-not $passed) { $failureCount++ }
}

if ($OriginIp) {
    Write-Host ""
    Write-Host "ORIGIN" -ForegroundColor Cyan

    # why: 443 is open only to Cloudflare's ranges (UFW) and 3000 only on
    # loopback (LISTEN_HOST=127.0.0.1), so from anywhere else both must be
    # unreachable. Either one answering means a client can skip Cloudflare and
    # send its own cf-connecting-ip.
    foreach ($port in @(443, 3000)) {
        $totalProbes++
        $portResult = Test-PortClosed -HostAddress $OriginIp -Port $port
        $portStatus = if ($portResult.IsOpen) { 'OPEN (expected closed)' } else { 'closed ok' }
        Write-CheckLine -Name "origin port $port is unreachable directly" `
            -Passed (-not $portResult.IsOpen) `
            -StatusText $portStatus `
            -ElapsedMs $portResult.ElapsedMs
        if ($portResult.IsOpen) { $failureCount++ }
    }

    # why: UFW leaves 80 open to the world, which is safe only while Nginx's
    # port-80 server does nothing but redirect. A 200 here would mean port 80
    # proxies to Node, bypassing Cloudflare.
    $totalProbes++
    $result = Invoke-RedirectProbe -Url "http://$OriginIp/health" `
        -ExpectStatus 301 `
        -ExpectLocationPrefix 'https://'
    $passed = Format-ProbeLine -Name 'origin port 80 only redirects to HTTPS' `
        -ExpectStatus 301 `
        -ExpectLocationPrefix 'https://' `
        -Result $result
    if (-not $passed) { $failureCount++ }
}

Write-Host ""
Write-Host "===" -ForegroundColor Cyan
$summaryColor = if ($failureCount -eq 0) { 'Green' } else { 'Red' }
$passCount = $totalProbes - $failureCount
Write-Host "SUMMARY: $passCount/$totalProbes probes passed, $failureCount failure(s)" -ForegroundColor $summaryColor
Write-Host ""

if ($failureCount -gt 0) {
    exit 1
}
exit 0
