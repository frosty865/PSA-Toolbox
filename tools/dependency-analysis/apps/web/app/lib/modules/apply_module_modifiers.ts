import type { SummaryRow } from 'engine';
import { CROSS_DEPENDENCY_MODULES, type ModulesState } from './registry';
import { deriveOtIcsModule } from './ot_ics_resilience_derive';

export type SummaryWithModifiers = SummaryRow & {
  module_modifiers?: Array<{ id: string; reason: string; kind: string }>;
};

const MOD_DERIVERS: Record<string, (answers: Record<string, unknown>) => string[]> = {
  MODULE_OT_ICS_RESILIENCE: (answers) => deriveOtIcsModule(answers).modifiers,
};

export function applyModuleModifiers(
  summary: SummaryRow[],
  modules: ModulesState | Record<string, unknown> | undefined
): SummaryWithModifiers[] {
  const typed = modules as ModulesState | undefined;
  if (!typed) return summary;
  const modifiersByCategory = new Map<string, Array<{ id: string; reason: string; kind: string }>>();

  for (const mod of CROSS_DEPENDENCY_MODULES) {
    const state = typed[mod.module_code];
    if (!state?.enabled) continue;
    const derive = MOD_DERIVERS[mod.module_code];
    const modifierIds = derive ? derive(state.answers ?? {}) : [];
    for (const modifier of mod.modifiers) {
      if (!modifierIds.includes(modifier.id)) continue;
      const list = modifiersByCategory.get(modifier.applies_to_infrastructure) ?? [];
      list.push({ id: modifier.id, reason: modifier.reason, kind: modifier.kind });
      modifiersByCategory.set(modifier.applies_to_infrastructure, list);
    }
  }

  return summary.map((row) => {
    const mods = modifiersByCategory.get(row.category);
    return mods ? { ...row, module_modifiers: mods } : row;
  });
}
