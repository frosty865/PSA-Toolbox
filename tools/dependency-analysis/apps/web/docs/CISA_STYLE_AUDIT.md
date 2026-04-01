# CISA Style Audit — Site-Wide (Tab-by-Tab, Section-by-Section)

Use `radio-group`, `radio-group-vertical`, `radio-option-item`, `checkbox-group`, `checkbox-item`, and CISA color variables (`var(--cisa-*)`) instead of Tailwind/generic colors or inline styles for form controls.

---

## Assessment → Dependencies (per-tab)

### Water tab
| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| Curve questions (Yes/No/Unknown in question block) | Radio list | `radio-group-vertical` + `radio-option-item` | Done |
| YesNoRow / YesNoUnknownRow (shared) | Radio | `radio-group` / `radio-group-vertical` + `radio-option-item` | Done |

### Wastewater tab
| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| Curve questions (Yes/No/Unknown in question block) | Radio list | `radio-group-vertical` + `radio-option-item` | Done |
| YesNoRow / YesNoUnknownRow (shared) | Radio | `radio-group` / `radio-group-vertical` + `radio-option-item` | Done |

### Energy tab
| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| YesNoRow / YesNoUnknownRow / YesNoUnknownOrNaRow | Radio | `radio-group`, `radio-group-vertical` + `radio-option-item` | Done |
| energy-form wrapper | — | OK | — |

### Communications tab
| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| Curve: requires service (Yes/No) | Radio | `radio-group` | Done |
| Curve: backup available | Radio | `radio-group-vertical` + `radio-option-item` | Done |
| Voice functions (Operational / Leadership) | Checkboxes | `checkbox-group` + `checkbox-item` | Done |
| comm_single_point_voice_failure, comm_restoration_coordination | Radio | `radio-group-vertical` + `radio-option-item` | Done |
| RedundancyActivationBlock (when backup) | Radio | `radio-group-vertical` + `radio-option-item` | Done |

### Information Technology tab
| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| IT-2 can identify assets | Radio | `radio-group-vertical` + `radio-option-item` | Done |
| IT-3 multiple connections | Radio | `radio-group` | Done |
| IT-5, IT-8, IT-10, IT-11 (YesNoUnknownRow) | Radio | `radio-group-vertical` + `radio-option-item` | Done |
| IT-7 installation location / vehicle / protection | Radio | `radio-group-vertical` + `radio-option-item` | Done |
| IT-9 sustainment plan | Radio | `radio-group` | Done |
| **Internet Transport Resilience** (DependencySection when requires_service) | Radio / checkbox | `radio-group`, `checkbox-group` + `checkbox-item` | Done |
| **Hosted / Upstream Resilience (per dependency)** — ItHostedResilienceChecklist | Checkboxes | `checkbox-group` + `checkbox-item` per dependency card | Done |

---

## Dependency section (shared across Water, Wastewater, Energy, IT)

| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| requires_service (FieldInput boolean) | Checkbox | `checkbox-item` (DependencySection) | OK |
| **SupplySourcesEditor** (alternate source Yes/No) | Radio | `radio-group` | Done |
| **ItTransportResilienceForm** (circuit count, carrier, building entry, upstream POP, failover) | Radio | `radio-group` | Done |
| **ItTransportResilienceForm** (physical path diversity) | Checkboxes | `checkbox-group` + `checkbox-item` | Done |
| **ItHostedResilienceChecklist** (per-dependency resilience options) | Checkboxes | `checkbox-group` + `checkbox-item` | Done |

---

## Assessment → Categories page

| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| Category toggles (checkboxes) | Checkbox | Uses `checkbox-item` where applicable | OK |
| **CrossDependenciesTab** — Module enable | Checkbox | `checkbox-item` | Done |
| **CrossDependenciesTab** — ModuleQuestion TRI_STATE / FOUR_STATE | Radio | `radio-group` | Done |
| **CrossDependenciesTab** — ModuleQuestion MULTI_SELECT | Checkboxes | `checkbox-group` + `checkbox-item` | Done |
| Module panels background | Color | `var(--cisa-white)` instead of `#fff` | Done |

---

## Priority Restoration & SLA (modal / panel)

| Section / Component | Control type | CISA fix | Status |
|--------------------|--------------|----------|--------|
| **PriorityRestorationHelpPanel** — PRA (Do you have a PRA?) | Radio | `radio-group` | Done |
| **PriorityRestorationHelpPanel** — SLA in place (Yes/No/Unknown) | Radio | `radio-group` | Done |
| SlaCategorizationSection (reliability questions) | Selects | — | N/A |

---

## Global / shared

| Location | Issue | Fix | Status |
|----------|--------|-----|--------|
| **ContextualHelp** (tooltip) | Tailwind/generic colors | `var(--cisa-white)`, `var(--cisa-gray-light)`, `var(--cisa-gray)`, `var(--shadow-md)` | Done |

---

## Summary

- **Radio lists:** Use `radio-group` (horizontal) or `radio-group-vertical` with `radio-option-item` wrappers per option.
- **Checkbox lists:** Use `checkbox-group` and wrap each option in `checkbox-item`.
- **Colors:** Prefer `var(--cisa-*)` and `var(--shadow-md)` over Tailwind or hex.

All items in this audit have been applied.
