# Install Pipeline Watcher as Windows Service using NSSM
# Run as Administrator
#
# DEPRECATED: This script is service-specific and will be removed in future versions.
# Use scripts/install_nssm_services.ps1 for unified service installation.

param(
    [string]$PythonPath = "",
    [string]$WatcherPath = "",
    [string]$ServiceName = "PipelineWatcher"
)

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Error: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$watcherDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $watcherDir)

# Determine Python path
if ([string]::IsNullOrEmpty($PythonPath)) {
    # Try to find Python in common locations
    $pythonExe = "python.exe"
    $pythonPaths = @(
        "$repoRoot\venv\Scripts\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "C:\Python*\python.exe",
        "$env:ProgramFiles\Python*\python.exe"
    )
    
    foreach ($path in $pythonPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $PythonPath = $resolved[0].Path
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($PythonPath)) {
        # Try to find python in PATH
        $pythonInPath = Get-Command python.exe -ErrorAction SilentlyContinue
        if ($pythonInPath) {
            $PythonPath = $pythonInPath.Source
        } else {
            Write-Host "Error: Python not found. Please specify -PythonPath" -ForegroundColor Red
            exit 1
        }
    }
}

# Determine watcher path
if ([string]::IsNullOrEmpty($WatcherPath)) {
    $WatcherPath = Join-Path $watcherDir "pipeline_watcher.py"
}

if (-not (Test-Path $PythonPath)) {
    Write-Host "Error: Python not found at: $PythonPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $WatcherPath)) {
    Write-Host "Error: Watcher script not found at: $WatcherPath" -ForegroundColor Red
    exit 1
}

Write-Host "Installing Windows Service..." -ForegroundColor Green
Write-Host "  Python: $PythonPath"
Write-Host "  Watcher: $WatcherPath"
Write-Host "  Service Name: $ServiceName"

# Check if NSSM is available
$nssmPath = Get-Command nssm.exe -ErrorAction SilentlyContinue
if (-not $nssmPath) {
    Write-Host ""
    Write-Host "NSSM (Non-Sucking Service Manager) not found in PATH" -ForegroundColor Yellow
    Write-Host "Please download NSSM from: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Extract nssm.exe and either:" -ForegroundColor Yellow
    Write-Host "  1. Add to PATH, or" -ForegroundColor Yellow
    Write-Host "  2. Place in: $watcherDir\scripts\" -ForegroundColor Yellow
    Write-Host ""
    
    $nssmLocal = Join-Path $scriptDir "nssm.exe"
    if (Test-Path $nssmLocal) {
        $nssmPath = $nssmLocal
        Write-Host "Using local NSSM: $nssmLocal" -ForegroundColor Green
    } else {
        Write-Host "Error: NSSM not found. Please install NSSM first." -ForegroundColor Red
        exit 1
    }
} else {
    $nssmPath = $nssmPath.Source
}

# Remove existing service if it exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    & $nssmPath remove $ServiceName confirm
    Start-Sleep -Seconds 2
}

# Install service
Write-Host "Installing service..." -ForegroundColor Green
& $nssmPath install $ServiceName $PythonPath "$WatcherPath"

# Configure service
Write-Host "Configuring service..." -ForegroundColor Green
& $nssmPath set $ServiceName AppDirectory $watcherDir
& $nssmPath set $ServiceName DisplayName "PSA Pipeline Watcher"
& $nssmPath set $ServiceName Description "Deterministic intake controller for pipeline processing"
& $nssmPath set $ServiceName Start SERVICE_AUTO_START
& $nssmPath set $ServiceName AppStdout (Join-Path $watcherDir "watcher_stdout.log")
& $nssmPath set $ServiceName AppStderr (Join-Path $watcherDir "watcher_stderr.log")
& $nssmPath set $ServiceName AppRotateFiles 1
& $nssmPath set $ServiceName AppRotateOnline 1
& $nssmPath set $ServiceName AppRotateSeconds 86400
& $nssmPath set $ServiceName AppRotateBytes 10485760

# Set environment variables
$env:PYTHONPATH = $repoRoot
& $nssmPath set $ServiceName AppEnvironmentExtra "PYTHONPATH=$repoRoot"

Write-Host ""
Write-Host "Service installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the service:" -ForegroundColor Cyan
Write-Host "  Start-Service $ServiceName" -ForegroundColor White
Write-Host "  # or" -ForegroundColor Gray
Write-Host "  net start $ServiceName" -ForegroundColor White
Write-Host ""
Write-Host "To check status:" -ForegroundColor Cyan
Write-Host "  Get-Service $ServiceName" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Cyan
Write-Host "  Get-Content $watcherDir\watcher_stdout.log -Tail 50 -Wait" -ForegroundColor White

