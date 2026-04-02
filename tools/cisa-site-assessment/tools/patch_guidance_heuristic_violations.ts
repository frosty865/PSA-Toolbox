/**
 * Patch Heuristic Guidance Violations
 * 
 * Patches 19 subtypes identified by heuristic validation as missing required guidance fields.
 * 
 * Usage:
 *   npx tsx tools/patch_guidance_heuristic_violations.ts
 * 
 * Outputs:
 *   - tools/outputs/guidance_patch_heuristic_19.json
 *   - tools/outputs/guidance_patch_heuristic_19_report.md
 *   - taxonomy/discipline_subtypes.json (updated in-place)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const PATCH_JSON = path.join(OUTPUT_DIR, 'guidance_patch_heuristic_19.json');
const PATCH_REPORT = path.join(OUTPUT_DIR, 'guidance_patch_heuristic_19_report.md');

// Authoritative guidance patch map
const GUIDANCE_PATCHES: Record<string, {
  overview: string;
  indicators_of_risk: string[];
  common_failures: string[];
  mitigation_guidance: string[];
  references: string[];
}> = {
  "ACS_VISITOR_MANAGEMENT_SYSTEMS": {
    "overview": "Visitor management covers how visitors, contractors, and other non-badged individuals are identified, authorized, recorded, and controlled while on site.",
    "indicators_of_risk": [
      "Visitors enter without identity verification or authorization",
      "No consistent method to account for visitors during incidents"
    ],
    "common_failures": [
      "Visitor entry handled informally with no record of presence",
      "Visitor credentials or escorts not defined for higher-risk areas"
    ],
    "mitigation_guidance": [
      "Define how visitors are authorized and tracked while on site",
      "Establish a method to account for visitors and contractors during protective actions"
    ],
    "references": [
      "ASIS: Getting Visitor Management Right in Access Control",
      "ASIS Research Report: The Essentials of Access Control (Insights, Benchmarks, and Best Practices)"
    ]
  },

  "COM_INTEROPERABLE_COMMUNICATIONS": {
    "overview": "Interoperable communications address whether the facility can communicate with external responders and partners using agreed methods during incidents.",
    "indicators_of_risk": [
      "External responders cannot reliably reach facility points of contact",
      "Incident communications rely on ad-hoc personal devices or improvised methods"
    ],
    "common_failures": [
      "No identified interoperability method with external partners",
      "Roles and contact paths not defined for incident communications"
    ],
    "mitigation_guidance": [
      "Identify how the facility communicates with external responders during incidents",
      "Define primary and alternate methods used to coordinate during emergency operations"
    ],
    "references": [
      "ISC: Occupant Emergency Programs (2024 Edition)",
      "FEMA: National Incident Management System (NIMS)"
    ]
  },

  "EAP_EVACUATION_PROCEDURES": {
    "overview": "Evacuation procedures define how occupants move to safety, how routes/assembly areas are used, and how accountability is handled during emergencies.",
    "indicators_of_risk": [
      "Evacuation actions differ by area or shift with no consistent procedure",
      "No defined accountability method following evacuation"
    ],
    "common_failures": [
      "Evacuation guidance exists only informally or varies by individual",
      "Assembly locations or movement expectations are unclear"
    ],
    "mitigation_guidance": [
      "Document evacuation actions and responsibilities for occupants and staff",
      "Define how accountability is performed following evacuation"
    ],
    "references": [
      "CISA: Instructional Guide to the Emergency Action Plan (EAP) Template",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "EAP_LOCKDOWN_LOCKOUT_PROCEDURES": {
    "overview": "Lockdown/lockout procedures define protective actions used to secure occupants and restrict movement when a threat condition requires it.",
    "indicators_of_risk": [
      "Unclear triggers for lockdown/lockout decisions",
      "Inconsistent actions across areas during a threat condition"
    ],
    "common_failures": [
      "Lockdown actions not defined for common scenarios (inside vs outside threat)",
      "Roles and responsibilities for initiating and managing lockdown are unclear"
    ],
    "mitigation_guidance": [
      "Document lockdown/lockout actions, triggers, and responsible roles",
      "Define how protective actions are communicated and maintained during the event"
    ],
    "references": [
      "CISA: Instructional Guide to the Emergency Action Plan (EAP) Template",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "EAP_REUNIFICATION_PROCEDURES": {
    "overview": "Reunification procedures address how occupants are accounted for and reunited with responsible parties after evacuation, relocation, or prolonged protective actions.",
    "indicators_of_risk": [
      "No defined process for post-incident accountability and reunification",
      "Confusion over where occupants go after protective actions end"
    ],
    "common_failures": [
      "Reunification handled ad hoc without a defined location or process",
      "Accountability expectations not defined for staff, occupants, and visitors"
    ],
    "mitigation_guidance": [
      "Define how accountability and reunification are performed after incidents",
      "Document roles, locations, and communication expectations for reunification"
    ],
    "references": [
      "CISA: Instructional Guide to the Emergency Action Plan (EAP) Template",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "EMR_BUSINESS_CONTINUITY": {
    "overview": "Business continuity addresses whether essential functions can continue or be restored during disruptions that degrade normal operations.",
    "indicators_of_risk": [
      "Essential functions depend on single points of failure",
      "No defined approach to sustain operations during prolonged disruption"
    ],
    "common_failures": [
      "Continuity assumptions exist but are not documented",
      "Dependencies and priorities for essential functions are undefined"
    ],
    "mitigation_guidance": [
      "Identify essential functions and operational priorities during disruption",
      "Document continuity approaches for sustaining or restoring essential functions"
    ],
    "references": [
      "FEMA: Continuity Resources (Continuity Documents)",
      "FEMA: Continuity Resource Toolkit"
    ]
  },

  "EMR_CRISIS_MANAGEMENT": {
    "overview": "Crisis management covers how leadership makes decisions, sets priorities, and coordinates during high-impact incidents affecting the facility.",
    "indicators_of_risk": [
      "No defined crisis leadership roles or escalation paths",
      "Major incident decisions made inconsistently or without coordination"
    ],
    "common_failures": [
      "Strategic decisions confused with tactical response actions",
      "No defined method to manage priorities, communications, and recovery direction"
    ],
    "mitigation_guidance": [
      "Define crisis leadership roles, responsibilities, and escalation paths",
      "Document how decisions and priorities are coordinated during major incidents"
    ],
    "references": [
      "ISC: Occupant Emergency Programs (2024 Edition)",
      "FEMA: National Incident Management System (NIMS)"
    ]
  },

  "EMR_ICS_NIMS_INTEGRATION": {
    "overview": "ICS/NIMS integration addresses whether incident management at the facility aligns to a common incident management structure for coordination with responders.",
    "indicators_of_risk": [
      "Facility roles do not align to an incident management structure",
      "External responder coordination is difficult due to unclear internal roles"
    ],
    "common_failures": [
      "Incident roles not defined beyond normal job titles",
      "No shared terminology or structure used during incident coordination"
    ],
    "mitigation_guidance": [
      "Define incident roles and responsibilities consistent with an incident management structure",
      "Document how the facility coordinates with responders during incident operations"
    ],
    "references": [
      "FEMA: National Incident Management System (NIMS)",
      "FEMA: NIMS Components (including Incident Command System)"
    ]
  },

  "EMR_RESILIENCE_PLANNING": {
    "overview": "Resilience planning addresses how the facility anticipates disruption, sustains critical functions, and restores operations after events that degrade normal capability.",
    "indicators_of_risk": [
      "Recovery actions are improvised during disruptions",
      "No defined priorities for restoration of critical functions"
    ],
    "common_failures": [
      "Resilience planning treated as the same as emergency response planning",
      "No documented recovery priorities or restoration approach"
    ],
    "mitigation_guidance": [
      "Identify critical functions and priorities for restoration after disruption",
      "Document recovery objectives and restoration approaches for major disruption scenarios"
    ],
    "references": [
      "FEMA: Continuity Resource Toolkit",
      "FEMA: Continuity Resources (Continuity Documents)"
    ]
  },

  "ISC_COORDINATION_PROTOCOLS": {
    "overview": "Coordination protocols define how the facility coordinates with external partners for security support and emergency operations, including roles and contact paths.",
    "indicators_of_risk": [
      "External coordination is improvised during incidents",
      "No defined points of contact or coordination expectations with partners"
    ],
    "common_failures": [
      "Partner engagement relies on informal relationships rather than defined protocols",
      "Roles for coordination not documented or assigned"
    ],
    "mitigation_guidance": [
      "Define coordination roles and contact paths with external partners",
      "Document how requests for assistance and information exchange are performed"
    ],
    "references": [
      "ISC: Occupant Emergency Programs (2024 Edition)",
      "ISC: Facility Security Plan Guide"
    ]
  },

  "KEY_MASTER_KEY_MANAGEMENT": {
    "overview": "Master key management addresses how master keys are controlled to prevent unauthorized access and reduce facility-wide exposure from loss or misuse.",
    "indicators_of_risk": [
      "Master keys are not controlled or tracked consistently",
      "Loss or misuse of a master key would create broad uncontrolled access"
    ],
    "common_failures": [
      "Master keys issued broadly without defined authorization limits",
      "No defined process for accountability when master keys are issued or returned"
    ],
    "mitigation_guidance": [
      "Define authorization and accountability expectations for master key control",
      "Document how master keys are issued, recovered, and managed over their lifecycle"
    ],
    "references": [
      "ASSA ABLOY: Master Key System Design Guide",
      "Real Time Networks: Mastering Key Control (Key Management Best Practices)"
    ]
  },

  "KEY_REKEYING_PROCEDURES": {
    "overview": "Rekeying procedures address whether there is a defined method to change locks/keys when control of keys is lost or access requirements change.",
    "indicators_of_risk": [
      "Lost keys do not trigger a defined rekey decision process",
      "Access changes occur without updating locking arrangements"
    ],
    "common_failures": [
      "Rekey decisions made inconsistently without defined criteria",
      "No defined process to restore control after suspected key compromise"
    ],
    "mitigation_guidance": [
      "Define when rekeying is required and who authorizes the action",
      "Document how rekey actions are tracked and communicated to responsible personnel"
    ],
    "references": [
      "ASSA ABLOY: Key Control Design Guide",
      "ASSA ABLOY: Master Key System Design Guide"
    ]
  },

  "SFO_RESPONSE_PROCEDURES": {
    "overview": "Response procedures define how security personnel or designated staff respond to incidents requiring protective intervention, including roles and escalation actions.",
    "indicators_of_risk": [
      "Response actions vary by individual with no common procedure",
      "Escalation and handoff to responders is unclear during incidents"
    ],
    "common_failures": [
      "Incident response expectations not documented for common scenarios",
      "Roles for response, coordination, and reporting are unclear"
    ],
    "mitigation_guidance": [
      "Document response actions and responsibilities for protective intervention scenarios",
      "Define escalation, coordination, and reporting expectations during incident response"
    ],
    "references": [
      "ISC: Occupant Emergency Programs (2024 Edition)",
      "ISC: Facility Security Plan Guide"
    ]
  },

  "SMG_GOVERNANCE_OVERSIGHT": {
    "overview": "Governance and oversight define who owns physical security decisions and how security activities are reviewed to maintain accountability and consistency.",
    "indicators_of_risk": [
      "Security ownership is unclear or fragmented across departments",
      "Security decisions are inconsistent across areas or shifts"
    ],
    "common_failures": [
      "No accountable authority for physical security governance",
      "No defined oversight method for reviewing security posture and decisions"
    ],
    "mitigation_guidance": [
      "Assign responsibility for physical security governance and decision ownership",
      "Define oversight mechanisms for reviewing security decisions and posture"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "SMG_POLICY_COMPLIANCE_TRACKING": {
    "overview": "Policy compliance tracking addresses whether the facility has a method to verify adherence to security policies and identify corrective actions when gaps are found.",
    "indicators_of_risk": [
      "Policies exist but compliance is assumed rather than verified",
      "Recurring issues are identified only after incidents"
    ],
    "common_failures": [
      "No mechanism to check whether policies are followed",
      "Corrective actions not documented or not tracked to closure"
    ],
    "mitigation_guidance": [
      "Define how policy compliance is reviewed or assessed",
      "Document how findings and corrective actions are recorded and addressed"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Interagency Security Committee (ISC) Policy/Standards Guidance Portal"
    ]
  },

  "SMG_RISK_ASSESSMENT_RISK_MANAGEMENT": {
    "overview": "Risk assessment and management address whether threats, vulnerabilities, and consequences are evaluated and used to inform decisions about protective measures.",
    "indicators_of_risk": [
      "Protective measures added without documented risk rationale",
      "Risk decisions driven only by recent events or subjective judgment"
    ],
    "common_failures": [
      "Risk assessments performed once and not maintained as conditions change",
      "Risk outcomes not used to guide priorities for protective measures"
    ],
    "mitigation_guidance": [
      "Document how risk is assessed for threats, vulnerabilities, and impacts",
      "Use risk outcomes to inform decisions on protective measures and priorities"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "SMG_SECURITY_DOCUMENTATION": {
    "overview": "Security documentation covers whether security-relevant plans, procedures, and key decisions are recorded in a way that supports continuity, review, and accountability.",
    "indicators_of_risk": [
      "Security knowledge is held only by individuals rather than recorded",
      "Plans and procedures are not available during audits or incidents"
    ],
    "common_failures": [
      "Documentation is outdated, scattered, or not accessible to responsible staff",
      "Key decisions are not recorded, reducing continuity and accountability"
    ],
    "mitigation_guidance": [
      "Maintain centralized, accessible security documentation for key plans and procedures",
      "Ensure documentation is kept current and aligns to assigned responsibilities"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "SMG_SECURITY_PROCEDURES": {
    "overview": "Security procedures describe how security policies are carried out in day-to-day operations and during incidents, including roles and expected actions.",
    "indicators_of_risk": [
      "Security tasks are performed inconsistently across staff or shifts",
      "Personnel are unsure what actions are expected for routine security activities"
    ],
    "common_failures": [
      "Procedures are informal and vary by individual",
      "Procedures are not documented for common security activities"
    ],
    "mitigation_guidance": [
      "Document procedures supporting security policies for routine and incident operations",
      "Define roles and responsibilities for executing security procedures"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  },

  "VSS_SYSTEM_ARCHITECTURE": {
    "overview": "System architecture addresses whether the video surveillance system is intentionally structured so capture, transport, recording, and monitoring functions operate as a coordinated system.",
    "indicators_of_risk": [
      "Cameras and recording components added ad hoc without an overall design",
      "System dependencies and component relationships are not understood or documented"
    ],
    "common_failures": [
      "Video surveillance treated as standalone devices rather than an integrated system",
      "No documentation showing how cameras, recording, and monitoring are organized"
    ],
    "mitigation_guidance": [
      "Document how cameras, recording/storage, and monitoring functions are organized as a system",
      "Identify system boundaries and dependencies that affect surveillance capability"
    ],
    "references": [
      "ISC: Facility Security Plan Guide",
      "ISC: Occupant Emergency Programs (2024 Edition)"
    ]
  }
};

interface TaxonomySubtype {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
  guidance_required?: boolean;
  guidance?: {
    overview?: string;
    indicators_of_risk?: string[];
    common_failures?: string[];
    mitigation_guidance?: string[];
    standards_references?: string[];
    psa_notes?: string;
  };
}

interface TaxonomyData {
  metadata: {
    version: string;
    total_subtypes: number;
    generated_at: string;
    authority: string;
  };
  subtypes: TaxonomySubtype[];
}

interface PatchResult {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name: string;
  before: {
    has_overview: boolean;
    has_indicators: boolean;
    has_failures: boolean;
    has_mitigation: boolean;
    has_references: boolean;
  };
  after: {
    has_overview: boolean;
    has_indicators: boolean;
    has_failures: boolean;
    has_mitigation: boolean;
    has_references: boolean;
  };
}

function main() {
  console.log('=== Patch Heuristic Guidance Violations ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load taxonomy
  console.log(`Loading taxonomy from: ${TAXONOMY_FILE}`);
  if (!fs.existsSync(TAXONOMY_FILE)) {
    console.error(`❌ Taxonomy file not found: ${TAXONOMY_FILE}`);
    process.exit(1);
  }

  const taxonomyData: TaxonomyData = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
  console.log(`✓ Loaded ${taxonomyData.subtypes.length} subtypes\n`);

  // Build subtype map
  const subtypeMap = new Map<string, TaxonomySubtype>();
  for (const subtype of taxonomyData.subtypes) {
    subtypeMap.set(subtype.subtype_code, subtype);
  }

  // Track patch results
  const patchResults: PatchResult[] = [];
  let patchesApplied = 0;

  // Apply patches
  console.log(`Applying patches to ${Object.keys(GUIDANCE_PATCHES).length} subtypes...\n`);
  
  for (const [subtypeCode, patchGuidance] of Object.entries(GUIDANCE_PATCHES)) {
    const subtype = subtypeMap.get(subtypeCode);
    
    if (!subtype) {
      console.error(`⚠️  Subtype not found: ${subtypeCode}`);
      continue;
    }

    // Record before state
    const before = {
      has_overview: !!(subtype.guidance?.overview && subtype.guidance.overview.trim().length >= 40),
      has_indicators: !!(Array.isArray(subtype.guidance?.indicators_of_risk) && subtype.guidance.indicators_of_risk.length >= 2),
      has_failures: !!(Array.isArray(subtype.guidance?.common_failures) && subtype.guidance.common_failures.length >= 2),
      has_mitigation: !!(Array.isArray(subtype.guidance?.mitigation_guidance) && subtype.guidance.mitigation_guidance.length >= 2),
      has_references: !!(Array.isArray(subtype.guidance?.standards_references) && subtype.guidance.standards_references.length >= 2),
    };

    // Apply patch (merge with existing guidance, preserving psa_notes if present)
    if (!subtype.guidance) {
      subtype.guidance = {};
    }

    subtype.guidance.overview = patchGuidance.overview;
    subtype.guidance.indicators_of_risk = patchGuidance.indicators_of_risk;
    subtype.guidance.common_failures = patchGuidance.common_failures;
    subtype.guidance.mitigation_guidance = patchGuidance.mitigation_guidance;
    subtype.guidance.standards_references = patchGuidance.references;
    // Preserve psa_notes if it exists
    // (psa_notes is not in the patch, so we keep existing value)

    // Record after state
    const after = {
      has_overview: true,
      has_indicators: true,
      has_failures: true,
      has_mitigation: true,
      has_references: true,
    };

    patchResults.push({
      subtype_code: subtype.subtype_code,
      name: subtype.name,
      discipline_code: subtype.discipline_code,
      discipline_name: subtype.discipline_name,
      before,
      after,
    });

    patchesApplied++;
    console.log(`✓ Patched: ${subtypeCode} (${subtype.name})`);
  }

  console.log(`\n✓ Applied ${patchesApplied} patches\n`);

  // Write updated taxonomy (preserve order, deterministic formatting)
  fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(taxonomyData, null, 2) + '\n', 'utf-8');
  console.log(`✓ Taxonomy file updated: ${TAXONOMY_FILE}`);

  // Write patch JSON
  const patchData = {
    applied_at: new Date().toISOString(),
    patches_applied: patchesApplied,
    expected_patches: Object.keys(GUIDANCE_PATCHES).length,
    results: patchResults,
  };
  fs.writeFileSync(PATCH_JSON, JSON.stringify(patchData, null, 2), 'utf-8');
  console.log(`✓ Patch JSON written: ${PATCH_JSON}`);

  // Generate markdown report
  const mdLines: string[] = [
    '# Guidance Patch Report: Heuristic Violations',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Patches Applied:** ${patchesApplied} / ${Object.keys(GUIDANCE_PATCHES).length}`,
    '',
    '## Summary',
    '',
    `- **Subtypes Patched:** ${patchesApplied}`,
    `- **Expected:** ${Object.keys(GUIDANCE_PATCHES).length}`,
    '',
    '## Patch Details',
    '',
  ];

  // Sort by discipline_code then subtype_code
  patchResults.sort((a, b) => {
    const discCompare = a.discipline_code.localeCompare(b.discipline_code);
    if (discCompare !== 0) return discCompare;
    return a.subtype_code.localeCompare(b.subtype_code);
  });

  for (const result of patchResults) {
    mdLines.push(`### ${result.name} (\`${result.subtype_code}\`)`);
    mdLines.push('');
    mdLines.push(`**Discipline:** ${result.discipline_code} - ${result.discipline_name}`);
    mdLines.push('');
    mdLines.push('**Before:**');
    mdLines.push(`- Overview: ${result.before.has_overview ? '✅' : '❌'}`);
    mdLines.push(`- Indicators of Risk: ${result.before.has_indicators ? '✅' : '❌'}`);
    mdLines.push(`- Common Failures: ${result.before.has_failures ? '✅' : '❌'}`);
    mdLines.push(`- Mitigation Guidance: ${result.before.has_mitigation ? '✅' : '❌'}`);
    mdLines.push(`- References: ${result.before.has_references ? '✅' : '❌'}`);
    mdLines.push('');
    mdLines.push('**After:**');
    mdLines.push(`- Overview: ${result.after.has_overview ? '✅' : '❌'}`);
    mdLines.push(`- Indicators of Risk: ${result.after.has_indicators ? '✅' : '❌'}`);
    mdLines.push(`- Common Failures: ${result.after.has_failures ? '✅' : '❌'}`);
    mdLines.push(`- Mitigation Guidance: ${result.after.has_mitigation ? '✅' : '❌'}`);
    mdLines.push(`- References: ${result.after.has_references ? '✅' : '❌'}`);
    mdLines.push('');
  }

  // Run validator to confirm
  mdLines.push('## Validation Check', '');
  mdLines.push('Running heuristic validator to confirm patches...', '');
  mdLines.push('');

  try {
    const validatorOutput = execSync(
      'npx tsx tools/validate_subtype_guidance.ts --mode=heuristic',
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    mdLines.push('```');
    mdLines.push(validatorOutput);
    mdLines.push('```');
    mdLines.push('');

    // Parse validator output
    if (validatorOutput.includes('✅ Validation passed!')) {
      mdLines.push('**Status:** ✅ **PASS** - All heuristic violations resolved!');
    } else if (validatorOutput.includes('❌ Validation failed!')) {
      mdLines.push('**Status:** ❌ **FAIL** - Some violations remain. Check validator output above.');
    } else {
      mdLines.push('**Status:** ⚠️ **UNKNOWN** - Could not determine validation status.');
    }
  } catch (error: any) {
    mdLines.push('**Error running validator:**');
    mdLines.push('```');
    mdLines.push(error.message || String(error));
    mdLines.push('```');
    mdLines.push('');
    mdLines.push('⚠️ **Warning:** Could not run validation check. Please run manually:');
    mdLines.push('```bash');
    mdLines.push('npx tsx tools/validate_subtype_guidance.ts --mode=heuristic');
    mdLines.push('```');
  }

  fs.writeFileSync(PATCH_REPORT, mdLines.join('\n'), 'utf-8');
  console.log(`✓ Patch report written: ${PATCH_REPORT}\n`);

  // Run validator and show summary
  console.log('=== Running Validation Check ===\n');
  try {
    const validatorOutput = execSync(
      'npx tsx tools/validate_subtype_guidance.ts --mode=heuristic',
      { encoding: 'utf-8', cwd: process.cwd(), stdio: 'inherit' }
    );
  } catch (error: any) {
    console.error('\n⚠️  Validator exited with non-zero code. Check output above.');
    process.exit(1);
  }

  console.log('\n✅ Patch complete!');
}

main();
