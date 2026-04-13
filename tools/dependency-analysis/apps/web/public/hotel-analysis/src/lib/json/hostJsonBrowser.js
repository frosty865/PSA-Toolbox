/**
 * HOST JSON Module - Browser-Compatible Bundle
 * This file bundles all JSON functionality for browser use
 * Can be loaded as a script tag: <script src="src/lib/json/hostJsonBrowser.js"></script>
 */

// Import all modules (in browser, these would be loaded via import maps or bundler)
// For now, we'll create a self-contained version

(function(global) {
    'use strict';
    
    // Constants
    const HOST_VERSION = "3.0.0";
    const LEGACY_HOST_VERSIONS = ["1.0.0"];
    function isAcceptedHostVersion(v) {
        return v === HOST_VERSION || LEGACY_HOST_VERSIONS.includes(v);
    }
    const SCHEMA_VERSION = "1.0.0";
    const TOOL_IDS = {
        ASSESSMENT: "host_assessment",
        VULNERABILITY: "host_vulnerability",
        REPORT: "host_report",
        EXPORT: "host_export",
        IMPORT: "host_import",
        BACKUP: "host_backup"
    };
    
    // Defaults (simplified for browser)
    function getDefaultAssessmentMetadata() {
        return {
            facility_name: null,
            assessor_name: null,
            assessment_date: null,
            assessment_type: null,
            json_filename: null
        };
    }
    
    function getDefaultAssessmentData() {
        return {
            sections: {},
            tables: {}
        };
    }
    
    function getDefaultMetadata(toolId) {
        if (toolId === TOOL_IDS.ASSESSMENT) {
            return getDefaultAssessmentMetadata();
        }
        return {};
    }
    
    function getDefaultData(toolId) {
        if (toolId === TOOL_IDS.ASSESSMENT) {
            return getDefaultAssessmentData();
        }
        return {};
    }
    
    // Sanitize undefined values
    function sanitizeUndefined(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeUndefined(item));
        }
        
        if (typeof obj === 'object') {
            const sanitized = {};
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                sanitized[key] = value === undefined ? null : sanitizeUndefined(value);
            });
            return sanitized;
        }
        
        return obj;
    }
    
    // Create HOST JSON envelope
    function createHostJson({ toolId, toolVersion, data = null, metadata = null }) {
        const now = Date.now();
        const defaultMetadata = getDefaultMetadata(toolId);
        const defaultData = getDefaultData(toolId);
        
        const finalMetadata = { ...defaultMetadata };
        if (metadata) {
            Object.keys(defaultMetadata).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                    finalMetadata[key] = metadata[key] !== undefined ? metadata[key] : defaultMetadata[key];
                }
            });
        }
        
        const finalData = data !== null ? { ...defaultData, ...data } : defaultData;
        
        Object.keys(finalData).forEach(key => {
            if (Array.isArray(defaultData[key]) && !Array.isArray(finalData[key])) {
                finalData[key] = [];
            }
        });
        
        const envelope = {
            host_version: HOST_VERSION,
            schema_version: SCHEMA_VERSION,
            tool_id: toolId,
            tool_version: toolVersion,
            timestamp_created: now,
            timestamp_modified: now,
            metadata: finalMetadata,
            data: finalData
        };
        
        return sanitizeUndefined(envelope);
    }
    
    // Update HOST JSON (pure function, no mutation)
    function updateHostJson(json, updates = {}) {
        if (!json || typeof json !== 'object') {
            throw new Error('Invalid JSON envelope provided');
        }
        
        const updated = {
            ...json,
            timestamp_modified: Date.now()
        };
        
        if (updates.data) {
            updated.data = {
                ...json.data,
                ...updates.data
            };
        }
        
        if (updates.metadata) {
            updated.metadata = {
                ...json.metadata,
                ...updates.metadata
            };
        }
        
        return sanitizeUndefined(updated);
    }
    
    // Validate HOST JSON
    const REQUIRED_KEYS = [
        'host_version',
        'schema_version',
        'tool_id',
        'tool_version',
        'timestamp_created',
        'timestamp_modified',
        'metadata',
        'data'
    ];
    
    function validateHostJson(json, autoHeal = true) {
        const errors = [];
        
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            errors.push({
                field: 'root',
                expected_type: 'object',
                actual_value: typeof json,
                message: 'JSON must be an object, not array or primitive'
            });
            
            if (autoHeal) {
                return { valid: false, errors, healed: null, json: null };
            }
            return { valid: false, errors };
        }
        
        REQUIRED_KEYS.forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(json, key)) {
                errors.push({
                    field: key,
                    expected_type: 'required',
                    actual_value: 'missing',
                    message: `Required field '${key}' is missing`
                });
            }
        });
        
        Object.keys(json).forEach(key => {
            if (json[key] === undefined) {
                errors.push({
                    field: key,
                    expected_type: 'non-undefined',
                    actual_value: 'undefined',
                    message: `Field '${key}' cannot be undefined (use null instead)`
                });
            }
        });
        
        if (!isAcceptedHostVersion(json.host_version)) {
            errors.push({
                field: 'host_version',
                expected_type: HOST_VERSION,
                actual_value: json.host_version,
                message: `host_version must be '${HOST_VERSION}' (or legacy: ${LEGACY_HOST_VERSIONS.join(', ')})`
            });
        }
        
        let healed = null;
        if (autoHeal && errors.length > 0) {
            healed = attemptAutoHeal(json, errors);
        }
        
        return {
            valid: errors.length === 0,
            errors,
            healed: healed || null,
            json: healed || (errors.length === 0 ? json : null)
        };
    }
    
    function attemptAutoHeal(json, errors) {
        try {
            let healed = { ...json };
            
            if (!healed.host_version) healed.host_version = HOST_VERSION;
            if (!healed.schema_version) healed.schema_version = SCHEMA_VERSION;
            if (!healed.tool_id) healed.tool_id = inferToolId(healed);
            if (!healed.tool_version) healed.tool_version = "1.0.0";
            if (!healed.timestamp_created) healed.timestamp_created = Date.now();
            if (!healed.timestamp_modified) healed.timestamp_modified = Date.now();
            
            Object.keys(healed).forEach(key => {
                if (healed[key] === undefined) {
                    healed[key] = null;
                }
            });
            
            if (!healed.metadata || typeof healed.metadata !== 'object' || Array.isArray(healed.metadata)) {
                healed.metadata = getDefaultMetadata(healed.tool_id || TOOL_IDS.ASSESSMENT);
            }
            
            if (!healed.data || typeof healed.data !== 'object' || Array.isArray(healed.data)) {
                healed.data = getDefaultData(healed.tool_id || TOOL_IDS.ASSESSMENT);
            }
            
            if (healed.sections && !healed.data.sections) {
                healed.data = {
                    ...healed.data,
                    sections: healed.sections,
                    tables: healed.tables || {}
                };
                delete healed.sections;
                delete healed.tables;
            }
            
            const validation = validateHostJson(healed, false);
            if (validation.valid) {
                return healed;
            }
            
            return null;
        } catch (error) {
            console.error('Auto-heal failed:', error);
            return null;
        }
    }
    
    function inferToolId(json) {
        if (json.sections || json.data?.sections) {
            return TOOL_IDS.ASSESSMENT;
        }
        if (json.vulnerabilities || json.data?.vulnerabilities) {
            return TOOL_IDS.VULNERABILITY;
        }
        if (json.executive_summary || json.data?.executive_summary) {
            return TOOL_IDS.REPORT;
        }
        return TOOL_IDS.ASSESSMENT;
    }
    
    // Migrate HOST JSON
    function migrateHostJson(json) {
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('Invalid JSON provided for migration');
        }

        const result = {
            migrated: false,
            from_version: typeof json.schema_version === 'string' ? json.schema_version : 'unknown',
            to_version: SCHEMA_VERSION,
            json: json,
            changes: []
        };
        
        if (json.schema_version === SCHEMA_VERSION) {
            return result;
        }
        
        let migrated = { ...json };
        
        if (json.schema_version === '0.9.0' || !json.schema_version) {
            migrated = migrateFrom09To10(migrated);
            result.changes.push('Migrated from schema 0.9.0 to 1.0.0');
            result.migrated = true;
        }
        
        migrated.schema_version = SCHEMA_VERSION;
        migrated.timestamp_modified = Date.now();
        
        const validation = validateHostJson(migrated, false);
        if (!validation.valid) {
            throw new Error(`Migration failed validation: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        
        result.json = migrated;
        return result;
    }
    
    function migrateFrom09To10(json) {
        if (json.host_version && json.schema_version) {
            return { ...json, schema_version: '1.0.0' };
        }
        
        return {
            host_version: "1.0.0",
            schema_version: "1.0.0",
            tool_id: inferToolId(json),
            tool_version: "1.0.0",
            timestamp_created: json.timestamp_created || Date.now(),
            timestamp_modified: Date.now(),
            metadata: extractMetadataFromOldFormat(json),
            data: extractDataFromOldFormat(json)
        };
    }
    
    function extractMetadataFromOldFormat(json) {
        const metadata = {};
        if (json.sections?.facility_info?.hotel_name) {
            metadata.facility_name = json.sections.facility_info.hotel_name;
        }
        if (json.sections?.assessment_info) {
            metadata.assessor_name = json.sections.assessment_info.assessor_name || null;
            metadata.assessment_date = json.sections.assessment_info.assessment_date || null;
            metadata.assessment_type = json.sections.assessment_info.assessment_type || null;
        }
        if (json.metadata) {
            Object.assign(metadata, json.metadata);
        }
        return metadata;
    }
    
    function extractDataFromOldFormat(json) {
        if (json.data) {
            return json.data;
        }
        const data = {};
        if (json.sections) data.sections = json.sections;
        if (json.tables) data.tables = json.tables;
        const envelopeKeys = ['host_version', 'schema_version', 'tool_id', 'tool_version', 'timestamp_created', 'timestamp_modified', 'metadata', 'data'];
        Object.keys(json).forEach(key => {
            if (!envelopeKeys.includes(key) && key !== 'sections' && key !== 'tables') {
                data[key] = json[key];
            }
        });
        return data;
    }
    
    // Error logging
    function logJsonError({ tool_id, filename = null, message, field = null, json_snapshot = null }) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            tool_id: tool_id || 'unknown',
            filename: filename || null,
            error_message: message,
            offending_field: field || null,
            corrected_json_snapshot: json_snapshot || null
        };
        
        try {
            const logsKey = 'host_json_error_logs';
            const existingLogs = JSON.parse(localStorage.getItem(logsKey) || '[]');
            existingLogs.push(logEntry);
            if (existingLogs.length > 1000) {
                existingLogs.shift();
            }
            localStorage.setItem(logsKey, JSON.stringify(existingLogs));
            console.error('[JSON Error]', logEntry);
        } catch (error) {
            console.error('[JSON Error Logger Failed]', error, logEntry);
        }
    }
    
    // Export to global scope
    global.HostJson = {
        createHostJson,
        updateHostJson,
        validateHostJson,
        migrateHostJson,
        logJsonError,
        HOST_VERSION,
        SCHEMA_VERSION,
        TOOL_IDS
    };
    
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

