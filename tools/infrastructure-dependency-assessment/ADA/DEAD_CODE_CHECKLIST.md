# ADA Dead-Code / Duplicate-Path Detection Checklist

Run through this checklist (Matt) after cleanup and before test-launch. ADA-specific.

---

## A. Duplicate logic detectors (must be single source of truth)

- [ ] Exactly one vulnerability builder path used by both web and reporter
- [ ] Exactly one severity mapping function
- [ ] Exactly one driver category mapping
- [ ] Exactly one anchor list
- [ ] Exactly one template path resolver

---

## B. Legacy export paths to eliminate / archive

- [ ] Any code path referencing `IMPACT_CURVES_SECTION` is removed
- [ ] Any code path referencing `VULN_NARRATIVE` is removed
- [ ] Any "SECTOR:" hard-coded scaffolding generator is removed (template-driven only)

---

## C. UI/report mismatch risks

- [ ] App view vuln count matches DOCX vuln count for each fixture
- [ ] Severity distribution matches
- [ ] Domain labels match canonical set

---

## D. Template drift risks

- [ ] Template hash recorded
- [ ] Required ADA styles exist as PARAGRAPH styles
- [ ] No trailing spaces in style names

---

## E. Forbidden content

- [ ] "SAFE" not present anywhere in active repo
- [ ] No placeholder text like "presented in Section C"

---

## F. Archive hygiene

- [ ] All moved items stored under `D:\psa-workspace\archive\ada_cleanup_YYYYMMDD\`
- [ ] Nothing deleted

---

*Use `tools\validation\anchor_scan.ps1`, `style_scan.ps1`, `safe_scan.ps1`, and `find_duplicates.ps1` to assist. See `tools\validation\AUDIT_PLAN.md`.*
