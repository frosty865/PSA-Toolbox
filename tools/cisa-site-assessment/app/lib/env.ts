/**
 * Environment Variables Utility
 * Centralized access to environment variables from .env.local
 */

/**
 * Get Google Maps API key from environment variables
 * @returns Google Maps API key or undefined if not configured
 */
export function getGoogleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/**
 * Check if Google Maps API is configured
 * @returns true if API key is present
 */
export function isGoogleMapsConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/**
 * Get all environment variables (for debugging)
 * Only includes NEXT_PUBLIC_ prefixed vars (safe for client-side)
 */
export function getPublicEnvVars(): Record<string, string | undefined> {
  return {
    GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    OLLAMA_URL: process.env.NEXT_PUBLIC_OLLAMA_URL,
  };
}
