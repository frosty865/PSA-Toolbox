$ErrorActionPreference = "Stop"

function Require-Env($name) {
  $v = [Environment]::GetEnvironmentVariable($name, "Machine")
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($name, "User") }
  if (-not $v) { throw "ERROR: $name environment variable must be set" }
  return $v
}

$PSA_SYSTEM_ROOT = Require-Env "PSA_SYSTEM_ROOT"

$svcName = "psa-ollama"
$svcDir  = Join-Path $PSA_SYSTEM_ROOT "Services\ollama"
$dataDir = Join-Path $PSA_SYSTEM_ROOT "Data\ollama"

New-Item -ItemType Directory -Force -Path $svcDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# Resolve executables
$nssm = (Get-Command nssm.exe -ErrorAction Stop).Source

# Prefer installed Ollama
$ollama = (Get-Command ollama.exe -ErrorAction Stop).Source

Write-Host "Using NSSM: $nssm"
Write-Host "Using Ollama: $ollama"
Write-Host "Service dir: $svcDir"
Write-Host "Data dir: $dataDir"

# Check if service exists using Get-Service (more reliable)
$serviceExists = $false
try {
  $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
  if ($svc) {
    $serviceExists = $true
    Write-Host "Stopping existing service..."
    try {
      $null = & $nssm stop $svcName 2>&1 | Out-Null
      Start-Sleep -Seconds 2
    } catch {
      # Service might not be running, which is fine - ignore error
    }
  }
} catch {
  # Service doesn't exist, which is fine
  $serviceExists = $false
}

# Install service if missing
if (-not $serviceExists) {
  Write-Host "Installing service..."
  & $nssm install $svcName $ollama "serve"
} else {
  Write-Host "Updating existing service configuration..."
  & $nssm set $svcName Application $ollama
  & $nssm set $svcName AppParameters "serve"
}

# Force working directory to PSA_System service folder
& $nssm set $svcName AppDirectory $svcDir

# Logs under PSA_System (avoid psa-workspace)
$logDir = Join-Path $PSA_SYSTEM_ROOT "Services\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
& $nssm set $svcName AppStdout (Join-Path $logDir "psa-ollama.stdout.log")
& $nssm set $svcName AppStderr (Join-Path $logDir "psa-ollama.stderr.log")
& $nssm set $svcName AppRotateFiles 1
& $nssm set $svcName AppRotateOnline 1
& $nssm set $svcName AppRotateSeconds 86400
& $nssm set $svcName AppRotateBytes 10485760

# Environment for the service:
# Keep it minimal and explicit.
# Model storage under PSA_System (no legacy paths).
# OLLAMA_NUM_GPU=1 forces GPU use (avoids CPU-only when discovery fails).
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir "models") | Out-Null
& $nssm set $svcName AppEnvironmentExtra `
  "PSA_SYSTEM_ROOT=$PSA_SYSTEM_ROOT" `
  "OLLAMA_MODELS=$dataDir\models" `
  "OLLAMA_HOST=127.0.0.1:11434" `
  "OLLAMA_NUM_GPU=1"

# Auto-start
& $nssm set $svcName Start SERVICE_AUTO_START

# Start it
& $nssm start $svcName

Write-Host "OK: $svcName configured and started."
