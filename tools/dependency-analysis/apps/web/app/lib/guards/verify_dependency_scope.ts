/**
 * Build guard: IT vs Communications crossover enforcement.
 * Run via: pnpm run verify:dependency-scope
 *
 * Hard fail. No warnings. No auto-fixes.
 * Doctrine: doctrine/dependencies/it_vs_communications_boundary.md
 */

import {
  IT_CURVE_QUESTIONS,
  IT_QUESTIONS,
  IT_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/it_spec';
import {
  COMMS_CURVE_QUESTIONS,
  COMMS_QUESTIONS,
  COMMS_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/comms_spec';

type QuestionLike = { id: string; prompt: string; helpText?: string; vulnerabilityTrigger?: string };

// ─── RULE 1: Domain keyword violations ──────────────────────────────────────

const IT_FORBIDDEN_TERMS = [
  'carrier',
  'fiber entry',
  'demarc',
  'last-mile',
  'last mile',
  'provider routing',
];

const CO_FORBIDDEN_TERMS = [
  'server',
  'application',
  'identity system',
  'internal network',
  ' lan ', // word boundary to avoid matching "plan"
  'active directory',
  'database',
  'mdf',
  'idf',
  'server room',
];

// ─── RULE 2: Vehicle impact exclusivity ─────────────────────────────────────

const VEHICLE_IMPACT_TERMS = ['vehicle impact', 'vehicle-impact'];

// ─── RULE 3: Physical protection scope ─────────────────────────────────────

const IT_EXTERIOR_FORBIDDEN = ['exterior component', 'exterior communications'];

const CO_INTERIOR_FORBIDDEN = ['server room', ' mdf ', ' idf ', 'main distribution frame', 'intermediate distribution'];

// ─── RULE 4: Redundancy ownership ──────────────────────────────────────────

const IT_REDUNDANCY_FORBIDDEN = ['carrier diversity', 'carrier circuit', 'different carriers'];

const CO_REDUNDANCY_FORBIDDEN = ['internal network path', 'redundant network path', 'lan path'];

// ─── RULE 5: Vulnerability ownership ──────────────────────────────────────

const IT_QUESTION_PATTERN = /^(IT-\d+|IT-[a-z_]+|it_[a-z_]+|curve_[a-z_]+)$/;
const CO_QUESTION_PATTERN = /^(CO-\d+|CO-[a-z_]+|COMM-SP\d+|COMM-\d+|curve_[a-z_]+)$/;

const IT_VULN_SUFFIX = '-it';
const CO_VULN_SUFFIX = '-comms';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getText(q: QuestionLike): string {
  const prompt = q.prompt ?? '';
  const help = q.helpText ?? '';
  const vuln = q.vulnerabilityTrigger ?? '';
  return [prompt, help, vuln].filter(Boolean).join(' ').toLowerCase();
}

function containsAny(text: string, terms: string[]): { found: string } | null {
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) return { found: term };
  }
  return null;
}

function extractOffending(text: string, term: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx < 0) return term;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + term.length + 20);
  return text.slice(start, end).trim();
}

type Violation = {
  questionId: string;
  tab: 'IT' | 'CO';
  rule: string;
  reason: string;
  offendingText: string;
  action: string;
};

function formatViolation(v: Violation): string {
  return [
    'ERROR: Dependency scope violation',
    `Question: ${v.questionId}`,
    `Tab: ${v.tab}`,
    `Rule: ${v.rule}`,
    `Reason: ${v.reason}`,
    `Offending text: "${v.offendingText}"`,
    `Action: ${v.action}`,
  ].join('\n');
}

// ─── Rule checks ───────────────────────────────────────────────────────────

