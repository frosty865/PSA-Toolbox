/**
 * Extract document title from a PDF buffer or file path.
 *
 * This replaces the old Python-backed metadata scraper for the Vercel-facing
 * PDF title / publisher paths. It uses pdfjs-dist directly so the app can run
 * without Python for metadata extraction.
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { normalizePublisherName, isUnacceptablePublisher } from "@/app/lib/sourceRegistry/publisherNormalizer";
import { isUnacceptableTitle } from "@/app/lib/sourceRegistry/schema";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type PdfjsMetadata = {
  info?: {
    Title?: unknown;
    Author?: unknown;
    Creator?: unknown;
    Producer?: unknown;
    CreationDate?: unknown;
    ModDate?: unknown;
  };
  metadata?: {
    get?: (key: string) => unknown;
  } | null;
};

type PdfExtractResult = {
  pdfMetaTitle: string | null;
  pdfMetaAuthor: string | null;
  pdfMetaCreator: string | null;
  pdfMetaProducer: string | null;
  publicationDate: Date | null;
  pages: Array<{ pageNumber: number; text: string }>;
  firstPageLines: string[];
  firstPagesText: string;
};

const PDF_DATE_RE = /^D:(\d{4})(\d{2})?(\d{2})?/;
const PAGE_MARKER_RE = /^(page\s+\d+(\s+of\s+\d+)?)|^\d+$/i;
const URL_RE = /https?:\/\/|www\./i;
const COPYRIGHT_RE = /©|copyright/i;
const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/;
const PDFJS_STANDARD_FONT_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
const PDFJS_STANDARD_FONT_URL = `${pathToFileURL(PDFJS_STANDARD_FONT_DIR).href}/`;

/**
 * Sanitize a string for use as a filename (no extension).
 * Replaces invalid chars, trims, limits length.
 */
export function sanitizePdfFilename(title: string): string {
  if (!title || typeof title !== "string") return "";
  let s = title
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 180) s = s.slice(0, 180).trim();
  return s || "";
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : null;
}

