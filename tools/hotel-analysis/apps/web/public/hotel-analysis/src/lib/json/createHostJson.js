/**
 * Create HOST JSON Envelope
 * Creates a fully stable JSON envelope with all required fields
 */

import { HOST_VERSION, SCHEMA_VERSION } from './constants.js';
import { getDefaultMetadata, getDefaultData } from './defaults.js';

/**
 * Create a HOST JSON envelope
 * @param {Object} params - Parameters for creating JSON
 * @param {string} params.toolId - Tool identifier
 * @param {string} params.toolVersion - Version of the tool
 * @param {Object} [params.data] - Tool-specific data payload
 * @param {Object} [params.metadata] - Tool-specific metadata
 * @returns {import('./types.js').HostJsonEnvelope} Complete JSON envelope
 */
export function createHostJson({ toolId, toolVersion, data = null, metadata = null }) {
    const now = Date.now();
    
    // Get defaults for this tool
    const defaultMetadata = getDefaultMetadata(toolId);
    const defaultData = getDefaultData(toolId);
    
    // Merge provided data/metadata with defaults
    // Ensure all default keys exist, use provided values if available
    const finalMetadata = { ...defaultMetadata };
    if (metadata) {
        Object.keys(defaultMetadata).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                finalMetadata[key] = metadata[key] !== undefined ? metadata[key] : defaultMetadata[key];
            }
        });
    }
    
    const finalData = data !== null ? { ...defaultData, ...data } : defaultData;
    
    // Ensure arrays exist (empty if not provided)
    Object.keys(finalData).forEach(key => {
        if (Array.isArray(defaultData[key]) && !Array.isArray(finalData[key])) {
            finalData[key] = [];
        }
    });
    
    // Create envelope with all required fields
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
    
    // Ensure no undefined values - convert to null
    return sanitizeUndefined(envelope);
}

/**
 * Sanitize object by converting undefined to null
 * @param {*} obj - Object to sanitize
 * @returns {*} Sanitized object
 */
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

/**
 * Update existing JSON envelope with new data
 * Pure function - does not mutate input
 * @param {import('./types.js').HostJsonEnvelope} json - Existing JSON envelope
 * @param {Object} updates - Updates to apply
 * @param {Object} [updates.data] - Data updates (merged)
 * @param {Object} [updates.metadata] - Metadata updates (merged)
 * @returns {import('./types.js').HostJsonEnvelope} Updated JSON envelope
 */
export function updateHostJson(json, updates = {}) {
    // Validate input
    if (!json || typeof json !== 'object') {
        throw new Error('Invalid JSON envelope provided');
    }
    
    // Create new object (no mutation)
    const updated = {
        ...json,
        timestamp_modified: Date.now()
    };
    
    // Merge data if provided
    if (updates.data) {
        updated.data = {
            ...json.data,
            ...updates.data
        };
    }
    
    // Merge metadata if provided
    if (updates.metadata) {
        updated.metadata = {
            ...json.metadata,
            ...updates.metadata
        };
    }
    
    return sanitizeUndefined(updated);
}

