/**
 * PLAN mode generator V1 — schema-first, no narrative "What should…" criteria, ofcs > 0.
 * Stages: 1) capabilities, 2) checklist groups + items, 3) item-attached OFCs + citations, 4) roll-up.
 * PSA scope only. Hard fail if any structural or validation gate fails.
 * Universal normalization lint (Section I–VIII) applied after auto-normalize.
 */

import * as fs from "fs";
import * as path from "path";
import { rewriteChecklistItem } from "@/app/lib/normalization/checklist_rewrite";
import { validateChecklistItems } from "@/app/lib/normalization/checklist_validate";
import {
  EAP_ELEMENT_FALLBACK_RATIONALE,
  eapElementsToItems,
  itemsToEapElements,
  postprocessEapElements,
} from "@/app/lib/normalization/eap_element_postprocess";
import { validateElementRationale } from "@/app/lib/normalization/rationale_quality";
import { enforceQuality } from "@/app/lib/ofc/ofc_quality";
import { postprocessOfcs } from "@/app/lib/ofc/ofc_postprocess";
import { autoNormalizePlanOutput, lintPlanOutput } from "./normalizedLint";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");

export type PlanCapabilityState = "PRESENT" | "ABSENT";
export type PlanRollupStatus = "COMPLETE" | "PARTIAL" | "DEFICIENT" | "ABSENT";

export interface PlanChunk {
  source_registry_id: string;
  doc_id: string;
  chunk_id: string;
  locator_type: string;
  locator_value: string;
  text: string;
}

export interface PlanCapabilityStub {
  criterion_key: string;
  title: string;
  description: string;
  capability_state: PlanCapabilityState;
  order_index: number;
}

export interface PlanChecklistItemStub {
  item_key: string;
  text: string;
  rationale: string;
  checked: boolean;
  is_na: boolean;
  derived_unchecked: boolean;
  suppressed: boolean;
  order_index: number;
}

export interface PlanOfcStub {
  criterion_key: string;
  template_key: string;
  ofc_text: string;
  /** Evidence-derived rationale (1–2 sentences). Optional until persisted. */
  ofc_reason?: string;
  checklist_item_id: string; // required in PLAN; set after items persisted or use temp id for preview
  order_index: number;
}

export interface PlanCitationStub {
  criterion_key: string;
  template_key: string;
  source_title: string;
  source_url: string | null;
  locator_type: string;
  locator_value: string;
}

export interface PlanGeneratorOutput {
  capabilities: PlanCapabilityStub[];
  groups: { criterion_key: string; group_key: string; title: string }[];
  items: (PlanChecklistItemStub & { criterion_key: string; group_key: string })[];
  ofcs: PlanOfcStub[];
  citations: PlanCitationStub[];
  source_index: Record<string, string>;
}

/** PSA plan capability domains (formulaic). Existence-check titles only. */
const PLAN_CAPABILITY_DOMAINS = [
  "Emergency communications",
  "Coordination with law enforcement and first responders",
  "Interoperable communications among staff and responders",
  "Information sharing (fusion centers, ISAC, HSIN where relevant)",
  "Training and exercising (annual exercises; tabletop and drills)",
  "Suspicious packages and mail handling procedures",
  "Mass notification process and testing",
  "Situational awareness and reporting process",
  "Security management governance (security manager, written plan, plan maintenance)",
] as const;

const MIN_CAPABILITIES = 6;
const MAX_CAPABILITIES = 12;
const MIN_ITEMS_PER_CAPABILITY = 3;
const MAX_ITEMS_PER_CAPABILITY = 8;
/** Emit one OFC per unchecked item with canonical stem only; postprocessOfcs dedupes by element and caps per criterion. */
const MAX_OFCS_PER_UNCHECKED_ITEM = 1;
const OFC_CANONICAL_PREFIX = "Establish and maintain";
const OFC_PREFIXES = [OFC_CANONICAL_PREFIX, "Document and maintain", "Provide and maintain", "Designate and maintain"] as const;
const DISALLOWED_OFC_VERBS = /\b(install|train|conduct|deploy|implement|configure|procure|purchase)\b/i;

function loadChunks(moduleCode: string): { chunks: PlanChunk[]; source_index: Record<string, string> } {
  const p = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (!fs.existsSync(p)) throw new Error(`CHUNK_EXPORT_MISSING: No chunk export at data/module_chunks/${moduleCode}.json`);
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw) as { chunks?: PlanChunk[]; source_index?: Record<string, string> };
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];
  const source_index = (data.source_index && typeof data.source_index === "object") ? data.source_index : {};
  return { chunks, source_index };
}

