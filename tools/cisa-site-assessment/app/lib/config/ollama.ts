/**
 * Ollama Configuration Resolver
 * Centralized function to get Ollama URL from environment variables.
 * Always uses 127.0.0.1 (never localhost) for consistency.
 *
 * Priority:
 * 1. PSA_OLLAMA_URL (canonical PSA_System variable)
 * 2. OLLAMA_URL (legacy fallback)
 * 3. OLLAMA_HOST (host:port or URL)
 * 4. Default: http://127.0.0.1:11434
 */
export function getOllamaUrl(): string {
  const u =
    process.env.PSA_OLLAMA_URL ||
    process.env.OLLAMA_URL ||
    process.env.OLLAMA_HOST ||
    "http://127.0.0.1:11434";
  const trimmed = String(u).trim().replace(/\/+$/, "");
  const with127 = trimmed.replace(/\blocalhost\b/gi, "127.0.0.1").replace(/\b0\.0\.0\.0\b/g, "127.0.0.1");
  if (!/^https?:\/\//i.test(with127)) return `http://${with127}`;
  return with127;
}
