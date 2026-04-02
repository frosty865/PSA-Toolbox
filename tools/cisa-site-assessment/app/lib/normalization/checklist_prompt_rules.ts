/**
 * CHECKLIST OUTPUT RULES for LLM prompts (Standard generation).
 * Add to any prompt that produces checklist items so output is declarative and passes normalization lint.
 */

export const CHECKLIST_OUTPUT_RULES = `
CHECKLIST OUTPUT RULES (MANDATORY):
- Output checklist items as declarative statements only. Do not write questions.
- Every item MUST start with "The " and include " is " or " are ".
- Do not output questions. Do not use question marks.
- Do not use "What/How/When/Why/Should" at the start of any checklist item.
- Each checklist item must describe a single required element (one sentence).
- Avoid vague phrasing. Use concrete nouns (plan, procedures, roles, warnings, contacts, notifications, coordination).
`.trim();
