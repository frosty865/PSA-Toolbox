# Information Technology (Data / Internet Transport)

**Purpose:** Evaluates dependency on external data/internet transport that supports digital operations and access to external services. Measures the operational impact of losing external connectivity and upstream digital services.

**Includes:**
- ISP circuits and external data transport (fiber, MPLS, SD-WAN where applicable)
- Cloud reachability and external service access that depends on data transport
- Operational impact of loss (timing, functional loss, recovery)
- Upstream provider identification and reliability context

**Excludes:**
- Voice/radio command communications (addressed under Communications)
- Internal server redundancy and internal IT architecture (handled only if implemented as a separate resilience module)

**Curve driver:** Loss of external data connectivity

---

## Curve (impact) questions

1. **curve_requires_service** — Does the facility rely on externally hosted or managed digital services (e.g., SaaS platforms, cloud applications, hosted identity services) for core operations?

2. **curve_time_to_impact_hours** — If IT service is lost (without backup), how soon would the facility be severely impacted? (hours)

3. **curve_loss_fraction_no_backup** — Once IT service is lost (without backup), what percentage of normal business functions are lost or degraded?

4. **curve_backup_available** — Is any backup or alternate IT capability available for this infrastructure?

5. **curve_backup_duration_hours** — If primary external IT services are unavailable, how many hours can operations continue using alternate methods or manual workarounds?

6. **curve_loss_fraction_with_backup** — Once IT service is lost (considering backup), what percentage of normal business functions are lost or degraded?

7. **curve_recovery_time_hours** — Once external IT service is restored, how long until full resumption of operations? (hours)

---

## Main dependency questions (IT-1 through IT-11)

8. **IT-1 (Providers)** — Providers  
   *If YES, add one entry per provider with designation (primary/secondary).*

9. **IT-2** — Can the facility identify the critical externally hosted or managed digital services relied upon for core operations?  
   *Examples: SaaS platforms, cloud-hosted applications, hosted identity services, managed IT provider platforms. If YES, list what is known.*

10. **IT-3** — Do critical operations rely on a single external IT provider/platform (single point of dependency)?  
    *Yes = single provider; No = multiple providers or alternate platforms exist.*

11. **IT-4** — Are IT service connections provisioned through distinct network infrastructure or providers?  
    *Only when multiple connections exist. If YES, add one entry per connection (connection_label, facility_entry, shared_corridor_with_other_utilities).*  
    *(Deprecated in UI.)*

12. **IT-5** — Can the alternate method (if used) support core operations at an acceptable level?  
    *External IT service continuity: alternate provider/platform, degraded-mode operations, manual workaround.*

13. **IT-6** — Are IT infrastructure components protected from accidental/intentional physical damage?  
    *If YES, add one entry per component type with location and protection type.*  
    *(Deprecated in UI.)*

14. **IT-7** — Where are critical IT infrastructure components installed relative to vehicle access?  
    *Based on cabling, network termination cabinets, or other IT infrastructure. Interior or underground → vehicle impact N/A.*

15. **IT-7a** — Are protective measures in place to reduce vehicle impact risk to IT infrastructure components?  
    *Only when IT-7 indicates components are exterior and exposed to vehicle paths.*

16. **IT-8** — Does the facility have an alternate method to continue critical operations if primary external IT services are unavailable?  
    *Examples: Alternate provider/platform, degraded-mode access, manual workaround, offline process. If YES, add capability details.*

17. **IT-9** — If primary external IT services are unavailable during a widespread outage, would the alternate method likely remain available?  
    *Checks whether fallback depends on the same provider or supporting services.*

18. **IT-10** — Has the alternate method been tested or exercised (functional, procedural, or operational)?  
    *Only when alternate method is available (IT-8 Yes).*

19. **IT-11** — Does the facility have established coordination with the external IT service provider for restoration during outages?  
    *If YES, coordination is documented and restoration priority is understood.*

---

## Cyber / Continuity / Recovery (inline block)

20. **it_continuity_plan_exists** — Does the facility maintain an information technology continuity or recovery plan addressing prolonged service disruption or cyber incidents?  
    *Options: Yes, No, Unknown*

21. **it_plan_exercised** — Has the information technology continuity or recovery plan been exercised or tested?  
    *Only when plan exists (it_continuity_plan_exists = Yes).*  
    *Options: Yes – within the last 12 months; Yes – more than 12 months ago; No; Unknown*

22. **it_exercise_scope** — What was the scope of the most recent exercise or test?  
    *Only when it_plan_exercised starts with "yes".*  
    *Options: Tabletop discussion; Functional / technical test; Full operational exercise; Unknown*
