'use client';

import React, { useState } from 'react';
import { HelpIcon } from 'ui';
import { isEditableTextElement } from '@/lib/keyboard-utils';
import { NumericInput } from '@/components/ui/NumericInput';
import type {
  PriorityRestorationTopic,
  PriorityRestorationTopicKey,
  SlaFailureFlagKey,
  SlaFailureFlagValue,
  SlaCategorization,
  Tri,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import {
  isNoEvidenceSelected,
  SLA_FAILURE_FLAG_KEYS,
  getDefaultSlaFailureFlags,
  topicAnchorPrefix,
  DEFAULT_SLA_CATEGORIZATION,
  hasSla,
  slaAssessed,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PRA_CATEGORY_OPTIONS } from 'schema';
import type { PraCategory } from 'schema';

export type HelpCopy = {
  title: string;
  purpose: string;
  whyItMatters: string;
  stakeholder: string[];
  assessor: string[];
};

export const HELP_COPY: Record<PriorityRestorationTopicKey, HelpCopy> = {
  energy: {
    title: 'Priority Restoration & SLAs — Energy',
    purpose:
      'Capture whether the facility has defined restoration priority for electric power and whether restoration expectations are formally established with the utility or third parties.',
    whyItMatters:
      'Electric power underpins most other dependencies. Restoration prioritization and documented commitments reduce uncertainty and support continuity planning.',
    stakeholder: [
      'Is the facility identified as priority, critical, or essential by the utility?',
      'Are restoration expectations documented rather than assumed?',
      'Do restoration expectations align with backup power runtime and refueling arrangements?',
    ],
    assessor: [
      'Validate written confirmation of priority status when available.',
      'Identify documented restoration targets, tiers, or escalation pathways.',
      'Confirm who coordinates with the utility and how updates are received during outages.',
      'Document gaps where restoration relies on informal understanding or best effort.',
    ],
  },
  communications: {
    title: 'Priority Restoration & SLAs — Communications',
    purpose:
      'Document how voice and data services are restored following outages and whether the facility receives priority repair or emergency escalation.',
    whyItMatters:
      'Communications outages can delay emergency response, coordination, and recovery even when other systems remain operational.',
    stakeholder: [
      "Do providers recognize the facility's operational criticality?",
      'Are restoration expectations defined for primary and alternate paths (voice, data, cellular, fiber as applicable)?',
      'Are emergency escalation contacts and procedures documented and current?',
    ],
    assessor: [
      'Look for SLAs or written service commitments defining response/restoration.',
      'Identify priority repair clauses, escalation processes, and after-hours support expectations.',
      'Document reliance on best-effort commercial service where no commitments exist.',
    ],
  },
  information_technology: {
    title: 'Priority Restoration & SLAs — Information Technology',
    purpose:
      'Capture how IT services are restored after disruption, including internally managed systems and externally managed services.',
    whyItMatters:
      'Restoration includes recovery, integrity checks, and validation—not just power return. Delays can halt operations or extend recovery time.',
    stakeholder: [
      'Are critical systems prioritized for restoration and validation?',
      'Are response and restoration expectations documented with IT/service providers?',
      'Are physical outages and cyber incidents addressed differently in restoration planning?',
    ],
    assessor: [
      'Confirm documented restoration objectives and decision ownership.',
      'Identify service commitments with IT or managed providers where applicable.',
      'Note where restoration depends on single points of contact or informal support.',
    ],
  },
  water: {
    title: 'Priority Restoration & SLAs — Water',
    purpose:
      'Document whether water service restoration is prioritized and how restoration expectations are established following disruption.',
    whyItMatters:
      'Loss of water can force operational shutdowns due to sanitation, cooling/process needs, or fire protection impacts.',
    stakeholder: [
      'Is the facility recognized by the utility as priority for restoration?',
      'Are restoration expectations known and documented?',
      'How long can operations continue without water before impacts occur?',
    ],
    assessor: [
      'Validate utility engagement and any documented prioritization or commitments.',
      'Identify restoration expectations and how they are communicated during outages.',
      'Document assumptions versus documented commitments.',
    ],
  },
  wastewater: {
    title: 'Priority Restoration & SLAs — Wastewater',
    purpose:
      'Capture restoration expectations for wastewater service interruptions and how outages affect continued operations.',
    whyItMatters:
      'Wastewater loss can quickly force shutdown due to health, environmental, or regulatory constraints.',
    stakeholder: [
      'Are restoration priorities defined and documented for wastewater service?',
      'Are outage impacts and operational thresholds understood?',
      'How quickly does loss of service affect operations?',
    ],
    assessor: [
      'Confirm engagement with the wastewater utility and any documented expectations.',
      'Identify restoration expectations and escalation pathways.',
      'Flag dependencies that force early shutdown even if other services remain available.',
    ],
  },
};

/** Concise PRA (Priority Restoration) help for the Federal Standard checkbox. */
function praMiniHelp(topicTitle: string): { help: string; examples: string[]; intent: string; impact: string } {
  return {
    help: `PRA (Priority Restoration) — ${topicTitle}. Select whether the facility is identified for prioritized service restoration relative to other customers during widespread outages. Select “Federal or SLTT” when the basis is documented through federal or state, local, tribal, or territorial (SLTT) guidance or standards used in planning/coordination.`,
    examples: [
      'If neither basis applies, document how restoration priority is determined and communicated during an outage.',
    ],
    intent: 'Capture whether restoration planning relies on documented federal or SLTT (state, local, tribal, territorial) guidance or standards that identify the facility for prioritized restoration during widespread outages.',
    impact: 'Clarifies the basis for priority claims, supports auditability, and helps distinguish formal recognition from informal or best-effort expectations.',
  };
}

/** Concise SLA (Service Level Agreement) help. SLA is a separate contract from PRA. */
function slaMiniHelp(topicTitle: string): { help: string; examples: string[]; intent: string; impact: string } {
  return {
    help: `SLA — ${topicTitle}. Select “Paid SLA / Contractual…” when the facility has a contractual SLA for this service; capture the SLA-defined maximum time to restoration (hours) from documentation.`,
    examples: [
      'If no SLA exists, document what service expectations are relied upon and how outages are escalated in practice.',
      'If SLA is selected, capture the SLA-defined maximum time to restoration (hours) from documentation.',
    ],
    intent: 'Capture whether the facility has a documented service level agreement or contractual commitment that defines response/restoration expectations, escalation, and support terms for this service.',
    impact: 'Documented SLAs set expectations for restoration time and escalation; gaps or "unknown" leave continuity planning and stakeholder expectations uncertain.',
  };
}

/** Intent + impact for SLA subsection questions. */
const SLA_IN_PLACE_HELP = {
  intent: 'Establish whether a formal SLA or contractual service commitment exists for restoration/support for this dependency.',
  impact: 'Drives whether MTTR is required and whether auto-mapped findings (e.g. "No documented service commitment") apply.',
};
const MTTR_HOURS_HELP = {
  intent: 'Capture the maximum time to restoration (hours) stated in the SLA or contractual commitment—from documentation, not estimated.',
  impact: 'Feeds continuity planning and MTTR-Max reporting; missing or estimated values undermine reliance on the SLA for recovery planning.',
};
const SLA_NOTES_LOCATOR_HELP = {
  intent: 'Optional reference (e.g. section or page) so the SLA commitment can be located quickly during review or incident response.',
  impact: 'Speeds verification and ensures the right document/section is used when invoking escalation or reporting on commitments.',
};

/** Intent + impact for each SLA reliability question in the categorization section. */
const SLA_RELIABILITY_QUESTION_HELP: Record<
  | 'applies_in_widespread_events'
  | 'clock_trigger_defined'
  | 'activation_required_documented'
  | 'escalation_path_documented'
  | 'full_component_coverage'
  | 'restoration_validation_defined'
  | 'documentation_accessible',
  { intent: string; impact: string }
> = {
  applies_in_widespread_events: {
    intent: 'Determine whether the SLA explicitly applies during widespread or regional incidents, when provider capacity may be constrained.',
    impact: 'Many SLAs exclude or limit commitments in force majeure or regional events; undocumented applicability leaves restoration expectations unclear during high-impact outages.',
  },
  clock_trigger_defined: {
    intent: 'Capture whether the condition that starts the SLA restoration clock (e.g. ticket opened, provider acknowledgment) is clearly defined.',
    impact: 'Without a defined trigger, disputes can arise over when the clock started and whether commitments were met.',
  },
  activation_required_documented: {
    intent: 'Capture whether the SLA requires specific customer actions to activate restoration commitments and whether those actions are documented.',
    impact: 'Undocumented activation steps can delay or invalidate SLA commitments if the provider deems the SLA not activated.',
  },
  escalation_path_documented: {
    intent: 'Establish whether escalation paths (roles/channels) are documented and known to personnel responsible for incident response.',
    impact: 'Missing or unknown escalation paths delay escalation and can prevent the organization from invoking contractual commitments.',
  },
  full_component_coverage: {
    intent: 'Establish whether the SLA applies to all components required for full service restoration, not just a subset.',
    impact: 'Partial coverage can leave critical components without commitment and extend effective restoration time beyond the stated MTTR.',
  },
  restoration_validation_defined: {
    intent: 'Capture whether the SLA defines how restoration is validated (e.g. service restored vs stable vs customer verification).',
    impact: 'Unclear validation can lead to disagreement on when the clock stops and whether the commitment was met.',
  },
  documentation_accessible: {
    intent: 'Establish whether SLA documentation is readily accessible to personnel responsible for incident response and continuity actions.',
    impact: 'Inaccessible documentation undermines the ability to invoke escalation and verify commitments during an incident.',
  },
};

/** Intent + impact for legacy SLA failure-flag questions. */
const SLA_FAILURE_FLAG_HELP: Record<SlaFailureFlagKey, { intent: string; impact: string }> = {
  regional_applicability: { intent: 'Document whether the SLA explicitly applies during regional or widespread incidents.', impact: 'Limits or exclusions in regional events affect reliance on the SLA for continuity planning.' },
  clock_defined: { intent: 'Document whether the SLA defines when the restoration clock starts and stops.', impact: 'Unclear clock definition can lead to disputes and unmet expectations.' },
  activation_required_documented: { intent: 'Document whether customer actions required to activate the SLA are defined.', impact: 'Undocumented activation can delay or invalidate commitments.' },
  escalation_defined: { intent: 'Document whether escalation paths are defined and known to responsible personnel.', impact: 'Missing escalation paths delay invocation of commitments.' },
  full_component_coverage: { intent: 'Document whether the SLA covers all components needed for full restoration.', impact: 'Partial coverage can extend effective restoration time.' },
  restoration_validation_defined: { intent: 'Document whether the SLA defines how restoration is validated.', impact: 'Unclear validation can lead to disagreement on commitment fulfillment.' },
  tolerance_reviewed: { intent: 'Document whether SLA tolerances, exclusions, or limitations have been reviewed and documented.', impact: 'Unreviewed exclusions can invalidate assumptions about restoration commitments.' },
  documentation_accessible: { intent: 'Document whether SLA documentation is accessible to incident and continuity personnel.', impact: 'Inaccessible documentation undermines use during incidents.' },
};

const NOTES_OPTIONAL_HELP = {
  intent: 'Capture how restoration priority is determined, points of contact, escalation paths, and any written commitments or gaps.',
  impact: 'Supports review, handover, and continuity planning when formal checkboxes do not fully describe the situation.',
};

export type PriorityRestorationHelpPanelProps = {
  topicKey: PriorityRestorationTopicKey;
  value: PriorityRestorationTopic;
  onChange: (next: PriorityRestorationTopic) => void;
  showNotes?: boolean;
  warningText?: string;
};

const DEFAULT_WARNING =
  'Neither checkbox is selected. If no federal or SLTT guidance or paid agreement applies, document how restoration priority is determined and how expectations are communicated during an outage.';

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

function SlaCategorizationSection({
  topicKey,
  value,
  onChange,
}: {
  topicKey: PriorityRestorationTopicKey;
  value: PriorityRestorationTopic;
  onChange: (next: PriorityRestorationTopic) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc: SlaCategorization = value.sla_categorization ?? DEFAULT_SLA_CATEGORIZATION;

  const updateSla = (patch: Partial<SlaCategorization>) => {
    const next = { ...sc, ...patch, assessed: true };
    if (next.sla_in_place !== 'YES') {
      next.mttr_max_hours = null;
    }
    const hasSla = next.sla_in_place === 'YES';
    onChange({
      ...value,
      sla_categorization: next,
      paid_sla: hasSla,
      sla_assessed: true,
      sla_mttr_max_hours: hasSla ? (next.mttr_max_hours ?? value.sla_mttr_max_hours ?? null) : null,
      sla_mttr_max_source: hasSla ? (value.sla_mttr_max_source ?? 'unknown') : 'unknown',
      sla_mttr_max_notes: hasSla ? (value.sla_mttr_max_notes ?? '') : '',
    });
  };

  const handleExpand = () => {
    if (!expanded) {
      setExpanded(true);
      if (!sc.assessed) updateSla({});
    } else {
      setExpanded(false);
    }
  };

  const slaInPlaceYes = sc.sla_in_place === 'YES';

  return (
    <div className="form-section" style={{ marginTop: '1rem', border: '1px solid var(--cisa-gray-light)', borderRadius: 4 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (isEditableTextElement(e.target)) return;
            e.preventDefault();
            handleExpand();
          }
        }}
        aria-expanded={expanded}
        className="form-label"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '0.75rem 1rem',
          background: 'var(--background-alt, #f0f4f8)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '1rem',
        }}
      >
        {expanded ? '▼' : '▶'} Service Level Agreement (SLA) — separate contract from PRA
        <HelpIcon help="SLA is a contractual commitment for this service, separate from PRA. Assess whether the facility has a contracted SLA and capture MTTR and reliability details." intent={SLA_IN_PLACE_HELP.intent} impact={SLA_IN_PLACE_HELP.impact} id={`${topicKey}-sla-section-help`} />
        {sc.assessed && (
          <span className="text-secondary" style={{ fontWeight: 400, fontSize: '0.875rem', marginLeft: '0.5rem' }}>
            {slaAssessed(sc) ? (hasSla(sc) ? 'SLA documented' : sc.sla_in_place === 'NO' ? 'No SLA' : 'Unknown') : 'Not assessed'}
          </span>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--cisa-gray-light)' }}>
          {sc.assessed && sc.sla_in_place === 'UNKNOWN' && (
            <div className="alert alert-warning mb-3" role="alert">
              SLA status not set. Select Yes or No for &quot;SLA in place?&quot; for export readiness.
            </div>
          )}
          <div className="form-group">
            <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
              Does the facility have a contracted Service Level Agreement (SLA) for this service?
              <HelpIcon help="" intent={SLA_IN_PLACE_HELP.intent} impact={SLA_IN_PLACE_HELP.impact} id={`${topicKey}-sla-in-place-help`} />
            </label>
            <div className="radio-group">
              {TRI_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`${topicKey}-sla-in-place`}
                    checked={sc.sla_in_place === o.value}
                    onChange={() => updateSla({ sla_in_place: o.value })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          {slaInPlaceYes && (
            <>
              {(!sc.mttr_max_hours || !Number.isFinite(sc.mttr_max_hours) || sc.mttr_max_hours <= 0) && (
                <div className="alert alert-warning mb-2" role="alert">
                  SLA in place: capture the SLA-defined maximum time to restoration (hours).
                </div>
              )}
              <div className="form-group">
                <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                  What is the SLA-defined maximum time to restoration (hours)?
                  <HelpIcon help="" intent={MTTR_HOURS_HELP.intent} impact={MTTR_HOURS_HELP.impact} id={`${topicKey}-sla-mttr-hours-help`} />
                </label>
                <NumericInput
                  value={sc.mttr_max_hours ?? null}
                  onValueChange={(n) => updateSla({ mttr_max_hours: n })}
                  integer
                  min={1}
                  allowEmpty
                  className="form-control"
                  style={{ maxWidth: '8rem' }}
                />
              </div>
              <div className="form-section" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--cisa-gray-light)' }}>
                <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>Reliability / failure mode</h4>
                {[
                  { key: 'applies_in_widespread_events' as const, label: 'Does the documented SLA explicitly apply during widespread or regional incidents?' },
                  { key: 'clock_trigger_defined' as const, label: 'Is the condition that starts the SLA restoration clock clearly defined (e.g., ticket opened / provider acknowledgment)?' },
                  { key: 'activation_required_documented' as const, label: 'Does the SLA require specific customer actions to activate restoration commitments, and are those actions documented?' },
                  { key: 'escalation_path_documented' as const, label: 'Are escalation paths documented and known to responsible personnel (roles/channels, not names)?' },
                  { key: 'full_component_coverage' as const, label: 'Does the SLA apply to all components required for full service restoration (not just a portion of the service)?' },
                  { key: 'restoration_validation_defined' as const, label: 'Does the SLA define how restoration is validated (service restored vs service stable vs customer verification)?' },
                  { key: 'documentation_accessible' as const, label: 'Is the SLA documentation readily accessible to personnel responsible for incident response and continuity actions?' },
                ].map(({ key, label }) => (
                  <div key={key} className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      {label}
                      <HelpIcon help="" intent={SLA_RELIABILITY_QUESTION_HELP[key].intent} impact={SLA_RELIABILITY_QUESTION_HELP[key].impact} id={`${topicKey}-sla-rel-${key}-help`} />
                    </label>
                    <select
                      value={sc[key]}
                      onChange={(e) => updateSla({ [key]: e.target.value as Tri })}
                      className="form-control"
                      style={{ maxWidth: '10rem' }}
                    >
                      {TRI_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
              Notes / locator (optional)
              <HelpIcon help="" intent={SLA_NOTES_LOCATOR_HELP.intent} impact={SLA_NOTES_LOCATOR_HELP.impact} id={`${topicKey}-sla-notes-help`} />
            </label>
            <input
              type="text"
              className="form-control"
              value={sc.notes ?? ''}
              onChange={(e) => updateSla({ notes: e.target.value })}
              placeholder="e.g. section or page reference"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Labels for SLA reliability follow-on questions (documentation/clarification focus; no guarantee of recovery). */
const SLA_FAILURE_FLAG_LABELS: Record<SlaFailureFlagKey, string> = {
  regional_applicability: 'Regional applicability documented?',
  clock_defined: 'Clock (start/stop) defined in documentation?',
  activation_required_documented: 'Activation/trigger requirements documented?',
  escalation_defined: 'Escalation path defined?',
  full_component_coverage: 'Full component/scope coverage documented?',
  restoration_validation_defined: 'Restoration validation defined?',
  tolerance_reviewed: 'Tolerance/exclusions reviewed and documented?',
  documentation_accessible: 'Documentation accessible to responsible personnel?',
};

export function PriorityRestorationHelpPanel(props: PriorityRestorationHelpPanelProps) {
  const { topicKey, value, onChange, showNotes = true } = props;
  const copy = HELP_COPY[topicKey];
  const warn = isNoEvidenceSelected(value);
  const warningText = props.warningText ?? DEFAULT_WARNING;
  const praHelp = praMiniHelp(copy.title);
  const slaHelp = slaMiniHelp(copy.title);

  return (
    <section className="card">
      <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
        {copy.title}
        <HelpIcon help="" intent={copy.purpose} impact={copy.whyItMatters} id={`${topicKey}-section-help`} />
      </h3>
      <div className="form-section" style={{ marginTop: '0.5rem' }}>
        <p className="text-secondary" style={{ marginBottom: '0.5rem' }}>
          <strong>Purpose:</strong> {copy.purpose}
        </p>
        <p className="text-secondary" style={{ marginBottom: '1rem' }}>
          <strong>Why it matters:</strong> {copy.whyItMatters}
        </p>

        {warn ? (
          <div className="alert alert-warning mb-3" role="alert">
            <strong>Missing restoration basis</strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>{warningText}</p>
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
            Do you have a Priority Restoration Agreement (PRA) for this service?
            <HelpIcon help={praHelp.help} examples={praHelp.examples} intent={praHelp.intent} impact={praHelp.impact} id={`${topicKey}-federal-pra-help`} />
          </label>
          <div className="radio-group" style={{ marginTop: '0.5rem' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${topicKey}-pra-gate`}
                checked={value.federal_standard === true}
                onChange={() =>
                  onChange({
                    ...value,
                    federal_standard: true,
                  })
                }
              />
              Yes
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${topicKey}-pra-gate`}
                checked={value.federal_standard === false}
                onChange={() =>
                  onChange({
                    ...value,
                    federal_standard: false,
                    pra_category: null,
                    pra_category_other: null,
                  })
                }
              />
              No
            </label>
          </div>
        </div>

        {value.federal_standard && (
          <div className="form-section" style={{ marginLeft: '1rem', paddingLeft: '0.75rem', borderLeft: '3px solid var(--cisa-gray-light)', marginTop: '0.75rem' }}>
            <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem' }}>
              Restoration planning relies on documented federal or SLTT (state, local, tribal, territorial) guidance or standards. PRA is separate from any contractual SLA.
            </p>
            <div className="form-group">
              <label htmlFor={`${topicKey}-pra_category`} className="form-label">
                PRA priority category
              </label>
              <select
                id={`${topicKey}-pra_category`}
                value={value.pra_category ?? ''}
                onChange={(e) => {
                  const v = e.target.value as PraCategory | '';
                  onChange({ ...value, pra_category: v || null, ...(v !== 'OTHER' ? { pra_category_other: null } : {}) });
                }}
                className="form-control"
                style={{ maxWidth: '14rem' }}
              >
                <option value="">Select...</option>
                {PRA_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {value.pra_category === 'OTHER' && (
              <div className="form-group">
                <label htmlFor={`${topicKey}-pra_category_other`} className="form-label">
                  If Other, specify
                </label>
                <input
                  id={`${topicKey}-pra_category_other`}
                  type="text"
                  maxLength={80}
                  className="form-control"
                  value={value.pra_category_other ?? ''}
                  onChange={(e) => onChange({ ...value, pra_category_other: e.target.value || null })}
                  placeholder="Specify"
                />
              </div>
            )}
          </div>
        )}

        <SlaCategorizationSection topicKey={topicKey} value={value} onChange={onChange} />

        {value.paid_sla ? (
          <>
            {value.sla_mttr_max_hours == null || !Number.isFinite(value.sla_mttr_max_hours) ? (
              <div className="alert alert-warning mb-2" role="alert">
                SLA selected but MTTR-Max not captured.
              </div>
            ) : null}
            <div className="form-group">
              <label htmlFor={`${topicKey}-sla-mttr-hours`} className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                SLA-defined maximum time to restoration (hours)
                <HelpIcon help="" intent={MTTR_HOURS_HELP.intent} impact={MTTR_HOURS_HELP.impact} id={`${topicKey}-legacy-sla-mttr-help`} />
              </label>
              <NumericInput
                id={`${topicKey}-sla-mttr-hours`}
                value={value.sla_mttr_max_hours ?? null}
                onValueChange={(n) =>
                  onChange({
                    ...value,
                    sla_mttr_max_hours: n != null && n > 0 ? n : null,
                  })
                }
                integer={false}
                min={0.25}
                step={0.25}
                allowEmpty
                className="form-control"
                style={{ maxWidth: '8rem' }}
              />
              <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                Enter the maximum restoration time stated in the documented service commitment. Do not estimate.
              </p>
            </div>
            <div className="form-group">
              <label htmlFor={`${topicKey}-sla-mttr-source`} className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                Source of MTTR-Max (optional)
                <HelpIcon help="Where the MTTR-Max value was obtained (contract, SOW, etc.)." intent="Record the document or source type for the stated MTTR-Max so reviewers can locate and verify." impact="Supports auditability and ensures the correct document is referenced during incidents." id={`${topicKey}-sla-mttr-source-help`} />
              </label>
              <select
                id={`${topicKey}-sla-mttr-source`}
                value={value.sla_mttr_max_source ?? 'unknown'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    sla_mttr_max_source: e.target.value as PriorityRestorationTopic['sla_mttr_max_source'],
                  })
                }
                className="form-control"
                style={{ maxWidth: '14rem' }}
              >
                <option value="contract">Contract</option>
                <option value="service_order">Service order</option>
                <option value="sow">SOW</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`${topicKey}-sla-mttr-notes`} className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                MTTR-Max notes / locator (optional)
                <HelpIcon help="" intent={SLA_NOTES_LOCATOR_HELP.intent} impact={SLA_NOTES_LOCATOR_HELP.impact} id={`${topicKey}-sla-mttr-notes-help`} />
              </label>
              <input
                id={`${topicKey}-sla-mttr-notes`}
                type="text"
                className="form-control"
                value={value.sla_mttr_max_notes ?? ''}
                onChange={(e) => onChange({ ...value, sla_mttr_max_notes: e.target.value })}
                placeholder="e.g. section or page reference"
              />
            </div>
            <div className="form-section" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--cisa-gray-light)' }}>
              <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>SLA reliability</h4>
              <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.75rem' }}>
                Document gaps that may affect restoration during high-impact events. SLA does not guarantee operational recovery.
              </p>
              {SLA_FAILURE_FLAG_KEYS.map((flagKey) => {
                const flags = value.sla_failure_flags ?? getDefaultSlaFailureFlags();
                const current = (flags[flagKey] ?? 'unknown') as SlaFailureFlagValue;
                const id = `${topicKey}-sla-flag-${flagKey}`;
                const anchorId = `${topicAnchorPrefix(topicKey)}-sla-flag-${flagKey}`;
                const flagHelp = SLA_FAILURE_FLAG_HELP[flagKey];
                return (
                  <div key={flagKey} id={anchorId} className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label htmlFor={id} className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      {SLA_FAILURE_FLAG_LABELS[flagKey]}
                      <HelpIcon help="" intent={flagHelp.intent} impact={flagHelp.impact} id={`${topicKey}-sla-flag-${flagKey}-help`} />
                    </label>
                    <select
                      id={id}
                      value={current}
                      onChange={(e) => {
                        const v = e.target.value as SlaFailureFlagValue;
                        onChange({
                          ...value,
                          sla_failure_flags: {
                            ...getDefaultSlaFailureFlags(),
                            ...(value.sla_failure_flags ?? {}),
                            [flagKey]: v,
                          },
                        });
                      }}
                      className="form-control"
                      style={{ maxWidth: '10rem' }}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem' }} className="priority-restoration-guidance">
          <div style={{ minWidth: '12rem', flex: '1 1 200px' }}>
            <p className="form-label" style={{ marginBottom: '0.5rem' }}>Stakeholder guidance</p>
            <ul className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', paddingLeft: '1.25rem', margin: 0 }}>
              {copy.stakeholder.map((x, idx) => (
                <li key={`stake-${idx}`}>{x}</li>
              ))}
            </ul>
          </div>
          <div style={{ minWidth: '12rem', flex: '1 1 200px' }}>
            <p className="form-label" style={{ marginBottom: '0.5rem' }}>Assessor guidance</p>
            <ul className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', paddingLeft: '1.25rem', margin: 0 }}>
              {copy.assessor.map((x, idx) => (
                <li key={`assess-${idx}`}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        {showNotes ? (
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label htmlFor={`${topicKey}-notes`} className="form-label" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
              Notes (optional)
              <HelpIcon help="" intent={NOTES_OPTIONAL_HELP.intent} impact={NOTES_OPTIONAL_HELP.impact} id={`${topicKey}-notes-help`} />
            </label>
            <textarea
              id={`${topicKey}-notes`}
              className="form-control"
              value={value.notes ?? ''}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              placeholder="Document how restoration priority is determined, points of contact, escalation paths, and any written commitments."
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
