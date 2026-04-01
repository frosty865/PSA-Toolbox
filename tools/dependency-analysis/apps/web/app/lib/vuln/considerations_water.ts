/**
 * Analytical Considerations - Water
 * 
 * Citation-backed, non-prescriptive narrative analysis for water vulnerabilities.
 * Max 4 considerations per vulnerability (enforced by verifier).
 */

import type { AnalyticalConsideration } from "./consideration_types";

export const WATER_CONSIDERATIONS: AnalyticalConsideration[] = [
  {
    id: "AC_WA_001",
    heading: "Alternate Water Source",
    paragraphs: [
      {
        text: "Facilities without alternate water sources may experience immediate operational disruption during utility outages. Water dependence varies based on operational processes, sanitation requirements, and facility occupancy patterns.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Alternate water sources can include on-site storage, secondary utility connections, wells, or emergency supply arrangements. Organizations may assess whether water backup arrangements align with operational requirements during supply disruption.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_002",
    heading: "Water Storage and Supply Options",
    paragraphs: [
      {
        text: "Water storage options include elevated tanks, ground-level reservoirs, and emergency supply contracts. Storage capacity, water quality maintenance, and distribution systems affect usability during outages.",
        citations: ["EPA_WATER_SECURITY", "FEMA_CGC"],
      },
      {
        text: "Selection of water storage depends on facility size, occupancy, and critical water-dependent processes. Facilities in areas with frequent water service interruptions may benefit from evaluating storage capacity relative to expected outage duration.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_003",
    heading: "Time-Critical Water Dependencies",
    paragraphs: [
      {
        text: "Facilities with time-critical water dependencies face immediate impact when supply is lost. Essential functions such as cooling systems, sanitation, medical operations, and process water can degrade within hours without water service.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Understanding time-to-impact for critical water-dependent operations can inform decisions about storage capacity and alternate supply arrangements. Organizations may evaluate whether essential systems have adequate water protection matching operational tolerance.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_004",
    heading: "Functional Loss Without Alternate Water",
    paragraphs: [
      {
        text: "Facilities experiencing high functional loss without alternate water face significant operational degradation during outages. The percentage of functions affected depends on water integration into core operations and availability of manual alternatives.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "High functional loss can indicate concentrated risk in water infrastructure. Organizations may assess whether water dependencies create disproportionate vulnerability during utility disruptions.",
        citations: ["EPA_WATER_SECURITY", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_005",
    heading: "Water Utility Provider Identification",
    paragraphs: [
      {
        text: "Identifying water utility providers and understanding upstream infrastructure enables coordination during outages. Knowledge of treatment plants, pumping stations, and distribution networks supports situational awareness and restoration communication.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Facilities without documented utility provider information may experience delayed coordination during outages. Documenting utility contacts and documenting service area characteristics can facilitate outage reporting and restoration updates.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_006",
    heading: "Priority Restoration Agreements - Water",
    requiresPRA: true,
    paragraphs: [
      {
        text: "Priority restoration agreements for water service can reduce restoration time for facilities supporting critical community functions. Utility priority service programs may prioritize health care, emergency services, and essential facilities.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Facilities without priority restoration status may experience longer restoration times during regional water outages. Organizations can evaluate whether operational criticality aligns with utility priority criteria.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_007",
    heading: "Redundant Water Service Connections",
    paragraphs: [
      {
        text: "Redundant water service connections provide alternate pathways for water delivery, reducing single point of failure risk. Redundancy can include multiple utility feeds, diverse routing, or connections from different distribution mains.",
        citations: ["EPA_WATER_SECURITY", "FEMA_CGC"],
      },
      {
        text: "Facilities with single water connections face concentrated risk from localized failures. Organizations may evaluate whether operational criticality justifies redundant service and whether utility infrastructure supports diverse connection options.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_008",
    heading: "Collocated Water Infrastructure",
    paragraphs: [
      {
        text: "Water service connections sharing collocated utility corridors face common-mode failure risk. Collocation can reduce redundancy benefits when multiple connections are damaged simultaneously by a single incident.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Organizations with collocated water infrastructure may assess whether physical separation or diverse routing is feasible. Verifying connection independence with utilities can clarify whether redundancy provides meaningful failure isolation.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WA_009",
    heading: "Water Storage Duration",
    paragraphs: [
      {
        text: "Water storage with limited duration creates time-bound protection during outages. Storage duration depends on facility demand, occupancy levels, and ability to reduce non-essential water use.",
        citations: ["EPA_WATER_SECURITY", "FEMA_CGC"],
      },
      {
        text: "Understanding storage duration in relation to expected outage patterns can inform decisions about capacity expansion or demand management. Organizations may evaluate whether storage capacity aligns with regional outage experience.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
];
