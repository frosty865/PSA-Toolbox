/* CURSOR PROMPT — Add OT/ICS Resilience Module (production-ready config block)
   File: apps/web/app/lib/modules/ot_ics_resilience_module.ts

   Notes:
   - This is a CROSS-CUTTING module (does not drive any curve).
   - It adds resilience context + modifiers that downstream report/vuln logic can consume.
   - It is intentionally NOT a cyber audit (no "patching", "malware", etc.).
*/

export type TriState = "YES" | "NO" | "UNKNOWN";
export type FourState = "YES" | "NO" | "PARTIAL" | "UNKNOWN";

export type ModuleQuestionType =
  | "TRI_STATE"
  | "FOUR_STATE"
  | "MULTI_SELECT"
  | "SHORT_TEXT"
  | "LONG_TEXT";

export type ModuleQuestionConfig = {
  id: string;
  type: ModuleQuestionType;
  prompt: string;
  required?: boolean;
  help_text?: string;
  options?: string[]; // for MULTI_SELECT
  showWhen?: { questionId: string; equals: string }[];
};

export type ModuleVulnerabilityConfig = {
  id: string;
  title: string;
  text: string;
  trigger_question_ids: string[];
  // Keep OFCs limited to <=4 per your stakeholder load preference
  ofc_ids?: string[];
};

export type ModuleOfcConfig = {
  id: string;
  option_for_consideration: string;
  benefit: string;
};

export type ModuleModifier = {
  id: string;
  applies_to_infrastructure: "ELECTRIC_POWER" | "WATER" | "WASTEWATER" | "COMMUNICATIONS" | "INFORMATION_TECHNOLOGY";
  // A simple, deterministic modifier signal that your downstream logic can map into severity scoring / narrative
  kind:
    | "INCREASE_CONSEQUENCE"
    | "DECREASE_CONSEQUENCE"
    | "INCREASE_LIKELIHOOD"
    | "DECREASE_LIKELIHOOD"
    | "EXTEND_RECOVERY"
    | "SHORTEN_RECOVERY";
  reason: string;
  when: { questionId: string; equals: string }[];
};

export type ModuleConfig = {
  module_code: "MODULE_OT_ICS_RESILIENCE";
  title: string;
  category: "CROSS_DEPENDENCY";
  drives_curve: false;

  intro: {
    purpose: string;
    includes: string[];
    excludes: string[];
    how_used: string;
  };

  questions: ModuleQuestionConfig[];
  vulnerabilities: ModuleVulnerabilityConfig[];
  ofcs: ModuleOfcConfig[];
  modifiers: ModuleModifier[];
};

