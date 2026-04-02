<#
.SYNOPSIS
  Prove that Ollama is using the GPU (CUDA) on Windows (WDDM).
  Runs a sustained inference and polls nvidia-smi for ollama process/VRAW usage.
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\prove_gpu.ps1 -Model llama3.1:8b-instruct -Seconds 25
#>
param(
  [string]$Model = "llama3.1:8b-instruct",
  [int]$Seconds = 20
)

Write-Host "[1/5] Checking ollama binary..."
where.exe ollama | Out-Host
ollama --version | Out-Host

Write-Host "[2/5] Checking Ollama server reachable..."
try {
  $r = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
  Write-Host "[OK] Ollama API reachable."
} catch {
  Write-Host "[FAIL] Ollama API not reachable on 127.0.0.1:11434. Start 'ollama serve' or your service." -ForegroundColor Red
  exit 2
}

Write-Host "[3/5] Starting a sustained inference workload ($Seconds seconds) ..."
# Long-ish prompt so inference lasts long enough to observe GPU
$prompt = "Write a detailed 1200-word operational assessment of EV incident response considerations, including site zoning, egress, responder coordination, and contingency operations."
$job = Start-Job -ScriptBlock {
  param($m,$p)
  & ollama run $m $p | Out-Null
} -ArgumentList $Model,$prompt

Start-Sleep -Seconds 2

Write-Host "[4/5] Polling nvidia-smi for $Seconds seconds to detect ollama VRAM use..."
$end = (Get-Date).AddSeconds($Seconds)
$found = $false

$poll = 0
while((Get-Date) -lt $end) {
  # On WDDM, ollama should appear in process list if using CUDA.
  $out = & nvidia-smi
  if ($out -match "ollama" -or $out -match "Ollama") { $found = $true }
  # Avoid Clear-Host: fails when run non-interactively (e.g. Cursor terminal) with "The handle is invalid".
  $poll++
  Write-Host "  Poll $poll/$Seconds - ollama in nvidia-smi: $found"
  Start-Sleep -Milliseconds 1000
}

Write-Host "[5/5] Cleaning up..."
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue

if (-not $found) {
  Write-Host ""
  Write-Host "[FAIL] No 'ollama' process observed in nvidia-smi during inference." -ForegroundColor Red
  Write-Host "This usually means CPU-only inference or the wrong ollama instance." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "[OK] 'ollama' appeared in nvidia-smi during inference. GPU is being used." -ForegroundColor Green
exit 0
