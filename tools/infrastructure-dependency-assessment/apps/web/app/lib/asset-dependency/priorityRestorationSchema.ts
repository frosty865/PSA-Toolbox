import { z } from 'zod';

export const PriorityRestorationTopicKeySchema = z.enum([
  'energy',
  'communications',
  'information_technology',
  'water',
  'wastewater',
]);

export type PriorityRestorationTopicKey = z.infer<typeof PriorityRestorationTopicKeySchema>;

/** Existence-based answer for SLA categorization questions. */
export const TriSchema = z.enum(['YES', 'NO', 'UNKNOWN']);
export type Tri = z.infer<typeof TriSchema>;

/** SLA categorization block per dependency topic. When present, used for badge/summary and validation. */
export const SlaCategorizationSchema = z
  .object({
    assessed: z.boolean().default(false),
    sla_in_place: TriSchema.default('UNKNOWN'),
    mttr_max_hours: z.number().finite().positive().nullable().default(null),
    applies_in_widespread_events: TriSchema.default('UNKNOWN'),
    clock_trigger_defined: TriSchema.default('UNKNOWN'),
    activation_required_documented: TriSchema.default('UNKNOWN'),
    escalation_path_documented: TriSchema.default('UNKNOWN'),
    full_component_coverage: TriSchema.default('UNKNOWN'),
    restoration_validation_defined: TriSchema.default('UNKNOWN'),
    documentation_accessible: TriSchema.default('UNKNOWN'),
    notes: z.string().optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (!val.assessed) return;
    if (val.sla_in_place === 'YES') {
      if (val.mttr_max_hours == null || !Number.isFinite(val.mttr_max_hours) || val.mttr_max_hours <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mttr_max_hours'],
          message: 'SLA in place: provide the SLA-defined maximum time to restoration (hours).',
        });
      }
    } else {
      if (val.mttr_max_hours != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mttr_max_hours'],
          message: 'MTTR-Max must be blank when SLA is not in place.',
        });
      }
    }
  });

export type SlaCategorization = z.infer<typeof SlaCategorizationSchema>;

export const DEFAULT_SLA_CATEGORIZATION: SlaCategorization = {
  assessed: false,
  sla_in_place: 'UNKNOWN',
  mttr_max_hours: null,
  applies_in_widespread_events: 'UNKNOWN',
  clock_trigger_defined: 'UNKNOWN',
  activation_required_documented: 'UNKNOWN',
  escalation_path_documented: 'UNKNOWN',
  full_component_coverage: 'UNKNOWN',
  restoration_validation_defined: 'UNKNOWN',
  documentation_accessible: 'UNKNOWN',
  notes: '',
};

/** True when topic has assessed and SLA in place with valid MTTR. */
export function hasSla(sla: SlaCategorization | null | undefined): boolean {
  if (!sla) return false;
  return (
    sla.assessed &&
    sla.sla_in_place === 'YES' &&
    sla.mttr_max_hours != null &&
    Number.isFinite(sla.mttr_max_hours) &&
    sla.mttr_max_hours > 0
  );
}

/** True when the SLA section has been interacted with. */
export function slaAssessed(sla: SlaCategorization | null | undefined): boolean {
  return sla?.assessed === true;
}

/** True when the PRA/SLA section is completed (SLA gate answered). Content below the add button should be hidden until this is true. */
export function isPriorityRestorationSectionCompleted(topic: PriorityRestorationTopic | null | undefined): boolean {
  return topic?.sla_categorization?.assessed === true;
}

export const SlaMttrSourceSchema = z.enum([
  'contract',
  'service_order',
  'sow',
  'other',
  'unknown',
]);
export type SlaMttrSource = z.infer<typeof SlaMttrSourceSchema>;

/** SLA reliability flag value. "yes" = documented/confirmed; "no" | "unknown" = gap. */
export const SlaFailureFlagValueSchema = z.enum(['yes', 'no', 'unknown']);
export type SlaFailureFlagValue = z.infer<typeof SlaFailureFlagValueSchema>;

export const SLA_FAILURE_FLAG_KEYS = [
  'regional_applicability',
  'clock_defined',
  'activation_required_documented',
  'escalation_defined',
  'full_component_coverage',
  'restoration_validation_defined',
  'tolerance_reviewed',
  'documentation_accessible',
] as const;

export type SlaFailureFlagKey = (typeof SLA_FAILURE_FLAG_KEYS)[number];

