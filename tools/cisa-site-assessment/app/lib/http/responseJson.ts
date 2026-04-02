/**
 * Safe JSON parsing for fetch Response bodies.
 * `response.json()` throws "Unexpected end of JSON input" when the body is empty or not JSON (common with 502/504 HTML, proxies).
 */

export async function readResponseJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `Empty response body (${response.status} ${response.statusText || ""}).`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid JSON (${response.status}): ${text.slice(0, 500)}`
    );
  }
}

/** Best-effort parse for error bodies; returns null if empty or not JSON. */
export async function tryReadResponseJson<
  T extends Record<string, unknown> = Record<string, unknown>,
>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
