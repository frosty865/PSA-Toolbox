# Install Pipeline Watcher as Windows Task Scheduler task
# Run as Administrator

param(
    [string]$PythonPath = "",
    [string]$WatcherPath = "",
    [string]$TaskName = "PSA Pipeline Watcher"
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

Write-Host "Installing Windows Task Scheduler task..." -ForegroundColor Green
Write-Host "  Python: $PythonPath"
Write-Host "  Watcher: $WatcherPath"
Write-Host "  Task Name: $TaskName"

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create action
$action = New-ScheduledTaskAction -Execute $PythonPath -Argument "`"$WatcherPath`"" -WorkingDirectory $watcherDir

# Create trigger (at startup)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Create principal (run whether user is logged on or not)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType ServiceAccount -RunLevel Highest

# Register task
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "PSA Pipeline Watcher - Deterministic intake controller for pipeline processing" | Out-Null

Write-Host ""
Write-Host "Task installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the task:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host ""
Write-Host "To check status:" -ForegroundColor Cyan
Write-Host "  Get-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host ""
Write-Host "To view task history:" -ForegroundColor Cyan
Write-Host "  Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational | Where-Object {`$_.Message -like `"*$TaskName*`"} | Select-Object -First 20" -ForegroundColor White

