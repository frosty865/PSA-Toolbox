# Ollama GPU proof and service setup (Windows WDDM)

## Environment reference

Canonical variables for PSA Ollama (e.g. NSSM service or shell):

| Variable           | Example / purpose |
|--------------------|-------------------|
| `PSA_SYSTEM_ROOT`  | `D:\PSA_System` – repo root; used by scripts and services. |
| `OLLAMA_MODELS`    | `D:\PSA_System\Data\ollama\models` – where Ollama stores model blobs. Use this path only; older duplicate ollama folders (e.g. under `services\ollama`) have been removed so Ollama doesn’t lose the model location after updates. |
| `OLLAMA_HOST`      | `127.0.0.1:11434` – **Must use 127** so the server binds to localhost only (not 0.0.0.0). Set when starting Ollama (NSSM env or `start_ollama_gpu.ps1`). Clients use `http://127.0.0.1:11434`. |

The module generator uses `OLLAMA_URL` (default `http://127.0.0.1:11434`) and sets `OLLAMA_HOST` from it so `ollama_json` talks to the same host.

---

## Updating Ollama from the command line (custom install)

**Option 1 – winget (if Ollama was installed via winget):**

```powershell
winget upgrade --id Ollama.Ollama -e
```

**Option 2 – official installer (works for custom/installer-based installs):**

1. Stop the NSSM Ollama service so the binary can be replaced:
   ```powershell
   sc.exe stop "VOFC-Ollama"
   ```
   (Use your service name if different, e.g. `psa-ollama`.)

2. Download the latest Windows installer and run it silently (upgrades in place; keeps your install path):
   ```powershell
   $url = "https://ollama.com/download/OllamaSetup.exe"
   $exe = "$env:TEMP\OllamaSetup.exe"
   Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
   Start-Process -FilePath $exe -ArgumentList "/SP-", "/VERYSILENT", "/NORESTART" -Wait
   ```

3. Start the service again:
   ```powershell
   sc.exe start "VOFC-Ollama"
   ```
   Or: `pwsh -ExecutionPolicy Bypass -File tools\ollama\restart_ollama_service.ps1`

NSSM points at the Ollama executable path; the installer upgrades that path in place, so the service keeps working after restart. Your `OLLAMA_MODELS` and other env vars in NSSM are unchanged.

---

## Two paths: CUDA-capable local inference

### A) RECOMMENDED: Fix Ollama GPU (no compilation)

1. **Confirm you're using the Windows Ollama binary (not WSL/stub):**

```powershell
where.exe ollama
(Get-Command ollama).Source
ollama --version
```

2. **Kill all Ollama instances and restart ONE:**

```powershell
sc.exe query | findstr /I ollama
# If you have a service (adjust name if needed):
# sc.exe stop "VOFC-Ollama"
taskkill /F /IM ollama.exe
```

3. **Start Ollama in foreground so you can see logs:**

```powershell
$env:OLLAMA_DEBUG="1"
$env:OLLAMA_LOG_LEVEL="debug"
ollama serve
```

4. **In a NEW PowerShell window, run a sustained inference:**

```powershell
ollama run llama3.1:8b-instruct "Write 1200 words about site emergency response coordination."
```

5. **In another window, prove GPU:**

```powershell
nvidia-smi -l 1
```

**EXPECT:** An `ollama` process appears and VRAM increases.

**If not:** Your Ollama build is CPU-only or you're running the wrong binary. Fix: uninstall/reinstall Ollama using the [official Windows installer](https://ollama.com/download).

---

### B) BUILD PATH: Install prerequisites + build CUDA (only if building llama.cpp manually)

Use this only if you are building llama.cpp or similar from source.

1. **Install CMake** (choose one):

```powershell
winget install --id Kitware.CMake -e
# Or with Chocolatey: choco install cmake -y
```

Refresh PATH (close/reopen PowerShell if needed), then:

```powershell
cmake --version
```

