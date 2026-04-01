import { OT_ICS_RESILIENCE_MODULE } from './ot_ics_resilience_module';

export const CROSS_DEPENDENCY_MODULES = [OT_ICS_RESILIENCE_MODULE] as const;

export type ModuleInstanceState = {
  enabled: boolean;
  answers: Record<string, unknown>;
  derived?: {
    vulnerabilities?: string[];
    flags?: string[];
    modifiers?: string[];
  };
};

export type ModulesState = Record<string, ModuleInstanceState>;

export function buildDefaultModulesState(): ModulesState {
  const out: ModulesState = {};
  for (const mod of CROSS_DEPENDENCY_MODULES) {
    out[mod.module_code] = { enabled: false, answers: {} };
  }
  return out;
}

export function mergeModulesState(existing?: ModulesState | null): ModulesState {
  const base = buildDefaultModulesState();
  if (!existing || typeof existing !== 'object') return base;
  const out: ModulesState = { ...base };
  for (const [code, state] of Object.entries(existing)) {
    if (!state || typeof state !== 'object') continue;
    const typed = state as ModuleInstanceState;
    out[code] = {
      enabled: Boolean(typed.enabled),
      answers: { ...(typed.answers as Record<string, unknown>) },
      derived: typed.derived ? { ...typed.derived } : undefined,
    };
  }
  return out;
}
