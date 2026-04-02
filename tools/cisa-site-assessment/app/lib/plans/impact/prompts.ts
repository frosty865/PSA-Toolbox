/**
 * Ollama prompts for Impact Statements — two-pass: (A) evidence bullets, (B) if_missing / if_present.
 * Non-prescriptive; citation-grounded; one sentence each.
 */

// ---------------------------------------------------------------------------
// PASS A: Evidence bullets (per section)
// ---------------------------------------------------------------------------

export const IMPACT_PASS_A_SYSTEM_PROMPT = `You extract evidence bullets from plan guidance for a specific plan section.

Rules:
- Use ONLY the provided chunks.
- Return 3–6 short evidence bullets.
- Each bullet must have 1–2 citations.
- No recommendations. No "should/must". No implementation detail.
- Output STRICT JSON only.

OUTPUT JSON:
{
  "title": "<section title>",
  "bullets": [
    {
      "text": "<short evidence bullet>",
      "citations": [{"source_registry_id":"...","chunk_id":"...","locator":"..."}]
    }
  ]
}`.trim();

export const IMPACT_PASS_A_OUTPUT_SCHEMA = `{
  "title": "<section title>",
  "bullets": [
    {
      "text": "<short evidence bullet>",
      "citations": [{"source_registry_id":"...","chunk_id":"...","locator":"..."}]
    }
  ]
}`;

/**
 * Build user message for PASS A: section title + relevant chunks.
 */
export function buildImpactPassAUserMessage(
  sectionTitle: string,
  chunkText: string
): string {
  return `Section title: ${sectionTitle}
Relevant chunks:
<<<
${chunkText}
>>>

END OF PROMPT.`.trim();
}

// ---------------------------------------------------------------------------
// PASS B: Impact statements (per section)
// ---------------------------------------------------------------------------

export const IMPACT_PASS_B_SYSTEM_PROMPT = `You write two one-sentence impact statements for a plan section using the provided evidence bullets.

Rules:
- Write exactly two sentences:
  1) "If missing, ..." (consequence)
  2) "If present, ..." (benefit)
- Each sentence must be plain language and NON-PRESCRIPTIVE.
- Do NOT use "should/must/implement/establish/maintain".
- Do NOT describe steps or how-to.
- Must be consistent with the evidence bullets.
- Include 1–3 citations total (reusing bullet citations).
- Output STRICT JSON only.

OUTPUT JSON:
{
  "title": "<section title>",
  "if_missing": "If missing, ...",
  "if_present": "If present, ...",
  "citations": [{"source_registry_id":"...","chunk_id":"...","locator":"..."}]
}`.trim();

export const IMPACT_PASS_B_OUTPUT_SCHEMA = `{
  "title": "<section title>",
  "if_missing": "If missing, ...",
  "if_present": "If present, ...",
  "citations": [{"source_registry_id":"...","chunk_id":"...","locator":"..."}]
}`;

/**
 * Build user message for PASS B: section title + evidence bullets JSON from PASS A.
 */
export function buildImpactPassBUserMessage(
  sectionTitle: string,
  bulletsJson: string
): string {
  return `Section title: ${sectionTitle}
Evidence bullets:
<<<
${bulletsJson}
>>>

END OF PROMPT.`.trim();
}

/** Retry instruction when validation fails. */
export const IMPACT_PASS_B_RETRY_INSTRUCTION =
  "Rewrite to comply; remove forbidden words; keep one sentence each.";
