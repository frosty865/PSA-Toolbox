/**
 * HOST JSON Helpers - Complete Integration Layer
 * Provides all JSON operations for HOST V3 HTML
 */

(function(global) {
    'use strict';

    // Ensure core is loaded
    if (typeof HostJsonCore === 'undefined') {
        console.error('HostJsonCore not loaded. Please include hostJsonCore.js first.');
        return;
    }

    const Core = HostJsonCore;
    const Logger = typeof HostJsonErrorLogger !== 'undefined' ? HostJsonErrorLogger : null;

    // ============================================
    // JSON CREATION HELPERS
    // ============================================

    /**
     * Collect form data and create HOST JSON envelope
     * Pure function - does not mutate form
     */
    function collectAllFormDataAsHostJson() {
        // Use existing collectAllFormData function if available
        const rawData = typeof collectAllFormData === 'function' 
            ? collectAllFormData() 
            : { sections: {}, tables: {} };

        // Extract metadata
        const metadata = {
            tool_label: Core.TOOL_IDS.ASSESSMENT,
            created_by: rawData.sections?.assessment_info?.assessor_name || null,
            source: null,
            facility_name: rawData.sections?.facility_info?.hotel_name || null,
            assessment_date: rawData.sections?.assessment_info?.assessment_date || null,
            assessment_type: rawData.sections?.assessment_info?.assessment_type || null
        };

        // Create envelope
        return Core.createHostJson({
            toolId: Core.TOOL_IDS.ASSESSMENT,
            toolVersion: "1.0.0",
            data: {
                sections: rawData.sections || {},
                tables: rawData.tables || {}
            },
            metadata: metadata
        });
    }

    // ============================================
    // JSON EXPORT HELPERS
    // ============================================

    /**
     * Export JSON with full validation and migration
     * @param {Object} [json] - Optional JSON to export (uses form data if not provided)
     * @returns {boolean} Success status
     */
    function exportHostJson(json = null) {
        try {
            // Get JSON
            let hostJson = json;
            if (!hostJson) {
                hostJson = collectAllFormDataAsHostJson();
            }

            // Migrate first
            const migration = Core.migrateHostJson(hostJson);
            if (!migration.valid) {
                const errorMsg = `Migration failed: ${migration.errors.map(e => e.message).join(', ')}`;
                if (Logger) {
                    migration.errors.forEach(err => {
                        Logger.logJsonError(Core.TOOL_IDS.EXPORT, err, hostJson);
                    });
                }
                throw new Error(errorMsg);
            }

            hostJson = migration.json;

            // Validate
            const validation = Core.validateHostJson(hostJson, { autoFix: true });
            if (!validation.valid) {
                if (Logger) {
                    validation.errors.forEach(err => {
                        Logger.logJsonError(Core.TOOL_IDS.EXPORT, err, hostJson);
                    });
                }
                
                const normalizedJson = validation.json || validation.healed;
                if (!normalizedJson) {
                    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
                }
                
                hostJson = normalizedJson;
                console.warn('JSON was auto-healed before export');
            }

            // Generate filename: ${tool_id}_${schema_version}_${timestamp}.json
            const timestamp = new Date(hostJson.timestamp_created || Date.now());
            const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = timestamp.toTimeString().slice(0, 8).replace(/:/g, '');
            const filename = `${hostJson.tool_id}_${hostJson.schema_version}_${dateStr}_${timeStr}.json`;

            // Pretty-print JSON
            const jsonString = JSON.stringify(hostJson, null, 2);

            // Download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            if (Logger) {
                Logger.logJsonError(Core.TOOL_IDS.EXPORT, error, json);
            }
            console.error('Error exporting JSON:', error);
            alert(`Error exporting data: ${error.message}`);
            return false;
        }
    }

    // ============================================
    // JSON IMPORT HELPERS
    // ============================================

    /**
     * Import JSON file with migration and validation
     * @param {File} file - File to import
     * @returns {Promise<Object>} Imported and validated JSON
     */
    function importHostJsonFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = function(e) {
                try {
                    // Parse JSON
                    const rawJson = JSON.parse(e.target.result);

                    // Migrate
                    const migration = Core.migrateHostJson(rawJson);
                    if (!migration.valid) {
                        const errorMsg = `Migration failed: ${migration.errors.map(e => e.message).join(', ')}`;
                        if (Logger) {
                            migration.errors.forEach(err => {
                                Logger.logJsonError(Core.TOOL_IDS.IMPORT, err, rawJson);
                            });
                        }
                        reject(new Error(errorMsg));
                        return;
                    }

                    let hostJson = migration.json;

                    // Validate
                    const validation = Core.validateHostJson(hostJson, { autoFix: true });
                    if (!validation.valid) {
                        if (Logger) {
                            validation.errors.forEach(err => {
                                Logger.logJsonError(Core.TOOL_IDS.IMPORT, err, hostJson);
                            });
                        }

                        const normalizedJson = validation.json || validation.healed;
                        if (!normalizedJson) {
                            reject(new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`));
                            return;
                        }

                        hostJson = normalizedJson;
                        console.warn('JSON was auto-healed during import');
                    }

                    resolve(hostJson);
                } catch (error) {
                    if (Logger) {
                        Logger.logJsonError(Core.TOOL_IDS.IMPORT, error, null);
                    }
                    reject(error);
                }
            };

            reader.onerror = function() {
                const error = new Error('Error reading file');
                if (Logger) {
                    Logger.logJsonError(Core.TOOL_IDS.IMPORT, error, null);
                }
                reject(error);
            };

            reader.readAsText(file);
        });
    }

    /**
     * Load HOST JSON into form (non-mutating)
     * @param {Object} hostJson - HOST JSON envelope
     */
    function loadHostJsonIntoForm(hostJson) {
        if (!hostJson || !hostJson.data) {
            throw new Error('Invalid HOST JSON: missing data field');
        }

        const data = hostJson.data;

        // Load sections
        if (data.sections && typeof loadCleanJSONData === 'function') {
            // Use existing load function but wrap data in old format for compatibility
            const oldFormat = {
                sections: data.sections,
                tables: data.tables || {}
            };
            loadCleanJSONData(oldFormat);
        } else if (data.sections) {
            // Manual loading if function doesn't exist
            Object.keys(data.sections).forEach(sectionName => {
                const section = data.sections[sectionName];
                Object.keys(section).forEach(fieldName => {
                    const value = section[fieldName];
                    const field = document.getElementById(fieldName);
                    if (field) {
                        if (field.type === 'checkbox') {
                            field.checked = value === 'Yes' || value === true;
                        } else if (field.tagName === 'SELECT') {
                            field.value = value || '';
                        } else {
                            field.value = value || '';
                        }
                    }
                });
            });
        }

        // Load tables
        if (data.tables && typeof loadTableData === 'function') {
            Object.keys(data.tables).forEach(tableName => {
                loadTableData(tableName, data.tables[tableName]);
            });
        }
    }

    // ============================================
    // JSON UPDATE HELPERS (ZERO MUTATION)
    // ============================================

    /**
     * Update JSON with form changes (pure function)
     * @param {Object} existingJson - Existing JSON envelope
     * @param {Object} formData - New form data
     * @returns {Object} Updated JSON envelope
     */
    function updateHostJsonWithFormData(existingJson, formData) {
        const currentData = (formData && typeof formData === 'object')
            ? formData
            : (typeof collectAllFormData === 'function' ? collectAllFormData() : {});

        return Core.updateHostJson(existingJson, {
            data: {
                sections: currentData.sections || {},
                tables: currentData.tables || {}
            },
            metadata: {
                facility_name: currentData.sections?.facility_info?.hotel_name || existingJson.metadata?.facility_name || null,
                assessment_date: currentData.sections?.assessment_info?.assessment_date || existingJson.metadata?.assessment_date || null
            }
        });
    }

    // ============================================
    // BACKUP HELPERS
    // ============================================

    /**
     * Create backup with HOST JSON format
     * @returns {boolean} Success status
     */
    function createHostJsonBackup() {
        try {
            let hostJson = collectAllFormDataAsHostJson();

            // Validate before backup
            const validation = Core.validateHostJson(hostJson, { autoFix: true });
            const normalizedJson = validation.json || validation.healed;
            if (!validation.valid && normalizedJson) {
                hostJson = normalizedJson;
            }

            const now = new Date();
            const facilityName = hostJson.metadata?.facility_name || 'Unknown_Facility';
            const cleanName = facilityName.replace(/[^a-zA-Z0-9]/g, '_');
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const dtg = `${day}${month}${year}-${hours}${minutes}`;
            const backupKey = `host_backup_${cleanName}_${dtg}`;

            // Store as HOST JSON
            localStorage.setItem(backupKey, JSON.stringify(hostJson));

            // Keep only last 5 backups
            const backupKeys = Object.keys(localStorage)
                .filter(key => key.startsWith('host_backup_'))
                .sort()
                .reverse();

            if (backupKeys.length > 5) {
                backupKeys.slice(5).forEach(key => {
                    localStorage.removeItem(key);
                });
            }

            return true;
        } catch (error) {
            if (Logger) {
                Logger.logJsonError(Core.TOOL_IDS.BACKUP, error, null);
            }
            console.error('Error creating backup:', error);
            return false;
        }
    }

    // ============================================
    // EXPORT TO GLOBAL
    // ============================================

    global.HostJsonHelpers = {
        // Creation
        collectAllFormDataAsHostJson,
        createHostJson: Core.createHostJson,
        
        // Export/Import
        exportHostJson,
        importHostJsonFile,
        loadHostJsonIntoForm,
        
        // Updates (zero mutation)
        updateHostJson: Core.updateHostJson,
        updateHostJsonWithFormData,
        
        // Backup
        createHostJsonBackup,
        
        // Validation/Migration
        validateHostJson: Core.validateHostJson,
        migrateHostJson: Core.migrateHostJson,
        
        // Utilities
        deepMerge: Core.deepMerge,
        
        // Constants
        HOST_VERSION: Core.HOST_VERSION,
        SCHEMA_VERSION: Core.SCHEMA_VERSION,
        TOOL_IDS: Core.TOOL_IDS
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

