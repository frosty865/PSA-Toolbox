# Start Pipeline Watcher (Windows)
# Can be run as regular user or as service

param(
    [string]$PythonPath = "",
    [string]$WatcherPath = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$watcherDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $watcherDir)
$pidFile = Join-Path $watcherDir "watcher.pid"
$logFile = Join-Path $watcherDir "watcher.log"

# Check if already running
if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Watcher is already running (PID: $pid)" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "Stale PID file found, removing..." -ForegroundColor Yellow
        Remove-Item $pidFile
    }
}

# Determine Python path
if ([string]::IsNullOrEmpty($PythonPath)) {
    $pythonPaths = @(
        "$repoRoot\venv\Scripts\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "C:\Python*\python.exe"
    )
    
    foreach ($path in $pythonPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $PythonPath = $resolved[0].Path
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($PythonPath)) {
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

# Set environment
$env:PYTHONPATH = $repoRoot

# Start watcher
Write-Host "Starting Pipeline Watcher..." -ForegroundColor Green
Write-Host "  Python: $PythonPath"
Write-Host "  Watcher: $WatcherPath"
Write-Host "  Log: $logFile"

$process = Start-Process -FilePath $PythonPath -ArgumentList "`"$WatcherPath`"" -WorkingDirectory $watcherDir -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile

# Save PID
$process.Id | Out-File -FilePath $pidFile -Encoding ASCII

# Wait and verify
Start-Sleep -Seconds 2
if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
    Write-Host "Watcher started successfully (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "Logs: $logFile" -ForegroundColor Cyan
} else {
    Write-Host "Error: Watcher failed to start" -ForegroundColor Red
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    exit 1
}