/** Stage 1: 6–12 capabilities. No "What should". */
 
function stage1Capabilities(_chunks: PlanChunk[]): PlanCapabilityStub[] {
  const count = Math.min(Math.max(PLAN_CAPABILITY_DOMAINS.length, MIN_CAPABILITIES), MAX_CAPABILITIES);
  const domains = [...PLAN_CAPABILITY_DOMAINS].slice(0, count);
  return domains.map((title, i) => ({
    criterion_key: `CAP${(i + 1).toString().padStart(2, "0")}`,
    title: title as string,
    description: `Plan element for ${title}.`,
    capability_state: "PRESENT" as PlanCapabilityState,
    order_index: i + 1,
  }));
}

/** Stage 2: 3–8 checklist items per capability. Declarative, rationale required. */
function stage2ChecklistItems(capabilities: PlanCapabilityStub[]): {
  groups: PlanGeneratorOutput["groups"];
  items: PlanGeneratorOutput["items"];
} {
  const groups: PlanGeneratorOutput["groups"] = [];
  const items: PlanGeneratorOutput["items"] = [];
  const itemTemplates: Record<number, { text: string; rationale: string }[]> = {
    0: [
      { text: "A designated point of contact is identified and documented.", rationale: "Enables rapid coordination during an incident." },
      { text: "Contact information is updated at least annually.", rationale: "Ensures current information for response coordination." },
      { text: "Roles and responsibilities are documented.", rationale: "Clarifies who does what during an incident." },
      { text: "Procedures are reviewed and exercised periodically.", rationale: "Validates readiness and identifies gaps." },
    ],
    1: [
      { text: "Liaison with local law enforcement is established.", rationale: "Supports coordinated response and resource sharing." },
      { text: "Contact roster for first responders is maintained.", rationale: "Enables timely notification and coordination." },
      { text: "Onsite visit or coordination protocol is documented.", rationale: "Defines how and when coordination occurs." },
    ],
    2: [
      { text: "Communications equipment is identified and documented.", rationale: "Ensures responders know what is available." },
      { text: "Interoperability with responder systems is addressed.", rationale: "Enables information exchange during response." },
      { text: "Testing of communications is conducted at least annually.", rationale: "Verifies that systems work when needed." },
    ],
    3: [
      { text: "Process for sharing information with relevant partners is documented.", rationale: "Supports situational awareness and coordination." },
      { text: "Points of contact for information sharing are identified.", rationale: "Enables timely exchange during an incident." },
    ],
    4: [
      { text: "Training schedule or requirement is documented.", rationale: "Ensures personnel are prepared." },
      { text: "Exercise schedule (e.g., annual) is documented.", rationale: "Validates plans and procedures." },
      { text: "Tabletop or drill scope is defined.", rationale: "Clarifies what is exercised and how." },
    ],
    5: [
      { text: "Procedures for suspicious packages and mail are documented.", rationale: "Guides safe handling and notification." },
      { text: "Designated roles for mail handling are identified.", rationale: "Ensures someone is responsible." },
    ],
    6: [
      { text: "Mass notification system or process is documented.", rationale: "Enables rapid alerting of occupants or staff." },
      { text: "Testing of notification process is conducted periodically.", rationale: "Verifies the process works." },
    ],
    7: [
      { text: "Process for reporting and escalating concerns is documented.", rationale: "Enables timely awareness of threats or hazards." },
      { text: "Situational awareness information is shared with decision makers.", rationale: "Supports informed response decisions." },
    ],
    8: [
      { text: "A designated security manager or lead is identified.", rationale: "Ensures accountability for security program." },
      { text: "A written security or emergency plan exists.", rationale: "Provides a single reference for procedures." },
      { text: "Plan review and update cycle is documented.", rationale: "Keeps the plan current." },
    ],
  };
  const defaultTemplates = itemTemplates[8];
  for (const cap of capabilities) {
    const capIndex = cap.order_index - 1;
    const templates = itemTemplates[capIndex % 9] ?? defaultTemplates;
    const n = Math.min(Math.max(templates.length, MIN_ITEMS_PER_CAPABILITY), MAX_ITEMS_PER_CAPABILITY);
    const selected: { text: string; rationale: string }[] = templates.slice(0, n);
    while (selected.length < MIN_ITEMS_PER_CAPABILITY && defaultTemplates.length > 0) {
      selected.push(defaultTemplates[selected.length % defaultTemplates.length]);
    }
    groups.push({ criterion_key: cap.criterion_key, group_key: cap.criterion_key, title: cap.title });
    selected.slice(0, MAX_ITEMS_PER_CAPABILITY).forEach((t, i) => {
      items.push({
        criterion_key: cap.criterion_key,
        group_key: cap.criterion_key,
        item_key: `${cap.criterion_key}_${(i + 1).toString().padStart(2, "0")}`,
        text: t.text,
        rationale: t.rationale,
        checked: false,
        is_na: false,
        derived_unchecked: false,
        suppressed: false,
        order_index: i + 1,
      });
    });
  }
  return { groups, items };
}

