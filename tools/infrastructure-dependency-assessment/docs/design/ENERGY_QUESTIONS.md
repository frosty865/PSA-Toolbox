```markdown
# Energy Infrastructure Questions

## SECTION 1: SERVICE STRUCTURE

### E-1

**Prompt:** Who provides electric service to the facility?

**Answer Type:** repeatable

**Help Text:** List each upstream provider that supplies this service. Include primary and secondary designations if applicable.

**Conditional Display:** Always shown

**Requires if YES:** UtilityProvider entries (provider_name, designation)

**Vulnerability Trigger:** NO → Limited awareness of upstream power infrastructure

**Additional Context:** Identify the utility company/companies that serve this facility. Even partial knowledge (e.g., "local municipal utility") counts as YES. If you cannot identify any provider, select NO.

---

### E-2

**Prompt:** List known upstream assets that directly affect this site (optional).

**Answer Type:** repeatable

**Help Text:** Optional. If YES, you may add entries for substations or assets you know; 0 entries is acceptable. Location is free text (nearest facility, general area) — coordinates not required.

**Conditional Display:** Always shown

**Requires if YES:** None (entries are optional)

**Vulnerability Trigger:** NO → Upstream asset(s) unknown

**Additional Context:** Identifying upstream infrastructure (substations, transmission lines, generation facilities) helps identify shared points of failure. This is optional and informational; zero entries is acceptable if you answer YES but lack details.

---

### E-3

**Prompt:** Does the facility have more than one electric service connection?

**Answer Type:** integer

**Help Text:** If YES, enter the number of service connections (must be ≥ 2).

**Conditional Display:** Always shown

**Requires if YES:** service_connection_count (≥ 2)

**Vulnerability Trigger:** NO → Single point of failure (electric)

**Additional Context:** Multiple service connections reduce single-point-of-failure risk. Enter the exact number of independent connections (must be ≥ 2 to satisfy YES). If you have only one connection, select NO.

---

### E-4

**Prompt:** Are service connections physically separated and independently routed into the facility?

**Answer Type:** repeatable

**Help Text:** Only asked when the facility has more than one service connection (E-3 Yes). If only one connection, use N/A. If YES, add one entry per connection. Number of entries must match service connection count.

**Conditional Display:** Only shown when E-3 = YES

**Requires if YES:** ServiceConnection entries (connection_label, facility_entry Lat/Long, shared_corridor_with_other_utilities)

**Vulnerability Trigger:** NO → Co-located entry points; N/A when only one connection

**Additional Context:** Geographic separation of service connections reduces risk from localized events (construction damage, vehicle strikes). For each connection, provide entry location (Lat/Long or facility address) and note if it shares a utility corridor with other systems.

---

### E-5

**Prompt:** Is at least one service connection capable of supporting core operations independently?

**Answer Type:** repeatable

**Help Text:** If YES, enter the connection label (single connection when E-3 is No) or multiple labels when E-3 is Yes.

**Conditional Display:** Always shown

**Requires if YES:** capable_connection_labels (min 1)

**Vulnerability Trigger:** NO → Insufficient load survivability

**Additional Context:** Identify which service connection(s) can independently sustain your critical operations. This addresses whether facility operations can survive loss of any single connection. Enter at least one capable connection label.

---

## SECTION 2: RESILIENCE STRUCTURE

### E-8

**Prompt:** Does the facility have backup power available during loss of commercial power?

**Answer Type:** repeatable

**Help Text:** If YES, add each backup asset and select supported load classification(s): Life Safety, Critical/Core Services, Full Facility Load.

**Conditional Display:** Always shown

**Requires if YES:** BackupPowerAsset entries (asset_type, supported_load_classification, capacity, estimated_runtime)

**Vulnerability Trigger:** NO or only life_safety → No alternate power capability for core operations

**Additional Context:** Document all backup power systems including generators, UPS, battery backup, or alternate grid interconnections. For each, specify asset type, which facility loads it supports (life-safety only vs. critical operations), capacity, and estimated runtime.

---

### E-9

**Prompt:** Are refueling/sustainment procedures established for extended backup operation?

**Answer Type:** boolean

**Help Text:** Only asked when backup power is available (E-8 Yes). If YES, provide fuel source and optional supplier/timeframe.

**Conditional Display:** Only shown when E-8 = YES

**Requires if YES:** fuel_source (onsite|external|mixed|unknown)

**Vulnerability Trigger:** NO → No refueling/sustainment planning

**Additional Context:** For backup power to sustain operations beyond its storage capacity, fuel or sustainment procedures must exist. Specify fuel source (onsite tanks, external supply contracts, mixed). This is critical for extended outages lasting days or weeks.

---

### E-10

**Prompt:** Are backup power systems routinely tested under operational load?

**Answer Type:** boolean

**Help Text:** Only asked when backup power is available (E-8 Yes). If YES, provide test frequency, load condition, and last test date (used in narrative only).

**Conditional Display:** Only shown when E-8 = YES

**Requires if YES:** test_frequency, load_condition, last_test_date

**Vulnerability Trigger:** NO → Backup power reliability uncertain

**Additional Context:** Backup systems that are never tested under load may fail when needed. Document test frequency (monthly, quarterly, annual), load condition (full, partial), and last test date to establish maintenance rigor.

---

### E-11

**Prompt:** Does the facility have established coordination with the electric utility provider for restoration?

**Answer Type:** boolean

**Help Text:** If YES, coordination is documented and restoration priority is understood.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → No restoration coordination arrangement

**Additional Context:** In widespread outages, utility restoration follows a prioritization sequence. Confirm whether your facility has documented coordination (SLA, mutual aid agreements, priority restoration status) with the electric utility provider.

---

## SECTION 3: PHYSICAL EXPOSURE

### E-6

**Prompt:** Are exterior electrical components protected from accidental/intentional damage?

**Answer Type:** repeatable

**Help Text:** If YES, add one entry per component type with Lat/Long and protection type.

**Conditional Display:** Always shown

**Requires if YES:** ExteriorElectricalAssetProtection entries (component_type, Lat/Long, protection_type)

**Vulnerability Trigger:** NO → Unprotected exterior electrical components

**Additional Context:** Exterior components (transformers, switchgear, conduit) exposed to the public are vulnerable to accidental or intentional damage. List all exposed components and describe protection type (bollards, barriers, fences, etc.). Location helps contextualize risk.

---

### E-7

**Prompt:** Are exterior electrical components exposed to potential vehicle impact?

**Answer Type:** boolean

**Help Text:** If YES, confirm whether protective measures are in place (see follow-up).

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** YES → Vehicle impact exposure (see gated protection follow-up)

**Additional Context:** Assess whether facility parking areas, loading docks, or public right-of-ways could result in vehicle contact with electrical infrastructure (transformers, service pedestals, meter banks). This is common in facilities with street-accessible entrances.

---

### E-7a

**Prompt:** Are protective measures in place to reduce vehicle impact risk to exterior electrical components (e.g., bollards, barriers, standoff, grade separation)?

**Answer Type:** boolean

**Help Text:** Only shown when E-7 = YES. Answer with YES/NO/UNKNOWN to capture whether protection exists.

**Conditional Display:** Only shown when E-7 = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO → Exposed without protective measures (condition code only)

**Additional Context:** If vehicle impact is a concern (E-7 = YES), confirm whether protective barriers or standoff distance reduce the risk. Examples: bollards, jersey barriers, concrete plant boxes, elevated platforms, or location away from traffic patterns.

---

## SECTION 4: OPERATIONAL IMPACT PROFILE (Curve Questions)

### curve_requires_service

**Prompt:** Does the facility require electric power for its core operations?

**Answer Type:** boolean

**Help Text:** Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.

**Conditional Display:** Always shown first

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if normal facility operations depend on electric power. Select NO if facility can operate indefinitely without grid power (e.g., fully off-grid operations). If NO, remaining curve questions are skipped.

---

### curve_time_to_impact

**Prompt:** If electric supply is lost (without backup), how soon would the facility be severely impacted? (hours)

**Answer Type:** number

**Help Text:** Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate in hours how quickly critical operations degrade if grid power is lost with no backup available. Use realistic estimates based on generator startup time, battery capacity, or manual workarounds.

---

### curve_loss_no_backup

**Prompt:** Once electric supply is lost (without backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would be offline if grid power is lost without any backup. 100% means complete shutdown; 0% means no loss.

---

### curve_backup_available

**Prompt:** Is any backup or alternate power capability available for this infrastructure?

**Answer Type:** boolean

**Help Text:** Select YES if there is any backup power (generator, UPS, etc.) or alternate supply that could sustain operations. This gates the backup-specific curve questions.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO or UNKNOWN → No backup power capability

**Additional Context:** Select YES if backup systems (generator, UPS, alternate fuel sources, or grid interconnects) exist to sustain operations during grid outages. Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.

---

### curve_backup_duration

**Prompt:** How many hours can backup power sustain operations without refueling?

**Answer Type:** number

**Help Text:** Estimate how long mitigation can sustain operations before impacts increase (hours).

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate the duration (in hours, 0–96) that backup power can sustain full facility operations before manual intervention (refueling) or capacity depletion occurs.

---

### curve_loss_with_backup

**Prompt:** Once electric supply is lost (considering backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup power active. This captures partial load scenarios or functions requiring grid power explicitly.

---

### curve_recovery_time

**Prompt:** Once external service is restored, how long until full resumption of operations? (hours)

**Answer Type:** number

**Help Text:** After service is restored, estimate how long it takes to return to normal operations.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate time (in hours, 0–168) to restore normal facility operations after grid power returns. Includes utility restoration time, system restart, and data recovery.

```
