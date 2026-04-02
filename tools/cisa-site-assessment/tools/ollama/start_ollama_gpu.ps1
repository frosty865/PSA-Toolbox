<#
.SYNOPSIS
  Start Ollama in foreground with env vars that force GPU use (for when discovery shows initial_count=0).
.DESCRIPTION
  Sets OLLAMA_NUM_GPU=1 and debug logging, then runs ollama serve.
  By default does NOT set CUDA_VISIBLE_DEVICES (Ollama warns: if GPUs not discovered, unset and try again).
  Use -SetCudaVisibleDevices to force CUDA_VISIBLE_DEVICES=0 (try this if discovery works but wrong GPU).
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\start_ollama_gpu.ps1
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\start_ollama_gpu.ps1 -SetCudaVisibleDevices
#>
param(
  [switch]$SetCudaVisibleDevices
)

$env:OLLAMA_DEBUG = "1"
$env:OLLAMA_LOG_LEVEL = "debug"
$env:OLLAMA_NUM_GPU = "1"
$env:OLLAMA_HOST = "127.0.0.1:11434"
if ($SetCudaVisibleDevices) {
  $env:CUDA_VISIBLE_DEVICES = "0"
  Write-Host "[Ollama] Starting with OLLAMA_NUM_GPU=1, CUDA_VISIBLE_DEVICES=0" -ForegroundColor Cyan
} else {
  Remove-Item Env:CUDA_VISIBLE_DEVICES -ErrorAction SilentlyContinue
  Write-Host "[Ollama] Starting with OLLAMA_NUM_GPU=1 (CUDA_VISIBLE_DEVICES unset per Ollama warning)" -ForegroundColor Cyan
}
Write-Host "[Ollama] Watch logs for 'initial_count=1' (or higher) and 'library=cuda' instead of 'library=cpu'" -ForegroundColor Cyan
& ollama serve
