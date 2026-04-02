export type DraftResponseValue =
  | "YES"
  | "NO"
  | "N_A"
  | string
  | string[]
  | number
  | boolean
  | null;

export type DraftResponses = Record<string, DraftResponseValue>; // key = canon_id

export type DraftEnvelope = {
  schema_version: 1;
  assessment_id: string;
  updated_at: string; // ISO
  responses: DraftResponses;
};

const PREFIX = "psa_rebuild:draft:v1:";

function keyFor(assessmentId: string) {
  return `${PREFIX}${assessmentId}`;
}

export function loadDraft(assessmentId: string): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(keyFor(assessmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope;
    if (parsed?.schema_version !== 1) return null;
    if (parsed?.assessment_id !== assessmentId) return null;
    if (!parsed?.responses || typeof parsed.responses !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(assessmentId: string, responses: DraftResponses): void {
  const env: DraftEnvelope = {
    schema_version: 1,
    assessment_id: assessmentId,
    updated_at: new Date().toISOString(),
    responses,
  };
  localStorage.setItem(keyFor(assessmentId), JSON.stringify(env));
}

export function clearDraft(assessmentId: string): void {
  localStorage.removeItem(keyFor(assessmentId));
}

export function downloadDraftAsFile(env: DraftEnvelope): void {
  const blob = new Blob([JSON.stringify(env, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `psa-assessment-draft-${env.assessment_id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readDraftFile(file: File): Promise<DraftEnvelope> {
  const text = await file.text();
  const parsed = JSON.parse(text) as DraftEnvelope;
  if (parsed?.schema_version !== 1) throw new Error("Unsupported draft schema_version.");
  if (!parsed?.assessment_id) throw new Error("Draft missing assessment_id.");
  if (!parsed?.responses || typeof parsed.responses !== "object") throw new Error("Draft missing responses map.");
  return parsed;
}
