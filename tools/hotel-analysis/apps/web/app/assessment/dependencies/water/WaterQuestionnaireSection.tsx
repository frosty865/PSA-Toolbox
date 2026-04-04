'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  type WaterAnswers,
  getDefaultWaterAnswers,
  WATER_CURVE_QUESTIONS,
  WATER_QUESTIONS,
  type YesNoUnknown,
} from '@/app/lib/dependencies/infrastructure/water_spec';
import { getWaterAnswersForUI, saveWaterAnswers } from '@/app/lib/dependencies/persistence';
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

const WATER_INTRO =
  'Answer each question. Progressive disclosure applies: some follow-ups appear only when earlier answers apply.';
const TOTAL_QUESTION_COUNT =
  WATER_CURVE_QUESTIONS.length + 18; // W_Q1–W_Q18

export type WaterQuestionnaireSectionProps = {
  embedded?: boolean;
  onCurveDataChange?: (categoryInput: CategoryInput) => void;
  existingWaterCategory?: Partial<CategoryInput>;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
};

export function WaterQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingWaterCategory = {},
  priorityRestoration,
  onPriorityRestorationChange,
}: WaterQuestionnaireSectionProps) {
  const { assessment } = useAssessment();
  const praSlaEnabled = isPraSlaEnabled(assessment);
  const defaults = getDefaultWaterAnswers();
  const [answers, setAnswers] = useState<WaterAnswers>(defaults);

  useEffect(() => {
    const stored = getWaterAnswersForUI();
    const cat = existingWaterCategory;
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
    const w = cat as Record<string, unknown>;
    setAnswers({
      ...stored,
      curve_requires_service: cat.requires_service !== false,
      curve_primary_provider: (w.curve_primary_provider as string | undefined) ?? stored.curve_primary_provider,
      curve_time_to_impact_hours: cat.time_to_impact_hours ?? stored.curve_time_to_impact_hours,
      curve_loss_fraction_no_backup: cat.loss_fraction_no_backup ?? stored.curve_loss_fraction_no_backup,
      curve_backup_duration_hours: cat.backup_duration_hours ?? stored.curve_backup_duration_hours,
      curve_loss_fraction_with_backup: cat.loss_fraction_with_backup ?? stored.curve_loss_fraction_with_backup,
      curve_recovery_time_hours: cat.recovery_time_hours ?? stored.curve_recovery_time_hours,
      W_Q1_municipal_supply: (w.W_Q1_municipal_supply as YesNoUnknown) ?? stored.W_Q1_municipal_supply,
      W_Q2_connection_count: (w.W_Q2_connection_count as number) ?? stored.W_Q2_connection_count,
      W_Q3_same_geographic_location: (w.W_Q3_same_geographic_location as YesNoUnknown) ?? stored.W_Q3_same_geographic_location,
      W_Q4_collocated_corridor: (w.W_Q4_collocated_corridor as YesNoUnknown) ?? stored.W_Q4_collocated_corridor,
      W_Q6_priority_restoration: (w.W_Q6_priority_restoration as YesNoUnknown) ?? stored.W_Q6_priority_restoration,
      W_Q7_contingency_plan: (w.W_Q7_contingency_plan as YesNoUnknown) ?? stored.W_Q7_contingency_plan,
      W_Q8_alternate_source: (w.W_Q8_alternate_source as YesNoUnknown) ?? stored.W_Q8_alternate_source,
      redundancy_activation: (w.redundancy_activation as WaterAnswers['redundancy_activation']) ?? stored.redundancy_activation,
      W_Q9_alternate_supports_core: (w.W_Q9_alternate_supports_core as YesNoUnknown) ?? stored.W_Q9_alternate_supports_core,
      W_Q10_alternate_depends_on_power: (w.W_Q10_alternate_depends_on_power as YesNoUnknown) ?? stored.W_Q10_alternate_depends_on_power,
      W_Q11_water_based_suppression: (w.W_Q11_water_based_suppression as YesNoUnknown) ?? stored.W_Q11_water_based_suppression,
      W_Q12_fire_secondary_supply: (w.W_Q12_fire_secondary_supply as YesNoUnknown) ?? stored.W_Q12_fire_secondary_supply,
      W_Q13_fire_impact_evaluated: (w.W_Q13_fire_impact_evaluated as YesNoUnknown) ?? stored.W_Q13_fire_impact_evaluated,
      W_Q14_onsite_pumping: (w.W_Q14_onsite_pumping as YesNoUnknown) ?? stored.W_Q14_onsite_pumping,
      W_Q15_backup_power_pumps: (w.W_Q15_backup_power_pumps as YesNoUnknown) ?? stored.W_Q15_backup_power_pumps,
      W_Q16_manual_override: (w.W_Q16_manual_override as YesNoUnknown) ?? stored.W_Q16_manual_override,
      W_Q17_pump_alarming: (w.W_Q17_pump_alarming as YesNoUnknown) ?? stored.W_Q17_pump_alarming,
      W_Q18_dual_source_parts: (w.W_Q18_dual_source_parts as YesNoUnknown) ?? stored.W_Q18_dual_source_parts,
    });
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    saveTimeoutRef.current = setTimeout(() => saveWaterAnswers(answers), 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [answers]);

  const update = useCallback((patch: Partial<WaterAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }, []);

  const hasAlternate = answers.W_Q8_alternate_source === 'yes';
  const hasFireSuppression = answers.W_Q11_water_based_suppression === 'yes';
  const hasOnsitePumping = answers.W_Q14_onsite_pumping === 'yes';

  const lastPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCurveDataChange) return;
    const hasBackup = answers.W_Q8_alternate_source === 'yes';
    const categoryInput: CategoryInput & Record<string, unknown> = {
      ...existingWaterCategory,
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
        const raw = answers.redundancy_activation ?? (existingWaterCategory as Record<string, unknown>).redundancy_activation;
        if (raw == null || typeof raw !== 'object') return undefined;
        const o = raw as Record<string, unknown>;
        return (o.mode != null ? raw : { ...o, mode: 'UNKNOWN' }) as CategoryInput['redundancy_activation'];
      })(),
      recovery_time_hours: answers.curve_recovery_time_hours ?? null,
      W_Q1_municipal_supply: answers.W_Q1_municipal_supply,
      W_Q2_connection_count: answers.W_Q2_connection_count ?? null,
      W_Q3_same_geographic_location: answers.W_Q3_same_geographic_location,
      W_Q4_collocated_corridor: answers.W_Q4_collocated_corridor,
      W_Q6_priority_restoration: answers.W_Q6_priority_restoration,
      W_Q7_contingency_plan: answers.W_Q7_contingency_plan,
      W_Q8_alternate_source: answers.W_Q8_alternate_source,
      W_Q9_alternate_supports_core: answers.W_Q9_alternate_supports_core,
      W_Q10_alternate_depends_on_power: answers.W_Q10_alternate_depends_on_power,
      W_Q11_water_based_suppression: answers.W_Q11_water_based_suppression,
      W_Q12_fire_secondary_supply: answers.W_Q12_fire_secondary_supply,
      W_Q13_fire_impact_evaluated: answers.W_Q13_fire_impact_evaluated,
      W_Q14_onsite_pumping: answers.W_Q14_onsite_pumping,
      W_Q15_backup_power_pumps: answers.W_Q15_backup_power_pumps,
      W_Q16_manual_override: answers.W_Q16_manual_override,
      W_Q17_pump_alarming: answers.W_Q17_pump_alarming,
      W_Q18_dual_source_parts: answers.W_Q18_dual_source_parts,
    };
    const payload = JSON.stringify(categoryInput);
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;
    onCurveDataChange(categoryInput);
  }, [answers, existingWaterCategory, onCurveDataChange]);

  let qNum = WATER_CURVE_QUESTIONS.length + 1;

  return (
    <div className="water-questionnaire-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {embedded ? (
            <h3 className="text-lg font-semibold mt-6 mb-2">Water — Infrastructure (W-1–W-18)</h3>
          ) : (
            <h2 className="text-xl font-semibold">Water Infrastructure Questionnaire</h2>
          )}
          {priorityRestoration != null && onPriorityRestorationChange != null && (
            <PriorityRestorationHelpButton
              topicKey="water"
              value={priorityRestoration}
              onChange={onPriorityRestorationChange}
              showNotes={true}
            />
          )}
        </div>
      </div>

      <InfraIntroBlock {...INFRA_INTRO.WATER} />

      {/* OPERATIONAL IMPACT PROFILE – Impact Curve Configuration (at top) */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: 0, marginBottom: '0.75em' }}>
        Operational Impact Profile
      </div>

      <ImpactCurveConfigCard>
        <CurveQuestionBlock
          questionId={WATER_CURVE_QUESTIONS[0].id}
          questionIndex={1}
          totalCount={TOTAL_QUESTION_COUNT}
          prompt={WATER_CURVE_QUESTIONS[0].prompt}
          helpText={WATER_CURVE_QUESTIONS[0].helpText ?? ''}
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
              questionId={WATER_CURVE_QUESTIONS[1].id}
              questionIndex={2}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WATER_CURVE_QUESTIONS[1].prompt}
              helpText={WATER_CURVE_QUESTIONS[1].helpText ?? ''}
              feedsChart={false}
            >
              <input
                type="text"
                value={answers.curve_primary_provider ?? ''}
                onChange={(e) => update({ curve_primary_provider: e.target.value || undefined })}
                className="form-control"
                style={{ maxWidth: '400px' }}
                placeholder="Water utility or provider name"
                aria-label="Who provides potable/process water"
              />
            </CurveQuestionBlock>

            <CurveQuestionBlock
              questionId={WATER_CURVE_QUESTIONS[2].id}
              questionIndex={3}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WATER_CURVE_QUESTIONS[2].prompt}
              helpText={WATER_CURVE_QUESTIONS[2].helpText ?? ''}
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
              questionId={WATER_CURVE_QUESTIONS[3].id}
              questionIndex={4}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WATER_CURVE_QUESTIONS[3].prompt}
              helpText={WATER_CURVE_QUESTIONS[3].helpText ?? ''}
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

            {hasAlternate && (
              <>
                <RedundancyActivationBlock
                  value={(answers as Record<string, unknown>).redundancy_activation as React.ComponentProps<typeof RedundancyActivationBlock>['value']}
                  onChange={(v) => update({ redundancy_activation: v })}
                  capabilityLabel="alternate water source"
                  activationDelayMin={0}
                  activationDelayMax={1440}
                  activationDelayHelp="Valves/pumps/contractors: 0–1440 minutes typical."
                />
                <CurveQuestionBlock
                  questionId={WATER_CURVE_QUESTIONS[5].id}
                  questionIndex={5}
                  totalCount={TOTAL_QUESTION_COUNT}
                  prompt={WATER_CURVE_QUESTIONS[5].prompt}
                  helpText={WATER_CURVE_QUESTIONS[5].helpText ?? ''}
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
                    aria-label="Alternate source duration hours"
                  />
                  <span className="text-secondary text-sm ml-1">hours</span>
                </CurveQuestionBlock>

                <CurveQuestionBlock
                  questionId={WATER_CURVE_QUESTIONS[6].id}
                  questionIndex={6}
                  totalCount={TOTAL_QUESTION_COUNT}
                  prompt={WATER_CURVE_QUESTIONS[6].prompt}
                  helpText={WATER_CURVE_QUESTIONS[6].helpText ?? ''}
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
              questionId={WATER_CURVE_QUESTIONS[7].id}
              questionIndex={hasAlternate ? 7 : 5}
              totalCount={TOTAL_QUESTION_COUNT}
              prompt={WATER_CURVE_QUESTIONS[7].prompt}
              helpText={WATER_CURVE_QUESTIONS[7].helpText ?? ''}
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
            let visibleIndex = WATER_CURVE_QUESTIONS.length + 1;
            return WATER_QUESTIONS.filter((q) => {
              if (!['W_Q1', 'W_Q2', 'W_Q3', 'W_Q4', 'W_Q6', 'W_Q7'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'W_Q2' && answers.W_Q1_municipal_supply === 'no') return false;
              if (q.id === 'W_Q3' && answers.W_Q1_municipal_supply === 'no') return false;
              if (q.id === 'W_Q4' && answers.W_Q1_municipal_supply === 'no') return false;
              if (q.id === 'W_Q6' && answers.W_Q1_municipal_supply === 'no') return false;
              if (q.id === 'W_Q7' && answers.W_Q1_municipal_supply === 'no') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WaterMainQuestion
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
            let visibleIndex = WATER_CURVE_QUESTIONS.length + 1;
            return WATER_QUESTIONS.filter((q) => {
              if (!['W_Q8', 'W_Q9', 'W_Q10'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'W_Q9' && answers.W_Q8_alternate_source !== 'yes') return false;
              if (q.id === 'W_Q10' && answers.W_Q8_alternate_source !== 'yes') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WaterMainQuestion
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
            let visibleIndex = WATER_CURVE_QUESTIONS.length + 1;
            return WATER_QUESTIONS.filter((q) => {
              if (!['W_Q11', 'W_Q12', 'W_Q13', 'W_Q14', 'W_Q15', 'W_Q16', 'W_Q17', 'W_Q18'].includes(q.id)) return false;
              if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
              if (q.id === 'W_Q12' && answers.W_Q11_water_based_suppression !== 'yes') return false;
              if (q.id === 'W_Q13' && answers.W_Q11_water_based_suppression !== 'yes') return false;
              if (q.id === 'W_Q15' && answers.W_Q14_onsite_pumping !== 'yes') return false;
              if (q.id === 'W_Q16' && answers.W_Q14_onsite_pumping !== 'yes') return false;
              if (q.id === 'W_Q17' && answers.W_Q14_onsite_pumping !== 'yes') return false;
              if (q.id === 'W_Q18' && answers.W_Q14_onsite_pumping !== 'yes') return false;
              return true;
            }).map((question) => {
              const questionIndex = visibleIndex++;
              return (
                <WaterMainQuestion
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

const W_ANSWER_KEY: Record<string, keyof WaterAnswers> = {
  'W_Q1': 'W_Q1_municipal_supply',
  'W_Q2': 'W_Q2_connection_count',
  'W_Q3': 'W_Q3_same_geographic_location',
  'W_Q4': 'W_Q4_collocated_corridor',
  'W_Q6': 'W_Q6_priority_restoration',
  'W_Q7': 'W_Q7_contingency_plan',
  'W_Q8': 'W_Q8_alternate_source',
  'W_Q9': 'W_Q9_alternate_supports_core',
  'W_Q10': 'W_Q10_alternate_depends_on_power',
  'W_Q11': 'W_Q11_water_based_suppression',
  'W_Q12': 'W_Q12_fire_secondary_supply',
  'W_Q13': 'W_Q13_fire_impact_evaluated',
  'W_Q14': 'W_Q14_onsite_pumping',
  'W_Q15': 'W_Q15_backup_power_pumps',
  'W_Q16': 'W_Q16_manual_override',
  'W_Q17': 'W_Q17_pump_alarming',
  'W_Q18': 'W_Q18_dual_source_parts',
};

function WaterMainQuestion({
  question,
  questionIndex,
  totalCount,
  answers,
  onUpdate,
}: {
  question: (typeof WATER_QUESTIONS)[number];
  questionIndex: number;
  totalCount: number;
  answers: WaterAnswers;
  onUpdate: (p: Partial<WaterAnswers>) => void;
}) {
  const qId = question.id;
  const answerKey = W_ANSWER_KEY[qId];
  const answer = answerKey ? (answers[answerKey] as YesNoUnknown | number | undefined) : undefined;

  const handleChange = (val: YesNoUnknown) => {
    if (answerKey) onUpdate({ [answerKey]: val } as Partial<WaterAnswers>);
  };

  const isNumberQuestion = question.answerType === 'integer' || question.answerType === 'number';

  return (
    <section
      id={`water-q-${qId}`}
      className="card mb-4"
      role="region"
      aria-labelledby={`water-q-${qId}-title`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-secondary text-sm">Question {questionIndex} of {totalCount}</p>
      </div>
      <h4 id={`water-q-${qId}-title`} className="card-title flex items-center gap-2">
        {question.prompt}
        {question.helpText && <HelpTooltip helpText={question.helpText} />}
      </h4>
      {isNumberQuestion ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min="0"
            max={qId === 'W_Q2' ? '5' : '100'}
            value={answer ?? ''}
            onChange={(e) => {
              if (answerKey) onUpdate({ [answerKey]: e.target.value === '' ? undefined : Number(e.target.value) } as Partial<WaterAnswers>);
            }}
            className="form-control"
            style={{ width: '8rem' }}
            placeholder={qId === 'W_Q2' ? '0–5' : '0–100'}
            aria-label={question.prompt}
          />
          {qId === 'W_Q2' && <span className="text-secondary text-sm">connections</span>}
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
      id={`water-q-${questionId}`}
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
