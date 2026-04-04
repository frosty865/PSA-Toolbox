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
        // Baseline mappings aligned to current HOST form field names
        this.addMapping('V001', 'has_perimeter_barriers', { value: 'No', operator: 'equals' });
        this.addMapping('V001', 'standoff_perimeter_fencing', { value: 'None', operator: 'equals' });
        this.addMapping('V001', 'standoff_vehicle_barriers', { value: 'No', operator: 'equals' });

        this.addMapping('V002', 'vss_present', { value: 'No', operator: 'equals' });
        this.addMapping('V002', 'vss_camera_count', { value: 10, operator: 'less_than' });
        this.addMapping('V002', 'vss_system_type', { value: '', operator: 'is_empty' });

        this.addMapping('V003', 'secforce_trained_all_plans', { value: 'No', operator: 'equals' });
        this.addMapping('V003', 'secforce_reporting', { value: '', operator: 'is_empty' });

        // V004: life-safety / resilience signals (FACP access, backup power) — not a substitute for a written EOP survey
        this.addMapping('V004', 'fire_panel_access', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V004', 'security_backup_power', { value: 'No', operator: 'equals' });

        this.addMapping('V005', 'els_present', { value: 'No', operator: 'equals' });
        this.addMapping('V005', 'els_system_type', { value: '', operator: 'is_empty' });

        this.addMapping('V006', 'surface_parking_lighting', { value: 'Poor', operator: 'equals' });
        this.addMapping('V006', 'surface_parking_lighting', { value: 'Fair', operator: 'equals' });
        this.addMapping('V006', 'garage_parking_lighting', { value: 'Poor', operator: 'equals' });
        this.addMapping('V006', 'garage_parking_lighting', { value: 'Fair', operator: 'equals' });

        this.addMapping('V007', 'surface_parking_control', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V007', 'has_perimeter_barriers', { value: 'No', operator: 'equals' });

        this.addMapping('V008', 'standoff_minimum_distance', { value: 50, operator: 'less_than' });
        this.addMapping('V008', 'standoff_street_distance', { value: 50, operator: 'less_than' });

        this.addMapping('V009', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V009', 'secforce_day', { value: 1, operator: 'less_than' });
        this.addMapping('V009', 'secforce_night', { value: 1, operator: 'less_than' });

        this.addMapping('V010', 'monitoring_hours', { value: 'Business Hours', operator: 'equals' });
        this.addMapping('V010', 'monitoring_hours', { value: 'On-Demand', operator: 'equals' });
        this.addMapping('V010', 'secforce_reporting', { value: '', operator: 'is_empty' });

        this.addMapping('V011', 'vss_network_segmentation', { value: 'No', operator: 'equals' });
        this.addMapping('V011', 'vss_network_segmentation', { value: 'Unknown', operator: 'equals' });

        // V012: consolidated into V004 (identical triggers) — keep V012 row in catalog for OFC012 text only

        this.addMapping('V013', 'vip_access_control_systems', { value: 'No VIP Access Control', operator: 'equals' });
        this.addMapping('V013', 'vip_vehicle_screening', { value: 'No Screening', operator: 'equals' });

        this.addMapping('V014', 'surface_parking_control', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V014', 'garage_parking_control', { value: 'None', operator: 'equals' });
        this.addMapping('V014', 'surface_parking_vss', { value: 'None', operator: 'equals' });
        this.addMapping('V014', 'garage_parking_vss', { value: 'None', operator: 'equals' });

        this.addMapping('V015', 'pool_vss_coverage', { value: 'None', operator: 'equals' });
        this.addMapping('V015', 'pool_vss_coverage', { value: 'Partial', operator: 'equals' });
        this.addMapping('V015', 'pool_access_control', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V015', 'pool_lifeguard', { value: 'No', operator: 'equals' });

        this.addMapping('V016', 'vip_staff_background_checks', { value: 'No Background Checks', operator: 'equals' });
        this.addMapping('V016', 'secforce_certs', { value: '', operator: 'is_empty' });

        this.addMapping('V017', 'els_present', { value: 'No', operator: 'equals' });
        this.addMapping('V017', 'vss_camera_count', { value: 30, operator: 'less_than' });

        this.addMapping('V018', 'vss_monitored_by', { value: 'For Evidence Only', operator: 'equals' });
        this.addMapping('V018', 'vss_camera_count', { value: 50, operator: 'less_than' });

        this.addMapping('V019', 'secforce_reporting', { value: '', operator: 'is_empty' });
        this.addMapping('V019', 'secforce_trained_all_plans', { value: 'No', operator: 'equals' });

        this.addMapping('V020', 'security_backup_power', { value: 'No', operator: 'equals' });
        this.addMapping('V020', 'security_backup_power', { value: 'Partial', operator: 'equals' });
        this.addMapping('V020', 'system_integration', { value: 'Standalone Systems', operator: 'equals' });

        this.addMapping('V021', 'vss_network_segmentation', { value: 'No', operator: 'equals' });
        this.addMapping('V021', 'vss_network_segmentation', { value: 'Unknown', operator: 'equals' });

        this.addMapping('V022', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V022', 'monitoring_hours', { value: 'On-Demand', operator: 'equals' });

        this.addMapping('V023', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V023', 'secforce_trained_all_plans', { value: 'No', operator: 'equals' });

        this.addMapping('V024', 'fire_panel_access', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V024', 'standoff_signage_restricted', { value: 'No', operator: 'equals' });

        this.addMapping('V025', 'els_present', { value: 'No', operator: 'equals' });
        this.addMapping('V025', 'residential_separated', { value: 'No', operator: 'equals' });

        // Extended operational coverage using currently collected fields
        this.addMapping('V026', 'vss_camera_count', { value: 50, operator: 'less_than' });
        this.addMapping('V026', 'secforce_surge_capacity', { value: 'No', operator: 'equals' });

        this.addMapping('V027', 'pool_access_control', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V027', 'pool_vss_coverage', { value: 'None', operator: 'equals' });

        this.addMapping('V028', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V028', 'vss_camera_count', { value: 40, operator: 'less_than' });

        this.addMapping('V029', 'vss_network_segmentation', { value: 'No', operator: 'equals' });
        this.addMapping('V029', 'secforce_reporting', { value: '', operator: 'is_empty' });

        this.addMapping('V030', 'pool_lifeguard', { value: 'No', operator: 'equals' });
        this.addMapping('V030', 'pool_access_control', { value: 'Open Access', operator: 'equals' });

        this.addMapping('V031', 'security_backup_power', { value: 'No', operator: 'equals' });
        this.addMapping('V031', 'security_backup_power', { value: 'Partial', operator: 'equals' });
        this.addMapping('V031', 'secforce_trained_all_plans', { value: 'No', operator: 'equals' });

        this.addMapping('V032', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V032', 'secforce_reporting', { value: '', operator: 'is_empty' });

        this.addMapping('V033', 'surface_parking_control', { value: 'Open Access', operator: 'equals' });
        this.addMapping('V033', 'vip_vehicle_screening', { value: 'No Screening', operator: 'equals' });

        this.addMapping('V034', 'secforce_surge_capacity', { value: 'No', operator: 'equals' });
        this.addMapping('V034', 'monitoring_hours', { value: 'Business Hours', operator: 'equals' });

        this.addMapping('V035', 'monitoring_hours', { value: 'On-Demand', operator: 'equals' });
        this.addMapping('V035', 'vss_monitored_by', { value: 'For Evidence Only', operator: 'equals' });

        this.addMapping('V036', 'vss_monitored_by', { value: 'For Evidence Only', operator: 'equals' });
        this.addMapping('V036', 'vss_camera_count', { value: 60, operator: 'less_than' });

        this.addMapping('V037', 'vss_camera_count', { value: 50, operator: 'less_than' });
        this.addMapping('V037', 'vss_monitored_by', { value: 'For Evidence Only', operator: 'equals' });

        this.addMapping('V038', 'secforce_trained_all_plans', { value: 'No', operator: 'equals' });
        this.addMapping('V038', 'security_backup_power', { value: 'No', operator: 'equals' });

        // V039: removed auto-trigger — absence of EV charging is not a security defect; add EV/site fields before re-enabling

        this.addMapping('V040', 'vip_staff_training', { value: 'Basic Service Training', operator: 'equals' });
        this.addMapping('V040', 'vip_staff_training', { value: 'No Special Training', operator: 'equals' });

        this.addMapping('V041', 'vip_vehicle_screening', { value: 'No Screening', operator: 'equals' });
        this.addMapping('V041', 'vip_parking_type', { value: 'Surface Level', operator: 'equals' });

        // V042: consolidated into V015 (same pool triggers)

        // V043: consolidated into V016 (same VIP staff / Security Force credential triggers)

        this.addMapping('V044', 'els_present', { value: 'No', operator: 'equals' });
        this.addMapping('V044', 'fire_panel_access', { value: 'Open Access', operator: 'equals' });

        this.addMapping('V045', 'vss_monitored_by', { value: 'For Evidence Only', operator: 'equals' });
        this.addMapping('V045', 'monitoring_hours', { value: 'Business Hours', operator: 'equals' });

        // V046: consolidated into V019 (same Security Force reporting / training triggers)

        // V047: consolidated into V020 (same backup power / integration triggers)

        // V048: consolidated into V021 (same VSS network segmentation triggers)

        // V049: consolidated into V022 (same staffing / monitoring triggers — receiving/delivery physical security proxy only; not food safety regulation)

        this.addMapping('V050', 'secforce_247', { value: 'No', operator: 'equals' });
        this.addMapping('V050', 'standoff_signage_restricted', { value: 'No', operator: 'equals' });
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
