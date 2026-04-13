// Fuzzy Field Mapper for HOST V2 to VOFC Vulnerability Mapping
// This script uses fuzzy logic to map existing HOST V2 data fields to VOFC vulnerabilities

window.FuzzyFieldMapper = class {
    constructor() {
        this.fieldMappings = new Map();
        this.similarityThreshold = 0.6; // Minimum similarity score for mapping
        this.initializeMappings();
    }

    // Initialize field mappings based on semantic similarity
    initializeMappings() {
        // V001 - No vehicle barriers or perimeter fencing
        this.addMapping('V001', [
            'perimeter_fencing', 'vehicle_barriers', 'has_perimeter_barriers',
            'standoff_measures', 'standoff_vehicle_barriers', 'standoff_perimeter_fencing'
        ]);

        // V002 - No video surveillance system
        this.addMapping('V002', [
            'vss_present', 'video_surveillance', 'camera_system', 'surveillance_system',
            'vss_system_type', 'vss_ip_cameras', 'vss_ptz_cameras', 'vss_dome_cameras'
        ]);

        // V003 - Insufficient staff training on security procedures
        this.addMapping('V003', [
            'secforce_training_active_shooter', 'secforce_training_deescalation',
            'secforce_training_medical', 'secforce_training_evacuation',
            'secforce_training_bomb', 'secforce_training_cyber', 'secforce_certs'
        ]);

        // V004 - Inadequate access control systems
        this.addMapping('V004', [
            'els_present', 'access_control', 'visitor_screening', 'els_system_type',
            'els_integration', 'els_proximity', 'els_rfid', 'els_magstripe',
            'els_pin', 'els_biometric', 'els_mobile'
        ]);

        // V005 - Inadequate emergency preparedness protocols
        this.addMapping('V005', [
            'emergency_protocols', 'crisis_management', 'emergency_communication',
            'fire_panel_location', 'fire_panel_access', 'emergency_contacts',
            'emergency_agencies', 'emergency_equipment', 'emergency_procedures'
        ]);

        // V006 - Insufficient lighting for security purposes
        this.addMapping('V006', [
            'security_lighting', 'perimeter_lighting', 'exterior_lighting',
            'parking_lighting', 'surface_parking_lighting', 'garage_parking_lighting'
        ]);

        // V007 - Inadequate communication systems
        this.addMapping('V007', [
            'communication_systems', 'emergency_communication', 'crisis_communication',
            'soc_present', 'monitoring_hours', 'system_integration'
        ]);

        // V008 - Insufficient security personnel coverage
        this.addMapping('V008', [
            'secforce_day', 'secforce_night', 'secforce_247', 'secforce_surge_capacity',
            'secforce_provider_name', 'secforce_response_time', 'secforce_armed',
            'secforce_unarmed', 'secforce_patrol_foot', 'secforce_patrol_vehicle'
        ]);

        // V009 - Inadequate cybersecurity measures
        this.addMapping('V009', [
            'cybersecurity', 'network_security', 'vss_network_segmentation',
            'cybersecurity_protection', 'data_protection', 'privacy_measures'
        ]);

        // V010 - Inadequate emergency communication systems
        this.addMapping('V010', [
            'emergency_communication', 'crisis_communication', 'emergency_contacts',
            'emergency_agencies', 'communication_systems'
        ]);

        // V011 - Insufficient cybersecurity measures for security systems
        this.addMapping('V011', [
            'vss_network_segmentation', 'cybersecurity_protection', 'network_security',
            'vss_cloud', 'vss_retention', 'vss_monitored_by'
        ]);

        // V012 - Inadequate fire safety and emergency systems integration
        this.addMapping('V012', [
            'fire_panel_location', 'fire_panel_access', 'fire_safety_integration',
            'emergency_systems', 'sprinkler_coverage', 'standpipe_present'
        ]);

        // V013 - Inadequate VIP operations security protocols
        this.addMapping('V013', [
            'vip_security_protocols', 'vip_protection_measures', 'vip_escort_services',
            'vip_service_staff', 'vip_entrance_type', 'vip_access_control',
            'vip_vehicle_access', 'vip_vss_coverage'
        ]);

        // V014 - Inadequate parking security measures
        this.addMapping('V014', [
            'parking_security', 'vehicle_screening', 'has_parking', 'has_surface_parking',
            'has_garage_parking', 'surface_parking_control', 'garage_parking_control',
            'surface_parking_vss', 'garage_parking_vss'
        ]);

        // V015 - Inadequate recreational area security
        this.addMapping('V015', [
            'recreational_security', 'pool_security', 'has_pool', 'pool_access_control',
            'pool_vss_coverage', 'pool_lifeguard', 'fitness_center', 'spa_services'
        ]);

        // V016 - Inadequate vendor and contractor security
        this.addMapping('V016', [
            'vendor_security', 'contractor_screening', 'vendor_background_check',
            'vendor_escort', 'vendor_access', 'contractor_access', 'contractor_escort'
        ]);

        // V017 - Inadequate vertical circulation security
        this.addMapping('V017', [
            'vertical_security', 'elevator_security', 'has_elevator', 'elevator_count',
            'elevator_capacity', 'elevator_emergency', 'restricted_elevator_access'
        ]);

        // V018 - Inadequate public area security
        this.addMapping('V018', [
            'public_area_security', 'lobby_security', 'restaurant_count', 'bar_count',
            'business_center', 'concierge_services', 'room_service'
        ]);

        // V019 - Inadequate incident management protocols
        this.addMapping('V019', [
            'incident_management', 'crisis_response', 'emergency_protocols',
            'emergency_agencies', 'emergency_contacts', 'emergency_procedures'
        ]);

        // V020 - Inadequate system redundancy and backup
        this.addMapping('V020', [
            'system_redundancy', 'backup_procedures', 'backup_power_systems',
            'backup_water', 'backup_internet', 'cloud_backup', 'security_backup_power'
        ]);

        // V021 - Inadequate data protection measures
        this.addMapping('V021', [
            'data_protection', 'privacy_measures', 'cybersecurity', 'network_security',
            'vss_network_segmentation', 'cybersecurity_protection'
        ]);

        // V022 - Inadequate food security protocols
        this.addMapping('V022', [
            'food_security', 'kitchen_security', 'restaurant_count', 'room_service',
            'catering_services', 'food_service', 'dining_security'
        ]);

        // V023 - Inadequate service area security
        this.addMapping('V023', [
            'service_area_security', 'operational_security', 'housekeeping',
            'maintenance', 'utility_spaces', 'service_areas'
        ]);

        // V024 - Inadequate infrastructure security
        this.addMapping('V024', [
            'infrastructure_security', 'utility_security', 'building_security',
            'facility_security', 'critical_systems', 'utility_systems'
        ]);

        // V025 - Inadequate guest room security
        this.addMapping('V025', [
            'guest_room_security', 'room_access_control', 'guest_room_count',
            'room_service', 'guest_safety', 'room_security'
        ]);

        // V026 - Inadequate business area security
        this.addMapping('V026', [
            'business_area_security', 'office_security', 'business_center',
            'administrative_areas', 'office_spaces', 'business_operations'
        ]);

        // V027 - Inadequate wellness area security
        this.addMapping('V027', [
            'wellness_security', 'spa_security', 'spa_services', 'wellness_areas',
            'spa_facilities', 'wellness_operations'
        ]);

        // V028 - Inadequate fitness area security
        this.addMapping('V028', [
            'fitness_security', 'gym_security', 'fitness_center', 'gym_facilities',
            'fitness_areas', 'gym_operations'
        ]);

        // V029 - Inadequate office area security
        this.addMapping('V029', [
            'office_security', 'administrative_security', 'office_areas',
            'administrative_areas', 'office_spaces', 'admin_security'
        ]);

        // V030 - Inadequate children's area security
        this.addMapping('V030', [
            'children_security', 'child_protection', 'children_areas',
            'kids_facilities', 'child_safety', 'children_operations'
        ]);

        // V031 - Inadequate operational security measures
        this.addMapping('V031', [
            'operational_security', 'process_security', 'operations_security',
            'business_operations', 'operational_procedures', 'process_controls'
        ]);

        // V032 - Inadequate guest services security
        this.addMapping('V032', [
            'guest_services_security', 'customer_service_security', 'concierge_services',
            'guest_services', 'customer_service', 'guest_experience'
        ]);

        // V033 - Inadequate transportation security
        this.addMapping('V033', [
            'transportation_security', 'vehicle_security', 'valet_parking',
            'transportation_services', 'vehicle_services', 'transport_security'
        ]);

        // V034 - Inadequate event security protocols
        this.addMapping('V034', [
            'event_security', 'special_event_security', 'convention_space',
            'event_capacity', 'special_events', 'event_management'
        ]);

        // V035 - Inadequate entertainment area security
        this.addMapping('V035', [
            'entertainment_security', 'venue_security', 'entertainment_areas',
            'entertainment_facilities', 'venue_operations', 'entertainment_operations'
        ]);

        // V036 - Inadequate gaming area security
        this.addMapping('V036', [
            'gaming_security', 'casino_security', 'gaming_areas', 'gaming_facilities',
            'casino_operations', 'gaming_operations'
        ]);

        // V037 - Inadequate retail area security
        this.addMapping('V037', [
            'retail_security', 'shopping_security', 'retail_areas', 'retail_facilities',
            'shopping_areas', 'retail_operations'
        ]);

        // V038 - Inadequate medical area security
        this.addMapping('V038', [
            'medical_security', 'healthcare_security', 'medical_areas',
            'healthcare_facilities', 'medical_operations', 'healthcare_operations'
        ]);

        // V039 - Inadequate environmental security
        this.addMapping('V039', [
            'environmental_security', 'sustainability_security', 'environmental_measures',
            'sustainability_measures', 'green_security', 'environmental_protection'
        ]);

        // V040 - Inadequate international and cultural security
        this.addMapping('V040', [
            'international_security', 'cultural_security', 'international_guests',
            'cultural_sensitivity', 'international_operations', 'cultural_operations'
        ]);

        // V041 - Inadequate VIP transportation security protocols
        this.addMapping('V041', [
            'vip_transportation_security', 'vehicle_screening', 'vip_vehicle_access',
            'vip_escort_services', 'vip_transportation', 'vip_vehicle_services'
        ]);

        // V042 - Insufficient recreational area access control
        this.addMapping('V042', [
            'recreational_access_control', 'pool_security', 'has_pool', 'pool_access_control',
            'fitness_center', 'spa_services', 'recreational_facilities'
        ]);

        // V043 - Inadequate vendor and contractor security screening
        this.addMapping('V043', [
            'vendor_background_checks', 'contractor_screening', 'vendor_background_check',
            'contractor_access', 'contractor_escort', 'vendor_escort'
        ]);

        // V044 - Insufficient vertical circulation security measures
        this.addMapping('V044', [
            'elevator_security', 'stairwell_security', 'has_elevator', 'elevator_count',
            'elevator_capacity', 'elevator_emergency', 'vertical_circulation'
        ]);

        // V045 - Inadequate public area monitoring and control
        this.addMapping('V045', [
            'public_area_monitoring', 'lobby_security', 'restaurant_count', 'bar_count',
            'business_center', 'concierge_services', 'public_areas'
        ]);

        // V046 - Insufficient incident management and response protocols
        this.addMapping('V046', [
            'incident_management', 'crisis_response', 'emergency_protocols',
            'emergency_agencies', 'emergency_contacts', 'incident_response'
        ]);

        // V047 - Inadequate system redundancy and backup procedures
        this.addMapping('V047', [
            'system_redundancy', 'backup_procedures', 'backup_power_systems',
            'backup_water', 'backup_internet', 'cloud_backup', 'redundancy_measures'
        ]);

        // V048 - Insufficient data protection and privacy measures
        this.addMapping('V048', [
            'data_protection', 'privacy_measures', 'cybersecurity', 'network_security',
            'vss_network_segmentation', 'cybersecurity_protection', 'privacy_protection'
        ]);

        // V049 - Inadequate food security and safety protocols
        this.addMapping('V049', [
            'food_security', 'kitchen_security', 'restaurant_count', 'room_service',
            'catering_services', 'food_service', 'dining_security', 'food_safety'
        ]);

        // V050 - Insufficient service area security measures
        this.addMapping('V050', [
            'service_area_security', 'operational_security', 'housekeeping',
            'maintenance', 'utility_spaces', 'service_areas', 'operational_areas'
        ]);
    }

    // Add mapping for a vulnerability
    addMapping(vulnerabilityId, fields) {
        this.fieldMappings.set(vulnerabilityId, fields);
    }

    // Calculate similarity between two strings using Levenshtein distance
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Find best matching fields for a vulnerability
    findBestMatches(vulnerabilityId, availableFields) {
        const mappedFields = this.fieldMappings.get(vulnerabilityId) || [];
        const matches = [];
        
        for (const mappedField of mappedFields) {
            let bestMatch = null;
            let bestScore = 0;
            
            for (const availableField of availableFields) {
                const score = this.calculateSimilarity(mappedField, availableField);
                if (score > bestScore && score >= this.similarityThreshold) {
                    bestScore = score;
                    bestMatch = availableField;
                }
            }
            
            if (bestMatch) {
                matches.push({
                    vulnerability: vulnerabilityId,
                    mappedField: mappedField,
                    matchedField: bestMatch,
                    similarity: bestScore
                });
            }
        }
        
        return matches.sort((a, b) => b.similarity - a.similarity);
    }

    // Get all available fields from form data
    getAvailableFields(formData) {
        return Object.keys(formData || {});
    }

    // Generate mapping report for all vulnerabilities
    generateMappingReport(formData) {
        const availableFields = this.getAvailableFields(formData);
        const report = {
            totalVulnerabilities: 50,
            mappedVulnerabilities: 0,
            totalMappings: 0,
            mappings: []
        };
        
        for (let i = 1; i <= 50; i++) {
            const vulnerabilityId = `V${i.toString().padStart(3, '0')}`;
            const matches = this.findBestMatches(vulnerabilityId, availableFields);
            
            if (matches.length > 0) {
                report.mappedVulnerabilities++;
                report.totalMappings += matches.length;
                report.mappings.push({
                    vulnerability: vulnerabilityId,
                    matches: matches
                });
            }
        }
        
        return report;
    }

    // Get field mappings for vulnerability matcher
    getFieldMappingsForMatcher() {
        const mappings = {};
        
        for (let i = 1; i <= 50; i++) {
            const vulnerabilityId = `V${i.toString().padStart(3, '0')}`;
            const fields = this.fieldMappings.get(vulnerabilityId) || [];
            mappings[vulnerabilityId] = fields;
        }
        
        return mappings;
    }
};

// Initialize the fuzzy field mapper
window.fuzzyFieldMapper = new FuzzyFieldMapper();

console.log('Fuzzy Field Mapper initialized with 50 vulnerability mappings');
