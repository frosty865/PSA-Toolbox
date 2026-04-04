/**
 * Tab Intro Text & Glossary
 * 
 * Per-tab introduction blocks explaining scope and terminology.
 * Rendered at top of each dependency tab to avoid ambiguity.
 */

export type TabIntroKey = 'energy' | 'communications' | 'information_technology' | 'water' | 'wastewater';

export const TAB_INTROS: Record<TabIntroKey, { intro: string; glossary?: Record<string, string> }> = {
  energy: {
    intro: `
Electric Power Dependency Assessment

This section evaluates facility dependency on external electric power supply and identifies operational 
constraints arising from potential disruptions. The assessment focuses on:

• Dependency status: Does the facility require continuous electric service for operations?
• Backup capability: Are on-site power generation or energy storage systems available?
• Time-to-impact: How long can the facility operate without external power?
• Recovery requirements: What conditions must be restored to full operational status?

This assessment models a 72-hour disruption scenario and identifies operational degradation thresholds 
and recovery timelines. Cybersecurity governance, control system security, and internal energy management 
are out of scope. This is a structural and supply-chain assessment.
    `.trim(),
    glossary: {
      'Backup Capability': 'On-site power generation (generator) or energy storage (battery/UPS) that allows continued operation without grid supply.',
      'Time to Severe Impact': 'Duration in hours after grid loss before facility operates below minimum functional threshold.',
      'Degradation Without Backup': 'Percentage loss of operational capability during disruption without any mitigation.',
      'Mitigation Duration': 'Hours that backup power or alternative supply can sustain operations.',
      'Recovery Time': 'Hours required after grid restoration to return to full operational status.',
    },
  },

  communications: {
    intro: `
Communications Dependency Assessment

This section evaluates facility dependency on external voice/radio/dispatch transport systems for command & control 
and operational coordination (e.g., radio, telephone, dispatch systems). The assessment focuses on:

• Dependency status: Does the facility require external communications to maintain operations?
• Voice/Command & Control transport: Landline, wireless, radio, or satellite systems?
• Backup systems: Redundant communication pathways or on-site systems?
• Coordination impact: How does loss of communications affect facility operations?

IMPORTANT: This assessment is about EXTERNAL TRANSPORT SYSTEMS ONLY (carrier networks, radio towers, 
telephone exchange). Internal communications infrastructure (intercom, local network) and cybersecurity 
governance are out of scope. This is NOT an IT security or internal network assessment.
    `.trim(),
    glossary: {
      'Voice Transport': 'Landline telephone, cellular, or radio systems used for routine communication.',
      'Command & Control': 'Dispatch systems, emergency coordination, or supervisory systems requiring external connectivity.',
      'Backup Redundancy': 'Alternative communication path (e.g., satellite, different carrier, radio).',
      'Coordination Window': 'Hours after communications loss during which facility operations remain functional.',
      'Recovery Dependency': 'Whether restoration of external communications is critical to facility recovery.',
    },
  },

  information_technology: {
    intro: `
Information Technology Dependency Assessment

This section evaluates facility dependency on external data/internet transport and connectivity 
(e.g., internet service, data circuits, cloud services). The assessment focuses on:

• Dependency status: Does the facility require external data connectivity to operate?
• Internet/Data Circuits: ISP connections, WAN circuits, or cloud service dependencies?
• Backup connectivity: Redundant internet providers or alternative transport?
• Data availability: How does loss of connectivity affect facility operations?

IMPORTANT: This assessment is about EXTERNAL DATA TRANSPORT ONLY (ISP, WAN carriers, public internet). 
Internal systems (cabling, switches, cybersecurity maturity, access control systems) are out of scope. 
This is NOT an IT security, cybersecurity governance, or internal network assessment.
    `.trim(),
    glossary: {
      'Primary Data Circuit': 'Main internet or WAN connection used for facility operations.',
      'Secondary/Backup Connectivity': 'Redundant internet provider or failover circuit.',
      'Cloud Dependency': 'Reliance on cloud-hosted systems, SaaS, or external data storage.',
      'Response Time': 'Hours facility can function with degraded or no data connectivity.',
      'Recovery Data Requirements': 'Whether data restoration is prerequisite for full operational recovery.',
    },
  },

  water: {
    intro: `
Water Supply Dependency Assessment

This section evaluates facility dependency on external potable water supply for operations 
(drinking, sanitation, industrial processes, cooling, etc.). The assessment focuses on:

• Dependency status: Does the facility require potable water for operations?
• Supply source: Municipal supply, well, or alternative source?
• Storage/Backup: On-site water storage or alternative sources?
• Usage patterns: Critical vs. non-critical water usage.

The assessment models a 72-hour supply disruption and identifies operational constraints, 
stored supply duration, and recovery requirements. Water treatment, distribution system 
security, and wastewater disposal are covered separately.
    `.trim(),
    glossary: {
      'Potable Water':  'Drinking water meeting health standards required for direct consumption or food service.',
      'Process Water': 'Water used in industrial operations, cooling systems, or facility processes.',
      'On-Site Storage': 'Tanks, cisterns, or other facilities holding potable or process water reserves.',
      'Daily Requirement': 'Estimated volume of water facility consumes per day for all uses.',
      'Supply Duration (stored)': 'Days stored water can sustain operations at current usage rate.',
    },
  },

  wastewater: {
    intro: `
Wastewater / Sewer Dependency Assessment

This section evaluates facility dependency on external wastewater (sewer) and discharge systems. 
The assessment focuses on:

• Dependency status: Does facility require functional sewer/discharge systems?
• Sewer connection: Municipal sewer, septic, or alternative discharge?
• Backup/Storage: On-site wastewater storage or treatment capability?
• Operational impact: How does loss of sewer function affect operations?

The assessment models a 72-hour system disruption and identifies constraints on facility operations, 
storage/treatment capacity, and recovery needs. Wastewater treatment quality and environmental 
compliance are out of scope.
    `.trim(),
    glossary: {
      'Municipal Sewer': 'Connection to city/regional sewer treatment facility.',
      'Septic System': 'On-site treatment system for wastewater.',
      'Discharge Capacity': 'Volume of wastewater facility generates per day.',
      'Storage/Treatment Duration': 'Hours facility can store or treat wastewater before exceeding capacity.',
      'Backup Discharge': 'Alternative discharge method (e.g., holding tank, alternative treatment).',
    },
  },
};

/**
 * Render intro block for a tab.
 * Called at top of dependency tab section.
 */
export function renderTabIntro(key: TabIntroKey): string {
  return TAB_INTROS[key]?.intro || '';
}

/**
 * Get glossary for a tab.
 * Can be rendered in help panel or side sheet.
 */
export function getTabGlossary(key: TabIntroKey): Record<string, string> | undefined {
  return TAB_INTROS[key]?.glossary;
}
