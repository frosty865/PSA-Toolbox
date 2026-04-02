# Update psaback References to Tech_Sources

After moving Tech_Sources to `D:\PSA_System\psa_rebuild\psaback\Tech_Sources`, update these files in psaback:

## Files to Update

### 1. `services/pipeline_watcher.py`

Find and replace:
- `D:\PSA_System\Tech_Sources` → `D:\PSA_System\psa_rebuild\psaback\Tech_Sources`
- Or use relative path: `Tech_Sources` (if running from psaback root)

### 2. Configuration Files

Check these files for Tech_Sources paths:
- `.env`
- `local.env`
- `config/*.json` or `config/*.yaml`
- Any startup scripts

### 3. Other Python Files

Search for Tech_Sources references:
```powershell
cd D:\PSA_System\psa_rebuild\psaback
findstr /s /i "Tech_Sources" *.py
```

## Quick Update Script

Run this in psaback directory:

```powershell
# PowerShell
Get-ChildItem -Recurse -Include *.py,*.env,*.json,*.yaml,*.ps1,*.bat | 
    ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        if ($content -match "D:\\psa-workspace\\Tech_Sources") {
            $newContent = $content -replace "D:\\PSA_System\\Tech_Sources", "D:\PSA_System\psa_rebuild\psaback\Tech_Sources"
            Set-Content -Path $_.FullName -Value $newContent -NoNewline
            Write-Host "Updated: $($_.FullName)"
        }
    }
```

## Verify

After updating, verify paths:
```powershell
cd D:\PSA_System\psa_rebuild\psaback
findstr /s /i "Tech_Sources" *.py *.env
```

All references should point to `psaback\Tech_Sources`.

