# NVM-Windows Uninstall and Reinstall Guide

## Current Status Check

```powershell
# Check if nvm is currently installed
nvm version

# Check if nvm-windows is installed via winget
winget list | Select-String -Pattern "nvm|NVM" -CaseSensitive:$false
```

## Uninstall NVM-Windows

### Option 1: Via Windows Settings (Recommended)
1. Open **Settings** > **Apps** > **Installed apps**
2. Search for "nvm" or "NVM for Windows"
3. Click **Uninstall**

### Option 2: Via winget (if installed via winget)
```powershell
# Run in Administrator PowerShell
winget uninstall CoreyButler.NVMforWindows
```

### Option 3: Manual Uninstall
```powershell
# Run in Administrator PowerShell
# 1. Remove nvm installation directory (usually C:\Users\<username>\AppData\Roaming\nvm)
Remove-Item -Recurse -Force "$env:APPDATA\nvm" -ErrorAction SilentlyContinue

# 2. Remove symlinks (usually C:\Program Files\nodejs)
Remove-Item -Recurse -Force "C:\Program Files\nodejs" -ErrorAction SilentlyContinue

# 3. Remove from PATH (check manually in System Properties > Environment Variables)
# Remove entries containing "nvm" from both User and System PATH variables
```

### Clean Up PATH Variables
After uninstalling, manually check and remove nvm entries from PATH:
1. Open **System Properties** > **Environment Variables**
2. Check **User variables** and **System variables** for PATH
3. Remove any entries containing:
   - `%APPDATA%\nvm`
   - `C:\Users\<username>\AppData\Roaming\nvm`

## Reinstall NVM-Windows

### Option 1: Via winget (Recommended)
```powershell
# Run in Administrator PowerShell
winget install -e --id CoreyButler.NVMforWindows

# After installation, close ALL terminals and reopen PowerShell
```

### Option 2: Manual Download
1. Go to: https://github.com/coreybutler/nvm-windows/releases
2. Download the latest `nvm-setup.exe`
3. Run the installer (requires Administrator privileges)
4. **Close ALL terminals** after installation completes

## Verify Installation

After reinstalling and reopening PowerShell:

```powershell
# Check nvm version
nvm version

# Should show something like: 1.1.12 or similar

# Verify nvm is in PATH
$env:Path -split ';' | Select-String -Pattern "nvm"
```

## Install Node 20 LTS

```powershell
# Install latest Node 20.x
nvm install 20

# Use Node 20
nvm use 20

# Verify
node -v
# Should show: v20.x.x

npm -v
```

## Troubleshooting

### nvm command not found after reinstall
1. **Close ALL PowerShell/terminal windows**
2. **Reopen PowerShell** (not necessarily as admin)
3. If still not found, check PATH manually:
   ```powershell
   $env:Path -split ';' | Select-String -Pattern "nvm"
   ```

### Multiple Node installations conflict
If you have both system Node and nvm Node:
```powershell
# Check which node is being used
where.exe node

# If system Node appears first, you may need to:
# 1. Uninstall system Node from Control Panel
# 2. Or ensure nvm paths come first in PATH
```

### Clean reinstall (nuclear option)
```powershell
# Run in Administrator PowerShell

# 1. Uninstall via winget
winget uninstall CoreyButler.NVMforWindows

# 2. Remove directories
Remove-Item -Recurse -Force "$env:APPDATA\nvm" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\Program Files\nodejs" -ErrorAction SilentlyContinue

# 3. Close all terminals, reopen, then reinstall
winget install -e --id CoreyButler.NVMforWindows

# 4. Close terminals again, reopen, then use nvm
```
