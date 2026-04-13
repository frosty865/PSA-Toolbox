/**
 * VOFC Core System - Refactored Architecture
 * Modular, testable, and maintainable vulnerability analysis system
 */

class VOFCConfig {
    constructor() {
        this.vulnerabilities = [];
        this.options = [];
        this.fieldMappings = new Map();
        this.analysisRules = new Map();
        this.cache = new Map();
    }
    
    loadVulnerabilities(vulnerabilities) {
        this.vulnerabilities = vulnerabilities || [];
        this.cache.clear(); // Clear cache when data changes
    }
    
    loadOptions(options) {
        this.options = options || [];
        this.cache.clear();
    }
    
    addFieldMapping(vulnerabilityId, fieldPath, condition) {
        if (!this.fieldMappings.has(vulnerabilityId)) {
            this.fieldMappings.set(vulnerabilityId, []);
        }
        this.fieldMappings.get(vulnerabilityId).push({
            fieldPath,
            condition,
            type: 'field'
        });
    }
    
    addAnalysisRule(vulnerabilityId, ruleFunction) {
        this.analysisRules.set(vulnerabilityId, ruleFunction);
    }
}

class VOFCFieldResolver {
    constructor() {
        this.separators = ['.', '_', '-'];
    }
    
    /**
     * Resolve field value from nested object using flexible path resolution
     */
    resolveField(formData, fieldPath) {
        if (!formData || !fieldPath) return null;
        
        // Try direct access first
        if (formData.hasOwnProperty(fieldPath)) {
            return formData[fieldPath];
        }
        
        // Try nested access with different separators
        for (const separator of this.separators) {
            const parts = fieldPath.split(separator);
            let current = formData;
            
            for (const part of parts) {
                if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                    current = current[part];
                } else {
                    current = null;
                    break;
                }
            }
            
            if (current !== null) {
                return current;
            }
        }
        
        return null;
    }
    
    /**
     * Check if field value matches condition
     */
    checkCondition(formData, fieldPath, expectedValue, operator = 'equals') {
        const actualValue = this.resolveField(formData, fieldPath);
        
        switch (operator) {
            case 'equals':
                return actualValue === expectedValue;
            case 'not_equals':
                return actualValue !== expectedValue;
            case 'contains':
                return actualValue && actualValue.toString().toLowerCase().includes(expectedValue.toLowerCase());
            case 'greater_than':
                return parseFloat(actualValue) > parseFloat(expectedValue);
            case 'less_than':
                return parseFloat(actualValue) < parseFloat(expectedValue);
            case 'is_empty':
                return !actualValue || actualValue === '';
            case 'is_not_empty':
                return actualValue && actualValue !== '';
            default:
                return actualValue === expectedValue;
        }
    }
}

class VOFCVulnerabilityEngine {
    constructor(config, fieldResolver) {
        this.config = config;
        this.fieldResolver = fieldResolver;
        this.results = {
            vulnerabilities: [],
            options: [],
            metadata: {
                analysisTime: 0,
                rulesProcessed: 0,
                cacheHits: 0
            }
        };
    }
    
    /**
     * Main analysis entry point
     */
    analyze(formData) {
        const startTime = performance.now();
        this.results = {
            vulnerabilities: [],
            options: [],
            metadata: {
                analysisTime: 0,
                rulesProcessed: 0,
                cacheHits: 0
            }
        };
        
        // Check cache first
        const cacheKey = this.generateCacheKey(formData);
        if (this.config.cache.has(cacheKey)) {
            this.results = this.config.cache.get(cacheKey);
            this.results.metadata.cacheHits++;
            return this.results;
        }
        
        // Process all vulnerabilities
        this.processVulnerabilities(formData);
        
        // Calculate metadata
        this.results.metadata.analysisTime = performance.now() - startTime;
        
        // Cache results
        this.config.cache.set(cacheKey, { ...this.results });
        
        return this.results;
    }
    
    /**
     * Process all configured vulnerabilities
     */
    processVulnerabilities(formData) {
        for (const vulnerability of this.config.vulnerabilities) {
            this.results.metadata.rulesProcessed++;
            
            if (this.shouldTriggerVulnerability(vulnerability, formData)) {
                this.addVulnerability(vulnerability);
                this.addRelatedOptions(vulnerability.v_number);
            }
        }
    }
    
    /**
     * Check if vulnerability should be triggered
     */
    shouldTriggerVulnerability(vulnerability, formData) {
        // Check field mappings first
        const fieldMappings = this.config.fieldMappings.get(vulnerability.v_number) || [];
        for (const mapping of fieldMappings) {
            if (this.fieldResolver.checkCondition(formData, mapping.fieldPath, mapping.condition.value, mapping.condition.operator)) {
                return true;
            }
        }
        
        // Check custom analysis rules
        const customRule = this.config.analysisRules.get(vulnerability.v_number);
        if (customRule && typeof customRule === 'function') {
            return customRule(formData, this.fieldResolver);
        }
        
        return false;
    }
    
