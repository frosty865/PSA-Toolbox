# Curated Vulnerabilities and OFCs (Project-Wide)

This catalog includes both runtime top-level vulnerabilities and full question-mapped vulnerability coverage.
All source references resolve to real documents in `citations_registry.ts`.

## Runtime Top-Level Vulnerabilities (VOFC Output)

These are the enforced top-level runtime vulnerabilities used by `build_vofc_collection.ts`.
Each runtime vulnerability has 2-3 curated OFCs.

## COMMUNICATIONS

### Alternate communications capability may be insufficient or unverified
- Vulnerability ID: `COMMS_ALTERNATE_CAPABILITY`
- Curated OFCs:
  1. Define alternate communications methods for core operations and emergency coordination, including activation conditions and operational limits.
   Source: Public Safety Communications Resiliency (Keys to Public Safety Network Resiliency) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/sites/default/files/publications/07202017_10_Keys_to_Public_Safety_Network_Resiliency_010418_FINAL508C.pdf
  2. Exercise fallback communications procedures under degraded-service scenarios to confirm operator readiness and continuity effectiveness.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Carrier diversity may be limited
- Vulnerability ID: `COMMS_DIVERSITY`
- Curated OFCs:
  1. Document communications service providers, transport paths, and entry points to identify concentration risk and cross-impact from shared routes.
   Source: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  2. Evaluate diversified communications architecture using distinct carriers or transport paths where feasible for critical communications functions.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Restoration coordination may be unclear
- Vulnerability ID: `COMMS_RESTORATION_REALISM`
- Curated OFCs:
  1. Document provider escalation paths and restoration expectations for high-impact outages affecting critical communications dependencies.
   Source: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority
  2. Evaluate eligibility and use of formal priority restoration mechanisms for qualifying critical communications services.
   Source: Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp

## ELECTRIC_POWER

### Backup power capability may be absent or insufficient
- Vulnerability ID: `ENERGY_BACKUP_ABSENT`
- Curated OFCs:
  1. Define emergency and standby power coverage for life safety and mission-critical loads, including minimum runtime objectives and transfer expectations.
   Source: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110
  2. Document backup-power operating procedures, restoration priorities, and outage decision points so operators can sustain critical functions during extended grid loss.
   Source: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf

### Backup power sustainment or testing may be uncertain
- Vulnerability ID: `ENERGY_BACKUP_SUSTAIN_TEST`
- Curated OFCs:
  1. Establish a recurring load-test schedule with acceptance criteria, and record test outcomes for transfer reliability, runtime, and load support.
   Source: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110
  2. Formalize fuel sustainment and resupply coordination for multi-day outages, including vendor contacts, delivery assumptions, and trigger thresholds.
   Source: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf

### Electric service feed diversity may be limited
- Vulnerability ID: `ENERGY_FEED_DIVERSITY`
- Curated OFCs:
  1. Map each incoming electric feed, substation dependency, and facility entry point, then validate single-feed exposure through an annual utility coordination review.
   Source: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  2. Evaluate feasibility of a physically separated secondary service path or feeder arrangement for critical loads, including switching and isolation procedures.
   Source: NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600

## INFORMATION_TECHNOLOGY

### Continuity readiness may not be demonstrated
- Vulnerability ID: `IT_CONTINUITY_NOT_DEMONSTRATED`
- Curated OFCs:
  1. Schedule recurring IT continuity exercises and post-exercise corrective actions to verify readiness for prolonged external-service disruption.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Integrate continuity test outcomes into incident response and recovery governance to reduce uncertainty during real events.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### IT_CONTINUITY_PLAN_NOT_EXERCISED
- Vulnerability ID: `IT_CONTINUITY_PLAN_NOT_EXERCISED`
- Curated OFCs:
  1. Schedule recurring continuity exercises for critical IT services and capture corrective actions from each exercise cycle.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Align IT recovery playbooks and governance checkpoints to outcomes from recent continuity exercises.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### IT_FALLBACK_CAPABILITY_INSUFFICIENT