function parsePdfDate(value: unknown): Date | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const match = PDF_DATE_RE.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) - 1 : 0;
  const day = match[3] ? Number(match[3]) : 1;
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferPublicationDate(meta: PdfjsMetadata | null, text: string): Date | null {
  const candidates = [
    meta?.info?.CreationDate,
    meta?.info?.ModDate,
    meta?.metadata?.get?.("xmp:CreateDate"),
    meta?.metadata?.get?.("xmp:ModifyDate"),
  ];
  for (const candidate of candidates) {
    const parsed = parsePdfDate(candidate);
    if (parsed) return parsed;
  }

  const yearMatch = /\b(19\d{2}|20\d{2})\b/.exec(text);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const date = new Date(Date.UTC(year, 0, 1));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function isPlausibleTitleCandidate(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (text.length < 4 || text.length > 220) return false;
  if (PAGE_MARKER_RE.test(text)) return false;
  if (URL_RE.test(text) || COPYRIGHT_RE.test(text) || EMAIL_RE.test(text)) return false;
  if (text.split(/\s+/).length === 1 && text.length < 8) return false;
  if (isUnacceptableTitle(text)) return false;
  return /[A-Za-z]/.test(text);
}

function scoreTitleCandidate(value: string): number {
  const text = value.replace(/\s+/g, " ").trim();
  let score = text.length;
  if (/\b(title|report|guide|manual|handbook|framework|standard|assessment|plan)\b/i.test(text)) score += 10;
  if (/[:;]$/.test(text)) score -= 5;
  if (/^[A-Z0-9\s&-]{10,}$/.test(text)) score += 4;
  if (/\b(pdf|version|rev(?:ision)?|draft)\b/i.test(text)) score -= 4;
  return score;
}

function inferTitle(meta: PdfjsMetadata | null, firstPageLines: string[], firstPagesText: string): string | null {
  const metaTitle =
    normalizeText(meta?.info?.Title) ??
    normalizeText(meta?.metadata?.get?.("dc:title")) ??
    normalizeText(meta?.metadata?.get?.("Title"));
  if (metaTitle && isPlausibleTitleCandidate(metaTitle)) {
    return metaTitle;
  }

  const candidates = firstPageLines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(isPlausibleTitleCandidate)
    .sort((a, b) => scoreTitleCandidate(b) - scoreTitleCandidate(a));

  if (candidates.length > 0) {
    return candidates[0];
  }

  const wholeText = firstPagesText.replace(/\s+/g, " ").trim();
  if (isPlausibleTitleCandidate(wholeText)) {
    return wholeText;
  }

  return null;
}

function inferPublisher(meta: PdfjsMetadata | null, firstPageLines: string[], firstPagesText: string): string | null {
  const candidatePhrases = (value: unknown): string[] =>
    normalizeText(value)
      ?.split(/[;|,/]/g)
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  const candidates = [
    meta?.info?.Author,
    meta?.info?.Creator,
    meta?.info?.Producer,
    meta?.metadata?.get?.("dc:creator"),
    meta?.metadata?.get?.("pdf:Producer"),
  ];

  for (const candidate of candidates) {
    for (const phrase of candidatePhrases(candidate)) {
      const publisher = normalizePublisherName(phrase);
      if (publisher && !isUnacceptablePublisher(publisher)) {
        return publisher;
      }
    }
  }

  const textSources = [...firstPageLines, firstPagesText];
  for (const source of textSources) {
    for (const phrase of candidatePhrases(source)) {
      const publisher = normalizePublisherName(phrase);
      if (publisher && !isUnacceptablePublisher(publisher)) {
        return publisher;
      }
    }
  }

  return null;
}

export async function extractPdfContentFromBuffer(buffer: Buffer): Promise<PdfExtractResult | null> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    stopAtErrors: false,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch {
    return null;
  }

  try {
    const meta = (await doc.getMetadata().catch(() => null)) as PdfjsMetadata | null;
    const pageCount = Math.min(doc.numPages, 2);
    const allPages: Array<{ pageNumber: number; text: string }> = [];
    const firstPageLines: string[] = [];
    const firstPageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      } as never);

      const lines: string[] = [];
      let current = "";
      for (const rawItem of textContent.items as Array<{ str?: string; hasEOL?: boolean }>) {
        const str = typeof rawItem.str === "string" ? rawItem.str.replace(/\s+/g, " ").trim() : "";
        if (str) {
          current = current ? `${current} ${str}` : str;
        }
        if (rawItem.hasEOL) {
          const line = current.replace(/\s+/g, " ").trim();
          if (line) lines.push(line);
          current = "";
        }
      }
      const tail = current.replace(/\s+/g, " ").trim();
      if (tail) lines.push(tail);

      if (pageNumber === 1) {
        firstPageLines.push(...lines.slice(0, 40));
      } else if (pageNumber <= pageCount) {
        firstPageLines.push(...lines.slice(0, 20));
      }
      const pageText = lines.join("\n");
      if (pageNumber <= pageCount) {
        firstPageTexts.push(pageText);
      }
      allPages.push({ pageNumber, text: pageText });
    }

    const firstPagesText = firstPageTexts.join("\n\n").trim();
    const publicationDate = inferPublicationDate(meta, firstPagesText);

    return {
      pdfMetaTitle: normalizeText(meta?.info?.Title) ?? normalizeText(meta?.metadata?.get?.("dc:title")),
      pdfMetaAuthor: normalizeText(meta?.info?.Author) ?? null,
      pdfMetaCreator: normalizeText(meta?.info?.Creator) ?? null,
      pdfMetaProducer: normalizeText(meta?.info?.Producer) ?? null,
      publicationDate,
      pages: allPages,
      firstPageLines,
      firstPagesText,
    };
  } catch {
    return null;
  } finally {
    try {
      await doc.destroy();
    } catch {
      /* ignore */
    }
  }
}

