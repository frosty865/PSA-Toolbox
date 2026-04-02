# Reference Implementation Template (Locked)

**Authority:** Meaning Layer / Reference Implementation thin-slice.  
**Scope:** All new Reference Implementations MUST use this structure. Legacy section1–4 format remains supported for existing rows.

---

## Canonical template (order fixed)

Store in `discipline_subtype_reference_impl.reference_impl` as JSONB. Use `template_version: "2.0"` to signal this shape. The Help panel renders `purpose`, `scope`, `core_elements`, and `common_failure_modes` when present.

### 1) Purpose
- **Type:** `string` (one paragraph)
- **Content:** What the capability exists to do. No prescriptive or evaluative language.

### 2) Scope
- **Type:** `string` (one short paragraph)
- **Content:** Where/when the capability applies. May reference people, facilities, or operations at a high level.

### 3) Core Elements
- **Type:** `string[]` (3–6 items)
- **Content:** Capability-level statements (WHAT exists, not HOW). Each bullet must stand alone and be broadly applicable.

### 4) Common Failure Modes
- **Type:** `string[]` (3–5 items, optional but recommended)
- **Content:** How the capability commonly breaks down. No blame, no enforcement framing.

---

## JSON schema (minimal)

```json
{
  "template_version": "2.0",
  "discipline": "<code, e.g. EAP>",
  "subtype": "<name>",
  "purpose": "<one paragraph>",
  "scope": "<one short paragraph>",
  "core_elements": ["<bullet>", "...", "3 to 6 items"],
  "common_failure_modes": ["<bullet>", "...", "3 to 5 items, optional"]
}
```

---

## Forbidden in content

- "What counts as yes" / clarification by response
- Enforcement or compliance language
- Product, vendor, or technology references
- Evidence lists or citations
- Deprecated framework references (no legacy assessment naming)
- Maturity language

---

## Validation (per subtype)

- Could this apply to a hospital, office, factory, or school?
- Does it avoid implying assessment judgment?
- Does it describe existence, not quality?

If any answer is "no," rewrite.

---

## EAP thin-slice: selected subtypes (5–7)

| discipline_subtype_id | subtype name |
|----------------------|--------------|
| `9a84b834-8fe5-4c25-a11b-750276b2f76e` | Evacuation Procedures |
| `ded67053-d321-445c-95f9-d2326b72b6e6` | Lockdown / Lockout Procedures |
| `b7fefab1-cd13-4781-93d4-fedd133cdf67` | Shelter-in-Place |
| `09335ae3-724b-48c5-b4cc-c97905ebe768` | Muster Points / Rally Areas |
| `eeb09a9c-b830-4118-ab27-535b48359303` | Reunification Procedures |
| `57faa5fb-4c92-45cd-91d4-ae64181d9e09` | Staff Emergency Roles |

Not in this slice (in allowlist for guard): Emergency Drills, Emergency Guides / Flip Charts.

**To seed EAP RIs:**  
`node scripts/run_runtime_migration.js db/migrations/20260226_seed_eap_reference_implementations.sql`  
(Requires `RUNTIME_DATABASE_URL` in `.env.local`.)
