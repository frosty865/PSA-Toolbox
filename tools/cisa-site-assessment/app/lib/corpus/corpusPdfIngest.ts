import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { extractPdfContentFromBuffer, extractPdfMetadataFromBuffer } from "@/app/lib/pdfExtractTitle";
import { getCorpusPoolForAdmin } from "@/app/lib/db/corpus_client";

type DbLike = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type TableColumns = {
  corpusDocuments: Set<string>;
  documentChunks: Set<string>;
  sourceRegistry: Set<string>;
};

export type CorpusPdfIngestResult = {
  success: boolean;
  documentId?: string;
  docSha256?: string;
  localPath?: string;
  chunksCount?: number;
  publicationDate?: string | null;
  error?: string;
};

const columnsCache = new WeakMap<object, TableColumns>();

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function chunkTextWithOverlap(
  text: string,
  chunkChars = 1800,
  overlapChars = 200,
  minChunkChars = 200
): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkChars;
    if (end < cleaned.length) {
      const searchStart = Math.max(start, end - 200);
      const searchText = cleaned.slice(searchStart, end);
      for (const punct of [". ", ".\n", "! ", "!\n", "? ", "?\n", ".\t"]) {
        const idx = searchText.lastIndexOf(punct);
        if (idx > 0) {
          end = searchStart + idx + punct.length;
          break;
        }
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length >= minChunkChars) chunks.push(chunk);

    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : start + 1;
  }

  return chunks;
}

function buildPageRanges(pages: Array<{ pageNumber: number; text: string }>): Array<{ pageNumber: number; start: number; end: number }> {
  const ranges: Array<{ pageNumber: number; start: number; end: number }> = [];
  let cursor = 0;
  for (const page of pages) {
    const start = cursor;
    const end = start + page.text.length;
    ranges.push({ pageNumber: page.pageNumber, start, end });
    cursor = end + 2;
  }
  return ranges;
}

function resolveChunkPage(
  pageRanges: Array<{ pageNumber: number; start: number; end: number }>,
  chunkStart: number
): number | null {
  for (const range of pageRanges) {
    if (chunkStart >= range.start && chunkStart < range.end) return range.pageNumber;
  }
  return pageRanges.length ? pageRanges[pageRanges.length - 1].pageNumber : null;
}