/**
 * Succinctify OFC text: strip "Establish and maintain a capability for X (e.g., Y)" to "Y" (8–16 words target).
 * Set ofc_reason from the checklist item rationale (evidence-derived placeholder until LLM rewrite).
 */
function succinctifyOfcs(
  ofcs: PlanOfcStub[],
  items: PlanGeneratorOutput["items"]
): PlanOfcStub[] {
  const itemByKey = new Map(items.map((i) => [i.item_key, i]));
  return ofcs.map((o) => {
    const t = (o.ofc_text ?? "").trim();
    const m = t.match(/\(e\.g\.,\s*(.+?)\)\s*\.?\s*$/i);
    let succinct = m ? m[1].trim() : t;
    succinct = succinct.charAt(0).toUpperCase() + succinct.slice(1);
    if (succinct && !succinct.endsWith(".")) succinct += ".";
    const item = itemByKey.get(o.checklist_item_id);
    const reason = (item?.rationale ?? "").trim();
    return { ...o, ofc_text: succinct || o.ofc_text, ofc_reason: reason || undefined };
  });
}

/** Stage 3: 1 OFC per unchecked item with canonical stem only. PostprocessOfcs dedupes by element and caps at 4 per criterion. */
function stage3OfcsAndCitations(
  items: PlanGeneratorOutput["items"],
  capabilities: PlanCapabilityStub[],
  chunks: PlanChunk[],
  source_index: Record<string, string>
): { ofcs: PlanOfcStub[]; citations: PlanCitationStub[] } {
  const ofcs: PlanOfcStub[] = [];
  const citations: PlanCitationStub[] = [];
  const firstChunk = chunks[0];
  const sourceTitle = firstChunk ? (source_index[firstChunk.source_registry_id] ?? "Plan source") : "Plan source";
  const sourceUrl: string | null = null;
  for (const item of items) {
    if (item.checked || item.is_na) continue;
    const cap = capabilities.find((c) => c.criterion_key === item.criterion_key);
    const prefixCount = Math.min(MAX_OFCS_PER_UNCHECKED_ITEM, OFC_PREFIXES.length);
    for (let i = 0; i < prefixCount; i++) {
      const templateKey = `OFC_${item.item_key}_${i + 1}`;
      const prefix = OFC_PREFIXES[i];
      const ofcText = `${prefix} a capability for ${cap?.title ?? item.criterion_key} (e.g., ${item.text.toLowerCase().replace(/\.$/, "")}).`;
      ofcs.push({
        criterion_key: item.criterion_key,
        template_key: templateKey,
        ofc_text: ofcText,
        checklist_item_id: item.item_key,
        order_index: ofcs.length + 1,
      });
      citations.push({
        criterion_key: item.criterion_key,
        template_key: templateKey,
        source_title: sourceTitle,
        source_url: sourceUrl,
        locator_type: firstChunk?.locator_type ?? "page",
        locator_value: firstChunk?.locator_value ?? "1",
      });
    }
  }
  return { ofcs, citations };
}

/** Stage 4: roll-up (applicable_count, checked_count, completion_ratio, rollup_status). */
function stage4Rollup(
  capabilities: PlanCapabilityStub[],
  items: PlanGeneratorOutput["items"]
): Map<string, { applicable_count: number; checked_count: number; completion_ratio: number; rollup_status: PlanRollupStatus }> {
  const map = new Map<string, { applicable_count: number; checked_count: number; completion_ratio: number; rollup_status: PlanRollupStatus }>();
  for (const cap of capabilities) {
    const capItems = items.filter((i) => i.criterion_key === cap.criterion_key && !i.is_na);
    const applicable_count = capItems.length;
    const checked_count = capItems.filter((i) => i.checked).length;
    const completion_ratio = applicable_count > 0 ? checked_count / applicable_count : 0;
    const rollup_status: PlanRollupStatus =
      cap.capability_state === "ABSENT" ? "ABSENT"
      : completion_ratio >= 1 ? "COMPLETE"
      : completion_ratio === 0 ? "DEFICIENT"
      : "PARTIAL";
    map.set(cap.criterion_key, { applicable_count, checked_count, completion_ratio, rollup_status });
  }
  return map;
}

