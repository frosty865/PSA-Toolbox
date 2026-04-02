# Install All PSA NSSM Services
# Run as Administrator
#
# This script installs and configures all PSA services using NSSM:
# - psa-back
# - psa-ollama
# - psa-pipeline
# - psa-tunnel
# - psa-library-watcher

param(
    [string]$NssmPath = "",
    [switch]$RemoveExisting = $false
)

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Error: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Find NSSM
if ([string]::IsNullOrEmpty($NssmPath)) {
    $nssmCmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($nssmCmd) {
        $NssmPath = $nssmCmd.Source
    } else {
        Write-Host "Error: NSSM not found in PATH" -ForegroundColor Red
        Write-Host "Please download NSSM from: https://nssm.cc/download" -ForegroundColor Yellow
        Write-Host "Extract nssm.exe and either:" -ForegroundColor Yellow
        Write-Host "  1. Add to PATH, or" -ForegroundColor Yellow
        Write-Host "  2. Specify -NssmPath parameter" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Using NSSM: $NssmPath" -ForegroundColor Green
Write-Host ""

# Resolve PSA System root
$PSASystemRoot = $env:PSA_SYSTEM_ROOT
if ([string]::IsNullOrEmpty($PSASystemRoot)) {
    $PSASystemRoot = "D:\PSA_System"
}

# Service configurations
$services = @(
    @{
        Name = "psa-back"
        DisplayName = "PSA Backend API"
        Description = "PSA Backend API service for ingestion, persistence, and APIs"
        PythonPath = "$PSASystemRoot\Dependencies\python\venvs\processor\Scripts\python.exe"
        AppFile = "$PSASystemRoot\psa_rebuild\services\app.py"  # Update with actual entry point
        AppDir = "$PSASystemRoot\psa_rebuild\services"
        LogDir = "$PSASystemRoot\logs"
        EnvVars = @("PYTHONPATH=$PSASystemRoot\psa_rebuild", "PSA_SYSTEM_ROOT=$PSASystemRoot")
    },
    @{
        Name = "psa-ollama"
        DisplayName = "PSA Ollama LLM Service"
        Description = "PSA Ollama LLM service for AI inference"
        PythonPath = ""  # Not Python-based
        AppFile = "C:\Program Files\Ollama\ollama.exe"  # Update with actual path
        AppArgs = "serve"
        AppDir = "$PSASystemRoot\services"
        LogDir = "$PSASystemRoot\logs"
        EnvVars = @("OLLAMA_HOST=0.0.0.0", "PSA_SYSTEM_ROOT=$PSASystemRoot")
    },
    @{
        Name = "psa-pipeline"
        DisplayName = "PSA Pipeline Processor"
        Description = "PSA Pipeline processing service for document processing"
        PythonPath = "$PSASystemRoot\Dependencies\python\venvs\processor\Scripts\python.exe"
        AppFile = "$PSASystemRoot\psa_rebuild\analytics\watcher\pipeline_watcher.py"  # Update with actual path
        AppDir = "$PSASystemRoot\psa_rebuild\analytics\watcher"
        LogDir = "$PSASystemRoot\logs"
        EnvVars = @("PYTHONPATH=$PSASystemRoot\psa_rebuild", "PSA_SYSTEM_ROOT=$PSASystemRoot")
    },
    @{
        Name = "psa-tunnel"
        DisplayName = "PSA SSH Tunnel"
        Description = "PSA SSH tunnel service for secure connections"
        PythonPath = ""  # Not Python-based
        AppFile = "C:\Windows\System32\OpenSSH\ssh.exe"  # Update with actual path
        AppArgs = "-L 5432:localhost:5432 user@remote-host -N"  # Update with actual tunnel config
        AppDir = "$PSASystemRoot\services"
        LogDir = "$PSASystemRoot\logs"
        EnvVars = @("PSA_SYSTEM_ROOT=$PSASystemRoot")
    },
    @{
        Name = "psa-library-watcher"
        DisplayName = "PSA Library Watcher"
        Description = "PSA Library watcher service for library indexing"
        PythonPath = "$PSASystemRoot\Dependencies\python\venvs\processor\Scripts\python.exe"
        AppFile = "$PSASystemRoot\psa_rebuild\analytics\watcher\library_watcher.py"  # Update with actual path
        AppDir = "$PSASystemRoot\psa_rebuild\analytics\watcher"
        LogDir = "$PSASystemRoot\logs"
        EnvVars = @("PYTHONPATH=$PSASystemRoot\psa_rebuild", "PSA_SYSTEM_ROOT=$PSASystemRoot")
    }
)

# Function to install a service
function Install-NssmService {
    param(
        [hashtable]$ServiceConfig
    )
    
    $serviceName = $ServiceConfig.Name
    Write-Host "Installing $serviceName..." -ForegroundColor Green
    
    # Remove existing service if requested or if it exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService -or $RemoveExisting) {
        Write-Host "  Removing existing service..." -ForegroundColor Yellow
        & $NssmPath remove $serviceName confirm 2>$null
        Start-Sleep -Seconds 2
    }
    
    # Determine executable and arguments
    if ($ServiceConfig.PythonPath -and (Test-Path $ServiceConfig.PythonPath)) {
        $exe = $ServiceConfig.PythonPath
        $args = "`"$($ServiceConfig.AppFile)`""
    } elseif (Test-Path $ServiceConfig.AppFile) {
        $exe = $ServiceConfig.AppFile
        $args = if ($ServiceConfig.AppArgs) { $ServiceConfig.AppArgs } else { "" }
    } else {
        Write-Host "  Error: Executable not found: $($ServiceConfig.AppFile)" -ForegroundColor Red
        return $false
    }
    
    # Verify paths exist
    if (-not (Test-Path $ServiceConfig.AppDir)) {
        Write-Host "  Warning: AppDirectory does not exist: $($ServiceConfig.AppDir)" -ForegroundColor Yellow
    }
    
    # Create log directory if it doesn't exist
    if (-not (Test-Path $ServiceConfig.LogDir)) {
        New-Item -ItemType Directory -Path $ServiceConfig.LogDir -Force | Out-Null
    }
    
    # Install service
    if ($args) {
        & $NssmPath install $serviceName $exe $args
    } else {
        & $NssmPath install $serviceName $exe
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Error: Failed to install service" -ForegroundColor Red
        return $false
    }
    
    # Configure service
    & $NssmPath set $serviceName AppDirectory $ServiceConfig.AppDir
    & $NssmPath set $serviceName DisplayName $ServiceConfig.DisplayName
    & $NssmPath set $serviceName Description $ServiceConfig.Description
    & $NssmPath set $serviceName Start SERVICE_AUTO_START
    
    # Configure logging
    $stdoutLog = Join-Path $ServiceConfig.LogDir "${serviceName}_stdout.log"
    $stderrLog = Join-Path $ServiceConfig.LogDir "${serviceName}_stderr.log"
    & $NssmPath set $serviceName AppStdout $stdoutLog
    & $NssmPath set $serviceName AppStderr $stderrLog
    & $NssmPath set $serviceName AppRotateFiles 1
    & $NssmPath set $serviceName AppRotateOnline 1
    & $NssmPath set $serviceName AppRotateSeconds 86400
    & $NssmPath set $serviceName AppRotateBytes 10485760
    
    # Set environment variables
    if ($ServiceConfig.EnvVars.Count -gt 0) {
        $envString = $ServiceConfig.EnvVars -join "`n"
        & $NssmPath set $serviceName AppEnvironmentExtra $envString
    }
    
    Write-Host "  ✓ Service installed: $serviceName" -ForegroundColor Green
    return $true
}

# Install all services
Write-Host "Installing PSA NSSM Services..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($service in $services) {
    if (Install-NssmService -ServiceConfig $service) {
        $successCount++
    } else {
        $failCount++
    }
    Write-Host ""
}

# Summary
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Installation Summary:" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "To start services:" -ForegroundColor Cyan
    foreach ($service in $services) {
        Write-Host "  Start-Service $($service.Name)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "To check status:" -ForegroundColor Cyan
    Write-Host "  Get-Service psa-back, psa-ollama, psa-pipeline, psa-tunnel, psa-library-watcher" -ForegroundColor White
}

