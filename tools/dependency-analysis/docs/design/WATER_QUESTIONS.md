```markdown
# Water Infrastructure Questions

## SECTION 1: SERVICE STRUCTURE

### W_Q1

**Prompt:** Does the facility rely on a municipal/public water utility for primary water supply?

**Answer Type:** enum

**Help Text:** Answer YES when your facility receives water from a municipal or public utility. Answer NO if you rely entirely on a private well, onsite source, or other non-municipal supply.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q2

**Prompt:** How many water service connections supply the facility?

**Answer Type:** integer

**Help Text:** Count the number of distinct service lines entering your facility from the municipal water system (typically 1–5). Multiple connections provide some redundancy.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q3

**Prompt:** Do all water service connections enter the site at the same geographic location?

**Answer Type:** enum

**Help Text:** Answer YES when all water lines converge at the same point or share the same entry trench. Answer NO if connections are geographically separated (different building sides or distant entry points).

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q4

**Prompt:** Are water service lines/valves/meters collocated in a shared utility corridor with other critical utilities?

**Answer Type:** enum

**Help Text:** Shared corridors expose multiple utilities to the same damage event (excavation, vehicle impact). Answer YES if water infrastructure shares trenches, vaults, or pathways with electric, gas, or communications utilities.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q5

**Prompt:** Has the facility identified the water utility/provider and key upstream dependency information relevant to the site?

**Answer Type:** enum

**Help Text:** Answer YES when you know your water utility provider name and understand upstream dependencies (storage tanks, pump stations, treatment plants) that affect your site. This knowledge supports coordination during outages.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → W_UPSTREAM_UNKNOWN

**Scope:** BASELINE

---

## SECTION 2: RESILIENCE STRUCTURE

### W_Q6

**Prompt:** Does the facility participate in a priority restoration or coordinated restoration plan with the water utility/provider?

**Answer Type:** enum

**Help Text:** Answer YES if your facility has formal priority restoration status, documented agreements, or confirmed coordination procedures with the water utility for faster service recovery during widespread outages.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → W_NO_PRIORITY_RESTORATION

**Scope:** PRA_SLA

---

### W_Q7

**Prompt:** Does the facility have a documented contingency/coordination plan with the water utility/provider for extended service disruption?

**Answer Type:** enum

**Help Text:** Answer YES when your facility has documented procedures, contact lists, and coordination steps with the water utility for managing extended service disruptions (days to weeks).

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

**Scope:** PRA_SLA

---

### W_Q8

**Prompt:** Does the facility have an alternate/backup water source that can be used if primary water service is disrupted?

**Answer Type:** enum

**Help Text:** Examples include onsite storage tanks, secondary well, portable water delivery, or alternate service connection. Answer YES if any alternate source exists; NO if you have no backup.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → W_NO_ALTERNATE_SOURCE

---

### W_Q9

**Prompt:** Can the alternate/backup water source support core operational water needs for an extended disruption?

**Answer Type:** enum

**Help Text:** Answer YES when your alternate water source has sufficient capacity and duration to sustain critical facility operations (not just life-safety) during an extended outage (days to weeks).

**Conditional Display:** Always shown (or gated by W_Q8 = YES)

**Requires if YES:** None

**Vulnerability Trigger:** NO → W_ALTERNATE_INSUFFICIENT

---

### W_Q10

**Prompt:** Is the alternate/backup water source dependent on commercial power or another external service to function?

**Answer Type:** enum

**Help Text:** Answer YES if your alternate water source requires grid power, communications, or other external services to operate (e.g., electric pumps, automated controls). Answer NO if it operates independently.

**Conditional Display:** Always shown (or gated by W_Q8 = YES)

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q11

**Prompt:** Does the facility rely on water-based fire suppression systems that depend on water service pressure/supply?

**Answer Type:** enum

**Help Text:** Answer YES if your facility has sprinkler systems, standpipes, or fire hydrants that depend on municipal water pressure. Answer NO if you have no water-based fire suppression or it operates independently.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q12

**Prompt:** Is there a secondary water supply approach for fire suppression if primary water pressure/supply is lost?

**Answer Type:** enum

**Help Text:** Examples include onsite fire water storage tanks, fire pumps with backup power, or alternate water sources. Answer YES if secondary fire suppression capability exists.

**Conditional Display:** Only shown when W_Q11 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Scope:** PRA_SLA

---

### W_Q13

**Prompt:** Has the facility evaluated the operational impact if fire suppression water is unavailable during a prolonged disruption?

**Answer Type:** enum

**Help Text:** Answer YES if you have assessed how loss of fire suppression capability affects facility operations, insurance, regulatory compliance, and risk tolerance during extended water outages.

**Conditional Display:** Only shown when W_Q11 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q14

**Prompt:** Does the facility rely on onsite water pumping/boosting equipment to maintain usable water supply/pressure?

**Answer Type:** enum

**Help Text:** Answer YES if your facility requires booster pumps, lift stations, or pressurization equipment to deliver adequate water pressure to your operations. Answer NO if municipal pressure is sufficient.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q15

**Prompt:** Is backup power available to support onsite water pumps/boosters during a power outage?

**Answer Type:** enum

**Help Text:** Answer YES when your water pumps have generator, UPS, or portable power connections sized to run required loads during grid outages.

**Conditional Display:** Only shown when W_Q14 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q16

**Prompt:** Can onsite water pumps/boosters be operated or overridden manually if automated controls fail?

**Answer Type:** enum

**Help Text:** Manual override includes local controls, manual start buttons, or procedures that allow pump operation during automation or controls failures. Answer YES if manual operation is possible.

**Conditional Display:** Only shown when W_Q14 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q17

**Prompt:** Is there a monitoring/alarm method for low pressure, pump failure, or storage depletion (onsite)?

**Answer Type:** enum

**Help Text:** Include SCADA, remote alarming, local annunciation, or monitoring systems that alert operators to water system problems (low pressure, pump failure, tank depletion). Answer YES if monitoring exists.

**Conditional Display:** Only shown when W_Q14 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

### W_Q18

**Prompt:** Are critical pump/control components identified and available through at least two sources?

**Answer Type:** enum

**Help Text:** Answer YES when spare parts and components for critical water pumps and controls can be sourced from multiple vendors, allowing rapid repair during supply chain disruptions.

**Conditional Display:** Only shown when W_Q14 = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

---

## SECTION 4: OPERATIONAL IMPACT PROFILE (Curve Questions)

### curve_requires_service

**Prompt:** Does the facility require water service for its core operations?

**Answer Type:** boolean

**Help Text:** Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.

**Conditional Display:** Always shown first

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if normal facility operations depend on water service. This initiates the impact assessment; if NO, no operational loss is assumed.

---

### curve_time_to_impact

**Prompt:** If water service is lost (without alternate source), how soon would the facility be severely impacted? (hours)

**Answer Type:** number

**Help Text:** Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate in hours how quickly critical operations degrade if water service is lost with no alternate source available. Use realistic estimates based on on-site storage capacity or operational flexibility.

---

### curve_loss_no_backup

**Prompt:** Once water service is lost (without alternate source), what percentage of normal business functions are lost or degraded?

**Answer Type:** number

**Help Text:** Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would be offline if water service is lost without any backup. 100% means complete shutdown; 0% means no loss.

---

### curve_backup_available

**Prompt:** Is any backup or alternate water source available for this infrastructure?

**Answer Type:** boolean

**Help Text:** Select YES if there is any alternate or secondary water source that could sustain operations. This gates the backup-specific curve questions.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if backup or alternate water sources exist (on-site storage, secondary supply line, alternate provider, or manual supply methods). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.

---

### curve_backup_duration

**Prompt:** How many hours can alternate water source sustain operations without resupply?

**Answer Type:** number

**Help Text:** Estimate how long mitigation can sustain operations before impacts increase (hours).

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate the duration (in hours, 0–96) that alternate water sources can sustain critical operations. This includes on-site storage capacity or manual delivery duration.

---

### curve_loss_with_backup

**Prompt:** Once water service is lost (considering alternate source), what percentage of normal business functions are lost or degraded?

**Answer Type:** number

**Help Text:** With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup water sources active. This captures functions requiring the primary service explicitly.

---

### curve_recovery_time

**Prompt:** Once external water service is restored, how long until full resumption of operations? (hours)

**Answer Type:** number

**Help Text:** After service is restored, estimate how long it takes to return to normal operations.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate time (in hours, 0–168) to restore normal facility operations after water service is restored.

```
