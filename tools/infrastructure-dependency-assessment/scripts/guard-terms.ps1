<#
.SYNOPSIS
Guard script to detect forbidden terms in repo code and docs.

.DESCRIPTION
Scans the repo for terms that violate WEB-ONLY architecture.
Forbidden terms: "standalone", "static export", "output: export", "dist/", "IndexedDB (as offline runtime)", "no server required"

.PARAMETER RepoRoot
Path to repo root. Defaults to current directory.

.EXAMPLE
./scripts/guard-terms.ps1 -RepoRoot (Get-Location)

.EXIT CODES
0 = Pass (no violations)
1 = Fail (violations found)
#>

param(
    [string]$RepoRoot = (Get-Location).Path
)

$forbiddenPatterns = @(
    "standalone",
    "static[\s-]export",
    "output:\s*[""']export[""']",
    "dist/",
    "IndexedDB.*offline[\s]?runtime",
    "no[\s]?server[\s]?required"
)

$excludeDirs = @(
    "node_modules",
    ".next",
    ".git",
    ".turbo",
    ".vercel",
    "dist",
    "build"
)

$fileExtensions = @("*.md", "*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.ps1")

$violations = @()

Write-Host "🔍 Scanning repo for forbidden terms..." -ForegroundColor Cyan

foreach ($pattern in $forbiddenPatterns) {
    $params = @{
        Path        = $RepoRoot
        Recurse     = $true
        Include     = $fileExtensions
        ErrorAction = "SilentlyContinue"
    }
    
    Get-ChildItem @params | Where-Object {
        $excluded = $false
        foreach ($excludeDir in $excludeDirs) {
            if ($_.FullName -match [regex]::Escape($excludeDir)) {
                $excluded = $true
                break
            }
        }
        return -not $excluded
    } | ForEach-Object {
        $content = Get-Content -Path $_.FullName -ErrorAction SilentlyContinue
        if ($content) {
            $lineNumber = 1
            $content -split "`n" | ForEach-Object {
                if ($_ -match $pattern) {
                    $violations += @{
                        File   = $_.FullName -replace [regex]::Escape($RepoRoot), "."
                        Line   = $lineNumber
                        Match  = $_
                        Pattern = $pattern
                    }
                }
                $lineNumber++
            }
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "✅ No forbidden terms detected." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "❌ $($violations.Count) violation(s) found:" -ForegroundColor Red
    Write-Host ""
    
    foreach ($violation in $violations) {
        Write-Host "  File: $($violation.File)" -ForegroundColor Yellow
        Write-Host "  Line: $($violation.Line)" -ForegroundColor Yellow
        Write-Host "  Match: $($violation.Match.Trim())" -ForegroundColor Red
        Write-Host "  Pattern: '$($violation.Pattern)'" -ForegroundColor DarkGray
        Write-Host ""
    }
    
    exit 1
}
