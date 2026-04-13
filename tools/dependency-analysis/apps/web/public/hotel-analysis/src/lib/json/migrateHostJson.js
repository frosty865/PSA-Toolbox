/**
 * Migrate HOST JSON Envelope
 * Handles schema version migrations
 */

import { SCHEMA_VERSION } from './constants.js';
import { validateHostJson } from './validateHostJson.js';

/**
 * Migrate JSON from one schema version to another
 * @param {import('./types.js').HostJsonEnvelope} json - JSON to migrate
 * @returns {import('./types.js').MigrationResult} Migration result
 */
export function migrateHostJson(json) {
    // Validate input before any property access
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
    
    // If already at target version, no migration needed
    if (json.schema_version === SCHEMA_VERSION) {
        return result;
    }

    // Reject unsupported versions instead of silently coercing
    if (json.schema_version && json.schema_version !== '0.9.0') {
        throw new Error(`Unsupported schema_version "${json.schema_version}".`);
    }
    
    // Start with a copy (no mutation)
    let migrated = { ...json };
    
    // Migration: 0.9.0 → 1.0.0
    if (json.schema_version === '0.9.0' || !json.schema_version) {
        migrated = migrateFrom09To10(migrated);
        result.changes.push('Migrated from schema 0.9.0 to 1.0.0');
        result.migrated = true;
    }
    
    // Update schema version
    migrated.schema_version = SCHEMA_VERSION;
    migrated.timestamp_modified = Date.now();
    
    // Validate migrated JSON
    const validation = validateHostJson(migrated, false);
    if (!validation.valid) {
        throw new Error(`Migration failed validation: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    result.json = migrated;
    return result;
}

/**
 * Migrate from schema 0.9.0 to 1.0.0
 * Handles old format without envelope structure
 * @param {Object} json - JSON to migrate
 * @returns {import('./types.js').HostJsonEnvelope} Migrated JSON
 */
function migrateFrom09To10(json) {
    // If it's already in envelope format, just update version
    if (json.host_version && json.schema_version) {
        return {
            ...json,
            schema_version: '1.0.0'
        };
    }
    
    // Old format: { sections: {}, tables: {} } or similar
    // Convert to envelope format
    const migrated = {
        host_version: "1.0.0",
        schema_version: "1.0.0",
        tool_id: inferToolIdFromOldFormat(json),
        tool_version: "1.0.0",
        timestamp_created: json.timestamp_created || Date.now(),
        timestamp_modified: Date.now(),
        metadata: extractMetadataFromOldFormat(json),
        data: extractDataFromOldFormat(json)
    };
    
    return migrated;
}

/**
 * Migrate from schema 1.0.0 to 1.1.0
 * Future migration placeholder
 * @param {Object} json - JSON to migrate
 * @returns {import('./types.js').HostJsonEnvelope} Migrated JSON
 */
function migrateFrom10To11(json) {
    // Future migration logic here
    // For now, just update version
    return {
        ...json,
        schema_version: '1.1.0'
    };
}

/**
 * Infer tool ID from old format JSON
 * @param {Object} json - Old format JSON
 * @returns {string} Tool ID
 */
function inferToolIdFromOldFormat(json) {
    if (json.sections) {
        return 'host_assessment';
    }
    if (json.vulnerabilities) {
        return 'host_vulnerability';
    }
    if (json.executive_summary) {
        return 'host_report';
    }
    return 'host_assessment';
}

/**
 * Extract metadata from old format JSON
 * @param {Object} json - Old format JSON
 * @returns {Object} Metadata object
 */
function extractMetadataFromOldFormat(json) {
    const metadata = {};
    
    // Try to extract facility name
    if (json.sections?.facility_info?.hotel_name) {
        metadata.facility_name = json.sections.facility_info.hotel_name;
    }
    
    // Try to extract assessor info
    if (json.sections?.assessment_info) {
        metadata.assessor_name = json.sections.assessment_info.assessor_name || null;
        metadata.assessment_date = json.sections.assessment_info.assessment_date || null;
        metadata.assessment_type = json.sections.assessment_info.assessment_type || null;
    }
    
    // Preserve any existing metadata
    if (json.metadata) {
        Object.assign(metadata, json.metadata);
    }
    
    return metadata;
}

/**
 * Extract data from old format JSON
 * @param {Object} json - Old format JSON
 * @returns {Object} Data object
 */
function extractDataFromOldFormat(json) {
    // If already has data field, use it
    if (json.data) {
        return json.data;
    }
    
    // Otherwise, extract sections and tables
    const data = {};
    
    if (json.sections) {
        data.sections = json.sections;
    }
    
    if (json.tables) {
        data.tables = json.tables;
    }
    
    // Copy any other top-level fields that aren't envelope fields
    const envelopeKeys = ['host_version', 'schema_version', 'tool_id', 'tool_version', 'timestamp_created', 'timestamp_modified', 'metadata', 'data'];
    Object.keys(json).forEach(key => {
        if (!envelopeKeys.includes(key) && key !== 'sections' && key !== 'tables') {
            data[key] = json[key];
        }
    });
    
    return data;
}

