/**
 * VOFC Integration Layer
 * Simple integration to replace the current monolithic system
 */

class VOFCIntegration {
    constructor() {
        this.manager = null;
        this.fieldMappings = null;
        this.isInitialized = false;
    }
    
    /**
     * Initialize the refactored VOFC system
     */
    initialize() {
        try {
            // Initialize field mappings
            this.fieldMappings = new VOFCFieldMappings();
            
            // Initialize VOFC manager
            this.manager = new VOFCManager();
            
            // Load data from global variables (backward compatibility)
            if (window.VOFC_VULNERABILITIES && window.VOFC_OPTIONS) {
                this.manager.initialize(window.VOFC_VULNERABILITIES, window.VOFC_OPTIONS);
                
                // Apply field mappings
                this.applyFieldMappings();
                
                this.isInitialized = true;
                console.log('VOFC Integration initialized successfully');
            } else {
                console.error('VOFC data not available. Make sure vofc_vulnerabilities.js and vofc_options.js are loaded.');
            }
        } catch (error) {
            console.error('Failed to initialize VOFC Integration:', error);
        }
    }
    
    /**
     * Apply field mappings to the manager
     */
    applyFieldMappings() {
        if (!this.manager || !this.fieldMappings) return;
        
        const allMappings = this.fieldMappings.getAllMappings();
        for (const [vulnerabilityId, mappings] of allMappings) {
            for (const mapping of mappings) {
                this.manager.addFieldMapping(vulnerabilityId, mapping.fieldPath, mapping.condition);
            }
        }
    }
    
    /**
     * Analyze form data (replaces the old analyzeAssessment method)
     */
    analyzeAssessment(formData) {
        if (!this.isInitialized) {
            console.error('VOFC Integration not initialized');
            return {
                vulnerabilities: [],
                options: [],
                overallScore: 0,
                categories: {}
            };
        }
        
        // Handle invalid input gracefully
        if (formData === null || formData === undefined) {
            console.warn('VOFC analysis: null/undefined data provided');
            return {
                vulnerabilities: [],
                options: [],
                overallScore: 0,
                categories: {}
            };
        }
        
        if (typeof formData === 'string' || typeof formData === 'number' || typeof formData === 'boolean') {
            console.warn('VOFC analysis: invalid data type provided');
            return {
                vulnerabilities: [],
                options: [],
                overallScore: 0,
                categories: {}
            };
        }
        
        // Handle circular references
        try {
            JSON.stringify(formData);
        } catch (error) {
            if (error.message.includes('circular')) {
                console.warn('VOFC analysis: circular reference detected');
                return {
                    vulnerabilities: [],
                    options: [],
                    overallScore: 0,
                    categories: {}
                };
            }
        }
        
        try {
            const results = this.manager.analyze(formData);
            
            // Transform results to match expected format
            return {
                vulnerabilities: results.vulnerabilities || [],
                options: results.options || [],
                overallScore: this.calculateOverallScore(results),
                categories: this.calculateCategoryScores(results),
                metadata: results.metadata
            };
        } catch (error) {
            console.error('VOFC analysis failed:', error);
            return {
                vulnerabilities: [],
                options: [],
                overallScore: 0,
                categories: {},
                error: error.message
            };
        }
    }
    
    /**
     * Get vulnerability by ID (backward compatibility)
     */
    getVulnerabilityById(vulnerabilityId) {
        if (!this.isInitialized) return null;
        return this.manager.getVulnerabilityById(vulnerabilityId);
    }
    
    /**
     * Get options for vulnerability (backward compatibility)
     */
    getOptionsForVulnerability(vulnerabilityId) {
        if (!this.isInitialized) return [];
        return this.manager.getOptionsForVulnerability(vulnerabilityId);
    }
    
    /**
     * Calculate overall security score
     */
    calculateOverallScore(results) {
        const totalVulnerabilities = results.vulnerabilities.length;
        const criticalCount = results.vulnerabilities.filter(v => v.severity === 'Critical').length;
        const highCount = results.vulnerabilities.filter(v => v.severity === 'High').length;
        const mediumCount = results.vulnerabilities.filter(v => v.severity === 'Medium').length;
        
        // Scoring algorithm: 100 - (critical*10 + high*5 + medium*2)
        const score = Math.max(0, 100 - (criticalCount * 10 + highCount * 5 + mediumCount * 2));
        return Math.round(score);
    }
    
    /**
     * Calculate category scores
     */
    calculateCategoryScores(results) {
        const categories = {};
        
        for (const vulnerability of results.vulnerabilities) {
            const category = vulnerability.category || 'Other';
            if (!categories[category]) {
                categories[category] = {
                    count: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                };
            }
            
            categories[category].count++;
            categories[category][vulnerability.severity.toLowerCase()]++;
        }
        
        return categories;
    }
    
    /**
     * Get system statistics
     */
    getStats() {
        if (!this.isInitialized) return null;
        return this.manager.getStats();
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        if (this.manager) {
            this.manager.clearCache();
        }
    }
    
    /**
     * Add custom field mapping
     */
    addFieldMapping(vulnerabilityId, fieldPath, condition) {
        if (this.manager) {
            this.manager.addFieldMapping(vulnerabilityId, fieldPath, condition);
        }
    }
    
    /**
     * Add custom analysis rule
     */
    addAnalysisRule(vulnerabilityId, ruleFunction) {
        if (this.manager) {
            this.manager.addAnalysisRule(vulnerabilityId, ruleFunction);
        }
    }
}

// Global instance for backward compatibility
window.vofcMatcher = new VOFCIntegration();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other scripts to load
    setTimeout(() => {
        if (window.vofcMatcher) {
            window.vofcMatcher.initialize();
        }
    }, 100);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VOFCIntegration;
}
