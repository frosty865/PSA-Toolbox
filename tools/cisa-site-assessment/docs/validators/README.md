# Module output validators (specs)

These files are **validator prompts**: drop-in text specs so Cursor (or any implementer) can implement deterministic checks exactly as stated. No new doctrine, no scope creep.

## Files

| File | Purpose |
|------|--------|
| `VALIDATE_MODULE_DOMAIN_EV_PARKING_V1.txt` | EV Parking domain separation: spatial/exposure only; no charger/interface terms. |
| `VALIDATE_MODULE_DOMAIN_EV_CHARGING_V1.txt` | EV Charging domain separation: charger/interface only; no parking-only drift. |
| `VALIDATE_MODULE_OUTPUT_QUALITY_V1.txt` | Shared quality: question form, OFC count/style, evidence/citation alignment. |
| `VALIDATE_PLAN_SPINE_FROM_TOC_V1.txt` | Plan spine: TOC/template-driven critical content list (when `standard_class == PHYSICAL_SECURITY_PLAN`). |

## Implementation order

Apply validators in this order:

1. **VALIDATE_MODULE_OUTPUT_QUALITY_V1** — shared quality (question form, OFCs, evidence, citations).
2. **Domain separation** for `module_domain`:
   - If `module_domain == "EV_PARKING"` → run `VALIDATE_MODULE_DOMAIN_EV_PARKING_V1`.
   - If `module_domain == "EV_CHARGING"` → run `VALIDATE_MODULE_DOMAIN_EV_CHARGING_V1`.
3. **(Optional)** **VALIDATE_PLAN_SPINE_FROM_TOC_V1** when `standard_class == PHYSICAL_SECURITY_PLAN`.

Each stage **DROPS** invalid items instead of failing the run.  
**Fail** only on domain mismatch (Rule 1) or forbidden blended phrasing (Rule 2) in the domain validators, because those violate doctrine.
