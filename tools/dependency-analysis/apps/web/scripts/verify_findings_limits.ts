/**
 * Theme/Gaps guards: assert limits on structural findings and knowledge gaps.
 */
type DepCategory = 'ENERGY' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';

import { resolveCommsThemes } from '../app/lib/dependencies/vulnerabilities/theme_combiners/comms';
import { resolveItThemes } from '../app/lib/dependencies/vulnerabilities/theme_combiners/it';
import { resolveEnergyThemes } from '../app/lib/dependencies/vulnerabilities/theme_combiners/energy';
import { resolveWaterThemes } from '../app/lib/dependencies/vulnerabilities/theme_combiners/water';
import { resolveWastewaterThemes } from '../app/lib/dependencies/vulnerabilities/theme_combiners/wastewater';
import { resolveKnowledgeGaps } from '../app/lib/dependencies/knowledge_gaps/resolveGaps';

/** Answers that trigger all themes for each dependency. */
const TRIGGER_ALL_THEMES: Record<string, Record<string, unknown>> = {
  COMMUNICATIONS: {
    'CO-1_can_identify_providers': 'no',
    'CO-3_multiple_connections': 'no',
    'CO-4_physically_separated': 'no',
    'CO-8_backup_available': 'no',
    'CO-9_sustainment_plan': 'unknown',
  },
  INFORMATION_TECHNOLOGY: {
    'IT-1_can_identify_providers': 'no',
    'IT-3_multiple_connections': 'yes',
    'IT-8_backup_available': 'no',
    'it_continuity_plan_exists': 'yes',
    'it_plan_exercised': 'no',
  },
  ENERGY: {
    'E-3_more_than_one_connection': 'yes',
    'E-8_backup_power_available': 'yes',
    'E-9_refuel_sustainment_established': 'no',
    'E-10_tested_under_load': 'no',
  },
  WATER: {
    W_Q6_priority_restoration: 'no',
    W_Q8_alternate_source: 'no',
  },
  WASTEWATER: {
    WW_Q6_priority_restoration: 'no',
  },
};

/** Answers that trigger all knowledge gaps for each dependency. */
const TRIGGER_ALL_GAPS: Record<string, Record<string, unknown>> = {
  ENERGY: {
    'E-8_backup_power_available': 'yes',
    'E-9_refuel_sustainment_established': 'unknown',
    'E-10_tested_under_load': undefined,
  },
  COMMUNICATIONS: {
    'CO-1_can_identify_providers': 'no',
    'CO-4_physically_separated': 'unknown',
    'CO-8_backup_available': 'yes',
    'CO-9_sustainment_plan': 'unknown',
    'CO-11_restoration_coordination': 'unknown',
  },
  INFORMATION_TECHNOLOGY: {
    'IT-1_can_identify_providers': 'no',
    'IT-2_can_identify_assets': 'unknown',
    'IT-3_multiple_connections': 'unknown',
    'IT-8_backup_available': 'unknown',
    'IT-9_sustainment_plan': 'unknown',
    'it_continuity_plan_exists': 'yes',
    'it_plan_exercised': 'no',
  },
  WATER: {
    W_Q8_alternate_source: 'yes',
    W_Q9_alternate_supports_core: 'unknown',
    W_Q7_contingency_plan: 'unknown',
  },
  WASTEWATER: {
    WW_Q7_contingency_plan: 'no',
  },
};

const THEME_LIMITS: Record<string, number> = {
  COMMUNICATIONS: 3,
  INFORMATION_TECHNOLOGY: 3,
  ENERGY: 3,
  WATER: 2,
  WASTEWATER: 2,
};

const GAP_LIMIT = 6;

function main(): number {
  let failed = 0;

  const themeCats: DepCategory[] = ['ENERGY', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'];
  for (const cat of themeCats) {
    const limit = THEME_LIMITS[cat];
    const answers = TRIGGER_ALL_THEMES[cat] ?? {};
    let themes: unknown[] = [];
    const input = { category: cat, answers };
    if (cat === 'COMMUNICATIONS') themes = resolveCommsThemes(input);
    else if (cat === 'INFORMATION_TECHNOLOGY') themes = resolveItThemes(input);
    else if (cat === 'ENERGY') themes = resolveEnergyThemes(input);
    else if (cat === 'WATER') themes = resolveWaterThemes(input);
    else if (cat === 'WASTEWATER') themes = resolveWastewaterThemes(input);
    if (themes.length > limit) {
      console.error(`[verify_findings_limits] ERROR: ${cat} themes: ${themes.length} (max ${limit})`);
      failed++;
    }
  }

  for (const cat of themeCats) {
    const answers = TRIGGER_ALL_GAPS[cat] ?? {};
    const gaps = resolveKnowledgeGaps({ category: cat, answers });
    if (gaps.length > GAP_LIMIT) {
      console.error(`[verify_findings_limits] ERROR: ${cat} knowledge gaps: ${gaps.length} (max ${GAP_LIMIT})`);
      failed++;
    }
  }

  if (failed > 0) process.exit(1);
  return 0;
}

main();
