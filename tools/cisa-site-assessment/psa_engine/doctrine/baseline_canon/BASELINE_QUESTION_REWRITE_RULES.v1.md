# Baseline Question Rewrite Rules v1

## 1. Purpose

Baseline questions must map current posture via boundary-based control assertions. Questions are NOT inventory checks; they must reveal "where security decisions occur."

The baseline canon represents universal physical security controls that apply across all sectors and subsectors. Questions that depend on sector/subsector context belong in expansion layers, not the baseline.

## 2. Required Shape (Control Assertion)

Each baseline question MUST be rewriteable to:

**"At/for [BOUNDARY/AREA], is [SUBJECT] allowed/denied/controlled/observed based on [CONTROL]?"**

Must include at least:
- **Boundary/Area anchor**: perimeter, entry point, restricted area, key area, critical function area, etc.
- **Decision/Control behavior**: grant/deny, restrict/permit, detect/alert, record/retrieve, communicate/notify, delay/prevent, verify/authenticate.

### Examples of Valid Control Assertions:
- "At controlled entry points, is access granted or denied based on presented credentials?"
- "Are unauthorized entry attempts detected and do they generate actionable alerts?"
- "Is video recorded and retained for designated cameras?"
- "Are restricted areas designated and movement controlled into those areas?"

## 3. Forbidden Patterns (Auto-Flag)

Questions containing these patterns must be flagged for rewrite or removal:

### Forbidden Phrases:
- **"perform their basic function"** → Must be rewritten to explicit control behavior
- **"effective / adequate / sufficient / properly"** → Subjective quality judgments; must specify measurable control behavior
- **"capabilities"** → Unless rewritten to explicit control behavior (e.g., "capability to detect" → "are intrusions detected")
- **"roles and responsibilities"** as a standalone question → Belongs as SMG posture, not subtype-by-subtype
- **"documented procedures in place for [system]"** as subtype-by-subtype → Belongs in SMG; otherwise DROP/MOVE

### Forbidden Solution Artifacts:
Technology artifacts in questions are forbidden:
- NVR/DVR/IP/ONVIF/video wall/biometric modality/protocols/ratings/specs
- Specific vendor names or product types
- Technical implementation details

**Exception**: If the technology is the boundary itself (e.g., "At video monitoring workstations, are camera feeds observable?"), the technology reference is acceptable as a boundary anchor.

## 4. Canonical Rewrite Templates (by Discipline Intent)

### PER (Perimeter):
- Boundary defined? → "Is the site perimeter clearly defined and identifiable?"
- Vehicle access controlled? → "Are vehicle access points identified and controlled at the site perimeter?"
- Physical delay present? → "Are physical barriers present that delay unauthorized entry at the perimeter?"
- Visibility supported? → "Is the perimeter observable to detect unauthorized access attempts?"

### ACS (Access Control):
- At controlled entries/areas, is access granted/denied based on authorization/identity?
- "At controlled entry points, is access granted or denied based on presented credentials?"
- "At designated entry points, is identity verified before access is granted?"

### IDS (Intrusion):
- Are unauthorized entry attempts detected and do they generate actionable alerts?
- "Are intrusion alarms monitored such that alarm events can be received and acted on?"

### VSS (Video):
- Are designated areas observable via live/recorded video, retrievable for incidents?
- "Is video recorded and retained for designated cameras?"
- "Are camera feeds monitored in real time when operational monitoring is required?"

### INT (Interior):
- Are restricted areas designated and movement controlled into those areas?
- "Are restricted areas clearly identified and access controlled?"

### FAC (Hardening):
- Are physical features present that delay forced entry or protect critical functions?
- "Are critical functions protected by physical barriers that delay unauthorized access?"

### KEY (Key Control):
- Is distribution/custody controlled and accountability maintained?
- "Is key distribution and custody controlled with accountability maintained?"

### COM (Comms):
- Can security/ops communicate internally and with external partners if needed?
- "Can security personnel communicate internally and with external partners when needed?"

### EAP (Immediate Actions):
- Are procedures established/available for evacuation/lockdown/shelter and drills conducted?
- "Are evacuation, lockdown, and shelter-in-place procedures established and available?"
- "Are emergency response drills conducted?"

