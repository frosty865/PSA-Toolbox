/**
 * HOST JSON Helper Functions
 * Browser-compatible helper functions for JSON operations in HOST V3
 * These functions wrap the core JSON module for easy use in HTML
 */

// Ensure HostJson is loaded
if (typeof HostJson === 'undefined') {
    console.error('HostJson module not loaded. Please include hostJsonBrowser.js first.');
}

/**
 * Collect all form data and wrap in HOST JSON envelope
 * @returns {Object} HOST JSON envelope with form data
 */
function collectAllFormDataAsHostJson() {
    // Collect raw form data (existing function)
    const rawData = collectAllFormData();
    
    // Extract metadata from form data
    const metadata = {
        facility_name: rawData.sections?.facility_info?.hotel_name || null,
        assessor_name: rawData.sections?.assessment_info?.assessor_name || null,
        assessment_date: rawData.sections?.assessment_info?.assessment_date || null,
        assessment_type: rawData.sections?.assessment_info?.assessment_type || null,
        json_filename: null
    };
    
    // Create HOST JSON envelope
    return HostJson.createHostJson({
        toolId: HostJson.TOOL_IDS.ASSESSMENT,
        toolVersion: "1.0.0",
        data: {
            sections: rawData.sections || {},
            tables: rawData.tables || {}
        },
        metadata: metadata
    });
}

/**
 * Export data as HOST JSON with validation
 * @param {Object} [data] - Optional data to export (uses form data if not provided)
 * @returns {boolean} Success status
 */
function exportDataAsHostJson(data = null) {
    try {
        // Get data
        let hostJson = data;
        if (!hostJson) {
            hostJson = collectAllFormDataAsHostJson();
        }
        
        // Validate before export
        const validation = HostJson.validateHostJson(hostJson, true);
        
        if (!validation.valid) {
            // Log errors
            validation.errors.forEach(error => {
                HostJson.logJsonError({
                    tool_id: HostJson.TOOL_IDS.EXPORT,
                    message: error.message,
                    field: error.field,
                    json_snapshot: hostJson
                });
            });
            
            // Accept either validator alias
            const normalizedJson = validation.json || validation.healed;
            if (normalizedJson) {
                hostJson = normalizedJson;
                console.warn('JSON was auto-healed before export');
            } else {
                throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
            }
        }
        
        // Generate filename
        const facilityName = hostJson.metadata?.facility_name || 'Assessment';
        const cleanName = facilityName.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date(hostJson.timestamp_created || Date.now());
        const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = timestamp.toTimeString().slice(0, 5).replace(':', '');
        const filename = `${cleanName}_${hostJson.tool_id}_v${hostJson.tool_version}_${dateStr}_${timeStr}.json`;
        
        // Pretty-print JSON
        const jsonString = JSON.stringify(hostJson, null, 2);
        
        // Create and download
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
        HostJson.logJsonError({
            tool_id: HostJson.TOOL_IDS.EXPORT,
            message: error.message,
            json_snapshot: data
        });
        console.error('Error exporting data:', error);
        alert(`Error exporting data: ${error.message}`);
        return false;
    }
}

/**
 * Import HOST JSON file with validation and migration
 * @param {File} file - File to import
 * @returns {Promise<Object>} Imported and validated HOST JSON
 */
function importHostJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // Parse JSON
                let rawJson = JSON.parse(e.target.result);
                
                // Validate
                let validation = HostJson.validateHostJson(rawJson, true);
                
                // If validation fails, try to heal
                if (!validation.valid) {
                    const normalizedJson = validation.json || validation.healed;
                    if (normalizedJson) {
                        console.warn('JSON was auto-healed during import');
                        rawJson = normalizedJson;
                        validation = HostJson.validateHostJson(rawJson, false);
                    } else {
                        // Log errors
                        validation.errors.forEach(error => {
                            HostJson.logJsonError({
                                tool_id: HostJson.TOOL_IDS.IMPORT,
                                filename: file.name,
                                message: error.message,
                                field: error.field,
                                json_snapshot: rawJson
                            });
                        });
                        
                        throw new Error(`Invalid HOST JSON file: ${validation.errors.map(e => e.message).join(', ')}`);
                    }
                }
                
                // Check for required version fields
                if (!rawJson.host_version || !rawJson.schema_version) {
                    throw new Error('File is not a valid HOST JSON file (missing host_version or schema_version)');
                }
                
                // Migrate if needed
                if (rawJson.schema_version !== HostJson.SCHEMA_VERSION) {
                    try {
                        const migration = HostJson.migrateHostJson(rawJson);
                        if (migration.migrated) {
                            console.log('JSON migrated:', migration.changes);
                            rawJson = migration.json;
                        }
                    } catch (migrationError) {
                        console.error('Migration failed:', migrationError);
                        throw new Error(`Migration failed: ${migrationError.message}`);
                    }
                }
                
                // Update metadata with filename
                if (rawJson.metadata) {
                    rawJson.metadata.json_filename = file.name;
                }
                
                resolve(rawJson);
            } catch (error) {
                HostJson.logJsonError({
                    tool_id: HostJson.TOOL_IDS.IMPORT,
                    filename: file.name,
                    message: error.message
                });
                reject(error);
            }
        };
        
        reader.onerror = function() {
            const error = new Error('Error reading file');
            HostJson.logJsonError({
                tool_id: HostJson.TOOL_IDS.IMPORT,
                filename: file.name,
                message: error.message
            });
            reject(error);
        };
        
        reader.readAsText(file);
    });
}

/**
 * Load HOST JSON data into form (non-mutating)
 * @param {Object} hostJson - HOST JSON envelope
 */
function loadHostJsonIntoForm(hostJson) {
    // Validate input
    if (!hostJson || !hostJson.data) {
        throw new Error('Invalid HOST JSON: missing data field');
    }
    
    const data = hostJson.data;
    
    // Load sections (non-mutating - creates new objects)
    if (data.sections) {
        Object.keys(data.sections).forEach(sectionName => {
            const section = data.sections[sectionName];
            Object.keys(section).forEach(fieldName => {
                const value = section[fieldName];
                
                if (Array.isArray(value)) {
                    loadTableData(fieldName, value);
                } else {
                    const field = document.getElementById(fieldName);
                    if (field) {
                        if (field.type === 'checkbox') {
                            field.checked = value === 'Yes' || value === true;
                        } else if (field.tagName === 'SELECT') {
                            field.value = value || '';
                            if (value && !Array.from(field.options).some(option => option.value === value)) {
                                const option = document.createElement('option');
                                option.value = value;
                                option.textContent = value;
                                field.appendChild(option);
                            }
                        } else {
                            field.value = value || '';
                        }
                    }
                }
            });
        });
    }
    
    // Load tables
    if (data.tables) {
        Object.keys(data.tables).forEach(tableName => {
            loadTableData(tableName, data.tables[tableName]);
        });
    }
}

/**
 * Update HOST JSON with form changes (pure function, no mutation)
 * @param {Object} existingJson - Existing HOST JSON envelope
 * @param {Object} formUpdates - Updates from form
 * @returns {Object} Updated HOST JSON envelope
 */
function updateHostJsonWithFormData(existingJson, formUpdates) {
    // Collect current form data
    const currentData = collectAllFormData();
    
    // Create update object (non-mutating merge)
    const dataUpdate = {
        sections: {
            ...existingJson.data.sections,
            ...currentData.sections
        },
        tables: {
            ...existingJson.data.tables,
            ...currentData.tables
        }
    };
    
    // Update metadata if facility name changed
    const metadataUpdate = {};
    if (currentData.sections?.facility_info?.hotel_name) {
        metadataUpdate.facility_name = currentData.sections.facility_info.hotel_name;
    }
    
    // Use updateHostJson (pure function, no mutation)
    return HostJson.updateHostJson(existingJson, {
        data: dataUpdate,
        metadata: Object.keys(metadataUpdate).length > 0 ? metadataUpdate : undefined
    });
}

// Export to global scope for use in HTML
if (typeof window !== 'undefined') {
    window.HostJsonHelpers = {
        collectAllFormDataAsHostJson,
        exportDataAsHostJson,
        importHostJsonFile,
        loadHostJsonIntoForm,
        updateHostJsonWithFormData
    };
}

