import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { extractPdfContentFromBuffer } from "@/app/lib/pdfExtractTitle";
import {
  assertModulePath,
  ensureStorageDirs,
  getModuleSourcesRoot,
  moduleBlobRelpath,
} from "@/app/lib/storage/config";

type DbLike = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type PdfPage = { pageNumber: number; text: string };

export type ModulePdfIngestResult = {
  status: "ingested" | "already_ingested";
  moduleDocumentId: string;
  chunksCount: number;
  sha256: string;
  storageRelpath: string;
  localPath: string;
  publisher: string | null;
};

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function chunkTextWithOverlap(
  text: string,
  chunkChars = 1800,
  overlapChars = 200,
  minChunkChars = 200
): string[] {
  if (!text.trim()) return [];

  if (text.length <= chunkChars) {
    return text.trim() ? [text] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkChars;

    if (end < text.length) {
      const searchStart = Math.max(start, end - 200);
      const searchText = text.slice(searchStart, end);
      for (const punct of [". ", ".\n", "! ", "!\n", "? ", "?\n", ".\t"]) {
        const lastIdx = searchText.lastIndexOf(punct);
        if (lastIdx > 0) {
          end = searchStart + lastIdx + punct.length;
          break;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk && chunk.length >= minChunkChars) {
      chunks.push(chunk);
    }

    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : start + 1;
    if (start >= text.length) {
      break;
    }
  }

  if (chunks.length < 10 && text.length > 2000 && chunkChars >= 1800) {
    const smallerChunk = Math.max(800, Math.floor(text.length / 20));
    if (smallerChunk < chunkChars) {
      return chunkTextWithOverlap(text, smallerChunk, overlapChars, minChunkChars);
    }
  }

  return chunks;
}

function buildPageRanges(pages: PdfPage[]): Array<{ pageNumber: number; start: number; end: number }> {
  const ranges: Array<{ pageNumber: number; start: number; end: number }> = [];
  let cursor = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const start = cursor;
    const end = start + page.text.length;
    ranges.push({ pageNumber: page.pageNumber, start, end });
    cursor = end + 2;
  }
  return ranges;
}

function resolveChunkPage(pageRanges: Array<{ pageNumber: number; start: number; end: number }>, chunkStart: number): number | null {
  for (const range of pageRanges) {
    if (chunkStart >= range.start && chunkStart < range.end) {
      return range.pageNumber;
    }
  }
  return pageRanges.length ? pageRanges[pageRanges.length - 1].pageNumber : null;
}

export async function ingestModulePdfBufferToRuntime(args: {
  buffer: Buffer;
  moduleCode: string;
  label: string;
  pool: DbLike;
  chunkChars?: number;
  overlapChars?: number;
}): Promise<ModulePdfIngestResult> {
  const { buffer, moduleCode, label, pool, chunkChars = 1800, overlapChars = 200 } = args;

  await ensureStorageDirs();

  const sha256 = sha256Buffer(buffer);
  const root = getModuleSourcesRoot();
  const canonicalRelpath = moduleBlobRelpath(sha256);
  const blobRow = await pool.query<{ id: string; storage_relpath: string | null }>(
    "SELECT id, storage_relpath FROM public.document_blobs WHERE sha256 = $1 LIMIT 1",
    [sha256]
  );

  const existingBlob = blobRow.rows[0] ?? null;
  const storageRelpath = (existingBlob?.storage_relpath && existingBlob.storage_relpath.trim()) || canonicalRelpath;
  const absPath = path.join(root, storageRelpath);
  assertModulePath(absPath);

  const createdBlobFile = !existsSync(absPath);
  if (createdBlobFile) {
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, buffer);
  }

  try {
    const content = await extractPdfContentFromBuffer(buffer);
    if (!content) {
      throw new Error("No text extracted from PDF");
    }

    const fullText = content.pages.map((page) => page.text).join("\n\n").trim();
    const chunks = chunkTextWithOverlap(fullText, chunkChars, overlapChars);
    if (!chunks.length) {
      throw new Error("No chunks created from PDF text");
    }

    let blobId = existingBlob?.id ?? null;
    if (!blobId) {
      const insertBlob = await pool.query<{ id: string }>(
        "INSERT INTO public.document_blobs (sha256, storage_relpath) VALUES ($1, $2) ON CONFLICT (sha256) DO NOTHING RETURNING id",
        [sha256, storageRelpath]
      );
      blobId = insertBlob.rows[0]?.id ?? null;
      if (!blobId) {
        const refetch = await pool.query<{ id: string }>(
          "SELECT id FROM public.document_blobs WHERE sha256 = $1 LIMIT 1",
          [sha256]
        );
        blobId = refetch.rows[0]?.id ?? null;
      }
    }
    if (!blobId) {
      throw new Error("Failed to resolve document_blobs row");
    }

    const existingDoc = await pool.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.module_documents
       WHERE module_code = $1 AND sha256 = $2
       LIMIT 1`,
      [moduleCode, sha256]
    );

    const existing = existingDoc.rows[0] ?? null;
    if (existing?.status === "INGESTED") {
      const chunkCountRow = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM public.module_chunks
         WHERE module_document_id = $1`,
        [existing.id]
      );
      return {
        status: "already_ingested",
        moduleDocumentId: existing.id,
        chunksCount: parseInt(chunkCountRow.rows[0]?.count ?? "0", 10) || 0,
        sha256,
        storageRelpath,
        localPath: storageRelpath,
        publisher: null,
      };
    }

    const localPath = storageRelpath.replace(/\\/g, "/");
    const pageRanges = buildPageRanges(content.pages);

    let moduleDocumentId = existing?.id ?? null;
    if (moduleDocumentId) {
      await pool.query(
        `UPDATE public.module_documents
         SET label = $1, local_path = $2, sha256 = $3, document_blob_id = $4, status = 'INGESTED', updated_at = NOW(), publisher = $5
         WHERE id = $6`,
        [label, localPath, sha256, blobId, null, moduleDocumentId]
      );
      await pool.query(`DELETE FROM public.module_chunks WHERE module_document_id = $1`, [moduleDocumentId]);
    } else {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO public.module_documents
         (module_code, label, source_type, local_path, sha256, document_blob_id, status, publisher)
         VALUES ($1, $2, 'MODULE_UPLOAD', $3, $4, $5, 'INGESTED', $6)
         RETURNING id`,
        [moduleCode, label, localPath, sha256, blobId, null]
      );
      moduleDocumentId = inserted.rows[0]?.id ?? null;
    }

    if (!moduleDocumentId) {
      throw new Error("Failed to resolve module_document id");
    }

    let searchFrom = 0;
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunkText = chunks[chunkIndex];
      const chunkStart = fullText.indexOf(chunkText, searchFrom);
      const pageNumber = chunkStart >= 0 ? resolveChunkPage(pageRanges, chunkStart) : null;
      if (chunkStart >= 0) {
        searchFrom = chunkStart + Math.max(1, chunkText.length - overlapChars);
      }
      const locator = pageNumber
        ? JSON.stringify({ type: "PDF_PAGE", page: pageNumber })
        : null;

      await pool.query(
        `INSERT INTO public.module_chunks
         (module_document_id, chunk_index, text, locator)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [moduleDocumentId, chunkIndex, chunkText, locator]
      );
    }

    return {
      status: "ingested",
      moduleDocumentId,
      chunksCount: chunks.length,
      sha256,
      storageRelpath,
      localPath,
      publisher: null,
    };
  } catch (error) {
    if (createdBlobFile) {
      try {
        await unlink(absPath);
      } catch {
        /* ignore */
      }
    }
    throw error;
  }
}
