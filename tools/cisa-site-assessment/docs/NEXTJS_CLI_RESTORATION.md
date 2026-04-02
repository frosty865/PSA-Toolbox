# Next.js CLI Restoration Guide

## Goal
Restore Next.js CLI + get `npm run build` to reach Next compilation under Node 20 LTS on Windows.

## Prerequisites

1. **nvm-windows must be installed** (check with `nvm version`)
2. **Close ALL terminals** after any nvm operations (PATH refresh required)

## Step-by-Step Instructions

### Step 1: Switch to Node 20 LTS

**In a new PowerShell (after closing all terminals):**

```powershell
# Verify nvm is available
nvm version

# Install Node 20 (if not already installed)
nvm install 20

# Switch to Node 20
nvm use 20

# Verify Node version
node -v
# Should show: v20.x.x

npm -v

# Verify node is from nvm (not system installation)
where.exe node
# Should show path in: C:\Users\<username>\AppData\Roaming\nvm\...
```

**If `where node` shows a system path first:**
- Close terminal and reopen
- Or uninstall system Node.js from Control Panel

### Step 2: Clean Reinstall Dependencies

**Navigate to repo:**
```powershell
cd D:\PSA_System\psa_rebuild
```

**Hard clean:**
```powershell
# Remove node_modules
if (Test-Path node_modules) { 
    Remove-Item -Recurse -Force node_modules 
}

# Remove package-lock.json
if (Test-Path package-lock.json) { 
    Remove-Item -Force package-lock.json 
}
```

**Clean npm cache:**
```powershell
npm cache verify
npm cache clean --force
```

**Reinstall dependencies:**
```powershell
npm install
```

**Verify Next.js installation:**
```powershell
# Check if next.cmd exists
Test-Path .\node_modules\.bin\next.cmd

# Check Next.js version
node -p "require('next/package.json').version"

# Verify installation is valid (should NOT say "invalid")
npm ls next
```

### Step 3: Verification Checks

```powershell
# Next binary should exist
Test-Path .\node_modules\.bin\next.cmd
# Should return: True

# List Next.js binaries
dir .\node_modules\.bin\ | findstr /i next

# Next version via CLI
npx --no-install next --version

# Verify next resolves from node_modules
where.exe next
# Should show: D:\PSA_System\psa_rebuild\node_modules\.bin\next.cmd
```

### Step 4: Test Build

```powershell
npm run build
```

**Success criteria:** Build reaches Next.js compilation (even if TypeScript/ESLint errors occur later).

### Step 5: Hardening (Already Applied)

The following hardening measures are already in place:

- ✅ `.nvmrc` file exists with `20`
- ✅ `package.json` has `engines.node: ">=20 <21"`
- ⚠️ `engine-strict` needs to be set (see below)

**Set engine-strict (run once):**
```powershell
npm config set engine-strict true

# Verify
npm config get engine-strict
# Should return: true
```

## Automated Script

A PowerShell script is available at `scripts/restore_nextjs_cli.ps1` that automates steps 2-4.

**Usage (after switching to Node 20):**
```powershell
cd D:\PSA_System\psa_rebuild
.\scripts\restore_nextjs_cli.ps1
```

## Troubleshooting

### "next is not recognized" after reinstall

1. **Verify you're in the correct directory:**
   ```powershell
   Get-Location
   # Should be: D:\PSA_System\psa_rebuild
   ```

2. **Check if next.cmd exists:**
   ```powershell
   Test-Path .\node_modules\.bin\next.cmd
   ```

3. **If missing, reinstall:**
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Force package-lock.json
   npm install
   ```

### Node version mismatch

If you see `EBADENGINE` warnings:
- Ensure you're using Node 20: `nvm use 20`
- Verify: `node -v` should show `v20.x.x`

### nvm command not found

1. Close ALL terminals
2. Reopen PowerShell
3. If still not found, check PATH:
   ```powershell
   $env:Path -split ';' | Select-String -Pattern "nvm"
   ```
4. If nvm is not in PATH, reinstall nvm-windows (see `docs/NVM_REINSTALL.md`)

## Current Status

- ✅ `.nvmrc` exists: `20`
- ✅ `package.json` engines: `>=20 <21`
- ✅ Scripts use `npx` wrappers
- ⚠️ Need to switch to Node 20 and run clean reinstall

## Next Steps

1. **Close all terminals**
2. **Open new PowerShell**
3. **Run:** `nvm use 20` (or `nvm install 20` first if needed)
4. **Run:** `.\scripts\restore_nextjs_cli.ps1`
5. **Verify:** `npm run build` reaches Next.js compilation