/** All keys optional for blank initial state; no .default so values can be undefined. */
export const SlaFailureFlagsSchema = z.object({
  regional_applicability: SlaFailureFlagValueSchema.optional(),
  clock_defined: SlaFailureFlagValueSchema.optional(),
  activation_required_documented: SlaFailureFlagValueSchema.optional(),
  escalation_defined: SlaFailureFlagValueSchema.optional(),
  full_component_coverage: SlaFailureFlagValueSchema.optional(),
  restoration_validation_defined: SlaFailureFlagValueSchema.optional(),
  tolerance_reviewed: SlaFailureFlagValueSchema.optional(),
  documentation_accessible: SlaFailureFlagValueSchema.optional(),
});
export type SlaFailureFlags = z.infer<typeof SlaFailureFlagsSchema>;

/** PRA priority category (when Federal or SLTT is selected). Matches schema PraCategory. */
const PraCategoryTopicSchema = z.enum(['UNKNOWN', 'TIER_1', 'TIER_2', 'TIER_3', 'OTHER']).nullable().optional();

export const PriorityRestorationTopicSchema = z
  .object({
    federal_standard: z.boolean().default(false),
    /** PRA priority category — subordinate to Federal or SLTT. */
    pra_category: PraCategoryTopicSchema.default(null),
    pra_category_other: z.string().max(80).nullable().optional().default(null),
    paid_sla: z.boolean().default(false),
    /** True only after the assessor has answered the SLA question (yes/no). Prevents "No SLA" when not asked. */
    sla_assessed: z.boolean().default(false),
    sla_mttr_max_hours: z.number().finite().positive().nullable().default(null),
    sla_mttr_max_source: SlaMttrSourceSchema.optional().default('unknown'),
    sla_mttr_max_notes: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    sla_failure_flags: SlaFailureFlagsSchema.optional(),
    /** New SLA categorization block. When present, takes precedence for badge/summary/validation. */
    sla_categorization: SlaCategorizationSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.sla_categorization?.assessed) {
      const sc = val.sla_categorization;
      if (sc.sla_in_place === 'YES') {
        if (sc.mttr_max_hours == null || !Number.isFinite(sc.mttr_max_hours) || sc.mttr_max_hours <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sla_categorization', 'mttr_max_hours'],
            message: 'SLA in place: provide the SLA-defined maximum time to restoration (hours).',
          });
        }
      } else if (sc.mttr_max_hours != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sla_categorization', 'mttr_max_hours'],
          message: 'MTTR-Max must be blank when SLA is not in place.',
        });
      }
      return;
    }
    if (val.paid_sla === true) {
      if (val.sla_mttr_max_hours === null || Number.isNaN(val.sla_mttr_max_hours)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sla_mttr_max_hours'],
          message:
            'SLA selected: provide the SLA-defined maximum time to restoration (hours).',
        });
      }
    }
    if (val.paid_sla === false) {
      if (val.sla_mttr_max_hours !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sla_mttr_max_hours'],
          message:
            'MTTR-Max should be blank unless an SLA/service commitment is documented.',
        });
      }
    }
  });

export type PriorityRestorationTopic = z.infer<typeof PriorityRestorationTopicSchema>;

/** Initial state is blank (undefined). */
export function getDefaultSlaFailureFlags(): Partial<SlaFailureFlags> {
  return {
    regional_applicability: undefined,
    clock_defined: undefined,
    activation_required_documented: undefined,
    escalation_defined: undefined,
    full_component_coverage: undefined,
    restoration_validation_defined: undefined,
    tolerance_reviewed: undefined,
    documentation_accessible: undefined,
  };
}

/** Number of flags where value is explicitly "no" or "unknown". Blank (undefined) is not counted. */
export function countSlaFailurePoints(topic: PriorityRestorationTopic): number {
  const flags = topic.sla_failure_flags ?? getDefaultSlaFailureFlags();
  return SLA_FAILURE_FLAG_KEYS.filter((k) => flags[k] === 'no' || flags[k] === 'unknown').length;
}

/**
 * @deprecated Use getSlaReliabilityDisplayText from @/app/lib/sla/slaReliabilitySummary for dual-track (assessor vs stakeholder) output. No "gap" in stakeholder text.
 */

export const PriorityRestorationSchema = z.object({
  energy: PriorityRestorationTopicSchema,
  communications: PriorityRestorationTopicSchema,
  information_technology: PriorityRestorationTopicSchema,
  water: PriorityRestorationTopicSchema,
  wastewater: PriorityRestorationTopicSchema,
});

export type PriorityRestoration = z.infer<typeof PriorityRestorationSchema>;

const defaultTopic: PriorityRestorationTopic = {
  federal_standard: false,
  pra_category: null,
  pra_category_other: null,
  paid_sla: false,
  sla_assessed: false,
  sla_mttr_max_hours: null,
  sla_mttr_max_source: 'unknown',
  sla_mttr_max_notes: '',
  notes: '',
  sla_failure_flags: undefined,
};

