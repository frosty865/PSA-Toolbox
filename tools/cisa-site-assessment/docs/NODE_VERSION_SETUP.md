# Node Version Setup Guide

## Current Status

The build is **already working** with Node 22 using `npx` wrappers. However, for optimal compatibility with Next.js 16.0.10, Node 20 LTS is recommended.

## Option 1: Install nvm-windows (Recommended for Node 20)

### Installation Steps

1. **Download nvm-windows**:
   - Go to: https://github.com/coreybutler/nvm-windows/releases
   - Download the latest `nvm-setup.exe` installer
   - Run the installer (requires admin privileges)

2. **After installation, restart PowerShell** (or open a new terminal)

3. **Verify nvm is installed**:
   ```powershell
   nvm version
   ```

4. **Install Node 20**:
   ```powershell
   nvm install 20
   nvm use 20
   ```

5. **Verify Node version**:
   ```powershell
   node -v
   # Should show: v20.x.x
   ```

6. **Reinstall dependencies** (if needed):
   ```powershell
   cd D:\PSA_System\psa_rebuild
   npm install
   ```

### Using .nvmrc (Automatic Version Switching)

Once nvm-windows is installed, you can use the `.nvmrc` file:

```powershell
cd D:\PSA_System\psa_rebuild
nvm use
# nvm will read .nvmrc and switch to Node 20 automatically
```

## Option 2: Continue with Node 22 (Current Setup)

The build **already works** with Node 22 because we're using `npx` wrappers:

- ✅ `npm run build` - Works (uses `npx next build`)
- ✅ `npm run dev` - Works (uses `npx next dev`)
- ✅ `npm run start` - Works (uses `npx next start`)

**Note**: You'll see an `EBADENGINE` warning during `npm install`, but it won't prevent the build from working.

## Verification

After switching to Node 20 (if using Option 1):

```powershell
cd D:\PSA_System\psa_rebuild
node -v          # Should show v20.x.x
npm ls next      # Should show next@16.0.10 (valid, not "invalid")
npm run build    # Should reach Next.js compilation
```

## Troubleshooting

### nvm command not found after installation

1. **Restart PowerShell** (or close and reopen terminal)
2. **Check PATH**: nvm-windows should add itself to PATH automatically
3. **Manual PATH check**: 
   ```powershell
   $env:Path -split ';' | Select-String -Pattern "nvm"
   ```

### Still seeing "invalid" for Next.js

1. Remove `node_modules` and `package-lock.json`
2. Run `npm cache clean --force`
3. Run `npm install` again

### Build still fails with "'next' is not recognized"

1. Verify `node_modules/.bin/next.cmd` exists:
   ```powershell
   Test-Path .\node_modules\.bin\next.cmd
   ```

2. If missing, reinstall:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Force package-lock.json
   npm install
   ```