2. **Install Visual Studio Build Tools:**

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e
```

After install, ensure you have: **MSVC v143**, **Windows 10/11 SDK**, **C++ CMake tools for Windows**. If not, run the VS Installer and add "Desktop development with C++".

3. **Install CUDA Toolkit** (driver may already be present; toolkit needed for compilation):

```powershell
nvcc --version
```

If `nvcc` not found, install [CUDA Toolkit 12.x](https://developer.nvidia.com/cuda-downloads) and reopen PowerShell.

4. **Build (PowerShell: use separate commands, no `&&`):**

From the repo root where `CMakeLists.txt` exists (e.g. llama.cpp):

```powershell
if (!(Test-Path ".\build")) { New-Item -ItemType Directory -Path ".\build" | Out-Null }
Set-Location .\build
cmake -DGGML_CUDA=ON ..
cmake --build . --config Release
Set-Location ..
```

---

### C) PowerShell equivalents (avoid command-line mistakes)

| Wrong (bash/cmd)        | Correct (PowerShell) |
|------------------------|----------------------|
| `mkdir build && cd build` | `New-Item -ItemType Directory -Path ".\build" -Force \| Out-Null; Set-Location .\build` |
| `cd /d D:\path`        | `Set-Location D:\path` |
| Chaining with `&&`     | Use `;` or separate commands |

---

## Workflow: Why is Ollama CPU-only? (definitive evidence → fix)

Run diagnostics first, then apply the correct fix.

### 1) Verify which ollama binary is running (WSL vs Windows)

```powershell
where.exe ollama
(Get-Command ollama).Source
tasklist | findstr /I ollama
```

Or run the diagnostic script (does this plus step 2):

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\diagnose_ollama.ps1
```

**If** `where` / `Get-Command` show any of:

- `\\wsl$\...` or WSL path → not the GPU-capable Windows install.
- `C:\Users\<you>\AppData\Local\Microsoft\WindowsApps\ollama.exe` (stub) → use full installer.
- Another custom path → confirm it's the official Windows build.

### 2) Verify the server you hit is local and the PID matches

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
netstat -ano | findstr :11434
```

Take the **PID** from the `LISTENING` line, then:

```powershell
tasklist /FI "PID eq <PID>"
```

If the image name is **not** `ollama.exe`, you're hitting something else; fix that first.

### 3) Force one instance only (kill all + restart)

```powershell
sc.exe query | findstr /I ollama
sc.exe stop "VOFC-Ollama"
taskkill /F /IM ollama.exe
```

Start fresh in **foreground** so logs are visible:

```powershell
$env:OLLAMA_DEBUG="1"
$env:OLLAMA_LOG_LEVEL="debug"
ollama serve
```

In a **second** PowerShell window:

```powershell
ollama run llama3.1:8b-instruct "Write 1200 words about facility emergency response coordination."
```

If logs never mention CUDA/GPU/offload and `nvidia-smi` never shows `ollama` → CPU-only build.

**Optional:** use the script to do the kill step and then start manually:

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\diagnose_ollama.ps1 -ForceOneInstance
# Then in another window: ollama serve
```

### 4) If CPU-only build is confirmed: reinstall official Windows Ollama

