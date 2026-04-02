const fs = require('fs');
const path = require('path');

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

const CYBER_TERMS = [
  'encryption', '2fa', 'two-factor', 'authentication', 'authenticate', 'network traffic', 'monitor network',
  'api', 'malware', 'ransomware', 'breach', 'cyber', 'intrusion'
];
const FRAUD_TERMS = ['skimming', 'payment', 'transaction', 'fraud', 'identity theft', 'card', 'chargeback'];

function classifyDriver(vuln, impact, opt) {
  const blob = `${vuln} ${impact} ${opt}`.toLowerCase();
  if (FRAUD_TERMS.some(t => blob.includes(t))) {
    return 'FRAUD_DRIVER';
  }
  if (CYBER_TERMS.some(t => blob.includes(t))) {
    return 'CYBER_DRIVER';
  }
  return '';
}

function makeModOfcId(n) {
  return `MOD_OFC_EV_CHARGING_${String(n).padStart(3, '0')}`;
}

function makeModQId(n) {
  return `MODULEQ_EV_CHARGING_${String(n).padStart(3, '0')}`;
}

// Discipline UUIDs from get_discipline_uuids_for_modules.js output
const DISCIPLINES = {
  ACS: {
    discipline_id: '18d45ffa-6a44-4817-becb-828231b9e1e7',
    subtypes: {
      ELECTRONIC_ACCESS_CONTROL: '3227ab36-7f31-4be4-a0c2-0f838518fa96',
      LOCKING_HARDWARE: '95f8b59e-2a85-4ef6-986a-dd702310d445'
    }
  },
  VSS: {
    discipline_id: '83d34bf8-b228-49ca-abb9-66168d4a8681',
    subtypes: {
      EXTERIOR_CAMERAS: '8317b7c8-633e-46ca-8914-319e0cbab9cd',
      MONITORING_WORKSTATIONS: '6b36053e-e5c0-4da8-a272-01330311f7fd'
    }
  },
  EMR: {
    discipline_id: 'a295aed8-a841-41b0-b893-a8a018867b83',
    subtypes: {
      EMERGENCY_COMMUNICATIONS: '03e40c3c-6b9d-4c23-8926-8fa0864ac8ab',
      RESILIENCE_PLANNING: 'ae65413f-ef25-469c-bb60-867450f09d5e'
    }
  },
  SMG: {
    discipline_id: 'ecfc1d4f-873b-4645-93e5-a9812ed779c3',
    subtypes: {
      SECURITY_PROCEDURES: '09c4723a-5665-4661-a699-18f0ef3803a1',
      SECURITY_DOCUMENTATION: 'bedba7d7-6ba3-48da-8ea8-5e48d20f09f4'
    }
  }
};

