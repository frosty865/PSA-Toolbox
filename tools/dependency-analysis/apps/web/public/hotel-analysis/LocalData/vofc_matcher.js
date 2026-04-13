// VOFC Vulnerability Matcher for HOST V2 Integration
// This class provides automated vulnerability detection and options for consideration

class VOFCVulnerabilityMatcher {
    constructor() {
        this.vulnerabilities = window.VOFC_VULNERABILITIES || [];
        this.options = window.VOFC_OPTIONS || [];
        this.detectedVulnerabilities = [];
        this.recommendedOptions = [];
        
        console.log('VOFC Vulnerability Matcher initialized with', this.vulnerabilities.length, 'vulnerabilities and', this.options.length, 'options');
    }
    
    // Main analysis function - analyzes form data and returns vulnerabilities and options
    analyzeAssessment(formData) {
        console.log('Starting VOFC analysis with form data:', formData);
        
        this.detectedVulnerabilities = [];
        this.recommendedOptions = [];
        
        // Analyze each security category
        this.analyzePhysicalSecurity(formData);
        this.analyzeTechnology(formData);
        this.analyzeAccessControl(formData);
        this.analyzePersonnelSecurity(formData);
        this.analyzeEmergencyPreparedness(formData);
        this.analyzeVIPOperations(formData);
        this.analyzeParkingSecurity(formData);
        this.analyzeRecreationalSecurity(formData);
        this.analyzeVendorSecurity(formData);
        this.analyzeVerticalSecurity(formData);
        this.analyzePublicAreaSecurity(formData);
        this.analyzeIncidentManagement(formData);
        this.analyzeSystemRedundancy(formData);
        this.analyzeDataProtection(formData);
        this.analyzeFoodSecurity(formData);
        this.analyzeServiceAreaSecurity(formData);
        this.analyzeInfrastructureSecurity(formData);
        this.analyzeGuestRoomSecurity(formData);
        this.analyzeBusinessAreaSecurity(formData);
        this.analyzeWellnessSecurity(formData);
        this.analyzeFitnessSecurity(formData);
        this.analyzeOfficeSecurity(formData);
        this.analyzeChildrenSecurity(formData);
        this.analyzeOperationalSecurity(formData);
        this.analyzeGuestServicesSecurity(formData);
        this.analyzeTransportationSecurity(formData);
        this.analyzeEventSecurity(formData);
        this.analyzeEntertainmentSecurity(formData);
        this.analyzeGamingSecurity(formData);
        this.analyzeRetailSecurity(formData);
        this.analyzeMedicalSecurity(formData);
        this.analyzeEnvironmentalSecurity(formData);
        this.analyzeInternationalSecurity(formData);
        
        // New analysis functions for expanded vulnerabilities
        this.analyzeVIPTransportationSecurity(formData);
        this.analyzeRecreationalAreaSecurity(formData);
        this.analyzeVendorSecurity(formData);
        this.analyzeVerticalCirculationSecurity(formData);
        this.analyzePublicAreaSecurity(formData);
        this.analyzeIncidentManagement(formData);
        this.analyzeSystemRedundancy(formData);
        this.analyzeDataProtection(formData);
        this.analyzeFoodSecurity(formData);
        this.analyzeServiceAreaSecurity(formData);
        
        // Add realistic vulnerability analysis for common security gaps
        this.analyzeRealisticVulnerabilities(formData);
        
        // Calculate overall security score
        const overallScore = this.calculateOverallScore(formData);
        
        console.log('VOFC analysis complete:', {
            vulnerabilities: this.detectedVulnerabilities.length,
            options: this.recommendedOptions.length,
            overallScore: overallScore
        });
        
        return {
            vulnerabilities: this.detectedVulnerabilities,
            options: this.recommendedOptions,
            overallScore: overallScore,
            categories: this.calculateCategoryScores(formData)
        };
    }
    