    /**
     * Add vulnerability to results
     */
    addVulnerability(vulnerability) {
        this.results.vulnerabilities.push({
            id: vulnerability.v_number,
            title: vulnerability.vulnerability_text,
            description: vulnerability.description,
            impact: vulnerability.risk_impact,
            severity: vulnerability.severity,
            category: vulnerability.category,
            compliance_gap: vulnerability.compliance_gap,
            attack_vectors: vulnerability.attack_vectors || [],
            standards_reference: vulnerability.standards_reference
        });
    }
    
    /**
     * Add related options for vulnerability
     */
    addRelatedOptions(vulnerabilityId) {
        const relatedOptions = this.config.options.filter(option => 
            option.vulnerability_id === vulnerabilityId
        );
        
        for (const option of relatedOptions) {
            this.results.options.push({
                id: option.ofc_number,
                text: option.option_text,
                implementation_timeline: option.implementation_timeline,
                advisory_impact: option.advisory_impact,
                benefit_explanation: option.benefit_explanation
            });
        }
    }
    
    /**
     * Generate cache key for form data
     */
    generateCacheKey(formData) {
        // Simple hash of form data for caching
        const dataString = JSON.stringify(formData);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
}

class VOFCManager {
    constructor() {
        this.config = new VOFCConfig();
        this.fieldResolver = new VOFCFieldResolver();
        this.engine = new VOFCVulnerabilityEngine(this.config, this.fieldResolver);
        this.isInitialized = false;
    }
    
    /**
     * Initialize the VOFC system with data
     */
    initialize(vulnerabilities, options) {
        this.config.loadVulnerabilities(vulnerabilities);
        this.config.loadOptions(options);
        this.setupDefaultFieldMappings();
        this.setupDefaultAnalysisRules();
        this.isInitialized = true;
        
        console.log('VOFC Manager initialized with', 
            this.config.vulnerabilities.length, 'vulnerabilities and', 
            this.config.options.length, 'options');
    }
    
    /**
     * Setup default field mappings for common vulnerabilities
     */
    setupDefaultFieldMappings() {
        // V001 - Perimeter Barriers
        this.config.addFieldMapping('V001', 'has_perimeter_barriers', { value: 'No', operator: 'equals' });
        this.config.addFieldMapping('V001', 'standoff_perimeter_fencing', { value: 'None', operator: 'equals' });
        
        // V008 - Standoff Distance
        this.config.addFieldMapping('V008', 'standoff_minimum_distance', { value: 50, operator: 'less_than' });
        this.config.addFieldMapping('V008', 'standoff_street_distance', { value: 50, operator: 'less_than' });
        
        // V010 - Emergency Communication
        this.config.addFieldMapping('V010', 'secforce_reporting', { value: 'None', operator: 'equals' });
        this.config.addFieldMapping('V010', 'monitoring_hours', { value: 'None', operator: 'equals' });
        
        // Add more mappings as needed...
    }
    
    /**
     * Setup default analysis rules for complex vulnerabilities
     */
    setupDefaultAnalysisRules() {
        // V013 - Security Personnel Coverage
        this.config.addAnalysisRule('V013', (formData, fieldResolver) => {
            const hasSecurity = fieldResolver.resolveField(formData, 'secforce_247') === 'Yes';
            const hasArmed = fieldResolver.resolveField(formData, 'secforce_armed') === 'Yes';
            return !hasSecurity || !hasArmed;
        });
        
        // V015 - Video Surveillance Coverage
        this.config.addAnalysisRule('V015', (formData, fieldResolver) => {
            const vssPresent = fieldResolver.resolveField(formData, 'vss_present') === 'Yes';
            const vssCoverage = fieldResolver.resolveField(formData, 'vss_coverage');
            return !vssPresent || vssCoverage === 'Partial' || vssCoverage === 'None';
        });
        
        // Add more complex rules as needed...
    }
    
    /**
     * Analyze form data and return results
     */
    analyze(formData) {
        if (!this.isInitialized) {
            throw new Error('VOFC Manager not initialized. Call initialize() first.');
        }
        
        return this.engine.analyze(formData);
    }
    
    /**
     * Get vulnerability by ID
     */
    getVulnerabilityById(vulnerabilityId) {
        return this.config.vulnerabilities.find(v => v.v_number === vulnerabilityId);
    }
    
    /**
     * Get options for vulnerability
     */
    getOptionsForVulnerability(vulnerabilityId) {
        return this.config.options.filter(o => o.vulnerability_id === vulnerabilityId);
    }
    
    /**
     * Add custom field mapping
     */
    addFieldMapping(vulnerabilityId, fieldPath, condition) {
        this.config.addFieldMapping(vulnerabilityId, fieldPath, condition);
    }
    
    /**
     * Add custom analysis rule
     */
    addAnalysisRule(vulnerabilityId, ruleFunction) {
        this.config.addAnalysisRule(vulnerabilityId, ruleFunction);
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.config.cache.clear();
    }
    
    /**
     * Get system statistics
     */
    getStats() {
        return {
            vulnerabilities: this.config.vulnerabilities.length,
            options: this.config.options.length,
            fieldMappings: this.config.fieldMappings.size,
            analysisRules: this.config.analysisRules.size,
            cacheSize: this.config.cache.size,
            isInitialized: this.isInitialized
        };
    }
}

// Export for use
window.VOFCManager = VOFCManager;
