import { OT_ICS_RESILIENCE_MODULE, type FourState, type TriState } from './ot_ics_resilience_module';

export type ModuleFinding = {
  id: string;
  title: string;
  text: string;
  ofcs: Array<{ id: string; option_for_consideration: string; benefit: string }>;
};

export type ModuleDerived = {
  summary_sentences: string[];
  vulnerabilities: ModuleFinding[];
  flags: Array<{ id: string; title: string; text: string }>;
  modifiers: string[];
};

function asTri(val: unknown): TriState | undefined {
  if (val === 'YES' || val === 'NO' || val === 'UNKNOWN') return val;
  return undefined;
}

function asFour(val: unknown): FourState | undefined {
  if (val === 'YES' || val === 'NO' || val === 'PARTIAL' || val === 'UNKNOWN') return val;
  return undefined;
}

function isYes(val: TriState | FourState | undefined): boolean {
  return val === 'YES';
}

function isNoish(val: FourState | TriState | undefined): boolean {
  return val === 'NO' || val === 'PARTIAL';
}

export function deriveOtIcsModule(answers: Record<string, unknown>): ModuleDerived {
  const present = asTri(answers.ot_ics_present);
  if (present !== 'YES') {
    return { summary_sentences: ['No OT/ICS-controlled systems reported.'], vulnerabilities: [], flags: [], modifiers: [] };
  }

  const powerSupported = asFour(answers.ot_ics_power_supported);
  const requiresExternal = asTri(answers.ot_ics_requires_external_internet);
  const localWithoutInternet = asFour(answers.ot_ics_local_operation_without_internet);
  const internalIt = asFour(answers.ot_ics_dependent_on_internal_it);
  const manualOverride = asFour(answers.ot_ics_manual_override);

  const summary_sentences: string[] = [
    'OT/ICS-managed systems are present and may influence infrastructure continuity during disruptions.',
  ];
  if (requiresExternal === 'YES') {
    summary_sentences.push('Some control functions rely on external connectivity for normal operation or management.');
  } else if (requiresExternal === 'NO') {
    summary_sentences.push('Control functions do not require external connectivity for normal operation.');
  }
  if (manualOverride === 'YES') {
    summary_sentences.push('Manual or local override is available for at least some critical functions.');
  } else if (manualOverride === 'NO' || manualOverride === 'PARTIAL') {
    summary_sentences.push('Manual or local override is limited for critical functions.');
  }

  const ofcById = new Map(OT_ICS_RESILIENCE_MODULE.ofcs.map((o) => [o.id, o]));
  const vulnerabilities: ModuleFinding[] = [];

  if (isNoish(powerSupported)) {
    const v = OT_ICS_RESILIENCE_MODULE.vulnerabilities.find((x) => x.id === 'v_ot_ics_controls_not_on_backup_power');
    if (v) {
      const ofcs = (v.ofc_ids ?? []).map((id) => ofcById.get(id)).filter(Boolean) as ModuleFinding['ofcs'];
      vulnerabilities.push({ id: v.id, title: v.title, text: v.text, ofcs });
    }
  }

  if (requiresExternal === 'YES' && isNoish(localWithoutInternet)) {
    const v = OT_ICS_RESILIENCE_MODULE.vulnerabilities.find((x) => x.id === 'v_ot_ics_external_connectivity_dependency');
    if (v) {
      const ofcs = (v.ofc_ids ?? []).map((id) => ofcById.get(id)).filter(Boolean) as ModuleFinding['ofcs'];
      vulnerabilities.push({ id: v.id, title: v.title, text: v.text, ofcs });
    }
  }

  if (internalIt === 'YES' || internalIt === 'PARTIAL') {
    const v = OT_ICS_RESILIENCE_MODULE.vulnerabilities.find((x) => x.id === 'v_ot_ics_internal_it_cascade_risk');
    if (v) {
      const ofcs = (v.ofc_ids ?? []).map((id) => ofcById.get(id)).filter(Boolean) as ModuleFinding['ofcs'];
      vulnerabilities.push({ id: v.id, title: v.title, text: v.text, ofcs });
    }
  }

  if (isNoish(manualOverride)) {
    const v = OT_ICS_RESILIENCE_MODULE.vulnerabilities.find((x) => x.id === 'v_ot_ics_no_manual_override');
    if (v) {
      const ofcs = (v.ofc_ids ?? []).map((id) => ofcById.get(id)).filter(Boolean) as ModuleFinding['ofcs'];
      vulnerabilities.push({ id: v.id, title: v.title, text: v.text, ofcs });
    }
  }

  const flags = [] as Array<{ id: string; title: string; text: string }>;
  if (present === 'YES' && manualOverride === 'NO') {
    flags.push({
      id: 'flag_ot_control_survivability',
      title: 'Control-System Survivability Risk',
      text:
        'Digitally controlled systems lack manual or local override capability. Disruptions to power or connectivity may escalate operational impacts.',
    });
  }

  const modifiers = OT_ICS_RESILIENCE_MODULE.modifiers
    .filter((m) => m.when.every((cond) => String(answers[cond.questionId]) === cond.equals))
    .map((m) => m.id);

  return { summary_sentences, vulnerabilities, flags, modifiers };
}

export function deriveOtIcsDerivedStrings(answers: Record<string, unknown>): {
  vulnerabilities: string[];
  flags: string[];
  modifiers: string[];
} {
  const derived = deriveOtIcsModule(answers);
  return {
    vulnerabilities: derived.vulnerabilities.map((v) => v.id),
    flags: derived.flags.map((f) => f.id),
    modifiers: derived.modifiers,
  };
}
