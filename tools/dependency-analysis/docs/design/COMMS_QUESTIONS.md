```markdown
# Communications Infrastructure Questions

## SECTION 1: SERVICE STRUCTURE

### CO-1

**Prompt:** Who provides communications service to the facility?

**Answer Type:** repeatable

**Help Text:** List each upstream provider that supplies this service. Include primary and secondary designations if applicable.

**Conditional Display:** Always shown

**Requires if YES:** ServiceProvider entries (provider_name, designation)

**Vulnerability Trigger:** NO → Limited awareness of upstream communications

**Additional Context:** Identify all service providers supplying voice or data transport to this facility. Include primary/secondary designations if you have multiple providers for redundancy.

---

### CO-2

**Prompt:** List known upstream assets that directly affect this site (optional).

**Answer Type:** repeatable

**Help Text:** Optional. If YES, you may add entries for assets you know; 0 entries is acceptable. Location and coordinates are not required.

**Conditional Display:** Always shown

**Requires if YES:** None (entries are optional)

**Vulnerability Trigger:** NO → Upstream assets unknown

**Additional Context:** Understanding upstream infrastructure (central offices, fiber hubs, cell towers) helps identify shared points of failure. This is optional; zero entries is acceptable if you answer YES but have no details.

---

### CO-3

**Prompt:** Does the facility maintain more than one active communications service connection (e.g., separate carrier circuits or transport paths)?

**Answer Type:** integer

**Help Text:** Multiple connections may include separate carriers, diverse fiber paths, or alternate wireless/satellite transport. If YES, enter the number of connections (must be ≥ 2).

**Conditional Display:** Always shown

**Requires if YES:** connection_count (≥ 2)

**Vulnerability Trigger:** NO → Single point of failure (communications)

**Additional Context:** Multiple connections reduce single-point-of-failure risk for voice or data services. Enter the exact number of independent connections (≥ 2 to satisfy YES). If you have only one connection, select NO.

---

### CO-4

**Prompt:** Are communications service connections geographically and physically separated (e.g., different building entrances, conduits, or outside routes)?

**Answer Type:** repeatable

**Help Text:** Geographic separation reduces the likelihood that a single external event (construction damage, vehicle strike, localized outage) will affect all circuits. Only asked when multiple connections exist (CO-3 Yes). If only one, use N/A. If YES, add one entry per connection.

**Conditional Display:** Only shown when CO-3 = YES

**Requires if YES:** CommsConnection entries (connection_label, facility_entry, shared_corridor_with_other_utilities)

**Vulnerability Trigger:** NO → Co-located entry points; shared_corridor YES → Collocated with other utilities

**Additional Context:** Geographic separation of connections reduces risk from localized events (construction damage, vehicle strikes, localized carrier outages). For each connection, provide entry location and note if it shares a utility corridor with other systems.

---

### CO-5

**Prompt:** Is at least one connection capable of supporting core operations independently?

**Answer Type:** boolean

**Help Text:** If YES, confirm that at least one connection can sustain core load.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → Insufficient load survivability

**Additional Context:** Identify whether at least one connection can independently sustain your critical communications needs. This addresses whether facility operations can survive loss of any single connection.

---

## SECTION 2: RESILIENCE STRUCTURE

### CO-8

**Prompt:** Does the facility have backup communications capability available during service loss?

**Answer Type:** repeatable

**Help Text:** If YES, add backup capability details: type, scope, capacity, estimated duration.

**Conditional Display:** Always shown

**Requires if YES:** BackupCommsCapability entries (capability_type, scope, capacity_description, estimated_duration)

**Vulnerability Trigger:** NO → No alternate capability

**Additional Context:** Document all backup communications capabilities including redundant circuits, mobile hot spots, satellite connections, or radio systems. For each, specify type, which operations it supports, capacity, and estimated duration.

---

### CO-9

**Prompt:** If the primary communications circuit fails due to an external event, would the backup likely remain operational?

**Answer Type:** enum

**Help Text:** This evaluates whether backup service depends on the same carrier, route, or infrastructure as the primary circuit.

**Conditional Display:** Only shown when CO-8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO / Unknown → Backup may not remain available during same outage

**Additional Context:** Evaluate whether backup service depends on the same carrier, route, or infrastructure as the primary circuit. If both use the same carrier or physical path, an external event (fiber cut, carrier outage) may affect both circuits simultaneously.

---

### CO-10

**Prompt:** Are backup communications systems routinely tested or exercised to verify reliability?

**Answer Type:** boolean

**Help Text:** Only asked when backup is available (CO-8 Yes). If YES, backup is considered reliable.

**Conditional Display:** Only shown when CO-8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO → Backup reliability uncertain

**Additional Context:** Backup systems that are never tested may fail when needed. Confirm whether you routinely test or exercise backup communications capabilities (functional, procedural, operational) to ensure reliability.

---

### CO-11

**Prompt:** Does the facility have established coordination with the service provider for restoration?

**Answer Type:** boolean

**Help Text:** If YES, coordination is documented and restoration priority is understood.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → No restoration coordination

**Additional Context:** In widespread outages, carrier restoration follows a prioritization sequence. Confirm whether your facility has documented coordination (SLA, mutual aid agreements, priority restoration status) with the communications service provider.

---

## SECTION 3: PHYSICAL EXPOSURE

### CO-6

**Prompt:** Are exterior communications components protected from accidental/intentional damage?

**Answer Type:** repeatable

**Help Text:** If YES, add one entry per component type with location and protection type.

**Conditional Display:** Always shown

**Requires if YES:** CommsComponentProtection entries (component_type, location, protection_type)

**Vulnerability Trigger:** NO → Unprotected exterior components

**Additional Context:** Exterior components (demarcation boxes, antenna masts, fiber pedestals) exposed to the public are vulnerable to accidental or intentional damage. List all exposed components and describe protection type (enclosures, barriers, fences, etc.).

---

### CO-7

**Prompt:** Are exterior communications components exposed to potential vehicle impact?

**Answer Type:** boolean

**Help Text:** If YES, a follow-up will ask whether protective measures exist (bollards, barriers, standoff, etc.).

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** YES → vehicle impact exposure captured for follow-up protection question

**Additional Context:** Assess whether facility parking areas, loading docks, or public right-of-ways could result in vehicle contact with communications infrastructure (fiber pedestals, antenna supports, equipment cabinets).

---

### CO-7a

**Prompt:** Are protective measures in place to reduce vehicle impact risk to exterior communications components?

**Answer Type:** boolean

**Help Text:** Only shown when CO-7 = YES. Answer YES/NO/UNKNOWN to describe protection posture.

**Conditional Display:** Only shown when CO-7 = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO → Vehicle impact exposure without protection (condition code only)

**Additional Context:** If vehicle impact is a concern (CO-7 = YES), confirm whether protective barriers or standoff distance reduce the risk. Examples: bollards, ground-mounted enclosures, elevated or recessed installations.

---

## SECTION 4: OPERATIONAL IMPACT PROFILE (Curve Questions)

### curve_requires_service

**Prompt:** Does the facility require communications service for its core operations?

**Answer Type:** boolean

**Help Text:** Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.

**Conditional Display:** Always shown first

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if normal facility operations depend on external communications capability. This initiates the impact assessment; if NO, no operational loss is assumed.

---

### curve_time_to_impact

**Prompt:** If communications service is lost (without backup), how soon would the facility be severely impacted? (hours)

**Answer Type:** number

**Help Text:** Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate in hours how quickly critical communications-dependent operations degrade if service is lost with no backup available. Use realistic estimates based on mobile service availability, manual workarounds, or alternate providers.

---

### curve_loss_no_backup

**Prompt:** Once communications service is lost (without backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would be offline if communications service is lost without any backup. 100% means complete shutdown; 0% means no loss.

---

### curve_backup_available

**Prompt:** Is any backup or alternate communications capability available for this infrastructure?

**Answer Type:** boolean

**Help Text:** Select YES if there is any backup communications (alternate provider, mobile backup, etc.) that could sustain operations. This gates the backup-specific curve questions.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO or UNKNOWN → No backup communications capability

**Additional Context:** Select YES if backup communications systems (alternate provider, mobile backup, mesh network, satellite, or direct connections) exist to sustain operations during outages. Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.

---

### curve_backup_duration

**Prompt:** How many hours can alternate communications capability sustain operations?

**Answer Type:** number

**Help Text:** Estimate how long mitigation can sustain operations before impacts increase (hours).

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate the duration (in hours, 0–96) that backup communications can sustain critical operations. This includes duration of stored fuel for generators or battery life for mobile systems.

---

### curve_loss_with_backup

**Prompt:** Once communications service is lost (considering backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup communications active. This captures functions requiring the primary service explicitly.

---

### curve_recovery_time

**Prompt:** Once external communications service is restored, how long until full resumption of operations? (hours)

**Answer Type:** number

**Help Text:** After service is restored, estimate how long it takes to return to normal operations.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate time (in hours, 0–168) to restore normal facility communications operations after the outage resolves.

```
