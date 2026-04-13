/**
 * Validate HOST JSON Envelope
 * Strict schema validation with auto-healing capabilities
 */

import { HOST_VERSION, SCHEMA_VERSION, isAcceptedHostVersion, LEGACY_HOST_VERSIONS } from './constants.js';
import { getDefaultMetadata, getDefaultData } from './defaults.js';
import { createHostJson } from './createHostJson.js';

/**
 * Required envelope keys
 */
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

/**
 * Validate HOST JSON envelope
 * @param {*} json - JSON to validate
 * @param {boolean} [autoHeal=true] - Whether to attempt auto-healing
 * @returns {import('./types.js').ValidationResult} Validation result
 */
export function validateHostJson(json, autoHeal = true) {
    const errors = [];
    
    // Check if json is an object
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        errors.push({
            field: 'root',
            expected_type: 'object',
            actual_value: typeof json,
            message: 'JSON must be an object, not array or primitive'
        });
        
        if (autoHeal) {
            return {
                valid: false,
                errors,
                healed: null,
                json: null
            };
        }
        
        return {
            valid: false,
            errors
        };
    }
    
    // Check for required keys
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
    
    // Check for undefined values
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
    
    // Validate host_version (accept current + legacy saved files)
    if (!isAcceptedHostVersion(json.host_version)) {
        errors.push({
            field: 'host_version',
            expected_type: HOST_VERSION,
            actual_value: json.host_version,
            message: `host_version must be '${HOST_VERSION}' (or legacy: ${LEGACY_HOST_VERSIONS.join(', ')})`
        });
    }
    
    // Validate schema_version
    if (json.schema_version && json.schema_version !== SCHEMA_VERSION) {
        // Schema version mismatch - may need migration
        errors.push({
            field: 'schema_version',
            expected_type: SCHEMA_VERSION,
            actual_value: json.schema_version,
            message: `Schema version mismatch: expected '${SCHEMA_VERSION}', got '${json.schema_version}'. Migration may be required.`
        });
    }
    
    // Validate types
    if (json.tool_id !== undefined && typeof json.tool_id !== 'string') {
        errors.push({
            field: 'tool_id',
            expected_type: 'string',
            actual_value: typeof json.tool_id,
            message: 'tool_id must be a string'
        });
    }
    
    if (json.tool_version !== undefined && typeof json.tool_version !== 'string') {
        errors.push({
            field: 'tool_version',
            expected_type: 'string',
            actual_value: typeof json.tool_version,
            message: 'tool_version must be a string'
        });
    }
    
    if (json.timestamp_created !== undefined && typeof json.timestamp_created !== 'number') {
        errors.push({
            field: 'timestamp_created',
            expected_type: 'number',
            actual_value: typeof json.timestamp_created,
            message: 'timestamp_created must be a number (Unix timestamp)'
        });
    }
    
    if (json.timestamp_modified !== undefined && typeof json.timestamp_modified !== 'number') {
        errors.push({
            field: 'timestamp_modified',
            expected_type: 'number',
            actual_value: typeof json.timestamp_modified,
            message: 'timestamp_modified must be a number (Unix timestamp)'
        });
    }
    
    if (json.metadata !== undefined && (typeof json.metadata !== 'object' || Array.isArray(json.metadata) || json.metadata === null)) {
        errors.push({
            field: 'metadata',
            expected_type: 'object',
            actual_value: typeof json.metadata,
            message: 'metadata must be an object'
        });
    }
    
    if (json.data !== undefined && (typeof json.data !== 'object' || Array.isArray(json.data) || json.data === null)) {
        errors.push({
            field: 'data',
            expected_type: 'object',
            actual_value: typeof json.data,
            message: 'data must be an object'
        });
    }
    
    // Attempt auto-healing if enabled and errors found
    let healed = null;
    if (autoHeal && errors.length > 0) {
        healed = attemptAutoHeal(json, errors);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        healed: healed || null,
        json: healed || null
    };
}

/**
 * Attempt to auto-heal JSON by fixing common issues
 * @param {Object} json - JSON to heal
 * @param {Array} errors - Validation errors
 * @returns {import('./types.js').HostJsonEnvelope|null} Healed JSON or null if healing failed
 */
function attemptAutoHeal(json, errors) {
    try {
        let healed = { ...json };
        
        // Fix missing required keys
        if (!healed.host_version) {
            healed.host_version = HOST_VERSION;
        }
        
        if (!healed.schema_version) {
            healed.schema_version = SCHEMA_VERSION;
        }
        
        if (!healed.tool_id) {
            // Try to infer from data structure
            healed.tool_id = inferToolId(healed);
        }
        
        if (!healed.tool_version) {
            healed.tool_version = "1.0.0";
        }
        
        if (!healed.timestamp_created) {
            healed.timestamp_created = Date.now();
        }
        
        if (!healed.timestamp_modified) {
            healed.timestamp_modified = Date.now();
        }
        
        // Fix undefined values
        Object.keys(healed).forEach(key => {
            if (healed[key] === undefined) {
                healed[key] = null;
            }
        });
        
        // Fix metadata
        if (!healed.metadata || typeof healed.metadata !== 'object' || Array.isArray(healed.metadata)) {
            healed.metadata = getDefaultMetadata(healed.tool_id || 'host_assessment');
        }
        
        // Fix data
        if (!healed.data || typeof healed.data !== 'object' || Array.isArray(healed.data)) {
            healed.data = getDefaultData(healed.tool_id || 'host_assessment');
        }
        
        // If old format (sections/tables at root), migrate to envelope
        if (healed.sections && !healed.data.sections) {
            healed.data = {
                ...healed.data,
                sections: healed.sections,
                tables: healed.tables || {}
            };
            delete healed.sections;
            delete healed.tables;
        }
        
        // Validate the healed version
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

/**
 * Infer tool ID from JSON structure
 * @param {Object} json - JSON to analyze
 * @returns {string} Inferred tool ID
 */
function inferToolId(json) {
    // Check for assessment structure
    if (json.sections || json.data?.sections) {
        return 'host_assessment';
    }
    
    // Check for vulnerability structure
    if (json.vulnerabilities || json.data?.vulnerabilities) {
        return 'host_vulnerability';
    }
    
    // Check for report structure
    if (json.executive_summary || json.data?.executive_summary) {
        return 'host_report';
    }
    
    // Default
    return 'host_assessment';
}

