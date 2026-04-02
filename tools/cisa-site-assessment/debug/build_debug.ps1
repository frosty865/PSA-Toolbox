param(
  [string]$Step = "build",
  [int]$TimeoutSeconds = 120,
  [switch]$SkipLint
)

function Run-Step([string]$name, [string]$cmd, [int]$timeout = 120) {
  # Sanitize filename: replace colons and other invalid chars
  $safeName = $name -replace '[:<>"|?*]', '_'
  $logDir = Join-Path (Get-Location) "debug"
  if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
  $log = Join-Path $logDir "$safeName.log"
  Write-Host "`n=== RUN: $name (timeout: ${timeout}s) ===" -ForegroundColor Cyan
  Write-Host "CMD: $cmd" -ForegroundColor DarkGray
  
  # Use job with timeout to avoid hanging
  $workingDir = Get-Location
  $job = Start-Job -ScriptBlock {
    param($command, $workDir)
    Set-Location $workDir
    $result = @{
      Output = ""
      ExitCode = 0
    }
    try {
      $output = cmd /c "$command" 2>&1 | Out-String
      $result.Output = $output
      $result.ExitCode = $LASTEXITCODE
    } catch {
      $result.Output = $_.Exception.Message
      $result.ExitCode = 1
    }
    return $result
  } -ArgumentList $cmd, $workingDir
  
  $completed = Wait-Job -Job $job -Timeout $timeout
  if ($completed) {
    $result = Receive-Job -Job $job
    Remove-Job -Job $job
    $result.Output | Out-File -FilePath $log -Encoding utf8
    $result.Output | Write-Host
    Write-Host "EXIT: $($result.ExitCode) (log: $log)" -ForegroundColor Yellow
    if ($result.ExitCode -ne 0) { throw "$name failed" }
  } else {
    Stop-Job -Job $job
    Remove-Job -Job $job
    "TIMEOUT after ${timeout}s" | Out-File -FilePath $log -Encoding utf8
    Write-Host "TIMEOUT: $name exceeded ${timeout}s timeout" -ForegroundColor Red
    throw "$name timed out after ${timeout}s"
  }
}

function Show-FirstError([string]$name) {
  # Sanitize filename: replace colons and other invalid chars
  $safeName = $name -replace '[:<>"|?*]', '_'
  $log = Join-Path (Get-Location) "debug\$safeName.log"
  Write-Host "`n=== FIRST ERROR (best-effort) from $log ===" -ForegroundColor Magenta
  if (!(Test-Path $log)) { Write-Host "No log found."; return }

  $lines = Get-Content $log

  # Common patterns: TS compile errors, module resolution, Next route errors, ESLint failures
  $patterns = @(
    "error TS\d+",
    "Type error:",
    "Module not found:",
    "Cannot find module",
    "Export .* is not a valid Route export",
    "You are using Node\.js .* which is not supported",
    "Failed to compile",
    "Error:.*",
    "ERR_"
  )

  foreach ($p in $patterns) {
    $match = $lines | Select-String -Pattern $p -CaseSensitive:$false | Select-Object -First 1
    if ($match) {
      $i = $match.LineNumber
      $start = [Math]::Max(1, $i - 12)
      $end   = [Math]::Min($lines.Count, $i + 20)
      $slice = $lines[($start-1)..($end-1)]
      $slice | ForEach-Object { $_ }
      return
    }
  }

  # Fallback: last 80 lines
  Write-Host "(No known error pattern found. Showing last 80 lines.)" -ForegroundColor DarkYellow
  $lines | Select-Object -Last 80
}

try {
  # Identify scripts available
  $pkg = Get-Content package.json | ConvertFrom-Json
  Write-Host "`n=== package.json scripts ===" -ForegroundColor Cyan
  $pkg.scripts | ConvertTo-Json -Depth 5

  # Run doctrine-ish checks if present (don't guess; try common names and ignore missing)
  $checks = @("doctrine-check","doctrine:check","check:doctrine","quality","lint","typecheck")
  foreach ($c in $checks) {
    if ($pkg.scripts.PSObject.Properties.Name -contains $c) {
      # Skip lint if requested (it often hangs)
      if ($SkipLint -and $c -eq "lint") {
        Write-Host "`n=== SKIPPING: npm_lint (--SkipLint flag) ===" -ForegroundColor Yellow
        continue
      }
      # Use shorter timeout for lint (30s) since it often hangs
      $timeout = if ($c -eq "lint") { 30 } else { $TimeoutSeconds }
      try {
        Run-Step "npm_$c" "npm run $c" $timeout
      } catch {
        if ($c -eq "lint") {
          Write-Host "Lint timed out or failed - continuing with build..." -ForegroundColor Yellow
        } else {
          throw
        }
      }
    }
  }

  # Always run build in the end (with longer timeout - builds can take time)
  try {
    Run-Step "npm_build" "npm run build" 300
  } catch {
    Write-Host "Build failed or timed out. Check the log: .\debug\npm_build.log" -ForegroundColor Red
    throw
  }

  Write-Host "`nSUCCESS: build passed." -ForegroundColor Green
}
catch {
  Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red

  # Show first error from the most recent step logs in priority order
  $order = @("npm_doctrine-check","npm_doctrine_check","npm_check_doctrine","npm_quality","npm_lint","npm_typecheck","npm_build")
  foreach ($n in $order) {
    $safeName = $n -replace '[:<>"|?*]', '_'
    $logPath = Join-Path (Get-Location) "debug\$safeName.log"
    if (Test-Path $logPath) { Show-FirstError $n }
  }

  Write-Host "`nNext in Cursor:" -ForegroundColor Cyan
  Write-Host "1) Open the referenced file path from the FIRST error shown above." -ForegroundColor Gray
  Write-Host "2) Fix ONLY that first error. Re-run:  .\debug\build_debug.ps1" -ForegroundColor Gray
  exit 1
}