function checkRule1DomainKeywords(
  tab: 'IT' | 'CO',
  q: QuestionLike,
  violations: Violation[],
): void {
  const text = getText(q);
  const forbidden = tab === 'IT' ? IT_FORBIDDEN_TERMS : CO_FORBIDDEN_TERMS;
  const match = containsAny(text, forbidden);
  if (match) {
    const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
    violations.push({
      questionId: q.id,
      tab,
      rule: 'DOMAIN KEYWORD VIOLATIONS',
      reason: `${tab} questions must not reference ${tab === 'IT' ? 'carrier' : 'internal IT'} terms`,
      offendingText: extractOffending(fullText, match.found),
      action: tab === 'IT' ? 'Remove carrier terminology or reassign question to CO' : 'Remove internal IT terminology or reassign question to IT',
    });
  }
}

function checkRule2VehicleImpact(tab: 'IT' | 'CO', q: QuestionLike, violations: Violation[]): void {
  if (tab !== 'IT') return;
  const text = getText(q);
  const match = containsAny(text, VEHICLE_IMPACT_TERMS);
  if (match) {
    const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
    violations.push({
      questionId: q.id,
      tab: 'IT',
      rule: 'VEHICLE IMPACT EXCLUSIVITY',
      reason: 'Vehicle impact logic is Communications-only',
      offendingText: extractOffending(fullText, match.found),
      action: 'Remove or reassign to CO',
    });
  }
}

function checkRule3PhysicalProtection(
  tab: 'IT' | 'CO',
  q: QuestionLike,
  violations: Violation[],
): void {
  const text = getText(q);
  if (tab === 'IT') {
    const match = containsAny(text, IT_EXTERIOR_FORBIDDEN);
    if (match) {
      const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
      violations.push({
        questionId: q.id,
        tab: 'IT',
        rule: 'PHYSICAL PROTECTION SCOPE',
        reason: 'IT questions must not reference exterior components',
        offendingText: extractOffending(fullText, match.found),
        action: 'Remove exterior scope or reassign to CO',
      });
    }
  } else {
    const match = containsAny(text, CO_INTERIOR_FORBIDDEN);
    if (match) {
      const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
      violations.push({
        questionId: q.id,
        tab: 'CO',
        rule: 'PHYSICAL PROTECTION SCOPE',
        reason: 'CO questions must not reference interior rooms (server room, MDF, IDF)',
        offendingText: extractOffending(fullText, match.found),
        action: 'Remove interior scope or reassign to IT',
      });
    }
  }
}

function checkRule4RedundancyOwnership(
  tab: 'IT' | 'CO',
  q: QuestionLike,
  violations: Violation[],
): void {
  const text = getText(q);
  const isRedundancyQ =
    q.id.includes('IT-3') ||
    q.id.includes('IT-4') ||
    q.id.includes('CO-3') ||
    q.id.includes('CO-4');
  if (!isRedundancyQ) return;

  if (tab === 'IT') {
    const match = containsAny(text, IT_REDUNDANCY_FORBIDDEN);
    if (match) {
      const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
      violations.push({
        questionId: q.id,
        tab: 'IT',
        rule: 'REDUNDANCY OWNERSHIP',
        reason: 'IT redundancy questions must not mention carrier diversity',
        offendingText: extractOffending(fullText, match.found),
        action: 'Remove carrier terminology or reassign to CO',
      });
    }
  } else {
    const match = containsAny(text, CO_REDUNDANCY_FORBIDDEN);
    if (match) {
      const fullText = [q.prompt, q.helpText, q.vulnerabilityTrigger].filter(Boolean).join(' ');
      violations.push({
        questionId: q.id,
        tab: 'CO',
        rule: 'REDUNDANCY OWNERSHIP',
        reason: 'CO redundancy questions must not mention internal network paths',
        offendingText: extractOffending(fullText, match.found),
        action: 'Remove internal network terminology or reassign to IT',
      });
    }
  }
}

