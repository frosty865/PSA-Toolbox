'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from '@/components/FieldLink';
import {
  CommsAnswersSchema,
  getDefaultCommsAnswers,
  getPaceQuestionDefs,
  COMM_VOICE_FUNCTION_VALUES,
  COMM_PACE_SYSTEM_TYPE_VALUES,
  COMM_CARRIER_DEPENDENCY_VALUES,
  COMM_ROUTE_DIVERSITY_VALUES,
  COMM_REGIONAL_SURVIVABILITY_VALUES,
  COMM_REGIONAL_SURVIVABILITY_LABELS,
  COMM_INTEROPERABILITY_VALUES,
  COMM_CELLULAR_DIVERSITY_VALUES,
  COMM_CELLULAR_DIVERSITY_LABELS,
  COMM_CELLULAR_PRIORITY_VALUES,
  COMM_CELLULAR_PRIORITY_LABELS,
  COMM_CELLULAR_COVERAGE_VALUES,
  COMM_CELLULAR_COVERAGE_LABELS,
  COMM_DEVICE_POWER_VALUES,
  COMM_DEVICE_POWER_LABELS,
  COMM_POWER_SCOPE_LABELS,
  COMM_RADIO_MODE_VALUES,
  COMM_RADIO_MODE_LABELS,
  COMM_PA_COVERAGE_VALUES,
  COMM_POWER_LANDLINE_VALUES,
  deriveCommsSinglePointFromPace,
  isPaceLayerCellular,
  isPaceLayerLandline,
  isPaceLayerRadio,
  isPaceLayerSatellite,
  isPaceLayerInternalPA,
  isPaceLayerRunner,
  clearLayerForSystemType,
  COMMS_SCOPE_GUARD,
  COMMS_VS_IT_EXAMPLES,
  COMMS_FORBIDDEN_TERMS,
  type CommsAnswers,
  type CommPaceLayer,
  type CommPaceSystemType,
  type CommVoiceFunction,
} from '@/app/lib/dependencies/infrastructure/comms_spec';
import { deriveCommsFindings } from '@/app/lib/dependencies/derive_comms_findings';
import { commsAnswersToCommsImpactCategoryInput } from '@/app/lib/dependencies/comms_to_category_input';
import { ImpactCurveConfigCard } from '@/components/ImpactCurveConfigCard';
import { RedundancyActivationBlock } from '@/components/RedundancyActivationBlock';
import {
  getCommsAnswersForUI,
  loadCommsAnswers,
  saveCommsAnswers,
} from '@/app/lib/dependencies/persistence';
import type { CategoryInput } from 'schema';
import {
  DEFAULT_PRIORITY_RESTORATION,
  type PriorityRestoration,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PriorityRestorationHelpButton } from '@/components/asset-dependency/PriorityRestorationHelpButton';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfraIntroBlock } from '@/components/InfraIntroBlock';
import { INFRA_INTRO } from '@/app/lib/dependencies/infra_intro_copy';

const DEBUG_DEPENDENCIES = process.env.NEXT_PUBLIC_DEBUG_DEPENDENCIES === '1';

function getPowerScopeHelp(systemType: CommPaceSystemType | undefined): string {
  switch (systemType) {
    case 'CELLULAR_VOICE':
    case 'PUSH_TO_TALK_CELLULAR':
      return "Device power does not confirm tower/backhaul availability. If carrier power isn't assessed, sustainment is conservatively capped.";
    case 'SATELLITE_PHONE':
      return "Device power does not confirm satellite gateway / ground-station availability. If carrier-side power isn't assessed, sustainment is conservatively capped.";
    case 'LANDLINE_VOIP_TRUNK':
      return "Onsite device power does not confirm central office / ISP transport / carrier core availability. If provider-side power isn't assessed, sustainment is conservatively capped.";
    case 'RADIO_ANALOG':
    case 'RADIO_DIGITAL':
      return "Handset/battery power does not confirm repeater/base-station availability. If repeater site power isn't assessed, sustainment is conservatively capped.";
    case 'PUBLIC_SAFETY_RADIO_NETWORK':
      return "Handset power does not confirm public safety radio site/repeater availability. If network site power isn't assessed, sustainment is conservatively capped.";
    case 'INTERNAL_PA':
      return "Device power does not confirm building power distribution availability. If facility power resilience isn't assessed, sustainment is conservatively capped.";
    case 'MANUAL_RUNNER':
      return "Power scope is not applicable for manual runner procedures.";
    case 'NONE':
      return "Power scope is not applicable when no method is selected.";
    case 'UNKNOWN':
    default:
      return "Device power does not confirm provider-side availability. If provider power isn't assessed, sustainment is conservatively capped.";
  }
}

const VOICE_FUNCTION_LABELS: Record<CommVoiceFunction, string> = {
  SECURITY_COORDINATION: 'Security coordination',
  EXEC_LEADERSHIP: 'Executive leadership',
  EMERGENCY_RESPONSE: 'Emergency response',
  FACILITY_OPERATIONS: 'Facility operations',
  PUBLIC_MESSAGING: 'Public messaging',
  DISPATCH_OPERATIONS: 'Dispatch operations',
  OTHER: 'Other',
};

/** Operational Coordination group (same values as COMM_VOICE_FUNCTION_VALUES; layout split only). */
const VOICE_FUNCTIONS_OPERATIONAL: CommVoiceFunction[] = [
  'SECURITY_COORDINATION',
  'EMERGENCY_RESPONSE',
  'FACILITY_OPERATIONS',
  'DISPATCH_OPERATIONS',
  'OTHER',
];
/** Leadership / Public Messaging group (same values; layout split only). */
const VOICE_FUNCTIONS_LEADERSHIP: CommVoiceFunction[] = [
  'EXEC_LEADERSHIP',
  'PUBLIC_MESSAGING',
];

const PACE_SYSTEM_LABELS: Record<string, string> = {
  CELLULAR_VOICE: 'Cellular voice',
  PUSH_TO_TALK_CELLULAR: 'Push-to-talk cellular',
  LANDLINE_VOIP_TRUNK: 'Landline / VoIP trunk',
  RADIO_ANALOG: 'Radio (analog)',
  RADIO_DIGITAL: 'Radio (digital)',
  PUBLIC_SAFETY_RADIO_NETWORK: 'Public safety radio network',
  SATELLITE_PHONE: 'Satellite phone',
  INTERNAL_PA: 'Internal PA',
  MANUAL_RUNNER: 'Manual runner',
  NONE: 'None',
  UNKNOWN: 'Unknown',
};

export type CommsQuestionnaireSectionProps = {
  embedded?: boolean;
  onCurveDataChange?: (categoryInput: CategoryInput & Record<string, unknown>) => void;
  existingCommsCategory?: Partial<CategoryInput> & Record<string, unknown>;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
};

export function CommsQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingCommsCategory = {},
  priorityRestoration,
  onPriorityRestorationChange,
}: CommsQuestionnaireSectionProps) {
  const [answers, setAnswers] = useState<CommsAnswers>(getDefaultCommsAnswers());
  const [validationError, setValidationError] = useState<{ message: string; path: (string | number)[] } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [scopeModalDismissed, setScopeModalDismissed] = useState(false);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);

  const scopeConfirmed = (existingCommsCategory as Record<string, unknown>)?._comms_scope_confirmed === true;

  useEffect(() => {
    const fromStorage = getCommsAnswersForUI();
    if (embedded && existingCommsCategory) {
      const existing = existingCommsCategory as Record<string, unknown>;
      const merged: CommsAnswers = { ...fromStorage };
      for (const layer of ['P', 'A', 'C', 'E'] as const) {
        const key = `comm_pace_${layer}` as keyof CommsAnswers;
        const storageVal = merged[key] as CommPaceLayer | undefined;
        const existingVal = existing[key] as unknown;
        const storageObj =
          storageVal != null &&
          typeof storageVal === 'object' &&
          Object.keys(storageVal).length > 0
            ? (storageVal as Record<string, unknown>)
            : null;
        const existingObj =
          existingVal != null &&
          typeof existingVal === 'object' &&
          Object.keys(existingVal as Record<string, unknown>).length > 0
            ? (existingVal as Record<string, unknown>)
            : null;
        // STORAGE WINS (must be ...existing, ...storage — not the reverse)
        if (storageObj && existingObj) {
          (merged as Record<string, unknown>)[key] = {
            ...existingObj,
            ...storageObj,
          } as CommPaceLayer;
        } else if (!storageObj && existingObj) {
          (merged as Record<string, unknown>)[key] = {
            ...existingObj,
          } as CommPaceLayer;
        }
      }
      setAnswers(merged);
    } else {
      setAnswers(fromStorage);
    }
  }, []); // Only on mount; embedded/existingCommsCategory from first render

  useEffect(() => {
    const text = [
      answers.comm_voice_functions_other_detail ?? '',
      ...(['P', 'A', 'C', 'E'] as const).map((l) => (answers[`comm_pace_${l}`] as CommPaceLayer | undefined)?.provider_name ?? ''),
    ].join(' ').toLowerCase();
    const found = COMMS_FORBIDDEN_TERMS.find((term) => text.includes(term));
    setForbiddenWarning(found ? `That sounds like IT/Data transport (e.g. "${found}"). Are you in the right tab?` : null);
  }, [answers.comm_voice_functions_other_detail, answers.comm_pace_P?.provider_name, answers.comm_pace_A?.provider_name, answers.comm_pace_C?.provider_name, answers.comm_pace_E?.provider_name]);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    autoSaveTimeoutRef.current = setTimeout(() => {
      const derived = deriveCommsFindings(answers);
      saveCommsAnswers({ answers, derived });
    }, 1500);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [answers]);

  const update = useCallback((patch: Partial<CommsAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
    setValidationError(null);
  }, []);

  const updatePaceLayer = useCallback(
    (layer: 'P' | 'A' | 'C' | 'E', field: keyof CommPaceLayer, value: unknown) => {
      setAnswers((prev) => {
        const current = prev[`comm_pace_${layer}`] as CommPaceLayer | undefined;
        let next: CommPaceLayer;
        if (field === 'system_type') {
          next = clearLayerForSystemType(current, value as CommPaceSystemType);
          // TEMP DEBUG — remove after confirming system_type sticks
          console.log('PACE system_type change:', layer, value, next.system_type, next);
        } else {
          next = { ...(current ?? {}), [field]: value };
        }
        const updated = { ...prev, [`comm_pace_${layer}`]: next };
        // Persist immediately so tab switch / save does not lose edits (autoSave is debounced)
        const derived = deriveCommsFindings(updated);
        queueMicrotask(() => saveCommsAnswers({ answers: updated, derived }));
        return updated;
      });
      setValidationError(null);
    },
    []
  );

  const lastCurvePayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCurveDataChange) return;
    const categoryInput = commsAnswersToCommsImpactCategoryInput(answers, existingCommsCategory);
    const payload = JSON.stringify(categoryInput);
    if (payload === lastCurvePayloadRef.current) return;
    lastCurvePayloadRef.current = payload;
    onCurveDataChange(categoryInput);
  }, [answers, existingCommsCategory, onCurveDataChange]);

  const handleScopeContinue = useCallback(() => {
    setScopeModalDismissed(true);
    if (onCurveDataChange) {
      const next = commsAnswersToCommsImpactCategoryInput(answers, existingCommsCategory);
      (next as Record<string, unknown>)._comms_scope_confirmed = true;
      onCurveDataChange(next);
    }
  }, [answers, existingCommsCategory, onCurveDataChange]);

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    setValidationError(null);
    const result = CommsAnswersSchema.safeParse(answers);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path ?? [];
      setValidationError({
        message: first?.message ?? 'Validation failed',
        path: Array.isArray(path) ? path : [path],
      });
      return;
    }
    const derived = deriveCommsFindings(result.data);
    saveCommsAnswers({ answers: result.data, derived });
    setSaveMessage('Saved.');
  }, [answers]);

  const derivedSpof = deriveCommsSinglePointFromPace(answers);
  const showSpofWarning =
    derivedSpof === true && answers.comm_single_point_voice_failure === 'no';

  const heading = embedded ? (
    <h3 className="text-lg font-semibold mt-6 mb-2">Communications (Voice / Command & Control)</h3>
  ) : (
    <h2 className="section-title">Communications (Voice / Command & Control)</h2>
  );

  return (
    <>
      {heading}
      <div className="mb-4">
        {!embedded && (
          <Link href="/assessment/categories/" className="btn btn-secondary" style={{ marginRight: '0.5rem' }}>
            ← Categories
          </Link>
        )}
        {priorityRestoration != null && onPriorityRestorationChange != null && (
          <PriorityRestorationHelpButton
            topicKey="communications"
            value={priorityRestoration}
            onChange={onPriorityRestorationChange}
            showNotes={true}
          />
        )}
        {validationError && (
          <span className="text-danger ml-3" role="alert">
            {validationError.message}
          </span>
        )}
        {saveMessage && <span className="text-success ml-3">{saveMessage}</span>}
      </div>

      <InfraIntroBlock {...INFRA_INTRO.COMMUNICATIONS} />

      {/* Scope guard banner — no sticky to avoid overlaying PACE form inputs */}
      <div
        className="mb-4 p-3 border-2 rounded shadow-sm"
        style={{
          backgroundColor: 'var(--cisa-gray-lighter, #f1f1f2)',
          borderColor: 'var(--cisa-blue, #1b365d)',
        }}
      >
        <div className="font-semibold mb-2" style={{ color: 'var(--cisa-blue)' }}>
          {COMMS_SCOPE_GUARD.title}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-2">
          <div>
            <strong>In scope:</strong> {COMMS_SCOPE_GUARD.in_scope}
          </div>
          <div>
            <strong>Out of scope:</strong> {COMMS_SCOPE_GUARD.out_of_scope}
          </div>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--cisa-red)' }}>
          {COMMS_SCOPE_GUARD.rule}
        </p>
      </div>

      {/* Comms vs IT callout — 3 examples each + boundary */}
      <details className="mb-4 border rounded p-3" style={{ borderColor: 'var(--cisa-gray-light)' }}>
        <summary className="cursor-pointer font-medium">What counts as Communications vs IT?</summary>
        <div className="mt-2 text-sm space-y-2">
          <p><strong>Communications</strong> = voice/radio/dispatch. Examples: {COMMS_VS_IT_EXAMPLES.communications.join('; ')}.</p>
          <p><strong>IT</strong> = internet/data transport. Examples: {COMMS_VS_IT_EXAMPLES.it.join('; ')}.</p>
          <p className="font-medium" style={{ color: 'var(--cisa-red)' }}>{COMMS_VS_IT_EXAMPLES.boundary}</p>
        </div>
      </details>

      {/* First-entry micro-confirmation */}
      {!scopeConfirmed && !scopeModalDismissed && (
        <div
          className="mb-4 p-4 rounded border-2 shadow-lg"
          style={{ backgroundColor: '#fff', borderColor: 'var(--cisa-blue)' }}
          role="dialog"
          aria-labelledby="comms-scope-modal-title"
        >
          <h3 id="comms-scope-modal-title" className="font-semibold mb-2">
            This section is VOICE / COMMAND communications, not internet/data.
          </h3>
          <p className="text-sm mb-4">Continue here for voice, radios, dispatch, cellular voice, PTT. For internet/data circuits or SaaS, use the IT tab.</p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-primary" onClick={handleScopeContinue}>
              Continue (Voice)
            </button>
            <a href="/assessment/categories/#tab-INFORMATION_TECHNOLOGY" className="btn btn-secondary">
              Go to IT
            </a>
          </div>
        </div>
      )}

      {forbiddenWarning && (
        <div
          className="mb-4 p-3 rounded border"
          style={{ backgroundColor: 'var(--cisa-amber-lighter)', borderColor: 'var(--cisa-amber)' }}
          role="status"
        >
          ⚠ {forbiddenWarning}
        </div>
      )}

      {showSpofWarning && (
        <div
          className="mb-4 p-3 rounded border"
          style={{ backgroundColor: 'var(--cisa-amber-lighter)', borderColor: 'var(--cisa-amber)' }}
          role="status"
        >
          Your PACE answers suggest a possible single point of voice failure. Please review COMM-SP1 or update PACE layers.
        </div>
      )}

      <CommsForm answers={answers} onUpdate={update} onUpdatePaceLayer={updatePaceLayer} validationError={validationError} />
    </>
  );
}

function CommsForm({
  answers,
  onUpdate,
  onUpdatePaceLayer,
  validationError,
}: {
  answers: CommsAnswers;
  onUpdate: (p: Partial<CommsAnswers>) => void;
  onUpdatePaceLayer: (layer: 'P' | 'A' | 'C' | 'E', field: keyof CommPaceLayer, value: unknown) => void;
  validationError?: { message: string; path: (string | number)[] } | null;
}) {
  const hasBackup = answers.curve_backup_available === 'yes';
  const requiresService = answers.curve_requires_service !== false;

  return (
    <div className="comms-form space-y-6">
      {/* SECTION 1 — Voice Functions (two groups: Operational Coordination, Leadership / Public Messaging) */}
      <section className="card p-4 mt-2 border rounded-md bg-gray-50" style={{ backgroundColor: 'var(--cisa-gray-lighter, #f5f5f5)' }}>
        <h3 className="text-lg font-semibold mb-3">Voice Functions</h3>
        <p className="text-sm text-secondary mb-4">
          Which voice/command functions does the facility rely on? (Select all that apply.) Voice/command transport only (radios, landline voice, cellular voice). Not internet/data.
        </p>
        <div className="space-y-4">
          <div>
            <div className="font-semibold text-sm mb-2">Operational Coordination</div>
            <div className="checkbox-group grid grid-cols-2 gap-x-8 gap-y-2">
              {VOICE_FUNCTIONS_OPERATIONAL.map((val) => {
                const selected = answers.comm_voice_functions?.includes(val) ?? false;
                return (
                  <div key={val} className="checkbox-item">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={selected}
                        onChange={() => {
                          const next = selected
                            ? (answers.comm_voice_functions ?? []).filter((x) => x !== val)
                            : [...(answers.comm_voice_functions ?? []), val];
                          onUpdate({ comm_voice_functions: next });
                        }}
                      />
                      <span className="text-sm leading-5">{VOICE_FUNCTION_LABELS[val] ?? val}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm mb-2">Leadership / Public Messaging</div>
            <div className="checkbox-group grid grid-cols-2 gap-x-8 gap-y-2">
              {VOICE_FUNCTIONS_LEADERSHIP.map((val) => {
                const selected = answers.comm_voice_functions?.includes(val) ?? false;
                return (
                  <div key={val} className="checkbox-item">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={selected}
                        onChange={() => {
                          const next = selected
                            ? (answers.comm_voice_functions ?? []).filter((x) => x !== val)
                            : [...(answers.comm_voice_functions ?? []), val];
                          onUpdate({ comm_voice_functions: next });
                        }}
                      />
                      <span className="text-sm leading-5">{VOICE_FUNCTION_LABELS[val] ?? val}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {(answers.comm_voice_functions?.includes('OTHER') ?? false) && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Other (details)</label>
            <input
              type="text"
              className="form-control max-w-md"
              value={answers.comm_voice_functions_other_detail ?? ''}
              onChange={(e) => onUpdate({ comm_voice_functions_other_detail: e.target.value || undefined })}
              placeholder="Describe other voice functions"
            />
          </div>
        )}
      </section>

      {/* OPERATIONAL IMPACT PROFILE – Impact Curve Configuration (same layout as Water / Energy / IT) */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: 0, marginBottom: '0.75em' }}>
        Operational Impact Profile
      </div>
      <ImpactCurveConfigCard>
        <p className="text-secondary text-sm mb-2">
          Voice/radio/cellular/satellite voice only—not internet or data circuits.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-1 inline-flex items-center gap-1 flex-wrap">
              Does the facility rely on voice communications to coordinate operations, security, or emergency response?
              <HelpTooltip helpText={COMMS_FIELD_HELP.curve_requires_service} />
            </label>
            <p className="text-sm text-amber-700 mb-1">
              Voice/radio/cellular/satellite voice only—not internet or data circuits.
            </p>
            <p className="text-xs text-gray-600 mb-2">
              Carrier/network operator only. Do not list SaaS/cloud/VPN/internet items here.
            </p>
            <div className="radio-group">
              {([true, false] as const).map((v) => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="curve_requires_service"
                    checked={answers.curve_requires_service === v}
                    onChange={() => onUpdate({ curve_requires_service: v })}
                  />
                  <span>{v ? 'Yes' : 'No'}</span>
                </label>
              ))}
            </div>
          </div>

          {requiresService && (
            <>
              <div>
                <label className="block font-medium mb-1">Who provides primary voice/telephony service?</label>
                <p className="text-xs text-gray-600 mb-2">Required when the facility relies on voice communications.</p>
                <input
                  type="text"
                  className="form-control max-w-md"
                  value={answers.curve_primary_provider ?? ''}
                  onChange={(e) => onUpdate({ curve_primary_provider: e.target.value || undefined })}
                  placeholder="Primary voice/telephony provider name"
                  aria-label="Who provides primary voice/telephony service"
                />
              </div>
              <div>
                <label className="block font-medium mb-1 inline-flex items-center gap-1">
                  Time to impact (hours, 0–72)
                  <HelpTooltip helpText={COMMS_FIELD_HELP.curve_time_to_impact} />
                </label>
                <input
                  type="number"
                  min={0}
                  max={72}
                  className="form-control w-32"
                  value={answers.curve_time_to_impact_hours ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      curve_time_to_impact_hours: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div>
                <label className="block font-medium mb-1 inline-flex items-center gap-1">
                  Loss without backup (%)
                  <HelpTooltip helpText={COMMS_FIELD_HELP.curve_loss_no_backup} />
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control w-32"
                  value={
                    answers.curve_loss_fraction_no_backup != null
                      ? Math.round(answers.curve_loss_fraction_no_backup * 100)
                      : ''
                  }
                  onChange={(e) =>
                    onUpdate({
                      curve_loss_fraction_no_backup: e.target.value ? Number(e.target.value) / 100 : undefined,
                    })
                  }
                />
              </div>
              <div>
                <label className="block font-medium mb-1 inline-flex items-center gap-1">
                  Backup or alternate voice capability available?
                  <HelpTooltip helpText={COMMS_FIELD_HELP.curve_backup_available} />
                </label>
                <div className="radio-group-vertical">
                  {(['yes', 'no', 'unknown'] as const).map((v) => (
                    <div key={v} className="radio-option-item">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="curve_backup_available"
                          checked={answers.curve_backup_available === v}
                          onChange={() => onUpdate({ curve_backup_available: v })}
                        />
                        <span className="capitalize">{v}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {hasBackup && (
                <>
                  <RedundancyActivationBlock
                    value={(answers as Record<string, unknown>).redundancy_activation as React.ComponentProps<typeof RedundancyActivationBlock>['value']}
                    onChange={(v) => onUpdate({ redundancy_activation: v })}
                    capabilityLabel="alternate voice capability"
                    activationDelayMin={0}
                    activationDelayMax={240}
                    activationDelayHelp="IT/Comms failover: 0–240 min default; up to 1440 if vendor dispatch."
                  />
                  <div>
                    <label className="block font-medium mb-1 inline-flex items-center gap-1">
                      Backup duration (hours, 0–96)
                      <HelpTooltip helpText={COMMS_FIELD_HELP.curve_backup_duration} />
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={96}
                      className="form-control w-32"
                      value={answers.curve_backup_duration_hours ?? ''}
                      onChange={(e) =>
                        onUpdate({
                          curve_backup_duration_hours: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 inline-flex items-center gap-1">
                      Loss with backup (%)
                      <HelpTooltip helpText={COMMS_FIELD_HELP.curve_loss_with_backup} />
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="form-control w-32"
                      value={
                        answers.curve_loss_fraction_with_backup != null
                          ? Math.round(answers.curve_loss_fraction_with_backup * 100)
                          : ''
                      }
                      onChange={(e) =>
                        onUpdate({
                          curve_loss_fraction_with_backup: e.target.value ? Number(e.target.value) / 100 : undefined,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block font-medium mb-1 inline-flex items-center gap-1">
                  Recovery time (hours, 0–168)
                  <HelpTooltip helpText={COMMS_FIELD_HELP.curve_recovery_time} />
                </label>
                <input
                  type="number"
                  min={0}
                  max={168}
                  className="form-control w-32"
                  value={answers.curve_recovery_time_hours ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      curve_recovery_time_hours: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </ImpactCurveConfigCard>

      {/* SECTION 3 — Communications Infrastructure Dependency (Primary + Alternate) */}
      <section className="card p-4">
        <h3 className="text-lg font-semibold mb-2">Communications Infrastructure Dependency</h3>
        <p className="text-sm text-secondary mb-4">
          External carrier/network transport relied upon for voice/dispatch coordination. Do not list SaaS/cloud/VPN/internet platforms here.
        </p>
        <p className="text-sm text-amber-700 mb-3">
          Voice carrier/system only. Do not list SaaS or cloud services here.
        </p>
        <PaceLayerCard
          layer="P"
          title="Primary (external carrier service)"
          subtitle="Primary external voice carrier/system used for normal operations."
          data={answers.comm_pace_P}
          onUpdate={(field, value) => onUpdatePaceLayer('P', field, value)}
          answers={answers}
        />
        <PaceLayerCard
          layer="A"
          title="Alternate (external carrier redundancy)"
          subtitle="Separate external carrier/path used if the primary is unavailable."
          data={answers.comm_pace_A}
          onUpdate={(field, value) => onUpdatePaceLayer('A', field, value)}
          answers={answers}
        />
      </section>

      {/* SECTION 4 — Internal Coordination Methods (Post-Failure) */}
      <section className="card p-4">
        <h3 className="text-lg font-semibold mb-2">Internal Coordination Methods (Post-Failure)</h3>
        <p className="text-sm text-secondary mb-4">
          On-site methods used when external communications are degraded or unavailable (e.g., radios, PA, runner). These do not replace external carrier service.
        </p>
        <div className="text-sm text-secondary mb-4 p-3 rounded" style={{ background: 'var(--cisa-blue-lightest)', borderLeft: '4px solid var(--cisa-blue-lighter)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--cisa-blue)' }}>Internal methods (if defined)</p>
          <p className="mb-0">
            Contingency → Emergency (post-failure). These are fallback methods used when external carrier service is unavailable.
          </p>
        </div>
        <PaceLayerCard
          layer="C"
          title="Contingency (internal coordination method)"
          subtitle="On-site method (e.g., radios/PA) used when carriers fail."
          data={answers.comm_pace_C}
          onUpdate={(field, value) => onUpdatePaceLayer('C', field, value)}
          answers={answers}
        />
        <PaceLayerCard
          layer="E"
          title="Emergency (last-resort manual method)"
          subtitle="Manual/runner/face-to-face coordination when other methods are degraded."
          data={answers.comm_pace_E}
          onUpdate={(field, value) => onUpdatePaceLayer('E', field, value)}
          answers={answers}
        />
      </section>

      {/* SECTION 5 — Coordination & Interoperability */}
      <section className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Coordination & Interoperability</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-1 inline-flex items-center gap-1 flex-wrap">
              Single point of voice failure? (All options depend on one carrier, route, repeater/tower, or power source.)
              <HelpTooltip helpText={COMMS_FIELD_HELP.comm_single_point_failure} />
            </label>
            <div className="radio-group-vertical">
              {(['yes', 'no', 'unknown'] as const).map((v) => (
                <div key={v} className="radio-option-item">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="comm_single_point_voice_failure"
                      checked={answers.comm_single_point_voice_failure === v}
                      onChange={() => onUpdate({ comm_single_point_voice_failure: v })}
                    />
                    <span className="capitalize">{v}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1 inline-flex items-center gap-1">
              Interoperability with other agencies/systems for voice
              <HelpTooltip helpText={COMMS_FIELD_HELP.comm_interoperability} />
            </label>
            <select
              className="form-control max-w-xs"
              value={answers.comm_interoperability ?? ''}
              onChange={(e) =>
                onUpdate({
                  comm_interoperability: (e.target.value || undefined) as CommsAnswers['comm_interoperability'],
                })
              }
            >
              <option value="">— Select —</option>
              {COMM_INTEROPERABILITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1 inline-flex items-center gap-1 flex-wrap">
              Documented coordination with voice providers/network operators for restoration and priority during outages?
              <HelpTooltip helpText={COMMS_FIELD_HELP.comm_restoration_coordination} />
            </label>
            <div className="radio-group-vertical">
              {(['yes', 'no', 'unknown'] as const).map((v) => (
                <div key={v} className="radio-option-item">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="comm_restoration_coordination"
                      checked={answers.comm_restoration_coordination === v}
                      onChange={() => onUpdate({ comm_restoration_coordination: v })}
                    />
                    <span className="capitalize">{v}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const TRIPWIRE_PROVIDER = 'Carrier/network operator only. Do not list SaaS/cloud/VPN/internet items here.';
const CELLULAR_HELP =
  'Towers/backhaul/power are outside facility control; select UNKNOWN for anything you cannot verify. Focus on carrier diversity, priority service, indoor coverage, and device power.';
const RUNNER_HELP = 'No power/carrier fields required.';

/** Help text for technical curve and coordination questions (used in HelpTooltip). */
const COMMS_FIELD_HELP: Record<string, string> = {
  curve_requires_service:
    'Voice/radio/cellular/satellite only. If the facility needs voice to coordinate operations, security, or emergency response, select Yes. If No, the impact curve will show no operational impact.',
  curve_time_to_impact:
    'How many hours after voice is lost (with no backup) until the facility is severely impacted? Use 0 for immediate impact; enter the number of hours you can operate before critical coordination fails.',
  curve_loss_no_backup:
    'Percentage of normal coordination capability lost when voice is completely unavailable (no backup). 100% = total loss; use a lower value if some functions can continue by other means.',
  curve_backup_available:
    'Is there any alternate voice capability (e.g. different carrier, radio, satellite voice, PTT)? This is voice-only—not internet or data backup.',
  curve_backup_duration:
    'How long can the alternate voice method sustain effective coordination? Consider battery life, fuel, coverage, or resupply. After this duration, the curve assumes you fall back to the next PACE layer or to no-voice loss.',
  curve_loss_with_backup:
    'Even while using the backup voice method, some capability may be reduced (e.g. fewer users, slower). Enter the percentage of normal capability still lost when operating on backup.',
  curve_recovery_time:
    'After external voice service (e.g. carrier) is restored, how many hours until the facility is back to normal voice-dependent operations? Includes any restaging or reconnection time.',
  comm_single_point_failure:
    'Answer Yes if all practical voice options (primary and backups) depend on a single carrier, single route, single repeater/tower, or single power source. No diversity means one failure can take out everything.',
  comm_interoperability:
    'Can your voice systems communicate with other agencies’ or partners’ voice systems during an incident? (e.g. mutual aid, shared radio channel, interoperable P25).',
  comm_restoration_coordination:
    'Do you have written agreements or documented arrangements with voice providers (carriers, network operators) for priority restoration, SLAs, or mutual aid during outages?',
  pace_system_type:
    'The voice method used for this layer: cellular, landline/VoIP, radio, satellite, internal PA, or manual runner. Select NONE if this layer is not used.',
  pace_activate_after:
    'When does this layer become usable after outage start? 0 = immediately. Example: switching to radios may take 0.25h.',
  pace_sustain_hours:
    'How long can this method sustain effective voice coordination without resupply or external restoration? For cellular/radio, consider device power and coverage. For runner, consider staffing endurance.',
  pace_effective_capacity:
    'If operating using only this method, what percentage of normal coordination capability is retained? 100% = full capability; lower if fewer users, slower, or limited scope.',
  pace_regional_survivability:
    'In a regional outage (e.g. widespread power or carrier failure), is this method likely to remain operational? Towers and backhaul are outside facility control—select Unknown if not verifiable.',
};

const DEFAULT_LAYER_TITLES: Record<'P' | 'A' | 'C' | 'E', string> = {
  P: 'Primary',
  A: 'Alternate',
  C: 'Contingency',
  E: 'Emergency',
};

function PaceLayerCard({
  layer,
  title,
  subtitle,
  data,
  onUpdate,
  answers,
}: {
  layer: 'P' | 'A' | 'C' | 'E';
  title?: string;
  subtitle?: string;
  data: CommPaceLayer | undefined;
  onUpdate: (field: keyof CommPaceLayer, value: unknown) => void;
  answers: CommsAnswers;
}) {
  const sys = data?.system_type;
  const isCellular = isPaceLayerCellular(data);
  const isLandline = isPaceLayerLandline(data);
  const isRadio = isPaceLayerRadio(data);
  const isSatellite = isPaceLayerSatellite(data);
  const isPA = isPaceLayerInternalPA(data);
  const isRunner = isPaceLayerRunner(data);
  const showProvider = (isCellular || isLandline || isSatellite) && sys && sys !== 'NONE' && sys !== 'UNKNOWN';
  const showPaceCurveFields = sys && sys !== 'NONE' && sys !== 'UNKNOWN';
  const zeroSustainOrCapacity =
    showPaceCurveFields &&
    ((data?.sustain_hours ?? 0) === 0 || (data?.effective_capacity_pct ?? 0) === 0);
  const isInternalCarrierLayer = sys === 'MANUAL_RUNNER' || sys === 'INTERNAL_PA' || sys === 'NONE';
  const displayTitle = title ?? DEFAULT_LAYER_TITLES[layer];

  return (
    <div className="mb-4 pl-4 border-l-4" style={{ borderColor: 'var(--cisa-blue-lighter)' }}>
      <h4 className="font-semibold mb-1">{displayTitle}</h4>
      {subtitle && <p className="text-sm text-gray-600 mb-2">{subtitle}</p>}
      <div className="grid gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
            System type
            <HelpTooltip helpText={COMMS_FIELD_HELP.pace_system_type} />
          </label>
          <p className="text-xs text-gray-600 mb-1">{TRIPWIRE_PROVIDER}</p>
          <select
            className="form-control max-w-md"
            value={data?.system_type ?? ''}
            onChange={(e) => onUpdate('system_type', (e.target.value || undefined) as CommPaceSystemType)}
          >
            <option value="">— Select —</option>
            {COMM_PACE_SYSTEM_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {PACE_SYSTEM_LABELS[v] ?? v}
              </option>
            ))}
          </select>
        </div>

        {isCellular && (
          <>
            <p className="text-xs text-amber-700">{CELLULAR_HELP}</p>
            <div>
              <label className="block text-sm font-medium mb-1">Cellular diversity</label>
              <p className="text-xs text-gray-600 mb-1">Single carrier vs multiple carriers for voice.</p>
              <select
                className="form-control max-w-md"
                value={data?.cellular_diversity ?? ''}
                onChange={(e) => onUpdate('cellular_diversity', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_CELLULAR_DIVERSITY_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_CELLULAR_DIVERSITY_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cellular priority</label>
              <p className="text-xs text-gray-600 mb-1">Only if your organization uses WPS/GETS or FirstNet; otherwise select &quot;No priority service&quot;.</p>
              <select
                className="form-control max-w-md"
                value={data?.cellular_priority ?? ''}
                onChange={(e) => onUpdate('cellular_priority', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_CELLULAR_PRIORITY_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_CELLULAR_PRIORITY_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cellular coverage</label>
              <p className="text-xs text-gray-600 mb-1">Indoor coverage and need for DAS/boosters.</p>
              <select
                className="form-control max-w-md"
                value={data?.cellular_coverage ?? ''}
                onChange={(e) => onUpdate('cellular_coverage', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_CELLULAR_COVERAGE_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_CELLULAR_COVERAGE_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Device power</label>
              <p className="text-xs text-gray-600 mb-1">Battery/charging at the device. Not tower or backhaul power.</p>
              <select
                className="form-control max-w-md"
                value={data?.device_power ?? ''}
                onChange={(e) => onUpdate('device_power', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_DEVICE_POWER_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_DEVICE_POWER_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Power scope</label>
              <p className="text-xs text-gray-600 mb-1">{getPowerScopeHelp(data?.system_type)}</p>
              <select
                className="form-control max-w-md"
                value={data?.power_scope === 'INFRASTRUCTURE_ASSESSED' ? 'INFRASTRUCTURE_ASSESSED' : (data?.power_scope ?? '') || 'DEVICE_ONLY'}
                onChange={(e) => {
                  const v = e.target.value as 'DEVICE_ONLY' | 'INFRASTRUCTURE_ASSESSED' | '';
                  onUpdate('power_scope', v === '' ? 'DEVICE_ONLY' : v);
                }}
              >
                <option value="DEVICE_ONLY">{COMM_POWER_SCOPE_LABELS.DEVICE_ONLY}</option>
                <option value="INFRASTRUCTURE_ASSESSED">{COMM_POWER_SCOPE_LABELS.INFRASTRUCTURE_ASSESSED}</option>
              </select>
            </div>
          </>
        )}

        {isLandline && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Provider / carrier</label>
              <p className="text-xs text-amber-700 mb-1">{TRIPWIRE_PROVIDER}</p>
              <input
                type="text"
                className="form-control max-w-md"
                value={data?.provider_name ?? ''}
                onChange={(e) => onUpdate('provider_name', e.target.value || undefined)}
                placeholder="Carrier name"
              />
            </div>
            {!isInternalCarrierLayer && (
              <div>
                <label className="block text-sm font-medium mb-1">Route diversity</label>
                <select
                  className="form-control max-w-md"
                  value={data?.route_diversity ?? ''}
                  onChange={(e) => onUpdate('route_diversity', e.target.value || undefined)}
                >
                  <option value="">— Select —</option>
                  {COMM_ROUTE_DIVERSITY_VALUES.map((v) => (
                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Power dependency (onsite voice gear)</label>
              <select
                className="form-control max-w-md"
                value={data?.power_dependency ?? ''}
                onChange={(e) => onUpdate('power_dependency', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_POWER_LANDLINE_VALUES.map((v) => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Power scope</label>
              <p className="text-xs text-gray-600 mb-1">{getPowerScopeHelp(data?.system_type)}</p>
              <select
                className="form-control max-w-md"
                value={data?.power_scope === 'INFRASTRUCTURE_ASSESSED' ? 'INFRASTRUCTURE_ASSESSED' : (data?.power_scope ?? '') || 'DEVICE_ONLY'}
                onChange={(e) => {
                  const v = e.target.value as 'DEVICE_ONLY' | 'INFRASTRUCTURE_ASSESSED' | '';
                  onUpdate('power_scope', v === '' ? 'DEVICE_ONLY' : v);
                }}
              >
                <option value="DEVICE_ONLY">{COMM_POWER_SCOPE_LABELS.DEVICE_ONLY}</option>
                <option value="INFRASTRUCTURE_ASSESSED">{COMM_POWER_SCOPE_LABELS.INFRASTRUCTURE_ASSESSED}</option>
              </select>
            </div>
          </>
        )}

        {isRadio && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Radio mode</label>
              <select
                className="form-control max-w-md"
                value={data?.radio_mode ?? ''}
                onChange={(e) => onUpdate('radio_mode', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_RADIO_MODE_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_RADIO_MODE_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Device power</label>
              <select
                className="form-control max-w-md"
                value={data?.device_power ?? ''}
                onChange={(e) => onUpdate('device_power', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_DEVICE_POWER_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_DEVICE_POWER_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Regional survivability
                <HelpTooltip helpText={COMMS_FIELD_HELP.pace_regional_survivability} />
              </label>
              <select
                className="form-control max-w-md"
                value={data?.regional_survivability ?? ''}
                onChange={(e) => onUpdate('regional_survivability', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_REGIONAL_SURVIVABILITY_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_REGIONAL_SURVIVABILITY_LABELS[v] ?? v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {isSatellite && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Provider (optional)</label>
              <p className="text-xs text-amber-700 mb-1">{TRIPWIRE_PROVIDER}</p>
              <input
                type="text"
                className="form-control max-w-md"
                value={data?.provider_name ?? ''}
                onChange={(e) => onUpdate('provider_name', e.target.value || undefined)}
                placeholder="Satellite provider"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Device power</label>
              <select
                className="form-control max-w-md"
                value={data?.device_power ?? ''}
                onChange={(e) => onUpdate('device_power', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_DEVICE_POWER_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_DEVICE_POWER_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Regional survivability
                <HelpTooltip helpText={COMMS_FIELD_HELP.pace_regional_survivability} />
              </label>
              <select
                className="form-control max-w-md"
                value={data?.regional_survivability ?? ''}
                onChange={(e) => onUpdate('regional_survivability', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_REGIONAL_SURVIVABILITY_VALUES.map((v) => (
                  <option key={v} value={v}>{COMM_REGIONAL_SURVIVABILITY_LABELS[v] ?? v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {isPA && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Power dependency</label>
              <select
                className="form-control max-w-md"
                value={data?.power_dependency ?? ''}
                onChange={(e) => onUpdate('power_dependency', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_POWER_LANDLINE_VALUES.map((v) => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PA coverage (optional)</label>
              <select
                className="form-control max-w-md"
                value={data?.pa_coverage ?? ''}
                onChange={(e) => onUpdate('pa_coverage', e.target.value || undefined)}
              >
                <option value="">— Select —</option>
                {COMM_PA_COVERAGE_VALUES.map((v) => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {isRunner && (
          <>
            <p className="text-xs text-amber-700">{RUNNER_HELP}</p>
            <div>
              <label className="block text-sm font-medium mb-1">Procedure defined</label>
              <select
                className="form-control max-w-md"
                value={data?.procedure_defined ?? ''}
                onChange={(e) => onUpdate('procedure_defined', (e.target.value || undefined) as 'yes' | 'no' | 'unknown')}
              >
                <option value="">— Select —</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </>
        )}

        {showPaceCurveFields && (
          <>
            {zeroSustainOrCapacity && (
              <p className="text-xs text-amber-700">
                This layer will not contribute to the PACE curve if sustain hours or capacity % is 0.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Activate after (hours, 0–72)
                <HelpTooltip helpText={COMMS_FIELD_HELP.pace_activate_after} />
              </label>
              <p className="text-xs text-gray-600 mb-1">
                When does this layer become usable after outage start? 0 = immediately.
              </p>
              <input
                type="number"
                min={0}
                max={72}
                className="form-control max-w-md w-32"
                value={data?.activate_after_hours ?? ''}
                onChange={(e) =>
                  onUpdate('activate_after_hours', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Sustainment (hours, 0–96)
                <HelpTooltip helpText={COMMS_FIELD_HELP.pace_sustain_hours} />
              </label>
              <p className="text-xs text-gray-600 mb-1">
                How long can this method sustain effective voice coordination without resupply or external restoration?
              </p>
              <input
                type="number"
                min={0}
                max={96}
                className="form-control max-w-md w-32"
                value={data?.sustain_hours ?? ''}
                onChange={(e) =>
                  onUpdate('sustain_hours', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Effective capacity (%)
                <HelpTooltip helpText={COMMS_FIELD_HELP.pace_effective_capacity} />
              </label>
              <p className="text-xs text-gray-600 mb-1">
                If operating using ONLY this method, what % of normal coordination capability is retained?
              </p>
              <input
                type="number"
                min={0}
                max={100}
                className="form-control max-w-md w-32"
                value={data?.effective_capacity_pct ?? ''}
                onChange={(e) =>
                  onUpdate('effective_capacity_pct', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
          </>
        )}

        {showProvider && (isCellular || isSatellite) && (
          <div>
            <label className="block text-sm font-medium mb-1">Carrier (if known)</label>
            <p className="text-xs text-amber-700 mb-1">{TRIPWIRE_PROVIDER}</p>
            <input
              type="text"
              className="form-control max-w-md"
              value={data?.provider_name ?? ''}
              onChange={(e) => onUpdate('provider_name', e.target.value || undefined)}
              placeholder="Carrier name"
            />
          </div>
        )}
      </div>
    </div>
  );
}