- Vulnerability ID: `IT_FALLBACK_CAPABILITY_INSUFFICIENT`
- Curated OFCs:
  1. Assess fallback operating levels against minimum continuity requirements for core services during external-service disruption.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Run fallback exercises and update incident procedures based on observed recovery constraints.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### IT_HOSTED_SERVICES_NOT_IDENTIFIED
- Vulnerability ID: `IT_HOSTED_SERVICES_NOT_IDENTIFIED`
- Curated OFCs:
  1. Document externally hosted services that support core operations, including ownership, dependency criticality, and outage impact assumptions.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Maintain a service inventory review cycle so continuity procedures reflect current hosted-service dependencies.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Hosted service continuity not evaluated
- Vulnerability ID: `IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN`
- Curated OFCs:
  1. Establish and maintain a continuity assessment for each hosted service dependency, including impact tolerance and recovery expectations.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Collect provider and internal evidence for continuity controls and validate that assumptions are reflected in incident response procedures.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Hosted service has no continuity when internet is lost
- Vulnerability ID: `IT_HOSTED_VENDOR_NO_CONTINUITY`
- Curated OFCs:
  1. For each critical hosted service, define continuity mode during internet loss (local fallback, alternate platform, or validated manual procedure).
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Test hosted-service continuity assumptions through scenario exercises that include internet unavailability and provider-side outage conditions.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Multiple IT connections; independence not documented
- Vulnerability ID: `IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN`
- Curated OFCs:
  1. Verify whether multiple documented IT connections share conduit, entry, or upstream dependencies before treating them as independent resilience layers.
   Source: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  2. Update continuity assumptions and failure-scenario planning to reflect validated transport independence characteristics.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### External IT provider dependency may be concentrated
- Vulnerability ID: `IT_PROVIDER_CONCENTRATION`
- Curated OFCs:
  1. Inventory externally hosted and managed IT dependencies by critical business function to identify single-provider concentration and outage impact scope.
   Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  2. Evaluate provider diversification strategy for the highest-impact services, including migration constraints and recovery tradeoffs.
   Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html

### Transport diversity recorded; path diversity unknown
- Vulnerability ID: `IT_TRANSPORT_DIVERSITY_RECORDED`
- Curated OFCs:
  1. Validate whether recorded carrier diversity is supported by independent building entry and upstream route diversity for critical services.
   Source: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  2. Maintain transport diversity documentation and review after provider/network changes to preserve continuity assumptions.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Transport independence attributes not fully documented
- Vulnerability ID: `IT_TRANSPORT_INDEPENDENCE_UNKNOWN`
- Curated OFCs:
  1. Document internet transport entry points, physical path attributes, and route-independence assumptions for each critical service dependency.
   Source: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  2. Coordinate with service providers to validate transport-path independence and update continuity plans with verified constraints.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Internet transport has single path or limited diversity
- Vulnerability ID: `IT_TRANSPORT_SINGLE_PATH`
- Curated OFCs:
  1. Prioritize independent internet transport options for critical externally hosted services where single-path loss creates immediate mission impact.
   Source: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  2. Define outage playbooks for transport-path failure, including service triage, provider escalation, and manual continuity steps.
   Source: Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

## WASTEWATER

### No priority restoration plan
- Vulnerability ID: `WW_NO_PRIORITY_RESTORATION`
- Curated OFCs:
  1. Document wastewater-service restoration dependencies and provider coordination expectations for high-impact outage scenarios.
   Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Integrate wastewater dependency constraints into continuity planning for prolonged utility disruption conditions.
   Source: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

## WATER

### Alternate water insufficient for core operations
- Vulnerability ID: `W_ALTERNATE_INSUFFICIENT`
- Curated OFCs:
  1. Assess alternate water source capacity against core operational demand to determine duration and service-level gaps during disruption.
   Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Develop compensating continuity actions where alternate supply cannot sustain required operational levels.
   Source: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

