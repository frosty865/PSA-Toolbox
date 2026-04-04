/**
 * Client-side VOFC generation. No Node APIs; uses bundled vofc-library.json.
 * Client-side VOFC generation from bundled vofc-library.json.
 */
import type { Assessment, VOFCCollection } from 'schema';
import { generateVOFCsFromEntries } from 'engine/client';
import type { InternalVofcEntry } from 'engine/client';

export type VofcGenerateRequest = {
  assessment: Assessment;
};

export type VofcGenerateResponse =
  | { ok: true; collection: VOFCCollection }
  | { ok: false; code: string; message: string; debug?: unknown };

async function loadVofcLibrary(baseUrl: string): Promise<InternalVofcEntry[]> {
  const url = baseUrl ? `${baseUrl}/vofc-library.json` : '/vofc-library.json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      'VOFC library not available. Ensure vofc-library.json was built (pnpm build:vofc-json).'
    );
  }
  return res.json() as Promise<InternalVofcEntry[]>;
}

/**
 * Generate VOFC collection client-side from assessment + bundled library.
 * Deterministic, no server required.
 */
export async function generateVofcClient(
  req: VofcGenerateRequest,
  options?: { baseUrl?: string }
): Promise<VofcGenerateResponse> {
  try {
    const baseUrl = options?.baseUrl ?? (typeof window !== 'undefined' ? '' : undefined);
    const entries = await loadVofcLibrary(baseUrl || '');
    const collection = generateVOFCsFromEntries(req.assessment, entries);
    return { ok: true, collection };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: 'VOFC_GENERATE_FAILED',
      message,
      debug: err,
    };
  }
}
