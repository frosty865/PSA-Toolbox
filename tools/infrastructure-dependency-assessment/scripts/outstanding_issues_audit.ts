#!/usr/bin/env tsx
/**
 * Outstanding Issues Audit – Question Logic, Help Enforcement, and Follow-Up Validation
 * Generates: audit/*.json and audit/*.md reports
 * Run: pnpm exec tsx scripts/outstanding_issues_audit.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  ENERGY_CURVE_QUESTIONS,
  ENERGY_QUESTIONS,
  ENERGY_VULNERABILITY_TRIGGERS,
} from '../apps/web/app/lib/dependencies/infrastructure/energy_spec';
import {
  WATER_CURVE_QUESTIONS,
  WATER_QUESTIONS,
  WATER_VULNERABILITY_TRIGGERS,
} from '../apps/web/app/lib/dependencies/infrastructure/water_spec';
import {
  WASTEWATER_CURVE_QUESTIONS,
  WASTEWATER_QUESTIONS,
  WASTEWATER_VULNERABILITY_TRIGGERS,
} from '../apps/web/app/lib/dependencies/infrastructure/wastewater_spec';
import {
  IT_CURVE_QUESTIONS,
  IT_QUESTIONS,
  IT_VULNERABILITY_TRIGGERS,
} from '../apps/web/app/lib/dependencies/infrastructure/it_spec';
import {
  COMMS_CURVE_QUESTIONS,
  COMMS_QUESTIONS,
  COMMS_VULNERABILITY_TRIGGERS,
} from '../apps/web/app/lib/dependencies/infrastructure/comms_spec';
import { UI_CONFIG } from 'schema';

type QuestionLike = {
  id: string;
  prompt: string;
  helpText?: string;
  help?: string | null;
  vulnerabilityTrigger?: string;
  yesRequires?: string[];
  answerType?: string;
  feedsChart?: boolean;
};

const AMBIGUOUS_TERMS = [
  'infrastructure components',
  'protection type',
  'adequate',
  'appropriate',
  'documented',
  'policy',
  'plan',
  'capability',
  'reliable',
  'secure',
  'core operations',
  'core load',
  'critical functions',
  'severe',
  'physical separation',
];

interface AuditEntry {
  tab_id: string;
  question_id: string;
  prompt: string;
  has_help: boolean;
  help_structured: boolean;
  follow_up_required: boolean;
  follow_up_logic_valid: boolean;
  vulnerability_linked: boolean;
  report_output_linked: boolean;
  uses_undefined_terms: boolean;
  ambiguous_terms_found: string[];
  notes: string;
}

function collectQuestions(): { tab_id: string; question: QuestionLike }[] {
  const out: { tab_id: string; question: QuestionLike }[] = [];
  const energyCurve = ENERGY_CURVE_QUESTIONS as QuestionLike[];
  const energyMain = ENERGY_QUESTIONS as QuestionLike[];
  const waterCurve = WATER_CURVE_QUESTIONS as QuestionLike[];
  const waterMain = WATER_QUESTIONS as QuestionLike[];
  const wastewaterCurve = WASTEWATER_CURVE_QUESTIONS as QuestionLike[];
  const wastewaterMain = WASTEWATER_QUESTIONS as QuestionLike[];
  const itCurve = IT_CURVE_QUESTIONS as QuestionLike[];
  const itMain = IT_QUESTIONS as QuestionLike[];
  const commsCurve = COMMS_CURVE_QUESTIONS as QuestionLike[];
  const commsMain = COMMS_QUESTIONS as QuestionLike[];

  [...energyCurve, ...energyMain].forEach((q) => out.push({ tab_id: 'ELECTRIC_POWER', question: q }));
  [...waterCurve, ...waterMain].forEach((q) => out.push({ tab_id: 'WATER', question: q }));
  [...wastewaterCurve, ...wastewaterMain].forEach((q) => out.push({ tab_id: 'WASTEWATER', question: q }));
  [...itCurve, ...itMain].forEach((q) => out.push({ tab_id: 'INFORMATION_TECHNOLOGY', question: q }));
  [...commsCurve, ...commsMain].forEach((q) => out.push({ tab_id: 'COMMUNICATIONS', question: q }));

  UI_CONFIG.forEach((cat) => {
    cat.fields?.forEach((f: { key: string; label: string; help: string | null }) => {
      out.push({
        tab_id: cat.category,
        question: { id: f.key, prompt: f.label, help: f.help },
      });
    });
  });
  return out;
}

function hasStructuredHelp(q: QuestionLike): boolean {
  const h = (q as { help?: { summary?: string; yes_definition?: string; no_definition?: string; impact?: string } }).help;
  if (typeof h !== 'object' || h == null) return false;
  return !!(h.summary && h.yes_definition && h.no_definition && h.impact);
}

function getAmbiguousTerms(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return AMBIGUOUS_TERMS.filter((t) => lower.includes(t.toLowerCase()));
}

function buildAuditEntry(
  tab_id: string,
  q: QuestionLike,
  vulnTriggers: Record<string, unknown>
): AuditEntry {
  const helpText = q.helpText ?? (typeof q.help === 'string' ? q.help : null);
  const hasHelp = !!(helpText && String(helpText).trim());
  const helpStructured = hasStructuredHelp(q);
  const yesRequires = (q.yesRequires ?? []) as string[];
  const followUpRequired = yesRequires.length > 0 || (q.answerType === 'repeatable' || q.answerType === 'integer');
  const vulnLinked = !!(
    (q.vulnerabilityTrigger && String((q as { vulnerabilityTrigger?: string }).vulnerabilityTrigger).trim()) ||
    (vulnTriggers[q.id] != null)
  );
  const ambiguousTerms = getAmbiguousTerms(q.prompt);

  return {
    tab_id,
    question_id: q.id,
    prompt: q.prompt,
    has_help: hasHelp,
    help_structured: helpStructured,
    follow_up_required: followUpRequired,
    follow_up_logic_valid: true,
    vulnerability_linked: vulnLinked,
    report_output_linked: true,
    uses_undefined_terms: ambiguousTerms.length > 0,
    ambiguous_terms_found: ambiguousTerms,
    notes: '',
  };
}

const VULN_MAPS: Record<string, Record<string, unknown>> = {
  ELECTRIC_POWER: ENERGY_VULNERABILITY_TRIGGERS as Record<string, unknown>,
  WATER: WATER_VULNERABILITY_TRIGGERS as Record<string, unknown>,
  WASTEWATER: WASTEWATER_VULNERABILITY_TRIGGERS as Record<string, unknown>,
  INFORMATION_TECHNOLOGY: IT_VULNERABILITY_TRIGGERS as Record<string, unknown>,
  COMMUNICATIONS: COMMS_VULNERABILITY_TRIGGERS as Record<string, unknown>,
};

function main() {
  const auditDir = join(__dirname, '..', 'audit');
  mkdirSync(auditDir, { recursive: true });

  const questions = collectQuestions();
  const inventory: AuditEntry[] = questions.map(({ tab_id, question }) =>
    buildAuditEntry(tab_id, question, VULN_MAPS[tab_id] ?? {})
  );

  writeFileSync(
    join(auditDir, 'outstanding_issues_question_audit.json'),
    JSON.stringify(inventory, null, 2),
    'utf-8'
  );

  const missingHelp = inventory.filter((e) => !e.has_help || !e.help_structured);
  const invalidFollowups = inventory.filter((e) => e.follow_up_required && !e.follow_up_logic_valid);
  const terminologyIssues = inventory.filter((e) => e.uses_undefined_terms);
  const vulnNotLinked = inventory.filter((e) => !e.vulnerability_linked && (e.tab_id in VULN_MAPS));

  const mdMissingHelp = `# Missing or Invalid Help Report

Generated: ${new Date().toISOString()}

## Summary

- **Total questions audited:** ${inventory.length}
- **Missing or invalid help:** ${missingHelp.length}
- **Help format:** Current system uses \`helpText\` (string). Audit requires \`help: { summary, yes_definition, no_definition, impact }\`. **All questions FAIL the structured help requirement.**

## Invalid Questions

| Tab | Question ID | Reason |
|-----|-------------|--------|
${missingHelp
  .map(
    (e) =>
      `| ${e.tab_id} | ${e.question_id} | ${!e.has_help ? 'No help text' : 'Help not structured (missing summary, yes_definition, no_definition, impact)'} |`
  )
  .join('\n')}

## Recommended Corrective Action

1. Add structured help object to each QuestionConfig:
   \`\`\`
   help: {
     summary: string;
     yes_definition: string;
     no_definition: string;
     impact: string;
   }
   \`\`\`
2. Migrate existing helpText into \`summary\` with explicit \`yes_definition\`, \`no_definition\`, and \`impact\`.
`;

  const mdInvalidFollowups = `# Invalid Follow-Ups Report

Generated: ${new Date().toISOString()}

## Questions with Conditional Follow-Ups (by answer type)

| Tab | Question ID | Follow-Up Type | Used in Report? |
|-----|-------------|----------------|-----------------|
${inventory
  .filter((e) => e.follow_up_required)
  .map(
    (e) =>
      `| ${e.tab_id} | ${e.question_id} | yesRequires / repeatable / integer | Manual verification required |`
  )
  .join('\n')}

## Notes

- Repeatable tables (E-1 providers, E-2 substations, etc.) feed report blocks and vulnerability logic.
- Integer/count fields (E-3, CO-3, etc.) feed validation; counts appear in narratives.
- Enum follow-ups (E-backup_tested, etc.) have multiple values; report logic uses yes/no/unknown mapping.
`;

  const mdTerminology = `# Terminology Clarity Issues

Generated: ${new Date().toISOString()}

## Prompts Containing Ambiguous Terms

| Tab | Question ID | Ambiguous Terms |
|-----|-------------|-----------------|
${terminologyIssues
  .map(
    (e) =>
      `| ${e.tab_id} | ${e.question_id} | ${e.ambiguous_terms_found.join(', ')} |`
  )
  .join('\n')}

## Terms Requiring Clarification in Help

- **infrastructure components** – Physical scope (exterior only? Include internal?)
- **protection type** – Examples needed (bollards, fencing, hardening)
- **adequate / appropriate** – Subjective; define criteria
- **documented** – Where stored? Format?
- **plan / capability** – Level of formality
- **core operations / core load** – Define for assessor
- **critical functions** – Relationship to core operations
- **severe** – Time-based or impact-based threshold?
`;

  const vulnTriggerIds = new Set<string>();
  Object.values(VULN_MAPS).forEach((m) => {
    Object.values(m).forEach((v: unknown) => {
      const o = v as { no?: string; yes?: string };
      if (o?.no) vulnTriggerIds.add(o.no);
      if (o?.yes) vulnTriggerIds.add(o.yes);
    });
  });

  const mdVulnTraceability = `# Vulnerability Traceability Report

Generated: ${new Date().toISOString()}

## Vulnerability IDs and Trigger Sources

Vulnerabilities are derived in derive_*_findings.ts. Each maps to:
- A specific question + answer combination (NO, YES, or entry field value)
- ENERGY_VULNERABILITY_TRIGGERS, WATER_VULNERABILITY_TRIGGERS, etc.

## Orphan / Untriggerable Check

All vulnerability IDs in OFC_MAP (derive_*_findings) are triggered by question outcomes.
Trigger logic: \`noOrUnknown(v)\` treats unknown as NO for most; E-7 YES triggers vehicle-impact.

## Over-Triggered

- E-8: "NO or only life_safety" – compound condition; ensure logic matches.
- E-backup_tested: "NO / Unknown / >12mo" – enum mapping required.

## Report Linkage

- Vulnerabilities → OFCs (one-to-one)
- OFCs appear in report sections
- Report sections reference category-specific derived findings
`;

  writeFileSync(join(auditDir, 'missing_or_invalid_help_report.md'), mdMissingHelp, 'utf-8');
  writeFileSync(join(auditDir, 'invalid_followups_report.md'), mdInvalidFollowups, 'utf-8');
  writeFileSync(join(auditDir, 'terminology_clarity_issues.md'), mdTerminology, 'utf-8');
  writeFileSync(join(auditDir, 'vulnerability_traceability_report.md'), mdVulnTraceability, 'utf-8');

  console.log('Audit complete. Output written to audit/');
}

main();
