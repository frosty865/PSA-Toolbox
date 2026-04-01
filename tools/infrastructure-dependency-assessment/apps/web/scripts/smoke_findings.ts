/**
 * Smoke test: themed findings and knowledge gaps appear as expected, counts within limits.
 * Run: pnpm -C apps/web run smoke:findings
 */
import { resolveThemedFindings } from '../app/lib/dependencies/vulnerabilities/resolveThemes';
import { resolveKnowledgeGaps } from '../app/lib/dependencies/knowledge_gaps/resolveGaps';

type DepCategory = 'ENERGY' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';

const THEME_LIMITS: Record<string, number> = {
  COMMUNICATIONS: 3,
  INFORMATION_TECHNOLOGY: 3,
  ENERGY: 3,
  WATER: 2,
  WASTEWATER: 2,
};

const GAP_LIMIT = 6;

/** Minimal answers that trigger at least one finding per dependency. */
const MINIMAL_ANSWERS: Record<string, Record<string, unknown>> = {
  ENERGY: { 'E-8_backup_power_available': 'no' },
  COMMUNICATIONS: { 'CO-1_can_identify_providers': 'no' },
  INFORMATION_TECHNOLOGY: { 'IT-1_can_identify_providers': 'no' },
  WATER: { W_Q8_alternate_source: 'no' },
  WASTEWATER: { WW_Q6_priority_restoration: 'no' },
};

/** Answers that trigger knowledge gaps. */
const GAP_ANSWERS: Record<string, Record<string, unknown>> = {
  ENERGY: { 'E-8_backup_power_available': 'yes', 'E-9_refuel_sustainment_established': 'unknown' },
  COMMUNICATIONS: { 'CO-1_can_identify_providers': 'no' },
  INFORMATION_TECHNOLOGY: { 'IT-1_can_identify_providers': 'unknown' },
  WATER: { W_Q8_alternate_source: 'yes', W_Q9_alternate_supports_core: 'unknown' },
  WASTEWATER: { WW_Q7_contingency_plan: 'no' },
};

function main(): number {
  let failed = 0;

  const cats: DepCategory[] = ['ENERGY', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'];
  for (const cat of cats) {
    const limit = THEME_LIMITS[cat];
    const answers = MINIMAL_ANSWERS[cat] ?? {};
    const themes = resolveThemedFindings({ category: cat, answers, praSlaEnabled: true });
    if (themes.length === 0) {
      console.error(`[smoke_findings] FAIL: ${cat} has 0 themed findings with minimal trigger`);
      failed++;
    } else if (themes.length > limit) {
      console.error(`[smoke_findings] FAIL: ${cat} themes ${themes.length} exceeds limit ${limit}`);
      failed++;
    } else {
      console.log(`[smoke_findings] OK: ${cat} themes ${themes.length} (limit ${limit})`);
    }
  }

  for (const cat of cats) {
    const answers = GAP_ANSWERS[cat] ?? {};
    const gaps = resolveKnowledgeGaps({ category: cat, answers });
    if (gaps.length > GAP_LIMIT) {
      console.error(`[smoke_findings] FAIL: ${cat} knowledge gaps ${gaps.length} exceeds limit ${GAP_LIMIT}`);
      failed++;
    } else {
      console.log(`[smoke_findings] OK: ${cat} gaps ${gaps.length} (limit ${GAP_LIMIT})`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('[smoke_findings] All assertions passed.');
  return 0;
}

main();