    // Physical Security Analysis
    analyzePhysicalSecurity(formData) {
        console.log('Analyzing Physical Security...');
        
        // Check for perimeter fencing (HOST V2 field names)
        if (this.checkConditionFlexible(formData, 'has_perimeter_barriers', 'No') || 
            this.checkConditionFlexible(formData, 'standoff_perimeter_fencing', 'No')) {
            this.addVulnerability('V001');
        }
        
        // Check for perimeter lighting
        if (this.checkConditionFlexible(formData, 'standoff_landscaping_lighting', 'No') ||
            this.checkConditionFlexible(formData, 'surface_parking_lighting', 'Poor')) {
            this.addVulnerability('V006');
        }
        
        // Check for standoff distance - look for insufficient distances
        const minDistance = formData.standoff_minimum_distance || 
                           formData.sections?.physical_security?.standoff_minimum_distance ||
                           formData.sections?.facility_info?.standoff_minimum_distance;
        if (minDistance && parseInt(minDistance) < 50) {
            console.log(`Insufficient standoff distance: ${minDistance} feet`);
            this.addVulnerability('V008');
        }
        
        // Check for vehicle barriers
        if (this.checkConditionFlexible(formData, 'standoff_vehicle_barriers', 'No')) {
            this.addVulnerability('V001');
        }
    }
    
    // Technology Analysis
    analyzeTechnology(formData) {
        console.log('Analyzing Technology...');
        
        // Check for video surveillance system (HOST V2 field names)
        if (this.checkConditionFlexible(formData, 'vss_present', 'No') ||
            this.checkConditionFlexible(formData, 'vss_system_type', 'None')) {
            this.addVulnerability('V002');
        }
        
        // Check for electronic locking system
        if (this.checkConditionFlexible(formData, 'els_present', 'No') ||
            this.checkConditionFlexible(formData, 'els_system_type', 'None')) {
            this.addVulnerability('V005');
        }
        
        // Check for security operations center
        if (this.checkConditionFlexible(formData, 'soc_present', 'No')) {
            this.addVulnerability('V002');
        }
    }
    
    // Access Control Analysis
    analyzeAccessControl(formData) {
        console.log('Analyzing Access Control...');
        
        // Check for electronic access control (HOST V2 field names)
        if (this.checkConditionFlexible(formData, 'els_present', 'No') ||
            this.checkConditionFlexible(formData, 'els_system_type', 'None')) {
            this.addVulnerability('V005');
        }
        
        // Check for visitor management
        if (this.checkConditionFlexible(formData, 'vip_access_control', 'None') ||
            this.checkConditionFlexible(formData, 'pool_access_control', 'None')) {
            this.addVulnerability('V007');
        }
        
        // Check for access control integration
        if (this.checkConditionFlexible(formData, 'els_integration', 'None') ||
            this.checkConditionFlexible(formData, 'system_integration', 'None')) {
            this.addVulnerability('V005');
        }
    }
    
    // Personnel Security Analysis
    analyzePersonnelSecurity(formData) {
        console.log('Analyzing Personnel Security...');
        
        // Check for security personnel (HOST V2 field names)
        if (this.checkConditionFlexible(formData, 'secforce_type', 'None') ||
            this.checkConditionFlexible(formData, 'secforce_247', 'No')) {
            this.addVulnerability('V009');
        }
        
        // Check for staff training
        if (this.checkConditionFlexible(formData, 'secforce_training_active_shooter', 'No') ||
            this.checkConditionFlexible(formData, 'secforce_training_deescalation', 'No')) {
            this.addVulnerability('V003');
        }
        
        // Check for security force size
        const dayStaff = parseInt(formData.secforce_day) || 0;
        const nightStaff = parseInt(formData.secforce_night) || 0;
        if (dayStaff < 5 || nightStaff < 3) {
            console.log(`Insufficient security staffing: Day ${dayStaff}, Night ${nightStaff}`);
            this.addVulnerability('V009');
        }
    }
    
