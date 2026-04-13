/**
 * VOFC Field Mappings Configuration
 * Centralized configuration for all vulnerability field mappings
 */

class VOFCFieldMappings {
    constructor() {
        this.mappings = new Map();
        this.setupDefaultMappings();
    }
    
    setupDefaultMappings() {
        // Physical Security Mappings
        this.addMapping('V001', 'has_perimeter_barriers', { value: 'No', operator: 'equals' });
        this.addMapping('V001', 'standoff_perimeter_fencing', { value: 'None', operator: 'equals' });
        
        this.addMapping('V002', 'standoff_landscaping_lighting', { value: 'No', operator: 'equals' });
        this.addMapping('V002', 'surface_parking_lighting', { value: 'None', operator: 'equals' });
        
        this.addMapping('V003', 'standoff_vehicle_barriers', { value: 'No', operator: 'equals' });
        this.addMapping('V003', 'vehicle_barrier_rating', { value: '', operator: 'is_empty' });
        
        this.addMapping('V004', 'standoff_fence_sensors', { value: 'No', operator: 'equals' });
        this.addMapping('V004', 'perimeter_alarm_system', { value: 'No', operator: 'equals' });
        
        this.addMapping('V005', 'standoff_blast_protection', { value: '', operator: 'is_empty' });
        this.addMapping('V005', 'standoff_minimum_distance', { value: 100, operator: 'less_than' });
        
        this.addMapping('V006', 'standoff_signage_no_trespassing', { value: 'No', operator: 'equals' });
        this.addMapping('V006', 'standoff_signage_private_property', { value: 'No', operator: 'equals' });
        
        this.addMapping('V007', 'standoff_landscaping_clear_zones', { value: 'No', operator: 'equals' });
        this.addMapping('V007', 'standoff_landscaping_thorny_plants', { value: 'No', operator: 'equals' });
        
        this.addMapping('V008', 'standoff_minimum_distance', { value: 50, operator: 'less_than' });
        this.addMapping('V008', 'standoff_street_distance', { value: 50, operator: 'less_than' });
        
        this.addMapping('V009', 'standoff_fence_height', { value: 6, operator: 'less_than' });
        this.addMapping('V009', 'standoff_fence_condition', { value: 'Poor', operator: 'equals' });
        
        this.addMapping('V010', 'secforce_reporting', { value: 'None', operator: 'equals' });
        this.addMapping('V010', 'monitoring_hours', { value: 'None', operator: 'equals' });
        
        // Security Systems Mappings
        this.addMapping('V011', 'vss_present', { value: 'No', operator: 'equals' });
        this.addMapping('V011', 'vss_system_type', { value: 'None', operator: 'equals' });
        
        this.addMapping('V012', 'els_present', { value: 'No', operator: 'equals' });
        this.addMapping('V012', 'els_system_type', { value: '', operator: 'is_empty' });
        
        this.addMapping('V013', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V013', 'secforce_armed', { value: 'No', operator: 'equals' });
        
        this.addMapping('V014', 'soc_present', { value: 'No', operator: 'equals' });
        this.addMapping('V014', 'central_monitoring', { value: 'No', operator: 'equals' });
        
        this.addMapping('V015', 'vss_coverage', { value: 'Partial', operator: 'equals' });
        this.addMapping('V015', 'vss_coverage', { value: 'None', operator: 'equals' });
        
        // VIP Security Mappings
        this.addMapping('V016', 'vip_areas_present', { value: 'No', operator: 'equals' });
        this.addMapping('V016', 'vip_room_count', { value: 0, operator: 'less_than' });
        
        this.addMapping('V017', 'vip_access_control', { value: 'No', operator: 'equals' });
        this.addMapping('V017', 'vip_screening', { value: 'No', operator: 'equals' });
        
        this.addMapping('V018', 'vip_security_staff', { value: 'No', operator: 'equals' });
        this.addMapping('V018', 'vip_escort_service', { value: 'No', operator: 'equals' });
        
        this.addMapping('V019', 'vip_parking', { value: 'No', operator: 'equals' });
        this.addMapping('V019', 'vip_vehicle_screening', { value: 'No', operator: 'equals' });
        
        this.addMapping('V020', 'vip_elevators', { value: 'No', operator: 'equals' });
        this.addMapping('V020', 'vip_entrance_count', { value: 0, operator: 'less_than' });
        
        // Emergency Planning Mappings
        this.addMapping('V021', 'emergency_plan_written', { value: 'No', operator: 'equals' });
        this.addMapping('V021', 'emergency_plan_updated', { value: 'No', operator: 'equals' });
        
        this.addMapping('V022', 'emergency_training_frequency', { value: 'None', operator: 'equals' });
        this.addMapping('V022', 'emergency_exercise_frequency', { value: 'None', operator: 'equals' });
        
        this.addMapping('V023', 'first_responder_contacts', { value: 0, operator: 'less_than' });
        this.addMapping('V023', 'emergency_communication_system', { value: 'None', operator: 'equals' });
        
        this.addMapping('V024', 'backup_power_system', { value: 'No', operator: 'equals' });
        this.addMapping('V024', 'backup_communication_system', { value: 'No', operator: 'equals' });
        
        this.addMapping('V025', 'evacuation_plan', { value: 'No', operator: 'equals' });
        this.addMapping('V025', 'evacuation_routes', { value: 'No', operator: 'equals' });
        
        // Add more mappings as needed...
    }
    
    addMapping(vulnerabilityId, fieldPath, condition) {
        if (!this.mappings.has(vulnerabilityId)) {
            this.mappings.set(vulnerabilityId, []);
        }
        this.mappings.get(vulnerabilityId).push({
            fieldPath,
            condition,
            type: 'field'
        });
    }
    
    getMappingsForVulnerability(vulnerabilityId) {
        return this.mappings.get(vulnerabilityId) || [];
    }
    
    getAllMappings() {
        return this.mappings;
    }
    
    /**
     * Auto-discover field mappings from form data
     */
    discoverMappings(formData, vulnerabilities) {
        const discoveredMappings = new Map();
        
        for (const vulnerability of vulnerabilities) {
            const vulnerabilityId = vulnerability.v_number;
            const discovered = [];
            
            // Look for fields that might be related to this vulnerability
            const keywords = this.extractKeywords(vulnerability.vulnerability_text);
            
            for (const fieldPath of this.getAllFieldPaths(formData)) {
                if (this.fieldMatchesKeywords(fieldPath, keywords)) {
                    discovered.push({
                        fieldPath,
                        condition: { value: 'No', operator: 'equals' }, // Default condition
                        type: 'discovered',
                        confidence: this.calculateConfidence(fieldPath, keywords)
                    });
                }
            }
            
            if (discovered.length > 0) {
                discoveredMappings.set(vulnerabilityId, discovered);
            }
        }
        
        return discoveredMappings;
    }
    
    extractKeywords(text) {
        // Extract relevant keywords from vulnerability text
        const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));
    }
    
    getAllFieldPaths(obj, prefix = '') {
        const paths = [];
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const currentPath = prefix ? `${prefix}.${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    paths.push(...this.getAllFieldPaths(obj[key], currentPath));
                } else {
                    paths.push(currentPath);
                }
            }
        }
        
        return paths;
    }
    
    fieldMatchesKeywords(fieldPath, keywords) {
        const fieldLower = fieldPath.toLowerCase();
        return keywords.some(keyword => fieldLower.includes(keyword));
    }
    
    calculateConfidence(fieldPath, keywords) {
        const fieldLower = fieldPath.toLowerCase();
        const matches = keywords.filter(keyword => fieldLower.includes(keyword)).length;
        return matches / keywords.length;
    }
}

// Export for use
window.VOFCFieldMappings = VOFCFieldMappings;
