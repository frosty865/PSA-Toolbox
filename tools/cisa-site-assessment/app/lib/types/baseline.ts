export type YesNoNa = "YES" | "NO" | "N_A";

export type SubtypeGuidance = {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
};

export type BaselineSpine = {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  discipline_subtype_id?: string | null; // UUID reference to discipline_subtypes.id
  question_text: string;
  response_enum: ["YES","NO","N_A"];
  canon_version: string;
  canon_hash: string;
  // Guidance content derived from taxonomy at runtime (not stored in DB)
  subtype_name?: string | null;
  subtype_guidance?: SubtypeGuidance | null;
  // Names derived from taxonomy at runtime
  discipline_name?: string | null;
  discipline_subtype_name?: string | null;
};

export type AuthorityScope = 'BASELINE' | 'SECTOR' | 'SUBSECTOR';

export type QuestionWithAuthority = {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code?: string | null;
  response_enum: ["YES","NO","N_A"];
  authority_scope: AuthorityScope;
  // Additional fields from baseline or overlay
  [key: string]: unknown;
};

// NOTE: During migration we accept either question_canon_id or legacy question_template_id.
// Canon must win when present.
export type AssessmentResponseRow = {
  question_canon_id?: string | null;
  question_template_id?: string | null; // legacy
  response?: YesNoNa | null;
};
