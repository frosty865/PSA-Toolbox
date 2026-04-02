import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { getOllamaUrl } from '@/app/lib/config/ollama';

const RAG_EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text';
const DEFAULT_K = 8;
const MAX_K = 50;

/**
 * POST /api/runtime/technology-library/retrieve
 * RAG retrieval over Technology Library chunks only (tags @> {"library": "technology"}).
 * Body: { query: string, k?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const k = Math.min(
      Math.max(Number(body?.k) ?? DEFAULT_K, 1),
      MAX_K
    );

    if (!query) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const base = getOllamaUrl().replace(/\/+$/, '');
    const embedRes = await fetch(`${base}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: RAG_EMBED_MODEL,
        input: query,
      }),
    });

    if (!embedRes.ok) {
      const text = await embedRes.text();
      console.error('[technology-library/retrieve] Ollama embed failed:', embedRes.status, text);
      return NextResponse.json(
        { error: 'EMBED_FAILED', message: 'Embedding service failed', detail: text },
        { status: 502 }
      );
    }

    const embedData = (await embedRes.json()) as { embedding?: number[]; embeddings?: number[][] };
    const vec = embedData.embedding ?? embedData.embeddings?.[0];
    if (!Array.isArray(vec)) {
      return NextResponse.json(
        { error: 'EMBED_FAILED', message: 'Invalid embedding response shape' },
        { status: 502 }
      );
    }

    const vecLiteral = '[' + vec.map((x) => Number(x)).join(',') + ']';
    const tagsFilter = JSON.stringify({ library: 'technology' });

    const pool = getCorpusPool();
    const result = await pool.query<{
      chunk_id: string;
      source_file: string;
      page_range: string | null;
      chunk_text: string;
      distance: number;
      tags: unknown;
    }>(
      `SELECT
        chunk_id,
        source_file,
        page_range,
        chunk_text,
        (embedding <=> $1::vector) AS distance,
        tags
       FROM public.rag_chunks
       WHERE tags @> $2::jsonb
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vecLiteral, tagsFilter, k]
    );

    const chunks = (result.rows ?? []).map((r) => ({
      chunk_id: r.chunk_id,
      source_file: r.source_file ?? '',
      page_range: r.page_range ?? '',
      chunk_text: r.chunk_text ?? '',
      distance: Number(r.distance),
      tags: r.tags,
    }));

    return NextResponse.json({ chunks });
  } catch (error) {
    console.error('[technology-library/retrieve] Error:', error);
    return NextResponse.json(
      {
        error: 'RETRIEVE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