    // Emergency Preparedness Analysis
    analyzeEmergencyPreparedness(formData) {
        console.log('Analyzing Emergency Preparedness...');
        
        // Check for emergency policies (HOST V2 field names)
        if (this.checkConditionFlexible(formData, 'secforce_trained_all_plans', 'No') ||
            this.checkConditionFlexible(formData, 'secforce_training_evacuation', 'No')) {
            this.addVulnerability('V004');
        }
        
        // Check for emergency communication
        const secforceReporting = formData.secforce_reporting || 
                                 formData.sections?.security_systems?.secforce_reporting ||
                                 formData.sections?.facility_info?.secforce_reporting;
        const monitoringHours = formData.monitoring_hours || 
                               formData.sections?.security_systems?.monitoring_hours ||
                               formData.sections?.facility_info?.monitoring_hours;
        
        if (secforceReporting === 'None' || monitoringHours === 'None' || 
            !secforceReporting || !monitoringHours) {
            console.log('Insufficient emergency communication systems detected');
            this.addVulnerability('V010');
        }
    }
    
    // Add realistic vulnerability detection based on common security gaps
    analyzeRealisticVulnerabilities(formData) {
        console.log('Analyzing realistic vulnerabilities...');
        
        // Check for common security gaps that even well-secured facilities might have
        
        // 1. Check for insufficient camera coverage
        const cameraCount = parseInt(formData.vss_camera_count) || 0;
        const roomCount = parseInt(formData.guest_room_count) || 0;
        if (cameraCount > 0 && roomCount > 0) {
            const cameraRatio = cameraCount / roomCount;
            if (cameraRatio < 0.2) { // Less than 1 camera per 5 rooms
                console.log(`Insufficient camera coverage: ${cameraCount} cameras for ${roomCount} rooms`);
                this.addVulnerability('V002');
            }
        }
        
        // 2. Check for insufficient security staffing
        const dayStaff = parseInt(formData.secforce_day) || 0;
        const nightStaff = parseInt(formData.secforce_night) || 0;
        const totalRooms = parseInt(formData.guest_room_count) || 0;
        
        if (totalRooms > 0) {
            const dayRatio = dayStaff / totalRooms;
            const nightRatio = nightStaff / totalRooms;
            
            if (dayRatio < 0.02 || nightRatio < 0.01) { // Less than 1 guard per 50 rooms day, 1 per 100 night
                console.log(`Insufficient security staffing ratio: Day ${dayRatio.toFixed(3)}, Night ${nightRatio.toFixed(3)}`);
                this.addVulnerability('V009');
            }
        }
        
        // 3. Check for standoff distance issues
        const minDistance = parseInt(formData.standoff_minimum_distance) || 0;
        if (minDistance > 0 && minDistance < 30) {
            console.log(`Insufficient standoff distance: ${minDistance} feet (recommended: 50+ feet)`);
            this.addVulnerability('V008');
        }
        
        // 4. Check for backup power issues
        if (this.checkConditionFlexible(formData, 'security_backup_power', 'No')) {
            this.addVulnerability('V010');
        }
        
        // 5. Check for integration issues
        if (this.checkConditionFlexible(formData, 'system_integration', 'None') ||
            this.checkConditionFlexible(formData, 'els_integration', 'None')) {
            this.addVulnerability('V005');
        }
        
        // 6. Check for training gaps
        const trainingGaps = [];
        if (this.checkConditionFlexible(formData, 'secforce_training_cyber', 'No')) trainingGaps.push('cybersecurity');
        if (this.checkConditionFlexible(formData, 'secforce_training_bomb', 'No')) trainingGaps.push('bomb threat');
        if (this.checkConditionFlexible(formData, 'secforce_training_medical', 'No')) trainingGaps.push('medical emergency');
        
        if (trainingGaps.length > 1) {
            console.log(`Multiple training gaps identified: ${trainingGaps.join(', ')}`);
            this.addVulnerability('V003');
        }
    }
    
    // VIP Operations Analysis
    analyzeVIPOperations(formData) {
        console.log('Analyzing VIP Operations...');
        
        // Check for VIP security protocols
        if (this.checkConditionFlexible(formData, 'vip_security_protocols', 'inadequate') ||
            this.checkConditionFlexible(formData, 'vip_protection_measures', 'insufficient')) {
            this.addVulnerability('V013');
        }
    }
    
