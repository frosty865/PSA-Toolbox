# Module → Standard mapping (PSA scope)

This doc explains **where** each module’s standard is defined and how to **inspect**, **flag**, and **correct** OBJECT modules that are wrongly mapped to PLAN standards.

---

## 1) Where modules map to standards

This codebase does **not** use `module_definitions` or a `module_standard_id` FK. The mapping is:

| Location | What it stores |
|----------|----------------|
| **RUNTIME.module_instances** | One row per `module_code`: `standard_key`, `standard_version`. This is the **doctrine instance** produced by **Standard → Generate** (POST body `standard_key`). |
| **RUNTIME.assessment_modules** | `standard_class`: `PHYSICAL_SECURITY_MEASURES` (OBJECT) or `PHYSICAL_SECURITY_PLAN` (PLAN). Updated when Generate runs; can also be set via PATCH. Optional: `intent_standard_key`. |
| **CORPUS.module_standards** | Registry of standards: `standard_key`, `name`, `version`, `status`, `standard_type` (OBJECT \| PLAN). **No FK** from RUNTIME; generate route looks up by `standard_key` string. |

**Standard/Generate flow:**

- User (or API) sends `POST /api/admin/modules/[moduleCode]/standard/generate` with body `{ standard_key: "PHYSICAL_SECURITY_MEASURES" }` (or `PHYSICAL_SECURITY_PLAN`, `EAP`, `EV_PARKING`, etc.).
- Route loads the standard from **CORPUS.module_standards** by `standard_key` (must be APPROVED).
- It deletes existing `module_instances` for that `module_code`, then inserts a new row with the chosen `standard_key` and `standard_version`, and writes criteria/OFCs to `module_instance_criteria` / `module_instance_ofcs`.
- If `standard_key` is a “standard class” key, it also runs:  
  `UPDATE assessment_modules SET standard_class = $1 WHERE module_code = $2`  
  (see `app/api/admin/modules/[moduleCode]/standard/generate/route.ts`).

So the **source of truth** for “which standard this module is using” is:

- **Doctrine instance:** `module_instances.standard_key` (and `.standard_version`)
- **UI / template class:** `assessment_modules.standard_class`

Relevant code:

- `app/api/admin/modules/[moduleCode]/standard/generate/route.ts` — body `standard_key`, reads CORPUS `module_standards`, writes `module_instances` + `assessment_modules.standard_class`
- `app/lib/modules/standard_class.ts` — `kindFromStandardClass`, `isPlanMode`, etc. (PLAN = PHYSICAL_SECURITY_PLAN, else OBJECT/MEASURES)

---

## 2) RUNTIME: inspect current mappings

Run on **RUNTIME** (no CORPUS join; standards live in CORPUS and are matched by `standard_key` string).

```sql
-- Modules and the standard they are using (doctrine instance + template class)
SELECT
  am.module_code,
  am.module_name,
  am.standard_class,
  mi.standard_key,
  mi.standard_version,
  mi.generated_at
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
ORDER BY am.module_code;
```

To include CORPUS `standard_type` (OBJECT vs PLAN) you’d need a separate query on CORPUS, or a script that joins the two DBs. Example CORPUS-only query:

```sql
-- Run on CORPUS: list APPROVED standards and their type
SELECT standard_key, name, standard_type, version, status
FROM public.module_standards
WHERE status = 'APPROVED'
ORDER BY standard_key;
```

---

## 3) Flag problem cases

OBJECT modules (e.g. EV parking/charging) should use an OBJECT standard (`PHYSICAL_SECURITY_MEASURES` or topic standards like `EV_PARKING`). If they are mapped to a **PLAN** standard (`PHYSICAL_SECURITY_PLAN`, `EAP`), that’s wrong.

Run on **RUNTIME**:

