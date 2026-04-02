/**
 * POST /api/admin/modules/[moduleCode]/sources/add-from-url
 *
 * Add a module source by fetching from a URL. URL is screened first; only
 * PDFs that pass screening are downloaded, ingested in Node, then inserted
 * into module_sources with the canonical blob storage_relpath.
 *
 * Body: { source_url: string, source_label?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";
import { screenCandidateUrl } from "@/app/lib/crawler/screenCandidateUrl";
import { ingestModulePdfBufferToRuntime } from "@/app/lib/corpus/modulePdfIngest";

export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024; // 100MB
const FETCH_TIMEOUT_MS = 60000; // 60s

function inferExtension(urlPathname: string, contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("pdf")) return ".pdf";
  if (ct.includes("text/html")) return ".html";
  if (ct.includes("text/plain")) return ".txt";
  const base = path.basename(urlPathname);
  const ext = path.extname(base);
  if ([".pdf", ".html", ".htm", ".txt"].includes(ext.toLowerCase())) return ext;
  return ".bin";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    const pool = await ensureRuntimePoolConnected();

    const mod = await pool.query(
      `SELECT 1 FROM public.assessment_modules WHERE module_code = $1`,
      [normalized]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json(
        { error: "MODULE_NOT_FOUND", message: "Module not found" },
        { status: 404 }
      );
    }

    let body: { url?: string; source_url?: string; source_label?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Request body must be JSON with url or source_url" },
        { status: 400 }
      );
    }

    const rawUrl = (body?.url ?? body?.source_url) as string | undefined;
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "url or source_url is required (string)" },
        { status: 400 }
      );
    }

    const urlToScreen = rawUrl.trim();
    const screen = await screenCandidateUrl(urlToScreen, {
      target: { kind: "module", moduleCode: normalized },
      strictness: "strict",
      resolveLandingToPdf: true,
    });
    if (!screen.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "URL did not pass screening",
          rejectCode: screen.rejectCode,
          reasons: screen.reasons,
          canonicalUrl: screen.canonicalUrl,
        },
        { status: 400 }
      );
    }
    const sourceUrl = screen.finalUrl;
    try {
      void new URL(sourceUrl);
    } catch {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Screened URL invalid" },
        { status: 400 }
      );
    }
    const label = (body?.source_label && typeof body.source_label === "string")
      ? body.source_label.trim()
      : null;

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(to);
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "DOWNLOAD_FAILED",
          message: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") || null;
    const urlPathname = new URL(sourceUrl).pathname;
    const ext = inferExtension(urlPathname, contentType);
    const urlBasename = path.basename(urlPathname) || "document";
    const name = urlBasename.includes(".") ? urlBasename : `${urlBasename}${ext}`;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        {
          error: "FILE_TOO_LARGE",
          message: `File is ${(bytes.byteLength / (1024 * 1024)).toFixed(2)}MB (max 100MB)`,
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(bytes);
    const sourceLabel = label || name;

    if (ext !== ".pdf") {
      return NextResponse.json(
        { error: "NOT_PDF", message: "Only PDF documents are supported (single library + chunking)." },
        { status: 400 }
      );
    }

    const ingest = await ingestModulePdfBufferToRuntime({
      buffer: buf,
      moduleCode: normalized,
      label: sourceLabel,
      pool,
    });

    try {
      await pool.query(
        `INSERT INTO public.module_sources (
          module_code, source_type, source_url, source_label, sha256, storage_relpath,
          content_type, fetch_status, fetched_at
        ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, $6, 'DOWNLOADED', now())`,
        [
          normalized,
          sourceUrl,
          sourceLabel,
          ingest.sha256,
          ingest.storageRelpath,
          contentType,
        ]
      );
    } catch (insertErr: unknown) {
      const code = (insertErr && typeof insertErr === "object" && "code" in insertErr)
        ? String((insertErr as { code?: string }).code)
        : "";
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr ?? "");
      if (code === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
        return NextResponse.json(
          {
            error: "ALREADY_ADDED",
            message: "This URL is already added to the module.",
          },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    const row = await pool.query(
      `SELECT id, source_type, source_url, source_label, sha256, storage_relpath, created_at
       FROM public.module_sources
       WHERE module_code = $1 AND sha256 = $2
       ORDER BY created_at DESC LIMIT 1`,
      [normalized, ingest.sha256]
    );

    return NextResponse.json({
      ok: true,
      source: row.rows[0],
      storage_relpath: ingest.storageRelpath,
      screening: { strictness: 'strict', target: { kind: 'module', moduleCode: normalized }, acceptedCount: 1, finalUrl: sourceUrl },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "DOWNLOAD_TIMEOUT", message: "Download timed out (60s)" },
        { status: 408 }
      );
    }
    console.error("[API /api/admin/modules/[moduleCode]/sources/add-from-url]", e);
    return NextResponse.json(
      { error: "Add from URL failed", message: e instanceof Error ? e.message : "Add from URL failed" },
      { status: 500 }
    );
  }
}
