import type { YesNoNa } from './baseline';

export type { YesNoNa };

// UI response type (accepts both "N/A" and "N_A" for compatibility)
export type UIResponse = "YES" | "NO" | "N/A" | "N_A";

export type BaselineSpineUI = {
  canon_id: string;
  discipline_code: string; // Required - all spines have discipline_code
  subtype_code?: string | null;
  subtype_name?: string | null; // Subtype name from API
  question_text: string;
  response_enum: ["YES","NO","N_A"];
  // optional runtime field added by API routes (UI uses "N/A", API uses "N_A")
  current_response?: UIResponse | null;
  // optional gate metadata
  mapped_gate?: 'CONTROL_EXISTS' | 'CONTROL_OPERABLE' | 'CONTROL_RESILIENCE' | null;
  // optional fields for UI compatibility
  discipline_subtype_id?: string | null;
  discipline_name?: string | null;
  discipline_subtype_name?: string | null;
};
