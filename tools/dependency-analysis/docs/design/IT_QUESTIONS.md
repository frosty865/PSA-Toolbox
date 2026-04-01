```markdown
# Information Technology Infrastructure Questions

**Overview:** This section evaluates external IT transport and hosting dependencies (e.g., ISP circuits, cloud providers). Internal applications and devices are addressed separately.

---

## SECTION 1: SERVICE STRUCTURE

### IT-1

**Prompt:** Who provides external IT transport or hosting services to the facility?

**Help Text:** (clarify: external transport only, not internal systems)

**Answer Type:** repeatable

**Help Text:** If YES, add one entry per provider with designation (primary/secondary).

**Conditional Display:** Always shown

**Requires if YES:** ServiceProvider entries (provider_name, designation)

**Vulnerability Trigger:** NO → Limited awareness of upstream IT service

**Additional Context:** Identify external IT service providers (ISPs, cloud platforms, SaaS vendors) supplying critical IT services. This includes external transport only, not internal systems. List all providers essential for facility operations.

---

### IT-2

**Prompt:** List known upstream assets that directly affect this site (optional).

**Answer Type:** repeatable

**Help Text:** Examples: Data centers, hosting facilities, managed service provider infrastructure. If YES, list what is known; details may be limited.

**Conditional Display:** Always shown

**Requires if YES:** None (entries are optional)

**Vulnerability Trigger:** NO → Critical external assets not identified

**Additional Context:** Understanding upstream IT infrastructure (data centers, hosting facilities, managed service provider facilities) helps identify shared points of failure. This is optional; zero entries is acceptable if you answer YES but lack details.

---

### IT-3

**Prompt:** Do critical operations rely on a single external IT provider/platform (single point of dependency)?

**Answer Type:** boolean

**Help Text:** Yes = single provider; No = multiple providers or alternate platforms exist.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** Yes or Unknown → Single external IT provider dependency (or unknown provider concentration).

**Additional Context:** Relying on a single external IT provider/platform creates single-point-of-failure risk. YES = single provider; NO = multiple providers or alternate platforms exist. UNKNOWN = provider concentration is unclear.

---

## SECTION 2: RESILIENCE STRUCTURE

### IT-5

**Prompt:** Can the alternate method (if used) support core operations at an acceptable level?

**Answer Type:** boolean

**Help Text:** This is about external IT service continuity (alternate provider/platform, degraded-mode operations, manual workaround).

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO or Unknown → Fallback capability may not support critical operations.

**Additional Context:** Evaluate whether your alternate method (alternate provider/platform, degraded-mode operations, manual workaround) can support core operations at an acceptable level. YES = alternate method is sufficient; NO = it is insufficient or untested.

---

### IT-8

**Prompt:** Does the facility have an alternate method to continue critical operations if primary external IT services are unavailable?

**Answer Type:** repeatable

**Help Text:** Examples: Alternate provider/platform, degraded-mode access, manual workaround, offline process. If YES, add capability details.

**Conditional Display:** Always shown

**Requires if YES:** ItBackupCapability entries (capability_type, scope)

**Vulnerability Trigger:** NO → No alternate method for primary external IT service disruption.

**Additional Context:** Document all alternate methods including alternate provider/platform, degraded-mode access, manual workarounds, or offline processes. For each, specify capability type and which operations it supports.

---

### IT-9

**Prompt:** If primary external IT services are unavailable during a widespread outage, would the alternate method likely remain available?

**Answer Type:** enum

**Help Text:** This checks whether fallback access depends on the same provider or supporting services.

**Conditional Display:** Only shown when IT-8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO / Unknown → Alternate may not remain available during widespread outages

**Additional Context:** Evaluate whether alternate method depends on the same provider or supporting services as the primary. If both rely on the same platform or infrastructure, a widespread outage may affect both simultaneously.

---

### IT-10

**Prompt:** Has the alternate method been tested or exercised (functional, procedural, or operational)?

**Answer Type:** boolean

**Help Text:** Only asked when alternate method is available (IT-8 Yes).

**Conditional Display:** Only shown when IT-8 = YES

**Requires if YES:** None

**Vulnerability Trigger:** No/Unknown/>12mo → knowledge gap or reliability concern

**Additional Context:** Alternate methods that are never tested may fail when needed. Confirm whether you routinely test or exercise alternate IT capabilities (functional, procedural, operational) to ensure reliability.

---

### IT-11

**Prompt:** Does the facility have established coordination with the external IT service provider for restoration during outages?

**Answer Type:** boolean

**Help Text:** If YES, coordination is documented and restoration priority is understood.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** NO → restoration realism gap

**Additional Context:** In widespread outages, provider restoration follows a prioritization sequence. Confirm whether your facility has documented coordination (SLA, mutual aid agreements, priority restoration status) with the external IT service provider.

---

### it_plan_exercised

**Prompt:** Has the IT continuity or recovery plan been exercised or tested?

**Answer Type:** enum

**Help Text:** Only asked when plan exists (it_continuity_plan_exists Yes). NO/Unknown → plan may not be effective if not exercised.

**Conditional Display:** Only shown when it_continuity_plan_exists = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO → Information technology recovery plans may not be effective if not exercised

**Additional Context:** IT continuity or recovery plans that are never exercised may fail when needed. Confirm whether you routinely test or exercise your IT recovery plan to validate procedures and identify gaps.

---

## SECTION 3: PHYSICAL EXPOSURE

### IT-7

**Prompt:** Where are critical IT infrastructure components installed relative to vehicle access?

**Answer Type:** enum

**Help Text:** Answer based on cabling, network termination cabinets, or other IT infrastructure components relied upon for this dependency. Interior or underground installations automatically set vehicle impact to N/A.

**Conditional Display:** Always shown

**Requires if YES:** None

**Vulnerability Trigger:** None (used to gate IT-7a)

**Additional Context:** Assess where critical IT infrastructure components (cabling, network termination cabinets, junction boxes) are installed relative to vehicle access. Interior or underground installations have no vehicle impact risk.

---

### IT-7a

**Prompt:** Are protective measures in place to reduce vehicle impact risk to IT infrastructure components?

**Answer Type:** boolean

**Help Text:** Only shown when IT-7 indicates components are exterior and exposed to vehicle paths.

**Conditional Display:** Only shown when IT-7 indicates exterior exposure (not interior_or_underground)

**Requires if YES:** None

**Vulnerability Trigger:** NO → Vehicle impact exposure without protection (condition code only)

**Additional Context:** If vehicle impact is a concern (IT-7 indicates exterior exposure), confirm whether protective barriers or standoff distance reduce the risk. Examples: bollards, ground-mounted enclosures, elevated or recessed installations.

---

### IT-4 (DEPRECATED)

**Prompt:** Are IT service connections provisioned through distinct network infrastructure or providers?

**Answer Type:** repeatable

**Help Text:** Only asked when multiple connections exist (IT-3 Yes). If only one, use N/A. If YES, add one entry per connection.

**Conditional Display:** Only shown when IT-3 = YES (but deprecated in UI)

**Requires if YES:** ItConnection entries (connection_label, facility_entry, shared_corridor_with_other_utilities)

**Vulnerability Trigger:** NO → Co-located entry points; shared_corridor YES → Collocated with other utilities

**Additional Context:** Geographic separation of IT connections reduces risk from localized events (fiber cuts, construction damage, carrier outages). For each connection, provide entry location and note if it shares a utility corridor with other systems.

**Note:** This question is soft-deprecated. Hidden in UI; schema retained for backward compatibility.

---

### IT-6 (DEPRECATED)

**Prompt:** Are IT infrastructure components protected from accidental/intentional physical damage?

**Answer Type:** repeatable

**Help Text:** If YES, add one entry per component type with location and protection type.

**Conditional Display:** Always shown (but deprecated in UI)

**Requires if YES:** ItComponentProtection entries (component_type, location, protection_type)

**Vulnerability Trigger:** NO → Unprotected exterior components

**Additional Context:** Exterior IT components (network cabinets, fiber termination points, antenna installations) exposed to the public are vulnerable to accidental or intentional damage. List all exposed components and describe protection type.

**Note:** This question is soft-deprecated. Hidden in UI; schema retained for backward compatibility.

---

## SECTION 4: OPERATIONAL IMPACT PROFILE (Curve Questions)

### curve_requires_service

**Prompt:** Does the facility rely on externally hosted or managed digital services (e.g., SaaS platforms, cloud applications, hosted identity services) for core operations?

**Answer Type:** boolean

**Help Text:** Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.

**Conditional Display:** Always shown first

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Select YES if normal facility operations depend on externally hosted or managed digital services. This initiates the impact assessment; if NO, no operational loss is assumed.

---

### curve_time_to_impact

**Prompt:** If IT service is lost (without backup), how soon would the facility be severely impacted? (hours)

**Answer Type:** number

**Help Text:** Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate in hours how quickly critical IT-dependent operations degrade if service is lost with no backup available. Use realistic estimates based on alternate cloud providers, manual processes, or offline capabilities.

---

### curve_loss_no_backup

**Prompt:** Once IT service is lost (without backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would be offline if IT service is lost without any backup. 100% means complete shutdown; 0% means no loss.

---

### curve_backup_available

**Prompt:** Is any backup or alternate IT capability available for this infrastructure?

**Answer Type:** boolean

**Help Text:** Select YES if there is any alternate method (different provider, degraded-mode access, manual workaround) that could sustain operations. This gates the backup-specific curve questions.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** NO or UNKNOWN → No backup IT capability

**Additional Context:** Select YES if backup or alternate IT capability exists (different cloud provider, on-premises alternatives, manual workarounds, or degraded-mode access). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.

---

### curve_backup_duration

**Prompt:** If primary external IT services are unavailable, how many hours can operations continue using alternate methods or manual workarounds?

**Answer Type:** number

**Help Text:** Estimate how long mitigation can sustain operations before impacts increase (hours).

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate the duration (in hours, 0–96) that alternate IT methods can sustain critical operations. This includes manual process duration or offline system runtime.

---

### curve_loss_with_backup

**Prompt:** Once IT service is lost (considering backup), what percentage of normal business functions are lost or degraded?

**Answer Type:** percent

**Help Text:** With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.

**Conditional Display:** Only shown if curve_backup_available = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup IT capability active. This captures functions requiring the primary service explicitly.

---

### curve_recovery_time

**Prompt:** Once external IT service is restored, how long until full resumption of operations? (hours)

**Answer Type:** number

**Help Text:** After service is restored, estimate how long it takes to return to normal operations.

**Conditional Display:** Only shown if curve_requires_service = YES

**Requires if YES:** None

**Vulnerability Trigger:** None

**Additional Context:** Estimate time (in hours, 0–168) to restore normal facility IT operations after the outage resolves.

```
