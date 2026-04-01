/**
 * Analytical Considerations - Wastewater
 * 
 * Citation-backed, non-prescriptive narrative analysis for wastewater vulnerabilities.
 * Max 4 considerations per vulnerability (enforced by verifier).
 */

import type { AnalyticalConsideration } from "./consideration_types";

export const WASTEWATER_CONSIDERATIONS: AnalyticalConsideration[] = [
  {
    id: "AC_WW_001",
    heading: "Alternate Wastewater Discharge Capability",
    paragraphs: [
      {
        text: "Facilities without alternate wastewater discharge capability may experience immediate operational disruption and habitability concerns during utility outages. Wastewater dependence varies based on facility occupancy, processes generating wastewater, and holding capacity.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Alternate wastewater management can include on-site holding tanks, portable facilities, or bypass pumping arrangements. Organizations may assess whether wastewater management arrangements align with operational requirements during service disruption.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_002",
    heading: "Wastewater Holding and Bypass Options",
    paragraphs: [
      {
        text: "Wastewater holding options include temporary storage tanks, bypass pumping systems, and portable sanitation facilities. Holding capacity and duration affect operational continuity during outages.",
        citations: ["EPA_WATER_SECURITY", "FEMA_CGC"],
      },
      {
        text: "Selection of wastewater management options depends on facility occupancy, wastewater volume, and acceptable operational constraints. Facilities generating high wastewater volumes may benefit from evaluating holding capacity relative to expected outage duration.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_003",
    heading: "Time-Critical Wastewater Operations",
    paragraphs: [
      {
        text: "Facilities with time-critical wastewater discharge face immediate habitability and operational impact when service is lost. Sanitation, occupancy, and process wastewater discharge can degrade within hours without wastewater service.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Understanding time-to-impact for wastewater-dependent operations can inform decisions about holding capacity and alternate discharge arrangements. Organizations may evaluate whether wastewater management has adequate protection matching operational tolerance.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_004",
    heading: "Functional Loss Without Alternate Wastewater",
    paragraphs: [
      {
        text: "Facilities experiencing high functional loss without alternate wastewater face significant operational degradation and potential facility closure during outages. The percentage of functions affected depends on wastewater generation rates and holding capacity.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "High functional loss can indicate concentrated risk in wastewater infrastructure. Organizations may assess whether wastewater dependencies create disproportionate vulnerability during utility disruptions.",
        citations: ["EPA_WATER_SECURITY", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_005",
    heading: "Wastewater Utility Provider Identification",
    paragraphs: [
      {
        text: "Identifying wastewater utility providers and understanding upstream infrastructure enables coordination during outages. Knowledge of treatment plants, lift stations, and collection systems supports situational awareness and restoration communication.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Facilities without documented utility provider information may experience delayed coordination during outages. Documenting utility contacts and documenting service characteristics can facilitate outage reporting and restoration updates.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_006",
    heading: "Priority Restoration Agreements - Wastewater",
    requiresPRA: true,
    paragraphs: [
      {
        text: "Priority restoration agreements for wastewater service can reduce restoration time for facilities supporting critical community functions. Utility priority programs may prioritize health care, emergency services, and essential facilities.",
        citations: ["FEMA_CGC", "EPA_WATER_SECURITY"],
      },
      {
        text: "Facilities without priority restoration status may experience longer restoration times during regional wastewater outages. Organizations can evaluate whether operational criticality aligns with utility priority criteria.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_007",
    heading: "Redundant Wastewater Connections",
    paragraphs: [
      {
        text: "Redundant wastewater connections provide alternate pathways for discharge, reducing single point of failure risk. Redundancy can include multiple utility connections, diverse routing, or alternate collection system access.",
        citations: ["EPA_WATER_SECURITY", "FEMA_CGC"],
      },
      {
        text: "Facilities with single wastewater connections face concentrated risk from localized failures. Organizations may evaluate whether operational criticality justifies redundant connections and whether utility infrastructure supports diverse access options.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_WW_008",
    heading: "Wastewater Recovery Time",
    paragraphs: [
      {
        text: "Recovery time after wastewater service restoration reflects the complexity of resuming full occupancy and operations. Prolonged recovery can extend total downtime beyond the duration of the service outage.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "Facilities with extended wastewater recovery periods may benefit from evaluating restart procedures and system dependencies that contribute to recovery duration. Documented recovery sequences can reduce un certainty during restoration.",
        citations: ["ISO_22301", "EPA_WATER_SECURITY"],
      },
    ],
  },
];
