export type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object response payload");
  }
  return value as JsonObject;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  parse: (json: JsonObject) => T
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody || response.statusText}`);
  }
  const raw = (await response.json()) as unknown;
  return parse(asObject(raw));
}
