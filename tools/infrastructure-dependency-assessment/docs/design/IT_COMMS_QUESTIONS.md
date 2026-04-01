# IT and Communications Questions

Question set for Information Technology and Communications dependency tabs.

---

## Information Technology (IT)

### Impact Curve Questions

| ID | Prompt | Help Text |
|----|--------|-----------|
| `curve_requires_service` | Does the facility require internal digital systems (applications, servers, cloud services, identity systems) for its core operations? | If NO, the impact curve shows no impact and time-to-impact / loss / recovery questions are skipped. |
| `curve_time_to_impact` | If IT service is lost (without backup), how soon would the facility be severely impacted? (hours) | Enter hours 0–72. This drives the impact curve. |
| `curve_loss_no_backup` | Once IT service is lost (without backup), what percentage of normal business functions are lost or degraded? | Enter 0–100%. This drives the impact curve. |
| `curve_backup_duration` | How many hours can backup IT capability sustain operations without refueling/resupply? | Enter 0–96 hours. Only used when backup is available (IT-8). |
| `curve_loss_with_backup` | Once IT service is lost (considering backup), what percentage of normal business functions are lost or degraded? | Enter 0–100%. Defines capability after backup for the impact curve. Only shown when backup is available (IT-8). |
| `curve_recovery_time` | Once external IT service is restored, how long until full resumption of operations? (hours) | Enter hours 0–168. This drives the impact curve. |

### Main Questions (IT-1 – IT-11)

| ID | Prompt | Help Text | Vulnerability Trigger |
|----|--------|-----------|----------------------|
| IT-1 | Can the facility identify IT service provider(s)? | If YES, add one entry per provider with designation (primary/secondary). | NO → Limited awareness of upstream IT service |
| IT-2 | Can the facility identify and enumerate upstream IT assets or critical systems? | If YES, add one entry per asset with name/ID, location, service provider, and designation. | NO → Upstream IT assets unknown |
| IT-3 | Does the facility have multiple IT service connections or redundant network paths? | If YES, enter the number of connections (must be ≥ 2). | NO → Single point of failure (IT) |
| IT-4 | Are IT service connections physically separated and independently routed? | Only asked when multiple connections exist (IT-3 Yes). If only one, use N/A. If YES, add one entry per connection. | NO → Co-located entry points; shared_corridor YES → Collocated with other utilities |
| IT-5 | Is at least one connection capable of supporting core operations independently? | If YES, confirm that at least one connection can sustain core load. | NO → Insufficient load survivability |
| IT-6 | Are IT infrastructure components protected from accidental/intentional physical damage? | If YES, add one entry per component type with location and protection type. | NO → Unprotected exterior components |
| IT-7 | Are IT infrastructure components exposed to potential vehicle impact? | YES triggers vehicle impact vulnerability. If NO, describe mitigation measures. | YES → Vehicle impact risk; NO → mitigation description required |
| IT-8 | Does the facility have backup IT capability available during service loss? | If YES, add backup capability details: type, scope, capacity, estimated duration. | NO → No alternate capability |
| IT-9 | Are refueling/resupply or sustainment procedures established for backup operations? | Only asked when backup is available (IT-8 Yes). If YES, provide plan description and estimated duration. | NO → No sustainment planning |
| IT-10 | Are backup IT systems routinely tested or verified for reliability? | Only asked when backup is available (IT-8 Yes). If YES, backup is considered reliable. | NO → Backup reliability uncertain |
| IT-11 | Does the facility have established coordination with the IT service provider for restoration? | If YES, coordination is documented and restoration priority is understood. | NO → No restoration coordination |
| IT-backup_adequacy | Does the backup or alternate capability support all critical functions associated with this dependency? | This is about functions the dependency is expected to support, not full facility operations. | NO → Backup capability may not support critical operations |
| IT-backup_tested | Has the backup or alternate capability been tested or exercised? | Only asked when backup is available (IT-8 Yes). Testing may be functional, operational, or procedural. | NO / Unknown / >12mo → Backup systems may not function as intended if not routinely tested |
| IT-restoration_coordination | Are restoration roles and coordination procedures defined for this dependency? | Internal readiness and coordination—roles and procedures for restoration. Not provider coordination. | NO → Restoration coordination may be delayed due to unclear roles and procedures |
| it_plan_exercised | Has the IT continuity or recovery plan been exercised or tested? | Only asked when plan exists (it_continuity_plan_exists Yes). NO/Unknown → plan may not be effective if not exercised. | NO → Information technology recovery plans may not be effective if not exercised |

