/**
 * Build-time / release constants. Used for DOCX metadata and display.
 * TOOL_VERSION should match schema package.json version for releases.
 */
export const TOOL_VERSION = process.env.TOOL_VERSION ?? "0.1.0";
export const TEMPLATE_VERSION = "v1";
export const BUILD_ID = process.env.BUILD_ID ?? "dev";
