'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  type WastewaterAnswers,
  getDefaultWastewaterAnswers,
  WASTEWATER_CURVE_QUESTIONS,
  WASTEWATER_QUESTIONS,
  type YesNoUnknown,
} from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import { getWastewaterAnswersForUI, saveWastewaterAnswers } from '@/app/lib/dependencies/persistence';
import type { CategoryInput } from 'schema';
import type { PriorityRestoration } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PriorityRestorationHelpButton } from '@/components/asset-dependency/PriorityRestorationHelpButton';
import { ImpactCurveConfigCard } from '@/components/ImpactCurveConfigCard';
import { RedundancyActivationBlock } from '@/components/RedundancyActivationBlock';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfraIntroBlock } from '@/components/InfraIntroBlock';
import { INFRA_INTRO } from '@/app/lib/dependencies/infra_intro_copy';
import { useAssessment } from '@/lib/assessment-context';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { shouldShowQuestion } from '@/lib/dependencies/question-visibility';

const WASTEWATER_INTRO =
  'Answer each question. Progressive disclosure applies: some follow-ups appear only when earlier answers apply.';
const TOTAL_QUESTION_COUNT =
  WASTEWATER_CURVE_QUESTIONS.length + 14; // WW_Q1–WW_Q14

export type WastewaterQuestionnaireSectionProps = {
  embedded?: boolean;
  onCurveDataChange?: (categoryInput: CategoryInput) => void;
  existingWastewaterCategory?: Partial<CategoryInput>;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
};

