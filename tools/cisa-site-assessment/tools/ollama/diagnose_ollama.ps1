<#
.SYNOPSIS
  Diagnose why Ollama might be CPU-only: verify binary (WSL vs Windows), confirm port 11434 listener is ollama.exe.
.DESCRIPTION
  Runs definitive checks and prints pass/fail. Use before prove_gpu.ps1 to catch wrong binary or wrong process.
.PARAMETER ForceOneInstance
  Stop VOFC-Ollama service and kill all ollama.exe; you then start fresh with: ollama serve
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\diagnose_ollama.ps1
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\diagnose_ollama.ps1 -ForceOneInstance
#>
param(
  [switch]$ForceOneInstance
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0

function Write-Fail { param([string]$Msg) Write-Host "[FAIL] $Msg" -ForegroundColor Red; $script:FailCount++ }
function Write-Warn { param([string]$Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Write-Ok   { param([string]$Msg) Write-Host "[OK]   $Msg" -ForegroundColor Green }

# ---------------------------------------------------------------------------
# 1) Which ollama binary is running (WSL vs Windows)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== 1) Ollama binary (WSL vs Windows) ===" -ForegroundColor Cyan
$where = (where.exe ollama 2>$null)
$cmdSource = $null
try { $cmdSource = (Get-Command ollama -ErrorAction SilentlyContinue).Source } catch {}
if ($where) { Write-Host $where }
if ($cmdSource) { Write-Host "Get-Command: $cmdSource" }

$binarySuspicious = $false
if (-not $where -and -not $cmdSource) {
  Write-Fail "No ollama in PATH."
  $binarySuspicious = $true
} else {
  $combined = "$where $cmdSource"
  if ($combined -match "\\\\wsl\$|/wsl/|wsl\.exe") {
    Write-Fail "Ollama path looks like WSL (\\wsl$\...). Use the Windows native installer for GPU."
    $binarySuspicious = $true
  }
  if ($combined -match "WindowsApps\\ollama\.exe|Microsoft\.WindowsApps") {
    Write-Warn "Ollama may be the WindowsApps stub. For GPU use the full install from https://ollama.com/download"
    $binarySuspicious = $true
  }
  if (-not $binarySuspicious) { Write-Ok "Binary path does not look like WSL/stub." }
}

# ---------------------------------------------------------------------------
# 2) Server on 127.0.0.1:11434 and PID = ollama.exe?
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== 2) Who is listening on 127.0.0.1:11434? ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
  Write-Ok "Ollama API reachable (api/tags)."
} catch {
  Write-Fail "Ollama API not reachable on 127.0.0.1:11434. Start 'ollama serve' or your service."
  if ($ForceOneInstance) {
    Write-Host "ForceOneInstance: stopping service and killing ollama..." -ForegroundColor Yellow
    sc.exe stop "VOFC-Ollama" 2>$null
    taskkill /F /IM ollama.exe 2>$null
    Write-Host "Start a fresh server in another window: ollama serve" -ForegroundColor Yellow
  }
  exit 2
}

$netstatOut = & netstat -ano 2>$null
$lines11434 = $netstatOut | Select-String -Pattern ":11434\s+.*LISTENING"
$pids = @()
foreach ($line in $lines11434) {
  if ($line -match "\s+(\d+)\s*$") { $pids += [int]$Matches[1] }
}
$pids = $pids | Sort-Object -Unique

if ($pids.Count -eq 0) {
  Write-Fail "No process found listening on port 11434 (netstat)."
} else {
  Write-Host "PIDs listening on :11434: $($pids -join ', ')"
  $allOllama = $true
  foreach ($listenerPid in $pids) {
    $tl = & tasklist /FI "PID eq $listenerPid" /FO CSV /NH 2>$null
    $name = ""
    if ($tl -match '"([^"]+)"') { $name = $Matches[1] }
    if ($name -eq "ollama.exe") {
      Write-Ok "PID $listenerPid is ollama.exe."
    } else {
      Write-Fail "PID $listenerPid is '$name' (expected ollama.exe). You may be hitting a different server."
      $allOllama = $false
    }
  }
  if ($allOllama -and $pids.Count -gt 0) { Write-Ok "All listeners on 11434 are ollama.exe." }
}

# ---------------------------------------------------------------------------
# 3) Optional: force one instance only
# ---------------------------------------------------------------------------
if ($ForceOneInstance) {
  Write-Host ""
  Write-Host "=== 3) Force one instance (kill all + you start fresh) ===" -ForegroundColor Cyan
  sc.exe query 2>$null | Select-String -Pattern "ollama" -SimpleMatch | ForEach-Object { Write-Host $_.Line }
  Write-Host "Stopping VOFC-Ollama (if present) and killing all ollama.exe..."
  sc.exe stop "VOFC-Ollama" 2>$null
  taskkill /F /IM ollama.exe 2>$null
  Write-Ok "Done. In a second window run: ollama serve"
  Write-Host "Then run inference and watch logs for CUDA/GPU. Re-run prove_gpu.ps1 after."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($script:FailCount -gt 0) {
  Write-Host "Diagnosis: $script:FailCount check(s) failed. Fix binary or listener before expecting GPU." -ForegroundColor Red
  Write-Host "If CPU-only build confirmed: uninstall Ollama, remove %LOCALAPPDATA%\Programs\Ollama and \Ollama, reinstall from https://ollama.com/download"
  exit 1
}
Write-Host "Binary and listener look correct. If prove_gpu still fails, run Ollama in foreground (ollama serve) and check logs for CUDA/GPU."
exit 0
