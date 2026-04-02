/**
 * Plan schema derivation engine: TOC-preferred, then headings fallback, then legacy (LLM) wrapper.
 * Used by schema-first pipeline; returns PlanSchemaSnapshot.
 */

import type { PlanSchemaSnapshot } from "./types";
import { extractPdfOutline, outlineToSnapshot, isTocUsable } from "./toc_parser";
import {
  extractNumberedHeadings,
  applyAntiDrift,
  headingsToSnapshot,
  type PageLines,
} from "./headings_parser";
import { derivePlanSchema } from "@/app/lib/modules/plan_ecosystem/derive_plan_schema";
import type { RequirementChunk } from "@/app/lib/modules/plan_ecosystem/derive_plan_schema";

export type PlanSchemaEngineMode = "TOC_PREFERRED" | "LEGACY";

export interface DerivePlanSchemaOptions {
  module_code: string;
  structure_source_registry_id: string;
  engine_mode: PlanSchemaEngineMode;
  /** Absolute path to PDF for TOC extraction (outline). */
  pdf_path?: string | null;
  /** Chunk texts for headings fallback when TOC not used; or for legacy. */
  requirement_chunks?: RequirementChunk[];
  /** Pre-extracted page lines for headings fallback (when no PDF or TOC not usable). */
  page_lines?: PageLines[];
}

/**
 * Derive plan schema: TOC (PDF outline) preferred, then headings from text, then legacy LLM.
 */
export async function derivePlanSchemaFromEngine(
  opts: DerivePlanSchemaOptions
): Promise<PlanSchemaSnapshot> {
  const {
    module_code,
    structure_source_registry_id,
    engine_mode,
    pdf_path,
    requirement_chunks = [],
    page_lines,
  } = opts;

  if (process.env.DEBUG_PLAN_SCHEMA === "1") {
    console.log("[plan_schema] engine=", engine_mode);
  }

  if (engine_mode === "LEGACY") {
    return runLegacyDerivation(module_code, structure_source_registry_id, requirement_chunks);
  }

  // TOC_PREFERRED: try PDF outline first (only tools/plans/extract_pdf_toc.py => { toc: [...] })
  if (pdf_path) {
    const toc = await extractPdfOutline(pdf_path);
    if (isTocUsable(toc)) {
      const { snapshot } = outlineToSnapshot({
        toc,
        module_code,
        structure_source_registry_id,
      });
      return snapshot;
    }
  }

  // Headings fallback: from page_lines or from chunk text (fake single page)
  let pages: PageLines[];
  if (page_lines && page_lines.length > 0) {
    pages = page_lines;
  } else if (requirement_chunks.length > 0) {
    const lines = requirement_chunks
      .flatMap((c) => (c.chunk_text ?? "").split(/\n/).filter((l) => l.trim()))
      .slice(0, 500);
    pages = [{ page: 1, lines }];
  } else {
    return runLegacyDerivation(module_code, structure_source_registry_id, requirement_chunks);
  }

  const candidates = extractNumberedHeadings(pages);
  const drifted = applyAntiDrift(candidates);
  if (drifted.length >= 5) {
    return headingsToSnapshot({
      headings: drifted,
      module_code,
      structure_source_registry_id,
    });
  }

  // Last resort: legacy
  return runLegacyDerivation(module_code, structure_source_registry_id, requirement_chunks);
}

function runLegacyDerivation(
  module_code: string,
  structure_source_registry_id: string,
  requirement_chunks: RequirementChunk[]
): Promise<PlanSchemaSnapshot> {
  return derivePlanSchema(requirement_chunks).then((derived) =>
    derivedSchemaToSnapshot(derived, module_code, structure_source_registry_id)
  );
}

function derivedSchemaToSnapshot(
  derived: {
    sections: Array<{
      section_title: string;
      section_key: string;
      elements: Array<{
        element_title: string;
        element_key: string;
        observation?: string;
      }>;
    }>;
  },
  module_code: string,
  structure_source_registry_id: string
): PlanSchemaSnapshot {
  return {
    module_code,
    structure_source_registry_id,
    derive_method: "LEGACY",
    confidence: "LOW",
    sections: derived.sections.map((sec, i) => ({
      section_key: sec.section_key,
      section_title: sec.section_title,
      section_ord: i + 1,
      source_locator: null,
      elements: sec.elements.map((el, j) => ({
        element_key: el.element_key,
        element_label: el.element_title,
        element_ord: j + 1,
        is_core: false,
        source_excerpt: el.observation ?? el.element_title,
        source_locator: null,
      })),
    })),
  };
}
