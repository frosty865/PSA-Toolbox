/**
 * Intent Object Types
 * 
 * Types for intent objects that provide UI guidance for baseline questions.
 * Intent objects are read-only UI aids and do not affect scoring.
 */

export type IntentObject = {
  version: "1.0";
  canon_id: string;
  layer: "baseline";
  depth: 1 | 2;
  discipline_code: string;
  subtype_code: string;
  question_text: string;

  intent: string;
  what_counts_as_yes: string[];
  what_does_not_count: string[];
  typical_evidence: string[];
  field_tip: string;

  references: string[];

  source: {
    subtype_guidance_used: boolean;
    guidance_fields_used: string[];
  };

  // RAG-derived meaning (optional, from question_meaning table)
  meaning_text?: string;
};

export type IntentObjectsFile = {
  version: "1.0";
  generated_at: string;
  counts: { depth1: number; depth2: number; total: number; };
  questions: IntentObject[];
};
