# Assessment Acronym Help

This guide explains acronyms used in the ADA assessment and why each one matters for dependency and resilience scoring.

## Program and Report Terms

| Acronym | What it is | Why it is important |
|---|---|---|
| ADA | Asset Dependency Assessment | The core assessment process and data model used to evaluate infrastructure dependency risk. |
| OFC | Option for Consideration | Actionable recommendations generated from identified vulnerabilities. |
| PRA | Priority Restoration Agreement | Indicates whether the facility has documented restoration priority with a provider during major outages. |
| SLA | Service Level Agreement | Defines provider commitments (e.g., restoration timelines), which affects expected downtime and risk posture. |
| SLTT | State, Local, Tribal, and Territorial | Distinguishes public-sector coordination contexts used in restoration and planning narratives. |
| PSA | Protective Security Advisor | Required contact metadata used for report governance and export completeness. |

## Communications and IT Terms

| Acronym | What it is | Why it is important |
|---|---|---|
| IT | Information Technology | Assessment domain covering external data/internet transport dependency. |
| ISP | Internet Service Provider | Primary/secondary connectivity provider used in Internet Transport resilience analysis. |
| WAN | Wide Area Network | External network transport context that influences service dependency concentration. |
| VPN | Virtual Private Network | Common connectivity dependency that can become a single path or failover constraint. |
| MSP | Managed Service Provider | Third-party IT operator; dependency concentration here can increase operational exposure. |
| MSSP | Managed Security Service Provider | Third-party security operator; dependency affects continuity and incident response capability. |
| SaaS | Software as a Service | Externally hosted services that can create operational dependency and outage exposure. |
| OT | Operational Technology | Operational control systems context used in resilience module boundaries and cross-dependency discussion. |
| ICS | Industrial Control Systems | Control systems that may depend on IT/communications availability and affect consequence severity. |
| SCADA | Supervisory Control and Data Acquisition | Operational control architecture frequently tied to communications and power continuity. |
| CCTV | Closed-Circuit Television | Often appears in scope boundaries to clarify what is and is not included in a dependency domain. |

## Communications-Specific Terms

| Acronym | What it is | Why it is important |
|---|---|---|
| PACE | Primary, Alternate, Contingency, Emergency | Framework for layered communications resilience; directly supports single-point-of-failure evaluation. |
| VoIP | Voice over Internet Protocol | Voice transport type whose survivability depends on underlying network and power conditions. |
| PTT | Push-to-Talk | Voice communications mode often used as alternate/emergency capability in outage scenarios. |
| PA | Public Address | Facility-wide voice notification method used in internal emergency coordination. |
| DAS | Distributed Antenna System | Indoor cellular coverage support; affects communications continuity inside facilities. |
| WPS | Wireless Priority Service | Priority calling service that can improve call completion during network congestion. |
| GETS | Government Emergency Telecommunications Service | Priority calling capability for congested/public-switched networks during emergencies. |

## Power and Utility Terms

| Acronym | What it is | Why it is important |
|---|---|---|
| UPS | Uninterruptible Power Supply | Short-duration backup that influences immediate loss-of-service behavior and transition continuity. |
| ATS | Automatic Transfer Switch | Equipment that transfers loads to backup power; affects recovery timing and automation confidence. |
| WASD | Miami-Dade Water and Sewer Department | Example utility acronym already expanded in report output; prevents ambiguity in provider references. |

## Assessment Question ID Prefixes

| Prefix | Meaning | Why it is important |
|---|---|---|
| E- | Electric Power question identifier | Used for traceability between UI prompts, stored answers, and report logic. |
| CO- | Communications question identifier | Preserves mapping between comms prompts and downstream condition evaluation. |
| IT- | Information Technology question identifier | Supports deterministic mapping of IT responses into export/report payloads. |
| W_Q | Water question identifier | Identifies water-domain prompts in schema and report normalization paths. |
| WW_Q | Wastewater question identifier | Identifies wastewater-domain prompts in schema and report normalization paths. |

