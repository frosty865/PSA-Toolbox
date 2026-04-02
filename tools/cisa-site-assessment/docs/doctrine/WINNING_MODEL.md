# PSA OFC Winning Model

**Status:** Target State  
**Doctrine:** PSA OFC Doctrine v1  
**Date:** 2026-02-03

---

## Overview

The winning model for PSA OFCs is **authoring, not mining**. OFCs are curated solution patterns authored once and reused forever, not extracted from documents.

---

## 1. Curated OFC Library

### Structure
- **Size:** ~10-30 OFCs per `discipline_subtype`
- **Total:** ~300-900 OFCs across all subtypes
- **Language:** Capability-level statements
- **Storage:** `ofc_candidate_queue` with `ofc_origin = 'CORPUS'`, `status = 'APPROVED'`

### Authoring Process
1. Analyst identifies capability gap from assessment questions
2. Writes OFC in capability-level, solution-focused language
3. Assigns `discipline_subtype_id` (mandatory)
4. Links to ≥1 corpus document citations (evidence)
5. Sets `status = 'APPROVED'`
6. OFC becomes available for all assessments

### Example OFCs

**Illumination Subtype:**
- "Establish exterior lighting systems to eliminate blind spots and improve visibility for monitoring and deterrence."
- "Implement automated lighting controls to ensure adequate illumination levels during operational hours."
- "Maintain lighting infrastructure to meet minimum illumination standards for security monitoring."

**Fire Suppression Subtype:**
- "Establish fire suppression systems to detect and extinguish fires in critical areas."
- "Implement fire detection and alarm systems to provide early warning of fire conditions."
- "Maintain fire suppression equipment to ensure operational readiness and compliance with fire codes."

---

## 2. Document Role

CORPUS documents (`corpus_documents`, `document_chunks`) are used **ONLY** for:

### Evidence Justification
- Citations link OFCs to document excerpts
- Evidence explains **WHY** the OFC is relevant
- Evidence does **NOT** define the OFC text

### Problem Signal Detection
- Documents surface problems (gaps, vulnerabilities)
- Problems inform **which** OFCs are needed
- Problems do **NOT** become OFCs

### Analyst Decision Support
- Documents provide context for OFC selection
- Documents help analysts choose appropriate OFCs
- Documents do **NOT** auto-generate OFCs

### Prohibited Uses
- ❌ Extracting OFC text from documents
- ❌ Auto-creating OFCs from findings
- ❌ Treating document excerpts as OFCs
- ❌ Mining OFCs from chunk text

---

## 3. MODULE OFCs

MODULE OFCs are created **only** via Module Data Management:

### Creation Process
1. Analyst navigates to `/admin/module-data`
2. Creates new MODULE OFC with:
   - `ofc_text` (authored solution pattern)
   - `discipline_subtype_id` (mandatory)
   - `title` (optional)
   - `status` (default: PENDING)
3. OFC stored with `ofc_origin = 'MODULE'`
4. OFC attached to module during research
5. OFC never appears in CORPUS panel

### Characteristics
- **Scope:** Module-specific
- **Management:** Dedicated admin interface
- **Origin:** `ofc_origin = 'MODULE'`
- **Rule:** Never auto-mined, never appear in CORPUS panel

---

## 4. Future Automation (Allowed)

The following automation is **allowed** in the future (not yet implemented):

### Problem Signal Detection
- Identify gaps/vulnerabilities from documents
- Surface problems to analysts
- Suggest which OFCs might address problems
- **NOT:** Auto-create OFCs from problems

### OFC Surfacing (Selection, Not Creation)
- Recommend existing OFCs based on question context
- Rank OFCs by relevance to assessment
- Suggest evidence citations for OFCs
- **NOT:** Generate new OFCs automatically

### Evidence Aggregation
- Collect citations for OFCs
- Aggregate evidence from multiple sources
- Score evidence quality/relevance
- **NOT:** Use evidence as OFC text

### Confidence Scoring
- Score OFC-question match confidence
- Rank OFCs by relevance
- Filter low-confidence matches
- **NOT:** Auto-promote based on score alone

---

## 5. Success Metrics

You are "winning" when:

### Quality Metrics
- ✅ OFC count is small (300-900 total)
- ✅ Every OFC answers a real question
- ✅ No analyst asks "why is this OFC here?"
- ✅ System feels intentional, not noisy

### Technical Metrics
- ✅ Zero cross-subtype matches
- ✅ Zero CORPUS/MODULE contamination
- ✅ Zero direct extraction violations
- ✅ 100% subtype match compliance

### User Experience Metrics
- ✅ Analysts trust OFC recommendations
- ✅ OFCs feel relevant and actionable
- ✅ Evidence clearly justifies OFCs
- ✅ No confusion about OFC origin

---

## 6. Migration Path

### Current State (Post-Purge)
- `ofc_candidate_queue` is empty
- No auto-mining active
- All OFCs must be explicitly created

### Immediate Next Steps
1. **Author Core OFCs**
   - Start with high-priority subtypes
   - Author 10-30 OFCs per subtype
   - Focus on most common assessment questions

2. **Establish Evidence Links**
   - Link OFCs to corpus documents
   - Build citation library
   - Verify evidence quality

3. **Validate Subtype Isolation**
   - Run debug script on each subtype
   - Verify zero cross-subtype matches
   - Confirm hard gates working

### Long-Term Vision
- Curated library of ~500-800 OFCs
- Evidence-backed, subtype-isolated
- Trusted by analysts
- Stable, not growing

---

## 7. Doctrine Compliance

All future work must comply with PSA OFC Doctrine v1:

- ✅ Author OFCs as solution patterns
- ✅ Use documents for evidence only
- ✅ Enforce subtype isolation
- ✅ Separate CORPUS/MODULE
- ❌ No direct extraction
- ❌ No cross-subtype linking
- ❌ No problem-as-solution

**Violations will cause build failures.**

---

**End of Winning Model**