### No alternate water source
- Vulnerability ID: `W_NO_ALTERNATE_SOURCE`
- Curated OFCs:
  1. Define minimum water-service requirements for core operations and evaluate alternate source options for sustained disruption scenarios.
   Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Plan operational continuity actions for water-supply loss, including duration assumptions, rationing priorities, and recovery sequencing.
   Source: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

### No priority restoration plan
- Vulnerability ID: `W_NO_PRIORITY_RESTORATION`
- Curated OFCs:
  1. Document water-provider restoration coordination expectations for essential operations, including contacts and escalation triggers.
   Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Incorporate restoration-priority assumptions into facility continuity planning and exercise outage coordination workflows.
   Source: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf

## Full Assessment Question Coverage

This section lists all vulnerability templates mapped to assessment questions in `question_vuln_map.ts`.

### Question comm_restoration_coordination

- Vulnerability: No Priority Restoration Agreement
- Vulnerability ID: `COMM_NO_PRIORITY_RESTORATION`
- Domain: COMMUNICATIONS
- PRA/SLA required: Yes
- Context: Facility does not participate in priority restoration or coordinated restoration plan with communications provider.
- Trigger logic: comm_restoration_coordination == NO OR comm_restoration_coordination == UNKNOWN
- Source references:
  - Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority
  - Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp
- OFCs:
  1. Telecommunications Service Priority (TSP) programs provide federal prioritization mechanisms for qualifying facilities.
     Sources: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority | Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp

### Question comm_single_point_voice_failure

- Vulnerability: Single point of failure in voice coordination
- Vulnerability ID: `COMMS_SPOF_VOICE`
- Domain: COMMUNICATIONS
- PRA/SLA required: No
- Context: Voice coordination depends on a single method or pathway; loss or degradation can disrupt command, dispatch, and operational coordination.
- Trigger logic: comm_single_point_voice_failure == YES
- Source references:
  - Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  - Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
- OFCs:
  1. Document voice coordination methods, carrier contacts, and escalation procedures. Validate that records align with current service configuration.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  2. Consider options for an alternate voice coordination method that can operate independently of the primary pathway during disruptions.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  3. Maintain current carrier/provider contacts and escalation procedures for outage reporting and restoration coordination.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  4. Conduct periodic exercises that require switching from primary to alternate methods under time pressure. Validate alternate path availability.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Question COMM-PRA_priority_restoration

- Vulnerability: No priority restoration mechanism for critical communications circuits
- Vulnerability ID: `COMMS_NO_TSP_PRIORITY_RESTORATION`
- Domain: COMMUNICATIONS
- PRA/SLA required: Yes
- Context: Without a priority restoration mechanism, critical communications services may face longer restoration times during major outages affecting multiple customers.
- Trigger logic: COMM-PRA_priority_restoration == NO OR COMM-PRA_priority_restoration == UNKNOWN
- Source references:
  - Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority
  - Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp
- OFCs:
  1. Identify and document which voice/data services directly support essential functions. Assess whether organizational criticality aligns with TSP eligibility criteria.
     Sources: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority | Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp
  2. Evaluate Telecommunications Service Priority eligibility and, where criteria are met, pursue enrollment for qualifying services.
     Sources: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority | Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp
  3. Coordinate with the provider to document restoration assumptions and escalation procedures for critical services.
     Sources: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority | Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp
  4. Exercise outage reporting and TSP restoration coordination procedures. Validate contact information and escalation paths.
     Sources: Telecommunications Service Priority (TSP) (Federal Communications Commission (FCC)) — https://www.fcc.gov/telecommunications-service-priority | Telecommunications Service Priority (TSP) (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp

### Question COMM-SP3_provider_coordination

