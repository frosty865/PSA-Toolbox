/**
 * HOST Tool Version Constants
 * Centralized version management - all tools must reference these
 */

export const HOST_VERSION = "3.0.0";
/** Saved assessments from earlier builds may still carry this envelope value */
export const LEGACY_HOST_VERSIONS = Object.freeze(["1.0.0"]);

export function isAcceptedHostVersion(v) {
    return v === HOST_VERSION || LEGACY_HOST_VERSIONS.includes(v);
}

export const SCHEMA_VERSION = "1.0.0";

// Tool IDs for different components
export const TOOL_IDS = {
    ASSESSMENT: "host_assessment",
    VULNERABILITY: "host_vulnerability",
    REPORT: "host_report",
    EXPORT: "host_export",
    IMPORT: "host_import",
    BACKUP: "host_backup"
};