- Uninstall Ollama from **Apps & Features**.
- Delete any leftover binaries in:
  - `%LOCALAPPDATA%\Programs\Ollama\`
  - `%LOCALAPPDATA%\Ollama\`
- Reinstall using the **official Windows installer** from [ollama.com/download](https://ollama.com/download) (not WSL, not the WindowsApps stub).

Then:

```powershell
where.exe ollama
ollama --version
```

### 5) Make GPU preference persistent when Ollama is run by NSSM

**If Ollama is run by NSSM** (e.g. service name `VOFC-Ollama` or `psa-ollama`), the instance you hit on :11434 is the service. To get GPU discovery:

1. **Stop the service** (so you don’t have two instances):
   ```powershell
   sc.exe stop "VOFC-Ollama"
   ```
   Use your actual service name if different (e.g. `psa-ollama`).

2. **Set environment in NSSM:**
   ```powershell
   nssm edit "VOFC-Ollama"
   ```
   In the **Environment** tab, **add** (one per line or space-separated depending on NSSM):
   - `OLLAMA_HOST=127.0.0.1:11434` (must use 127 so the server binds to localhost only, not 0.0.0.0)
   - `OLLAMA_NUM_GPU=1`
   - `OLLAMA_LOG_LEVEL=debug`
   - `OLLAMA_DEBUG=1`
   **Do not set** `CUDA_VISIBLE_DEVICES` unless GPU discovery already works and you want to pin a device (Ollama warns: if GPUs not discovered, unset and try again).

   Optionally also: `OLLAMA_GPU_LAYERS=999`. Keep existing vars (e.g. `OLLAMA_MODELS`, `PSA_SYSTEM_ROOT`) as needed.

3. **Start the service:**
   ```powershell
   sc.exe start "VOFC-Ollama"
   ```
   Or use the restart script (same effect):
   ```powershell
   pwsh -ExecutionPolicy Bypass -File tools\ollama\restart_ollama_service.ps1
   pwsh -ExecutionPolicy Bypass -File tools\ollama\restart_ollama_service.ps1 -ServiceName psa-ollama
   ```

4. **Check logs** for `initial_count=1` and `library=cuda`. If NSSM is configured with stdout/stderr (e.g. `psa-ollama` logs to `PSA_SYSTEM_ROOT\Services\logs\psa-ollama.stdout.log`), open that file after a request.

### 6) Re-run proof

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\prove_gpu.ps1 -Model llama3.1:8b-instruct -Seconds 25
```

---

## Scripts

| Script | Purpose |
|--------|--------|
| `diagnose_ollama.ps1` | Verify binary path (WSL/stub) and that port 11434 listener is `ollama.exe`. Use `-ForceOneInstance` to stop service + kill all. |
| `prove_gpu.ps1` | Run sustained inference and poll `nvidia-smi`; pass only if `ollama` appears in GPU process list. |
| `start_ollama_gpu.ps1` | Start `ollama serve` in foreground with `OLLAMA_NUM_GPU=1` and debug logging (for when you run Ollama manually; do not use if the service is already running). |
| `restart_ollama_service.ps1` | Restart the NSSM Ollama service (default: `VOFC-Ollama`; use `-ServiceName psa-ollama` if different). Run after setting GPU env in NSSM. |
| `update_ollama.ps1` | Stop NSSM Ollama service, download latest OllamaSetup.exe, run silent install, start service. For custom/installer-based installs. |

**Prove GPU** (single command):

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\prove_gpu.ps1 -Model llama3.1:8b-instruct -Seconds 25
```

- When a model is running, `nvidia-smi` must show an `ollama` process consuming VRAM.
- Ollama logs should show CUDA/GPU offload (not CPU-only).

## If prove_gpu fails – root causes

- **A)** CPU-only Ollama build → reinstall from official installer (step 4).
- **B)** Ollama in WSL or wrong binary → run `diagnose_ollama.ps1` or `where.exe ollama`.
- **C)** Model/context too large → offload falls back to CPU; use smaller quant or reduce context.
- **D)** Hitting a different Ollama server → multiple instances or wrong URL; use step 3 and confirm PID (step 2).

## When logs show "initial_count=0" / "total vram=0 B"

If server logs say **"evaluating which, if any, devices to filter out" initial_count=0** and **"inference compute id=cpu library=cpu"** / **"total vram"="0 B"** / **"entering low vram mode"**, Ollama’s GPU discovery found **no GPUs** and is using CPU only.

**Check first:** On Windows (WDDM), the NVIDIA driver must be active and the GPU visible before starting Ollama. If the **NVIDIA app** or display driver wasn’t running, CUDA can report 0 devices. Run `nvidia-smi` in a separate window; if it lists your GPU, then start Ollama (or `start_ollama_gpu.ps1`). If `nvidia-smi` fails or shows no GPU, fix the driver / restart the machine before retrying.

**If Ollama is run by NSSM:** Set the env in the service (step 5 above: `nssm edit`, add `OLLAMA_NUM_GPU=1`, `OLLAMA_LOG_LEVEL=debug`, `OLLAMA_DEBUG=1`; do **not** set `CUDA_VISIBLE_DEVICES`). Then restart the service with `restart_ollama_service.ps1` or `sc stop` / `sc start`. Do not run `start_ollama_gpu.ps1` or you will have two instances.

**If you run Ollama manually (not as a service):** The script `start_ollama_gpu.ps1` sets `OLLAMA_NUM_GPU=1` and **does not** set `CUDA_VISIBLE_DEVICES` by default (Ollama logs warn: *"if GPUs are not correctly discovered, unset and try again"*). Run:

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\start_ollama_gpu.ps1
```