export const DEFAULT_PRIORITY_RESTORATION: PriorityRestoration = {
  energy: { ...defaultTopic },
  communications: { ...defaultTopic },
  information_technology: { ...defaultTopic },
  water: { ...defaultTopic },
  wastewater: { ...defaultTopic },
};

/** federal_standard = PRA (Federal or SLTT); paid_sla = Contractual SLA only (separate contract from PRA). */
export function isNoEvidenceSelected(topic: PriorityRestorationTopic): boolean {
  return topic.federal_standard === false && topic.paid_sla === false;
}

export type DependencyTopicKey =
  | 'energy'
  | 'communications'
  | 'information_technology'
  | 'water'
  | 'wastewater';

export type RestorationArtifactType = 'PRA' | 'SLA';

export type MappedVulnerability = {
  topic: DependencyTopicKey;
  artifact_type: RestorationArtifactType;
  vulnerability_text: string;
  ofc_stubs: string[];
  anchor_id?: string;
};

export function topicLabel(key: DependencyTopicKey): string {
  switch (key) {
    case 'energy':
      return 'Energy';
    case 'communications':
      return 'Communications';
    case 'information_technology':
      return 'Information Technology';
    case 'water':
      return 'Water';
    case 'wastewater':
      return 'Wastewater';
  }
}

export function topicAnchorPrefix(key: DependencyTopicKey): string {
  return `dep-${key.replaceAll('_', '-')}`;
}

export function hasSlaCommitment(topic: PriorityRestorationTopic): boolean {
  return topic.paid_sla === true;
}

export function getSlaMttrMaxHours(topic: PriorityRestorationTopic): number | null {
  return topic.paid_sla === true ? topic.sla_mttr_max_hours ?? null : null;
}

export function isSlaMttrMissing(topic: PriorityRestorationTopic): boolean {
  return (
    topic.paid_sla === true &&
    (topic.sla_mttr_max_hours === null || !Number.isFinite(topic.sla_mttr_max_hours))
  );
}

const DEFAULT_TOPIC_FALLBACK: PriorityRestorationTopic = {
  federal_standard: false,
  pra_category: null,
  pra_category_other: null,
  paid_sla: false,
  sla_assessed: false,
  sla_mttr_max_hours: null,
  sla_mttr_max_source: 'unknown',
  sla_mttr_max_notes: '',
  notes: '',
  sla_failure_flags: undefined,
};

/** Map Tri to legacy SlaFailureFlagValue. */
function triToFlag(tri: Tri): SlaFailureFlagValue {
  if (tri === 'YES') return 'yes';
  if (tri === 'NO') return 'no';
  return 'unknown';
}

/** Build legacy sla_failure_flags from SlaCategorization for badge/counts. */
function slaCategorizationToFlags(sc: SlaCategorization): SlaFailureFlags {
  return {
    regional_applicability: triToFlag(sc.applies_in_widespread_events),
    clock_defined: triToFlag(sc.clock_trigger_defined),
    activation_required_documented: triToFlag(sc.activation_required_documented),
    escalation_defined: triToFlag(sc.escalation_path_documented),
    full_component_coverage: triToFlag(sc.full_component_coverage),
    restoration_validation_defined: triToFlag(sc.restoration_validation_defined),
    tolerance_reviewed: 'unknown',
    documentation_accessible: triToFlag(sc.documentation_accessible),
  };
}

/**
 * Return a topic object that is safe to pass to hasSlaCommitment/getSlaMttrMaxHours.
 * When sla_categorization is present, derives paid_sla/sla_assessed/sla_mttr_max_hours and sla_failure_flags from it.
 */
export function getTopicForBadge(
  priorityRestoration: PriorityRestoration | undefined | null,
  topicKey: DependencyTopicKey
): PriorityRestorationTopic {
  const pr = priorityRestoration ?? DEFAULT_PRIORITY_RESTORATION;
  const raw = pr[topicKey];
  if (raw && typeof raw === 'object') {
    const merged = { ...DEFAULT_TOPIC_FALLBACK, ...raw } as PriorityRestorationTopic;
    const sc = merged.sla_categorization;
    if (sc && typeof sc === 'object') {
      return {
        ...merged,
        sla_assessed: sc.assessed,
        paid_sla: sc.sla_in_place === 'YES',
        sla_mttr_max_hours: sc.sla_in_place === 'YES' ? sc.mttr_max_hours : null,
        sla_failure_flags: sc.sla_in_place === 'YES' ? slaCategorizationToFlags(sc) : undefined,
      };
    }
    return merged;
  }
  return DEFAULT_TOPIC_FALLBACK;
}
