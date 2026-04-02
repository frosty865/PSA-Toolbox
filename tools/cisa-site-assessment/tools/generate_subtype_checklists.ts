/**
 * Generate Subtype Checklists
 * 
 * Generates deterministic capability checklists for technology-heavy subtypes.
 * These checklists drive branching questions when Depth-1 spine = YES.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SubtypeChecklist, SubtypeChecklistsFile, ChecklistItem } from '../app/lib/types/checklist';

const TAXONOMY_FILE = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'subtype_checklists.v1.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'checklist_review.v1.md');

interface TaxonomySubtype {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name: string;
}

interface TaxonomyData {
  subtypes?: TaxonomySubtype[];
}

/**
 * Technology-heavy disciplines and subtypes that get checklists
 */
const TECHNOLOGY_HEAVY_DISCIPLINES = new Set(['ACS', 'IDS', 'VSS', 'COM']);
const TECHNOLOGY_HEAVY_SUBTYPES = new Set([
  // PER subtypes (select)
  'PER_FENCING',
  'PER_GATES_BARRIERS',
  'PER_LIGHTING',
  // KEY subtypes (select)
  'KEY_ELECTRONIC_KEY_MANAGEMENT',
  'KEY_PHYSICAL_KEY_CONTROL',
]);

/**
 * Deterministic checklist templates by subtype_code
 */
function getChecklistTemplate(subtypeCode: string, subtypeName: string): ChecklistItem[] {
  const code = subtypeCode.toUpperCase();

  // ACS_BIOMETRIC_ACCESS
  if (code === 'ACS_BIOMETRIC_ACCESS') {
    return [
      {
        id: 'biometric_modalities',
        label: 'Modalities in use',
        description: 'One or more biometric modalities (fingerprint, facial, iris, voice) are deployed',
        tags: ['BIOMETRIC_MODALITIES'],
      },
      {
        id: 'biometric_enrollment',
        label: 'Enrollment & identity proofing method exists',
        description: 'A defined method exists for enrolling users and verifying identity during enrollment',
        tags: ['BIOMETRIC_ENROLLMENT'],
      },
      {
        id: 'biometric_data_handling',
        label: 'Data handling policy exists',
        description: 'A defined method exists for storing, retaining, and protecting biometric data',
        tags: ['HANDLING_POLICY'],
      },
      {
        id: 'biometric_backup',
        label: 'Backup authentication method exists',
        description: 'A defined method exists for access when biometric systems fail or users cannot use biometrics',
        tags: ['BACKUP_METHOD'],
      },
      {
        id: 'biometric_device_upkeep',
        label: 'Device upkeep method exists',
        description: 'A defined method exists to keep readers and sensors usable and accurate',
        tags: ['DEVICE_USABILITY_METHOD'],
      },
    ];
  }

  // ACS_ELECTRONIC_ACCESS_CONTROL
  if (code === 'ACS_ELECTRONIC_ACCESS_CONTROL') {
    return [
      {
        id: 'eac_credential_issuance',
        label: 'Credential issuance/termination method exists',
        description: 'A defined method exists for issuing and terminating access credentials',
        tags: ['CREDENTIAL_ISSUANCE'],
      },
      {
        id: 'eac_door_integration',
        label: 'Door hardware integration exists',
        description: 'Electronic access control integrates with door hardware (strikes, mag locks, readers)',
        tags: ['DOOR_INTEGRATION'],
      },
      {
        id: 'eac_alarm_monitoring',
        label: 'Alarm/door events monitoring method exists',
        description: 'A defined method exists to monitor and respond to door alarms and access events',
        tags: ['ALARM_MONITORING'],
      },
      {
        id: 'eac_visitor_handling',
        label: 'Visitor handling method exists',
        description: 'A defined method exists for managing visitor access and temporary credentials',
        tags: ['VISITOR_HANDLING'],
      },
    ];
  }

  // VSS_RECORDING_STORAGE_NVR_DVR
  if (code === 'VSS_RECORDING_STORAGE_NVR_DVR' || code.includes('RECORDING') || code.includes('STORAGE')) {
    return [
      {
        id: 'vss_recording_retention',
        label: 'Recording retention method exists',
        description: 'A defined method exists for how long recordings are retained',
        tags: ['VSS_RECORDING_HANDLING'],
      },
      {
        id: 'vss_export_retrieval',
        label: 'Export/retrieval method exists',
        description: 'A defined method exists for exporting and retrieving recorded footage',
        tags: ['VSS_RECORDING_HANDLING'],
      },
      {
        id: 'vss_storage_capacity',
        label: 'Storage capacity planning method exists',
        description: 'A defined method exists for planning and managing storage capacity',
        tags: ['VSS_STORAGE_PLANNING'],
      },
    ];
  }

  // IDS_ALARM_MONITORING
  if (code === 'IDS_ALARM_MONITORING' || (code.startsWith('IDS_') && code.includes('ALARM'))) {
    return [
      {
        id: 'ids_alarm_receiving',
        label: 'Alarm receiving method exists',
        description: 'A defined method exists for receiving alarms from intrusion detection sensors',
        tags: ['IDS_MONITORING_ESCALATION'],
      },
      {
        id: 'ids_notification_escalation',
        label: 'Notification/escalation method exists',
        description: 'A defined method exists for notifying and escalating alarm events',
        tags: ['IDS_MONITORING_ESCALATION'],
      },
      {
        id: 'ids_response_dispatch',
        label: 'Response dispatch method exists',
        description: 'A defined method exists for dispatching response personnel to alarm events',
        tags: ['IDS_MONITORING_ESCALATION'],
      },
    ];
  }

  // COM_PAGING_SYSTEMS
  if (code === 'COM_PAGING_SYSTEMS' || code.includes('PAGING')) {
    return [
      {
        id: 'com_override_priority',
        label: 'Override/priority method exists',
        description: 'A defined method exists for emergency override and priority paging',
        tags: ['COM_OVERRIDE_PRIORITY'],
      },
      {
        id: 'com_interop',
        label: 'Interoperability method exists',
        description: 'A defined method exists for interoperable communication with other systems',
        tags: ['COM_INTEROP_METHOD'],
      },
    ];
  }

  // COM_RADIO_SYSTEMS
  if (code.includes('RADIO') || code.includes('COMMUNICATION')) {
    return [
      {
        id: 'com_radio_channels',
        label: 'Channel management method exists',
        description: 'A defined method exists for managing radio channels and frequencies',
        tags: ['COM_INTEROP_METHOD'],
      },
      {
        id: 'com_radio_interop',
        label: 'Interoperability method exists',
        description: 'A defined method exists for interoperable communication with other agencies/systems',
        tags: ['COM_INTEROP_METHOD'],
      },
    ];
  }

  // PER subtypes
  if (code.startsWith('PER_')) {
    if (TECHNOLOGY_HEAVY_SUBTYPES.has(code)) {
      return [
        {
          id: `${code.toLowerCase()}_maintenance`,
          label: 'Maintenance method exists',
          description: 'A defined method exists for maintaining and inspecting perimeter systems',
          tags: ['PER_MAINTENANCE'],
        },
        {
          id: `${code.toLowerCase()}_monitoring`,
          label: 'Monitoring method exists',
          description: 'A defined method exists for monitoring perimeter system status',
          tags: ['PER_MONITORING'],
        },
      ];
    }
  }

  // KEY subtypes
  if (code.startsWith('KEY_')) {
    if (TECHNOLOGY_HEAVY_SUBTYPES.has(code)) {
      return [
        {
          id: `${code.toLowerCase()}_issuance`,
          label: 'Issuance/return method exists',
          description: 'A defined method exists for issuing and returning keys',
          tags: ['KEY_ISSUANCE'],
        },
        {
          id: `${code.toLowerCase()}_tracking`,
          label: 'Tracking method exists',
          description: 'A defined method exists for tracking key assignments and locations',
          tags: ['KEY_TRACKING'],
        },
      ];
    }
  }

  // Default: empty checklist for non-technology subtypes
  return [];
}