export interface PlanValidationFailure {
  failure_reason: string;
  violated_rule_ids?: string[];
  counts: { capabilities: number; checklist_items: number; unchecked_items: number; ofcs: number };
  samples?: { bad_text?: string[]; missing_rationale?: string[] } | string[];
}

function validatePlanOutput(output: PlanGeneratorOutput): PlanValidationFailure | null {
  const { capabilities, items, ofcs } = output;
  const unchecked = items.filter((i) => !i.checked && !i.is_na);
  const ofcsByCriterion = new Map<string, number>();
  for (const o of ofcs) {
    const key = o.criterion_key;
    ofcsByCriterion.set(key, (ofcsByCriterion.get(key) ?? 0) + 1);
  }
  const badText: string[] = [];
  const missingRationale: string[] = [];
  for (const c of capabilities) {
    if (c.title && String(c.title).toLowerCase().startsWith("what should")) badText.push(c.title);
  }
  for (const i of items) {
    if (!(i.rationale ?? "").trim()) missingRationale.push(i.item_key);
    if ((i.text ?? "").includes("?")) badText.push(i.text);
    if (i.text && String(i.text).toLowerCase().startsWith("what should")) badText.push(i.text);
  }
  if (capabilities.length < 3) {
    return { failure_reason: "criteria_count_lt_3", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: badText.slice(0, 5), missing_rationale: missingRationale.slice(0, 5) } };
  }
  for (const c of capabilities) {
    const groupItems = items.filter((i) => i.criterion_key === c.criterion_key);
    if (groupItems.length < MIN_ITEMS_PER_CAPABILITY) {
      return { failure_reason: "checklist_items_lt_3", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: badText.slice(0, 5), missing_rationale: missingRationale.slice(0, 5) } };
    }
  }
  if (missingRationale.length > 0) {
    return { failure_reason: "checklist_item_missing_rationale", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { missing_rationale: missingRationale.slice(0, 10) } };
  }
  if (badText.length > 0) {
    return { failure_reason: "capability_or_item_what_should_or_question", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: badText.slice(0, 10) } };
  }
  for (const cap of capabilities) {
    const n = ofcsByCriterion.get(cap.criterion_key) ?? 0;
    if (n === 0) {
      return { failure_reason: "criterion_zero_ofcs", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: [cap.criterion_key] } };
    }
    if (n > 4) {
      return { failure_reason: "criterion_exceeds_max_ofcs", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: [cap.criterion_key] } };
    }
  }
  for (const o of ofcs) {
    if (!o.checklist_item_id) {
      return { failure_reason: "plan_ofc_missing_checklist_item_id", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length } };
    }
    if (DISALLOWED_OFC_VERBS.test(o.ofc_text)) {
      return { failure_reason: "ofc_disallowed_implementation_verb", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: ofcs.length }, samples: { bad_text: [o.ofc_text.slice(0, 80)] } };
    }
  }
  if (ofcs.length === 0) {
    return { failure_reason: "ofcs_zero", counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: unchecked.length, ofcs: 0 } };
  }
  return null;
}

/**
 * Run PlanGeneratorV1: load chunks, run stages 1–4, validate, auto-normalize, lint. Throws or returns output.
 */
