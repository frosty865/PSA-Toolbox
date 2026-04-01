# UI Reference — Electric Power (Gold Standard)

This document defines the **reference contract** for the **Electric Power** dependency section. It is the standard that Communications, Information Technology, Water, Wastewater, and (where applicable) Critical Products must align to for:

- Visual layout  
- Question flow  
- Input grouping  
- Units presentation  
- Conditional logic  

**This contract applies to all non–Critical-Products dependency sections unless explicitly overridden by the workbook.**

---

## Section header structure

- **Section**: One card per category.
- **Title**: Section heading (e.g. "Electric Power") — `card-title` / `<h3>`.
- **Description**: Optional `description`; when present, rendered as `text-secondary` paragraph below the title. Electric Power uses `description: null`.
- **Body**: A single `form-section` containing the ordered list of fields (no sub-headings; grouping is logical only, see below).

---

## Question ordering

The Electric Power section uses **exactly this order** of questions (field keys and logical groups):

| # | Field key | Purpose |
|---|-----------|---------|
| 1 | `requires_service` | Service dependency gate |
| 2 | `time_to_impact_hours` | Time-to-impact |
| 3 | `loss_fraction_no_backup` | Loss without backup |
| 4 | `has_backup_any` | Backup presence (gate) |
| 5 | `has_backup_generator` | Backup type (Electric Power–specific; other sections may omit or substitute) |
| 6 | `backup_duration_hours` | Backup duration |
| 7 | `loss_fraction_with_backup` | Loss with backup |
| 8 | `recovery_time_hours` | Recovery time |

Other service-based sections (Communications, IT, Water, Wastewater) must use the **same logical order**. They may use `has_backup` instead of `has_backup_any` where the workbook defines it; the backup gate is the same concept. If the workbook does not define a `has_backup_generator`-style question, that slot is omitted but the remaining order is preserved.

---

## Grouping (logical)

Questions are grouped conceptually as follows (no extra UI headings; order defines the flow):

1. **Service dependency gate**  
   - `requires_service` (boolean).

2. **Time-to-impact**  
   - `time_to_impact_hours` (numeric, Hours).

3. **Loss without backup**  
   - `loss_fraction_no_backup` (numeric, fraction 0–1; label may say "percentage").

4. **Backup presence**  
   - `has_backup_any` or `has_backup` (boolean).

5. **Backup details** (when backup = true)  
   - Optional: `has_backup_generator` (boolean) if present in workbook.  
   - `backup_duration_hours` (numeric, Hours).  
   - `loss_fraction_with_backup` (numeric, fraction 0–1).

6. **Recovery time**  
   - `recovery_time_hours` (numeric, Hours).

---

## Units rendering

- **Hours**: Shown as unit label **"Hours"** next to the input (e.g. `time_to_impact_hours`, `backup_duration_hours`, `recovery_time_hours`).  
  - Implemented via `field.unit === 'Hours'`; rendered as secondary text beside the number input.

- **Percentage / fraction**:  
  - Stored as a fraction (0–1). Label text may say "(percentage)" or "%"; the input is numeric with min 0, max 1, step 0.01.  
  - No separate "%" unit suffix is required in the UI if the label already states percentage; if the workbook supplies `unit: '%'`, it may be shown.

---

## Conditional visibility rules

- **Backup fields hidden unless backup = true**  
  - When the backup gate (`has_backup_any` or `has_backup`) is **false**, the following must be hidden or suppressed:  
    - `has_backup_generator` (if present)  
    - `backup_duration_hours`  
    - `loss_fraction_with_backup`  
  - When the backup gate is **true**, all backup-detail fields are shown.  
  - Data behavior: when backup is set to false, clear `backup_duration_hours` and `loss_fraction_with_backup` (and any backup-type field) so export and engine see null/empty for those.

This is the **reference behavior**. Sections that align to this contract must implement the same visibility rule (or document a workbook override).

---

## Input types

| Type | UI control | Notes |
|------|------------|--------|
| **boolean** | Checkbox | Single checkbox; label beside it. |
| **number** | Number input | `<input type="number">` with min, max, step; optional unit label after the input. |
| **text** | Text input | Single line (used in other sections or table cells; Electric Power uses boolean and number only). |

No new input types are introduced for this contract.

---

## Validation behavior

- **Required vs optional**  
  - **Service gate** (`requires_service`): Required in the sense that it is always shown and has a default (e.g. `true`).  
  - **Time-to-impact, loss without backup**: Required when the section is applicable; min/max enforce bounds.  
  - **Backup gate**: Required (boolean, always has a value).  
  - **Backup duration and loss with backup**: Optional in data (may be null when backup = false). When backup = true, they are required for a complete assessment; validation may require them in that case.  
  - **Recovery time**: Required (numeric, default e.g. 0 or 1); min/max (e.g. 0–168) enforced.

- **Bounds** (Electric Power reference):  
  - `time_to_impact_hours`: min 0, max 72, step 1.  
  - `loss_fraction_*`: min 0, max 1, step 0.01.  
  - `backup_duration_hours`: min 0, max 96, step 1.  
  - `recovery_time_hours`: min 0, max 168, step 1.

Other sections must use the same or workbook-specified bounds; no arbitrary changes without a documented override.

---

## Data shape consistency

- Each non–Critical-Products category has a single **backup gate**: either `has_backup_any` (Electric Power) or `has_backup` (others). Engine and reporter accept both; UI must use the key defined in `UI_CONFIG` for that category.
- When the backup gate is false, `backup_duration_hours` and `loss_fraction_with_backup` must be stored as `null` (or omitted) so summary and VOFC logic treat “no backup” correctly.
- Field keys (`requires_service`, `time_to_impact_hours`, `loss_fraction_no_backup`, backup gate, `backup_duration_hours`, `loss_fraction_with_backup`, `recovery_time_hours`) are the canonical set. Category-specific keys (e.g. `has_backup_generator`) are additive only.

---

## Screenshots / visual reference

Screenshots may be added here to illustrate the Electric Power section (card title, question order, checkbox vs number inputs, unit “Hours” placement, and optional state with backup fields hidden). Until then, implement against the structure and rules above.

---

## Summary

- **Section**: One card; title; optional description; one form-section with fields in the order above.  
- **Order**: Service gate → Time-to-impact → Loss without backup → Backup gate → (optional backup-type) → Backup duration → Loss with backup → Recovery time.  
- **Units**: Hours shown for duration/time fields; fraction for loss (label or unit may indicate %).  
- **Conditional**: Backup-detail fields hidden when backup gate is false; data cleared for those fields.  
- **Input types**: Boolean (checkbox), number (with optional unit).  
- **Validation**: Bounds and required/optional as above; backup-detail required when backup = true.

**This contract applies to all non–Critical-Products dependency sections unless explicitly overridden.**
