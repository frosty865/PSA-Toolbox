/**
 * Validate export payload invariants against a dumped JSON file.
 * Use with payloads dumped when ADA_EXPORT_DEBUG_DUMP=1 (see .debug/export_payload_<timestamp>.json).
 *
 * Usage: npx ts-node scripts/validate_export_payload.ts <path-to-dumped.json>
 * Exit 0 on pass; throws Error with clear message on failure.
 */

import fs from 'fs/promises';
import path from 'path';

const FORBIDDEN_IT_STRINGS = ['Not documented', 'not documented'];

interface Part2Vulnerability {
  id?: string;
  title?: string;
  narrative?: string;
  ofcs?: unknown[];
  references?: unknown[];
}

interface InternetTransportRow {
  role?: string;
  provider?: string;
  demarcation?: string;
  independence?: string;
  notes?: string;
}

interface Dump {
  report_vm?: { part2?: { vulnerabilities?: Part2Vulnerability[]; internet_transport_rows?: InternetTransportRow[] } };
  vulnerability_blocks?: string;
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error('Usage: npx ts-node scripts/validate_export_payload.ts <path-to-dumped.json>');
  }
  const resolved = path.resolve(dumpPath);
  const raw = await fs.readFile(resolved, 'utf8');
  const data = JSON.parse(raw) as Dump;

  const part2 = data.report_vm?.part2;
  const vulns = part2?.vulnerabilities;
  const itRows = part2?.internet_transport_rows;

  // (a) When template requires [[VULNERABILITY_BLOCKS]], structured vulns must exist and be non-empty if present
  if (Array.isArray(vulns) && vulns.length === 0 && typeof data.vulnerability_blocks !== 'string') {
    throw new Error(
      'report_vm.part2.vulnerabilities is an empty array and no legacy vulnerability_blocks string; template requiring [[VULNERABILITY_BLOCKS]] would have nothing to render.'
    );
  }

  // (b) For every Part2 vulnerability: title non-empty, narrative non-empty, ofcs array length >= 1 (unless 0 OFCs allowed and reporter skips OFC heading)
  if (Array.isArray(vulns)) {
    for (let i = 0; i < vulns.length; i++) {
      const v = vulns[i];
      const title = v?.title != null ? String(v.title).trim() : '';
      const narrative = v?.narrative != null ? String(v.narrative).trim() : '';
      if (!title) {
        throw new Error(`report_vm.part2.vulnerabilities[${i}]: title is empty or missing.`);
      }
      if (!narrative) {
        throw new Error(`report_vm.part2.vulnerabilities[${i}]: narrative is empty or missing.`);
      }
      const ofcs = Array.isArray(v?.ofcs) ? v.ofcs : [];
      if (ofcs.length === 0) {
        // Allowed: reporter must not render "Options for Consideration" heading for this vuln.
        continue;
      }
      if (ofcs.length > 4) {
        throw new Error(
          `report_vm.part2.vulnerabilities[${i}]: ofcs must have at most 4 items, got length ${ofcs.length}.`
        );
      }
    }
  }

  // (c) IT Internet Transport rows: role/provider present; demarcation/independence must NOT inject "Not documented"
  if (Array.isArray(itRows)) {
    for (let i = 0; i < itRows.length; i++) {
      const row = itRows[i];
      const role = row?.role != null ? String(row.role).trim() : '';
      const provider = row?.provider != null ? String(row.provider).trim() : '';
      if (!role && !provider) {
        throw new Error(`report_vm.part2.internet_transport_rows[${i}]: role and provider are both missing or empty.`);
      }
      const demarc = row?.demarcation != null ? String(row.demarcation) : '';
      const indep = row?.independence != null ? String(row.independence) : '';
      for (const forbidden of FORBIDDEN_IT_STRINGS) {
        if (demarc.includes(forbidden) || indep.includes(forbidden)) {
          throw new Error(
            `report_vm.part2.internet_transport_rows[${i}]: demarcation/independence must not contain "${forbidden}" (use "Not provided" or real values).`
          );
        }
      }
    }
  }

  console.log('Payload validation passed.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