export function WastewaterQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingWastewaterCategory = {},
  priorityRestoration,
  onPriorityRestorationChange,
}: WastewaterQuestionnaireSectionProps) {
  const { assessment } = useAssessment();
  const praSlaEnabled = isPraSlaEnabled(assessment);
  const defaults = getDefaultWastewaterAnswers();
  const [answers, setAnswers] = useState<WastewaterAnswers>(defaults);

  useEffect(() => {
    const stored = getWastewaterAnswersForUI();
    const cat = existingWastewaterCategory;
    if (!cat || typeof cat !== 'object') {
      setAnswers(stored);
      return;
    }
    const hasData =
      cat.requires_service !== undefined ||
      (cat as Record<string, unknown>).curve_primary_provider != null ||
      cat.time_to_impact_hours != null ||
      cat.loss_fraction_no_backup != null ||
      cat.has_backup !== undefined ||
      cat.has_backup_any !== undefined ||
      cat.recovery_time_hours != null;
    if (!hasData) {
      setAnswers(stored);
      return;
    }
    const ww = cat as Record<string, unknown>;
    setAnswers({
      ...stored,
      curve_requires_service: cat.requires_service !== false,
      curve_primary_provider: (ww.curve_primary_provider as string | undefined) ?? stored.curve_primary_provider,
      curve_time_to_impact_hours: cat.time_to_impact_hours ?? stored.curve_time_to_impact_hours,
      curve_loss_fraction_no_backup: cat.loss_fraction_no_backup ?? stored.curve_loss_fraction_no_backup,
      curve_backup_duration_hours: cat.backup_duration_hours ?? stored.curve_backup_duration_hours,
      curve_loss_fraction_with_backup: cat.loss_fraction_with_backup ?? stored.curve_loss_fraction_with_backup,
      curve_recovery_time_hours: cat.recovery_time_hours ?? stored.curve_recovery_time_hours,
      redundancy_activation: (ww.redundancy_activation as WastewaterAnswers['redundancy_activation']) ?? stored.redundancy_activation,
      WW_Q1_discharge_to_sewer: (ww.WW_Q1_discharge_to_sewer as YesNoUnknown) ?? stored.WW_Q1_discharge_to_sewer,
      WW_Q2_connection_count: (ww.WW_Q2_connection_count as number) ?? stored.WW_Q2_connection_count,
      WW_Q3_same_geographic_location: (ww.WW_Q3_same_geographic_location as YesNoUnknown) ?? stored.WW_Q3_same_geographic_location,
      WW_Q4_collocated_corridor: (ww.WW_Q4_collocated_corridor as YesNoUnknown) ?? stored.WW_Q4_collocated_corridor,
      WW_Q6_priority_restoration: (ww.WW_Q6_priority_restoration as YesNoUnknown) ?? stored.WW_Q6_priority_restoration,
      WW_Q7_contingency_plan: (ww.WW_Q7_contingency_plan as YesNoUnknown) ?? stored.WW_Q7_contingency_plan,
      WW_Q8_onsite_pumping: (ww.WW_Q8_onsite_pumping as YesNoUnknown) ?? stored.WW_Q8_onsite_pumping,
      WW_Q9_backup_power_pumps: (ww.WW_Q9_backup_power_pumps as YesNoUnknown) ?? stored.WW_Q9_backup_power_pumps,
      WW_Q10_manual_override: (ww.WW_Q10_manual_override as YesNoUnknown) ?? stored.WW_Q10_manual_override,
      WW_Q11_pump_alarming: (ww.WW_Q11_pump_alarming as YesNoUnknown) ?? stored.WW_Q11_pump_alarming,
      WW_Q12_dual_source_parts: (ww.WW_Q12_dual_source_parts as YesNoUnknown) ?? stored.WW_Q12_dual_source_parts,
      WW_Q13_holding_capacity: (ww.WW_Q13_holding_capacity as YesNoUnknown) ?? stored.WW_Q13_holding_capacity,
      WW_Q14_constraints_evaluated: (ww.WW_Q14_constraints_evaluated as YesNoUnknown) ?? stored.WW_Q14_constraints_evaluated,
    });
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    saveTimeoutRef.current = setTimeout(() => saveWastewaterAnswers(answers), 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [answers]);

  const update = useCallback((patch: Partial<WastewaterAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }, []);

  const hasOnsitePumping = answers.WW_Q8_onsite_pumping === 'yes';
  const hasBackup = answers.WW_Q13_holding_capacity === 'yes';

  const lastPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    const categoryInput: CategoryInput & Record<string, unknown> = {
      ...existingWastewaterCategory,
      requires_service: answers.curve_requires_service !== false,
      curve_primary_provider: answers.curve_requires_service === true ? (answers.curve_primary_provider ?? null) : null,
      time_to_impact_hours: answers.curve_time_to_impact_hours ?? null,
      loss_fraction_no_backup: answers.curve_loss_fraction_no_backup ?? null,
      has_backup: hasBackup,
      has_backup_any: hasBackup,
      backup_duration_hours: hasBackup ? (answers.curve_backup_duration_hours ?? null) : null,
      loss_fraction_with_backup: hasBackup ? (answers.curve_loss_fraction_with_backup ?? null) : null,
      redundancy_activation: (() => {
        if (!hasBackup) return undefined;
        const raw = answers.redundancy_activation ?? (existingWastewaterCategory as Record<string, unknown>).redundancy_activation;
        if (raw == null || typeof raw !== 'object') return undefined;
        const o = raw as Record<string, unknown>;
        return (o.mode != null ? raw : { ...o, mode: 'UNKNOWN' }) as CategoryInput['redundancy_activation'];
      })(),
      recovery_time_hours: answers.curve_recovery_time_hours ?? null,
      WW_Q1_discharge_to_sewer: answers.WW_Q1_discharge_to_sewer,
      WW_Q2_connection_count: answers.WW_Q2_connection_count ?? null,
      WW_Q3_same_geographic_location: answers.WW_Q3_same_geographic_location,
      WW_Q4_collocated_corridor: answers.WW_Q4_collocated_corridor,
      WW_Q6_priority_restoration: answers.WW_Q6_priority_restoration,
      WW_Q7_contingency_plan: answers.WW_Q7_contingency_plan,
      WW_Q8_onsite_pumping: answers.WW_Q8_onsite_pumping,
      WW_Q9_backup_power_pumps: answers.WW_Q9_backup_power_pumps,
      WW_Q10_manual_override: answers.WW_Q10_manual_override,
      WW_Q11_pump_alarming: answers.WW_Q11_pump_alarming,
      WW_Q12_dual_source_parts: answers.WW_Q12_dual_source_parts,
      WW_Q13_holding_capacity: answers.WW_Q13_holding_capacity,
      WW_Q14_constraints_evaluated: answers.WW_Q14_constraints_evaluated,
    };
    const payload = JSON.stringify(categoryInput);
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;
    if (onCurveDataChange) onCurveDataChange(categoryInput);
  }, [answers, existingWastewaterCategory, onCurveDataChange]);

  let qNum = WASTEWATER_CURVE_QUESTIONS.length + 1;

  return (
    <div className="wastewater-questionnaire-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {embedded ? (
            <h3 className="text-lg font-semibold mt-6 mb-2">Wastewater — Infrastructure (WW-1–WW-14)</h3>
          ) : (
            <h2 className="text-xl font-semibold">Wastewater Infrastructure Questionnaire</h2>
          )}
          {priorityRestoration != null && onPriorityRestorationChange != null && (
            <PriorityRestorationHelpButton
              topicKey="wastewater"
              value={priorityRestoration}
              onChange={onPriorityRestorationChange}
            />
          )}
        </div>
      </div>

      <InfraIntroBlock {...INFRA_INTRO.WASTEWATER} />

      {/* OPERATIONAL IMPACT PROFILE – Impact Curve Configuration (at top) */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: 0, marginBottom: '0.75em' }}>
        Operational Impact Profile
      </div>

      <ImpactCurveConfigCard>
        <CurveQuestionBlock
          questionId={WASTEWATER_CURVE_QUESTIONS[0].id}
          questionIndex={1}
          totalCount={TOTAL_QUESTION_COUNT}
          prompt={WASTEWATER_CURVE_QUESTIONS[0].prompt}
          helpText={WASTEWATER_CURVE_QUESTIONS[0].helpText ?? ''}
          feedsChart={true}
        >
          <YesNoRow
            value={answers.curve_requires_service}
            onChange={(val) => update({ curve_requires_service: val })}
          />
        </CurveQuestionBlock>

        {answers.curve_requires_service === true && (
          <>
            <CurveQuestionBlock
              questionId={WASTEWATER_CURVE_QUESTIONS[1].id}
              questionIndex={2}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WASTEWATER_CURVE_QUESTIONS[1].prompt}
              helpText={WASTEWATER_CURVE_QUESTIONS[1].helpText ?? ''}
              feedsChart={false}
            >
              <input
                type="text"
                value={answers.curve_primary_provider ?? ''}
                onChange={(e) => update({ curve_primary_provider: e.target.value || undefined })}
                className="form-control"
                style={{ maxWidth: '24rem' }}
                placeholder="Provider name"
                aria-label="Who provides wastewater/sewer service"
              />
            </CurveQuestionBlock>

            <CurveQuestionBlock
              questionId={WASTEWATER_CURVE_QUESTIONS[2].id}
              questionIndex={3}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WASTEWATER_CURVE_QUESTIONS[2].prompt}
              helpText={WASTEWATER_CURVE_QUESTIONS[2].helpText ?? ''}
              feedsChart={true}
            >
              <input
                type="number"
                min="0"
                max="72"
                step="1"
                value={answers.curve_time_to_impact_hours ?? ''}
                onChange={(e) =>
                  update({
                    curve_time_to_impact_hours: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="form-control"
                style={{ width: '8rem', minWidth: '8rem' }}
                placeholder="0–72"
                aria-label="Time to impact hours"
              />
            <span className="text-secondary text-sm ml-1">hours</span>
            </CurveQuestionBlock>

            <CurveQuestionBlock
              questionId={WASTEWATER_CURVE_QUESTIONS[3].id}
              questionIndex={4}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WASTEWATER_CURVE_QUESTIONS[3].prompt}
              helpText={WASTEWATER_CURVE_QUESTIONS[3].helpText ?? ''}
              feedsChart={true}
            >
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  answers.curve_loss_fraction_no_backup != null
                    ? Math.round(answers.curve_loss_fraction_no_backup * 100)
                    : ''
                }
                onChange={(e) =>
                  update({
                    curve_loss_fraction_no_backup:
                      e.target.value === '' ? null : Number(e.target.value) / 100,
                  })
                }
                className="form-control"
                style={{ width: '8rem', minWidth: '8rem' }}
                placeholder="0–100"
                aria-label="Loss fraction without backup"
              />
            <span className="text-secondary text-sm ml-1">%</span>
            </CurveQuestionBlock>

            {hasBackup && (
              <>
                <RedundancyActivationBlock
                  value={(answers as Record<string, unknown>).redundancy_activation as React.ComponentProps<typeof RedundancyActivationBlock>['value']}
                  onChange={(v) => update({ redundancy_activation: v })}
                  capabilityLabel="alternate wastewater capability"
                  activationDelayMin={0}
                  activationDelayMax={1440}
                  activationDelayHelp="Valves/pumps/contractors: 0–1440 minutes typical."
                />
                <CurveQuestionBlock
                  questionId={WASTEWATER_CURVE_QUESTIONS[5].id}
                  questionIndex={5}
                  totalCount={TOTAL_QUESTION_COUNT}
                  prompt={WASTEWATER_CURVE_QUESTIONS[5].prompt}
                  helpText={WASTEWATER_CURVE_QUESTIONS[5].helpText ?? ''}
                  feedsChart={true}
                >
              <input
                type="number"
                min="0"
                max="96"
                step="1"
                value={answers.curve_backup_duration_hours ?? ''}
                onChange={(e) =>
                  update({
                    curve_backup_duration_hours: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="form-control"
                style={{ width: '8rem', minWidth: '8rem' }}
                placeholder="0–96"
                aria-label="Alternate capability duration hours"
              />
            <span className="text-secondary text-sm ml-1">hours</span>
            </CurveQuestionBlock>

            <CurveQuestionBlock
              questionId={WASTEWATER_CURVE_QUESTIONS[6].id}
              questionIndex={6}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WASTEWATER_CURVE_QUESTIONS[6].prompt}
              helpText={WASTEWATER_CURVE_QUESTIONS[6].helpText ?? ''}
              feedsChart={true}
            >
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  answers.curve_loss_fraction_with_backup != null
                    ? Math.round(answers.curve_loss_fraction_with_backup * 100)
                    : ''
                }
                onChange={(e) =>
                  update({
                    curve_loss_fraction_with_backup:
                      e.target.value === '' ? null : Number(e.target.value) / 100,
                  })
                }
                className="form-control"
                style={{ width: '8rem', minWidth: '8rem' }}
                placeholder="0–100"
                aria-label="Loss fraction with backup"
              />
              <span className="text-secondary text-sm ml-1">%</span>
            </CurveQuestionBlock>
          </>
        )}

        <CurveQuestionBlock
          questionId={WASTEWATER_CURVE_QUESTIONS[7].id}
          questionIndex={hasBackup ? 7 : 5}
          totalCount={TOTAL_QUESTION_COUNT}
          prompt={WASTEWATER_CURVE_QUESTIONS[7].prompt}
          helpText={WASTEWATER_CURVE_QUESTIONS[7].helpText ?? ''}
          feedsChart={true}
        >
          <input
            type="number"
            min="0"
            max="168"
            step="1"
            value={answers.curve_recovery_time_hours ?? ''}
            onChange={(e) =>
              update({
                curve_recovery_time_hours: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="form-control"
            style={{ width: '8rem', minWidth: '8rem' }}
            placeholder="0–168"
            aria-label="Recovery time hours"
          />
          <span className="text-secondary text-sm ml-1">hours</span>
        </CurveQuestionBlock>
          </>
        )}
      </ImpactCurveConfigCard>

      {/* SECTION 1 – STRUCTURAL DEPENDENCY IDENTIFICATION */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Structural Dependency Identification
      </div>

      {answers.curve_requires_service === true && (
        <div className="space-y-4 mt-6">
          {(() => {
            let visibleIndex = WASTEWATER_CURVE_QUESTIONS.length + 1;
            return WASTEWATER_QUESTIONS.filter((q) => {
              if (!['WW_Q1', 'WW_Q2', 'WW_Q3', 'WW_Q4', 'WW_Q6', 'WW_Q7'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'WW_Q2' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              if (q.id === 'WW_Q3' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              if (q.id === 'WW_Q4' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              if (q.id === 'WW_Q6' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              if (q.id === 'WW_Q7' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WastewaterMainQuestion
                  key={question.id}
                  question={question}
                  questionIndex={questionIndex}
                  totalCount={TOTAL_QUESTION_COUNT}
                  answers={answers}
                  onUpdate={update}
                />
              );
            });
          })()}
        </div>
      )}

      {/* SECTION 2 – PHYSICAL EXPOSURE CONDITIONS */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Physical Exposure Conditions
      </div>

      {answers.curve_requires_service === true && (
        <div className="space-y-4 mt-6">
          {(() => {
            let visibleIndex = WASTEWATER_CURVE_QUESTIONS.length + 1;
            return WASTEWATER_QUESTIONS.filter((q) => {
              if (!['WW_Q8', 'WW_Q9', 'WW_Q10'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'WW_Q9' && answers.WW_Q8_onsite_pumping !== 'yes') return false;
              if (q.id === 'WW_Q10' && answers.WW_Q8_onsite_pumping !== 'yes') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WastewaterMainQuestion
                  key={question.id}
                  question={question}
                  questionIndex={questionIndex}
                  totalCount={TOTAL_QUESTION_COUNT}
                  answers={answers}
                  onUpdate={update}
                />
              );
            });
          })()}
        </div>
      )}

      {/* SECTION 3 – COORDINATION & RESTORATION PLANNING */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
        Coordination & Restoration Planning
      </div>

      {answers.curve_requires_service === true && (
        <div className="space-y-4 mt-6">
          {(() => {
            let visibleIndex = WASTEWATER_CURVE_QUESTIONS.length + 1;
            return WASTEWATER_QUESTIONS.filter((q) => {
              if (!['WW_Q11', 'WW_Q12', 'WW_Q13', 'WW_Q14'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'WW_Q11' && answers.WW_Q8_onsite_pumping !== 'yes') return false;
              if (q.id === 'WW_Q12' && answers.WW_Q8_onsite_pumping !== 'yes') return false;
              if (q.id === 'WW_Q13' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              if (q.id === 'WW_Q14' && answers.WW_Q1_discharge_to_sewer === 'no') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WastewaterMainQuestion
                  key={question.id}
                  question={question}
                  questionIndex={questionIndex}
                  totalCount={TOTAL_QUESTION_COUNT}
                  answers={answers}
                  onUpdate={update}
                />
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

const WW_ANSWER_KEY: Record<string, keyof WastewaterAnswers> = {
  'WW_Q1': 'WW_Q1_discharge_to_sewer',
  'WW_Q2': 'WW_Q2_connection_count',
  'WW_Q3': 'WW_Q3_same_geographic_location',
  'WW_Q4': 'WW_Q4_collocated_corridor',
  'WW_Q6': 'WW_Q6_priority_restoration',
  'WW_Q7': 'WW_Q7_contingency_plan',
  'WW_Q8': 'WW_Q8_onsite_pumping',
  'WW_Q9': 'WW_Q9_backup_power_pumps',
  'WW_Q10': 'WW_Q10_manual_override',
  'WW_Q11': 'WW_Q11_pump_alarming',
  'WW_Q12': 'WW_Q12_dual_source_parts',
  'WW_Q13': 'WW_Q13_holding_capacity',
  'WW_Q14': 'WW_Q14_constraints_evaluated',
};

function WastewaterMainQuestion({
  question,
  questionIndex,
  totalCount,
  answers,
  onUpdate,
}: {
  question: (typeof WASTEWATER_QUESTIONS)[number];
  questionIndex: number;
  totalCount: number;
  answers: WastewaterAnswers;
  onUpdate: (p: Partial<WastewaterAnswers>) => void;
}) {
  const qId = question.id;
  const answerKey = WW_ANSWER_KEY[qId];
  const answer = answerKey ? (answers[answerKey] as YesNoUnknown | number | undefined) : undefined;

  const handleChange = (val: YesNoUnknown) => {
    if (answerKey) onUpdate({ [answerKey]: val } as Partial<WastewaterAnswers>);
  };

  const isNumberQuestion = question.answerType === 'integer' || question.answerType === 'number';

  return (
    <section
      id={`wastewater-q-${qId}`}
      className="card mb-4"
      role="region"
      aria-labelledby={`wastewater-q-${qId}-title`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-secondary text-sm">Question {questionIndex} of {totalCount}</p>
      </div>
      <h4 id={`wastewater-q-${qId}-title`} className="card-title flex items-center gap-2">
        {question.prompt}
        {question.helpText && <HelpTooltip helpText={question.helpText} />}
      </h4>
      {isNumberQuestion ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min="0"
            max={qId === 'WW_Q2' ? '5' : '100'}
            value={answer ?? ''}
            onChange={(e) => {
              if (answerKey) onUpdate({ [answerKey]: e.target.value === '' ? undefined : Number(e.target.value) } as Partial<WastewaterAnswers>);
            }}
            className="form-control"
            style={{ width: '8rem' }}
            placeholder={qId === 'WW_Q2' ? '0–5' : '0–100'}
            aria-label={question.prompt}
          />
          {qId === 'WW_Q2' && <span className="text-secondary text-sm">connections</span>}
        </div>
      ) : (
        <div className="radio-group-vertical mt-3">
          {(['yes', 'no', 'unknown'] as const).map((value) => (
            <div key={value} className="radio-option-item">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={qId}
                  value={value}
                  checked={answer === value}
                  onChange={() => handleChange(value)}
                  aria-label={`${question.prompt}: ${value}`}
                />
                <span className="capitalize">{value}</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CurveQuestionBlock({
  questionId,
  questionIndex,
  totalCount,
  prompt,
  helpText,
  feedsChart,
  children,
}: {
  questionId: string;
  questionIndex: number;
  totalCount: number;
  prompt: string;
  helpText: string;
  feedsChart?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`wastewater-q-${questionId}`}
      className={`card mb-4 ${feedsChart ? 'border-primary' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-secondary text-sm">Question {questionIndex} of {totalCount}</p>
        {feedsChart && <span className="badge badge-primary text-xs">Feeds impact curve</span>}
      </div>
      <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
        {prompt}
        {helpText && <HelpTooltip helpText={helpText} />}
      </h4>
      {children}
    </section>
  );
}

function YesNoRow({ value, onChange }: { value?: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className="radio-group">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" checked={value === true} onChange={() => onChange(true)} className="w-4 h-4" />
        <span>Yes</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" checked={value === false} onChange={() => onChange(false)} className="w-4 h-4" />
        <span>No</span>
      </label>
    </div>
  );
}

function YesNoUnknownRow({ value, onChange }: { value?: YesNoUnknown; onChange: (val: YesNoUnknown) => void }) {
  return (
    <div className="radio-group-vertical">
      {(['yes', 'no', 'unknown'] as const).map((v) => (
        <div key={v} className="radio-option-item">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={value === v} onChange={() => onChange(v)} className="w-4 h-4" />
            <span className="capitalize">{v}</span>
          </label>
        </div>
      ))}
    </div>
  );
}
