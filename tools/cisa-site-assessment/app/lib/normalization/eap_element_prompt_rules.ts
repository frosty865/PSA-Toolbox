/**
 * EAP element generation prompt rules for Ollama (or any LLM).
 * Use when prompting for CAP element details (element_text, rationale, citations).
 */

export const EAP_ELEMENT_OUTPUT_FORMAT = `
OUTPUT FORMAT (STRICT JSON):
{
  "capability_id": "CAP01",
  "elements": [
    {
      "element_text": "<one declarative statement>",
      "rationale": "<one sentence; MUST NOT repeat element_text words>",
      "citations": [{"chunk_id":"...","source_registry_id":"..."}]
    }
  ]
}

RULES:
- element_text must be a single declarative sentence fragment (no "e.g.", no question marks).
- rationale must be one sentence explaining the planning purpose/outcome and MUST NOT repeat element_text.
- Do NOT repeat the element_text anywhere else.
- Use the provided source chunks for rationale and citations.
`.trim();
