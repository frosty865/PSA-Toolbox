/**
 * HOST JSON Type Definitions
 * JSDoc type definitions for all JSON structures in HOST Tool
 */

/**
 * @typedef {Object} HostJsonEnvelope
 * @property {string} host_version - HOST tool version (e.g., "3.0.0"; legacy files may show "1.0.0")
 * @property {string} schema_version - JSON schema version (e.g., "1.0.0")
 * @property {string} tool_id - Identifier for the tool that created this JSON
 * @property {string} tool_version - Version of the tool
 * @property {number} timestamp_created - Unix timestamp when created
 * @property {number} timestamp_modified - Unix timestamp when last modified
 * @property {Object} metadata - Tool-specific metadata
 * @property {Object} data - Tool-specific data payload
 */

/**
 * @typedef {Object} AssessmentMetadata
 * @property {string} facility_name - Name of the facility being assessed
 * @property {string} assessor_name - Name of the assessor
 * @property {string} assessment_date - Date of assessment (ISO format)
 * @property {string} assessment_type - Type of assessment (Initial, Follow-up, etc.)
 * @property {string} [json_filename] - Original filename if imported
 */

/**
 * @typedef {Object} AssessmentData
 * @property {Object.<string, Object>} sections - Form sections data
 * @property {Object.<string, Array>} tables - Table data arrays
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field - Name of the field with error
 * @property {string} expected_type - Expected data type
 * @property {*} actual_value - Actual value that caused error
 * @property {string} message - Human-readable error message
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<ValidationError>} errors - Array of validation errors
 * @property {HostJsonEnvelope} [json] - Normalized JSON if available
 * @property {HostJsonEnvelope} [healed] - Auto-healed JSON if possible
 */

/**
 * @typedef {Object} MigrationResult
 * @property {boolean} migrated - Whether migration was performed
 * @property {string} from_version - Source schema version
 * @property {string} to_version - Target schema version
 * @property {HostJsonEnvelope} json - Migrated JSON envelope
 * @property {Array<string>} changes - List of changes made during migration
 */