/**
 * Main function
 */
function main(): void {
  console.log('[INFO] Generating subtype checklists...\n');

  // Load taxonomy
  if (!fs.existsSync(TAXONOMY_FILE)) {
    console.error(`[ERROR] Taxonomy file not found: ${TAXONOMY_FILE}`);
    process.exit(1);
  }

  const taxonomyContent = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const taxonomyData: TaxonomyData = JSON.parse(taxonomyContent);
  const subtypes = taxonomyData.subtypes || [];

  console.log(`[INFO] Loaded ${subtypes.length} subtypes from taxonomy`);

  // Generate checklists
  const checklists: SubtypeChecklist[] = [];

  for (const subtype of subtypes) {
    const items = getChecklistTemplate(subtype.subtype_code, subtype.name);
    
    checklists.push({
      version: '1.0',
      subtype_code: subtype.subtype_code,
      discipline_code: subtype.discipline_code,
      title: `${subtype.name} Capabilities`,
      items: items,
    });
  }

  // Create output file
  const output: SubtypeChecklistsFile = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    checklists: checklists.sort((a, b) => a.subtype_code.localeCompare(b.subtype_code)),
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2) + '\n');
  console.log(`[INFO] Wrote ${checklists.length} checklists to ${OUTPUT_JSON}`);

  // Generate review markdown
  let md = '# Subtype Checklists Review\n\n';
  md += `Generated: ${output.generated_at}\n\n`;
  md += `Total checklists: ${checklists.length}\n\n`;

  for (const checklist of checklists) {
    if (checklist.items.length === 0) {
      continue; // Skip empty checklists in review
    }

    md += `## ${checklist.subtype_code} - ${checklist.title}\n\n`;
    md += `**Discipline:** ${checklist.discipline_code}\n\n`;

    for (let i = 0; i < checklist.items.length; i++) {
      const item = checklist.items[i];
      md += `${i + 1}. **${item.label}** (ID: \`${item.id}\`)\n`;
      md += `   - Description: ${item.description}\n`;
      md += `   - Tags: ${item.tags.join(', ')}\n\n`;
    }
  }

  fs.writeFileSync(OUTPUT_MD, md);
  console.log(`[INFO] Wrote review markdown to ${OUTPUT_MD}`);

  // Summary
  const withChecklists = checklists.filter(c => c.items.length > 0).length;
  console.log('');
  console.log(`[INFO] Summary:`);
  console.log(`  - Total subtypes: ${checklists.length}`);
  console.log(`  - Subtypes with checklists: ${withChecklists}`);
  console.log(`  - Subtypes without checklists: ${checklists.length - withChecklists}`);
  console.log('');
  console.log('[INFO] Checklist generation complete!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { getChecklistTemplate, TECHNOLOGY_HEAVY_DISCIPLINES, TECHNOLOGY_HEAVY_SUBTYPES };
