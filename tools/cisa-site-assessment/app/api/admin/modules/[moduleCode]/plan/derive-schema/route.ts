/**
 * POST /api/admin/modules/[moduleCode]/plan/derive-schema
 *
 * Derives plan schema from requirement chunks (TOC + critical elements), persists to
 * plan_schema_registry / plan_schema_sections / plan_schema_elements.
 * Idempotent: same source_set_hash returns existing schema.
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import { derivePlanSchema } from "@/app/lib/modules/plan_ecosystem/derive_plan_schema";
import {
  extractPlanSections,
  getTocEntriesFromChunks,
  type ExtractedSection,
  type ExtractionCandidate,
  PlanTocTrustError,
  PLAN_TOC_REQUIRES_TEMPLATE,
  PLAN_SCHEMA_TOC_SEED_DROPPED,
  normalizeTitleForMatch,
} from "@/app/lib/modules/plan_ecosystem/extract_plan_toc";
import { classifyPlanSourceRole } from "@/app/lib/modules/plan_ecosystem/source_roles";
import { computeSourceSetHash, upsertPlanSchema, PLAN_SCHEMA_VERSION, type PlanSchemaDeriveMethod, type PlanSchemaConfidence } from "@/app/lib/modules/plan_ecosystem/persist_plan_schema";
import { resolvePlanSchemaEngine, type PlanSchemaEngine } from "@/app/lib/config/plan_schema_engine";
import { resetPlanSchema } from "@/app/lib/modules/plan_ecosystem/reset_plan_schema";
import { parsePlanStructureTrust, type PlanStructureTrust } from "@/app/lib/modules/plan_ecosystem/structure_trust";
import { getPlanStandardModel } from "@/app/lib/ollama/model_router";
import { derivePlanSchemaFromEngine } from "@/app/lib/plans/schema/plan_schema_engine";
import { insertActivePlanSchema } from "@/app/lib/plans/schema/persist";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");

export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
): Promise<NextResponse> {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    if (!normalized) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    let trust: PlanStructureTrust;
    let structureSourceRegistryId: string | null = null;
    let engine: PlanSchemaEngine;
    let pdf_path: string | null = null;
    try {
      const body = (await req.json().catch(() => ({}))) as { trust?: string; structure_source_registry_id?: string; engine?: string; pdf_path?: string } | undefined;
      const trustParam = body?.trust ?? url.searchParams.get("trust");
      trust = parsePlanStructureTrust(trustParam);
      structureSourceRegistryId =
        body?.structure_source_registry_id ?? url.searchParams.get("structure_source_registry_id") ?? null;
      if (structureSourceRegistryId === "") structureSourceRegistryId = null;
      engine = resolvePlanSchemaEngine(body?.engine ?? url.searchParams.get("engine"));
      pdf_path = (body?.pdf_path ?? url.searchParams.get("pdf_path") ?? "").trim() || null;
    } catch {
      trust = parsePlanStructureTrust(url.searchParams.get("trust"));
      structureSourceRegistryId = url.searchParams.get("structure_source_registry_id");
      if (structureSourceRegistryId === "") structureSourceRegistryId = null;
      engine = resolvePlanSchemaEngine(url.searchParams.get("engine"));
      pdf_path = null;
    }
    if (engine === "LEGACY") {
      console.warn("[DEPRECATED] LEGACY plan schema engine used. Prefer TOC_PREFERRED (env PLAN_SCHEMA_ENGINE or engine param).");
    }
    console.log("[plan/derive-schema] start", { moduleCode: normalized, force, trust, engine, structureSourceRegistryId: structureSourceRegistryId ?? "Auto" });

    const runtimePool = getRuntimePool();

    // 1) Load module and verify ecosystem is PLAN (standard_class = PHYSICAL_SECURITY_PLAN)
    const modQuery = `SELECT module_code, standard_class FROM public.assessment_modules WHERE module_code ILIKE $1 LIMIT 1`;
    guardModuleQuery(modQuery, "derive-schema: assessment_modules");
    const mod = await runtimePool.query<{ module_code: string; standard_class: string | null }>(modQuery, [
      normalized,
    ]);
    if (!mod.rows.length) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    const canonicalModuleCode = (mod.rows[0].module_code ?? normalized).trim();
    const standardClass = (mod.rows[0].standard_class ?? "").trim().toUpperCase();
    if (standardClass !== "PHYSICAL_SECURITY_PLAN") {
      return NextResponse.json(
        {
          error: "Module is not a PLAN module",
          hint: "Derive Plan Schema is only for modules with Standard Class = Physical Security Plan (Plan). Set Standard Class on the module first.",
        },
        { status: 400 }
      );
    }

    // 2) Load chunks from export file (same as plan structure pipeline)
    const chunksPath = path.join(CHUNKS_DIR, `${canonicalModuleCode}.json`);
    if (!fs.existsSync(chunksPath)) {
      console.warn("[plan/derive-schema] 400 Chunk export missing:", chunksPath);
      return NextResponse.json(
        {
          error: "Chunk export missing",
          hint: `Run Standard Generate (or export chunks) first so that data/module_chunks/${canonicalModuleCode}.json exists.`,
        },
        { status: 400 }
      );
    }

    const rawData = fs.readFileSync(chunksPath, "utf-8");
    let filePayload: {
      chunks?: Array<{
        text?: string;
        chunk_text?: string;
        source_registry_id?: string;
        source_label?: string;
        page_range?: string;
        locator?: string;
        locator_value?: string;
        [k: string]: unknown;
      }>;
      source_index?: Record<string, string>;
    };
    try {
      filePayload = JSON.parse(rawData);
    } catch {
      console.warn("[plan/derive-schema] 400 Chunk file is not valid JSON:", chunksPath);
      return NextResponse.json({ error: "Chunk file is not valid JSON" }, { status: 400 });
    }

    const chunks = filePayload.chunks ?? [];
    const sourceIndex = filePayload.source_index ?? {};
    if (chunks.length === 0) {
      console.warn("[plan/derive-schema] 400 No chunks in export");
      return NextResponse.json(
        { error: "No chunks in export", hint: "Ensure the module has ingested sources and re-export." },
        { status: 400 }
      );
    }

    const allChunks = chunks.map((c) => ({
      chunk_text: (c.text ?? c.chunk_text ?? "") as string,
      source_title: (c.source_label ?? sourceIndex[c.source_registry_id ?? ""] ?? "Document") as string,
      page_range: c.page_range ?? null,
      locator: (c.locator_value ?? c.locator) ?? null,
      source_registry_id: c.source_registry_id ?? null,
    }));

    const sourceRoleByRegistryId = new Map<string, "REQUIREMENT" | "IMPLEMENTATION">();
    for (const c of allChunks) {
      const id = c.source_registry_id ?? c.source_title;
      if (!sourceRoleByRegistryId.has(id)) {
        const sample = allChunks.filter((x) => (x.source_registry_id ?? x.source_title) === id).slice(0, 3).map((x) => x.chunk_text).join("\n");
        sourceRoleByRegistryId.set(id, classifyPlanSourceRole({ title: c.source_title, chunkSample: sample }));
      }
    }
    const requirementChunks = allChunks.filter(
      (c) => sourceRoleByRegistryId.get(c.source_registry_id ?? c.source_title) === "REQUIREMENT"
    );
    const chunksForDerivation = requirementChunks.length > 0 ? requirementChunks : allChunks;

    const requirementSourceIds = [...new Set(chunksForDerivation.map((c) => c.source_registry_id).filter((id): id is string => typeof id === "string" && id.length > 0))];

    // Placeholder density for Auto structure source selection (mirrors source_roles heuristic)
    function placeholderDensity(s: string): number {
      const t = s.toLowerCase();
      const sigs = ["to build out this section", "click or tap here", "select date", "[insert"];
      let hits = 0;
      for (const sig of sigs) if (t.includes(sig)) hits++;
      const clickCount = (t.match(/click or tap/g) || []).length;
      return hits + Math.min(10, clickCount);
    }

    type RequirementSourceInfo = { source_registry_id: string; title: string; placeholderDensity: number };
    const requirementSources: RequirementSourceInfo[] = [];
    for (const id of requirementSourceIds) {
      const chunksOfSource = chunksForDerivation.filter((c) => c.source_registry_id === id);
      const title = chunksOfSource[0]?.source_title ?? id;
      const sample = chunksOfSource
        .slice(0, 5)
        .map((c) => c.chunk_text ?? "")
        .join("\n");
      requirementSources.push({
        source_registry_id: id,
        title,
        placeholderDensity: placeholderDensity(sample),
      });
    }

    let structureSourceId: string | null = null;
    let structureSourceTitle: string = "";
    if (structureSourceRegistryId) {
      if (!requirementSourceIds.includes(structureSourceRegistryId)) {
        return NextResponse.json(
          {
            error: "Structure source not attached",
            message: "The selected Structure Source is not among this module's requirement sources.",
            structure_source_registry_id: structureSourceRegistryId,
          },
          { status: 400 }
        );
      }
      structureSourceId = structureSourceRegistryId;
      structureSourceTitle = requirementSources.find((s) => s.source_registry_id === structureSourceId)?.title ?? structureSourceId;
    } else {
      // Auto: prefer template, reject instructional guide if any template exists, else max placeholderDensity, else first
      const withTemplate = requirementSources.filter((s) => s.title.toLowerCase().includes("template"));
      const withGuide = requirementSources.filter((s) => s.title.toLowerCase().includes("instructional guide"));
      if (withTemplate.length > 0) {
        structureSourceId = withTemplate[0].source_registry_id;
        structureSourceTitle = withTemplate[0].title;
      } else if (withGuide.length > 0 && requirementSources.length > 1) {
        const notGuide = requirementSources.filter((s) => !s.title.toLowerCase().includes("instructional guide"));
        if (notGuide.length > 0) {
          const byDensity = [...notGuide].sort((a, b) => b.placeholderDensity - a.placeholderDensity);
          structureSourceId = byDensity[0].source_registry_id;
          structureSourceTitle = byDensity[0].title;
        } else {
          structureSourceId = requirementSources[0].source_registry_id;
          structureSourceTitle = requirementSources[0].title;
        }
      } else if (requirementSources.length > 0) {
        const byDensity = [...requirementSources].sort((a, b) => b.placeholderDensity - a.placeholderDensity);
        structureSourceId = byDensity[0].source_registry_id;
        structureSourceTitle = byDensity[0].title;
      }
    }

    const structureSourceChunks =
      structureSourceId !== null
        ? chunksForDerivation.filter((c) => c.source_registry_id === structureSourceId)
        : chunksForDerivation;
    const structureSourceOptions = requirementSources.map((s) => ({
      source_registry_id: s.source_registry_id,
      title: s.title,
    }));

    const sourceSetHash = computeSourceSetHash(requirementSourceIds);

    // TOC_PREFERRED: deterministic TOC + headings fallback only. No Ollama.
    if (engine === "TOC_PREFERRED") {
      if (!structureSourceId) {
        return NextResponse.json(
          {
            error: "structure_source_registry_id required",
            hint: "For TOC_PREFERRED provide a structure source (template) to derive from.",
          },
          { status: 400 }
        );
      }
      const requirement_chunks = chunksForDerivation.map((c) => ({
        chunk_text: c.chunk_text,
        source_title: c.source_title,
        page_range: c.page_range ?? null,
        locator: c.locator ?? null,
        source_registry_id: c.source_registry_id ?? null,
      }));
      const snapshot = await derivePlanSchemaFromEngine({
        module_code: canonicalModuleCode,
        structure_source_registry_id: structureSourceId,
        engine_mode: "TOC_PREFERRED",
        pdf_path: pdf_path ?? undefined,
        requirement_chunks,
      });
      const { plan_schema_id } = await insertActivePlanSchema(snapshot);
      const sections_count = snapshot.sections.length;
      const elements_count = snapshot.sections.reduce((sum, s) => sum + s.elements.length, 0);
      console.log("[plan/derive-schema] engine=TOC_PREFERRED derive_method=%s confidence=%s sections=%d elements=%d plan_schema_id=%s", snapshot.derive_method, snapshot.confidence, sections_count, elements_count, plan_schema_id);
      return NextResponse.json({
        ok: true,
        idempotent: false,
        used_force: false,
        schema_version: PLAN_SCHEMA_VERSION,
        trust_mode: trust,
        engine_used: engine,
        derive_method: snapshot.derive_method,
        confidence: snapshot.confidence,
        structure_source_registry_id: structureSourceId,
        structure_source_title: structureSourceTitle,
        structure_source_options: structureSourceOptions,
        plan_schema_id,
        schema_id: plan_schema_id,
        module_code: canonicalModuleCode,
        source_set_hash: sourceSetHash,
        section_count: sections_count,
        element_count: elements_count,
        sections_count,
        elements_count,
        section_titles: snapshot.sections.map((s) => s.section_title),
        section_titles_preview: snapshot.sections.slice(0, 10).map((s) => s.section_title),
      });
    }

    const existingQuery = `SELECT id, source_set_hash, schema_version, derived_at, structure_trust, structure_source_registry_id, engine_used, derive_method, confidence FROM public.plan_schema_registry WHERE module_code = $1 LIMIT 1`;
    guardModuleQuery(existingQuery, "derive-schema: plan_schema_registry select");
    const existing = await runtimePool.query<{ id: string; source_set_hash: string; schema_version: number; derived_at: Date; structure_source_registry_id: string | null; engine_used: string | null; derive_method: string | null; confidence: string | null }>(
      existingQuery,
      [canonicalModuleCode]
    );
    const versionMismatch = existing.rows.length && (existing.rows[0].schema_version ?? 1) !== PLAN_SCHEMA_VERSION;
    const sameHash = existing.rows.length && existing.rows[0].source_set_hash === sourceSetHash;
    if (!force && !versionMismatch && sameHash) {
      const schemaId = existing.rows[0].id;
      const sectionsQuery = `SELECT section_order, section_key, section_title FROM public.plan_schema_sections WHERE schema_id = $1 ORDER BY section_order`;
      guardModuleQuery(sectionsQuery, "derive-schema: plan_schema_sections");
      const sectionsRows = await runtimePool.query<{ section_order: number; section_key: string; section_title: string }>(
        sectionsQuery,
        [schemaId]
      );
      const elementsQuery = `SELECT COUNT(*)::int AS n FROM public.plan_schema_elements e JOIN public.plan_schema_sections s ON s.id = e.section_id WHERE s.schema_id = $1`;
      guardModuleQuery(elementsQuery, "derive-schema: plan_schema_elements count");
      const elementsCount = await runtimePool.query<{ n: number }>(elementsQuery, [schemaId]);
      const sectionTitles = sectionsRows.rows.map((r) => r.section_title);
      const secCount = sectionsRows.rows.length;
      const elCount = elementsCount.rows[0]?.n ?? 0;
      const existingRow = existing.rows[0];
      const storedStructureSourceId = (existingRow as { structure_source_registry_id?: string | null }).structure_source_registry_id ?? null;
      const structureSourceTitleStored = storedStructureSourceId
        ? requirementSources.find((s) => s.source_registry_id === storedStructureSourceId)?.title ?? null
        : null;
      const storedEngine = existing.rows[0].engine_used ?? null;
      return NextResponse.json({
        ok: true,
        idempotent: true,
        used_force: false,
        schema_version: PLAN_SCHEMA_VERSION,
        trust_mode: (existingRow as { structure_trust?: string }).structure_trust ?? "BALANCED",
        engine_used: storedEngine ?? engine,
        derive_method: existing.rows[0].derive_method ?? undefined,
        confidence: existing.rows[0].confidence ?? undefined,
        structure_source_registry_id: storedStructureSourceId,
        structure_source_title: structureSourceTitleStored,
        structure_source_options: structureSourceOptions,
        schema_id: schemaId,
        module_code: canonicalModuleCode,
        source_set_hash: sourceSetHash,
        derived_at: existing.rows[0].derived_at,
        section_count: secCount,
        element_count: elCount,
        sections_count: secCount,
        elements_count: elCount,
        section_titles: sectionTitles,
        section_titles_preview: sectionTitles.slice(0, 10),
      });
    }

    const used_force = force || !!versionMismatch;
    if (used_force) {
      await resetPlanSchema(canonicalModuleCode);
    }

    const chunkTexts = structureSourceChunks.map((c) => c.chunk_text ?? "");
    const withDebug = used_force;
    let tocSkeleton: ExtractedSection[];
    let extractionCandidates: ExtractionCandidate[] | undefined;
    let tocFound = false;
    let tocSectionsCount = 0;
    let tocTopLevelTitles: string[] | undefined;
    try {
      const out = extractPlanSections(chunkTexts, { trust, debug: withDebug });
      tocSkeleton = out.sections;
      extractionCandidates = out.candidates;
      tocFound = out.tocFound ?? false;
      tocSectionsCount = out.tocSectionsCount ?? 0;
      tocTopLevelTitles = out.tocTopLevelTitles;
    } catch (extractErr) {
      if (extractErr instanceof PlanTocTrustError) {
        const err = extractErr as PlanTocTrustError & { debug?: Record<string, unknown> };
        const isTocMode = trust === "TOC";
        const code = isTocMode ? PLAN_TOC_REQUIRES_TEMPLATE : err.code;
        const message = isTocMode
          ? "TOC-Driven requires a template-style document with a usable Table of Contents. Select a different Structure Source or use Balanced."
          : err.message;
        console.warn("[plan/derive-schema] toc trust failure", {
          code,
          trust,
          details: message,
          structure_source_title: structureSourceTitle,
          debug: err.debug,
        });
        return NextResponse.json(
          {
            error: code,
            message,
            trust,
            force: used_force,
            ...(err.debug && { debug: { ...err.debug, structure_source_title: structureSourceTitle } }),
          },
          { status: 400 }
        );
      }
      throw extractErr;
    }
    const extraction_debug = withDebug
      ? {
          sections_extracted: tocSkeleton.length,
          elements_seeded: 0 as number,
          candidates_sample: (extractionCandidates ?? []).slice(0, 20).map((c) => ({ line: c.line, accepted: c.accepted, reason: c.reason })),
        }
      : undefined;

    const model = getPlanStandardModel();
    const tocEntries = tocFound ? getTocEntriesFromChunks(chunkTexts) : [];
    const useTocEntries = false;
    let schema: ReturnType<typeof derivePlanSchema> extends Promise<infer T> ? T : never;
    try {
      console.log("[plan/derive-schema] calling derive...", { model, useTocEntries, tocEntriesCount: tocEntries.length });
      schema = await derivePlanSchema(chunksForDerivation, {
        model,
        tocSkeleton: !useTocEntries && tocSkeleton.length > 0 ? tocSkeleton : undefined,
        tocEntries: useTocEntries ? tocEntries : undefined,
      });
      const seedsCount = schema.sections.reduce((sum, s) => sum + s.elements.length, 0);
      const elementsCount = seedsCount;
      if (extraction_debug) extraction_debug.elements_seeded = seedsCount;
      console.log("[plan/derive-schema] trust=%s chunks=%d tocFound=%s tocSections=%d finalSections=%d seeds=%d elements=%d", trust, chunkTexts.length, tocFound, tocSectionsCount, schema.sections.length, seedsCount, elementsCount);
      if (tocFound && tocTopLevelTitles && tocTopLevelTitles.length >= 5) {
        const sectionTitleNorm = new Set(schema.sections.map((s) => normalizeTitleForMatch(s.section_title)));
        const missingTitles = tocTopLevelTitles.filter((t) => !sectionTitleNorm.has(normalizeTitleForMatch(t)));
        if (missingTitles.length > 0) {
          console.warn("[plan/derive-schema] PLAN_SCHEMA_TOC_SEED_DROPPED", { missingTitles });
          return NextResponse.json(
            {
              error: PLAN_SCHEMA_TOC_SEED_DROPPED,
              message: "TOC top-level sections were dropped from final schema. Final sections must include all TOC titles when TOC exists.",
              debug: { missingTitles },
            },
            { status: 400 }
          );
        }
      }
      if (process.env.DEBUG_PLAN_SCHEMA === "1") {
        console.log("First 10 section titles:", schema.sections.slice(0, 10).map((s) => s.section_title));
        console.log("First 10 observations:", schema.sections.flatMap((s) => s.elements).slice(0, 10).map((e) => e.observation));
      }
      console.log("[plan/derive-schema] Ollama done, upserting schema");
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const msg = err.message || "Derivation failed";
      const validationErrors = (err as Error & { validationErrors?: string[] }).validationErrors;
      console.error("ERROR [plan/derive-schema] derivation failed:", msg);
      if (msg.includes("PLAN_DERIVE_NO_SECTIONS") || msg.includes("No sections extracted")) {
        return NextResponse.json(
          {
            error: "No TOC or numbered sections found",
            hint: "Ensure requirement sources (templates/guides) contain a Table of Contents or numbered headings (1. ... 12.).",
          },
          { status: 400 }
        );
      }
      if (msg.includes("elementsTotal=0") || msg.includes("Do not persist")) {
        return NextResponse.json(
          { error: "Derivation produced zero elements (hard failure).", message: msg, hint: "Check section extraction and intent resolver." },
          { status: 500 }
        );
      }
      if (msg.includes("PLAN_DERIVE_JSON_FAILED")) {
        const debug = (err as Error & { debug?: Record<string, unknown> }).debug;
        return NextResponse.json(
          {
            error: "JSON parse failed",
            message: msg,
            hint: "Check debug.message and debug.position / debug.around for the invalid token. Do not log or return raw payload.",
            ...(debug && { debug }),
          },
          { status: 500 }
        );
      }
      if (validationErrors?.length) {
        console.warn("[plan/derive-schema] 400 Schema validation failed:", validationErrors.slice(0, 5).join("; "), validationErrors.length > 5 ? `... and ${validationErrors.length - 5} more` : "");
        return NextResponse.json(
          {
            error: "Schema validation failed",
            message: validationErrors[0] ?? "One or more schema checks failed.",
            validation_errors: validationErrors,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Derivation failed", message: msg, hint: msg.includes("Ollama") || msg.includes("fetch") ? "Ensure Ollama is running and reachable (PSA_OLLAMA_URL)." : undefined },
        { status: 500 }
      );
    }

    const derive_method: PlanSchemaDeriveMethod = useTocEntries ? "TOC" : "LEGACY_LLM";
    const confidence: PlanSchemaConfidence = useTocEntries ? "HIGH" : "MEDIUM";
    const model_used = useTocEntries ? null : model;
    const { schema_id } = await upsertPlanSchema({
      module_code: canonicalModuleCode,
      source_set_hash: sourceSetHash,
      derived_model: model,
      schema,
      schema_version: PLAN_SCHEMA_VERSION,
      structure_trust: trust,
      structure_source_registry_id: structureSourceId,
      engine_used: engine,
      derive_method,
      confidence,
      model_used,
    });
    console.log("[plan/derive-schema] upserted schema_id:", schema_id);

    const sectionsQuery = `SELECT section_order, section_key, section_title FROM public.plan_schema_sections WHERE schema_id = $1 ORDER BY section_order`;
    guardModuleQuery(sectionsQuery, "derive-schema: plan_schema_sections");
    const sectionsRows = await runtimePool.query<{ section_order: number; section_key: string; section_title: string }>(
      sectionsQuery,
      [schema_id]
    );
    const elementsQuery = `SELECT COUNT(*)::int AS n FROM public.plan_schema_elements e JOIN public.plan_schema_sections s ON s.id = e.section_id WHERE s.schema_id = $1`;
    guardModuleQuery(elementsQuery, "derive-schema: plan_schema_elements count");
    const elementsCount = await runtimePool.query<{ n: number }>(elementsQuery, [schema_id]);
    void (elementsCount.rows[0]?.n ?? 0);
    const derivedAtRow = await runtimePool.query<{ derived_at: Date }>(
      `SELECT derived_at FROM public.plan_schema_registry WHERE id = $1`,
      [schema_id]
    );
    const derivedAt = derivedAtRow.rows[0]?.derived_at ?? new Date();

    const sectionTitles = sectionsRows.rows.map((r) => r.section_title);
    const secCount = schema.sections.length;
    const elCount = schema.sections.reduce((sum, s) => sum + s.elements.length, 0);
    const successPayload: Record<string, unknown> = {
      ok: true,
      idempotent: false,
      used_force: used_force,
      schema_version: PLAN_SCHEMA_VERSION,
      trust_mode: trust,
      engine_used: engine,
      derive_method,
      confidence,
      structure_source_registry_id: structureSourceId,
      structure_source_title: structureSourceTitle,
      structure_source_options: structureSourceOptions,
      schema_id,
      module_code: canonicalModuleCode,
      source_set_hash: sourceSetHash,
      derived_at: derivedAt,
      section_count: secCount,
      element_count: elCount,
      sections_count: secCount,
      elements_count: elCount,
      section_titles: sectionTitles,
      section_titles_preview: sectionTitles.slice(0, 10),
      extraction_debug: extraction_debug ?? undefined,
    };
    if (process.env.DEBUG_PLAN_SCHEMA === "1") {
      successPayload.derive_method_candidate = useTocEntries ? "TOC" : "LEGACY_LLM";
    }
    return NextResponse.json(successPayload);
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("ERROR [plan/derive-schema]", err.message);
    if (err.stack) console.error(err.stack);
    const message = String(err?.message ?? e ?? "Unknown error");
    const hint =
      /relation\s+["']?\w*plan_schema\w*["']?\s+does not exist/i.test(message)
        ? "Run the plan schema migration: node scripts/run_runtime_migration.js db/migrations/runtime/20260205_plan_schema.sql"
        : /fetch failed|ECONNREFUSED|ENOTFOUND|Ollama/i.test(message)
          ? "Ensure Ollama is running (e.g. ollama serve) and reachable at PSA_OLLAMA_URL."
          : "Check server logs. Ensure runtime migration 20260205_plan_schema.sql has been run and Ollama is reachable for derivation.";
    return NextResponse.json(
      { error: "Server error", message: message.slice(0, 500), hint },
      { status: 500 }
    );
  }
}
