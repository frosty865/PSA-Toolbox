# Shared helpers for tools\validation\*.ps1. Dot-source from each script; do not run directly.
# Usage: . (Join-Path $PSScriptRoot "_ValidationCommon.ps1")

$script:ValidationExcludeDirs = @(
    "node_modules", ".git", "dist", ".next", "out", ".build-tmp", ".venv-reporter",
    "archive", "__pycache__", ".pnpm-store"
)

function Get-ValidationRepoRoot {
    param([string]$FromScriptRoot, [string]$Override)
    if ($Override) { return $Override }
    if (-not $FromScriptRoot) { return $null }
    Split-Path (Split-Path $FromScriptRoot -Parent) -Parent
}

function Get-ValidationOutDir {
    param([string]$RepoRoot)
    Join-Path $RepoRoot "tools\validation\out"
}

function Ensure-ValidationOutDir {
    param([string]$RepoRoot)
    $out = Get-ValidationOutDir -RepoRoot $RepoRoot
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    $out
}

function Test-ValidationExcludedPath {
    param([string]$RelativePath)
    foreach ($ex in $script:ValidationExcludeDirs) {
        if ($RelativePath -match "\\$ex\\" -or $RelativePath.StartsWith("$ex\") -or $RelativePath.StartsWith("$ex/")) {
            return $true
        }
    }
    $false
}

function Get-RepoFilesExcludingBuild {
    param([string]$RepoRoot, [string[]]$IncludeExtensions = $null)
    $rootLen = $RepoRoot.Length + 1
    Get-ChildItem -Path $RepoRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $rel = $_.FullName.Substring($rootLen)
        if (Test-ValidationExcludedPath -RelativePath $rel) { return $false }
        if ($IncludeExtensions) {
            $ext = $_.Extension
            if ($ext -notin $IncludeExtensions) { return $false }
        }
        $true
    }
}

function Write-ValidationReport {
    param([string]$Path, [string[]]$Lines)
    $Lines | Set-Content -Path $Path -Encoding UTF8
}

function Read-DocxZipEntry {
    param([string]$DocxPath, [string]$EntryName)
    if (-not (Test-Path $DocxPath)) { return $null }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)
    try {
        $entry = $zip.GetEntry($EntryName)
        if (-not $entry) { return $null }
        $sr = New-Object System.IO.StreamReader($entry.Open())
        try { $sr.ReadToEnd() } finally { $sr.Close() }
    } finally { $zip.Dispose() }
}