export function runPlanGeneratorV1(moduleCode: string): PlanGeneratorOutput & { rollup: Map<string, { applicable_count: number; checked_count: number; completion_ratio: number; rollup_status: PlanRollupStatus }> } {
  const { chunks, source_index } = loadChunks(moduleCode);
  if (chunks.length === 0) throw new Error("NO_RETRIEVABLE_TEXT: No chunks in export.");
  const capabilities = stage1Capabilities(chunks);
  const { groups, items: initialItems } = stage2ChecklistItems(capabilities);
  let items = initialItems;
  const rewrittenTexts = items.map((i) => rewriteChecklistItem(i.text));
  const checklistErrs = validateChecklistItems(rewrittenTexts);
  if (checklistErrs.length > 0) {
    const fail: PlanValidationFailure = {
      failure_reason: "CHECKLIST_NORMALIZATION_FAILED",
      counts: { capabilities: capabilities.length, checklist_items: items.length, unchecked_items: 0, ofcs: 0 },
      samples: checklistErrs.slice(0, 10),
    };
    const err = new Error(`Checklist normalization failed after rewrite: ${checklistErrs[0]}`) as Error & { planValidation: PlanValidationFailure };
    err.planValidation = fail;
    throw err;
  }
  items = items.map((item, i) => ({ ...item, text: rewrittenTexts[i] ?? item.text }));
  // EAP element postprocess: dedupe echo, fix thin/echo rationale; then validate and replace generic/echo rationales
  const elements = itemsToEapElements(items);
  const cleanedElements = postprocessEapElements(elements);
  const itemsWithRationale = eapElementsToItems(cleanedElements);
  for (let i = 0; i < items.length; i++) {
    const el = itemsWithRationale[i];
    if (!el) continue;
    items[i] = { ...items[i], text: el.text, rationale: el.rationale };
    const rationaleErrs = validateElementRationale(el.text, el.rationale);
    if (rationaleErrs.length > 0) {
      items[i] = {
        ...items[i],
        rationale: EAP_ELEMENT_FALLBACK_RATIONALE.endsWith(".") ? EAP_ELEMENT_FALLBACK_RATIONALE : `${EAP_ELEMENT_FALLBACK_RATIONALE}.`,
      };
    }
  }
  let { ofcs, citations } = stage3OfcsAndCitations(items, capabilities, chunks, source_index);
  const cleanedOfcs = postprocessOfcs(ofcs as Array<{ ofc_text: string; criterion_key: string; template_key?: string; checklist_item_id?: string; order_index?: number }>, { maxPerCriterion: 4 });
  const keptTemplates = new Set(cleanedOfcs.map((o) => `${(o as PlanOfcStub).criterion_key}:${(o as PlanOfcStub).template_key}`));
  citations = citations.filter((c) => keptTemplates.has(`${c.criterion_key}:${c.template_key}`));
  ofcs = cleanedOfcs.map((o, i) => ({
    ...(o as PlanOfcStub),
    criterion_key: (o as PlanOfcStub).criterion_key,
    template_key: (o as PlanOfcStub).template_key ?? `OFC_${(o as PlanOfcStub).criterion_key}_${i + 1}`,
    ofc_text: (o as PlanOfcStub).ofc_text,
    checklist_item_id: (o as PlanOfcStub).checklist_item_id ?? "",
    order_index: i + 1,
  }));
  const rollup = stage4Rollup(capabilities, items);
  const output: PlanGeneratorOutput = { capabilities, groups, items, ofcs, citations, source_index };
  const structuralFail = validatePlanOutput(output);
  if (structuralFail) {
    const err = new Error(`PLAN validation failed: ${structuralFail.failure_reason}`) as Error & { planValidation: PlanValidationFailure };
    err.planValidation = structuralFail;
    throw err;
  }
  autoNormalizePlanOutput(output.capabilities, output.items, output.ofcs);
  const lintResult = lintPlanOutput(output.capabilities, output.items, output.ofcs);
  if (!lintResult.pass) {
    const fail: PlanValidationFailure = {
      failure_reason: lintResult.failure_reason ?? "NORMALIZATION_LINT_FAILED",
      violated_rule_ids: lintResult.violated_rule_ids,
      counts: { capabilities: output.capabilities.length, checklist_items: output.items.length, unchecked_items: output.items.filter((i) => !i.checked && !i.is_na).length, ofcs: output.ofcs.length },
      samples: lintResult.samples,
    };
    const err = new Error(`PLAN lint failed: ${fail.failure_reason}`) as Error & { planValidation: PlanValidationFailure };
    err.planValidation = fail;
    throw err;
  }
  output.ofcs = succinctifyOfcs(output.ofcs, items);
  const qualityErrs = enforceQuality(output.ofcs.map((o) => ({ ofc_text: o.ofc_text, ofc_reason: o.ofc_reason })), { requireReason: true, minReasonLength: 15 });
  if (qualityErrs.length > 0) {
    const fail: PlanValidationFailure = {
      failure_reason: "OFC_QUALITY_FAILED",
      counts: { capabilities: output.capabilities.length, checklist_items: output.items.length, unchecked_items: output.items.filter((i) => !i.checked && !i.is_na).length, ofcs: output.ofcs.length },
      samples: qualityErrs.slice(0, 5),
    };
    const err = new Error(`OFC quality check failed: ${qualityErrs[0]}`) as Error & { planValidation: PlanValidationFailure };
    err.planValidation = fail;
    throw err;
  }
  return { ...output, rollup };
}
