// FIFA World Cup Hotel Hosting Standards
// Comprehensive mapping of FIFA requirements to form fields

function fifaAnswerYes(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isAffirmativeYes) {
        return HostAnswerNormalize.isAffirmativeYes(v);
    }
    return String(v ?? '').trim().toLowerCase() === 'yes';
}
function fifaAnswerNo(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isNegativeResponse) {
        return HostAnswerNormalize.isNegativeResponse(v);
    }
    const n = String(v ?? '').trim().toLowerCase();
    return n === 'no' || n === 'false' || n === '0' || n === 'none' || n === 'n/a' || n === 'na';
}

class FIFAStandardsMapper {
    constructor() {
        this.fifaStandards = this.createFIFAStandards();
        this.fifaMappings = this.createFIFAMappings();
    }

    // Create FIFA World Cup hosting standards
    createFIFAStandards() {
        return {
            'Accommodation Capacity': {
                description: 'Minimum room capacity for FIFA World Cup hosting',
                guidelines: {
                    'guest_room_count': { min: 1000, ideal: 2000, critical: true },
                    'number_of_floors': { min: 5, ideal: 10, critical: false },
                    'has_13th_floor': { required: false, note: 'Cultural consideration' }
                },
                standards: ['FIFA World Cup Requirements', 'FIFA Club World Cup Standards']
            },
            'Hotel Classification': {
                description: 'Minimum hotel star rating and classification',
                guidelines: {
                    'hotel_classification': { min: 4, ideal: 5, critical: true },
                    'hotel_website': { required: true, critical: false }
                },
                standards: ['FIFA Hotel Standards', 'International Hotel Classification']
            },
            'Security Systems': {
                description: 'Comprehensive security system requirements',
                guidelines: {
                    'vss_present': { required: true, critical: true },
                    'vss_camera_count': { min: 50, ideal: 100, critical: true },
                    'vss_retention': { min: 30, ideal: 90, critical: true },
                    'els_present': { required: true, critical: true },
                    'soc_present': { required: true, critical: true },
                    'monitoring_hours': { required: '24/7', critical: true }
                },
                standards: ['FIFA Security Requirements', 'International Security Standards']
            },
            'CISA ISC Security System Integration': {
                description: 'Comprehensive security system integration following CISA ISC best practices',
                guidelines: {
                    'comprehensive_risk_assessment': { required: true, critical: true, note: 'Evaluate threats and vulnerabilities' },
                    'layered_security_approach': { required: true, critical: true, note: 'Multiple overlapping defenses' },
                    'access_control_implementation': { required: true, critical: true, note: 'Multi-factor authentication' },
                    'perimeter_security_enhancement': { required: true, critical: true, note: 'Strengthen barriers and monitoring' },
                    'regular_training_drills': { required: true, critical: true, note: 'Ensure staff readiness and response' }
                },
                standards: ['CISA ISC Best Practices', 'Federal Physical Security Standards'],
                integrationSteps: [
                    'Comprehensive Risk Assessment - Evaluate threats and vulnerabilities',
                    'Layered Security Approach - Implement multiple overlapping defenses', 
                    'Access Control Implementation - Establish multi-factor authentication',
                    'Perimeter Security Enhancement - Strengthen barriers and monitoring',
                    'Regular Training and Drills - Ensure staff readiness and response'
                ]
            },
            'Physical Security': {
                description: 'Physical security and perimeter protection',
                guidelines: {
                    'has_perimeter_barriers': { required: true, critical: true },
                    'standoff_street_distance': { min: 25, ideal: 50, critical: true },
                    'vehicle_barrier_rating': { min: 'K8', ideal: 'K12', critical: true },
                    'surface_parking_lighting': { min: 'Good', ideal: 'Excellent', critical: false },
                    'garage_parking_lighting': { min: 'Good', ideal: 'Excellent', critical: false }
                },
                standards: ['FIFA Physical Security Standards', 'DHS Protective Security Advisors']
            },
            'Security Personnel': {
                description: 'Security force requirements and capabilities',
                guidelines: {
                    'secforce_247': { required: true, critical: true },
                    'secforce_armed': { required: true, critical: true },
                    'secforce_response_time': { max: '2 minutes', ideal: '1 minute', critical: true },
                    'secforce_training_active_shooter': { required: true, critical: true },
                    'secforce_training_medical': { required: true, critical: true }
                },
                standards: ['FIFA Security Force Requirements', 'ASIS International Guidelines']
            },
            'Access Control': {
                description: 'Access control and entry management',
                guidelines: {
                    'els_integration': { required: 'Fully Integrated', critical: true },
                    'vip_entrance_type': { required: 'Dedicated', critical: false },
                    'vip_access_control': { required: 'Key Card', critical: false }
                },
                standards: ['FIFA Access Control Standards', 'Electronic Security Systems']
            },
            'Emergency Preparedness': {
                description: 'Emergency response and preparedness',
                guidelines: {
                    'emergency_agency': { required: true, critical: true },
                    'fire_panel_location': { required: true, critical: true },
                    'secforce_training_evacuation': { required: true, critical: true },
                    'secforce_training_bomb': { required: true, critical: true }
                },
                standards: ['FIFA Emergency Preparedness', 'International Emergency Standards']
            },
            'Facility Amenities': {
                description: 'Required facility amenities and services',
                guidelines: {
                    'has_pool': { required: true, critical: false },
                    'pool_lifeguard': { required: true, critical: false },
                    'has_ev_charging': { required: true, critical: false },
                    'has_parking': { required: true, critical: true },
                    'surface_parking_spaces': { min: 100, ideal: 200, critical: false }
                },
                standards: ['FIFA Facility Requirements', 'International Hotel Standards']
            },
            'Technology Infrastructure': {
                description: 'Technology and communication requirements',
                guidelines: {
                    'system_integration': { required: 'Fully Integrated', critical: true },
                    'security_backup_power': { required: true, critical: true },
                    'vss_network_segmentation': { required: true, critical: false }
                },
                standards: ['FIFA Technology Standards', 'International IT Security']
            },
            'VIP Operations & Lodging Standards': {
                description: 'FIFA VIP accommodation and security requirements for World Cup hosting',
                guidelines: {
                    // VIP Access Control
                    'vip_entrance_type': { required: 'Dedicated VIP Entrance', critical: true },
                    'vip_access_control': { required: 'Electronic Access Control', critical: true },
                    'vip_vehicle_access': { required: 'Secure Vehicle Access', critical: true },
                    'vip_vss_coverage': { required: 'Full Coverage', critical: true },
                    
                    // Restricted Areas
                    'restricted_area_type': { required: 'VIP Suite, Executive Floor', critical: true },
                    'restricted_access_control': { required: 'Biometric or Key Card', critical: true },
                    'restricted_elevator_access': { required: 'Yes', critical: true },
                    'restricted_vss_coverage': { required: 'Full', critical: true },
                    'restricted_monitoring_type': { required: '24/7 Security Guard', critical: true },
                    
                    // Retail & Commercial Spaces
                    'retail_entrance_type': { required: 'Controlled Access', critical: false },
                    'retail_door_lock_tech': { required: 'Electronic Locking', critical: false },
                    'retail_restrictable_access': { required: 'Yes', critical: true },
                    'retail_vss_coverage': { required: 'Full', critical: true },
                    
                    // VIP Transportation & Logistics
                    'vip_vehicle_screening': { required: 'Full Security Sweep', critical: true },
                    'vip_parking_type': { required: 'Dedicated VIP Parking', critical: true },
                    'vip_escort_services': { required: '24/7 Dedicated Escort', critical: true },
                    'vip_transport_coordination': { required: 'In-House Transportation', critical: true },
                    
                    // VIP Communication Systems
                    'vip_communication_channels': { required: 'Dedicated VIP Hotline', critical: true },
                    'vip_emergency_contact': { required: '24/7 VIP Emergency Line', critical: true },
                    'vip_alert_systems': { required: 'Dedicated VIP Alert System', critical: true },
                    'vip_communication_equipment': { required: 'Dedicated VIP Radios', critical: true },
                    
                    // VIP Staff & Personnel
                    'vip_staff_training': { required: 'Specialized VIP Training', critical: true },
                    'vip_staff_background_checks': { required: 'Enhanced Background Checks', critical: true },
                    'vip_security_personnel': { required: 'Dedicated VIP Security Team', critical: true },
                    'vip_service_staff': { required: 'Dedicated VIP Service Staff', critical: true },
                    
                    // VIP Emergency Procedures
                    'vip_evacuation_procedures': { required: 'Dedicated VIP Evacuation Plan', critical: true },
                    'vip_medical_emergency': { required: 'Dedicated VIP Medical Team', critical: true },
                    'vip_security_incident': { required: 'Dedicated VIP Security Response', critical: true },
                    'vip_emergency_communication': { required: 'Dedicated VIP Emergency Line', critical: true },
                    
                    // VIP Technology & Systems
                    'vip_access_control_systems': { required: 'Dedicated VIP Access Control', critical: true },
                    'vip_monitoring_surveillance': { required: 'Dedicated VIP Monitoring', critical: true },
                    'vip_communication_tech': { required: 'Advanced Communication Systems', critical: true },
                    'vip_technology_integration': { required: 'Fully Integrated VIP Systems', critical: true }
                },
                standards: ['FIFA VIP Accommodation Standards', 'FIFA World Cup Hosting Requirements', 'FIFA Club World Cup VIP Standards', 'International VIP Security Protocols']
            }
        };
    }

