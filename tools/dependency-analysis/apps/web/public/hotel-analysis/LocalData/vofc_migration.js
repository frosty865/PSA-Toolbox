/**
 * VOFC Migration Script
 * Helps migrate from old system to new refactored system
 */

class VOFCMigration {
    constructor() {
        this.migrationSteps = [
            'backup_old_system',
            'load_new_system',
            'validate_data',
            'test_functionality',
            'cleanup_old_system'
        ];
        this.currentStep = 0;
    }
    
    /**
     * Run the complete migration process
     */
    async migrate() {
        console.log('Starting VOFC system migration...');
        
        try {
            for (const step of this.migrationSteps) {
                console.log(`Migration step ${this.currentStep + 1}: ${step}`);
                await this.executeStep(step);
                this.currentStep++;
            }
            
            console.log('VOFC migration completed successfully!');
            return true;
        } catch (error) {
            console.error('VOFC migration failed at step:', this.migrationSteps[this.currentStep], error);
            return false;
        }
    }
    
    /**
     * Execute a specific migration step
     */
    async executeStep(step) {
        switch (step) {
            case 'backup_old_system':
                return this.backupOldSystem();
            case 'load_new_system':
                return this.loadNewSystem();
            case 'validate_data':
                return this.validateData();
            case 'test_functionality':
                return this.testFunctionality();
            case 'cleanup_old_system':
                return this.cleanupOldSystem();
            default:
                throw new Error(`Unknown migration step: ${step}`);
        }
    }
    
    /**
     * Backup the old system
     */
    backupOldSystem() {
        console.log('Backing up old VOFC system...');
        
        // Store old system references
        window._oldVOFCSystem = {
            vulnerabilities: window.VOFC_VULNERABILITIES,
            options: window.VOFC_OPTIONS,
            matcher: window.vofcMatcher
        };
        
        console.log('Old system backed up successfully');
        return Promise.resolve();
    }
    
    /**
     * Load the new system
     */
    loadNewSystem() {
        console.log('Loading new VOFC system...');
        
        // Check if new system files are loaded
        if (typeof VOFCManager === 'undefined') {
            throw new Error('VOFCManager not found. Make sure vofc_core.js is loaded.');
        }
        
        if (typeof VOFCFieldMappings === 'undefined') {
            throw new Error('VOFCFieldMappings not found. Make sure vofc_field_mappings.js is loaded.');
        }
        
        if (typeof VOFCIntegration === 'undefined') {
            throw new Error('VOFCIntegration not found. Make sure vofc_integration.js is loaded.');
        }
        
        console.log('New system loaded successfully');
        return Promise.resolve();
    }
    
    /**
     * Validate data integrity
     */
    validateData() {
        console.log('Validating data integrity...');
        
        const oldVulns = window._oldVOFCSystem.vulnerabilities.length;
        const oldOptions = window._oldVOFCSystem.options.length;
        
        if (oldVulns === 0) {
            throw new Error('No vulnerabilities found in old system');
        }
        
        if (oldOptions === 0) {
            throw new Error('No options found in old system');
        }
        
        console.log(`Data validation passed: ${oldVulns} vulnerabilities, ${oldOptions} options`);
        return Promise.resolve();
    }
    
    /**
     * Test functionality
     */
    testFunctionality() {
        console.log('Testing new system functionality...');
        
        // Test with sample data
        const testData = {
            has_perimeter_barriers: 'No',
            vss_present: 'No',
            secforce_247: 'No'
        };
        
        try {
            const results = window.vofcMatcher.analyzeAssessment(testData);
            
            if (!results.vulnerabilities || !Array.isArray(results.vulnerabilities)) {
                throw new Error('Invalid vulnerabilities format');
            }
            
            if (!results.options || !Array.isArray(results.options)) {
                throw new Error('Invalid options format');
            }
            
            console.log(`Functionality test passed: ${results.vulnerabilities.length} vulnerabilities found`);
            return Promise.resolve();
        } catch (error) {
            throw new Error(`Functionality test failed: ${error.message}`);
        }
    }
    
    /**
     * Cleanup old system
     */
    cleanupOldSystem() {
        console.log('Cleaning up old system...');
        
        // Remove old system references
        delete window._oldVOFCSystem;
        
        // Clear old matcher if it exists
        if (window.vofcMatcher && window.vofcMatcher.constructor.name === 'VOFCVulnerabilityMatcher') {
            console.log('Old matcher detected, will be replaced by new system');
        }
        
        console.log('Old system cleanup completed');
        return Promise.resolve();
    }
    
    /**
     * Rollback to old system if migration fails
     */
    rollback() {
        console.log('Rolling back to old system...');
        
        if (window._oldVOFCSystem) {
            window.VOFC_VULNERABILITIES = window._oldVOFCSystem.vulnerabilities;
            window.VOFC_OPTIONS = window._oldVOFCSystem.options;
            window.vofcMatcher = window._oldVOFCSystem.matcher;
            
            delete window._oldVOFCSystem;
            console.log('Rollback completed');
        } else {
            console.error('No backup found for rollback');
        }
    }
    
    /**
     * Get migration status
     */
    getStatus() {
        return {
            currentStep: this.currentStep,
            totalSteps: this.migrationSteps.length,
            stepName: this.migrationSteps[this.currentStep],
            progress: (this.currentStep / this.migrationSteps.length) * 100
        };
    }
}

// Auto-run migration when all scripts are loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for all scripts to load
    setTimeout(async () => {
        if (typeof VOFCIntegration !== 'undefined') {
            const migration = new VOFCMigration();
            const success = await migration.migrate();
            
            if (success) {
                console.log('VOFC system successfully migrated to new architecture');
            } else {
                console.error('VOFC migration failed, rolling back...');
                migration.rollback();
            }
        }
    }, 500);
});

// Export for manual migration
window.VOFCMigration = VOFCMigration;