- Vulnerability: No documented restoration coordination for communications services
- Vulnerability ID: `COMMS_NO_PROVIDER_RESTORATION_COORD`
- Domain: COMMUNICATIONS
- PRA/SLA required: No
- Context: Without documented provider coordination and restoration procedures, the facility may experience longer restoration timelines during regional disruptions.
- Trigger logic: COMM-SP3_provider_coordination == NO OR COMM-SP3_provider_coordination == UNKNOWN
- Source references:
  - Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies
  - Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
- OFCs:
  1. Document provider contacts, ticketing/escalation paths, and after-hours restoration coordination procedures.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  2. Ask the provider to confirm whether service paths are physically diverse (separate routes/entries) where feasible.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  3. Clarify restoration prioritization and escalation procedures with the carrier. Document expected restoration sequencing for critical circuits.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council
  4. Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.
     Sources: Improving Emergency Communications Resiliency through Redundancies (Cybersecurity and Infrastructure Security Agency (CISA)) — https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies | Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations (Federal Communications Commission (FCC)) — https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council

### Question E-11

- Vulnerability: No Priority Restoration Agreement
- Vulnerability ID: `EP_NO_PRIORITY_RESTORATION`
- Domain: ELECTRIC_POWER
- PRA/SLA required: Yes
- Context: Facility does not participate in priority restoration or coordinated restoration plan with utility.
- Trigger logic: E-11 == NO OR E-11 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
- OFCs:
  1. Document facility criticality, essential circuits, and restoration expectations. Validate alignment with utility priority service criteria.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  2. Evaluate whether operational criticality aligns with utility priority service programs. Consider formal agreements where eligibility criteria are met.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  3. Clarify escalation paths, outage reporting, and restoration status updates with the utility. Document expected sequencing for critical circuits.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  4. Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600

### Question E-2

- Vulnerability: Upstream Substation Unknown
- Vulnerability ID: `EP_UPSTREAM_SUBSTATION_UNKNOWN`
- Domain: ELECTRIC_POWER
- PRA/SLA required: No
- Context: Key upstream substations influencing service delivery are not identified, reducing awareness of shared upstream risks.
- Trigger logic: E-2 == NO OR E-2 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - Energy Resiliency Assessment Framework (U.S. Department of Energy (DOE)) — https://www.energy.gov/ceser/energy-resiliency
- OFCs:
  1. Document upstream utilities, substations, and service paths. Validate that records align with physical configuration and utility-provided information.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | Energy Resiliency Assessment Framework (U.S. Department of Energy (DOE)) — https://www.energy.gov/ceser/energy-resiliency
  2. Evaluate options for alternate service paths or feeder diversity where utility infrastructure supports it. Consider IEEE reliability practices for distribution design.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | Energy Resiliency Assessment Framework (U.S. Department of Energy (DOE)) — https://www.energy.gov/ceser/energy-resiliency
  3. Clarify restoration sequencing and escalation procedures with the electric utility. Document expected restoration timelines for critical circuits.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | Energy Resiliency Assessment Framework (U.S. Department of Energy (DOE)) — https://www.energy.gov/ceser/energy-resiliency
  4. Exercise continuity procedures that assume loss of primary service. Validate situational awareness and communication paths during simulated outages.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | Energy Resiliency Assessment Framework (U.S. Department of Energy (DOE)) — https://www.energy.gov/ceser/energy-resiliency

### Question E-3

- Vulnerability: Single Service Connection
- Vulnerability ID: `EP_SINGLE_SERVICE_CONNECTION`
- Domain: ELECTRIC_POWER
- PRA/SLA required: No
- Context: The facility relies on a single electric service connection, creating a single point of failure for power supply.
- Trigger logic: E-3 == NO OR E-3 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
- OFCs:
  1. Document essential loads, load-shed priorities, and operational workarounds for sustained electrical disruption. Validate alignment with utility restoration sequencing.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  2. Coordinate with the electric utility to evaluate a second service connection or alternate feeder path where feasible. Consider physically separated routing per NFPA 70.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  3. Clarify and, where feasible, strengthen restoration prioritization with the utility. Document escalation paths for critical circuits.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600
  4. Exercise continuity procedures that assume loss of the sole electrical service connection. Validate backup power coverage and manual workarounds.
     Sources: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf | NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-1600