async function getColumns(pool: DbLike, table: string): Promise<Set<string>> {
  const cacheKey = pool as unknown as object;
  const cached = columnsCache.get(cacheKey);
  if (cached && (table === "corpus_documents" ? cached.corpusDocuments.size : table === "document_chunks" ? cached.documentChunks.size : cached.sourceRegistry.size)) {
    return table === "corpus_documents"
      ? cached.corpusDocuments
      : table === "document_chunks"
        ? cached.documentChunks
        : cached.sourceRegistry;
  }

  const [corpusDocuments, documentChunks, sourceRegistry] = await Promise.all([
    pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'corpus_documents'`
    ),
    pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'document_chunks'`
    ),
    pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'source_registry'`
    ),
  ]);

  const next: TableColumns = {
    corpusDocuments: new Set(corpusDocuments.rows.map((r) => r.column_name)),
    documentChunks: new Set(documentChunks.rows.map((r) => r.column_name)),
    sourceRegistry: new Set(sourceRegistry.rows.map((r) => r.column_name)),
  };
  columnsCache.set(cacheKey, next);

  return table === "corpus_documents"
    ? next.corpusDocuments
    : table === "document_chunks"
      ? next.documentChunks
      : next.sourceRegistry;
}

function titleConfidenceFor(metadataTitle: string | null, titleHint: string | null): number {
  if (metadataTitle) return 80;
  if (titleHint) return 60;
  return 10;
}

function toIsoDate(value: Date | null): string | null {
  if (!value) return null;
  const time = value.getTime();
  if (Number.isNaN(time)) return null;
  return value.toISOString().slice(0, 10);
}

async function updateSourceRegistryAfterIngest(
  pool: DbLike,
  sourceRegistryId: string,
  args: {
    sha256: string;
    localPath: string;
    publicationDate: string | null;
    citationLabel: string | null;
  }
): Promise<void> {
  const sourceColumns = await getColumns(pool, "source_registry");
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (sourceColumns.has("ingestion_stream")) {
    updates.push(`ingestion_stream = 'CORPUS'`);
  }
  if (sourceColumns.has("doc_sha256")) {
    updates.push(`doc_sha256 = $${idx}`);
    params.push(args.sha256);
    idx++;
  }
  if (sourceColumns.has("local_path")) {
    updates.push(`local_path = $${idx}`);
    params.push(args.localPath);
    idx++;
  }
  if (sourceColumns.has("retrieved_at")) {
    updates.push(`retrieved_at = $${idx}`);
    params.push(new Date().toISOString());
    idx++;
  }
  if (sourceColumns.has("publication_date") && args.publicationDate) {
    updates.push(`publication_date = $${idx}`);
    params.push(args.publicationDate);
    idx++;
  }
  if (sourceColumns.has("status")) {
    updates.push(`status = 'ACTIVE'`);
  }

  if (updates.length === 0) return;
  params.push(sourceRegistryId);

  await pool.query(
    `UPDATE public.source_registry
     SET ${updates.join(", ")}, updated_at = now()
     WHERE id = $${idx}`,
    params
  );

  if (!args.citationLabel || !sourceColumns.has("scope_tags")) return;

  const current = await pool.query<{ scope_tags: unknown }>(
    `SELECT scope_tags FROM public.source_registry WHERE id = $1`,
    [sourceRegistryId]
  );
  const currentScopeTags = current.rows[0]?.scope_tags ?? null;
  let merged: Record<string, unknown>;

  if (currentScopeTags && typeof currentScopeTags === "object" && !Array.isArray(currentScopeTags)) {
    merged = { ...(currentScopeTags as Record<string, unknown>) };
  } else if (Array.isArray(currentScopeTags)) {
    merged = { tags: currentScopeTags };
  } else {
    merged = {};
  }
  merged.citation_label = args.citationLabel.slice(0, 500);

  await pool.query(
    `UPDATE public.source_registry
     SET scope_tags = $2::jsonb, updated_at = now()
     WHERE id = $1`,
    [sourceRegistryId, JSON.stringify(merged)]
  );
}

async function upsertCorpusDocumentAndChunks(args: {
  pool: DbLike;
  filePath: string;
  buffer: Buffer;
  sourceRegistryId: string;
  titleHint?: string | null;
  publisherHint?: string | null;
  chunkChars?: number;
  overlapChars?: number;
}): Promise<CorpusPdfIngestResult> {
  const { pool, filePath, buffer, sourceRegistryId } = args;
  const chunkChars = args.chunkChars ?? 1800;
  const overlapChars = args.overlapChars ?? 200;

  const content = await extractPdfContentFromBuffer(buffer);
  if (!content) throw new Error("No text extracted from PDF");

  const metadata = await extractPdfMetadataFromBuffer(buffer);
  const sha256 = sha256Buffer(buffer);
  const fileName = path.basename(filePath);
  const fileStem = path.parse(filePath).name;
  const inferredTitle = metadata.title ?? args.titleHint ?? fileStem ?? null;
  const publisher = metadata.publisher ?? args.publisherHint ?? null;
  const publicationDate = toIsoDate(content.publicationDate);
  const citationShort = metadata.citation_short ?? null;
  const citationFull = metadata.citation_full ?? null;
  const titleConfidence = titleConfidenceFor(metadata.title, args.titleHint ?? null);

  const corpusColumns = await getColumns(pool, "corpus_documents");
  const chunkColumns = await getColumns(pool, "document_chunks");
  const hasSourceRegistryId = corpusColumns.has("source_registry_id");
  const hasProcessingStatus = corpusColumns.has("processing_status");
  const hasProcessedAt = corpusColumns.has("processed_at");
  const hasChunkCount = corpusColumns.has("chunk_count");
  const hasLastError = corpusColumns.has("last_error");

  const existingDoc = await pool.query<{ id: string; title_confidence: number | null }>(
    `SELECT id, title_confidence
     FROM public.corpus_documents
     WHERE file_hash = $1
     LIMIT 1`,
    [sha256]
  );
  const existing = existingDoc.rows[0] ?? null;

  const columnNames: string[] = [
    "file_hash",
    "canonical_path",
    "original_filename",
    "file_stem",
    "inferred_title",
    "title_confidence",
    "pdf_meta_title",
    "pdf_meta_author",
    "pdf_meta_subject",
    "pdf_meta_creator",
    "pdf_meta_producer",
    "pdf_meta_creation_date",
    "pdf_meta_mod_date",
    "publisher",
    "publication_date",
    "source_url",
    "citation_short",
    "citation_full",
    "locator_scheme",
    "ingestion_warnings",
  ];
  const values: unknown[] = [
    sha256,
    filePath,
    fileName,
    fileStem,
    inferredTitle,
    titleConfidence,
    content.pdfMetaTitle,
    content.pdfMetaAuthor,
    null,
    content.pdfMetaCreator,
    content.pdfMetaProducer,
    null,
    null,
    publisher,
    publicationDate,
    null,
    citationShort,
    citationFull,
    "page",
    "[]",
  ];

  if (hasSourceRegistryId) {
    columnNames.push("source_registry_id");
    values.push(sourceRegistryId);
  }

  let documentId = existing?.id ?? null;
  if (documentId) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    updates.push(`canonical_path = $${idx++}`);
    params.push(filePath);
    updates.push(`original_filename = $${idx++}`);
    params.push(fileName);
    updates.push(`file_stem = $${idx++}`);
    params.push(fileStem);

    if (inferredTitle) {
      updates.push(`inferred_title = COALESCE($${idx}, inferred_title)`);
      params.push(inferredTitle);
      idx++;
      updates.push(`title_confidence = GREATEST(COALESCE(title_confidence, 0), $${idx})`);
      params.push(titleConfidence);
      idx++;
    }

    if (content.pdfMetaTitle) {
      updates.push(`pdf_meta_title = COALESCE($${idx}, pdf_meta_title)`);
      params.push(content.pdfMetaTitle);
      idx++;
    }
    if (content.pdfMetaAuthor) {
      updates.push(`pdf_meta_author = COALESCE($${idx}, pdf_meta_author)`);
      params.push(content.pdfMetaAuthor);
      idx++;
    }
    if (content.pdfMetaCreator) {
      updates.push(`pdf_meta_creator = COALESCE($${idx}, pdf_meta_creator)`);
      params.push(content.pdfMetaCreator);
      idx++;
    }
    if (content.pdfMetaProducer) {
      updates.push(`pdf_meta_producer = COALESCE($${idx}, pdf_meta_producer)`);
      params.push(content.pdfMetaProducer);
      idx++;
    }
    if (publisher) {
      updates.push(`publisher = COALESCE($${idx}, publisher)`);
      params.push(publisher);
      idx++;
    }
    if (publicationDate) {
      updates.push(`publication_date = COALESCE($${idx}, publication_date)`);
      params.push(publicationDate);
      idx++;
    }
    if (citationShort) {
      updates.push(`citation_short = COALESCE($${idx}, citation_short)`);
      params.push(citationShort);
      idx++;
    }
    if (citationFull) {
      updates.push(`citation_full = COALESCE($${idx}, citation_full)`);
      params.push(citationFull);
      idx++;
    }
    if (hasSourceRegistryId) {
      updates.push(`source_registry_id = COALESCE($${idx}, source_registry_id)`);
      params.push(sourceRegistryId);
      idx++;
    }
    if (hasProcessingStatus) {
      updates.push(`processing_status = 'PROCESSING'`);
    }
    if (hasProcessedAt) {
      updates.push(`processed_at = NULL`);
    }
    if (hasChunkCount) {
      updates.push(`chunk_count = 0`);
    }
    if (hasLastError) {
      updates.push(`last_error = NULL`);
    }

    params.push(documentId);
    await pool.query(
      `UPDATE public.corpus_documents SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
      params
    );

    await pool.query(`DELETE FROM public.document_chunks WHERE document_id = $1`, [documentId]);
  } else {
    const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(", ");
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO public.corpus_documents (${columnNames.join(", ")})
       VALUES (${placeholders})
       RETURNING id`,
      values
    );
    documentId = inserted.rows[0]?.id ?? null;
  }

  if (!documentId) throw new Error("Failed to resolve corpus_documents.id");

  if (hasProcessingStatus) {
    await pool.query(
      `UPDATE public.corpus_documents
       SET processing_status = 'PROCESSING', updated_at = now()
       WHERE id = $1`,
      [documentId]
    );
  }

  const fullText = content.pages.map((page) => page.text).join("\n\n").trim();
  const chunks = chunkTextWithOverlap(fullText, chunkChars, overlapChars);
  if (!chunks.length) throw new Error("No chunks created from PDF text");

  const pageRanges = buildPageRanges(content.pages);
  const hasChunkId = chunkColumns.has("chunk_id");
  const hasChunkText = chunkColumns.has("chunk_text");
  const hasText = chunkColumns.has("text");
  const hasPageNumber = chunkColumns.has("page_number");
  const hasLocatorType = chunkColumns.has("locator_type");
  const hasLocator = chunkColumns.has("locator");
  const hasSourceSet = chunkColumns.has("source_set");

  const textColumn = hasChunkText ? "chunk_text" : hasText ? "text" : null;
  if (!textColumn) throw new Error("document_chunks table is missing chunk_text/text column");

  let chunksInserted = 0;
  let searchFrom = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunkText = chunks[i];
    const searchText = fullText;
    const chunkStart = searchText.indexOf(chunkText, searchFrom);
    const pageNumber = chunkStart >= 0 ? resolveChunkPage(pageRanges, chunkStart) : null;
    if (chunkStart >= 0) {
      searchFrom = chunkStart + Math.max(1, chunkText.length - overlapChars);
    }

    const cols: string[] = ["document_id", "chunk_index", textColumn];
    const vals: unknown[] = [documentId, i, chunkText];

    if (hasPageNumber && pageNumber != null) {
      cols.push("page_number");
      vals.push(pageNumber);
    }
    if (hasLocatorType) {
      cols.push("locator_type");
      vals.push("PDF");
    }
    if (hasLocator) {
      cols.push("locator");
      vals.push(pageNumber != null ? `Page ${pageNumber}` : null);
    }
    if (hasSourceSet) {
      cols.push("source_set");
      vals.push("PILOT_DOCS");
    }

    const ph = cols.map((_, idx) => `$${idx + 1}`).join(", ");
    const returning = hasChunkId ? " RETURNING chunk_id" : "";
    await pool.query(
      `INSERT INTO public.document_chunks (${cols.join(", ")})
       VALUES (${ph})${returning}`,
      vals
    );
    chunksInserted += 1;
  }

  if (hasProcessingStatus) {
    await pool.query(
      `UPDATE public.corpus_documents
       SET processing_status = 'PROCESSED',
           processed_at = now(),
           chunk_count = $2,
           last_error = NULL,
           updated_at = now()
       WHERE id = $1`,
      [documentId, chunksInserted]
    );
  } else if (hasChunkCount) {
    await pool.query(
      `UPDATE public.corpus_documents
       SET chunk_count = $2,
           updated_at = now()
       WHERE id = $1`,
      [documentId, chunksInserted]
    );
  }

  if (sourceRegistryId) {
    const citationLabel = citationShort || citationFull || inferredTitle || fileStem || null;
    try {
      await updateSourceRegistryAfterIngest(pool, sourceRegistryId, {
        sha256,
        localPath: filePath,
        publicationDate,
        citationLabel,
      });
    } catch {
      // Best-effort only.
    }
  }

  return {
    success: true,
    documentId,
    docSha256: sha256,
    localPath: filePath,
    chunksCount: chunksInserted,
    publicationDate,
  };
}

export async function ingestCorpusPdfFileToDb(args: {
  filePath: string;
  pool?: DbLike;
  sourceRegistryId: string;
  titleHint?: string | null;
  publisherHint?: string | null;
  chunkChars?: number;
  overlapChars?: number;
}): Promise<CorpusPdfIngestResult> {
  try {
    const pool = args.pool ?? getCorpusPoolForAdmin();
    const buffer = await readFile(args.filePath);
    return await upsertCorpusDocumentAndChunks({
      pool,
      filePath: args.filePath,
      buffer,
      sourceRegistryId: args.sourceRegistryId,
      titleHint: args.titleHint,
      publisherHint: args.publisherHint,
      chunkChars: args.chunkChars,
      overlapChars: args.overlapChars,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ingestCorpusPdfBufferToDb(args: {
  buffer: Buffer;
  filePath: string;
  pool?: DbLike;
  sourceRegistryId: string;
  titleHint?: string | null;
  publisherHint?: string | null;
  chunkChars?: number;
  overlapChars?: number;
}): Promise<CorpusPdfIngestResult> {
  try {
    const pool = args.pool ?? getCorpusPoolForAdmin();
    return await upsertCorpusDocumentAndChunks({
      pool,
      filePath: args.filePath,
      buffer: args.buffer,
      sourceRegistryId: args.sourceRegistryId,
      titleHint: args.titleHint,
      publisherHint: args.publisherHint,
      chunkChars: args.chunkChars,
      overlapChars: args.overlapChars,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
