/**
 * VOFC Core System - Refactored Architecture
 * Modular, testable, and maintainable vulnerability analysis system
 */

function hostAnswerYes(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isAffirmativeYes) {
        return HostAnswerNormalize.isAffirmativeYes(v);
    }
    return String(v ?? '').trim().toLowerCase() === 'yes';
}
function hostAnswerNo(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isNegativeResponse) {
        return HostAnswerNormalize.isNegativeResponse(v);
    }
    const n = String(v ?? '').trim().toLowerCase();
    return n === 'no' || n === 'false' || n === '0' || n === 'none' || n === 'n/a' || n === 'na';
}

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

    normalizeValue(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
            return value.map(item => this.normalizeValue(item)).join(',');
        }
        return value.toString().trim().toLowerCase();
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
        const actualNormalized = this.normalizeValue(actualValue);
        const expectedNormalized = this.normalizeValue(expectedValue);
        
        switch (operator) {
            case 'equals':
                if (typeof actualValue === 'number' || typeof expectedValue === 'number') {
                    return parseFloat(actualValue) === parseFloat(expectedValue);
                }
                return actualNormalized === expectedNormalized;
            case 'not_equals':
                if (typeof actualValue === 'number' || typeof expectedValue === 'number') {
                    return parseFloat(actualValue) !== parseFloat(expectedValue);
                }
                return actualNormalized !== expectedNormalized;
            case 'contains':
                return actualNormalized.includes(expectedNormalized);
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
        this.triggerConditionAliases = this.buildTriggerConditionAliases();
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

    buildTriggerConditionAliases() {
        return {
            perimeter_fencing: ['standoff_perimeter_fencing'],
            vehicle_barriers: ['standoff_vehicle_barriers'],
            video_surveillance: ['vss_present'],
            staff_training: ['secforce_trained_all_plans'],
            security_training: ['secforce_trained_all_plans'],
            emergency_policies: ['secforce_training_evacuation'],
            emergency_procedures: ['secforce_training_evacuation'],
            access_control_system: ['els_present'],
            electronic_access: ['els_present'],
            perimeter_lighting: ['surface_parking_lighting', 'garage_parking_lighting'],
            exterior_lighting: ['surface_parking_lighting', 'garage_parking_lighting'],
            visitor_management: ['surface_parking_control'],
            visitor_tracking: ['secforce_reporting'],
            standoff_distance: ['standoff_minimum_distance', 'standoff_street_distance'],
            security_personnel: ['secforce_247'],
            dedicated_security: ['secforce_247'],
            emergency_communication: ['monitoring_hours', 'secforce_reporting'],
            crisis_communication: ['secforce_reporting'],
            cybersecurity_protection: ['vss_network_segmentation'],
            fire_safety_integration: ['fire_panel_access'],
            vip_security_protocols: ['vip_access_control_systems', 'vip_monitoring_surveillance'],
            vip_protection_measures: ['vip_vehicle_screening', 'vip_security_personnel'],
            parking_security: ['surface_parking_vss', 'garage_parking_vss'],
            parking_access_control: ['surface_parking_control', 'garage_parking_control'],
            pool_security: ['pool_vss_coverage', 'pool_access_control'],
            recreational_security: ['pool_access_control'],
            vendor_screening: ['vip_staff_background_checks'],
            contractor_security: ['vip_staff_background_checks'],
            elevator_security: ['els_present'],
            stairwell_security: ['els_present'],
            retail_security: ['vss_camera_count', 'vss_monitored_by'],
            public_area_security: ['vss_monitored_by'],
            incident_reporting: ['secforce_reporting'],
            security_documentation: ['secforce_reporting'],
            system_redundancy: ['security_backup_power', 'system_integration'],
            backup_systems: ['security_backup_power'],
            data_protection: ['vss_network_segmentation'],
            privacy_measures: ['vss_network_segmentation'],
            // Delivery/receiving coverage proxy (physical security only—not food safety regulation)
            food_security: ['secforce_247'],
            beverage_security: ['secforce_247'],
            laundry_security: ['secforce_247'],
            housekeeping_security: ['secforce_trained_all_plans'],
            maintenance_security: ['fire_panel_access'],
            utility_security: ['security_backup_power'],
            guest_room_security: ['els_present'],
            room_access_control: ['els_present'],
            conference_security: ['vss_camera_count'],
            meeting_room_security: ['vss_camera_count'],
            spa_security: ['pool_access_control'],
            wellness_security: ['pool_access_control'],
            fitness_security: ['secforce_247'],
            gym_security: ['secforce_247'],
            business_center_security: ['vss_network_segmentation'],
            office_security: ['vss_network_segmentation'],
            children_security: ['pool_lifeguard', 'pool_access_control'],
            family_security: ['pool_access_control'],
            operational_security: ['secforce_trained_all_plans'],
            business_continuity: ['security_backup_power'],
            guest_services_security: ['secforce_247'],
            concierge_security: ['secforce_247'],
            transportation_security: ['surface_parking_control'],
            valet_security: ['surface_parking_control'],
            event_security: ['secforce_surge_capacity'],
            banquet_security: ['secforce_surge_capacity'],
            nightclub_security: ['monitoring_hours'],
            entertainment_security: ['monitoring_hours'],
            casino_security: ['vss_monitored_by'],
            gaming_security: ['vss_monitored_by'],
            shopping_security: ['vss_camera_count'],
            medical_security: ['secforce_training_medical'],
            health_services_security: ['secforce_training_medical'],
            environmental_security: ['has_ev_charging'],
            sustainability_security: ['has_ev_charging'],
            international_security: ['vip_staff_training'],
            cultural_security: ['vip_staff_training'],
            vip_transportation_security: ['vip_vehicle_screening'],
            vehicle_screening: ['vip_vehicle_screening'],
            recreational_access_control: ['pool_access_control'],
            vendor_background_checks: ['vip_staff_background_checks'],
            contractor_screening: ['vip_staff_background_checks'],
            vertical_circulation_security: ['els_present'],
            public_area_monitoring: ['vss_monitored_by'],
            lobby_security: ['vss_monitored_by'],
            incident_management: ['secforce_reporting'],
            crisis_response: ['secforce_trained_all_plans'],
            backup_procedures: ['security_backup_power'],
            kitchen_security: ['secforce_247'], // legacy alias; HOST does not assess kitchen food-safety law
            service_area_security: ['secforce_247']
        };
    }

    normalizeText(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
            return value.map(v => this.normalizeText(v)).join(',');
        }
        return value.toString().trim().toLowerCase();
    }

    resolveTriggerCandidates(rawField) {
        const candidates = [rawField];
        if (this.triggerConditionAliases[rawField]) {
            candidates.push(...this.triggerConditionAliases[rawField]);
        }
        return Array.from(new Set(candidates));
    }

    isWeakSecurityState(valueText) {
        if (!valueText) return true;
        const weakSignals = [
            'no',
            'none',
            'poor',
            'fair',
            'basic',
            'open access',
            'on-demand',
            'for evidence only',
            'standalone',
            'unknown',
            'partial',
            'limited',
            'missing'
        ];
        return weakSignals.some(signal => valueText === signal || valueText.includes(signal));
    }

    matchesTriggerCondition(actualValue, expectedValue) {
        const actualText = this.normalizeText(actualValue);
        const expectedText = this.normalizeText(expectedValue);

        if (!expectedText) return false;
        if (actualText === expectedText) return true;

        if (expectedText === 'no') {
            return actualText === 'no' || actualText === 'none' || actualText.startsWith('no ');
        }
        if (expectedText === 'not_enclosed') {
            return actualText === 'no' || actualText === 'none' || actualText.includes('open access');
        }
        if (expectedText === 'inadequate' || expectedText === 'insufficient' || expectedText === 'missing') {
            return this.isWeakSecurityState(actualText);
        }
        if (expectedText === 'basic') {
            return actualText.includes('basic');
        }
        if (expectedText === 'unrestricted' || expectedText === 'unrestricted access') {
            return actualText.includes('open access') || actualText.includes('none');
        }
        if (expectedText === 'partial or none') {
            return actualText === 'partial' || actualText === 'none';
        }
        if (expectedText.endsWith('only')) {
            return actualText.includes(expectedText);
        }

        return false;
    }

    shouldTriggerFromEmbeddedConditions(vulnerability, formData) {
        const triggerConditions = vulnerability.trigger_conditions;
        if (!triggerConditions || typeof triggerConditions !== 'object') {
            return false;
        }

        for (const [rawField, expectedValue] of Object.entries(triggerConditions)) {
            const candidates = this.resolveTriggerCandidates(rawField);
            for (const candidate of candidates) {
                const actualValue = this.fieldResolver.resolveField(formData, candidate);
                if (actualValue === null || actualValue === undefined || actualValue === '') {
                    continue;
                }
                if (this.matchesTriggerCondition(actualValue, expectedValue)) {
                    return true;
                }
            }
        }

        return false;
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

        // Fallback to embedded vulnerability trigger conditions for legacy records
        if (this.shouldTriggerFromEmbeddedConditions(vulnerability, formData)) {
            return true;
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
        // V003 - Security training coverage
        this.config.addAnalysisRule('V003', (formData, fieldResolver) => {
            const trainedAllPlans = hostAnswerYes(fieldResolver.resolveField(formData, 'secforce_trained_all_plans'));
            const hasActiveShooter = hostAnswerYes(fieldResolver.resolveField(formData, 'secforce_training_active_shooter'));
            const hasMedical = hostAnswerYes(fieldResolver.resolveField(formData, 'secforce_training_medical'));
            const hasEvacuation = hostAnswerYes(fieldResolver.resolveField(formData, 'secforce_training_evacuation'));
            return !trainedAllPlans || !hasActiveShooter || !hasMedical || !hasEvacuation;
        });

        // V013 - VIP security protocol coverage
        this.config.addAnalysisRule('V013', (formData, fieldResolver) => {
            const vipAccess = fieldResolver.resolveField(formData, 'vip_access_control_systems');
            const vipScreening = fieldResolver.resolveField(formData, 'vip_vehicle_screening');
            return vipAccess === 'No VIP Access Control' || vipAccess === 'Basic Access Control' || vipScreening === 'No Screening';
        });
        
        // V015 - Pool/recreational security coverage
        this.config.addAnalysisRule('V015', (formData, fieldResolver) => {
            const poolCoverage = fieldResolver.resolveField(formData, 'pool_vss_coverage');
            const poolAccess = fieldResolver.resolveField(formData, 'pool_access_control');
            const lifeguard = fieldResolver.resolveField(formData, 'pool_lifeguard');
            return poolCoverage === 'None' || poolCoverage === 'Partial' || poolAccess === 'Open Access' || hostAnswerNo(lifeguard);
        });

        // V020 - Backup and redundancy
        this.config.addAnalysisRule('V020', (formData, fieldResolver) => {
            const backupPower = fieldResolver.resolveField(formData, 'security_backup_power');
            const integration = fieldResolver.resolveField(formData, 'system_integration');
            return hostAnswerNo(backupPower) || backupPower === 'Partial' || integration === 'Standalone Systems';
        });

        // V021 - Data protection
        this.config.addAnalysisRule('V021', (formData, fieldResolver) => {
            const segmentation = fieldResolver.resolveField(formData, 'vss_network_segmentation');
            const seg = String(segmentation ?? '').trim().toLowerCase();
            return hostAnswerNo(segmentation) || seg === 'unknown';
        });

        // V041 - VIP transport screening
        this.config.addAnalysisRule('V041', (formData, fieldResolver) => {
            const vipVehicleScreening = fieldResolver.resolveField(formData, 'vip_vehicle_screening');
            const vipParkingType = fieldResolver.resolveField(formData, 'vip_parking_type');
            return vipVehicleScreening === 'No Screening' || vipParkingType === 'Surface Level';
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
