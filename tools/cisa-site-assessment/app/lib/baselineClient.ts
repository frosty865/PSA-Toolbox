/**
 * Baseline Client
 * 
 * Provides read-only access to baseline spines from Next.js API route (consolidated).
 * This is the ONLY source of baseline data - no legacy fallbacks.
 * 
 * NOTE: Consolidated - no longer requires external psaback Flask server.
 */

import type { SubtypeGuidance } from './types/baseline';

export type BaselineSpine = {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  discipline_subtype_id?: string | null; // UUID reference to discipline_subtypes.id
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  canon_version: string;
  canon_hash: string;
  // Guidance content derived from taxonomy at runtime (not stored in DB)
  subtype_name?: string | null;
  subtype_guidance?: SubtypeGuidance | null;
  // Names derived from taxonomy at runtime
  discipline_name?: string | null;
  discipline_subtype_name?: string | null;
};

// Removed getBackendUrl() - no longer needed (consolidated to Next.js API route)

/**
 * Fetch baseline spines from Next.js API route (consolidated - no external psaback needed).
 * 
 * @param activeOnly - Only return active spines (default: true)
 * @returns Array of baseline spine objects
 * @throws Error if fetch fails or data is invalid
 */
export async function fetchBaselineSpines(activeOnly: boolean = true): Promise<BaselineSpine[]> {
  // Use Next.js API route instead of external psaback
  // This works in both server-side (API routes) and client-side contexts
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const url = `${baseUrl}/api/baseline/spines?active_only=${activeOnly}`;
  
  let res: Response;
  try {
    res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to baseline API at ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `Baseline fetch failed: ${res.status} ${res.statusText}. Response: ${errorText}`
    );
  }
  
  let data: BaselineSpine[];
  try {
    data = await res.json() as BaselineSpine[];
  } catch (error) {
    throw new Error(
      `Invalid JSON response from baseline API: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  
  // Fail closed: basic shape checks
  if (!Array.isArray(data)) {
    throw new Error('Baseline spines response is not an array');
  }
  
  if (data.length === 0) {
    throw new Error('Baseline spines response is empty - no active spines found');
  }
  
  // Validate each spine and explicitly map fields to ensure discipline_subtype_id is preserved
  const mappedData: BaselineSpine[] = data.map((r: Record<string, unknown>) => {
    const responseEnumRaw = Array.isArray(r.response_enum) ? r.response_enum : [];
    const response_enum: ["YES", "NO", "N_A"] =
      responseEnumRaw.length === 3 &&
      responseEnumRaw[0] === "YES" &&
      responseEnumRaw[1] === "NO" &&
      responseEnumRaw[2] === "N_A"
        ? ["YES", "NO", "N_A"]
        : ["YES", "NO", "N_A"];

    return {
      canon_id: String(r.canon_id ?? ""),
      discipline_code: String(r.discipline_code ?? ""),
      subtype_code: (r.subtype_code as string | null) ?? null,
      discipline_subtype_id: (r.discipline_subtype_id as string | null) ?? null,
      question_text: String(r.question_text ?? ""),
      response_enum,
      canon_version: String(r.canon_version ?? ""),
      canon_hash: String(r.canon_hash ?? ""),
      subtype_name: (r.subtype_name as string | null) ?? null,
      subtype_guidance: (r.subtype_guidance as SubtypeGuidance | null) ?? null,
      discipline_name: (r.discipline_name as string | null) ?? null,
      discipline_subtype_name: (r.discipline_subtype_name as string | null) ?? null,
    };
  });

  // Validate each spine
  for (const s of mappedData) {
    if (!s.canon_id || !s.discipline_code || !s.question_text) {
      throw new Error(
        `Baseline spine missing required fields: canon_id=${s.canon_id}, discipline_code=${s.discipline_code}, question_text=${s.question_text ? 'present' : 'missing'}`
      );
    }
    
    if (!Array.isArray(s.response_enum)) {
      throw new Error(`Baseline spine has invalid response_enum (not array): ${s.canon_id}`);
    }
    
    const expectedEnum = ["YES", "NO", "N_A"];
    const actualEnum = s.response_enum.join(",");
    const expectedEnumStr = expectedEnum.join(",");
    if (actualEnum !== expectedEnumStr) {
      throw new Error(
        `Baseline spine has invalid response_enum: ${s.canon_id}. Expected [${expectedEnumStr}], got [${actualEnum}]`
      );
    }
  }
  
  return mappedData;
}
