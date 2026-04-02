/**
 * HOST JSON Default Values
 * Default shapes for every tool to ensure consistency
 */

import { HOST_VERSION, SCHEMA_VERSION, TOOL_IDS } from './constants.js';

/**
 * Get default metadata for assessment tool
 * @returns {Object} Default assessment metadata
 */
export function getDefaultAssessmentMetadata() {
    return {
        facility_name: null,
        assessor_name: null,
        assessment_date: null,
        assessment_type: null,
        json_filename: null
    };
}

/**
 * Get default data structure for assessment tool
 * @returns {Object} Default assessment data structure
 */
export function getDefaultAssessmentData() {
    return {
        sections: {},
        tables: {}
    };
}

/**
 * Get default metadata for vulnerability tool
 * @returns {Object} Default vulnerability metadata
 */
export function getDefaultVulnerabilityMetadata() {
    return {
        analysis_date: null,
        vulnerability_count: 0,
        severity_breakdown: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        }
    };
}

/**
 * Get default data structure for vulnerability tool
 * @returns {Object} Default vulnerability data structure
 */
export function getDefaultVulnerabilityData() {
    return {
        vulnerabilities: [],
        options: [],
        categories: {}
    };
}

/**
 * Get default metadata for report tool
 * @returns {Object} Default report metadata
 */
export function getDefaultReportMetadata() {
    return {
        report_type: null,
        generated_date: null,
        facility_name: null,
        report_version: null
    };
}

/**
 * Get default data structure for report tool
 * @returns {Object} Default report data structure
 */
export function getDefaultReportData() {
    return {
        executive_summary: null,
        sections: [],
        recommendations: [],
        appendices: []
    };
}

/**
 * Get default metadata for export tool
 * @returns {Object} Default export metadata
 */
export function getDefaultExportMetadata() {
    return {
        export_date: null,
        source_tool: null,
        file_format: "json",
        export_version: null
    };
}

/**
 * Get default data structure for export tool
 * @returns {Object} Default export data structure
 */
export function getDefaultExportData() {
    return {
        exported_data: null
    };
}

/**
 * Get default metadata for import tool
 * @returns {Object} Default import metadata
 */
export function getDefaultImportMetadata() {
    return {
        import_date: null,
        source_file: null,
        import_version: null,
        validation_passed: false
    };
}

/**
 * Get default data structure for import tool
 * @returns {Object} Default import data structure
 */
export function getDefaultImportData() {
    return {
        imported_data: null
    };
}

/**
 * Get default metadata for backup tool
 * @returns {Object} Default backup metadata
 */
export function getDefaultBackupMetadata() {
    return {
        backup_date: null,
        facility_name: null,
        backup_type: "automatic",
        backup_version: null
    };
}

/**
 * Get default data structure for backup tool
 * @returns {Object} Default backup data structure
 */
export function getDefaultBackupData() {
    return {
        backup_data: null
    };
}

/**
 * Get default metadata based on tool ID
 * @param {string} toolId - Tool identifier
 * @returns {Object} Default metadata for the tool
 */
export function getDefaultMetadata(toolId) {
    switch (toolId) {
        case TOOL_IDS.ASSESSMENT:
            return getDefaultAssessmentMetadata();
        case TOOL_IDS.VULNERABILITY:
            return getDefaultVulnerabilityMetadata();
        case TOOL_IDS.REPORT:
            return getDefaultReportMetadata();
        case TOOL_IDS.EXPORT:
            return getDefaultExportMetadata();
        case TOOL_IDS.IMPORT:
            return getDefaultImportMetadata();
        case TOOL_IDS.BACKUP:
            return getDefaultBackupMetadata();
        default:
            return {};
    }
}

/**
 * Get default data structure based on tool ID
 * @param {string} toolId - Tool identifier
 * @returns {Object} Default data structure for the tool
 */
export function getDefaultData(toolId) {
    switch (toolId) {
        case TOOL_IDS.ASSESSMENT:
            return getDefaultAssessmentData();
        case TOOL_IDS.VULNERABILITY:
            return getDefaultVulnerabilityData();
        case TOOL_IDS.REPORT:
            return getDefaultReportData();
        case TOOL_IDS.EXPORT:
            return getDefaultExportData();
        case TOOL_IDS.IMPORT:
            return getDefaultImportData();
        case TOOL_IDS.BACKUP:
            return getDefaultBackupData();
        default:
            return {};
    }
}

