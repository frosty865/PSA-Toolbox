'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  EnergyAnswersSchema,
  getDefaultEnergyAnswers,
  ENERGY_QUESTIONS,
  ENERGY_CURVE_QUESTIONS,
  EXTERIOR_ELECTRICAL_COMPONENT_OPTIONS,
  type EnergyAnswers,
  type SubstationEntry,
  type ServiceConnectionEntry,
  type ExteriorElectricalAssetProtection,
  type BackupPowerAsset,
  type FuelSupplierEntry,
  type YesNoUnknown,
} from '@/app/lib/dependencies/infrastructure/energy_spec';
import { deriveEnergyFindings } from '@/app/lib/dependencies/derive_energy_findings';

/** Yes/No/Unknown or N/A for questions that do not apply (e.g. E-4 only one service connection). */
type YesNoUnknownOrNa = 'yes' | 'no' | 'unknown' | 'na';
import { energyAnswersToElectricPowerCategoryInput } from '@/app/lib/dependencies/energy_to_category_input';
import {
  getEnergyAnswersForUI,
  loadEnergyAnswers,
  saveEnergyAnswers,
} from '@/app/lib/dependencies/persistence';
import type { CategoryInput } from 'schema';
import {
  DEFAULT_PRIORITY_RESTORATION,
  type PriorityRestoration,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PriorityRestorationHelpButton } from '@/components/asset-dependency/PriorityRestorationHelpButton';
import { ImpactCurveConfigCard } from '@/components/ImpactCurveConfigCard';
import { RedundancyActivationBlock } from '@/components/RedundancyActivationBlock';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfraIntroBlock } from '@/components/InfraIntroBlock';
import { INFRA_INTRO } from '@/app/lib/dependencies/infra_intro_copy';

const DEBUG_DEPENDENCIES = process.env.NEXT_PUBLIC_DEBUG_DEPENDENCIES === '1';

const ENERGY_INTRO =
  'Answer each question. When the answer is YES, provide the required entries (add one row per item where applicable).';

const TOTAL_QUESTION_COUNT = ENERGY_CURVE_QUESTIONS.length + ENERGY_QUESTIONS.length;

/** Curve question ids in order (index 0 = curve-1, etc.). */
const CURVE_IDS = ENERGY_CURVE_QUESTIONS.map((q) => q.id);

/** Map Zod error path to question id for scrolling/linking (e.g. E-2_substations → E-2). */
function getQuestionIdFromPath(path: (string | number)[]): string | null {
  const first = path[0];
  if (first == null || typeof first !== 'string') return null;
  const eMatch = /^E-\d+[a-z]?/i.exec(first);
  if (eMatch) return eMatch[0];
  if (first.startsWith('curve_')) {
    const curveFieldToQuestionId: Record<string, string> = {
      curve_requires_service: 'curve_requires_service',
      curve_time_to_impact_hours: 'curve_time_to_impact',
      curve_loss_fraction_no_backup: 'curve_loss_no_backup',
      curve_backup_available: 'curve_backup_available',
      curve_backup_duration_hours: 'curve_backup_duration',
      curve_loss_fraction_with_backup: 'curve_loss_with_backup',
      curve_recovery_time_hours: 'curve_recovery_time',
    };
    return curveFieldToQuestionId[first] ?? first;
  }
  return null;
}

/** Format curve backup duration (hours) for display. 0 is valid; null/undefined → "—". */
function formatRuntimeHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—';
  return `${h} hours`;
}

/** Returns visible question slot ids in display order (no gaps). Used for "Question N of M" numbering. */
function getVisibleQuestionSlots(answers: EnergyAnswers, hasBackup: boolean, requiresService: boolean): string[] {
  const slots: string[] = [];
  for (let i = 0; i < CURVE_IDS.length; i++) {
    const id = CURVE_IDS[i];
    if (id === 'curve_requires_service') {
      slots.push(`curve-${i + 1}`);
      continue;
    }
    if (id === 'curve_primary_provider' && !requiresService) continue;
    if ((id === 'curve_backup_duration' || id === 'curve_loss_with_backup') && !hasBackup) continue;
    if (
      (id === 'curve_time_to_impact' || id === 'curve_loss_no_backup' || id === 'curve_recovery_time') &&
      !requiresService
    )
      continue;
    slots.push(`curve-${i + 1}`);
  }
  const moreThanOneConnection = answers['E-3_more_than_one_connection'] === 'yes';
  for (let e = 2; e <= 11; e++) {
    if ((e === 9 || e === 10) && !hasBackup) continue;
    if (e === 4 && !moreThanOneConnection) continue; // E-4 only when >1 service connection
    const slotId = `E-${e}`;
    slots.push(slotId);
    if (e === 7 && answers['E-7_vehicle_impact_exposure'] === 'yes') {
      slots.push('E-7a');
    }
  }
  return slots;
}

export type EnergyQuestionnaireSectionProps = {
  embedded?: boolean;
  /** When provided (e.g. on Electric Power tab), derived curve is written here so the chart updates. */
  onCurveDataChange?: (categoryInput: CategoryInput) => void;
  /** Existing ELECTRIC_POWER category to merge with derived curve (agreements, supply, etc.). */
  existingElectricPowerCategory?: Partial<CategoryInput>;
  /** When provided (e.g. on Electric Power tab), uses the same Priority Restoration & SLA block as other dependency tabs. */
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
  /** Optional ref for parent to trigger save (e.g. unified Save button in nav). */
  saveRef?: React.MutableRefObject<{ save: () => void } | null>;
};

/** Reusable Energy questionnaire (curve questions + E-1–E-10). Use embedded=true when rendered inside another page (e.g. Electric Power tab). */
export function EnergyQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingElectricPowerCategory = {},
  priorityRestoration,
  onPriorityRestorationChange,
  saveRef,
}: EnergyQuestionnaireSectionProps) {
  const [answers, setAnswers] = useState<EnergyAnswers>(getDefaultEnergyAnswers);
  const [validationError, setValidationError] = useState<{ message: string; path: (string | number)[] } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const forUI = getEnergyAnswersForUI();
    setAnswers(forUI);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.info('[energy] questionsRendered=', TOTAL_QUESTION_COUNT);
    }
  }, []);

  // Auto-save to session storage (debounced) so form data persists across refresh within the session.
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    autoSaveTimeoutRef.current = setTimeout(() => {
      const derived = deriveEnergyFindings(answers);
      saveEnergyAnswers({ answers, derived });
    }, 1500);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [answers]);

  const update = useCallback((patch: Partial<EnergyAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
    setValidationError(null);
  }, []);

  // Sync derived curve to parent so the impact chart updates (when embedded on Electric Power tab).
  const lastCurvePayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCurveDataChange) return;
    const categoryInput = energyAnswersToElectricPowerCategoryInput(answers, existingElectricPowerCategory);
    const payload = JSON.stringify(categoryInput);
    if (payload === lastCurvePayloadRef.current) return;
    lastCurvePayloadRef.current = payload;
    onCurveDataChange(categoryInput);
  }, [answers, existingElectricPowerCategory, onCurveDataChange]);

  const handleSave = useCallback(() => {
    setSaveMessage(null);
    setValidationError(null);
    const result = EnergyAnswersSchema.safeParse(answers);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path ?? [];
      setValidationError({
        message: first?.message ?? 'Validation failed',
        path: Array.isArray(path) ? path : [path],
      });
      return;
    }
    const derived = deriveEnergyFindings(result.data);
    saveEnergyAnswers({ answers: result.data, derived });
    setSaveMessage('Saved. Vulnerabilities and report blocks updated.');
  }, [answers]);

  useEffect(() => {
    if (saveRef) saveRef.current = { save: handleSave };
    return () => { if (saveRef) saveRef.current = null; };
  }, [saveRef, handleSave]);

  const heading = embedded ? (
    <h3 className="text-lg font-semibold mt-6 mb-2">Energy — Infrastructure (E-1–E-11)</h3>
  ) : (
    <h2 className="ida-section-title">Energy — Infrastructure dependency</h2>
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {heading}
      </div>
      <p className="text-secondary mb-4">{ENERGY_INTRO}</p>
      <div className="mb-4">
        {!embedded && (
          <Link href="/assessment/categories/" className="ida-btn ida-btn-secondary" style={{ marginRight: '0.5rem' }}>
            ← Categories
          </Link>
        )}
        {priorityRestoration != null && onPriorityRestorationChange != null && (
          <PriorityRestorationHelpButton
            topicKey="energy"
            value={priorityRestoration}
            onChange={onPriorityRestorationChange}
            showNotes={true}
          />
        )}
        {validationError && (
          <span className="text-danger ml-3" role="alert">
            <button
              type="button"
              className="ida-btn-link text-danger"
              style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              onClick={() => {
                const qId = getQuestionIdFromPath(validationError.path);
                if (qId) document.getElementById(`energy-q-${qId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {validationError.message}
            </button>
            {' — click to go to question'}
          </span>
        )}
        {saveMessage && <span className="text-success ml-3">{saveMessage}</span>}
      </div>
      {DEBUG_DEPENDENCIES && <EnergyDiagnostics answers={answers} />}
      <InfraIntroBlock {...INFRA_INTRO.ELECTRIC_POWER} />
      <EnergyForm
        answers={answers}
        onUpdate={update}
        totalQuestionCount={TOTAL_QUESTION_COUNT}
        priorityRestoration={priorityRestoration}
        onPriorityRestorationChange={onPriorityRestorationChange}
        validationError={validationError}
      />
    </>
  );
}

function EnergyDiagnostics({ answers }: { answers: EnergyAnswers }) {
  const keyCount = typeof answers === 'object' && answers !== null ? Object.keys(answers).length : 0;
  const validation = EnergyAnswersSchema.safeParse(answers);
  const valid = validation.success;
  return (
    <div
      className="mb-4 p-3 border border-amber-500/60 bg-amber-500/5 rounded text-sm font-mono"
      role="status"
      aria-live="polite"
    >
      <div className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
        [DEBUG] Energy diagnostics (NEXT_PUBLIC_DEBUG_DEPENDENCIES=1)
      </div>
      <ul className="list-none space-y-1">
        <li>Total questions: {TOTAL_QUESTION_COUNT} (curve: {ENERGY_CURVE_QUESTIONS.length}, E-1–E-11: {ENERGY_QUESTIONS.length})</li>
        <li>answers object keys: {keyCount}</li>
        <li>schema valid: {valid ? 'yes' : 'no'}</li>
        {!valid && validation.error && (
          <li className="text-red-600 dark:text-red-400">
            first issue: {(validation.error.issues[0]?.message ?? '') as string}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Logic flow / dependencies:
 * - Q7 (E-1) providers → Q8 (E-2) substation "Utility provider" dropdown when E-1 has entries.
 * - Q9 (E-3) No (single connection) → E-5 asks for one connection label; E-3 Yes → E-5 asks for CSV/multiple.
 * - E-4 only when E-3 Yes. E-9, E-10 only when E-8 Yes. Curve 2–3–6 only when requires_service; curve 4–5 only when E-8 Yes.
 * - Priority restoration section (E-11) always available in WEB-only app.
 */
function EnergyForm({
  answers,
  onUpdate,
  totalQuestionCount,
  priorityRestoration,
  onPriorityRestorationChange,
  validationError,
}: {
  answers: EnergyAnswers;
  onUpdate: (p: Partial<EnergyAnswers>) => void;
  totalQuestionCount: number;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
  validationError?: { message: string; path: (string | number)[] } | null;
}) {
  const hasBackup = answers.curve_backup_available === 'yes';
  const requiresService = answers.curve_requires_service !== false;
  const moreThanOneConnection = answers['E-3_more_than_one_connection'] === 'yes';
  const visibleSlots = getVisibleQuestionSlots(answers, hasBackup, requiresService);
  const totalCount = visibleSlots.length;
  const errorQuestionId = validationError ? getQuestionIdFromPath(validationError.path) : null;
  const rowIndex = validationError?.path?.[1];
  const inlineErrorText =
    validationError && errorQuestionId
      ? typeof rowIndex === 'number'
        ? `Row ${rowIndex + 1}: ${validationError.message}`
        : validationError.message
      : null;

  useEffect(() => {
    if (!moreThanOneConnection) {
      if (answers['E-4_physically_separated'] !== 'na' || answers['E-4_service_connections'].length > 0) {
        onUpdate({
          'E-4_physically_separated': 'na',
          'E-4_service_connections': [],
        } as Partial<EnergyAnswers>);
      }
      return;
    }
    if (answers['E-4_physically_separated'] === 'na') {
      onUpdate({ 'E-4_physically_separated': 'unknown' } as Partial<EnergyAnswers>);
    }
  }, [answers, moreThanOneConnection, onUpdate]);
  useEffect(() => {
    if (answers['E-7_vehicle_impact_exposure'] !== 'yes' && answers['E-7a_vehicle_impact_protection'] !== 'unknown') {
      onUpdate({ 'E-7a_vehicle_impact_protection': 'unknown' } as Partial<EnergyAnswers>);
    }
  }, [answers['E-7_vehicle_impact_exposure'], answers['E-7a_vehicle_impact_protection'], onUpdate]);

  const handleBackupAssetsChange = useCallback(
    (rows: BackupPowerAsset[]) => {
      onUpdate({ 'E-8_backup_assets': rows });
    },
    [onUpdate]
  );

  return (
    <div className="energy-form">
      {/* OPERATIONAL IMPACT PROFILE – Impact Curve Configuration (at top) */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: 0, marginBottom: '0.75em' }}>
        Operational Impact Profile
      </div>

      <ImpactCurveConfigCard>
        {/* Curve questions (1–6) — feed the impact chart; 2–3–6 only when facility requires power */}
        {ENERGY_CURVE_QUESTIONS.map((q, idx) => {
        const slotId = `curve-${idx + 1}`;
        if (q.id === 'curve_primary_provider' && !requiresService) return null;
        if (
          (q.id === 'curve_backup_duration' || q.id === 'curve_loss_with_backup') &&
          !hasBackup
        ) {
          return null;
        }
        if (
          !requiresService &&
          (q.id === 'curve_time_to_impact' || q.id === 'curve_loss_no_backup' || q.id === 'curve_recovery_time')
        ) {
          return null;
        }
        return (
          <QuestionBlock
            key={q.id}
            questionId={q.id}
            questionIndex={visibleSlots.indexOf(slotId) + 1}
            totalCount={totalCount}
            prompt={q.prompt}
            helpText={q.helpText}
            vulnerabilityTrigger={q.vulnerabilityTrigger}
            feedsChart={q.feedsChart}
            inlineError={errorQuestionId === q.id ? inlineErrorText ?? undefined : undefined}
          >
            {q.id === 'curve_requires_service' && (
              <YesNoRow
                value={answers.curve_requires_service === false ? 'no' : 'yes'}
                onChange={(v) => onUpdate({ curve_requires_service: v === 'yes' })}
              />
            )}
            {q.id === 'curve_primary_provider' && requiresService && (
              <div className="mt-2">
                <input
                  type="text"
                  className="form-control w-full"
                  value={answers.curve_primary_provider ?? ''}
                  onChange={(e) => onUpdate({ curve_primary_provider: e.target.value || undefined })}
                  placeholder="Electric utility or provider name"
                  aria-label="Who provides electric power"
                />
              </div>
            )}
            {q.id === 'curve_time_to_impact' && (
              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  max={72}
                  className="form-control"
                  value={answers.curve_time_to_impact_hours ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      curve_time_to_impact_hours:
                        e.target.value === ''
                          ? undefined
                          : Math.min(72, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                  placeholder="Hours (0–72)"
                  aria-label="Time to impact hours"
                />
              </div>
            )}
            {q.id === 'curve_loss_no_backup' && (
              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="form-control"
                  value={
                    answers.curve_loss_fraction_no_backup != null
                      ? Math.round(answers.curve_loss_fraction_no_backup * 100)
                      : ''
                  }
                  onChange={(e) =>
                    onUpdate({
                      curve_loss_fraction_no_backup:
                        e.target.value === ''
                          ? undefined
                          : Math.min(1, Math.max(0, Number(e.target.value) || 0) / 100),
                    })
                  }
                  placeholder="Percent (0–100)"
                  aria-label="Loss fraction without backup"
                />
                <span className="ml-2 text-secondary">%</span>
              </div>
            )}
            {q.id === 'curve_backup_duration' && hasBackup && (
              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  max={96}
                  className="form-control"
                  value={answers.curve_backup_duration_hours ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      curve_backup_duration_hours:
                        e.target.value === ''
                          ? undefined
                          : Math.min(96, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                  placeholder="Hours (0–96)"
                  aria-label="Backup duration hours"
                />
              </div>
            )}
            {q.id === 'curve_loss_with_backup' && hasBackup && (
              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="form-control"
                  value={
                    answers.curve_loss_fraction_with_backup != null
                      ? Math.round(answers.curve_loss_fraction_with_backup * 100)
                      : ''
                  }
                  onChange={(e) =>
                    onUpdate({
                      curve_loss_fraction_with_backup:
                        e.target.value === ''
                          ? undefined
                          : Math.min(1, Math.max(0, Number(e.target.value) || 0) / 100),
                    })
                  }
                  placeholder="Percent (0–100)"
                  aria-label="Loss fraction with backup"
                />
                <span className="ml-2 text-secondary">%</span>
              </div>
            )}
            {q.id === 'curve_backup_available' && (
              <>
                <YesNoUnknownRow
                  name="curve_backup_available"
                  value={answers.curve_backup_available ?? 'unknown'}
                  onChange={(v) => onUpdate({ curve_backup_available: v })}
                />
                {hasBackup && (
                  <RedundancyActivationBlock
                    value={(answers as Record<string, unknown>).redundancy_activation as React.ComponentProps<typeof RedundancyActivationBlock>['value']}
                    onChange={(v) => onUpdate({ redundancy_activation: v })}
                    capabilityLabel="backup power"
                    activationDelayMin={0}
                    activationDelayMax={720}
                    activationDelayHelp="Automatic failover: seconds to a few minutes (0–5). Manual switch: time to initiate + confirm. Portable gen hookup can be hours."
                  />
                )}
              </>
            )}
            {q.id === 'curve_recovery_time' && (
              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  max={168}
                  className="form-control"
                  value={answers.curve_recovery_time_hours ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      curve_recovery_time_hours:
                        e.target.value === ''
                          ? undefined
                          : Math.min(168, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                  placeholder="Hours (0–168)"
                  aria-label="Recovery time hours"
                />
              </div>
            )}
          </QuestionBlock>
        );
      })}
      </ImpactCurveConfigCard>

      {/* SECTION 1 – STRUCTURAL DEPENDENCY IDENTIFICATION */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Structural Dependency Identification
      </div>

      {/* E-2 */}
      <QuestionBlock
        questionId="E-2"
        questionIndex={visibleSlots.indexOf('E-2') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[0].prompt}
        helpText={ENERGY_QUESTIONS[0].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[0].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-2' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-2" value={answers['E-2_can_identify_substations']} onChange={(v) => onUpdate({ 'E-2_can_identify_substations': v })} />
        {answers['E-2_can_identify_substations'] === 'yes' && (
          <RepeatableTable
            title="Add one row per substation."
            rows={answers['E-2_substations']}
            onRowsChange={(rows) => onUpdate({ 'E-2_substations': rows })}
            emptyRow={(): SubstationEntry => ({
              substation_name_or_id: '',
              location: undefined,
              utility_provider: '',
              designation: 'unknown',
            })}
            renderRow={(row, i, onChange) => (
              <tr key={i}>
                <td><input type="text" className="form-control" value={row.substation_name_or_id} onChange={(e) => onChange({ ...row, substation_name_or_id: e.target.value })} placeholder="Name or ID" aria-label="Substation name or ID" /></td>
                <td><input type="text" className="form-control" value={row.location ?? ''} onChange={(e) => onChange({ ...row, location: e.target.value || undefined })} placeholder="Location (optional)" aria-label="Location" /></td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    value={row.utility_provider}
                    onChange={(e) => onChange({ ...row, utility_provider: e.target.value })}
                    placeholder="Utility provider"
                    aria-label="Utility provider"
                  />
                </td>
                <td>
                  <select className="form-control" value={row.designation} onChange={(e) => onChange({ ...row, designation: e.target.value as SubstationEntry['designation'] })}>
                    {(['primary', 'secondary', 'unknown'] as const).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td><button type="button" onClick={() => onUpdate({ 'E-2_substations': answers['E-2_substations'].filter((_, j) => j !== i) })}>Remove</button></td>
              </tr>
            )}
            headers={['Substation name/ID', 'Lat/Long', 'Utility provider', 'Designation', '']}
          />
        )}
      </QuestionBlock>

      {/* E-3 */}
      <QuestionBlock
        questionId="E-3"
        questionIndex={visibleSlots.indexOf('E-3') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[1].prompt}
        helpText={ENERGY_QUESTIONS[1].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[1].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-3' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-3" value={answers['E-3_more_than_one_connection']} onChange={(v) => onUpdate({ 'E-3_more_than_one_connection': v })} />
        {answers['E-3_more_than_one_connection'] === 'yes' && (
          <div className="mt-2">
            <label>Number of service connections (≥ 2)</label>
            <input
              type="number"
              min={2}
              className="form-control"
              value={answers['E-3_service_connection_count'] ?? ''}
              onChange={(e) => onUpdate({ 'E-3_service_connection_count': e.target.value === '' ? undefined : Math.max(2, parseInt(e.target.value, 10) || 2) })}
            />
          </div>
        )}
      </QuestionBlock>

      {/* E-4 — hidden unless more than 1 service connection (E-3 Yes) */}
      {moreThanOneConnection && (
      <QuestionBlock
        questionId="E-4"
        questionIndex={visibleSlots.indexOf('E-4') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[2].prompt}
        helpText={ENERGY_QUESTIONS[2].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[2].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-4' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownOrNaRow name="E-4" value={answers['E-4_physically_separated'] as YesNoUnknownOrNa} onChange={(v) => onUpdate({ 'E-4_physically_separated': v } as Partial<EnergyAnswers>)} />
        {answers['E-4_physically_separated'] === 'yes' && (
          <RepeatableTable
            title="Add one row per service connection. Count must match E-3 when applicable."
            rows={answers['E-4_service_connections']}
            onRowsChange={(rows) => onUpdate({ 'E-4_service_connections': rows })}
            emptyRow={(): ServiceConnectionEntry => ({
              connection_label: '',
              facility_entry_location: '',
              shared_corridor_with_other_utilities: 'unknown',
            })}
            renderRow={(row, i, onChange) => (
              <tr key={i}>
                <td><input type="text" className="form-control" value={row.connection_label} onChange={(e) => onChange({ ...row, connection_label: e.target.value })} placeholder="Label" aria-label="Connection label" /></td>
                <td><input type="text" className="form-control" value={row.facility_entry_location} onChange={(e) => onChange({ ...row, facility_entry_location: e.target.value })} placeholder="e.g. 38.9072, -77.0369" aria-label="Facility entry (Lat/Long)" /></td>
                <td><input type="text" className="form-control" value={row.associated_substation ?? ''} onChange={(e) => onChange({ ...row, associated_substation: e.target.value || undefined })} placeholder="Substation (optional)" aria-label="Associated substation" /></td>
                <td>
                  <select className="form-control" value={row.shared_corridor_with_other_utilities} onChange={(e) => onChange({ ...row, shared_corridor_with_other_utilities: e.target.value as ServiceConnectionEntry['shared_corridor_with_other_utilities'] })}>
                    {(['yes', 'no', 'unknown'] as const).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                <td><button type="button" onClick={() => onUpdate({ 'E-4_service_connections': answers['E-4_service_connections'].filter((_, j) => j !== i) })}>Remove</button></td>
              </tr>
            )}
            headers={['Connection label', 'Facility entry (Lat/Long)', 'Associated substation', 'Shared corridor', '']}
          />
        )}
      </QuestionBlock>
      )}

      {/* E-5 — single connection (E-3 no): one label; multiple (E-3 yes): CSV / list */}
      <QuestionBlock
        questionId="E-5"
        questionIndex={visibleSlots.indexOf('E-5') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[3].prompt}
        helpText={ENERGY_QUESTIONS[3].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[3].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-5' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-5" value={answers['E-5_single_supports_core_ops']} onChange={(v) => onUpdate({ 'E-5_single_supports_core_ops': v })} />
        {answers['E-5_single_supports_core_ops'] === 'yes' && answers['E-5_core_ops_capable'] && (
          <div className="mt-2 grid gap-2">
            {moreThanOneConnection ? (
              <>
                <label>Capable connection label(s) (comma-separated or one per line)</label>
                <input
                  type="text"
                  className="form-control"
                  value={(answers['E-5_core_ops_capable'].capable_connection_labels ?? []).join(', ')}
                  onChange={(e) =>
                    onUpdate({
                      'E-5_core_ops_capable': {
                        ...answers['E-5_core_ops_capable']!,
                        capable_connection_labels: e.target.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                  placeholder="e.g. Connection A, Connection B"
                  aria-label="Capable connection labels"
                />
              </>
            ) : (
              <>
                <label>Connection label or description (single connection from E-3)</label>
                <input
                  type="text"
                  className="form-control"
                  value={(answers['E-5_core_ops_capable'].capable_connection_labels ?? [])[0] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate({
                      'E-5_core_ops_capable': {
                        ...answers['E-5_core_ops_capable']!,
                        capable_connection_labels: val !== '' ? [val] : [''],
                      },
                    });
                  }}
                  placeholder="e.g. Main service, Meter 123"
                  aria-label="Connection label or description"
                />
              </>
            )}
          </div>
        )}
        {answers['E-5_single_supports_core_ops'] === 'yes' && !answers['E-5_core_ops_capable'] && (
          <div className="mt-2">
            <button
              type="button"
              className="ida-btn ida-btn-secondary"
              onClick={() =>
                onUpdate({
                  'E-5_core_ops_capable': {
                    capable_connection_labels: [''],
                  },
                })
              }
            >
              Add capable connection details
            </button>
          </div>
        )}
      </QuestionBlock>

      {/* SECTION 2 – PHYSICAL EXPOSURE CONDITIONS */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Physical Exposure Conditions
      </div>

      {/* E-6 */}
      <QuestionBlock
        questionId="E-6"
        questionIndex={visibleSlots.indexOf('E-6') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[4].prompt}
        helpText={ENERGY_QUESTIONS[4].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[4].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-6' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-6" value={answers['E-6_exterior_protected']} onChange={(v) => onUpdate({ 'E-6_exterior_protected': v })} />
        {answers['E-6_exterior_protected'] === 'yes' && (
          <RepeatableTable
            title="Add one row per component type"
            rows={answers['E-6_exterior_protections']}
            onRowsChange={(rows) => onUpdate({ 'E-6_exterior_protections': rows })}
            emptyRow={(): ExteriorElectricalAssetProtection => ({
              component_type: '',
              location: '',
              protection_type: '',
            })}
            renderRow={(row, i, onChange) => (
              <tr key={i}>
                <td>
                  <select
                    value={row.component_type}
                    onChange={(e) => onChange({ ...row, component_type: e.target.value })}
                    aria-label="Component type"
                    className="form-control"
                  >
                    <option value="">Select component type</option>
                    {EXTERIOR_ELECTRICAL_COMPONENT_OPTIONS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td><input type="text" className="form-control" value={row.location} onChange={(e) => onChange({ ...row, location: e.target.value })} placeholder="e.g. 38.9072, -77.0369" aria-label="Lat/Long" /></td>
                <td><input type="text" className="form-control" value={row.protection_type} onChange={(e) => onChange({ ...row, protection_type: e.target.value })} placeholder="Protection type" aria-label="Protection type" /></td>
                <td><button type="button" onClick={() => onUpdate({ 'E-6_exterior_protections': answers['E-6_exterior_protections'].filter((_, j) => j !== i) })}>Remove</button></td>
              </tr>
            )}
            headers={['Component type', 'Lat/Long', 'Protection type', '']}
          />
        )}
      </QuestionBlock>

      {/* E-7 */}
      <QuestionBlock
        questionId="E-7"
        questionIndex={visibleSlots.indexOf('E-7') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[5].prompt}
        helpText={ENERGY_QUESTIONS[5].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[5].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-7' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow
          name="E-7"
          value={answers['E-7_vehicle_impact_exposure']}
          onChange={(v) =>
            onUpdate({
              'E-7_vehicle_impact_exposure': v,
              ...(v !== 'yes' ? { 'E-7a_vehicle_impact_protection': 'unknown' } : {}),
            })
          }
        />
      </QuestionBlock>

      {answers['E-7_vehicle_impact_exposure'] === 'yes' && (
        <QuestionBlock
          questionId="E-7a"
          questionIndex={visibleSlots.indexOf('E-7a') + 1}
          totalCount={totalCount}
          prompt={ENERGY_QUESTIONS[6].prompt}
          helpText={ENERGY_QUESTIONS[6].helpText}
          vulnerabilityTrigger={ENERGY_QUESTIONS[6].vulnerabilityTrigger}
          inlineError={errorQuestionId === 'E-7a' ? inlineErrorText ?? undefined : undefined}
        >
          <YesNoUnknownRow
            name="E-7a"
            value={answers['E-7a_vehicle_impact_protection']}
            onChange={(v) => onUpdate({ 'E-7a_vehicle_impact_protection': v })}
          />
        </QuestionBlock>
      )}

      {/* SECTION 3 – COORDINATION & RESTORATION PLANNING */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Coordination & Restoration Planning
      </div>

      {/* E-8 */}
      <QuestionBlock
        questionId="E-8"
        questionIndex={visibleSlots.indexOf('E-8') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[7].prompt}
        helpText={ENERGY_QUESTIONS[7].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[7].vulnerabilityTrigger}
        feedsChart={ENERGY_QUESTIONS[7].feedsChart}
        inlineError={errorQuestionId === 'E-8' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-8" value={answers['E-8_backup_power_available']} onChange={(v) => onUpdate({ 'E-8_backup_power_available': v })} />
        {answers['E-8_backup_power_available'] === 'yes' && (
          <RepeatableTable
            title="Add one row per backup asset. Supported functions are multi-select (life safety, critical/core services, full facility load)."
            rows={answers['E-8_backup_assets']}
            onRowsChange={handleBackupAssetsChange}
            emptyRow={(): BackupPowerAsset => ({
              asset_type: 'generator',
              supported_load_classification: [],
              capacity_kw_or_description: '',
              estimated_runtime: 'unknown',
            })}
            renderRow={(row, i, onChange) => (
              <tr key={i}>
                <td style={{ verticalAlign: 'middle' }}>
                  <select
                    value={row.asset_type}
                    onChange={(e) => onChange({ ...row, asset_type: e.target.value as BackupPowerAsset['asset_type'] })}
                    className="form-control"
                    style={{ minWidth: '7rem' }}
                    aria-label="Asset type"
                  >
                    <option value="generator">Generator</option>
                    <option value="ups">UPS</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div className="flex gap-3 flex-wrap" style={{ gap: '0.5rem 1rem' }}>
                    {(['life_safety', 'critical_core_services', 'full_facility_load'] as const).map((load) => (
                      <label key={load} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={row.supported_load_classification.includes(load)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...row.supported_load_classification, load]
                              : row.supported_load_classification.filter((l) => l !== load);
                            onChange({ ...row, supported_load_classification: next });
                          }}
                          aria-label={load.replace(/_/g, ' ')}
                        />
                        <span>{load === 'life_safety' ? 'Life Safety' : load === 'critical_core_services' ? 'Critical/Core Services' : 'Full Facility Load'}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <input
                    value={row.capacity_kw_or_description}
                    onChange={(e) => onChange({ ...row, capacity_kw_or_description: e.target.value })}
                    placeholder="e.g. 500"
                    className="form-control"
                    style={{ minWidth: '5rem' }}
                    aria-label="Capacity"
                  />
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <input
                    value={row.fuel_type ?? ''}
                    onChange={(e) => onChange({ ...row, fuel_type: e.target.value || undefined })}
                    placeholder="e.g. diesel (generator)"
                    className="form-control"
                    style={{ minWidth: '6rem' }}
                    aria-label="Fuel type"
                  />
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <span aria-label="Estimated runtime (from backup runtime input)" style={{ display: 'inline-block', minWidth: '6rem' }}>
                    {formatRuntimeHours(answers.curve_backup_duration_hours)}
                  </span>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <button type="button" className="ida-btn ida-btn-secondary ida-btn-sm" onClick={() => onUpdate({ 'E-8_backup_assets': answers['E-8_backup_assets'].filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </td>
              </tr>
            )}
            headers={['Asset type', 'Supported functions', 'Capacity (kW or desc.)', 'Fuel type', 'Est. runtime (from backup runtime input)', '']}
          />
        )}
      </QuestionBlock>

      {/* E-9 — only when E-8 is yes (backup available) */}
      {hasBackup && (
      <QuestionBlock
        questionId="E-9"
        questionIndex={visibleSlots.indexOf('E-9') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[8].prompt}
        helpText={ENERGY_QUESTIONS[8].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[8].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-9' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-9" value={answers['E-9_refuel_sustainment_established']} onChange={(v) => onUpdate({ 'E-9_refuel_sustainment_established': v })} />
        {answers['E-9_refuel_sustainment_established'] === 'yes' && (
          <div className="mt-2 grid gap-2">
            <label>Fuel source</label>
            <select
              className="form-control"
              value={answers['E-9_sustainment']?.fuel_source ?? 'unknown'}
              onChange={(e) =>
                onUpdate({
                  'E-9_sustainment': {
                    ...answers['E-9_sustainment'],
                    fuel_source: e.target.value as 'onsite' | 'external' | 'mixed' | 'unknown',
                    suppliers: answers['E-9_sustainment']?.suppliers ?? [],
                  } as EnergyAnswers['E-9_sustainment'],
                })
              }
            >
              {(['onsite', 'external', 'mixed', 'unknown'] as const).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <RepeatableTable<FuelSupplierEntry>
              title="Add one row per supplier. Optional: estimated resupply timeframe and contracted SLA."
              rows={answers['E-9_sustainment']?.suppliers ?? []}
              onRowsChange={(rows) =>
                onUpdate({
                  'E-9_sustainment': {
                    ...answers['E-9_sustainment'],
                    fuel_source: answers['E-9_sustainment']?.fuel_source ?? 'unknown',
                    suppliers: rows,
                  } as EnergyAnswers['E-9_sustainment'],
                })
              }
              emptyRow={(): FuelSupplierEntry => ({
                supplier_name: '',
                estimated_resupply_timeframe: undefined,
                contracted_sla: undefined,
              })}
              renderRow={(row, i, onChange) => (
                <tr key={i}>
                  <td>
                    <input
                      className="form-control"
                      value={row.supplier_name}
                      onChange={(e) => onChange({ ...row, supplier_name: e.target.value })}
                      placeholder="Supplier name"
                    />
                  </td>
                  <td>
                    <input
                      className="form-control"
                      value={row.estimated_resupply_timeframe ?? ''}
                      onChange={(e) => onChange({ ...row, estimated_resupply_timeframe: e.target.value || undefined })}
                      placeholder="e.g. 24–48 hours (optional)"
                    />
                  </td>
                  <td>
                    <input
                      className="form-control"
                      value={row.contracted_sla ?? ''}
                      onChange={(e) => onChange({ ...row, contracted_sla: e.target.value || undefined })}
                      placeholder="Contracted SLA (optional)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          'E-9_sustainment': {
                            ...answers['E-9_sustainment'],
                            fuel_source: answers['E-9_sustainment']?.fuel_source ?? 'unknown',
                            suppliers: (answers['E-9_sustainment']?.suppliers ?? []).filter((_, j) => j !== i),
                          } as EnergyAnswers['E-9_sustainment'],
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )}
              headers={['Supplier name', 'Estimated resupply timeframe (optional)', 'Contracted SLA (optional)', '']}
            />
          </div>
        )}
      </QuestionBlock>
      )}

      {/* E-10 — only when E-8 is yes (backup available) */}
      {hasBackup && (
      <QuestionBlock
        questionId="E-10"
        questionIndex={visibleSlots.indexOf('E-10') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[9].prompt}
        helpText={ENERGY_QUESTIONS[9].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[9].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-10' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow name="E-10" value={answers['E-10_tested_under_load']} onChange={(v) => onUpdate({ 'E-10_tested_under_load': v })} />
        {answers['E-10_tested_under_load'] === 'yes' && (
          <div className="mt-2 grid gap-2">
            <label>Test frequency</label>
            <select
              className="form-control"
              value={answers['E-10_testing']?.test_frequency ?? 'unknown'}
              onChange={(e) =>
                onUpdate({
                  'E-10_testing': {
                    ...answers['E-10_testing'],
                    test_frequency: e.target.value as 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'other' | 'unknown',
                    load_condition: answers['E-10_testing']?.load_condition ?? 'unknown',
                    last_test_date: answers['E-10_testing']?.last_test_date ?? 'unknown',
                  } as EnergyAnswers['E-10_testing'],
                })
              }
            >
              {(['monthly', 'quarterly', 'semi_annual', 'annual', 'other', 'unknown'] as const).map((v) => <option key={v} value={v}>{v.replace('_', '-')}</option>)}
            </select>
            <label>Load condition</label>
            <select
              className="form-control"
              value={answers['E-10_testing']?.load_condition ?? 'unknown'}
              onChange={(e) =>
                onUpdate({
                  'E-10_testing': {
                    ...answers['E-10_testing'],
                    test_frequency: answers['E-10_testing']?.test_frequency ?? 'unknown',
                    load_condition: e.target.value as 'full' | 'partial' | 'unknown',
                    last_test_date: answers['E-10_testing']?.last_test_date ?? 'unknown',
                  } as EnergyAnswers['E-10_testing'],
                })
              }
            >
              {(['full', 'partial', 'unknown'] as const).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <label>Last test date (or &quot;unknown&quot;)</label>
            <input
              className="form-control"
              value={answers['E-10_testing']?.last_test_date ?? ''}
              onChange={(e) =>
                onUpdate({
                  'E-10_testing': {
                    ...answers['E-10_testing'],
                    test_frequency: answers['E-10_testing']?.test_frequency ?? 'unknown',
                    load_condition: answers['E-10_testing']?.load_condition ?? 'unknown',
                    last_test_date: e.target.value,
                  } as EnergyAnswers['E-10_testing'],
                })
              }
              placeholder="e.g. January 2024 or unknown"
            />
          </div>
        )}
      </QuestionBlock>
      )}

      {/* E-11 — Provider restoration coordination */}
      <QuestionBlock
        questionId="E-11"
        questionIndex={visibleSlots.indexOf('E-11') + 1}
        totalCount={totalCount}
        prompt={ENERGY_QUESTIONS[10].prompt}
        helpText={ENERGY_QUESTIONS[10].helpText}
        vulnerabilityTrigger={ENERGY_QUESTIONS[10].vulnerabilityTrigger}
        inlineError={errorQuestionId === 'E-11' ? inlineErrorText ?? undefined : undefined}
      >
        <YesNoUnknownRow
          name="E-11"
          value={answers['E-11_provider_restoration_coordination'] ?? 'unknown'}
          onChange={(v) => onUpdate({ 'E-11_provider_restoration_coordination': v })}
        />
      </QuestionBlock>
    </div>
  );
}

function QuestionBlock({
  questionIndex,
  totalCount,
  prompt,
  helpText,
  vulnerabilityTrigger,
  feedsChart,
  questionId,
  inlineError,
  children,
}: {
  questionIndex: number;
  totalCount: number;
  prompt: string;
  helpText: string;
  vulnerabilityTrigger?: string;
  /** When true, show "Feeds impact curve" and highlight the card. */
  feedsChart?: boolean;
  /** Used for scroll target and linking validation errors to this question. */
  questionId?: string;
  /** When set, show validation error inline under the prompt (linked from Save). */
  inlineError?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={questionId ? `energy-q-${questionId}` : undefined}
      className={`card mb-4 ${feedsChart ? 'energy-question-feeds-chart' : ''} ${inlineError ? 'energy-question-has-error' : ''}`}
      aria-describedby={feedsChart ? 'feeds-chart-badge' : undefined}
      aria-invalid={inlineError ? true : undefined}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-secondary text-sm" aria-hidden="true">
          Question {questionIndex} of {totalCount}
        </p>
        {feedsChart && (
          <span
            id="feeds-chart-badge"
            className="energy-feeds-chart-badge"
            role="status"
          >
            Feeds impact curve
          </span>
        )}
      </div>
      <h3 className="card-title flex items-center gap-2">
        {prompt}
        {helpText && <HelpTooltip helpText={helpText} />}
      </h3>
      {inlineError && (
        <p className="mb-3 text-danger" style={{ fontSize: 'var(--font-size-sm)' }} role="alert">
          <strong>Validation:</strong> {inlineError}
        </p>
      )}
      {vulnerabilityTrigger && (
        <p className="mb-3 text-amber-700 dark:text-amber-400" style={{ fontSize: 'var(--font-size-sm)' }}>
          <strong>Vulnerability:</strong> {vulnerabilityTrigger}
        </p>
      )}
      {children}
    </section>
  );
}

function YesNoRow({ value, onChange }: { value: 'yes' | 'no'; onChange: (v: 'yes' | 'no') => void }) {
  return (
    <div className="radio-group">
      {(['yes', 'no'] as const).map((v) => (
        <label key={v} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="curve_requires_service" checked={value === v} onChange={() => onChange(v)} aria-label={`Requires electric power: ${v}`} />
          <span className="capitalize">{v}</span>
        </label>
      ))}
    </div>
  );
}

function YesNoUnknownRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: YesNoUnknown;
  onChange: (v: YesNoUnknown) => void;
}) {
  return (
    <div className="radio-group-vertical">
      {(['yes', 'no', 'unknown'] as const).map((v) => (
        <div key={v} className="radio-option-item">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            <span className="capitalize">{v}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

function YesNoUnknownOrNaRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: YesNoUnknownOrNa;
  onChange: (v: YesNoUnknownOrNa) => void;
}) {
  return (
    <div className="radio-group-vertical">
      {(['yes', 'no', 'unknown', 'na'] as const).map((v) => (
        <div key={v} className="radio-option-item">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            <span>{v === 'na' ? 'N/A' : v.charAt(0).toUpperCase() + v.slice(1)}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

function RepeatableTable<T>({
  title,
  rows,
  onRowsChange,
  emptyRow,
  renderRow,
  headers,
}: {
  title: string;
  rows: T[];
  onRowsChange: (rows: T[]) => void;
  emptyRow: () => T;
  renderRow: (row: T, index: number, onChange: (row: T) => void) => React.ReactNode;
  headers: string[];
}) {
  const updateRow = (index: number, row: T) => {
    const next = [...rows];
    next[index] = row;
    onRowsChange(next);
  };
  return (
    <div className="mt-2">
      <p className="text-secondary mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>{title}</p>
      <table className="table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => renderRow(row, i, (r) => updateRow(i, r)))}
        </tbody>
      </table>
      <button
        type="button"
        className="ida-btn ida-btn-secondary mt-2"
        onClick={() => onRowsChange([...rows, emptyRow()])}
      >
        Add entry
      </button>
    </div>
  );
}