const moduleQuestions = [
  {
    id: makeModQId(1),
    text: 'Is physical access to EV charging equipment components (e.g., enclosures, service panels, cabinets) restricted to authorized personnel?',
    order: 1,
    discipline_id: DISCIPLINES.ACS.discipline_id,
    discipline_subtype_id: DISCIPLINES.ACS.subtypes.ELECTRONIC_ACCESS_CONTROL,
    asset_or_location: 'EV charging equipment components',
    event_trigger: 'TAMPERING'
  },
  {
    id: makeModQId(2),
    text: 'Is video coverage implemented for EV charging stations and their immediate approaches to support incident detection and post-incident review?',
    order: 2,
    discipline_id: DISCIPLINES.VSS.discipline_id,
    discipline_subtype_id: DISCIPLINES.VSS.subtypes.EXTERIOR_CAMERAS,
    asset_or_location: 'EV charging stations',
    event_trigger: 'TAMPERING'
  },
  {
    id: makeModQId(3),
    text: 'Is adequate lighting implemented at EV charging station locations to support visibility during hours of darkness?',
    order: 3,
    discipline_id: DISCIPLINES.VSS.discipline_id,
    discipline_subtype_id: DISCIPLINES.VSS.subtypes.EXTERIOR_CAMERAS,
    asset_or_location: 'EV charging station locations',
    event_trigger: 'TAMPERING'
  },
  {
    id: makeModQId(4),
    text: 'Is a user-accessible method provided to request assistance or report an emergency at EV charging station locations?',
    order: 4,
    discipline_id: DISCIPLINES.EMR.discipline_id,
    discipline_subtype_id: DISCIPLINES.EMR.subtypes.EMERGENCY_COMMUNICATIONS,
    asset_or_location: 'EV charging station locations',
    event_trigger: 'OTHER'
  },
  {
    id: makeModQId(5),
    text: 'Is there a documented process to inspect EV charging stations for damage, tampering indicators, and unsafe conditions?',
    order: 5,
    discipline_id: DISCIPLINES.SMG.discipline_id,
    discipline_subtype_id: DISCIPLINES.SMG.subtypes.SECURITY_PROCEDURES,
    asset_or_location: 'EV charging stations',
    event_trigger: 'TAMPERING'
  },
  {
    id: makeModQId(6),
    text: 'Are EV charging cables and connectors managed and maintained to reduce tampering opportunities and physical safety hazards?',
    order: 6,
    discipline_id: DISCIPLINES.SMG.discipline_id,
    discipline_subtype_id: DISCIPLINES.SMG.subtypes.SECURITY_PROCEDURES,
    asset_or_location: 'EV charging cables and connectors',
    event_trigger: 'TAMPERING'
  },
  {
    id: makeModQId(7),
    text: 'Are responsibilities defined for coordinating with site management or service providers to restore safe operation following damage or disruption at EV charging station locations?',
    order: 7,
    discipline_id: DISCIPLINES.EMR.discipline_id,
    discipline_subtype_id: DISCIPLINES.EMR.subtypes.RESILIENCE_PLANNING,
    asset_or_location: 'EV charging station locations',
    event_trigger: 'OUTAGE'
  }
];

const inPath = path.join(__dirname, '..', 'analytics', 'extracted', 'ev_charging_vuln.json');
const outPath = path.join(__dirname, '..', 'analytics', 'extracted', 'module_ev_charging_import.json');

if (!fs.existsSync(inPath)) {
  console.error(`ERROR: Input file not found: ${inPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const root = data.Electric_Vehicle_Charging || {};
const vulns = root.vulnerabilities || [];

const moduleOfcs = [];
const riskDrivers = [];

let ofcSeq = 1;
for (let vi = 0; vi < vulns.length; vi++) {
  const v = vulns[vi];
  const vuln = norm(v.vulnerability || '');
  const impact = norm(v.possible_impact || '');
  const opts = v.options_for_consideration || [];

  for (let oi = 0; oi < opts.length; oi++) {
    const o = opts[oi];
    const opt = norm(o.option || '');
    const ref = norm(o.reference || '');
    const locator = {
      vulnerability_index: vi,
      option_index: oi,
      vulnerability: vuln
    };

    const driverType = classifyDriver(vuln, impact, opt);
    if (driverType) {
      riskDrivers.push({
        driver_type: driverType,
        driver_text: vuln,
        impact: impact,
        example: opt,
        reference: ref,
        source_locator: locator
      });
      continue;
    }

    const ofcId = makeModOfcId(ofcSeq);
    ofcSeq++;

    let ofcText = opt;
    if (impact) {
      ofcText = `${opt} Addresses: ${impact}`;
    }

    moduleOfcs.push({
      ofc_id: ofcId,
      ofc_text: ofcText,
      order_index: moduleOfcs.length + 1,
      source_system: 'VULN_JSON',
      source_ofc_id: null,
      source_ofc_num: null,
      source_locator: locator,
      sources: ref ? [{ url: '', label: ref }] : []
    });
  }
}

const payload = {
  module_code: 'MODULE_EV_CHARGING',
  title: 'EV Charging Stations',
  description: 'Optional module to assess EV charging station physical security, safety interfaces, and operational integration.',
  import_source: 'ev_charging_vuln.json',
  mode: 'REPLACE',
  module_questions: moduleQuestions,
  module_ofcs: moduleOfcs,
  risk_drivers: riskDrivers
};

const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

console.log(`[OK] wrote ${outPath}`);
console.log(`[OK] module_questions: ${moduleQuestions.length}`);
console.log(`[OK] module_ofcs: ${moduleOfcs.length}`);
console.log(`[OK] risk_drivers: ${riskDrivers.length}`);
