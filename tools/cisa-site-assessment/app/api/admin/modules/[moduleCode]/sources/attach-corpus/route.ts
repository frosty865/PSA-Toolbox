/**
 * POST /api/admin/modules/[moduleCode]/sources/attach-corpus
 *
 * Attach an existing CORPUS source (evidence) to a module as a pointer.
 * - Validates corpus_source_id in CORPUS (source_registry).
 * - Inserts into RUNTIME.module_sources with source_type='CORPUS_POINTER'.
 * - No file copy. No write to CORPUS.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();

    let body: { corpus_source_id?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const corpusSourceId = body.corpus_source_id;
    if (!corpusSourceId || typeof corpusSourceId !== "string") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "corpus_source_id is required" },
        { status: 400 }
      );
    }
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(corpusSourceId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "corpus_source_id must be a UUID" },
        { status: 400 }
      );
    }

    const corpusPool = getCorpusPool();
    const runtimePool = await ensureRuntimePoolConnected();

    // 1) Module must exist
    const mod = await runtimePool.query(
      `SELECT 1 FROM public.assessment_modules WHERE module_code = $1`,
      [normalized]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json(
        { error: "MODULE_NOT_FOUND", message: "Module not found" },
        { status: 404 }
      );
    }

    // 2) Validate corpus_source_id in CORPUS (source_registry) — READ only
    const src = await corpusPool.query(
      `SELECT id, title, canonical_url, doc_sha256
       FROM public.source_registry
       WHERE id = $1`,
      [corpusSourceId]
    );
    if (src.rows.length === 0) {
      return NextResponse.json(
        { error: "CORPUS_SOURCE_NOT_FOUND", message: "Corpus source not found" },
        { status: 404 }
      );
    }
    const s = src.rows[0] as {
      id: string;
      title: string | null;
      canonical_url: string | null;
      doc_sha256: string | null;
    };

    // 3) Avoid duplicate attach: (module_code, corpus_source_id) unique for CORPUS_POINTER
    const existing = await runtimePool.query(
      `SELECT id FROM public.module_sources
       WHERE module_code = $1 AND source_type = 'CORPUS_POINTER' AND corpus_source_id = $2`,
      [normalized, corpusSourceId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          error: "ALREADY_ATTACHED",
          message: "This corpus source is already attached to the module",
          module_source_id: existing.rows[0].id,
        },
        { status: 409 }
      );
    }

    // 4) Insert into RUNTIME only
    const ins = await runtimePool.query(
      `INSERT INTO public.module_sources (
        module_code, source_type, corpus_source_id, source_label, source_url, sha256
      ) VALUES ($1, 'CORPUS_POINTER', $2, $3, $4, $5)
      RETURNING id, source_type, corpus_source_id, source_label, source_url, sha256, created_at`,
      [
        normalized,
        corpusSourceId,
        s.title || "Corpus source",
        s.canonical_url || null,
        s.doc_sha256 || null,
      ]
    );

    return NextResponse.json({ ok: true, source: ins.rows[0] });
  } catch (e: unknown) {
    console.error(
      "[API /api/admin/modules/[moduleCode]/sources/attach-corpus]",
      e
    );
    return NextResponse.json(
      { error: "Attach failed", message: e instanceof Error ? e.message : "Attach failed" },
      { status: 500 }
    );
  }
}
