# NSSM Services - Quick Reference

**Date:** 2025-12-21

---

## Services

1. **psa-back** - Backend API service
2. **psa-ollama** - Ollama LLM service
3. **psa-pipeline** - Pipeline processing service
4. **psa-tunnel** - SSH tunnel service
5. **psa-library-watcher** - Library watcher service

---

## Quick Install

```powershell
# Run as Administrator
cd scripts
.\install_nssm_services.ps1
```

---

## Service Management

```powershell
# Start all services
Start-Service psa-back, psa-ollama, psa-pipeline, psa-tunnel, psa-library-watcher

# Stop all services
Stop-Service psa-back, psa-ollama, psa-pipeline, psa-tunnel, psa-library-watcher

# Check status
Get-Service psa-back, psa-ollama, psa-pipeline, psa-tunnel, psa-library-watcher | Format-Table
```

---

## Documentation

- **Full Documentation:** `docs/NSSM_SERVICES.md` - Complete NSSM configuration details
- **Cleanup Guide:** `docs/NSSM_CLEANUP.md` - Unnecessary functions removed

---

**END OF QUICK REFERENCE**

