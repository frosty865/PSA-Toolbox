/**
 * Generate sample_export.json for truth_diff harness. Run from apps/web: tsx scripts/fixtures/generate_sample_export.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildReportThemedFindingsForExport } from '../../app/lib/export/build_report_themed_findings';
import { buildSessionsDerivedFromAssessment } from '../../app/lib/export/build_report_themed_findings';
import { buildCanonicalVulnBlocks } from '../../app/lib/export/canonical_vuln_blocks';
import type { Assessment } from 'schema';

const assessment: Assessment = {
  meta: {
    tool_version: '0.1.0',
    template_version: '1',
    created_at_iso: new Date().toISOString(),
  },
  asset: {
    asset_name: 'Sample Facility',
    visit_date_iso: new Date().toISOString().slice(0, 10),
  },
  categories: {
    ELECTRIC_POWER: {},
    COMMUNICATIONS: {},
    INFORMATION_TECHNOLOGY: {
      it_transport_resilience: {
        transport_connection_count: 2,
        transport_building_entry_diversity: 'SAME_ENTRY',
        transport_route_independence: 'UNKNOWN',
        transport_failover_mode: 'UNKNOWN',
      },
      it_hosted_resilience: { aws: { survivability: 'NO_CONTINUITY' } },
      'IT-2_upstream_assets': [{ service_id: 'aws' }],
    },
    WATER: {},
    WASTEWATER: {},
  },
};

process.env.REPORT_ALLOW_UNMAPPED_KEYS = 'true';
buildReportThemedFindingsForExport(assessment);
const sessions = buildSessionsDerivedFromAssessment(assessment);
const { canonicalVulnBlocks, canonicalTotals } = buildCanonicalVulnBlocks(assessment, sessions);
(assessment as Record<string, unknown>).sessions = sessions;

const payload = {
  assessment,
  canonicalVulnBlocks,
  canonicalTotals,
};

const outPath = path.join(__dirname, 'sample_export.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log('Wrote', outPath, 'with', canonicalVulnBlocks.length, 'vuln blocks');
