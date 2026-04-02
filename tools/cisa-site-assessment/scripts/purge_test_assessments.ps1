<# 
  Purge test assessments via POST /api/runtime/admin/purge-test-assessments

  Remote / non-local dev requires the same token as server env ADMIN_API_TOKEN:
    $env:PSA_ADMIN_API_TOKEN = "<same as server ADMIN_API_TOKEN>"
    $env:PSA_CISA_BASE = "https://cisa.zophielgroup.com/cisa-site-assessment"
    .\scripts\purge_test_assessments.ps1 -DryRun

  Or: -AdminToken "<token>" (avoid echoing in shared history)

  Local dev (localhost, NODE_ENV=development) may bypass token when ADMIN_API_TOKEN is unset on server.

  Usage:
    .\scripts\purge_test_assessments.ps1 -DryRun
    .\scripts\purge_test_assessments.ps1 -Execute

  Optional filters:
    .\scripts\purge_test_assessments.ps1 -DryRun -OlderThanDays 30 -Limit 100
#>
param(
  [switch] $DryRun,
  [switch] $Execute,
  [int] $OlderThanDays = 0,
  [int] $Limit = 0,
  [string] $TestRunId = "",
  [string] $AdminToken = ""
)

$ErrorActionPreference = "Stop"

$base = $env:PSA_CISA_BASE
if (-not $base -or $base.Trim() -eq "") {
  $base = "http://localhost:3001/cisa-site-assessment"
  Write-Host "PSA_CISA_BASE not set; using $base" -ForegroundColor Yellow
}
$base = $base.TrimEnd("/")
$uri = "$base/api/runtime/admin/purge-test-assessments/"

if (-not $DryRun -and -not $Execute) {
  Write-Host "Specify -DryRun or -Execute" -ForegroundColor Red
  exit 1
}
if ($DryRun -and $Execute) {
  Write-Host "Use only one of -DryRun or -Execute" -ForegroundColor Red
  exit 1
}

$mode = if ($DryRun) { "DRY_RUN" } else { "EXECUTE" }
$body = @{ mode = $mode }
if ($OlderThanDays -gt 0) { $body.older_than_days = $OlderThanDays }
if ($Limit -gt 0) { $body.limit = $Limit }
if ($TestRunId -ne "") { $body.test_run_id = $TestRunId }

$json = $body | ConvertTo-Json -Compress

$token = $AdminToken
if (-not $token) { $token = $env:PSA_ADMIN_API_TOKEN }
if (-not $token) { $token = $env:ADMIN_API_TOKEN }

$headers = @{}
if ($token) {
  $headers["x-admin-api-token"] = $token
}

Write-Host "POST $uri" -ForegroundColor Cyan
Write-Host "Body: $json"
if (-not $token) {
  Write-Host "No PSA_ADMIN_API_TOKEN / ADMIN_API_TOKEN / -AdminToken — request may fail with 401 on production." -ForegroundColor Yellow
}

try {
  $irm = @{
    Uri         = $uri
    Method      = "POST"
    ContentType = "application/json; charset=utf-8"
    Body        = $json
  }
  if ($headers.Count -gt 0) {
    $irm.Headers = $headers
  }
  $result = Invoke-RestMethod @irm
  $result | ConvertTo-Json -Depth 10
} catch {
  $err = $_.Exception
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message -ForegroundColor Red
  }
  throw
}
