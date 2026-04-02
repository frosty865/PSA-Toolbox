/**
 * Ollama client: robust base URL parsing (no double http://), health check, /api/generate.
 * Model selection: use getMetadataModel() / getGeneralModel() from ollamaModels.ts.
 */

import { getGeneralModel } from './model_router';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

/** Task type for guardrail: metadata-only model must not be used for general inference. */
export type OllamaTaskType = 'metadata' | 'general';

export function getOllamaBaseUrl(): string {
  const raw =
    (process.env.OLLAMA_BASE_URL ?? '').trim() ||
    (process.env.OLLAMA_HOST ?? '').trim() ||
    DEFAULT_OLLAMA_URL;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let out = withScheme.replace(/\/+$/, '');
  out = out.replace(/\blocalhost\b/gi, '127.0.0.1').replace(/\b0\.0\.0\.0\b/g, '127.0.0.1');
  if (/^https?:\/\/127\.0\.0\.1$/i.test(out)) out = `${out}:11434`;
  return out;
}

export async function ollamaHealthCheck(
  timeoutMs = 1500
): Promise<{ ok: boolean; status?: number; error?: string; baseUrl: string }> {
  const baseUrl = getOllamaBaseUrl();
  const url = `${baseUrl}/api/tags`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}`, baseUrl };
    return { ok: true, status: res.status, baseUrl };
  } catch (e: unknown) {
    clearTimeout(t);
    return { ok: false, error: e instanceof Error ? e.message : String(e), baseUrl };
  }
}

/** Inference healthcheck: run generate with general model and "Return ONLY the word OK." */
export async function ollamaInferenceHealthCheck(
  timeoutMs = 15000
): Promise<{ ok: boolean; model: string; response?: string; error?: string; baseUrl: string }> {
  const baseUrl = getOllamaBaseUrl();
  const model = getGeneralModel();
  try {
    const result = await ollamaGenerate(
      { model, prompt: 'Return ONLY the word OK.', stream: false },
      timeoutMs,
      'general'
    );
    const response = typeof result?.response === 'string' ? result.response.trim() : '';
    const ok = /^\s*OK\s*$/i.test(response);
    return { ok, model, response: response.slice(0, 80), baseUrl };
  } catch (e: unknown) {
    return {
      ok: false,
      model,
      error: e instanceof Error ? e.message : String(e),
      baseUrl,
    };
  }
}

export async function ollamaGenerate(
  req: { model: string; prompt: string; stream?: boolean; options?: Record<string, unknown> },
  timeoutMs = 60000,
  taskType: OllamaTaskType = 'general'
): Promise<{ response?: string; [k: string]: unknown }> {
  const model = req.model?.trim() ?? '';
  if (taskType !== 'metadata' && model.startsWith('PSA_Ollama_Model')) {
    throw new Error(
      'Misconfiguration: PSA_Ollama_Model is metadata-only and cannot be used for standards generation. Use PSA_PLAN_STANDARD_MODEL, PSA_OBJECT_STANDARD_MODEL, or PSA_GENERAL_MODEL.'
    );
  }
  const baseUrl = getOllamaBaseUrl();
  const url = `${baseUrl}/api/generate`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream: false, ...req }),
      signal: ac.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status} at ${url}: ${text.slice(0, 300)}`);
    }

    try {
      return JSON.parse(text) as { response?: string; [k: string]: unknown };
    } catch {
      throw new Error(`Ollama non-JSON response at ${url}: ${text.slice(0, 300)}`);
    }
  } catch (e: unknown) {
    throw new Error(`Ollama fetch failed at ${url}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(t);
  }
}
