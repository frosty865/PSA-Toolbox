# Clear Next.js .next cache so changes replicate when dev server restarts.
# Run when: "changes are not showing" or you suspect stale build/cache.
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$nextDir = "apps\web\.next"
if (Test-Path $nextDir) {
  Remove-Item -Recurse -Force $nextDir
  Write-Host "Cleared $nextDir"
} else {
  Write-Host "No $nextDir folder found"
}