function formatCitationShort(
  publisher: string | null,
  inferredTitle: string | null,
  publicationDate: Date | null
): string | null {
  if (!publisher || !inferredTitle) return null;
  const parts = [publisher.replace(/[.;]+$/g, "") + ".", inferredTitle.replace(/[.;]+$/g, "") + "."];
  if (publicationDate) {
    parts.push(`${publicationDate.getUTCFullYear()}.`);
  }
  return parts.join(" ");
}

function formatCitationFull(
  publisher: string | null,
  inferredTitle: string | null,
  publicationDate: Date | null
): string | null {
  if (!publisher || !inferredTitle) return null;
  const pub = publisher.replace(/[.;]+$/g, "");
  const title = inferredTitle.replace(/[.;]+$/g, "");
  const parts = [`${pub}.`, `${title}.`];
  if (publicationDate) {
    parts.push(`${pub}; ${publicationDate.getUTCFullYear()}.`);
  }
  return parts.join(" ");
}

/**
 * Extract title from PDF buffer.
 */
export async function extractPdfTitleFromBuffer(buffer: Buffer): Promise<string | null> {
  const result = await extractPdfContentFromBuffer(buffer);
  if (!result) return null;

  const inferredTitle =
    inferTitle(
      {
        info: {
          Title: result.pdfMetaTitle,
        },
      },
      result.firstPageLines,
      result.firstPagesText
    ) ?? result.pdfMetaTitle;

  return inferredTitle || null;
}

/**
 * Extract title and publisher from PDF buffer.
 */
export async function extractPdfMetadataFromBuffer(buffer: Buffer): Promise<{
  title: string | null;
  publisher: string | null;
  citation_short: string | null;
  citation_full: string | null;
}> {
  const result = await extractPdfContentFromBuffer(buffer);
  if (!result) {
    return { title: null, publisher: null, citation_short: null, citation_full: null };
  }

  const title = inferTitle(
    {
      info: { Title: result.pdfMetaTitle },
    },
    result.firstPageLines,
    result.firstPagesText
  );

  const publisher = inferPublisher(
    {
      info: {
        Author: result.pdfMetaAuthor,
        Creator: result.pdfMetaCreator,
        Producer: result.pdfMetaProducer,
      },
    },
    result.firstPageLines,
    result.firstPagesText
  );

  const citation_short = formatCitationShort(publisher, title, result.publicationDate);
  const citation_full = formatCitationFull(publisher, title, result.publicationDate);

  return {
    title: title || null,
    publisher: publisher || null,
    citation_short,
    citation_full,
  };
}

/**
 * Extract title and publisher from a PDF file path (content-only; file name is NEVER used).
 * Used for ingestion/triage. When extraction fails or returns empty, returns placeholder strings
 * rather than deriving from filename.
 */
export async function extractPdfMetadataFromPath(filePath: string): Promise<{
  title: string;
  publisher: string;
  citation_short?: string | null;
  citation_full?: string | null;
}> {
  const placeholderTitle = "Unknown";
  const placeholderPublisher = "—";

  if (!existsSync(filePath)) {
    return { title: placeholderTitle, publisher: placeholderPublisher };
  }

  try {
    const buffer = await readFile(filePath);
    const result = await extractPdfMetadataFromBuffer(buffer);
    const title = result.title && !isUnacceptableTitle(result.title) ? result.title : placeholderTitle;
    const publisher = result.publisher && !isUnacceptablePublisher(result.publisher)
      ? result.publisher
      : placeholderPublisher;

    return {
      title,
      publisher,
      citation_short: result.citation_short ?? null,
      citation_full: result.citation_full ?? null,
    };
  } catch {
    return { title: placeholderTitle, publisher: placeholderPublisher };
  }
}

/**
 * Get a safe filename (stem only) for an uploaded PDF from its buffer.
 * Uses document title scraped from the PDF when available; otherwise returns null
 * so the caller can use the original filename.
 */
export async function getPdfFilenameFromTitle(buffer: Buffer): Promise<string | null> {
  const title = await extractPdfTitleFromBuffer(buffer);
  if (!title) return null;
  const sanitized = sanitizePdfFilename(title);
  return sanitized || null;
}