---

## Communications (CO)

### Impact Curve Questions

| ID | Prompt | Help Text |
|----|--------|-----------|
| `curve_requires_service` | Does the facility require communications service for its core operations? | If NO, the impact curve shows no impact and time-to-impact / loss / recovery questions are skipped. |
| `curve_time_to_impact` | If communications service is lost (without backup), how soon would the facility be severely impacted? (hours) | Enter hours 0–72. This drives the impact curve. |
| `curve_loss_no_backup` | Once communications service is lost (without backup), what percentage of normal business functions are lost or degraded? | Enter 0–100%. This drives the impact curve. |
| `curve_backup_duration` | How many hours can backup communications capability sustain operations without refueling/resupply? | Enter 0–96 hours. Only used when backup is available (CO-8). |
| `curve_loss_with_backup` | Once communications service is lost (considering backup), what percentage of normal business functions are lost or degraded? | Enter 0–100%. Defines capability after backup for the impact curve. Only shown when backup is available (CO-8). |
| `curve_recovery_time` | Once external communications service is restored, how long until full resumption of operations? (hours) | Enter hours 0–168. This drives the impact curve. |

### Main Questions (CO-1 – CO-11)

| ID | Prompt | Help Text | Vulnerability Trigger |
|----|--------|-----------|----------------------|
| CO-1 | Can the facility identify communications service provider(s)? | If YES, add one entry per provider with designation (primary/secondary). | NO → Limited awareness of upstream communications |
| CO-2 | Can the facility identify and enumerate upstream communications assets? | If YES, add one entry per asset with name/ID, location, service provider, and designation. | NO → Upstream assets unknown |
| CO-3 | Does the facility have multiple communications service connections? | If YES, enter the number of connections (must be ≥ 2). | NO → Single point of failure (communications) |
| CO-4 | Are service connections physically separated and independently routed? | Only asked when multiple connections exist (CO-3 Yes). If only one, use N/A. If YES, add one entry per connection. | NO → Co-located entry points; shared_corridor YES → Collocated with other utilities |
| CO-5 | Is at least one connection capable of supporting core operations independently? | If YES, confirm that at least one connection can sustain core load. | NO → Insufficient load survivability |
| CO-6 | Are exterior communications components protected from accidental/intentional damage? | If YES, add one entry per component type with location and protection type. | NO → Unprotected exterior components |
| CO-7 | Are exterior communications components exposed to potential vehicle impact? | YES triggers vehicle impact vulnerability. If NO, describe mitigation measures. | YES → Vehicle impact risk; NO → mitigation description required |
| CO-8 | Does the facility have backup communications capability available during service loss? | If YES, add backup capability details: type, scope, capacity, estimated duration. | NO → No alternate capability |
| CO-9 | Are refueling/resupply or sustainment procedures established for backup operations? | Only asked when backup is available (CO-8 Yes). If YES, provide plan description and estimated duration. | NO → No sustainment planning |
| CO-10 | Are backup communications systems routinely tested or verified for reliability? | Only asked when backup is available (CO-8 Yes). If YES, backup is considered reliable. | NO → Backup reliability uncertain |
| CO-11 | Does the facility have established coordination with the service provider for restoration? | If YES, coordination is documented and restoration priority is understood. | NO → No restoration coordination |
| CO-backup_adequacy | Does the backup or alternate capability support all critical functions associated with this dependency? | This is about functions the dependency is expected to support, not full facility operations. | NO → Backup capability may not support critical operations |
| CO-backup_tested | Has the backup or alternate capability been tested or exercised? | Only asked when backup is available (CO-8 Yes). Testing may be functional, operational, or procedural. | NO / Unknown / >12mo → Backup systems may not function as intended if not routinely tested |
| CO-restoration_coordination | Are restoration roles and coordination procedures defined for this dependency? | Internal readiness and coordination—roles and procedures for restoration. Not provider coordination. | NO → Restoration coordination may be delayed due to unclear roles and procedures |

---

## Conditional Logic

- **IT-4, CO-4**: Only shown when IT-3 / CO-3 = Yes (multiple connections).
- **IT-9, IT-10, IT-backup_tested / CO-9, CO-10, CO-backup_tested**: Only shown when IT-8 / CO-8 = Yes (backup available).
- **Curve 4–5** (backup duration, loss with backup): Only shown when facility requires service AND backup is available (IT-8 / CO-8 = Yes).
- **Curve 2–6**: Only shown when curve_requires_service = Yes.
