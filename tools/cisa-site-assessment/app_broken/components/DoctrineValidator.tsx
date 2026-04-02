/**
 * Server Component: Doctrine Validator
 * 
 * Validates doctrine files at runtime when the app starts.
 * This runs on the server side and throws if doctrine files are missing.
 */
import { validateDoctrineOrThrow } from "@/lib/validateDoctrine";
import path from "path";

// Validate doctrine files on import (server-side only)
if (typeof window === "undefined") {
  try {
    const doctrineDir = path.join(process.cwd(), "public", "doctrine");
    validateDoctrineOrThrow(doctrineDir);
  } catch (error) {
    console.error("[DOCTRINE] Runtime validation failed:", error);
    // In production, this should fail hard
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.warn("[DOCTRINE] Continuing in development mode despite validation failure");
  }
}

/**
 * This component doesn't render anything - it's just for side effects.
 * The validation runs when the module is imported.
 */
export default function DoctrineValidator() {
  return null;
}

