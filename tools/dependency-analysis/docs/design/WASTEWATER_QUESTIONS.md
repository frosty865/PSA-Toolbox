```markdown
# Wastewater Infrastructure Questions

## SECTION 1: SERVICE STRUCTURE

### WW_Q1

**Prompt:** Does the facility discharge wastewater to a municipal/public sewer system?

**Answer Type:** enum

**Help Text:** Answer YES when flow is sent to a municipal or regional utility. Answer NO when the site relies entirely on onsite treatment, septic, or holding.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q2

**Prompt:** How many wastewater discharge/service connections serve the facility?

**Answer Type:** integer

**Help Text:** Enter the number of active discharge points to the public system (0–5). Include each distinct connection or lift station tie-in.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q3

**Prompt:** Do all wastewater service connections enter/leave the site at the same geographic location?

**Answer Type:** enum

**Help Text:** Answer YES when all discharge lines share the same route or entry point. Answer NO when routes are geographically separated.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q4

**Prompt:** Are wastewater lines/manholes/cleanouts collocated in a shared utility corridor?

**Answer Type:** enum

**Help Text:** Shared corridors expose multiple utilities to the same damage. Select YES when wastewater infrastructure shares a trench, duct bank, or vault with other utilities.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q5

**Prompt:** Has the facility identified the wastewater utility/provider and primary upstream dependency?

**Answer Type:** enum

**Help Text:** Answer YES when provider name and upstream assets (e.g., pump station, treatment plant) are known and documented.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → WW_UPSTREAM_UNKNOWN

---

## SECTION 2: RESILIENCE STRUCTURE

### WW_Q6

**Prompt:** Does the facility participate in a priority restoration plan with the wastewater provider?

**Answer Type:** enum

**Help Text:** YES when the provider has confirmed prioritization criteria or agreements for restoring wastewater service to the site.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → WW_NO_PRIORITY_RESTORATION

**Scope:** PRA_SLA

---

### WW_Q7

**Prompt:** Does the facility have a documented contingency/coordination plan with the wastewater provider?

**Answer Type:** enum

**Help Text:** Answer YES when responsibilities, contacts, and communication steps with the provider are documented and current.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

**Scope:** PRA_SLA

---

### WW_Q8

**Prompt:** Does the facility rely on onsite wastewater pumping?

**Answer Type:** enum

**Help Text:** Select YES when lift stations or ejector pumps are needed to move wastewater offsite; NO when flow is purely gravity fed.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q9

**Prompt:** Is backup power available to support onsite wastewater pumps?

**Answer Type:** enum

**Help Text:** Answer YES when pumps have generator, UPS, or portable power connections sized to run required loads.

**Conditional Display:** Only shown when WW_Q8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q10

**Prompt:** Can onsite wastewater pumps be operated or overridden manually?

**Answer Type:** enum

**Help Text:** Manual override includes local controls, bypass, or procedures that allow operation during automation or power faults.

**Conditional Display:** Only shown when WW_Q8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q11

**Prompt:** Is there a monitoring/alarm method for pump failure, high level, or backflow risk?

**Answer Type:** enum

**Help Text:** Include SCADA, remote alarming, or local annunciation that alerts operators to pump failure, tank high level, or backflow events.

**Conditional Display:** Only shown when WW_Q8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q12

**Prompt:** Are critical pump components available through at least two sources?

**Answer Type:** enum

**Help Text:** Answer YES when spare parts or suppliers exist beyond a single vendor, allowing rapid repair or replacement.

**Conditional Display:** Only shown when WW_Q8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### WW_Q13

**Prompt:** During a wastewater service disruption, does the facility have holding/containment capability?

**Answer Type:** enum

**Help Text:** YES when tanks, totes, or contracted services can hold effluent until service is restored. NO when overflow would occur quickly.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

**Scope:** PRA_SLA

---

### WW_Q14

**Prompt:** Has the facility evaluated regulatory/operational constraints for prolonged disruption?

**Answer Type:** enum

**Help Text:** Answer YES when environmental permits, regulatory reporting, and operating limitations for extended outages are understood and documented.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

## SECTION 4: OPERATIONAL IMPACT PROFILE (Curve Questions)

### curve_requires_service

**Prompt:** Does the facility require wastewater service for its core operations?

**Answer Type:** boolean

**Help Text:** Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.

**Conditional Display:** Always shown first

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if normal facility operations depend on wastewater service. This initiates the impact assessment; if NO, no operational loss is assumed.

---

### curve_time_to_impact

**Prompt:** If wastewater service is lost (without alternate capability), how soon would the facility be severely impacted? (hours)

**Answer Type:** number

**Help Text:** Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate in hours how quickly critical operations degrade if wastewater service is lost with no alternate capability available. Use realistic estimates based on on-site holding capacity or operational flexibility.

---

### curve_loss_no_backup

**Prompt:** Once wastewater service is lost (without alternate capability), what percentage of normal business functions are lost or degraded?

**Answer Type:** number

**Help Text:** Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would be offline if wastewater service is lost without any backup. 100% means complete shutdown; 0% means no loss.

---

### curve_backup_available

**Prompt:** Is any backup or alternate wastewater capability available for this infrastructure?

**Answer Type:** boolean

**Help Text:** Select YES if there is any alternate or holding capability that could sustain operations. This gates the backup-specific curve questions.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if backup or alternate wastewater capability exists (on-site holding, alternate discharge point, on-site treatment, or manual management). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.

---

### curve_backup_duration

**Prompt:** How many hours can alternate wastewater capability sustain operations without resupply?

**Answer Type:** number

**Help Text:** Estimate how long mitigation can sustain operations before impacts increase (hours).

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate the duration (in hours, 0–96) that alternate wastewater capability can sustain critical operations. This includes on-site holding tank capacity or treatment system runtime.

---

### curve_loss_with_backup

**Prompt:** Once wastewater service is lost (considering alternate capability), what percentage of normal business functions are lost or degraded?

**Answer Type:** number

**Help Text:** With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup wastewater capability active. This captures functions requiring the primary service explicitly.

---

### curve_recovery_time

**Prompt:** Once external wastewater service is restored, how long until full resumption of operations? (hours)

**Answer Type:** number

**Help Text:** After service is restored, estimate how long it takes to return to normal operations.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate time (in hours, 0–168) to restore normal facility operations after wastewater service is restored.

```