export const OT_ICS_RESILIENCE_MODULE: ModuleConfig = {
  module_code: "MODULE_OT_ICS_RESILIENCE",
  title: "OT / ICS Resilience",
  category: "CROSS_DEPENDENCY",
  drives_curve: false,

  intro: {
    purpose:
      "Evaluates whether operational control systems (OT/ICS) that manage facility infrastructure can continue operating during disruptions to power, communications, or external connectivity. This module identifies operational survivability factors such as local control, manual override, and dependency on external data transport.",
    includes: [
      "Building automation and control systems (e.g., HVAC controls, BAS)",
      "Process control (e.g., pumps, lift stations, treatment controls)",
      "Supervisory control and monitoring (e.g., SCADA-like functions)",
      "Operational control dependencies (power support, external connectivity reliance, local/manual operation)",
    ],
    excludes: [
      "Cybersecurity compliance testing",
      "Vulnerability scanning, patch levels, malware controls, incident response maturity",
      "General corporate IT hygiene unrelated to operational continuity of control systems",
    ],
    how_used:
      "Answers in this module do not create a separate dependency curve. They provide modifiers that can increase or decrease consequence expectations within existing infrastructure dependencies.",
  },

  questions: [
    {
      id: "ot_ics_present",
      type: "TRI_STATE",
      prompt: "Are any critical facility systems managed by OT/ICS or digital control systems?",
      required: true,
      help_text:
        "Include systems such as building automation (BAS), HVAC controls, pump controls, electrical supervisory controls, fire/life safety control panels, elevator controls, and access control controllers.",
    },
    {
      id: "ot_ics_systems_controlled",
      type: "MULTI_SELECT",
      prompt: "Which infrastructure or facility systems are digitally controlled? (Select all that apply)",
      required: false,
      options: [
        "Electrical distribution / supervisory controls",
        "Water systems (pumps/controls)",
        "Wastewater systems (lift station/pumps/controls)",
        "HVAC / building automation",
        "Fire/life safety controls",
        "Access control / security controls",
        "Dispatch or operational coordination systems",
        "Industrial process equipment",
        "Other",
      ],
      showWhen: [{ questionId: "ot_ics_present", equals: "YES" }],
      help_text:
        "This establishes which infrastructure areas may be affected by control-system disruption and enables clearer downstream narrative.",
    },

    // Power support
    {
      id: "ot_ics_power_supported",
      type: "FOUR_STATE",
      prompt: "Are OT/ICS control components supported by backup power (UPS and/or generator)?",
      required: false,
      showWhen: [{ questionId: "ot_ics_present", equals: "YES" }],
      help_text:
        "If control panels or controllers lose power, the facility may lose operational control even if mechanical infrastructure remains intact.",
    },
    {
      id: "ot_ics_power_support_notes",
      type: "LONG_TEXT",
      prompt: "Briefly describe what OT/ICS components are supported by backup power and what is not.",
      required: false,
      showWhen: [{ questionId: "ot_ics_power_supported", equals: "NO" }],
    },

    // External connectivity reliance
    {
      id: "ot_ics_requires_external_internet",
      type: "TRI_STATE",
      prompt: "Do any OT/ICS systems require external internet connectivity for normal operations or management?",
      required: false,
      showWhen: [{ questionId: "ot_ics_present", equals: "YES" }],
      help_text:
        "Some modern control platforms rely on cloud-hosted management or remote monitoring that may fail when external data connectivity is disrupted.",
    },
    {
      id: "ot_ics_local_operation_without_internet",
      type: "FOUR_STATE",
      prompt: "If external connectivity is lost, can critical OT/ICS functions continue operating locally?",
      required: false,
      showWhen: [{ questionId: "ot_ics_requires_external_internet", equals: "YES" }],
      help_text:
        "This is about operational continuity. A system may be manageable remotely via cloud, but still operate locally without external connectivity.",
    },

    // Segmentation / convergence awareness (operational, not cyber)
    {
      id: "ot_ics_dependent_on_internal_it",
      type: "FOUR_STATE",
      prompt: "Do OT/ICS operations depend on the facility's internal IT network to function normally?",
      required: false,
      showWhen: [{ questionId: "ot_ics_present", equals: "YES" }],
      help_text:
        "This is not a security audit. It evaluates whether internal network outages could also disrupt operational control systems.",
    },

    // Manual override / local control
    {
      id: "ot_ics_manual_override",
      type: "FOUR_STATE",
      prompt: "Can critical infrastructure functions be operated manually if OT/ICS control is degraded or unavailable?",
      required: false,
      showWhen: [{ questionId: "ot_ics_present", equals: "YES" }],
      help_text:
        "Manual operation can reduce consequence severity during disruptions when automated controls fail.",
    },
    {
      id: "ot_ics_manual_override_notes",
      type: "LONG_TEXT",
      prompt: "Briefly describe which systems have manual/local override and which do not.",
      required: false,
      showWhen: [{ questionId: "ot_ics_manual_override", equals: "NO" }],
    },
  ],

  ofcs: [
    {
      id: "ofc_ot_ics_document_local_fallback",
      option_for_consideration:
        "Local operating mode and manual override procedures for OT/ICS-managed systems may be documented and made readily available to responsible staff.",
      benefit:
        "Supports continued operations when automated controls are degraded or remote management is unavailable.",
    },
    {
      id: "ofc_ot_ics_backup_power_for_controls",
      option_for_consideration:
        "Backup power coverage for critical OT/ICS control components (e.g., controllers, panels, supporting network gear) may be reviewed and validated.",
      benefit:
        "Reduces likelihood of losing operational control during utility power disruption.",
    },
    {
      id: "ofc_ot_ics_reduce_external_dependency",
      option_for_consideration:
        "OT/ICS functions that rely on external connectivity may be reviewed to identify opportunities for local continuity when external data transport is disrupted.",
      benefit:
        "Improves survivability of control functions during ISP or upstream network outages.",
    },
    {
      id: "ofc_ot_ics_isolate_operational_dependency_paths",
      option_for_consideration:
        "Operational dependency paths between OT/ICS functions and internal IT networks may be identified to reduce cascading operational disruptions from internal network outages.",
      benefit:
        "Helps prevent single-point internal network issues from disrupting critical operational controls.",
    },
  ],

  vulnerabilities: [
    {
      id: "v_ot_ics_controls_not_on_backup_power",
      title: "OT/ICS controls may not be supported by backup power",
      text:
        "OT/ICS control components may lose functionality during utility power disruption, potentially reducing the facility's ability to monitor or control critical systems even when mechanical infrastructure remains intact.",
      trigger_question_ids: ["ot_ics_power_supported"],
      ofc_ids: ["ofc_ot_ics_backup_power_for_controls"],
    },
    {
      id: "v_ot_ics_external_connectivity_dependency",
      title: "OT/ICS functions may depend on external data connectivity",
      text:
        "If OT/ICS functions rely on external connectivity, loss of internet transport may degrade operational monitoring or control and increase consequence severity during IT outages.",
      trigger_question_ids: ["ot_ics_requires_external_internet", "ot_ics_local_operation_without_internet"],
      ofc_ids: ["ofc_ot_ics_reduce_external_dependency"],
    },
    {
      id: "v_ot_ics_internal_it_cascade_risk",
      title: "Operational controls may depend on internal IT network availability",
      text:
        "If OT/ICS operations rely on internal IT networking, internal network disruptions may cascade into operational control impacts beyond typical business-system outages.",
      trigger_question_ids: ["ot_ics_dependent_on_internal_it"],
      ofc_ids: ["ofc_ot_ics_isolate_operational_dependency_paths"],
    },
    {
      id: "v_ot_ics_no_manual_override",
      title: "Manual or local override may be limited for critical systems",
      text:
        "If manual or local override is limited, the facility may experience greater operational impact when automated controls are degraded or unavailable.",
      trigger_question_ids: ["ot_ics_manual_override"],
      ofc_ids: ["ofc_ot_ics_document_local_fallback"],
    },
  ],

  modifiers: [
    // Electric power consequence modifiers
    {
      id: "m_ep_increase_consequence_controls_no_backup",
      applies_to_infrastructure: "ELECTRIC_POWER",
      kind: "INCREASE_CONSEQUENCE",
      reason:
        "Loss of utility power may disable operational control components, increasing consequence even when some infrastructure remains mechanically functional.",
      when: [{ questionId: "ot_ics_power_supported", equals: "NO" }],
    },
    {
      id: "m_ep_decrease_consequence_controls_on_backup",
      applies_to_infrastructure: "ELECTRIC_POWER",
      kind: "DECREASE_CONSEQUENCE",
      reason:
        "Backup power support for control components may reduce the operational consequence of utility disruption by maintaining monitoring and control functions.",
      when: [{ questionId: "ot_ics_power_supported", equals: "YES" }],
    },

    // IT (external data transport) consequence modifiers
    {
      id: "m_it_increase_consequence_external_dependency_no_local_mode",
      applies_to_infrastructure: "INFORMATION_TECHNOLOGY",
      kind: "INCREASE_CONSEQUENCE",
      reason:
        "If OT/ICS relies on external internet connectivity and cannot operate locally during outages, loss of external data transport may increase operational impacts.",
      when: [
        { questionId: "ot_ics_requires_external_internet", equals: "YES" },
        { questionId: "ot_ics_local_operation_without_internet", equals: "NO" },
      ],
    },
    {
      id: "m_it_decrease_consequence_external_dependency_local_mode",
      applies_to_infrastructure: "INFORMATION_TECHNOLOGY",
      kind: "DECREASE_CONSEQUENCE",
      reason:
        "Local operation capability can reduce operational consequences when external data connectivity is disrupted.",
      when: [
        { questionId: "ot_ics_requires_external_internet", equals: "YES" },
        { questionId: "ot_ics_local_operation_without_internet", equals: "YES" },
      ],
    },

    // Water consequence modifiers
    {
      id: "m_water_increase_consequence_no_manual_override",
      applies_to_infrastructure: "WATER",
      kind: "INCREASE_CONSEQUENCE",
      reason:
        "Limited manual/local override for digitally controlled water-related systems may increase consequence during disruptions.",
      when: [{ questionId: "ot_ics_manual_override", equals: "NO" }],
    },

    // Wastewater consequence modifiers
    {
      id: "m_ww_increase_consequence_no_manual_override",
      applies_to_infrastructure: "WASTEWATER",
      kind: "INCREASE_CONSEQUENCE",
      reason:
        "Limited manual/local override for digitally controlled wastewater-related systems may increase consequence during disruptions.",
      when: [{ questionId: "ot_ics_manual_override", equals: "NO" }],
    },

    // Communications (voice/control) modifier (only when dispatch/coordination is controlled digitally)
    {
      id: "m_comms_extend_recovery_internal_it_dependency",
      applies_to_infrastructure: "COMMUNICATIONS",
      kind: "EXTEND_RECOVERY",
      reason:
        "If operational coordination systems depend on internal IT availability, communications recovery may be slower when internal network functions are degraded.",
      when: [{ questionId: "ot_ics_dependent_on_internal_it", equals: "YES" }],
    },
  ],
};

export default OT_ICS_RESILIENCE_MODULE;