```sql
-- Problem: OBJECT modules (by standard_class or by code) using a PLAN standard_key
SELECT
  am.module_code,
  am.standard_class AS module_standard_class,
  mi.standard_key AS instance_standard_key,
  mi.standard_version
FROM assessment_modules am
JOIN module_instances mi ON mi.module_code = am.module_code
WHERE mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP')
  AND am.module_code IN (
    'MODULE_EV_PARKING',
    'MODULE_EV_CHARGING',
    'MODULE_EV_PARKING_CHARGING'
    -- add other OBJECT module codes that must not use PLAN
  );
```

Or flag by `standard_class`: any module that **should** be OBJECT but has `standard_class = 'PHYSICAL_SECURITY_PLAN'` or has `module_instances.standard_key` in PLAN keys:

```sql
-- Same idea: OBJECT modules incorrectly set to PLAN
SELECT am.module_code, am.standard_class, mi.standard_key
FROM assessment_modules am
JOIN module_instances mi ON mi.module_code = am.module_code
WHERE (am.standard_class = 'PHYSICAL_SECURITY_PLAN' OR mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP'))
  AND am.module_code IN ('MODULE_EV_PARKING', 'MODULE_EV_CHARGING', 'MODULE_EV_PARKING_CHARGING');
```

---

## 4) Fix: remap OBJECT modules to the OBJECT standard

After fixing, **re-run Standard → Generate** for each affected module with `standard_key = 'PHYSICAL_SECURITY_MEASURES'` (or the correct topic standard) so criteria and OFCs are regenerated from the OBJECT doctrine.

**Option A – UPDATE only (then re-run Generate):**

Run on **RUNTIME**. Use `standard_version = 'v1'` unless you have run a CORPUS query to get the current APPROVED version of `PHYSICAL_SECURITY_MEASURES`.

```sql
-- 4a) Point doctrine instance to PHYSICAL_SECURITY_MEASURES
UPDATE module_instances mi
SET standard_key = 'PHYSICAL_SECURITY_MEASURES',
    standard_version = 'v1'
WHERE mi.module_code IN (
    'MODULE_EV_PARKING',
    'MODULE_EV_CHARGING',
    'MODULE_EV_PARKING_CHARGING'
  )
  AND mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP');

-- 4b) Set template class to OBJECT
UPDATE assessment_modules
SET standard_class = 'PHYSICAL_SECURITY_MEASURES'
WHERE module_code IN (
    'MODULE_EV_PARKING',
    'MODULE_EV_CHARGING',
    'MODULE_EV_PARKING_CHARGING'
  )
  AND (standard_class IS NULL OR standard_class = 'PHYSICAL_SECURITY_PLAN');
```

**Option B – Delete instance and re-run Generate:**

If you prefer a clean slate (no stale criteria/OFCs), delete the instance and then run Generate with the correct standard:

```sql
-- Removes doctrine instance; next Generate will recreate from PHYSICAL_SECURITY_MEASURES
DELETE FROM module_instances
WHERE module_code IN ('MODULE_EV_PARKING', 'MODULE_EV_CHARGING', 'MODULE_EV_PARKING_CHARGING')
  AND standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP');

UPDATE assessment_modules
SET standard_class = 'PHYSICAL_SECURITY_MEASURES'
WHERE module_code IN ('MODULE_EV_PARKING', 'MODULE_EV_CHARGING', 'MODULE_EV_PARKING_CHARGING')
  AND (standard_class IS NULL OR standard_class = 'PHYSICAL_SECURITY_PLAN');
```

Then for each of those `module_code` values, call:

`POST /api/admin/modules/{moduleCode}/standard/generate`  
with body `{ "standard_key": "PHYSICAL_SECURITY_MEASURES" }`.

---

## 5) Verify after update

Run on **RUNTIME**:

```sql
SELECT
  am.module_code,
  am.standard_class,
  mi.standard_key,
  mi.standard_version
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
WHERE am.module_code IN ('MODULE_EV_PARKING', 'MODULE_EV_CHARGING', 'MODULE_EV_PARKING_CHARGING');
```

Expect `standard_class` and `mi.standard_key` to be `PHYSICAL_SECURITY_MEASURES` (or the intended OBJECT standard) for those modules.
