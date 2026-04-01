/**
 * Analytical Considerations - Communications
 * 
 * Citation-backed, non-prescriptive narrative analysis for communications vulnerabilities.
 * Max 4 considerations per vulnerability (enforced by verifier).
 */

import type { AnalyticalConsideration } from "./consideration_types";

export const COMMUNICATIONS_CONSIDERATIONS: AnalyticalConsideration[] = [
  {
    id: "AC_CO_001",
    heading: "Backup Communications Capability",
    paragraphs: [
      {
        text: "Facilities without backup communications capability may experience immediate coordination and operational disruption during primary service outages. Communications dependence varies based on operational model, remote workforce presence, and digital service integration.",
        citations: ["NFPA_1221", "FEMA_CGC"],
      },
      {
        text: "Backup communications can include alternate providers, mobile backup systems, satellite communications, or radio networks. Organizations may assess whether communications backup arrangements align with operational coordination requirements during service disruption.",
        citations: ["FCC_CSRIC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_CO_002",
    heading: "Alternate Communications Options",
    paragraphs: [
      {
        text: "Alternate communications options include secondary wireline providers, mobile/cellular service, satellite systems, two-way radio networks, and emergency notification systems. Each approach has different coverage, capacity, and operational characteristics.",
        citations: ["NFPA_1221", "FCC_CSRIC"],
      },
      {
        text: "Selection of alternate communications depends on bandwidth requirements, geographic coverage needs, and acceptable latency. Facilities in areas with limited provider diversity may benefit from evaluating non-wireline communication options for backup capability.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_CO_003",
    heading: "Time-Critical Communications",
    paragraphs: [
      {
        text: "Facilities with time-critical communications face immediate impact when service is lost. Essential functions such as emergency coordination, process monitoring, customer service, and digital transactions can degrade within minutes without communications capability.",
        citations: ["NFPA_1221", "FCC_CSRIC"],
      },
      {
        text: "Understanding time-to-impact for critical communications can inform decisions about backup scope and diversification. Organizations may evaluate whether essential communications pathways have adequate protection matching operational tolerance for interruption.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_CO_004",
    heading: "Functional Loss Without Backup Communications",
    paragraphs: [
      {
        text: "Facilities experiencing high functional loss without backup communications face significant operational degradation during outages. The percentage of functions affected depends on the integration of communications into core operations and availability of alternative coordination methods.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "High functional loss can indicate concentrated risk in communications infrastructure. Organizations may assess whether communications dependencies create disproportionate vulnerability during service disruptions.",
        citations: ["NIST_CSF", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_CO_005",
    heading: "Communications Provider Identification",
    paragraphs: [
      {
        text: "Identifying communications providers and understanding service delivery infrastructure enables coordination during outages. Knowledge of routing, equipment locations, and service boundaries supports situational awareness and restoration communication.",
        citations: ["FEMA_CGC", "FCC_CSRIC"],
      },
      {
        text: "Facilities without documented provider information may experience delayed coordination during outages. Documenting provider contacts, understanding circuit identifiers, and clarifying service level agreements can facilitate outage reporting and restoration status updates.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_CO_006",
    heading: "Priority Restoration Agreements - Communications",
    requiresPRA: true,
    paragraphs: [
      {
        text: "Priority restoration agreements for communications services can reduce restoration time for facilities supporting critical community functions. Telecommunications Service Priority (TSP) programs provide federal prioritization mechanisms for qualifying facilities.",
        citations: ["FCC_CSRIC", "DHS_TSP"],
      },
      {
        text: "Facilities without priority restoration status may experience longer restoration times during regional communications outages. Organizations can evaluate whether operational criticality aligns with TSP program criteria and whether formal agreements would support resilience objectives.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_CO_007",
    heading: "Redundant Communications Pathways",
    paragraphs: [
      {
        text: "Redundant communications pathways provide alternate routes for data and voice traffic, reducing single point of failure risk. Redundancy can include multiple providers, diverse physical routing, or connections through different central offices.",
        citations: ["NFPA_1221", "FCC_CSRIC"],
      },
      {
        text: "Facilities with single communications pathways face concentrated risk from localized failures. Organizations may evaluate whether operational criticality justifies redundant service and whether provider infrastructure supports physically diverse routing options.",
        citations: ["FEMA_CGC", "NIST_SP_800_82"],
      },
    ],
  },
  {
    id: "AC_CO_008",
    heading: "Collocated Communications Infrastructure",
    paragraphs: [
      {
        text: "Communications pathways sharing collocated utility corridors or conduit face common-mode failure risk. Collocation can reduce infrastructure diversity benefits when multiple pathways are damaged simultaneously by a single incident.",
        citations: ["NIST_SP_800_82", "FEMA_CGC"],
      },
      {
        text: "Organizations with collocated communications infrastructure may assess whether physical separation or diverse routing is feasible. Verifying pathway independence with providers can clarify whether redundancy provides meaningful failure isolation.",
        citations: ["FCC_CSRIC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_CO_009",
    heading: "Physical Security - Communications Equipment",
    paragraphs: [
      {
        text: "Communications equipment exposed to physical risks includes exterior cable terminations, antennas, radio equipment, and fiber demarcation points. Vehicular impact, vandalism, or weather exposure can cause immediate service disruption.",
        citations: ["NIST_SP_800_82", "FEMA_CGC"],
      },
      {
        text: "Protective measures such as secure enclosures, elevated mounting, or hardened cabinets can reduce physical exposure. Organizations may assess whether critical communications equipment is positioned in vulnerable locations where protective measures could reduce rapid outage risk.",
        citations: ["FCC_CSRIC", "NFPA_1221"],
      },
    ],
  },
];