### Question E-3_more_than_one_connection

- Vulnerability: Single electrical service connection concentrates outage risk
- Vulnerability ID: `EP_SINGLE_CONNECTION_SPOF`
- Domain: ELECTRIC_POWER
- PRA/SLA required: No
- Context: A single utility service connection creates a single point of failure; a localized fault or upstream outage can rapidly degrade essential operations.
- Trigger logic: E-3_more_than_one_connection == NO OR E-3_more_than_one_connection == UNKNOWN
- Source references:
  - Federal Continuity Directive: Planning Framework (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf
  - Good Practices in Resilience-Based Architectural Designs (Whole Building Design Guide (WBDG)) — https://www.wbdg.org/resources/good-practices-resilience-based-arch-design
- OFCs:
  1. Define essential loads, load-shed priorities, and operational workarounds for sustained electrical disruption. Validate alignment with facility recovery objectives.
     Sources: Federal Continuity Directive: Planning Framework (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf | Good Practices in Resilience-Based Architectural Designs (Whole Building Design Guide (WBDG)) — https://www.wbdg.org/resources/good-practices-resilience-based-arch-design
  2. Coordinate with the electric utility to evaluate a second service connection or alternate feeder path where feasible. Consider physically separated routing.
     Sources: Federal Continuity Directive: Planning Framework (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf | Good Practices in Resilience-Based Architectural Designs (Whole Building Design Guide (WBDG)) — https://www.wbdg.org/resources/good-practices-resilience-based-arch-design
  3. Clarify restoration prioritization and escalation procedures with the utility. Document expected restoration sequencing for critical circuits.
     Sources: Federal Continuity Directive: Planning Framework (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf | Good Practices in Resilience-Based Architectural Designs (Whole Building Design Guide (WBDG)) — https://www.wbdg.org/resources/good-practices-resilience-based-arch-design
  4. Exercise continuity procedures that assume loss of the sole electrical service connection. Validate backup power coverage and manual workarounds.
     Sources: Federal Continuity Directive: Planning Framework (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf | Good Practices in Resilience-Based Architectural Designs (Whole Building Design Guide (WBDG)) — https://www.wbdg.org/resources/good-practices-resilience-based-arch-design

### Question E-8

- Vulnerability: No Backup Power
- Vulnerability ID: `EP_NO_BACKUP_POWER`
- Domain: ELECTRIC_POWER
- PRA/SLA required: No
- Context: Backup power capability is not present or not documented, limiting the facility response window during grid loss.
- Trigger logic: E-8 == NO OR E-8 == UNKNOWN
- Source references:
  - NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
- OFCs:
  1. Document essential loads, runtime requirements, and fuel dependencies. Validate that records align with physical systems per NFPA 110.
     Sources: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110 | FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  2. Evaluate options for on-site generation, UPS, or alternate power sources that can support critical loads during grid loss. Consider NFPA 110 and IEEE 1100.
     Sources: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110 | FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  3. Clarify refuel logistics, supplier arrangements, and restoration coordination for extended outages. Document runtime limits and operational priorities.
     Sources: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110 | FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  4. Exercise backup power activation and load transfer under simulated outage conditions. Validate runtime and fuel consumption assumptions.
     Sources: NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition (National Fire Protection Association (NFPA)) — https://www.nfpa.org/codes-and-standards/nfpa-110 | FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf

### Question it_plan_exercised

- Vulnerability: IT continuity plan is not demonstrated through exercises
- Vulnerability ID: `IT_CONTINUITY_PLAN_NOT_EXERCISED`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: No
- Context: IT continuity and recovery procedures are not exercised regularly, leaving execution quality and recovery assumptions uncertain.
- Trigger logic: it_plan_exercised == NO OR it_plan_exercised == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Schedule recurring continuity exercises for critical IT services and capture corrective actions from each exercise cycle.
     Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Align IT recovery playbooks and governance checkpoints to outcomes from recent continuity exercises.
     Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question IT-1

- Vulnerability: IT service provider visibility gap
- Vulnerability ID: `IT_PROVIDER_VISIBILITY_GAP`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: No
- Context: External IT service providers are not clearly identified, limiting visibility into service dependencies and restoration expectations.
- Trigger logic: IT-1_can_identify_providers == NO OR IT-1_can_identify_providers == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Document external IT providers, cloud platforms, and support escalation paths. Validate that records align with current service configuration.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  2. Evaluate options to improve visibility into upstream dependencies, shared risk exposure, and outage impact forecasting.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  3. Clarify provider contacts, ticketing paths, and restoration coordination procedures for critical IT services.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  4. Exercise continuity procedures that assume loss of primary IT services. Validate alternate access and manual workarounds.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question IT-11

- Vulnerability: No IT Service Restoration Agreement
- Vulnerability ID: `IT_NO_RESTORATION_COORDINATION`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: Yes
- Context: Facility does not participate in priority restoration or coordinated restoration plan with IT service provider.
- Trigger logic: IT-11 == NO OR IT-11 == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Document facility criticality, essential IT services, and restoration expectations. Validate alignment with provider SLA terms.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  2. Evaluate options for defined restoration time objectives and escalation procedures in service level agreements.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  3. Clarify escalation paths, outage reporting, and restoration status updates with the IT provider. Document expected sequencing for critical services.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  4. Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question IT-2

- Vulnerability: Critical hosted services are not fully identified
- Vulnerability ID: `IT_HOSTED_SERVICES_NOT_IDENTIFIED`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: No
- Context: Critical externally hosted or managed services are not fully identified, reducing dependency visibility and continuity planning quality.
- Trigger logic: IT-2_can_identify_assets == NO OR IT-2_can_identify_assets == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Document externally hosted services that support core operations, including ownership, dependency criticality, and outage impact assumptions.
     Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Maintain a service inventory review cycle so continuity procedures reflect current hosted-service dependencies.
     Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question IT-3

- Vulnerability: Single IT provider dependency
- Vulnerability ID: `IT_SINGLE_PROVIDER_DEPENDENCY`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: No
- Context: Critical operations rely on a single external IT provider or platform, creating concentration risk.
- Trigger logic: IT-3_multiple_connections == NO OR IT-3_multiple_connections == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Document essential IT services, failover procedures, and operational workarounds for sustained service disruption.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  2. Evaluate options for alternate IT access methods or secondary providers that can operate independently during primary outages.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  3. Clarify restoration prioritization and escalation procedures with the IT provider. Document expected restoration sequencing.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
  4. Exercise continuity procedures that assume loss of the primary IT provider. Validate alternate path availability.
     Sources: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html | NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question IT-5

- Vulnerability: Fallback capability may be insufficient for core operations
- Vulnerability ID: `IT_FALLBACK_CAPABILITY_INSUFFICIENT`
- Domain: INFORMATION_TECHNOLOGY
- PRA/SLA required: No
- Context: Fallback methods may not support acceptable operational continuity during extended disruption of primary external IT services.
- Trigger logic: IT-5_survivability == NO OR IT-5_survivability == UNKNOWN
- Source references:
  - ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  - NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework
- OFCs:
  1. Assess fallback operating levels against minimum continuity requirements for core services during external-service disruption.
     Source: ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements (International Organization for Standardization (ISO)) — https://www.iso.org/standard/75106.html
  2. Run fallback exercises and update incident procedures based on observed recovery constraints.
     Source: NIST Cybersecurity Framework, Version 1.1 (National Institute of Standards and Technology (NIST)) — https://www.nist.gov/cyberframework

### Question W_Q15_backup_power_pumps

- Vulnerability: Water pumping/boosting lacks backup power support
- Vulnerability ID: `WATER_PUMPS_NO_BACKUP_POWER`
- Domain: WATER
- PRA/SLA required: No
- Context: If pumping/boosting depends on utility power without backup, water pressure and availability can degrade during electrical disruptions.
- Trigger logic: W_Q15_backup_power_pumps == NO OR W_Q15_backup_power_pumps == UNKNOWN
- Source references:
  - Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
- OFCs:
  1. Identify critical pumps/boosters and their power requirements to inform backup power planning.
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
  2. Document runtime limits, refuel logistics, and operational priorities for maintaining water pressure during prolonged outages.
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
  3. Coordinate with the provider on expected pressure impacts and operational workarounds during electrical disruptions.
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

### Question W_Q6

- Vulnerability: No Priority Restoration Agreement
- Vulnerability ID: `W_NO_PRIORITY_RESTORATION`
- Domain: WATER
- PRA/SLA required: Yes
- Context: Facility does not participate in priority restoration or coordinated restoration plan with water utility.
- Trigger logic: W_Q6 == NO OR W_Q6 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
- OFCs:
  1. Document water-provider restoration coordination expectations for essential operations, including contacts and escalation triggers.
     Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Incorporate restoration-priority assumptions into facility continuity planning and exercise outage coordination workflows.
     Source: FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf

### Question W_Q8

- Vulnerability: No Alternate Water Source
- Vulnerability ID: `W_NO_ALTERNATE_SOURCE`
- Domain: WATER
- PRA/SLA required: No
- Context: The facility has no backup or alternate water source documented to sustain operations during primary supply outages.
- Trigger logic: W_Q8 == NO OR W_Q8 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
- OFCs:
  1. Define minimum water-service requirements for core operations and evaluate alternate source options for sustained disruption scenarios.
     Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Plan operational continuity actions for water-supply loss, including duration assumptions, rationing priorities, and recovery sequencing.
     Source: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

### Question WW_Q6

- Vulnerability: No Priority Restoration Agreement
- Vulnerability ID: `WW_NO_PRIORITY_RESTORATION`
- Domain: WASTEWATER
- PRA/SLA required: Yes
- Context: Facility does not participate in priority restoration or coordinated restoration plan with wastewater utility.
- Trigger logic: WW_Q6 == NO OR WW_Q6 == UNKNOWN
- Source references:
  - FEMA P-2166, Community Continuity Guidance (CCG), 2022 (Federal Emergency Management Agency (FEMA)) — https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf
  - Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
- OFCs:
  1. Document wastewater-service restoration dependencies and provider coordination expectations for high-impact outage scenarios.
     Source: Water Infrastructure and Security Guidance (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/waterresilience
  2. Integrate wastewater dependency constraints into continuity planning for prolonged utility disruption conditions.
     Source: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

### Question WW_Q9_backup_power_pumps

- Vulnerability: Wastewater pumping lacks backup power support
- Vulnerability ID: `WW_PUMPS_NO_BACKUP_POWER`
- Domain: WASTEWATER
- PRA/SLA required: No
- Context: If wastewater pumping depends on utility power without backup, loss of pumping can increase overflow risk and disrupt operations during outages.
- Trigger logic: WW_Q9_backup_power_pumps == NO OR WW_Q9_backup_power_pumps == UNKNOWN
- Source references:
  - Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
- OFCs:
  1. Identify critical lift stations/pumps and control dependencies that are expected to remain functional during outages.
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
  2. Document procedures to reduce overflow risk during sustained pump outages (containment, monitoring, and escalation).
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf
  3. Exercise wastewater outage response procedures, including communications, monitoring, and dispatch for pump failure events.
     Sources: Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update) (U.S. Environmental Protection Agency (EPA)) — https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf

