import type { Assessment } from 'schema';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';
import { normalizeTransportPhysical } from '@/app/lib/assessment/normalize_transport_physical';
import { migrateReportThemedFindingsFromCategories } from '@/app/lib/assessment/migrate_report_themed_findings';

/** Ensure assessment data is normalized and stripped of legacy curve fields before serialization. */
export function sanitizeAssessmentBeforeSave(assessment: Assessment): Assessment {
  migrateReportThemedFindingsFromCategories(assessment);
  return normalizeTransportPhysical(normalizeCurveStorage(assessment));
}
