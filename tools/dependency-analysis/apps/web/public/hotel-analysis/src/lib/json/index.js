/**
 * HOST JSON Module - Centralized JSON Management
 * Main entry point for all JSON operations
 */

export { createHostJson, updateHostJson } from './createHostJson.js';
export { validateHostJson } from './validateHostJson.js';
export { migrateHostJson } from './migrateHostJson.js';
export { HOST_VERSION, SCHEMA_VERSION, TOOL_IDS, LEGACY_HOST_VERSIONS, isAcceptedHostVersion } from './constants.js';
export { getDefaultMetadata, getDefaultData } from './defaults.js';

// Re-export types for JSDoc
export * from './types.js';

