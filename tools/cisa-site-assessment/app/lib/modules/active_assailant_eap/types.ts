/**
 * Active Assailant EAP module — Ollama output shape.
 * Elements = plan sections (and optional sub-sections). No questions, rationales, or OFCs.
 */

export interface ActiveAssailantEapCitation {
  source_registry_id: string;
  chunk_id: string;
  locator?: string;
}

export interface ActiveAssailantEapElement {
  key: string;
  title: string;
  subelements?: string[];
  citations?: ActiveAssailantEapCitation[];
}

export interface ActiveAssailantEapExtract {
  module_code: string;
  plan_type: string;
  elements: ActiveAssailantEapElement[];
}
