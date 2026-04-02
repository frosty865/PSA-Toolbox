# Cursor Guardrails Checklist (Run this before ANY implementation)

## A) Question/Spine Validity
- [ ] Question is YES/NO form (Are/Is/Do/Does/Has/Have/Can).
- [ ] Response enum is exactly ["YES","NO","N_A"].
- [ ] Boundary anchor exists (entry point / restricted area / monitored area / perimeter / etc.).
- [ ] Control verb exists (controlled / identified and controlled / monitored / recorded) — not "installed".
- [ ] No performance/assurance language.
- [ ] No solution artifacts.

## B) Baseline vs Depth
- [ ] Is this a true posture boundary? If NO → component depth.
- [ ] Does this describe "how well / how long / how resilient / how configured"? If YES → component depth.
- [ ] Is this a special-case feature (analytics, blast, ballistic, film, glazing)? If YES → NOT a spine.

## C) Discipline Spine Count
- [ ] Proposed spines for the discipline are <= 3.
- [ ] If >3, user explicitly authorized it in writing.

## D) Analyzer Drift Controls
- [ ] Early gate exists for the discipline to prevent non-allowlisted SYSTEMS becoming spines.
- [ ] Templates exist only for allowlisted spine subtypes.
- [ ] Non-allowlisted SYSTEMS route to COMPONENT_CHECKLIST.
- [ ] Linter expanded to recognize correct boundary concepts (do not dumb templates down).

## E) Outputs
- [ ] Packets generated and reviewed first.
- [ ] Spines written to baseline_canon/spines/.
- [ ] Component manifest written to baseline_canon/components/.
- [ ] Constraints written to baseline_canon/constraints/.
- [ ] No DB writes.