    // Create FIFA field mappings for vulnerability analysis
    createFIFAMappings() {
        return {
            // Accommodation Capacity
            'guest_room_count': {
                intent: 'FIFA minimum room capacity for World Cup hosting',
                standard: 'FIFA-Accommodation Capacity',
                expected: '>= 1000',
                vulnerability_if: '< 1000',
                severity: 'High',
                category: 'FIFA-Accommodation Capacity',
                fifa_critical: true
            },
            'number_of_floors': {
                intent: 'FIFA minimum floor count for World Cup hosting',
                standard: 'FIFA-Accommodation Capacity',
                expected: '>= 5',
                vulnerability_if: '< 5',
                severity: 'Medium',
                category: 'FIFA-Accommodation Capacity',
                fifa_critical: false
            },

            // Security Systems
            'vss_present': {
                intent: 'FIFA guideline for video surveillance system',
                standard: 'FIFA-Security Systems',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },
            'vss_camera_count': {
                intent: 'FIFA guideline for adequate camera coverage',
                standard: 'FIFA-Security Systems',
                expected: '>= 50',
                vulnerability_if: '< 50',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },
            'vss_retention': {
                intent: 'FIFA guideline for video retention period',
                standard: 'FIFA-Security Systems',
                expected: '>= 30',
                vulnerability_if: '< 30',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },
            'els_present': {
                intent: 'FIFA guideline for electronic locking system',
                standard: 'FIFA-Security Systems',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },
            'soc_present': {
                intent: 'FIFA guideline for security operations center',
                standard: 'FIFA-Security Systems',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },
            'monitoring_hours': {
                intent: 'FIFA guideline for 24/7 security monitoring',
                standard: 'FIFA-Security Systems',
                expected: '24/7',
                vulnerability_if: 'Business Hours',
                severity: 'High',
                category: 'FIFA-Security Systems',
                fifa_critical: true
            },

            // Physical Security
            'has_perimeter_barriers': {
                intent: 'FIFA guideline for perimeter barrier protection',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_street_distance': {
                intent: 'FIFA guideline for adequate standoff distance',
                standard: 'FIFA-Physical Security',
                expected: '>= 25',
                vulnerability_if: '< 25',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'vehicle_barrier_rating': {
                intent: 'FIFA guideline for vehicle barrier rating',
                standard: 'FIFA-Physical Security',
                expected: 'K12',
                vulnerability_if: 'K4',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },

            // Security Personnel
            'secforce_247': {
                intent: 'FIFA guideline for 24/7 security force',
                standard: 'FIFA-Security Personnel',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Personnel',
                fifa_critical: true
            },
            'secforce_armed': {
                intent: 'FIFA guideline for armed security capability',
                standard: 'FIFA-Security Personnel',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Personnel',
                fifa_critical: true
            },
            'secforce_response_time': {
                intent: 'FIFA guideline for quick security response',
                standard: 'FIFA-Security Personnel',
                expected: '<= 2 minutes',
                vulnerability_if: '> 5 minutes',
                severity: 'High',
                category: 'FIFA-Security Personnel',
                fifa_critical: true
            },
            'secforce_training_active_shooter': {
                intent: 'FIFA guideline for active shooter training',
                standard: 'FIFA-Security Personnel',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Personnel',
                fifa_critical: true
            },

            // Access Control
            'els_integration': {
                intent: 'FIFA guideline for integrated access control',
                standard: 'FIFA-Access Control',
                expected: 'Fully Integrated',
                vulnerability_if: 'Basic',
                severity: 'High',
                category: 'FIFA-Access Control',
                fifa_critical: true
            },
            'vip_entrance_type': {
                intent: 'FIFA guideline for VIP access control',
                standard: 'FIFA-Access Control',
                expected: 'Dedicated',
                vulnerability_if: 'None',
                severity: 'Medium',
                category: 'FIFA-Access Control',
                fifa_critical: false
            },

            // Emergency Preparedness
            'emergency_agency': {
                intent: 'FIFA guideline for emergency response coordination',
                standard: 'FIFA-Emergency Preparedness',
                expected: 'Local Police/Fire',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'FIFA-Emergency Preparedness',
                fifa_critical: true
            },
            'fire_panel_location': {
                intent: 'FIFA guideline for fire safety systems',
                standard: 'FIFA-Emergency Preparedness',
                expected: 'Main Lobby',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'FIFA-Emergency Preparedness',
                fifa_critical: true
            },

            // Facility Amenities
            'has_pool': {
                intent: 'FIFA guideline for recreational facilities',
                standard: 'FIFA-Facility Amenities',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'pool_lifeguard': {
                intent: 'FIFA guideline for pool safety',
                standard: 'FIFA-Facility Amenities',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'has_ev_charging': {
                intent: 'FIFA guideline for electric vehicle charging',
                standard: 'FIFA-Facility Amenities',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'has_parking': {
                intent: 'FIFA guideline for adequate parking',
                standard: 'FIFA-Facility Amenities',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Facility Amenities',
                fifa_critical: true
            },

            // Technology Infrastructure
            'system_integration': {
                intent: 'FIFA guideline for integrated security systems',
                standard: 'FIFA-Technology Infrastructure',
                expected: 'Fully Integrated',
                vulnerability_if: 'Standalone Systems',
                severity: 'High',
                category: 'FIFA-Technology Infrastructure',
                fifa_critical: true
            },
            'security_backup_power': {
                intent: 'FIFA guideline for backup power systems',
                standard: 'FIFA-Technology Infrastructure',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Technology Infrastructure',
                fifa_critical: true
            },
            
            // VIP Operations & Lodging Standards
            'vip_entrance_type': {
                intent: 'Standard entrance usage by VIPs creates security vulnerabilities and operational disruptions during high-profile events, potentially compromising guest safety and hotel reputation',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Entrance',
                vulnerability_if: 'Standard Entrance',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_access_control': {
                intent: 'Manual access control systems create security gaps and operational delays, potentially compromising VIP safety and hotel security protocols',
                standard: 'FIFA-VIP Operations',
                expected: 'Electronic Access Control',
                vulnerability_if: 'Key or Manual',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_vehicle_access': {
                intent: 'Unrestricted vehicle access creates significant security vulnerabilities and operational risks, potentially allowing unauthorized vehicles to approach VIP areas',
                standard: 'FIFA-VIP Operations',
                expected: 'Secure Vehicle Access',
                vulnerability_if: 'Unrestricted',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_vss_coverage': {
                intent: 'Insufficient surveillance coverage creates blind spots that compromise security monitoring and incident response capabilities, potentially delaying emergency response',
                standard: 'FIFA-VIP Operations',
                expected: 'Full Coverage',
                vulnerability_if: 'Partial or None',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'restricted_area_type': {
                intent: 'Standard room accommodations for VIPs fail to meet security requirements and guest expectations, potentially damaging hotel reputation and guest satisfaction',
                standard: 'FIFA-VIP Operations',
                expected: 'VIP Suite, Executive Floor',
                vulnerability_if: 'Standard Rooms Only',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'restricted_access_control': {
                intent: 'Manual key systems create security vulnerabilities and operational inefficiencies, limiting access tracking and emergency response capabilities',
                standard: 'FIFA-VIP Operations',
                expected: 'Electronic Key Card',
                vulnerability_if: 'Key or Manual',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'restricted_elevator_access': {
                intent: 'Controlled elevator access prevents unauthorized entry to VIP floors and restricted areas',
                standard: 'FIFA-VIP Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'restricted_vss_coverage': {
                intent: 'Complete surveillance coverage enables comprehensive monitoring of all restricted access points',
                standard: 'FIFA-VIP Operations',
                expected: 'Full',
                vulnerability_if: 'Partial or None',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'restricted_monitoring_type': {
                intent: 'Human security presence provides immediate response capability and deters potential threats',
                standard: 'FIFA-VIP Operations',
                expected: '24/7 Security Guard',
                vulnerability_if: 'Motion Sensors Only',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'retail_restrictable_access': {
                intent: 'Flexible retail space control allows for enhanced security during high-profile events',
                standard: 'FIFA-VIP Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-VIP Operations',
                fifa_critical: false
            },
            'retail_vss_coverage': {
                intent: 'Comprehensive retail surveillance supports both security and operational oversight',
                standard: 'FIFA-VIP Operations',
                expected: 'Full',
                vulnerability_if: 'Partial or None',
                severity: 'Medium',
                category: 'FIFA-VIP Operations',
                fifa_critical: false
            },
            'vip_vehicle_screening': {
                intent: 'Thorough vehicle screening protocols protect against potential security threats',
                standard: 'FIFA-VIP Operations',
                expected: 'Full Security Sweep',
                vulnerability_if: 'Visual Inspection Only',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_type': {
                intent: 'Dedicated VIP parking ensures secure vehicle storage and controlled access',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Parking',
                vulnerability_if: 'Standard Parking',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_escort_services': {
                intent: 'Continuous escort services provide immediate assistance and enhanced VIP protection',
                standard: 'FIFA-VIP Operations',
                expected: '24/7 Dedicated Escort',
                vulnerability_if: 'On-Demand Only',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_communication_channels': {
                intent: 'FIFA requirement for dedicated VIP communication channels',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Hotline',
                vulnerability_if: 'Standard Hotel Systems',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_emergency_contact': {
                intent: 'FIFA requirement for 24/7 VIP emergency contact system',
                standard: 'FIFA-VIP Operations',
                expected: '24/7 VIP Emergency Line',
                vulnerability_if: 'Standard Emergency Services',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_staff_training': {
                intent: 'FIFA requirement for specialized VIP staff training',
                standard: 'FIFA-VIP Operations',
                expected: 'Specialized VIP Training',
                vulnerability_if: 'Standard Hotel Training',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_staff_background_checks': {
                intent: 'FIFA requirement for enhanced background checks for VIP staff',
                standard: 'FIFA-VIP Operations',
                expected: 'Enhanced Background Checks',
                vulnerability_if: 'Standard Background Checks',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_security_personnel': {
                intent: 'FIFA requirement for dedicated VIP security team',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Security Team',
                vulnerability_if: 'Standard Security Personnel',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_evacuation_procedures': {
                intent: 'FIFA requirement for dedicated VIP evacuation procedures',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Evacuation Plan',
                vulnerability_if: 'Standard Evacuation Plan',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_medical_emergency': {
                intent: 'FIFA requirement for dedicated VIP medical emergency team',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Medical Team',
                vulnerability_if: 'Standard Medical Services',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_access_control_systems': {
                intent: 'FIFA requirement for dedicated VIP access control systems',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Access Control',
                vulnerability_if: 'Standard Access Control',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_monitoring_surveillance': {
                intent: 'FIFA requirement for dedicated VIP monitoring and surveillance',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Monitoring',
                vulnerability_if: 'Standard Monitoring',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_technology_integration': {
                intent: 'FIFA requirement for fully integrated VIP technology systems',
                standard: 'FIFA-VIP Operations',
                expected: 'Fully Integrated VIP Systems',
                vulnerability_if: 'Basic Technology Integration',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },

            // Security Force Operations
            'secforce_type': {
                intent: 'Inadequate security force staffing creates operational vulnerabilities and limits incident response capabilities, potentially compromising guest safety and hotel security',
                standard: 'FIFA-Security Operations',
                expected: 'Professional Security Force',
                vulnerability_if: 'No Security Force, Volunteer Only',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_day': {
                intent: 'Insufficient daytime security coverage creates security gaps during peak operational hours, limiting incident prevention and response capabilities',
                standard: 'FIFA-Security Operations',
                expected: '>= 4',
                vulnerability_if: '< 4',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_night': {
                intent: 'Inadequate nighttime security staffing creates significant vulnerabilities during high-risk hours when incidents are more likely to occur',
                standard: 'FIFA-Security Operations',
                expected: '>= 2',
                vulnerability_if: '< 2',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_unarmed': {
                intent: 'Unarmed security personnel have limited response capabilities during serious incidents, potentially compromising guest safety and security effectiveness',
                standard: 'FIFA-Security Operations',
                expected: 'Armed Security',
                vulnerability_if: 'Unarmed Only',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_training_cyber': {
                intent: 'Lack of cybersecurity training creates vulnerabilities in digital security systems and may compromise guest data protection and hotel network security',
                standard: 'FIFA-Security Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_training_deescalation': {
                intent: 'Insufficient de-escalation training increases risk of security incidents escalating unnecessarily, potentially causing guest complaints and liability issues',
                standard: 'FIFA-Security Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Security Operations',
                fifa_critical: false
            },
            'secforce_certs': {
                intent: 'Uncertified security personnel lack proper training and credentials, potentially compromising security effectiveness and creating liability exposure',
                standard: 'FIFA-Security Operations',
                expected: 'Certified Personnel',
                vulnerability_if: 'No Certifications',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },
            'secforce_patrol_foot': {
                intent: 'Foot patrol coverage provides essential security presence and incident prevention capabilities in guest areas and restricted zones',
                standard: 'FIFA-Security Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Security Operations',
                fifa_critical: false
            },
            'secforce_patrol_vehicle': {
                intent: 'Vehicle patrol capabilities enhance security coverage and emergency response times across large hotel properties',
                standard: 'FIFA-Security Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Security Operations',
                fifa_critical: false
            },
            'secforce_surge_capacity': {
                intent: 'Lack of surge capacity limits ability to respond to major incidents or high-profile events, potentially compromising security during critical periods',
                standard: 'FIFA-Security Operations',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Security Operations',
                fifa_critical: true
            },

            // Standoff Measures - Physical Security
            'has_standoff_measures': {
                intent: 'Lack of standoff measures creates vulnerability to vehicle-borne threats and unauthorized access, potentially compromising guest safety and hotel security',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_minimum_distance': {
                intent: 'Insufficient standoff distance creates vulnerability to blast effects and vehicle ramming attacks, potentially causing catastrophic damage and guest casualties',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 25 feet',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_vehicle_barriers': {
                intent: 'Lack of vehicle barriers creates vulnerability to unauthorized vehicle access and potential vehicle-borne attacks, compromising perimeter security',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_bollard_type': {
                intent: 'Inadequate bollard systems fail to prevent vehicle penetration, creating significant security vulnerabilities and potential for vehicle-borne attacks',
                standard: 'FIFA-Physical Security',
                expected: 'Crash-Rated Bollards',
                vulnerability_if: 'Decorative Only, No Bollards',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_bollard_height': {
                intent: 'Insufficient bollard height allows vehicle override, compromising perimeter security and creating vulnerability to vehicle-borne threats',
                standard: 'FIFA-Physical Security',
                expected: '>= 36 inches',
                vulnerability_if: '< 36 inches',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_perimeter_fencing': {
                intent: 'Lack of perimeter fencing creates uncontrolled access points and vulnerability to unauthorized entry, compromising hotel security and guest safety',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_fence_height': {
                intent: 'Insufficient fence height allows unauthorized access and creates security vulnerabilities, potentially compromising hotel perimeter security',
                standard: 'FIFA-Physical Security',
                expected: '>= 8 feet',
                vulnerability_if: '< 8 feet',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_fence_condition': {
                intent: 'Poor fence condition creates security gaps and unauthorized access points, compromising perimeter security and hotel safety',
                standard: 'FIFA-Physical Security',
                expected: 'Excellent Condition',
                vulnerability_if: 'Poor Condition, Damaged',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_fence_sensors': {
                intent: 'Lack of fence sensors creates vulnerability to unauthorized perimeter breaches, limiting security response capabilities and incident detection',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_landscaping_clear_zones': {
                intent: 'Insufficient clear zones around perimeter create concealment opportunities for threats and limit security visibility, compromising perimeter security',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_landscaping_lighting': {
                intent: 'Inadequate perimeter lighting creates security vulnerabilities during nighttime hours, limiting threat detection and response capabilities',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_signage_surveillance': {
                intent: 'Lack of surveillance signage reduces deterrent effect and may not meet legal requirements for video surveillance notification',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_threat_vehicle': {
                intent: 'Lack of vehicle threat protection creates vulnerability to vehicle-borne attacks and unauthorized vehicle access, potentially compromising guest safety',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_threat_pedestrian': {
                intent: 'Insufficient pedestrian threat protection creates vulnerability to unauthorized access and potential security incidents',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_threat_blast': {
                intent: 'Lack of blast protection creates vulnerability to explosive threats and potential catastrophic damage, compromising guest safety and hotel security',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },

            // Advanced Video Surveillance System
            'vss_system_type': {
                intent: 'Outdated or inadequate VSS technology creates security monitoring gaps and limits incident response capabilities, potentially compromising guest safety',
                standard: 'FIFA-Electronic Security',
                expected: 'IP-Based Digital System',
                vulnerability_if: 'Analog System, No VSS',
                severity: 'High',
                category: 'FIFA-Electronic Security',
                fifa_critical: true
            },
            'vss_ip_cameras': {
                intent: 'Lack of IP cameras limits network-based monitoring capabilities and creates vulnerabilities in digital security infrastructure',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Electronic Security',
                fifa_critical: true
            },
            'vss_dome_cameras': {
                intent: 'Insufficient dome camera coverage creates blind spots in interior areas and limits comprehensive security monitoring capabilities',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_bullet_cameras': {
                intent: 'Lack of bullet cameras limits long-range monitoring capabilities and creates vulnerabilities in perimeter and exterior security coverage',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_ptz_cameras': {
                intent: 'Insufficient PTZ camera coverage limits active monitoring capabilities and reduces security response effectiveness during incidents',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_thermal_cameras': {
                intent: 'Lack of thermal cameras creates vulnerability to nighttime security breaches and limits low-light monitoring capabilities',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_facial_recognition': {
                intent: 'Lack of facial recognition technology limits threat identification capabilities and reduces security effectiveness during incidents',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_lpr': {
                intent: 'Lack of license plate recognition creates vulnerability to unauthorized vehicle access and limits vehicle security monitoring capabilities',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_motion_detection': {
                intent: 'Insufficient motion detection capabilities limit automated threat detection and may result in missed security incidents',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_cloud': {
                intent: 'Lack of cloud storage creates vulnerability to data loss and limits remote monitoring capabilities, potentially compromising security effectiveness',
                standard: 'FIFA-Electronic Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Electronic Security',
                fifa_critical: false
            },
            'vss_monitored_by': {
                intent: 'Unmonitored VSS systems provide no real-time security benefit and create false sense of security, potentially compromising incident response',
                standard: 'FIFA-Electronic Security',
                expected: '24/7 Professional Monitoring',
                vulnerability_if: 'No Monitoring, Self-Monitored',
                severity: 'High',
                category: 'FIFA-Electronic Security',
                fifa_critical: true
            },

            // Electronic Locking Systems
            'els_system_type': {
                intent: 'Outdated or inadequate electronic locking systems create security vulnerabilities and limit access control capabilities, potentially compromising guest safety',
                standard: 'FIFA-Access Control',
                expected: 'Modern Electronic System',
                vulnerability_if: 'Manual Keys Only, No Electronic System',
                severity: 'High',
                category: 'FIFA-Access Control',
                fifa_critical: true
            },
            'els_proximity': {
                intent: 'Lack of proximity card technology limits access control capabilities and creates vulnerabilities in guest room and restricted area security',
                standard: 'FIFA-Access Control',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Access Control',
                fifa_critical: true
            },
            'els_rfid': {
                intent: 'Insufficient RFID technology limits advanced access control capabilities and creates vulnerabilities in high-security areas',
                standard: 'FIFA-Access Control',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Access Control',
                fifa_critical: false
            },
            'els_magstripe': {
                intent: 'Outdated magstripe technology creates security vulnerabilities and limits access control effectiveness, potentially compromising guest safety',
                standard: 'FIFA-Access Control',
                expected: 'Modern Technology',
                vulnerability_if: 'Magstripe Only',
                severity: 'Medium',
                category: 'FIFA-Access Control',
                fifa_critical: false
            },
            'els_pin': {
                intent: 'Lack of PIN-based access control creates vulnerabilities in restricted areas and limits multi-factor authentication capabilities',
                standard: 'FIFA-Access Control',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Access Control',
                fifa_critical: false
            },
            'els_mobile': {
                intent: 'Lack of mobile-based access control limits guest convenience and creates vulnerabilities in modern access management systems',
                standard: 'FIFA-Access Control',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Access Control',
                fifa_critical: false
            },
            'els_biometric': {
                intent: 'Biometric systems are inherently flawed and create security vulnerabilities due to reliability issues and potential for spoofing',
                standard: 'FIFA-Access Control',
                expected: 'No Biometric Systems',
                vulnerability_if: 'Biometric Systems Present',
                severity: 'High',
                category: 'FIFA-Access Control',
                fifa_critical: true
            },

            // Parking Security
            'has_surface_parking': {
                intent: 'Surface parking areas create security vulnerabilities and require enhanced monitoring and access control to prevent unauthorized vehicle access',
                standard: 'FIFA-Parking Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Parking Security',
                fifa_critical: false
            },
            'has_garage_parking': {
                intent: 'Garage parking areas create significant security vulnerabilities and require comprehensive monitoring and access control systems',
                standard: 'FIFA-Parking Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Parking Security',
                fifa_critical: true
            },
            'surface_parking_control': {
                intent: 'Lack of surface parking access control creates vulnerability to unauthorized vehicle access and potential security incidents',
                standard: 'FIFA-Parking Security',
                expected: 'Controlled Access',
                vulnerability_if: 'Open Access',
                severity: 'Medium',
                category: 'FIFA-Parking Security',
                fifa_critical: false
            },
            'garage_parking_control': {
                intent: 'Insufficient garage parking access control creates significant security vulnerabilities and potential for unauthorized vehicle access',
                standard: 'FIFA-Parking Security',
                expected: 'Controlled Access',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'FIFA-Parking Security',
                fifa_critical: true
            },
            'surface_parking_vss': {
                intent: 'Lack of surface parking surveillance creates security monitoring gaps and limits incident response capabilities',
                standard: 'FIFA-Parking Security',
                expected: 'Full Coverage',
                vulnerability_if: 'Partial or None',
                severity: 'Medium',
                category: 'FIFA-Parking Security',
                fifa_critical: false
            },
            'garage_parking_vss': {
                intent: 'Insufficient garage parking surveillance creates significant security vulnerabilities and limits incident detection and response capabilities',
                standard: 'FIFA-Parking Security',
                expected: 'Full Coverage',
                vulnerability_if: 'Partial or None',
                severity: 'High',
                category: 'FIFA-Parking Security',
                fifa_critical: true
            },
            'garage_height_clearance': {
                intent: 'Insufficient garage height clearance creates vulnerability to oversized vehicle access and potential security threats',
                standard: 'FIFA-Parking Security',
                expected: '>= 7 feet',
                vulnerability_if: '< 7 feet',
                severity: 'Medium',
                category: 'FIFA-Parking Security',
                fifa_critical: false
            },
            'garage_parking_type': {
                intent: 'Inadequate garage parking design creates security vulnerabilities and limits access control effectiveness',
                standard: 'FIFA-Parking Security',
                expected: 'Secure Design',
                vulnerability_if: 'Open Design',
                severity: 'Medium',
                category: 'FIFA-Parking Security',
                fifa_critical: false
            },

            // Pool Security
            'pool_access_control': {
                intent: 'Lack of pool access control creates security vulnerabilities and potential for unauthorized access to recreational areas',
                standard: 'FIFA-Pool Security',
                expected: 'Controlled Access',
                vulnerability_if: 'Open Access',
                severity: 'Medium',
                category: 'FIFA-Pool Security',
                fifa_critical: false
            },
            'pool_vss_coverage': {
                intent: 'Insufficient pool surveillance creates security monitoring gaps and limits incident response capabilities in recreational areas',
                standard: 'FIFA-Pool Security',
                expected: 'Full Coverage',
                vulnerability_if: 'Partial or None',
                severity: 'Medium',
                category: 'FIFA-Pool Security',
                fifa_critical: false
            },
            'pool_emergency_equipment': {
                intent: 'Lack of pool emergency equipment creates safety vulnerabilities and limits response capabilities during water-related incidents',
                standard: 'FIFA-Pool Security',
                expected: 'All Available',
                vulnerability_if: 'Not All Available',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },
            'pool_chemical_storage': {
                intent: 'Inadequate pool chemical storage creates safety hazards and security vulnerabilities, potentially compromising guest safety',
                standard: 'FIFA-Pool Security',
                expected: 'Secure Storage',
                vulnerability_if: 'Unsecured Storage',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },
            'pool_chemical_storage_secured': {
                intent: 'Unsecured pool chemical storage creates safety hazards and potential for chemical-related incidents',
                standard: 'FIFA-Pool Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },
            'pool_chemical_security_method': {
                intent: 'Inadequate chemical security methods create vulnerabilities and potential for unauthorized access to hazardous materials',
                standard: 'FIFA-Pool Security',
                expected: 'Locked Storage',
                vulnerability_if: 'No Security',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },
            'pool_chemical_storage_type': {
                intent: 'Inadequate chemical storage design creates safety vulnerabilities and potential for chemical exposure incidents',
                standard: 'FIFA-Pool Security',
                expected: 'Ventilated Locked Storage',
                vulnerability_if: 'Open Storage',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },
            'pool_lifeguard': {
                intent: 'Lack of lifeguard coverage creates safety vulnerabilities and limits emergency response capabilities during water-related incidents',
                standard: 'FIFA-Pool Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Pool Security',
                fifa_critical: true
            },

            // Residential Security
            'has_residential': {
                intent: 'Mixed-use residential components create additional security vulnerabilities and require enhanced access control and monitoring systems',
                standard: 'FIFA-Residential Security',
                expected: 'Controlled Access',
                vulnerability_if: 'Unrestricted Access',
                severity: 'Medium',
                category: 'FIFA-Residential Security',
                fifa_critical: false
            },
            'residential_separated': {
                intent: 'Lack of residential separation creates security vulnerabilities and potential for unauthorized access between hotel and residential areas',
                standard: 'FIFA-Residential Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Residential Security',
                fifa_critical: false
            },
            'residential_management': {
                intent: 'Inadequate residential management creates security vulnerabilities and limits access control capabilities in mixed-use areas',
                standard: 'FIFA-Residential Security',
                expected: 'Professional Management',
                vulnerability_if: 'Self-Managed, No Management',
                severity: 'Medium',
                category: 'FIFA-Residential Security',
                fifa_critical: false
            },
            'residential_units': {
                intent: 'Large numbers of residential units create security vulnerabilities and require enhanced monitoring and access control systems',
                standard: 'FIFA-Residential Security',
                expected: 'Controlled Access',
                vulnerability_if: 'Unrestricted Access',
                severity: 'Medium',
                category: 'FIFA-Residential Security',
                fifa_critical: false
            },

            // ISO 31030 Travel Risk Management
            'fire_panel_access': {
                intent: 'Inadequate fire panel access creates emergency response vulnerabilities and limits fire safety capabilities, potentially compromising guest safety during emergencies',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Restricted Access',
                vulnerability_if: 'Unrestricted Access',
                severity: 'High',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: true
            },
            'occ_guests_combined': {
                intent: 'Insufficient occupancy tracking creates security vulnerabilities and limits emergency response capabilities during high-occupancy periods',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Accurate Tracking',
                vulnerability_if: 'No Tracking',
                severity: 'High',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: true
            },
            'occ_staff_day': {
                intent: 'Inadequate daytime staffing creates operational vulnerabilities and limits emergency response capabilities during peak operational hours',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Adequate Staffing',
                vulnerability_if: 'Insufficient Staffing',
                severity: 'High',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: true
            },
            'occ_staff_night': {
                intent: 'Insufficient nighttime staffing creates significant security vulnerabilities and limits emergency response capabilities during high-risk hours',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Adequate Staffing',
                vulnerability_if: 'Insufficient Staffing',
                severity: 'High',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: true
            },
            'short_term_rentals': {
                intent: 'Uncontrolled short-term rentals create security vulnerabilities and limit guest verification capabilities, potentially compromising hotel security',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Controlled Access',
                vulnerability_if: 'Unrestricted Access',
                severity: 'High',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: true
            },
            'short_term_rental_platform': {
                intent: 'Unmanaged short-term rental platforms create security vulnerabilities and limit guest screening capabilities',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Managed Platform',
                vulnerability_if: 'Unmanaged Platform',
                severity: 'Medium',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: false
            },
            'short_term_rental_units': {
                intent: 'Large numbers of short-term rental units create security vulnerabilities and require enhanced monitoring and access control systems',
                standard: 'ISO 31030-Travel Risk Management',
                expected: 'Controlled Units',
                vulnerability_if: 'Uncontrolled Units',
                severity: 'Medium',
                category: 'ISO 31030-Travel Risk Management',
                fifa_critical: false
            },

            // ISO 22301 Business Continuity Management
            'secforce_provider_name': {
                intent: 'Unreliable security provider creates business continuity vulnerabilities and limits emergency response capabilities during critical incidents',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Reputable Provider',
                vulnerability_if: 'Unreliable Provider',
                severity: 'High',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: true
            },
            'secforce_reporting': {
                intent: 'Inadequate security reporting creates business continuity vulnerabilities and limits incident management capabilities',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Comprehensive Reporting',
                vulnerability_if: 'Inadequate Reporting',
                severity: 'High',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: true
            },
            'secforce_trained_all_plans': {
                intent: 'Insufficient emergency plan training creates business continuity vulnerabilities and limits response capabilities during critical incidents',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: true
            },
            'secforce_patrol_bicycle': {
                intent: 'Lack of bicycle patrol capabilities limits security coverage and emergency response effectiveness across large hotel properties',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: false
            },
            'secforce_patrol_segway': {
                intent: 'Insufficient Segway patrol capabilities limits security coverage and emergency response effectiveness in large hotel properties',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: false
            },
            'secforce_patrol_static': {
                intent: 'Insufficient static security posts create coverage gaps and limit incident prevention capabilities in critical areas',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: false
            },
            'secforce_patrol_other': {
                intent: 'Lack of alternative patrol methods limits security coverage flexibility and emergency response capabilities',
                standard: 'ISO 22301-Business Continuity',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'ISO 22301-Business Continuity',
                fifa_critical: false
            },

            // Additional Standoff Measures Mappings
            'standoff_blast_protection': {
                intent: 'Inadequate blast protection measures create vulnerability to explosive threats and compromise guest safety',
                standard: 'FIFA-Physical Security',
                expected: 'Comprehensive Blast Protection',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_bollard_material': {
                intent: 'Inadequate bollard material reduces vehicle barrier effectiveness and increases security risk',
                standard: 'FIFA-Physical Security',
                expected: 'Steel/Concrete',
                vulnerability_if: 'Plastic/Wood',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_bollard_spacing': {
                intent: 'Inadequate bollard spacing allows vehicle penetration and compromises perimeter security',
                standard: 'FIFA-Physical Security',
                expected: '<= 3 feet',
                vulnerability_if: '> 5 feet',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_combined_distance': {
                intent: 'Insufficient combined standoff distance creates vulnerability to multiple threat vectors',
                standard: 'FIFA-Physical Security',
                expected: '>= 50 feet',
                vulnerability_if: '< 25 feet',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_combined_landscaping': {
                intent: 'Inadequate landscaping security measures reduce perimeter protection effectiveness',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_combined_physical': {
                intent: 'Insufficient physical barriers create multiple security vulnerabilities and access points',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_combined_technology': {
                intent: 'Lack of technology integration reduces security system effectiveness and response capabilities',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_east_distance': {
                intent: 'Insufficient eastern perimeter standoff distance creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 15 feet',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_landscaping_none': {
                intent: 'Lack of landscaping security measures reduces perimeter protection and threat detection',
                standard: 'FIFA-Physical Security',
                expected: 'No',
                vulnerability_if: 'Yes',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_landscaping_thorny_plants': {
                intent: 'Lack of defensive landscaping reduces perimeter security and access control',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_north_distance': {
                intent: 'Insufficient northern perimeter standoff distance creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 15 feet',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_primary_method': {
                intent: 'Inadequate primary standoff method reduces overall security effectiveness',
                standard: 'FIFA-Physical Security',
                expected: 'Physical Barriers',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_property_distance': {
                intent: 'Insufficient property line standoff distance creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 15 feet',
                severity: 'High',
                category: 'FIFA-Physical Security',
                fifa_critical: true
            },
            'standoff_signage_no_trespassing': {
                intent: 'Lack of no trespassing signage reduces legal protection and security awareness',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_signage_private_property': {
                intent: 'Lack of private property signage reduces legal protection and security awareness',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_signage_restricted': {
                intent: 'Lack of restricted area signage reduces security awareness and access control',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_south_distance': {
                intent: 'Insufficient southern perimeter standoff distance creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 15 feet',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_threat_projectile': {
                intent: 'Inadequate protection against projectile threats creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },
            'standoff_west_distance': {
                intent: 'Insufficient western perimeter standoff distance creates security vulnerability',
                standard: 'FIFA-Physical Security',
                expected: '>= 25 feet',
                vulnerability_if: '< 15 feet',
                severity: 'Medium',
                category: 'FIFA-Physical Security',
                fifa_critical: false
            },

            // Parking Security Mappings
            'garage_parking_hours': {
                intent: 'Limited parking access hours reduce guest convenience and security coverage',
                standard: 'FIFA-Facility Amenities',
                expected: '24/7',
                vulnerability_if: 'Business Hours Only',
                severity: 'Medium',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'garage_parking_levels': {
                intent: 'Insufficient parking levels reduce capacity and guest accommodation',
                standard: 'FIFA-Facility Amenities',
                expected: '>= 3',
                vulnerability_if: '< 2',
                severity: 'Medium',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'garage_parking_spaces': {
                intent: 'Insufficient parking capacity reduces guest accommodation and revenue potential',
                standard: 'FIFA-Facility Amenities',
                expected: '>= 200',
                vulnerability_if: '< 100',
                severity: 'Medium',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },

            // Pool Security Mappings
            'pool_depth_max': {
                intent: 'Inadequate pool depth monitoring creates safety and security vulnerabilities',
                standard: 'FIFA-Facility Amenities',
                expected: '<= 6 feet',
                vulnerability_if: '> 8 feet',
                severity: 'Medium',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'pool_hours': {
                intent: 'Limited pool access hours reduce guest satisfaction and security coverage',
                standard: 'FIFA-Facility Amenities',
                expected: 'Extended Hours',
                vulnerability_if: 'Limited Hours',
                severity: 'Low',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'pool_size': {
                intent: 'Inadequate pool size reduces guest satisfaction and facility attractiveness',
                standard: 'FIFA-Facility Amenities',
                expected: '>= 1000 sq ft',
                vulnerability_if: '< 500 sq ft',
                severity: 'Low',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },
            'pool_type': {
                intent: 'Inadequate pool type reduces guest satisfaction and facility attractiveness',
                standard: 'FIFA-Facility Amenities',
                expected: 'Full Service Pool',
                vulnerability_if: 'Basic Pool',
                severity: 'Low',
                category: 'FIFA-Facility Amenities',
                fifa_critical: false
            },

            // Assessment Metadata Mappings
            'assessment_date': {
                intent: 'Outdated assessment data reduces accuracy of security posture evaluation',
                standard: 'FIFA-Assessment Quality',
                expected: 'Recent (within 6 months)',
                vulnerability_if: 'Older than 1 year',
                severity: 'Medium',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessment_type': {
                intent: 'Inadequate assessment scope reduces comprehensive security evaluation',
                standard: 'FIFA-Assessment Quality',
                expected: 'Comprehensive',
                vulnerability_if: 'Basic',
                severity: 'Medium',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_credentials': {
                intent: 'Inadequate assessor qualifications reduce assessment credibility and accuracy',
                standard: 'FIFA-Assessment Quality',
                expected: 'Certified Security Professional',
                vulnerability_if: 'Basic Training',
                severity: 'Medium',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_email': {
                intent: 'Lack of assessor contact information reduces accountability and follow-up capability',
                standard: 'FIFA-Assessment Quality',
                expected: 'Professional Email',
                vulnerability_if: 'None',
                severity: 'Low',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_name': {
                intent: 'Lack of assessor identification reduces accountability and assessment credibility',
                standard: 'FIFA-Assessment Quality',
                expected: 'Professional Name',
                vulnerability_if: 'None',
                severity: 'Low',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_organization': {
                intent: 'Lack of assessor organization reduces assessment credibility and professional standards',
                standard: 'FIFA-Assessment Quality',
                expected: 'Certified Organization',
                vulnerability_if: 'None',
                severity: 'Medium',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_phone': {
                intent: 'Lack of assessor contact information reduces accountability and follow-up capability',
                standard: 'FIFA-Assessment Quality',
                expected: 'Professional Phone',
                vulnerability_if: 'None',
                severity: 'Low',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'assessor_title': {
                intent: 'Inadequate assessor title reduces assessment credibility and professional standards',
                standard: 'FIFA-Assessment Quality',
                expected: 'Security Professional',
                vulnerability_if: 'Basic',
                severity: 'Low',
                category: 'FIFA-Assessment Quality',
                fifa_critical: false
            },
            'hotel_address_1': {
                intent: 'Incomplete address information reduces emergency response and security coordination',
                standard: 'FIFA-Facility Information',
                expected: 'Complete Address',
                vulnerability_if: 'Incomplete',
                severity: 'Medium',
                category: 'FIFA-Facility Information',
                fifa_critical: false
            },
            'hotel_address_2': {
                intent: 'Incomplete address information reduces emergency response and security coordination',
                standard: 'FIFA-Facility Information',
                expected: 'Complete Address',
                vulnerability_if: 'Incomplete',
                severity: 'Low',
                category: 'FIFA-Facility Information',
                fifa_critical: false
            },
            'hotel_name': {
                intent: 'Lack of facility identification reduces emergency response and security coordination',
                standard: 'FIFA-Facility Information',
                expected: 'Official Name',
                vulnerability_if: 'None',
                severity: 'Medium',
                category: 'FIFA-Facility Information',
                fifa_critical: false
            },

            // VIP Parking Security Mappings
            'vip_parking_type': {
                intent: 'Inadequate VIP parking arrangements reduce security and convenience for high-profile guests',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated VIP Garage',
                vulnerability_if: 'No VIP Parking',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_capacity': {
                intent: 'Insufficient VIP parking capacity limits accommodation for high-profile guests and security requirements',
                standard: 'FIFA-VIP Operations',
                expected: '>= 20',
                vulnerability_if: '< 10',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_security_level': {
                intent: 'Inadequate VIP parking security level creates vulnerability for high-profile guests',
                standard: 'FIFA-VIP Operations',
                expected: 'Maximum Security',
                vulnerability_if: 'Basic Security',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_access_control': {
                intent: 'Inadequate VIP parking access control creates security vulnerability and unauthorized access risk',
                standard: 'FIFA-VIP Operations',
                expected: 'Proximity Card',
                vulnerability_if: 'No Access Control',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_surveillance': {
                intent: 'Inadequate VIP parking surveillance reduces security monitoring and incident response capability',
                standard: 'FIFA-VIP Operations',
                expected: '24/7 Monitored',
                vulnerability_if: 'No Surveillance',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_lighting': {
                intent: 'Inadequate VIP parking lighting creates security vulnerability and reduces surveillance effectiveness',
                standard: 'FIFA-VIP Operations',
                expected: 'High Intensity LED',
                vulnerability_if: 'Inadequate Lighting',
                severity: 'Medium',
                category: 'FIFA-VIP Operations',
                fifa_critical: false
            },
            'vip_parking_barriers': {
                intent: 'Inadequate VIP parking barrier protection creates vulnerability to vehicle-based threats',
                standard: 'FIFA-VIP Operations',
                expected: 'K12 Rated Barriers',
                vulnerability_if: 'No Barrier Protection',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_emergency_access': {
                intent: 'Inadequate VIP parking emergency access limits emergency response and evacuation capability',
                standard: 'FIFA-VIP Operations',
                expected: 'Dedicated Emergency Access',
                vulnerability_if: 'No Emergency Access',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            },
            'vip_parking_staffing': {
                intent: 'Inadequate VIP parking staffing reduces security coverage and guest service quality',
                standard: 'FIFA-VIP Operations',
                expected: '24/7 Dedicated Staff',
                vulnerability_if: 'No Dedicated Staff',
                severity: 'Medium',
                category: 'FIFA-VIP Operations',
                fifa_critical: false
            },
            'vip_parking_vehicle_screening': {
                intent: 'Inadequate VIP parking vehicle screening creates security vulnerability to explosive and contraband threats',
                standard: 'FIFA-VIP Operations',
                expected: 'Full Security Sweep',
                vulnerability_if: 'No Vehicle Screening',
                severity: 'High',
                category: 'FIFA-VIP Operations',
                fifa_critical: true
            }
        };
    }

    // Analyze form data for FIFA enhancement opportunities
    analyzeFIFAEnhancementOpportunities(data) {
        const enhancementOpportunities = [];
        const sections = data.sections || {};

        // Analyze each section for FIFA enhancement opportunities
        Object.keys(sections).forEach(sectionKey => {
            const sectionData = sections[sectionKey];
            
            // Analyze each field for FIFA enhancement opportunities
            Object.keys(sectionData).forEach(fieldName => {
                const fieldValue = sectionData[fieldName];
                const mapping = this.fifaMappings[fieldName];
                
                if (mapping) {
                    const enhancementOpportunity = this.checkFIFAEnhancementOpportunity(fieldName, fieldValue, mapping);
                    if (enhancementOpportunity) {
                        enhancementOpportunities.push(enhancementOpportunity);
                    }
                }
            });
        });

        // Contextual best-practice opportunities using multi-field logic
        const contextualOpportunities = this.analyzeContextualBestPractices(sections);
        enhancementOpportunities.push(...contextualOpportunities);

        // Deduplicate by field/standard/expected/value combination
        const dedupeMap = new Map();
        enhancementOpportunities.forEach(opportunity => {
            const key = `${opportunity.field}|${opportunity.standard}|${opportunity.expected}|${opportunity.value}`;
            if (!dedupeMap.has(key)) {
                dedupeMap.set(key, opportunity);
            }
        });

        return Array.from(dedupeMap.values());
    }

    createContextualOpportunity({
        field,
        value,
        intent,
        standard,
        expected,
        severity,
        category,
        fifa_critical,
        recommendations
    }) {
        return {
            field,
            value,
            intent,
            standard,
            expected,
            severity,
            category,
            fifa_critical,
            description: `Enhancement Opportunity: ${intent} - Standard: ${expected}, Current: ${value}`,
            recommendations
        };
    }

    analyzeContextualBestPractices(sections) {
        const opportunities = [];
        const facilityInfo = sections.facility_info || {};
        const parking = sections.parking_facilities || {};
        const security = sections.security_systems || {};

        const hasEvCharging = fifaAnswerYes(facilityInfo.has_ev_charging) || fifaAnswerYes(parking.has_ev_charging);
        const surfaceControl = parking.surface_parking_control || '';
        const garageControl = parking.garage_parking_control || '';
        const surfaceVss = parking.surface_parking_vss || '';
        const garageVss = parking.garage_parking_vss || '';
        const surfaceLighting = parking.surface_parking_lighting || '';
        const garageLighting = parking.garage_parking_lighting || '';
        const monitoringHours = security.monitoring_hours || '';
        const backupPower = security.security_backup_power || facilityInfo.security_backup_power || '';
        const monitoredBy = security.vss_monitored_by || '';

        if (hasEvCharging) {
            if (surfaceControl === 'Open Access' || garageControl === 'None') {
                opportunities.push(this.createContextualOpportunity({
                    field: 'has_ev_charging',
                    value: `surface:${surfaceControl || 'N/A'}, garage:${garageControl || 'N/A'}`,
                    intent: 'EV charging zones should not be openly accessible without screening or managed entry controls',
                    standard: 'Industry-EV Charging Security',
                    expected: 'Managed access control at EV charging locations',
                    severity: 'High',
                    category: 'Industry-EV Charging Security',
                    fifa_critical: true,
                    recommendations: [
                        'Implement controlled EV charging access (key card, attendant, or gated entry)',
                        'Apply EV charging station security controls aligned with NFPA 70 (NEC Article 625) and local fire code',
                        'Document EV bay access exceptions for guests, vendors, and emergency response operations'
                    ]
                }));
            }

            if (surfaceVss === 'None' || garageVss === 'None' || surfaceVss === 'Partial' || garageVss === 'Partial') {
                opportunities.push(this.createContextualOpportunity({
                    field: 'has_ev_charging',
                    value: `surface:${surfaceVss || 'N/A'}, garage:${garageVss || 'N/A'}`,
                    intent: 'EV charging areas require dedicated surveillance coverage to deter tampering and capture incident evidence',
                    standard: 'Industry-EV Charging Security',
                    expected: 'Full VSS coverage for EV charging locations',
                    severity: 'High',
                    category: 'Industry-EV Charging Security',
                    fifa_critical: true,
                    recommendations: [
                        'Provide full camera coverage of EV bays, payment kiosks, and cable-management areas',
                        'Add tamper-evident review procedures for EV charging equipment and surrounding infrastructure',
                        'Link EV charging camera views to SOC monitoring workflows and incident tagging'
                    ]
                }));
            }

            if (surfaceLighting === 'Poor' || surfaceLighting === 'Fair' || garageLighting === 'Poor' || garageLighting === 'Fair') {
                opportunities.push(this.createContextualOpportunity({
                    field: 'has_ev_charging',
                    value: `surface:${surfaceLighting || 'N/A'}, garage:${garageLighting || 'N/A'}`,
                    intent: 'Low lighting around EV charging stations increases personal safety risk and reduces camera effectiveness',
                    standard: 'Industry-EV Charging Security',
                    expected: 'Good or better lighting at EV charging areas',
                    severity: 'Medium',
                    category: 'Industry-EV Charging Security',
                    fifa_critical: false,
                    recommendations: [
                        'Upgrade EV zone lighting to improve recognition quality and natural surveillance',
                        'Validate illumination levels in both occupied and low-occupancy periods',
                        'Include EV charging zones in after-hours lighting inspection rounds'
                    ]
                }));
            }
        }

        if (monitoringHours && monitoringHours !== '24/7') {
            opportunities.push(this.createContextualOpportunity({
                field: 'monitoring_hours',
                value: monitoringHours,
                intent: 'Security monitoring outside business hours should be continuous to reduce detection gaps',
                standard: 'Industry-Continuous Monitoring',
                expected: '24/7 monitoring coverage',
                severity: 'Medium',
                category: 'Industry-Continuous Monitoring',
                fifa_critical: false,
                recommendations: [
                    'Move from business-hours or on-demand monitoring to continuous 24/7 coverage',
                    'Define after-hours escalation playbooks with named responders and SLA targets',
                    'Validate staffing model against occupancy peaks and event schedules'
                ]
            }));
        }

        if (fifaAnswerNo(backupPower) || backupPower === 'Partial') {
            opportunities.push(this.createContextualOpportunity({
                field: 'security_backup_power',
                value: backupPower,
                intent: 'Security operations should maintain continuity during utility disruption and controlled shutdown events',
                standard: 'Industry-Operational Resilience',
                expected: 'Full backup power for critical security systems',
                severity: 'High',
                category: 'Industry-Operational Resilience',
                fifa_critical: true,
                recommendations: [
                    'Provide full backup power coverage for surveillance, access control, communications, and SOC workflows',
                    'Test failover runtime under operational loads and document recovery objectives',
                    'Include EV charging safety shutdown/isolations in power-loss runbooks'
                ]
            }));
        }

        if (monitoredBy === 'For Evidence Only') {
            opportunities.push(this.createContextualOpportunity({
                field: 'vss_monitored_by',
                value: monitoredBy,
                intent: 'Evidence-only surveillance posture limits proactive incident interdiction',
                standard: 'Industry-Proactive Monitoring',
                expected: 'Dedicated operator or analytics-assisted active monitoring',
                severity: 'Medium',
                category: 'Industry-Proactive Monitoring',
                fifa_critical: false,
                recommendations: [
                    'Adopt active VSS monitoring during risk-relevant operating windows',
                    'Define alert triage SOPs and operator performance targets',
                    'Use analytics triage for low-signal events, with analyst confirmation'
                ]
            }));
        }

        return opportunities;
    }

    // Check FIFA enhancement opportunity for a specific field
    checkFIFAEnhancementOpportunity(fieldName, fieldValue, mapping) {
        const hasEnhancementOpportunity = this.evaluateFIFACondition(fieldValue, mapping);
        
        if (hasEnhancementOpportunity) {
            return {
                field: fieldName,
                value: fieldValue,
                intent: mapping.intent,
                standard: mapping.standard,
                expected: mapping.expected,
                severity: mapping.severity,
                category: mapping.category,
                fifa_critical: mapping.fifa_critical,
                description: `Enhancement Opportunity: ${mapping.intent} - FIFA Standard: ${mapping.expected}, Current: ${fieldValue}`,
                recommendations: this.getFIFARecommendations(fieldName, mapping)
            };
        }
        
        return null;
    }

    normalizeText(value) {
        if (value === null || value === undefined) return '';
        return value.toString().trim().toLowerCase();
    }

    extractThreshold(conditionText) {
        const normalized = this.normalizeText(conditionText);
        const numberMatch = normalized.match(/-?\d+(\.\d+)?/);
        if (!numberMatch) return { value: NaN, unit: null };

        let unit = null;
        if (normalized.includes('inch') || normalized.includes('"')) {
            unit = 'inches';
        } else if (normalized.includes('foot') || normalized.includes('feet') || normalized.includes('ft') || normalized.includes('\'')) {
            unit = 'feet';
        }

        return {
            value: Number(numberMatch[0]),
            unit
        };
    }

    parseMeasurement(value, preferredUnit = null) {
        if (typeof value === 'number') return value;
        if (value === null || value === undefined) return NaN;

        const text = value.toString().trim().toLowerCase();

        // Handle "8' 6\"" style feet/inches input
        const feetInchesMatch = text.match(/(\d+)\s*'\s*(\d+)?/);
        if (feetInchesMatch) {
            const feet = Number(feetInchesMatch[1]);
            const inches = feetInchesMatch[2] ? Number(feetInchesMatch[2]) : 0;
            return preferredUnit === 'inches' ? (feet * 12) + inches : feet + (inches / 12);
        }

        const numericMatch = text.match(/-?\d+(\.\d+)?/);
        if (!numericMatch) return NaN;
        let parsed = Number(numericMatch[0]);

        const isFeet = text.includes('foot') || text.includes('feet') || text.includes('ft');
        const isInches = text.includes('inch') || text.includes('in ') || text.includes('"');
        const hasExplicitUnit = isFeet || isInches;

        if (preferredUnit === 'inches' && isFeet) {
            parsed = parsed * 12;
        } else if (preferredUnit === 'feet' && isInches) {
            parsed = parsed / 12;
        } else if (!hasExplicitUnit && preferredUnit === 'inches' && parsed > 0 && parsed <= 12) {
            // Bare values like "3.5" on height fields are typically entered in feet.
            parsed = parsed * 12;
        }

        return parsed;
    }

    // Evaluate FIFA compliance condition
    evaluateFIFACondition(value, mapping) {
        const conditionText = this.normalizeText(mapping.vulnerability_if);
        const valueText = this.normalizeText(value);
        const expectedText = this.normalizeText(mapping.expected);

        if (!conditionText) return false;
        if (conditionText === 'no' && (valueText === 'no' || valueText === 'none' || valueText.startsWith('no '))) return true;
        if (conditionText === 'yes' && valueText === 'yes') return true;
        if (conditionText === 'none' && (!valueText || valueText === 'none')) return true;
        if (conditionText === 'partial or none' && (valueText === 'partial' || valueText === 'none')) return true;
        if (conditionText === 'not all available' && valueText && valueText !== 'all available') return true;
        if (conditionText === 'unrestricted access' && (valueText.includes('open access') || valueText.includes('none'))) return true;

        // Numeric comparisons with string-safe parsing
        if (conditionText.startsWith('<') || conditionText.startsWith('>')) {
            const threshold = this.extractThreshold(conditionText);
            const actualValue = this.parseMeasurement(value, threshold.unit);
            if (!Number.isNaN(threshold.value) && !Number.isNaN(actualValue)) {
                if (conditionText.startsWith('<')) return actualValue < threshold.value;
                if (conditionText.startsWith('>')) return actualValue > threshold.value;
            }
        }

        // If expectation is 24/7, any non-24/7 value is an opportunity
        if (expectedText === '24/7' && valueText && valueText !== '24/7') return true;

        if (conditionText.includes('only') && valueText.includes(conditionText)) return true;
        if (conditionText.includes('basic') && valueText.includes('basic')) return true;
        if (conditionText.includes('k4') && valueText === 'k4') return true;

        // Direct fallback string comparison
        return valueText === conditionText;
    }

    // Get FIFA-specific recommendations
    getFIFARecommendations(fieldName, mapping) {
        const recommendations = [];
        
        switch (fieldName) {
            case 'guest_room_count':
                recommendations.push('Consider increasing room capacity to align with FIFA World Cup hosting guidelines (1000+ rooms)');
                recommendations.push('Consider temporary accommodation solutions for peak periods');
                break;
            case 'vss_present':
                recommendations.push('Consider implementing comprehensive video surveillance system for FIFA hosting guidelines');
                recommendations.push('Ensure coverage of all critical areas including VIP zones');
                break;
            case 'secforce_247':
                recommendations.push('Consider establishing 24/7 security force for FIFA World Cup hosting');
                recommendations.push('Implement shift rotation and backup personnel');
                break;
            case 'standoff_street_distance':
                recommendations.push('Consider increasing standoff distance to align with FIFA security guidelines (25+ feet)');
                recommendations.push('Implement additional perimeter barriers if needed');
                break;
            case 'vehicle_barrier_rating':
                recommendations.push('Consider upgrading vehicle barriers to K12 rating for FIFA hosting guidelines');
                recommendations.push('Implement additional blast protection measures');
                break;
            case 'has_ev_charging':
                recommendations.push('If EV charging is offered, align operational controls with NFPA 70 (NEC Article 625) and local fire code requirements');
                recommendations.push('Ensure EV charging bays are included in perimeter, surveillance, and after-hours patrol plans');
                break;
            case 'surface_parking_control':
            case 'garage_parking_control':
                recommendations.push('Use managed parking access controls (key card, attendant, or gated entry) rather than open access');
                recommendations.push('Define access exceptions for vendors, delivery windows, and emergency services');
                break;
            case 'surface_parking_vss':
            case 'garage_parking_vss':
                recommendations.push('Provide full VSS coverage for parking lanes, EV bays, payment kiosks, and ingress/egress points');
                recommendations.push('Link parking alerts to SOC workflows for rapid verification and dispatch');
                break;
            case 'monitoring_hours':
                recommendations.push('Move to continuous 24/7 monitoring for critical security systems and high-risk areas');
                recommendations.push('Document after-hours escalation procedures with named responders and SLA targets');
                break;
            case 'security_backup_power':
                recommendations.push('Provide full backup power for surveillance, access control, SOC communications, and alarm systems');
                recommendations.push('Run routine failover tests and document recovery objectives for critical systems');
                break;
            case 'vss_monitored_by':
                recommendations.push('Shift from evidence-only posture to active monitoring during operating and elevated-risk windows');
                recommendations.push('Use analytics triage plus human validation to improve detection speed and reduce noise');
                break;
            default:
                recommendations.push(`Consider addressing ${mapping.intent} to align with FIFA World Cup hosting guidelines`);
                recommendations.push('Consult FIFA hosting guidelines documentation for specific details');
        }
        
        return recommendations;
    }

    // Generate FIFA enhancement opportunities report
    generateFIFAEnhancementReport(enhancementOpportunities) {
        const criticalOpportunities = enhancementOpportunities.filter(e => e.fifa_critical === true);
        const nonCriticalOpportunities = enhancementOpportunities.filter(e => e.fifa_critical === false);
        
        const highPriority = enhancementOpportunities.filter(e => e.severity === 'High');
        const mediumPriority = enhancementOpportunities.filter(e => e.severity === 'Medium');
        const lowPriority = enhancementOpportunities.filter(e => e.severity === 'Low');

        return {
            summary: `FIFA World Cup Hosting Assessment: ${enhancementOpportunities.length} enhancement opportunities identified`,
            total: enhancementOpportunities.length,
            critical: criticalOpportunities.length,
            nonCritical: nonCriticalOpportunities.length,
            high: highPriority.length,
            medium: mediumPriority.length,
            low: lowPriority.length,
            enhancementOpportunities: enhancementOpportunities,
            categories: this.groupFIFAByCategory(enhancementOpportunities),
            fifaEnhancementScore: this.calculateFIFAEnhancementScore(enhancementOpportunities)
        };
    }

    // Group FIFA enhancement opportunities by category
    groupFIFAByCategory(enhancementOpportunities) {
        const categories = {};
        enhancementOpportunities.forEach(opportunity => {
            if (!categories[opportunity.category]) {
                categories[opportunity.category] = [];
            }
            categories[opportunity.category].push(opportunity);
        });
        return categories;
    }

    // Calculate FIFA enhancement score
    calculateFIFAEnhancementScore(enhancementOpportunities) {
        const totalFields = Object.keys(this.fifaMappings).length;
        const enhancedFields = totalFields - enhancementOpportunities.length;
        const enhancementScore = Math.round((enhancedFields / totalFields) * 100);
        
        let enhancementLevel = 'Needs Enhancement';
        if (enhancementScore >= 90) enhancementLevel = 'FIFA Standard';
        else if (enhancementScore >= 75) enhancementLevel = 'Nearly FIFA Standard';
        else if (enhancementScore >= 50) enhancementLevel = 'Partially Enhanced';
        else enhancementLevel = 'Needs Enhancement';
        
        return {
            score: enhancementScore,
            level: enhancementLevel,
            enhancedFields: enhancedFields,
            totalFields: totalFields,
            criticalEnhancementOpportunities: enhancementOpportunities.filter(e => e.fifa_critical).length
        };
    }
}

// Export for use in main application
window.FIFAStandardsMapper = FIFAStandardsMapper;