If you prefer to pin device 0, use `-SetCudaVisibleDevices`:

```powershell
pwsh -ExecutionPolicy Bypass -File tools\ollama\start_ollama_gpu.ps1 -SetCudaVisibleDevices
```

Manual equivalent (no CUDA_VISIBLE_DEVICES; bind to 127 only):

```powershell
$env:OLLAMA_HOST="127.0.0.1:11434"; $env:OLLAMA_DEBUG="1"; $env:OLLAMA_LOG_LEVEL="debug"; $env:OLLAMA_NUM_GPU="1"; ollama serve
```

If you use NSSM for the service, set `OLLAMA_NUM_GPU=1` in the service Environment; only add `CUDA_VISIBLE_DEVICES=0` if discovery already finds a GPU and you want to pin it.

**If it still shows 0 GPUs (even with CUDA_VISIBLE_DEVICES unset):**

- **Ollama version:** RTX 50 series (e.g. RTX 5070) is very new; newer Ollama builds often bundle updated CUDA libs. You’re on 0.15.2; try the latest from [ollama.com/download](https://ollama.com/download) if you’re still on an older build.
- **Driver:** Install the latest NVIDIA driver for your GPU; keep it updated.
- **WDDM:** On Windows with a single GPU used for display, CUDA should still see it. If you use multiple GPUs or a laptop with iGPU+dGPU, try `start_ollama_gpu.ps1 -SetCudaVisibleDevices` to pin device 0.

**Session 0 (NSSM / Windows service):** Windows services run in **Session 0**. On WDDM, the GPU is often only visible in the **interactive user session** (where you’re logged in and the display driver is active). So the NSSM-run Ollama may **never** see the GPU, while the same binary run in your user session does. If prove_gpu still fails with the service:

1. **Test without the service:** Stop the NSSM Ollama service, then in a **normal PowerShell window (logged-in user)** run:
   ```powershell
   pwsh -ExecutionPolicy Bypass -File tools\ollama\start_ollama_gpu.ps1
   ```
   In another window run `prove_gpu.ps1`. If it **passes** when run this way, the GPU works but the **service context** (Session 0) cannot see it.

2. **Workaround – run Ollama as the user, not as a service:** Keep the service **stopped** and start Ollama in the user session instead, e.g.:
   - Run `start_ollama_gpu.ps1` in a terminal after logon, or
   - Create a **Scheduled Task** that runs at user logon: program `pwsh`, arguments `-ExecutionPolicy Bypass -File "D:\PSA_System\psa_rebuild\tools\ollama\start_ollama_gpu.ps1"`, “Run only when user is logged on”.

   Then use `restart_ollama_service.ps1` only when you want to switch back to the service (e.g. for CPU-only or a different setup).

After changing env, driver, or Ollama version, restart Ollama and check logs for `initial_count=1` (or higher) and `library=cuda` (or similar) instead of `library=cpu`.

## Module generator (local Ollama only)

`tools/modules/generate_module_questions_ofcs.py` defaults `OLLAMA_URL` to `http://127.0.0.1:11434` and logs it. Optional strict GPU mode:

- Run `prove_gpu.ps1` first.
- Set `OLLAMA_GPU_PROVEN=1` in the environment (or after proving in CI).
- Call the script with `--require-gpu` to fail fast if not set.
