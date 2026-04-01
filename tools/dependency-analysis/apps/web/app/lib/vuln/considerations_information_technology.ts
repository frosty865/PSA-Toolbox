/**
 * Analytical Considerations - Information Technology
 * 
 * Citation-backed, non-prescriptive narrative analysis for IT vulnerabilities.
 * Max 4 considerations per vulnerability (enforced by verifier).
 */

import type { AnalyticalConsideration } from "./consideration_types";

export const INFORMATION_TECHNOLOGY_CONSIDERATIONS: AnalyticalConsideration[] = [
  {
    id: "AC_IT_001",
    heading: "Backup IT Capability",
    paragraphs: [
      {
        text: "Facilities without backup IT capability may experience immediate operational disruption during primary system or service outages. IT dependence varies based on digital service integration, cloud hosting arrangements, and application criticality.",
        citations: ["NIST_SP_800_34", "FEMA_CGC"],
      },
      {
        text: "Backup IT can include redundant servers, cloud failover, alternate ISPs, or manual workarounds. Organizations may assess whether IT backup arrangements align with operational resilience requirements during system disruption.",
        citations: ["NIST_CSF", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_002",
    heading: "Alternate IT Service Options",
    paragraphs: [
      {
        text: "Alternate IT options include redundant cloud regions, secondary data centers, backup ISPs, and mobile hot-spots. Each approach has different recovery time objectives (RTO), recovery point objectives (RPO), and operational characteristics.",
        citations: ["NIST_SP_800_34", "ISO_22301"],
      },
      {
        text: "Selection of alternate IT services depends on application criticality, data sensitivity, and acceptable downtime. Facilities with limited provider  diversity may benefit from evaluating cloud-based or geographically distributed backup options.",
        citations: ["FEMA_CGC", "NIST_CSF"],
      },
    ],
  },
  {
    id: "AC_IT_003",
    heading: "Time-Critical IT Systems",
    paragraphs: [
      {
        text: "Facilities with time-critical IT systems face immediate impact when services are lost. Essential functions such as transaction processing, real-time monitoring, identity management, and operational technology interfaces can degrade within minutes without IT capability.",
        citations: ["NIST_SP_800_34", "NIST_SP_800_82"],
      },
      {
        text: "Understanding time-to-impact for critical IT systems can inform decisions about redundancy, failover automation, and backup activation procedures. Organizations may evaluate whether essential IT systems have adequate protection matching operational tolerance for interruption.",
        citations: ["FEMA_CGC", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_004",
    heading: "Functional Loss Without Backup IT",
    paragraphs: [
      {
        text: "Facilities experiencing high functional loss without backup IT face significant operational degradation during outages. The percentage of functions affected depends on digital transformation maturity, cloud service integration, and availability of manual processes.",
        citations: ["FEMA_CGC", "NIST_CSF"],
      },
      {
        text: "High functional loss can indicate concentrated risk in IT infrastructure. Organizations may assess whether IT dependencies create disproportionate vulnerability during service disruptions.",
        citations: ["NIST_SP_800_34", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_005",
    heading: "IT Service Provider Identification",
    paragraphs: [
      {
        text: "Identifying IT service providers, cloud platform operators, and ISPs enables coordination during outages. Knowledge of service architectures, support escalation paths, and SLA terms supports situational awareness and restoration communication.",
        citations: ["NIST_CSF", "FEMA_CGC"],
      },
      {
        text: "Facilities without documented IT provider information may experience delayed coordination during outages. Documenting provider contacts, understanding service dependencies, and documenting support agreements can facilitate incident resolution.",
        citations: ["NIST_SP_800_34", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_006",
    heading: "IT Service Level Agreements",
    requiresPRA: true,
    paragraphs: [
      {
        text: "Service level agreements (SLAs) define provider commitments for availability, response time, and restoration. SLAs with defined restoration time objectives can reduce uncertainty during IT service disruptions.",
        citations: ["ISO_22301", "NIST_CSF"],
      },
      {
        text: "Facilities without documented SLAs face uncertainty about restoration priorities and timelines. Organizations can evaluate whether IT service criticality justifies SLA-backed service arrangements and whether current agreements align with operational recovery requirements.",
        citations: ["FEMA_CGC", "NIST_SP_800_34"],
      },
    ],
  },
  {
    id: "AC_IT_007",
    heading: "Redundant IT Service Providers",
    paragraphs: [
      {
        text: "Redundant IT service providers reduce single point of failure risk. Redundancy can include multiple ISPs, multi-cloud architectures, or geographically distributed data centers.",
        citations: ["NIST_SP_800_34", "NIST_CSF"],
      },
      {
        text: "Facilities relying on single IT service providers face concentrated risk from provider-specific failures. Organizations may evaluate whether operational criticality justifies multi-provider arrangements and whether application architectures support provider diversity.",
        citations: ["FEMA_CGC", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_008",
    heading: "Collocated IT Infrastructure",
    paragraphs: [
      {
        text: "IT services sharing collocated data centers, network equipment, or ISP pathways face common-mode failure risk. Collocation can reduce redundancy benefits when multiple services are affected simultaneously by a single incident.",
        citations: ["NIST_SP_800_34", "FEMA_CGC"],
      },
      {
        text: "Organizations with collocated IT infrastructure may assess whether physical or logical separation is feasible. Verifying service independence with providers can clarify whether redundancy provides meaningful failure isolation.",
        citations: ["NIST_CSF", "ISO_22301"],
      },
    ],
  },
  {
    id: "AC_IT_009",
    heading: "Physical Security - IT Components",
    paragraphs: [
      {
        text: "IT equipment exposed to physical risks includes on-premise servers, network equipment, ISP demarcation points, and backup storage. Physical security measures protect against unauthorized access, environmental hazards, and equipment damage.",
        citations: ["NIST_SP_800_53", "NIST_SP_800_82"],
      },
      {
        text: "Organizations may assess whether critical IT components have adequate physical protection matching their operational importance. Environmental controls, access restrictions, and equipment hardening can reduce physical vulnerability.",
        citations: ["FEMA_CGC", "ISO_27001"],
      },
    ],
  },
];
