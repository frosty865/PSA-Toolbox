# Pipeline Watcher - Windows Deployment Guide

Quick reference for deploying the Pipeline Watcher on Windows.

## Quick Start

### Option 1: NSSM Service (Recommended)

**Install:**
```powershell
# Run PowerShell as Administrator
cd analytics\watcher\scripts
.\install_windows_service.ps1
```

**Manage:**
```powershell
# Start
Start-Service PipelineWatcher

# Stop
Stop-Service PipelineWatcher

# Status
Get-Service PipelineWatcher

# View logs
Get-Content D:\PSA_System\psa_rebuild\analytics\watcher\watcher_stdout.log -Tail 50 -Wait
```

### Option 2: Task Scheduler

**Install:**
```powershell
# Run PowerShell as Administrator
cd analytics\watcher\scripts
.\install_task_scheduler.ps1
```

**Manage:**
```powershell
# Start
Start-ScheduledTask -TaskName "PSA Pipeline Watcher"

# Status
Get-ScheduledTask -TaskName "PSA Pipeline Watcher"
```

### Option 3: Manual Scripts

**Start:**
```powershell
.\analytics\watcher\scripts\start_watcher.ps1
```

**Stop:**
```powershell
.\analytics\watcher\scripts\stop_watcher.ps1
```

**Check:**
```powershell
.\analytics\watcher\scripts\check_watcher.ps1
```

## Prerequisites

1. **Python installed** (detected automatically)
   - Python 3.8+ required
   - Virtual environment recommended

2. **NSSM** (for service option)
   - Download: https://nssm.cc/download
   - Extract `nssm.exe` to `analytics\watcher\scripts\`
   - Or add to system PATH

## Installation Details

### NSSM Service

The `install_windows_service.ps1` script:
- Auto-detects Python installation
- Auto-detects watcher script location
- Creates Windows service named "PipelineWatcher"
- Configures auto-start on boot
- Sets up log rotation
- Configures environment variables

**Service Properties:**
- **Name:** PipelineWatcher
- **Display Name:** PSA Pipeline Watcher
- **Startup Type:** Automatic
- **Logs:** `analytics\watcher\watcher_stdout.log` and `watcher_stderr.log`
- **Log Rotation:** Daily, 10MB max

### Task Scheduler

The `install_task_scheduler.ps1` script:
- Creates scheduled task
- Triggers on system startup
- Runs whether user is logged on or not
- Auto-restarts on failure (3 attempts, 1 minute interval)

## Troubleshooting

### Service Won't Start

1. Check Python path:
```powershell
Get-Service PipelineWatcher | Select-Object -ExpandProperty Status
Get-Content D:\PSA_System\psa_rebuild\analytics\watcher\watcher_stderr.log
```

2. Test watcher manually:
```powershell
cd D:\PSA_System\psa_rebuild\analytics\watcher
python pipeline_watcher.py --once
```

3. Check permissions:
```powershell
# Ensure service account has access to directories
icacls D:\PSA_System\psa_rebuild\analytics /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F"
```

### Task Scheduler Issues

1. Check task status:
```powershell
Get-ScheduledTask -TaskName "PSA Pipeline Watcher" | Select-Object State, LastRunTime, LastTaskResult
```

2. View task history:
```powershell
Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational | 
    Where-Object {$_.Message -like "*PSA Pipeline Watcher*"} | 
    Select-Object TimeCreated, Message | 
    Format-Table -AutoSize
```

### Python Not Found

1. Check Python installation:
```powershell
where.exe python.exe
python --version
```

2. Specify Python path manually:
```powershell
.\install_windows_service.ps1 -PythonPath "C:\Python39\python.exe"
```

### Permission Issues

1. Run scripts as Administrator:
   - Right-click PowerShell
   - Select "Run as Administrator"

2. Grant directory permissions:
```powershell
$path = "D:\PSA_System\psa_rebuild\analytics"
icacls $path /grant "$env:USERNAME:(OI)(CI)F" /T
```

## Verification

After installation, verify the watcher is running:

```powershell
# Check service
Get-Service PipelineWatcher

# Check process
Get-Process | Where-Object {$_.ProcessName -eq "python" -and $_.CommandLine -like "*pipeline_watcher*"}

# Check logs
Get-Content D:\PSA_System\psa_rebuild\analytics\watcher\watcher_stdout.log -Tail 20

# Test health check
.\analytics\watcher\scripts\check_watcher.ps1
```

## Auto-Start on Boot

Both NSSM service and Task Scheduler are configured to start automatically on boot:

- **NSSM:** Service startup type is set to "Automatic"
- **Task Scheduler:** Trigger is set to "At startup"

No additional configuration needed.

## Log Locations

- **Service logs (NSSM):**
  - `analytics\watcher\watcher_stdout.log`
  - `analytics\watcher\watcher_stderr.log`

- **Script logs (manual):**
  - `analytics\watcher\watcher.log`

- **Watcher state:**
  - `analytics\watcher\watcher_state.json`
  - `analytics\watcher\intake_manifest.json`

## Uninstallation

### Remove NSSM Service

```powershell
# Stop service
Stop-Service PipelineWatcher

# Remove service
nssm.exe remove PipelineWatcher confirm
```

### Remove Task Scheduler Task

```powershell
Unregister-ScheduledTask -TaskName "PSA Pipeline Watcher" -Confirm:$false
```

