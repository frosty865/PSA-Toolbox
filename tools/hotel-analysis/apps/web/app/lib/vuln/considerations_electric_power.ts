/**
 * Analytical Considerations - Electric Power
 * 
 * Citation-backed, non-prescriptive narrative analysis for electric power vulnerabilities.
 * Max 4 considerations per vulnerability (enforced by verifier).
 */

import type { AnalyticalConsideration } from "./consideration_types";

export const ELECTRIC_POWER_CONSIDERATIONS: AnalyticalConsideration[] = [
  {
    id: "AC_EP_001",
    heading: "Backup Power Capability",
    paragraphs: [
      {
        text: "Facilities without backup power capability may experience immediate operational disruption during grid outages. The duration and impact of power loss depends on the criticality of electrically-powered systems and the facility's operational flexibility.",
        citations: ["NFPA_110", "FEMA_CGC"],
      },
      {
        text: "Backup power systems can sustain essential services during outages, but effectiveness varies based on fuel availability, runtime capacity, and the scope of systems protected. Organizations may consider whether current backup arrangements align with operational recovery objectives.",
        citations: ["NFPA_110", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_EP_002",
    heading: "Alternate Power Source Options",
    paragraphs: [
      {
        text: "Alternate power sources include on-site generators, uninterruptible power supplies (UPS), battery systems, and renewable energy systems. Each approach has different runtime characteristics, maintenance requirements, and coverage scopes.",
        citations: ["NFPA_110", "DOE_MICROGRIDS"],
      },
      {
        text: "Selection of alternate power sources depends on load requirements, acceptable downtime, and restoration time expectations. Facilities operating in areas with prolonged grid outages may benefit from assessing whether current or planned alternate sources match operational needs.",
        citations: ["FEMA_CGC", "DOE_ENERGY_RESILIENCY"],
      },
    ],
  },
  {
    id: "AC_EP_003",
    heading: "Time-Critical Operations",
    paragraphs: [
      {
        text: "Facilities with time-critical operations face immediate impact when power is lost. Essential functions such as life safety systems, process control, refrigeration, data systems, and communications can degrade within minutes to hours without electrical supply.",
        citations: ["NFPA_101", "NFPA_110"],
      },
      {
        text: "Understanding time-to-impact for critical operations can inform decisions about backup power scope and activation time. Organizations may evaluate whether essential systems have adequate power protection matching their operational tolerance for interruption.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_EP_004",
    heading: "Functional Loss Without Backup Power",
    paragraphs: [
      {
        text: "Facilities experiencing high functional loss without backup power face significant operational degradation during outages. The percentage of functions affected depends on the integration of electrical systems into core operations and the availability of manual workarounds.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "High functional loss can indicate concentrated risk in electrical infrastructure. Organizations may assess whether the scope and distribution of electrical dependencies create disproportionate vulnerability during grid disruptions.",
        citations: ["NIST_SP_800_34", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_EP_005",
    heading: "Recovery Time Considerations",
    paragraphs: [
      {
        text: "Recovery time after power restoration reflects the complexity of restarting operations, conducting safety checks, and re-initializing systems. Prolonged recovery can extend total downtime beyond the duration of the grid outage itself.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
      {
        text: "Facilities with extended recovery periods may benefit from evaluating restart procedures, training requirements, and system dependencies that contribute to recovery duration. Documented recovery sequences can reduce uncertainty during restoration.",
        citations: ["ISO_22301", "NIST_CSF"],
      },
    ],
  },
  {
    id: "AC_EP_006",
    heading: "Backup Power Runtime Limitations",
    paragraphs: [
      {
        text: "Backup power systems with limited runtime create time-bound protection during outages. Runtime depends on fuel capacity, load demand, and whether non-essential loads can be shed. Short runtime systems may not sustain operations through extended grid disruptions.",
        citations: ["NFPA_110"],
      },
      {
        text: "Understanding backup power runtime in relation to expected outage duration can inform decisions about fuel storage, load management, and refueling logistics. Organizations may evaluate whether runtime capacity aligns with regional outage patterns.",
        citations: ["FEMA_CGC", "DOE_ENERGY_RESILIENCY"],
      },
    ],
  },
  {
    id: "AC_EP_007",
    heading: "Generator Refueling and Maintenance",
    paragraphs: [
      {
        text: "Generator systems involve periodic refueling, routine maintenance, and operational testing for ongoing reliability. Fuel supply logistics, maintenance schedules, and testing protocols are components of generator readiness.",
        citations: ["NFPA_110"],
      },
      {
        text: "Facilities relying on generators for extended outages may benefit from assessing fuel supply arrangements, maintenance currency, and operational testing frequency. Access to fuel during widespread outages can be constrained by regional supply and transportation availability.",
        citations: ["FEMA_CGC", "NFPA_1600"],
      },
    ],
  },
  {
    id: "AC_EP_008",
    heading: "Refueling and Resupply Planning",
    paragraphs: [
      {
        text: "Refueling and resupply plans address how backup power systems will be sustained during prolonged outages. Plans typically include fuel delivery contracts, on-site storage capacity, refueling schedules, and coordination with suppliers.",
        citations: ["NFPA_110", "FEMA_CGC"],
      },
      {
        text: "Organizations without documented refueling plans face uncertainty about fuel availability during regional disruptions. Documented arrangements with suppliers, including priority service agreements, can reduce refueling uncertainty during extended outages.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_EP_009",
    heading: "Utility Provider Identification",
    paragraphs: [
      {
        text: "Identifying the electric utility provider and understanding upstream infrastructure enables coordination during outages. Knowledge of substations, transmission lines, and distribution paths relevant to the facility supports situational awareness and restoration communication.",
        citations: ["FEMA_CGC", "NIST_SP_800_82"],
      },
      {
        text: "Facilities without documented utility provider information may experience delayed coordination during outages. Documenting utility contacts, understanding service territory boundaries, and documenting circuit identifiers can facilitate outage reporting and restoration status updates.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_EP_010",
    heading: "Priority Restoration Agreements",
    paragraphs: [
      {
        text: "Priority restoration agreements formalize a facility's position in utility restoration sequencing during widespread outages. These agreements can reduce restoration time for facilities supporting critical community functions, but do not guarantee immediate restoration.",
        citations: ["FEMA_CGC"],
      },
      {
        text: "Facilities without priority restoration status may experience longer restoration times during regional events. Organizations can evaluate whether their operational criticality aligns with utility priority service criteria and whether formal agreements would support operational resilience objectives.",
        citations: ["NFPA_1600", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_EP_011",
    heading: "Physical Security - Vehicular Impact",
    paragraphs: [
      {
        text: "Electrical infrastructure exposed to vehicular impact risks includes pad-mounted transformers, switchgear, utility poles, and above-ground conduit. Vehicular collisions can cause immediate outages and may involve extended repair times depending on equipment availability.",
        citations: ["NIST_SP_800_82", "FEMA_CGC"],
      },
      {
        text: "Protective measures such as bollards, barriers, or vegetation buffers can reduce vehicular impact exposure. Organizations may assess whether critical electrical components are positioned in high-traffic areas or vulnerable locations where protective measures could reduce rapid outage risk.",
        citations: ["IBC", "ASCE_7"],
      },
    ],
  },
  {
    id: "AC_EP_012",
    heading: "Redundant Electrical Service",
    paragraphs: [
      {
        text: "Redundant electrical service provides alternate pathways for power delivery, reducing single point of failure risk. Redundancy can include multiple utility feeds, diverse routing, or connections from different substations.",
        citations: ["NFPA_110", "IEEE_1100"],
      },
      {
        text: "Facilities with single electrical service connections face concentrated risk from localized failures. Organizations may evaluate whether operational criticality justifies redundant service and whether utility infrastructure supports diverse routing options.",
        citations: ["FEMA_CGC", "NIST_SP_800_82"],
      },
    ],
  },
];