### EMR (Resilience/Continuity):
- Is crisis mgmt/continuity capability established and coordination frameworks usable?
- "Is crisis management capability established and coordination frameworks available?"

### ISC (Info Sharing):
- Are channels/liaisons established for coordination and reporting?
- "Are information sharing channels established for coordination and reporting?"

### SFO (Security Force):
- Are security presence/patrol/response/reporting capabilities established?
- "Is security presence established at designated areas?"
- "Are security patrols conducted and incidents reported?"

### SMG (Governance):
- Is oversight assigned; policies/procedures/documentation/risk process/training program established?
- "Is security oversight assigned and policies established?"
- "Are security procedures documented and available?"
- "Is a risk assessment process established?"
- "Is security training provided to personnel?"

### CPTED:
- Do environmental features support visibility, movement control, territorial cues, wayfinding?
- "Do environmental features support visibility and movement control?"
- "Are territorial cues and wayfinding elements present?"

## 5. Classification Outcomes

Every legacy baseline question is classified into exactly one:

1. **REWRITE_TO_CONTROL_ASSERTION**: Can be rewritten to a boundary-based control assertion
2. **MOVE_TO_SMG**: Governance/process question that is not subtype-specific (belongs in SMG discipline)
3. **MOVE_TO_COMPONENT_CHECKLIST**: Maturity detail subordinate to a parent control assertion (belongs in component checklist, not baseline)
4. **MOVE_TO_EXPANSION**: Sector/subsector/context dependent (belongs in expansion layer)
5. **DROP**: Cannot be rewritten without subjective judgment or solution artifacts

## 6. Examples

### Example 1: "Basic Function" Pattern
**Legacy**: "Do access control systems perform their basic function?"
**Outcome**: REWRITE_TO_CONTROL_ASSERTION
**Proposed**: "At controlled entry points, is access granted or denied based on presented credentials?"

### Example 2: Subtype-Level Procedure
**Legacy**: "Are documented procedures in place for access control systems?"
**Outcome**: MOVE_TO_SMG
**Reason**: SUBTYPE_LEVEL_PROCEDURE_QUESTION (procedures belong in SMG, not per-subtype)

### Example 3: Solution Artifact
**Legacy**: "Are NVR systems installed and operational?"
**Outcome**: REWRITE_TO_CONTROL_ASSERTION (if clean rewrite exists) or DROP
**Proposed**: "Is video recorded and retained for designated cameras?"

### Example 4: Sector Context
**Legacy**: "Are crowd control measures in place for large events?"
**Outcome**: MOVE_TO_EXPANSION
**Reason**: SECTOR_SUBSECTOR_CONTEXT_REQUIRED (event-specific, not universal baseline)

### Example 5: Quality Adjective
**Legacy**: "Are access control systems effective?"
**Outcome**: REWRITE_TO_CONTROL_ASSERTION
**Proposed**: "At controlled entry points, is access granted or denied based on presented credentials?"

## 7. UI Tone Guidelines

When rewriting questions, avoid degrading language. Prefer neutral, factual control behavior descriptions.

**Avoid**: "Do systems work properly?" → **Prefer**: "Are [control behaviors] present?"

**Avoid**: "Are systems adequate?" → **Prefer**: "Is [specific control] established?"

**Avoid**: "Do personnel know their roles?" → **Prefer**: "Are roles assigned and documented?"

## 8. Deterministic Classification Rules

The analyzer tool uses these rules (in order of precedence):

1. If contains forbidden phrase → Classify based on phrase type
2. If contains solution artifact → REWRITE if template exists, else DROP
3. If sector/subsector context detected → MOVE_TO_EXPANSION
4. If procedure/roles question at subtype level → MOVE_TO_SMG (unless subtype is inherently procedural)
5. If unanchored (no boundary) → REWRITE_TO_CONTROL_ASSERTION (with boundary added)
6. If subjective judgment required → DROP
7. Default → REWRITE_TO_CONTROL_ASSERTION (if discipline/subtype mapping exists)
