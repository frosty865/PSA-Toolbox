/**
 * True when the web app was built with FIELD_STATIC_EXPORT=1 (static HTML/JS in `out/`).
 * Inlined at build time via next.config `env`.
 */
export function isFieldStaticMode(): boolean {
  return process.env.NEXT_PUBLIC_FIELD_STATIC === '1';
}
