/**
 * Canonical Plan Assessment — single reusable Ollama prompt + frozen JSON schema.
 * Use for ALL plan types: EAP, Active Assailant EAP, COOP, Severe Weather, Cyber Annex, Hazard Annex, etc.
 * DO NOT EMBELLISH. Only plan type and source text vary.
 */

// ---------------------------------------------------------------------------
// PART A — SINGLE REUSABLE SYSTEM PROMPT (OLLAMA) — strict JSON only
// ---------------------------------------------------------------------------

export const CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT = `Return STRICT JSON only. No prose. No markdown. No explanations.

If you include ANY text outside JSON, the response will be rejected.

Output must be a single JSON object matching this schema:
{
  "plan_type": "<string>",
  "elements": [
    { "key": "<string>", "title": "<string>", "subelements": ["<string>"] }
  ]
}`.trim();

/**
 * TOC-only extraction: use when structure must come from Table of Contents major sections only
 * (e.g. Active Assailant EAP template/guide). Do not mine arbitrary headings.
 */
export const TOC_PLAN_EXTRACT_SYSTEM_PROMPT = `Extract ONLY the plan's TABLE OF CONTENTS major sections.

Rules:
- Use ONLY lines that are Table of Contents entries (numbered sections with titles).
- Include only TOP-LEVEL sections (e.g., 1..10). Do NOT include subheadings like "Introduction" unless numbered as a major section.
- Strip dot leaders and page numbers.
- Output STRICT JSON only with:
{
  "plan_type": "<string>",
  "elements": [
    { "key": "<string>", "title": "<string>", "subelements": [] }
  ]
}
- If TOC is not present, return an empty elements array.`.trim();

// ---------------------------------------------------------------------------
// REPAIR PROMPT — used on retry when first response is not valid JSON
// ---------------------------------------------------------------------------

export const PLAN_EXTRACT_REPAIR_SYSTEM_PROMPT = `You must output ONLY valid JSON for the schema below. No extra text.

Schema:
{
  "plan_type": "<string>",
  "elements": [
    { "key": "<string>", "title": "<string>", "subelements": ["<string>"] }
  ]
}

Convert the provided text into that JSON and output JSON ONLY.`.trim();

// ---------------------------------------------------------------------------
// PART B — FROZEN JSON SCHEMA (ENGINE CANONICAL)
// ---------------------------------------------------------------------------

export const CANONICAL_PLAN_EXTRACT_SCHEMA_JSON = `{
  "plan_type": "string",
  "elements": [
    {
      "key": "string",
      "title": "string",
      "subelements": ["string"]
    }
  ]
}`;

/** Frozen TypeScript shape for parsed Ollama output (all plan types). */
export interface CanonicalPlanElement {
  key: string;
  title: string;
  subelements?: string[];
}

export interface CanonicalPlanExtract {
  plan_type: string;
  elements: CanonicalPlanElement[];
}

// ---------------------------------------------------------------------------
// USER MESSAGE BUILDER (only plan type + source text vary)
// ---------------------------------------------------------------------------

/**
 * Build user content for Ollama. Heading chunks only; no narrative.
 */
export function buildCanonicalPlanExtractUserMessage(
  planType: string,
  sourceText: string
): string {
  return `Plan type: ${planType}
Extract section headings ONLY from the text below.
Text:
<<<
${sourceText}
>>>`.trim();
}

/**
 * Build user message for TOC-only extraction (e.g. Active Assailant EAP).
 */
export function buildTocPlanExtractUserMessage(planType: string, sourceText: string): string {
  return `Plan type: ${planType}
Extract ONLY the plan's TABLE OF CONTENTS major sections from the text below. TOC chunks only.
Text:
<<<
${sourceText}
>>>`.trim();
}

/**
 * Build repair user message: ask model to convert its prior (non-JSON) output into strict JSON.
 */
export function buildPlanExtractRepairUserMessage(
  planType: string,
  rawModelOutput: string
): string {
  return `Plan type: ${planType}
Text:
<<<
${rawModelOutput}
>>>`.trim();
}
