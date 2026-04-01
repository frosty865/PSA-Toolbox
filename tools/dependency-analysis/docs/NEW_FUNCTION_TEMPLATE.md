# New Function Intake Template

**No function is implemented without an accepted template.** Use this template to propose new work and get agreement before implementation.

## Required fields

| Field | Description |
|-------|-------------|
| **Function name** | Short, clear name for the capability. |
| **Problem solved** | What user or system need this addresses. |
| **Layer impacted** | UI / engine / reporter (one or more). |
| **Workbook alignment impact** | Does this change how inputs map to the workbook or summary? If yes, describe. |
| **Template impact** | Any change to DOCX template (placeholders, anchors, sections)? |
| **VOFC impact** | Any change to VOFC triggers, calibration, or table content? |
| **Performance risk** | Low / medium / high. Brief justification. |
| **Acceptance criteria** | Concrete, testable conditions for “done”. |
| **Tests required** | Unit, integration, or smoke tests to add or extend. |

## Process

1. Copy this template into a proposal (e.g. issue or doc).
2. Fill every field; mark N/A only where truly not applicable.
3. Get review/acceptance from the team or maintainer.
4. Only then implement; link implementation to the accepted template.

This keeps the baseline stable and makes new work visible and justified.