    // Parking Security Analysis
    analyzeParkingSecurity(formData) {
        console.log('Analyzing Parking Security...');
        
        // Check for parking security measures
        if (this.checkConditionFlexible(formData, 'parking_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'parking_access_control', 'insufficient')) {
            this.addVulnerability('V014');
        }
    }
    
    // Recreational Security Analysis
    analyzeRecreationalSecurity(formData) {
        console.log('Analyzing Recreational Security...');
        
        // Check for pool and recreational security
        if (this.checkConditionFlexible(formData, 'pool_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'recreational_security', 'insufficient')) {
            this.addVulnerability('V015');
        }
    }
    
    // Vendor Security Analysis
    analyzeVendorSecurity(formData) {
        console.log('Analyzing Vendor Security...');
        
        // Check for vendor screening
        if (this.checkConditionFlexible(formData, 'vendor_screening', 'inadequate') ||
            this.checkConditionFlexible(formData, 'contractor_security', 'insufficient')) {
            this.addVulnerability('V016');
        }
    }
    
    // Vertical Security Analysis
    analyzeVerticalSecurity(formData) {
        console.log('Analyzing Vertical Security...');
        
        // Check for elevator and stairwell security
        if (this.checkConditionFlexible(formData, 'elevator_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'stairwell_security', 'insufficient')) {
            this.addVulnerability('V017');
        }
    }
    
    // Public Area Security Analysis
    analyzePublicAreaSecurity(formData) {
        console.log('Analyzing Public Area Security...');
        
        // Check for retail and public area security
        if (this.checkConditionFlexible(formData, 'retail_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'public_area_security', 'insufficient')) {
            this.addVulnerability('V018');
        }
    }
    
    // Incident Management Analysis
    analyzeIncidentManagement(formData) {
        console.log('Analyzing Incident Management...');
        
        // Check for incident reporting systems
        if (this.checkConditionFlexible(formData, 'incident_reporting', 'inadequate') ||
            this.checkConditionFlexible(formData, 'security_documentation', 'insufficient')) {
            this.addVulnerability('V019');
        }
    }
    
    // System Redundancy Analysis
    analyzeSystemRedundancy(formData) {
        console.log('Analyzing System Redundancy...');
        
        // Check for backup and redundancy systems
        if (this.checkConditionFlexible(formData, 'system_redundancy', 'inadequate') ||
            this.checkConditionFlexible(formData, 'backup_systems', 'insufficient')) {
            this.addVulnerability('V020');
        }
    }
    
    // Data Protection Analysis
    analyzeDataProtection(formData) {
        console.log('Analyzing Data Protection...');
        
        // Check for data protection measures
        if (this.checkConditionFlexible(formData, 'data_protection', 'inadequate') ||
            this.checkConditionFlexible(formData, 'privacy_measures', 'insufficient')) {
            this.addVulnerability('V021');
        }
    }
    
    // Food Security Analysis
    analyzeFoodSecurity(formData) {
        console.log('Analyzing Food Security...');
        
        // Check for food and beverage security
        if (this.checkConditionFlexible(formData, 'food_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'beverage_security', 'insufficient')) {
            this.addVulnerability('V022');
        }
    }
    
    // Service Area Security Analysis
    analyzeServiceAreaSecurity(formData) {
        console.log('Analyzing Service Area Security...');
        
        // Check for laundry and housekeeping security
        if (this.checkConditionFlexible(formData, 'laundry_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'housekeeping_security', 'insufficient')) {
            this.addVulnerability('V023');
        }
    }
    
    // Infrastructure Security Analysis
    analyzeInfrastructureSecurity(formData) {
        console.log('Analyzing Infrastructure Security...');
        
        // Check for maintenance and utility security
        if (this.checkConditionFlexible(formData, 'maintenance_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'utility_security', 'insufficient')) {
            this.addVulnerability('V024');
        }
    }
    
    // Guest Room Security Analysis
    analyzeGuestRoomSecurity(formData) {
        console.log('Analyzing Guest Room Security...');
        
        // Check for guest room security
        if (this.checkConditionFlexible(formData, 'guest_room_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'room_access_control', 'insufficient')) {
            this.addVulnerability('V025');
        }
    }
    
    // Business Area Security Analysis
    analyzeBusinessAreaSecurity(formData) {
        console.log('Analyzing Business Area Security...');
        
        // Check for conference and meeting room security
        if (this.checkConditionFlexible(formData, 'conference_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'meeting_room_security', 'insufficient')) {
            this.addVulnerability('V026');
        }
    }
    
    // Wellness Security Analysis
    analyzeWellnessSecurity(formData) {
        console.log('Analyzing Wellness Security...');
        
        // Check for spa and wellness security
        if (this.checkConditionFlexible(formData, 'spa_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'wellness_security', 'insufficient')) {
            this.addVulnerability('V027');
        }
    }
    
    // Fitness Security Analysis
    analyzeFitnessSecurity(formData) {
        console.log('Analyzing Fitness Security...');
        
        // Check for fitness center and gym security
        if (this.checkConditionFlexible(formData, 'fitness_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'gym_security', 'insufficient')) {
            this.addVulnerability('V028');
        }
    }
    
    // Office Security Analysis
    analyzeOfficeSecurity(formData) {
        console.log('Analyzing Office Security...');
        
        // Check for business center and office security
        if (this.checkConditionFlexible(formData, 'business_center_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'office_security', 'insufficient')) {
            this.addVulnerability('V029');
        }
    }
    
    // Children Security Analysis
    analyzeChildrenSecurity(formData) {
        console.log('Analyzing Children Security...');
        
        // Check for children's area and family security
        if (this.checkConditionFlexible(formData, 'children_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'family_security', 'insufficient')) {
            this.addVulnerability('V030');
        }
    }
    
    // Operational Security Analysis
    analyzeOperationalSecurity(formData) {
        console.log('Analyzing Operational Security...');
        
        // Check for operational security and business continuity
        if (this.checkConditionFlexible(formData, 'operational_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'business_continuity', 'insufficient')) {
            this.addVulnerability('V031');
        }
    }
    
    // Guest Services Security Analysis
    analyzeGuestServicesSecurity(formData) {
        console.log('Analyzing Guest Services Security...');
        
        // Check for guest services and concierge security
        if (this.checkConditionFlexible(formData, 'guest_services_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'concierge_security', 'insufficient')) {
            this.addVulnerability('V032');
        }
    }
    
    // Transportation Security Analysis
    analyzeTransportationSecurity(formData) {
        console.log('Analyzing Transportation Security...');
        
        // Check for transportation and valet security
        if (this.checkConditionFlexible(formData, 'transportation_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'valet_security', 'insufficient')) {
            this.addVulnerability('V033');
        }
    }
    
    // Event Security Analysis
    analyzeEventSecurity(formData) {
        console.log('Analyzing Event Security...');
        
        // Check for event and banquet security
        if (this.checkConditionFlexible(formData, 'event_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'banquet_security', 'insufficient')) {
            this.addVulnerability('V034');
        }
    }
    
    // Entertainment Security Analysis
    analyzeEntertainmentSecurity(formData) {
        console.log('Analyzing Entertainment Security...');
        
        // Check for nightclub and entertainment security
        if (this.checkConditionFlexible(formData, 'nightclub_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'entertainment_security', 'insufficient')) {
            this.addVulnerability('V035');
        }
    }
    
    // Gaming Security Analysis
    analyzeGamingSecurity(formData) {
        console.log('Analyzing Gaming Security...');
        
        // Check for casino and gaming security
        if (this.checkConditionFlexible(formData, 'casino_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'gaming_security', 'insufficient')) {
            this.addVulnerability('V036');
        }
    }
    
    // Retail Security Analysis
    analyzeRetailSecurity(formData) {
        console.log('Analyzing Retail Security...');
        
        // Check for retail and shopping security
        if (this.checkConditionFlexible(formData, 'retail_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'shopping_security', 'insufficient')) {
            this.addVulnerability('V037');
        }
    }
    
    // Medical Security Analysis
    analyzeMedicalSecurity(formData) {
        console.log('Analyzing Medical Security...');
        
        // Check for medical and health services security
        if (this.checkConditionFlexible(formData, 'medical_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'health_services_security', 'insufficient')) {
            this.addVulnerability('V038');
        }
    }
    
    // Environmental Security Analysis
    analyzeEnvironmentalSecurity(formData) {
        console.log('Analyzing Environmental Security...');
        
        // Check for environmental and sustainability security
        if (this.checkConditionFlexible(formData, 'environmental_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'sustainability_security', 'insufficient')) {
            this.addVulnerability('V039');
        }
    }
    
    // International Security Analysis
    analyzeInternationalSecurity(formData) {
        console.log('Analyzing International Security...');
        
        // Check for international and cultural security
        if (this.checkConditionFlexible(formData, 'international_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'cultural_security', 'insufficient')) {
            this.addVulnerability('V040');
        }
    }
    
    // VIP Transportation Security Analysis
    analyzeVIPTransportationSecurity(formData) {
        console.log('Analyzing VIP Transportation Security...');
        
        // Check for VIP transportation security protocols
        if (this.checkConditionFlexible(formData, 'vip_transportation_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'vehicle_screening', 'insufficient')) {
            this.addVulnerability('V041');
        }
    }
    
    // Recreational Area Security Analysis
    analyzeRecreationalAreaSecurity(formData) {
        console.log('Analyzing Recreational Area Security...');
        
        // Check for recreational area access control
        if (this.checkConditionFlexible(formData, 'recreational_access_control', 'inadequate') ||
            this.checkConditionFlexible(formData, 'pool_security', 'insufficient')) {
            this.addVulnerability('V042');
        }
    }
    
    // Vendor Security Analysis
    analyzeVendorSecurity(formData) {
        console.log('Analyzing Vendor Security...');
        
        // Check for vendor security screening
        if (this.checkConditionFlexible(formData, 'vendor_background_checks', 'inadequate') ||
            this.checkConditionFlexible(formData, 'contractor_screening', 'insufficient')) {
            this.addVulnerability('V043');
        }
    }
    
    // Vertical Circulation Security Analysis
    analyzeVerticalCirculationSecurity(formData) {
        console.log('Analyzing Vertical Circulation Security...');
        
        // Check for vertical circulation security
        if (this.checkConditionFlexible(formData, 'elevator_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'stairwell_security', 'insufficient')) {
            this.addVulnerability('V044');
        }
    }
    
    // Public Area Security Analysis
    analyzePublicAreaSecurity(formData) {
        console.log('Analyzing Public Area Security...');
        
        // Check for public area monitoring
        if (this.checkConditionFlexible(formData, 'public_area_monitoring', 'inadequate') ||
            this.checkConditionFlexible(formData, 'lobby_security', 'insufficient')) {
            this.addVulnerability('V045');
        }
    }
    
    // Incident Management Analysis
    analyzeIncidentManagement(formData) {
        console.log('Analyzing Incident Management...');
        
        // Check for incident management protocols
        if (this.checkConditionFlexible(formData, 'incident_management', 'inadequate') ||
            this.checkConditionFlexible(formData, 'crisis_response', 'insufficient')) {
            this.addVulnerability('V046');
        }
    }
    
    // System Redundancy Analysis
    analyzeSystemRedundancy(formData) {
        console.log('Analyzing System Redundancy...');
        
        // Check for system redundancy
        if (this.checkConditionFlexible(formData, 'system_redundancy', 'inadequate') ||
            this.checkConditionFlexible(formData, 'backup_procedures', 'insufficient')) {
            this.addVulnerability('V047');
        }
    }
    
    // Data Protection Analysis
    analyzeDataProtection(formData) {
        console.log('Analyzing Data Protection...');
        
        // Check for data protection measures
        if (this.checkConditionFlexible(formData, 'data_protection', 'inadequate') ||
            this.checkConditionFlexible(formData, 'privacy_measures', 'insufficient')) {
            this.addVulnerability('V048');
        }
    }
    
    // Food Security Analysis
    analyzeFoodSecurity(formData) {
        console.log('Analyzing Food Security...');
        
        // Check for food security protocols
        if (this.checkConditionFlexible(formData, 'food_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'kitchen_security', 'insufficient')) {
            this.addVulnerability('V049');
        }
    }
    
    // Service Area Security Analysis
    analyzeServiceAreaSecurity(formData) {
        console.log('Analyzing Service Area Security...');
        
        // Check for service area security
        if (this.checkConditionFlexible(formData, 'service_area_security', 'inadequate') ||
            this.checkConditionFlexible(formData, 'operational_security', 'insufficient')) {
            this.addVulnerability('V050');
        }
    }
    
    // Helper function to check form conditions
    checkCondition(formData, field, expectedValue) {
        if (!formData || !formData[field]) {
            console.log(`Field ${field} not found or empty in form data`);
            return false;
        }
        const fieldValue = formData[field];
        const matches = fieldValue === expectedValue || fieldValue === 'No' || fieldValue === 'None';
        console.log(`Checking ${field}: ${fieldValue} === ${expectedValue} or 'No' or 'None' = ${matches}`);
        return matches;
    }
    
    // More flexible condition checking for real-world data
    checkConditionFlexible(formData, field, expectedValue) {
        if (!formData || !formData[field]) {
            console.log(`Field ${field} not found or empty in form data`);
            return false;
        }
        const fieldValue = formData[field];
        
        // Check for various "negative" values that indicate vulnerabilities
        const negativeValues = ['No', 'None', '0', 'false', 'False', 'N/A', 'n/a', '', 'Not Available'];
        const isNegative = negativeValues.includes(fieldValue) || 
                          fieldValue.toLowerCase().includes('no') || 
                          fieldValue.toLowerCase().includes('none') ||
                          fieldValue.toLowerCase().includes('not');
        
        console.log(`Flexible check ${field}: ${fieldValue} (isNegative: ${isNegative})`);
        return isNegative;
    }
    
    // Add vulnerability to detected list
    addVulnerability(vNumber) {
        const vulnerability = window.VOFC_VULNERABILITIES.find(v => v.v_number === vNumber);
        if (vulnerability && !this.detectedVulnerabilities.find(v => v.v_number === vNumber)) {
            this.detectedVulnerabilities.push(vulnerability);
            console.log('Added vulnerability:', vNumber, vulnerability.vulnerability_text);
            
            // Add corresponding options
            this.addOptionsForVulnerability(vNumber);
        } else if (!vulnerability) {
            console.error('Vulnerability not found:', vNumber);
        }
    }
    
    // Add options for specific vulnerability
    addOptionsForVulnerability(vNumber) {
        const options = window.VOFC_OPTIONS.filter(o => o.vulnerability_id === vNumber);
        options.forEach(option => {
            if (!this.recommendedOptions.find(o => o.ofc_number === option.ofc_number)) {
                this.recommendedOptions.push(option);
                console.log('Added option:', option.ofc_number, option.option_text.substring(0, 50) + '...');
            }
        });
    }
    
    // Calculate overall security score
    calculateOverallScore(formData) {
        let score = 0;
        let maxScore = 100;
        
        // Physical Security (25 points)
        if (formData.perimeter_fencing === 'Yes') score += 10;
        if (formData.perimeter_lighting === 'adequate') score += 10;
        if (formData.standoff_distance === 'adequate') score += 5;
        
        // Technology (25 points)
        if (formData.vss_present === 'Yes') score += 15;
        if (formData.vss_monitoring === 'live_monitored') score += 10;
        
        // Access Control (25 points)
        if (formData.access_control_system === 'Yes') score += 15;
        if (formData.visitor_management === 'Yes') score += 10;
        
        // Personnel Security (25 points)
        if (formData.security_personnel === 'Yes') score += 15;
        if (formData.staff_training === 'comprehensive') score += 10;
        
        return Math.round((score / maxScore) * 100);
    }
    
    // Calculate category scores
    calculateCategoryScores(formData) {
        return {
            physical: this.calculatePhysicalScore(formData),
            technology: this.calculateTechnologyScore(formData),
            access: this.calculateAccessScore(formData),
            personnel: this.calculatePersonnelScore(formData),
            emergency: this.calculateEmergencyScore(formData)
        };
    }
    
    calculatePhysicalScore(formData) {
        let score = 0;
        if (formData.perimeter_fencing === 'Yes') score += 40;
        if (formData.perimeter_lighting === 'adequate') score += 30;
        if (formData.standoff_distance === 'adequate') score += 30;
        return Math.min(score, 100);
    }
    
    calculateTechnologyScore(formData) {
        let score = 0;
        if (formData.vss_present === 'Yes') score += 60;
        if (formData.vss_monitoring === 'live_monitored') score += 40;
        return Math.min(score, 100);
    }
    
    calculateAccessScore(formData) {
        let score = 0;
        if (formData.access_control_system === 'Yes') score += 60;
        if (formData.visitor_management === 'Yes') score += 40;
        return Math.min(score, 100);
    }
    
    calculatePersonnelScore(formData) {
        let score = 0;
        if (formData.security_personnel === 'Yes') score += 60;
        if (formData.staff_training === 'comprehensive') score += 40;
        return Math.min(score, 100);
    }
    
    calculateEmergencyScore(formData) {
        let score = 0;
        if (formData.emergency_policies === 'Yes') score += 50;
        if (formData.emergency_communication === 'adequate') score += 50;
        return Math.min(score, 100);
    }
    
    // Get vulnerabilities by severity
    getVulnerabilitiesBySeverity(severity) {
        return this.detectedVulnerabilities.filter(v => v.severity === severity);
    }
    
    // Get options by priority
    getOptionsByPriority(priority) {
        return this.recommendedOptions.filter(o => o.priority === priority);
    }
    
    // Get summary statistics
    getSummaryStats() {
        return {
            totalVulnerabilities: this.detectedVulnerabilities.length,
            criticalVulnerabilities: this.getVulnerabilitiesBySeverity('Critical').length,
            highVulnerabilities: this.getVulnerabilitiesBySeverity('High').length,
            mediumVulnerabilities: this.getVulnerabilitiesBySeverity('Medium').length,
            totalOptions: this.recommendedOptions.length,
            criticalOptions: this.getOptionsByPriority('Critical').length,
            highOptions: this.getOptionsByPriority('High').length,
            mediumOptions: this.getOptionsByPriority('Medium').length
        };
    }

    // Enhanced condition checking with fuzzy field mapping
    checkConditionWithFuzzyMapping(formData, vulnerabilityId, expectedValue) {
        if (!window.fuzzyFieldMapper) {
            console.log('Fuzzy field mapper not available, falling back to standard check');
            return false;
        }

        const mappings = window.fuzzyFieldMapper.getFieldMappingsForMatcher();
        const fields = mappings[vulnerabilityId] || [];
        
        for (const field of fields) {
            if (formData[field]) {
                const fieldValue = formData[field];
                const matches = fieldValue === expectedValue || fieldValue === 'No' || fieldValue === 'None' || 
                               fieldValue === 'inadequate' || fieldValue === 'insufficient' || 
                               fieldValue === 'not_required' || fieldValue === 'pending';
                
                if (matches) {
                    console.log(`Fuzzy mapping found match for ${vulnerabilityId}: ${field} = ${fieldValue}`);
                    return true;
                }
            }
        }
        
        console.log(`No fuzzy mapping matches found for ${vulnerabilityId}`);
        return false;
    }

    // Get vulnerability by ID with proper fallback
    getVulnerabilityById(vNumber) {
        const vuln = window.VOFC_VULNERABILITIES.find(v => v.v_number === vNumber);
        if (vuln) {
            return {
                vofc_id: vuln.v_number,
                title: vuln.vulnerability_text,
                description: vuln.description,
                impact: vuln.risk_impact,
                severity: vuln.severity,
                category: vuln.category,
                compliance_gap: vuln.compliance_gap,
                attack_vectors: vuln.attack_vectors,
                standards_reference: vuln.standards_reference
            };
        }
        return null;
    }

    // Get options for vulnerability with proper fallback
    getOptionsForVulnerability(vNumber) {
        const options = window.VOFC_OPTIONS.filter(o => o.vulnerability_id === vNumber);
        return options.map(option => option.option_text);
    }
}

// Initialize global instance
window.VOFCVulnerabilityMatcher = VOFCVulnerabilityMatcher;
window.vofcMatcher = new VOFCVulnerabilityMatcher();

console.log('VOFC Vulnerability Matcher class loaded and initialized');
