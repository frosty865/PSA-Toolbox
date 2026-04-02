/**
 * HOST JSON Core - Browser-Compatible Implementation
 * Implements the TypeScript JSON subsystem for browser use
 * This is a complete, standalone implementation
 */

(function(global) {
    'use strict';

    // ============================================
    // CONSTANTS
    // ============================================
    const HOST_VERSION = "3.0.0";
    const SCHEMA_VERSION = "1.0.0";
    
    const TOOL_IDS = {
        ASSESSMENT: "host_assessment",
        VULNERABILITY: "host_vulnerability",
        REPORT: "host_report",
        EXPORT: "host_export",
        IMPORT: "host_import",
        BACKUP: "host_backup",
        RISK_MATRIX: "risk_matrix",
        COMMS_PLAN: "comms_plan"
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function isPlainObject(value) {
        return (
            typeof value === "object" &&
            value !== null &&
            (value.constructor === Object || Object.getPrototypeOf(value) === null)
        );
    }

    function structuredCloneSafe(value) {
        if (typeof globalThis.structuredClone === "function") {
            return globalThis.structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function deepMerge(base, override) {
        if (!override) return structuredCloneSafe(base);
        const result = structuredCloneSafe(base);
        for (const [key, value] of Object.entries(override)) {
            if (value === undefined) continue;
            const baseValue = result[key];
            if (isPlainObject(baseValue) && isPlainObject(value)) {
                result[key] = deepMerge(baseValue, value);
            } else {
                result[key] = structuredCloneSafe(value);
            }
        }
        return result;
    }

    // ============================================
    // DEFAULTS
    // ============================================
    
    function getDefaultDataForTool(toolId) {
        switch (toolId) {
            case TOOL_IDS.RISK_MATRIX:
                return {
                    threats: [],
                    mitigations: [],
                    parameters: {},
                    calculations: {}
                };
            case TOOL_IDS.COMMS_PLAN:
                return {
                    contacts: [],
                    channels: [],
                    procedures: [],
                    notes: ""
                };
            case TOOL_IDS.ASSESSMENT:
                return {
                    sections: {},
                    tables: {}
                };
            default:
                return {};
        }
    }

    function getDefaultMetadataForTool(toolId) {
        return {
            tool_label: toolId,
            created_by: null,
            source: null
        };
    }

    function wrapLegacyDataAsEnvelope(toolId, data) {
        const now = Date.now();
        return {
            host_version: HOST_VERSION,
            schema_version: SCHEMA_VERSION,
            tool_id: toolId,
            tool_version: "1.0.0",
            timestamp_created: now,
            timestamp_modified: now,
            metadata: getDefaultMetadataForTool(toolId),
            data: data ?? {}
        };
    }

    // ============================================
    // CREATE HOST JSON
    // ============================================
    
    function createHostJson(options) {
        const {
            toolId,
            toolVersion = "1.0.0",
            data,
            metadata,
            existing
        } = options;

        const now = Date.now();
        const baseCreated = existing?.timestamp_created && Number.isFinite(existing.timestamp_created)
            ? existing.timestamp_created
            : now;

        const defaultData = getDefaultDataForTool(toolId);
        const defaultMetadata = getDefaultMetadataForTool(toolId);

        const mergedData = deepMerge(defaultData, data);
        const mergedMetadata = deepMerge(defaultMetadata, metadata);

        return {
            host_version: HOST_VERSION,
            schema_version: SCHEMA_VERSION,
            tool_id: toolId,
            tool_version: toolVersion,
            timestamp_created: baseCreated,
            timestamp_modified: now,
            metadata: mergedMetadata,
            data: mergedData
        };
    }

    function updateHostJson(existing, patch) {
        const { data, metadata, toolVersion } = patch || {};
        const mergedData = deepMerge(existing.data, data);
        const mergedMetadata = deepMerge(existing.metadata, metadata);

        return {
            host_version: HOST_VERSION,
            schema_version: SCHEMA_VERSION,
            tool_id: existing.tool_id,
            tool_version: toolVersion ?? existing.tool_version,
            timestamp_created: existing.timestamp_created,
            timestamp_modified: Date.now(),
            metadata: mergedMetadata,
            data: mergedData
        };
    }

    // ============================================
    // VALIDATE HOST JSON
    // ============================================
    
    function validateHostJson(input, options = {}) {
        const { autoFix = true } = options;
        const errors = [];

        if (!isPlainObject(input)) {
            errors.push({
                path: "",
                message: "Envelope must be an object.",
                expected: "object",
                actual: typeof input
            });
            return { valid: false, errors };
        }

        const json = structuredCloneSafe(input);

        ensureString(json, "host_version", HOST_VERSION, autoFix, errors);
        ensureString(json, "schema_version", SCHEMA_VERSION, autoFix, errors);
        ensureString(json, "tool_id", "generic", autoFix, errors);
        ensureString(json, "tool_version", "1.0.0", autoFix, errors);
        ensureNumber(json, "timestamp_created", Date.now(), autoFix, errors);
        ensureNumber(json, "timestamp_modified", Date.now(), autoFix, errors);
        ensureObject(json, "metadata", {}, autoFix, errors);
        ensureObject(json, "data", {}, autoFix, errors);

        const toolId = String(json.tool_id ?? "generic");
        const defaultData = getDefaultDataForTool(toolId);
        const defaultMetadata = getDefaultMetadataForTool(toolId);

        if (autoFix) {
            json.data = shallowFillDefaults(json.data, defaultData);
            json.metadata = shallowFillDefaults(json.metadata, defaultMetadata);
        }

        const valid = errors.length === 0;
        return {
            valid,
            errors,
            // When autoFix is enabled, return normalized JSON even if errors were recorded.
            json: (valid || autoFix) ? json : undefined,
            healed: (valid || autoFix) ? json : null
        };
    }

    function ensureString(obj, key, defaultValue, autoFix, errors) {
        const value = obj[key];
        if (typeof value === "string" && value.length > 0) return;
        if (autoFix) {
            obj[key] = defaultValue;
        }
        errors.push({
            path: key,
            message: `Expected non-empty string for "${key}".`,
            expected: "non-empty string",
            actual: value
        });
    }

    function ensureNumber(obj, key, defaultValue, autoFix, errors) {
        const value = obj[key];
        if (typeof value === "number" && Number.isFinite(value)) return;
        if (autoFix) {
            obj[key] = defaultValue;
        }
        errors.push({
            path: key,
            message: `Expected finite number for "${key}".`,
            expected: "number",
            actual: value
        });
    }

    function ensureObject(obj, key, defaultValue, autoFix, errors) {
        const value = obj[key];
        if (isPlainObject(value)) return;
        if (autoFix) {
            obj[key] = defaultValue;
        }
        errors.push({
            path: key,
            message: `Expected plain object for "${key}".`,
            expected: "object",
            actual: value
        });
    }

    function shallowFillDefaults(target, defaults) {
        if (!isPlainObject(target)) target = {};
        const result = { ...target };
        for (const [key, defVal] of Object.entries(defaults)) {
            if (result[key] === undefined) {
                result[key] = structuredCloneSafe(defVal);
            }
        }
        return result;
    }

    // ============================================
    // MIGRATE HOST JSON
    // ============================================
    
    function migrateHostJson(input) {
        if (!isPlainObject(input)) {
            return {
                valid: false,
                errors: [{
                    path: "",
                    message: "Input must be an object.",
                    expected: "object",
                    actual: typeof input
                }]
            };
        }

        if (isLegacyBareData(input)) {
            const toolId = detectLegacyToolId(input);
            const wrapped = wrapLegacyDataAsEnvelope(toolId, input);
            return validateHostJson(wrapped, { autoFix: true });
        }

        const asAny = input;
        const currentSchema = typeof asAny.schema_version === "string"
            ? asAny.schema_version
            : "0.9.0";

        switch (currentSchema) {
            case "0.9.0": {
                const migrated = migrate_090_to_100(asAny);
                return validateHostJson(migrated, { autoFix: true });
            }
            case "1.0.0": {
                return validateHostJson(asAny, { autoFix: true });
            }
            default: {
                const result = validateHostJson(asAny, { autoFix: false });
                result.errors.push({
                    path: "schema_version",
                    message: `Unsupported schema_version "${currentSchema}".`,
                    expected: "0.9.0 or 1.0.0",
                    actual: currentSchema
                });
                return {
                    ...result,
                    valid: false,
                    json: undefined,
                    healed: null
                };
            }
        }
    }

    function migrate_090_to_100(input) {
        const toolId = detectLegacyToolId(input);
        const now = Date.now();
        return {
            host_version: HOST_VERSION,
            schema_version: SCHEMA_VERSION,
            tool_id: toolId,
            tool_version: typeof input.tool_version === "string" ? input.tool_version : "1.0.0",
            timestamp_created: typeof input.timestamp_created === "number" ? input.timestamp_created : now,
            timestamp_modified: typeof input.timestamp_modified === "number" ? input.timestamp_modified : now,
            metadata: isPlainObject(input.metadata) ? input.metadata : {},
            data: isPlainObject(input.data) ? input.data : (input.data ?? {})
        };
    }

    function isLegacyBareData(value) {
        if (!isPlainObject(value)) return false;
        const obj = value;
        const hasEnvelopeKeys =
            "host_version" in obj ||
            "schema_version" in obj ||
            "tool_id" in obj ||
            "tool_version" in obj;
        return !hasEnvelopeKeys;
    }

    function detectLegacyToolId(value) {
        if (!isPlainObject(value)) return "generic";
        const obj = value;
        if ("threats" in obj && "mitigations" in obj) return TOOL_IDS.RISK_MATRIX;
        if ("contacts" in obj && "channels" in obj) return TOOL_IDS.COMMS_PLAN;
        if ("sections" in obj && "tables" in obj) return TOOL_IDS.ASSESSMENT;
        if ("data" in obj && isPlainObject(obj.data)) {
            if ("sections" in obj.data || "tables" in obj.data) return TOOL_IDS.ASSESSMENT;
            if ("threats" in obj.data || "mitigations" in obj.data) return TOOL_IDS.RISK_MATRIX;
        }
        return "generic";
    }

    // ============================================
    // ERROR LOGGING
    // ============================================
    
    function logJsonError(toolId, error, payload) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            tool_id: toolId || 'unknown',
            error_message: error?.message || String(error),
            field: error?.path || error?.field || null,
            payload_snapshot: payload ? JSON.stringify(payload, null, 2) : null
        };

        try {
            const logsKey = 'host_json_error_logs';
            const existingLogs = JSON.parse(localStorage.getItem(logsKey) || '[]');
            existingLogs.push(logEntry);
            if (existingLogs.length > 1000) {
                existingLogs.shift();
            }
            localStorage.setItem(logsKey, JSON.stringify(existingLogs));
            
            // Also log to console
            console.error(`[JSON Error] TOOL=${toolId}`, error, payload);
        } catch (e) {
            console.error('[JSON Error Logger Failed]', e, logEntry);
        }
    }

    // ============================================
    // EXPORT TO GLOBAL
    // ============================================
    
    global.HostJsonCore = {
        // Constants
        HOST_VERSION,
        SCHEMA_VERSION,
        TOOL_IDS,
        
        // Core functions
        createHostJson,
        updateHostJson,
        validateHostJson,
        migrateHostJson,
        
        // Utilities
        deepMerge,
        structuredCloneSafe,
        isPlainObject,
        
        // Defaults
        getDefaultDataForTool,
        getDefaultMetadataForTool,
        wrapLegacyDataAsEnvelope,
        
        // Error logging
        logJsonError
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

