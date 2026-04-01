# Punch List — Original Track

This document tracks scope and execution rules for the project.

---

## POST-BASELINE RULES

From the functional baseline onward, the following rules apply:

- **No refactors without a failing test** — Any refactor must be justified by a test that fails before and passes after.
- **No packaging work** — Packaging and distribution changes are out of scope unless explicitly agreed.
- **No deployment changes** — Deployment, hosting, and infrastructure are out of scope unless explicitly agreed.
- **Performance measured before and after each new function** — Run the performance harness (perf:export and/or perf_reporter.py) before and after adding new function work; record results.
- **release:gate must remain green at all times** — Template check, engine tests, web test, and export smoke must pass. No merge that breaks the gate.

Scope discipline is enforced by these rules. Exceptions require explicit agreement and documentation.
