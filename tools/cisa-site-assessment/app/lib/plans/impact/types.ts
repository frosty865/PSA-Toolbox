/**
 * Plan Impact Statements — frozen JSON schemas (doctrine).
 * Plans = gate + checklist + optional impacts. No stakeholder-facing OFCs.
 */

// ---------------------------------------------------------------------------
// A) Plan Structure (from Ollama) — frozen
// ---------------------------------------------------------------------------

export interface PlanStructureElement {
  key: string;
  title: string;
  subelements?: string[];
}

export interface PlanStructure {
  plan_type: string;
  elements: PlanStructureElement[];
}

// ---------------------------------------------------------------------------
// B) Plan Assessment Runtime Payload — frozen
// ---------------------------------------------------------------------------

export interface ImpactCitation {
  source_registry_id: string;
  chunk_id: string;
  locator?: string;
}

export interface GateQuestion {
  id: string;
  text: string;
  response_type: "YES_NO_NA";
}

export interface ChecklistItemPayload {
  id: string;
  text: string;
  subitems?: string[];
}

export interface ImpactStatementPayload {
  id: string;
  section_id: string;
  if_missing: string;
  if_present: string;
  citations: ImpactCitation[];
}

export interface PlanAssessmentPayload {
  plan_type: string;
  gate_question: GateQuestion;
  checklist_prompt: string;
  checklist_items: ChecklistItemPayload[];
  impact_statements: ImpactStatementPayload[];
}

// ---------------------------------------------------------------------------
// C) Impact Statements only (internal generation output)
// ---------------------------------------------------------------------------

export interface ImpactStatementOutput {
  section_key: string;
  title: string;
  if_missing: string;
  if_present: string;
  citations: ImpactCitation[];
}

export interface ImpactOnlyOutput {
  plan_type: string;
  impacts: ImpactStatementOutput[];
}

// ---------------------------------------------------------------------------
// PASS A: Evidence bullets (per section)
// ---------------------------------------------------------------------------

export interface EvidenceBullet {
  text: string;
  citations: ImpactCitation[];
}

export interface EvidenceBulletsOutput {
  title: string;
  bullets: EvidenceBullet[];
}