function checkRule5VulnerabilityOwnership(violations: Violation[]): void {
  for (const [qId, def] of Object.entries(IT_VULNERABILITY_TRIGGERS)) {
    const isIt = IT_QUESTION_PATTERN.test(qId);
    if (!isIt) {
      violations.push({
        questionId: qId,
        tab: 'IT',
        rule: 'VULNERABILITY OWNERSHIP',
        reason: 'IT vulnerability triggers must only reference IT questions',
        offendingText: `Question ID "${qId}" in IT_VULNERABILITY_TRIGGERS`,
        action: 'Remove from IT triggers or reassign to CO_VULNERABILITY_TRIGGERS',
      });
    }
    const vulnIds: string[] = [];
    if (def?.no) vulnIds.push(def.no);
    if (def?.yes) vulnIds.push(def.yes);
    for (const e of def?.entry ?? []) {
      if ((e as { vulnerability_id?: string }).vulnerability_id) {
        vulnIds.push((e as { vulnerability_id: string }).vulnerability_id);
      }
    }
    for (const vid of vulnIds) {
      if (vid.endsWith(CO_VULN_SUFFIX)) {
        violations.push({
          questionId: qId,
          tab: 'IT',
          rule: 'VULNERABILITY OWNERSHIP',
          reason: 'An IT question must not trigger a CO vulnerability',
          offendingText: `${qId} triggers ${vid}`,
          action: 'Use IT vulnerability or remove trigger',
        });
      }
    }
  }

  for (const [qId, def] of Object.entries(COMMS_VULNERABILITY_TRIGGERS)) {
    const isCo = CO_QUESTION_PATTERN.test(qId);
    if (!isCo) {
      violations.push({
        questionId: qId,
        tab: 'CO',
        rule: 'VULNERABILITY OWNERSHIP',
        reason: 'CO vulnerability triggers must only reference CO questions',
        offendingText: `Question ID "${qId}" in COMMS_VULNERABILITY_TRIGGERS`,
        action: 'Remove from CO triggers or reassign to IT_VULNERABILITY_TRIGGERS',
      });
    }
    const vulnIds: string[] = [];
    if (def?.no) vulnIds.push(def.no);
    if (def?.yes) vulnIds.push(def.yes);
    for (const e of def?.entry ?? []) {
      if ((e as { vulnerability_id?: string }).vulnerability_id) {
        vulnIds.push((e as { vulnerability_id: string }).vulnerability_id);
      }
    }
    for (const vid of vulnIds) {
      if (vid.endsWith(IT_VULN_SUFFIX) || vid === 'it-recovery-plan-not-exercised') {
        violations.push({
          questionId: qId,
          tab: 'CO',
          rule: 'VULNERABILITY OWNERSHIP',
          reason: 'A CO question must not trigger an IT vulnerability',
          offendingText: `${qId} triggers ${vid}`,
          action: 'Use CO vulnerability or remove trigger',
        });
      }
    }
  }
}

// ─── Main export ───────────────────────────────────────────────────────────

export function verifyDependencyScope(): { passed: boolean; errors: string[] } {
  const violations: Violation[] = [];

  const itQuestions: QuestionLike[] = [
    ...(IT_CURVE_QUESTIONS as QuestionLike[]),
    ...(IT_QUESTIONS as QuestionLike[]),
  ];
  const coQuestions: QuestionLike[] = [
    ...(COMMS_CURVE_QUESTIONS as QuestionLike[]),
    ...(COMMS_QUESTIONS as QuestionLike[]),
  ];

  for (const q of itQuestions) {
    checkRule1DomainKeywords('IT', q, violations);
    checkRule2VehicleImpact('IT', q, violations);
    checkRule3PhysicalProtection('IT', q, violations);
    checkRule4RedundancyOwnership('IT', q, violations);
  }

  for (const q of coQuestions) {
    checkRule1DomainKeywords('CO', q, violations);
    checkRule3PhysicalProtection('CO', q, violations);
    checkRule4RedundancyOwnership('CO', q, violations);
  }

  checkRule5VulnerabilityOwnership(violations);

  const errors = violations.map(formatViolation);
  return { passed: errors.length === 0, errors };
}
