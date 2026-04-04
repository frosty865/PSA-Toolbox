// Heuristic Vulnerability Mapping System
// Maps form questions to security standards and identifies vulnerabilities

function heuristicAnswerYes(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isAffirmativeYes) {
        return HostAnswerNormalize.isAffirmativeYes(v);
    }
    return String(v ?? '').trim().toLowerCase() === 'yes';
}
function heuristicAnswerNo(v) {
    if (typeof HostAnswerNormalize !== 'undefined' && HostAnswerNormalize.isNegativeResponse) {
        return HostAnswerNormalize.isNegativeResponse(v);
    }
    const n = String(v ?? '').trim().toLowerCase();
    return n === 'no' || n === 'false' || n === '0' || n === 'none' || n === 'n/a' || n === 'na';
}

class HeuristicVulnerabilityMapper {
    constructor() {
        this.vofcData = null;
        this.questionMappings = this.createQuestionMappings();
        this.securityStandards = this.createSecurityStandards();
    }

    // Load local data files
    async loadLocalData() {
        try {
            // Use embedded VOFC data to avoid CORS issues
            if (window.EMBEDDED_VOFC_DATA) {
                this.vofcData = window.EMBEDDED_VOFC_DATA;
                console.log('VOFC data loaded from embedded data:', this.vofcData.length, 'vulnerabilities');
            } else {
                console.warn('No embedded VOFC data found');
                this.vofcData = [];
            }

            return true;
        } catch (error) {
            console.error('Failed to load local data:', error);
            return false;
        }
    }

    // Create comprehensive question mappings based on security intent
    createQuestionMappings() {
        return {
            // Video Surveillance System Questions
            'vss_present': {
                intent: 'Video surveillance system presence',
                standard: 'Electronic Security Systems',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'Electronic Security Systems'
            },
            'vss_camera_count': {
                intent: 'Adequate camera coverage for facility size',
                standard: 'Electronic Security Systems',
                expected: '>= 20',
                vulnerability_if: '< 20',
                severity: 'Medium',
                category: 'Electronic Security Systems'
            },
            'vss_retention': {
                intent: 'Adequate video retention period',
                standard: 'Electronic Security Systems',
                expected: '>= 7',
                vulnerability_if: '< 7',
                severity: 'Medium',
                category: 'Electronic Security Systems'
            },

            // Electronic Locking System Questions
            'els_present': {
                intent: 'Electronic locking system presence',
                standard: 'Entry Controls',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'Entry Controls'
            },
            'els_integration': {
                intent: 'Integrated access control system',
                standard: 'Entry Controls',
                expected: 'Fully Integrated',
                vulnerability_if: 'Basic',
                severity: 'Medium',
                category: 'Entry Controls'
            },

            // Security Operations Center
            'soc_present': {
                intent: 'Security operations center presence',
                standard: 'Security Management Profile',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'Security Management Profile'
            },
            'monitoring_hours': {
                intent: '24/7 security monitoring',
                standard: 'Security Management Profile',
                expected: '24/7',
                vulnerability_if: 'Business Hours Only',
                severity: 'High',
                category: 'Security Management Profile'
            },

            // Physical Security Questions
            'has_perimeter_barriers': {
                intent: 'Perimeter barrier protection',
                standard: 'Barriers',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'Barriers'
            },
            'standoff_street_distance': {
                intent: 'Adequate standoff distance from street',
                standard: 'Barriers',
                expected: '>= 25',
                vulnerability_if: '< 10',
                severity: 'High',
                category: 'Barriers'
            },
            'vehicle_barrier_rating': {
                intent: 'Adequate vehicle barrier rating',
                standard: 'Barriers',
                expected: 'K12',
                vulnerability_if: 'K4',
                severity: 'Medium',
                category: 'Barriers'
            },

            // Lighting Questions
            'surface_parking_lighting': {
                intent: 'Adequate parking area lighting',
                standard: 'Illumination',
                expected: 'Excellent',
                vulnerability_if: 'Poor',
                severity: 'Medium',
                category: 'Illumination'
            },
            'garage_parking_lighting': {
                intent: 'Adequate garage lighting',
                standard: 'Illumination',
                expected: 'Excellent',
                vulnerability_if: 'Poor',
                severity: 'Medium',
                category: 'Illumination'
            },

            // Security Force Questions
            'secforce_247': {
                intent: '24/7 security force presence',
                standard: 'Security Force Profile',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'High',
                category: 'Security Force Profile'
            },
            'secforce_armed': {
                intent: 'Armed security force capability',
                standard: 'Security Force Profile',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'Security Force Profile'
            },
            'secforce_response_time': {
                intent: 'Quick security response time',
                standard: 'Security Force Profile',
                expected: '<= 2 minutes',
                vulnerability_if: '> 5 minutes',
                severity: 'Medium',
                category: 'Security Force Profile'
            },

            // Pool Security Questions
            'has_pool': {
                intent: 'Pool facility presence',
                standard: 'Facility Information',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Low',
                category: 'Facility Information'
            },
            'pool_lifeguard': {
                intent: 'Pool lifeguard presence',
                standard: 'Facility Information',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'Facility Information'
            },
            'pool_chemical_storage_secured': {
                intent: 'Secured chemical storage',
                standard: 'Facility Information',
                expected: 'Yes',
                vulnerability_if: 'No',
                severity: 'Medium',
                category: 'Facility Information'
            },

            // VIP Access Questions
            'vip_entrance_type': {
                intent: 'Dedicated VIP entrance',
                standard: 'Entry Controls',
                expected: 'Dedicated',
                vulnerability_if: 'None',
                severity: 'Medium',
                category: 'Entry Controls'
            },
            'vip_access_control': {
                intent: 'VIP access control method',
                standard: 'Entry Controls',
                expected: 'Key Card',
                vulnerability_if: 'None',
                severity: 'Medium',
                category: 'Entry Controls'
            },

            // Emergency Response Questions
            'emergency_agency': {
                intent: 'Emergency response agency contact',
                standard: 'First Preventers-Responders',
                expected: 'Local Police/Fire',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'First Preventers-Responders'
            },
            'fire_panel_location': {
                intent: 'Fire panel location identified',
                standard: 'Dependencies-Critical Products',
                expected: 'Main Lobby',
                vulnerability_if: 'None',
                severity: 'High',
                category: 'Dependencies-Critical Products'
            },

            // FIFA Requirements
            'guest_room_count': {
                intent: 'FIFA minimum room capacity',
                standard: 'FIFA-Accommodation Capacity',
                expected: '>= 1000',
                vulnerability_if: '< 1000',
                severity: 'High',
                category: 'FIFA-Accommodation Capacity'
            },
            'number_of_floors': {
                intent: 'FIFA minimum floor count',
                standard: 'FIFA-Accommodation Capacity',
                expected: '>= 5',
                vulnerability_if: '< 5',
                severity: 'Medium',
                category: 'FIFA-Accommodation Capacity'
            },
        };
    }

    // Create security standards based on industry best practices
    createSecurityStandards() {
        return {
            'Electronic Security Systems': {
                description: 'Video surveillance, access control, and electronic security systems',
                guidelines: ['VSS present', 'ELS present', 'SOC present', '24/7 monitoring'],
                standards: ['NFPA 730', 'ASIS International Guidelines']
            },
            'Entry Controls': {
                description: 'Physical and electronic access control systems',
                guidelines: ['Electronic locking', 'Access control', 'VIP access', 'Restricted areas'],
                standards: ['NFPA 101', 'ASIS International Guidelines']
            },
            'Barriers': {
                description: 'Physical barriers and perimeter protection',
                guidelines: ['Perimeter barriers', 'Standoff distance', 'Vehicle barriers', 'Bollards'],
                standards: ['FEMA 426', 'DHS Protective Security Advisors']
            },
            'Security Force Profile': {
                description: 'Security personnel and force capabilities',
                guidelines: ['24/7 coverage', 'Armed capability', 'Training', 'Response time'],
                standards: ['ASIS International Guidelines', 'DHS Protective Security Advisors']
            },
            'Facility Information': {
                description: 'Facility-specific security measures',
                guidelines: ['Pool security', 'Chemical storage', 'Emergency equipment'],
                standards: ['NFPA 101', 'OSHA Guidelines']
            }
        };
    }

    // Analyze form data and identify vulnerabilities
    analyzeFormData(formData) {
        const vulnerabilities = [];
        const sections = formData.sections || {};

        // Analyze each section
        Object.keys(sections).forEach(sectionKey => {
            const sectionData = sections[sectionKey];
            
            // Analyze each field in the section
            Object.keys(sectionData).forEach(fieldName => {
                const fieldValue = sectionData[fieldName];
                const mapping = this.questionMappings[fieldName];
                
                if (mapping) {
                    const vulnerability = this.checkFieldForVulnerability(fieldName, fieldValue, mapping);
                    if (vulnerability) {
                        vulnerabilities.push(vulnerability);
                    }
                }
            });
        });

        return vulnerabilities;
    }

    // Check if a field value indicates a vulnerability
    checkFieldForVulnerability(fieldName, fieldValue, mapping) {
        const isVulnerable = this.evaluateVulnerabilityCondition(fieldValue, mapping);
        
        if (isVulnerable) {
            return {
                field: fieldName,
                value: fieldValue,
                intent: mapping.intent,
                standard: mapping.standard,
                expected: mapping.expected,
                severity: mapping.severity,
                category: mapping.category,
                description: `${mapping.intent} - Expected: ${mapping.expected}, Found: ${fieldValue}`,
                recommendations: this.getRecommendationsForField(fieldName, mapping)
            };
        }
        
        return null;
    }

    // Evaluate vulnerability condition
    evaluateVulnerabilityCondition(value, mapping) {
        if (mapping.vulnerability_if === 'No' && heuristicAnswerNo(value)) return true;
        if (mapping.vulnerability_if === 'Yes' && heuristicAnswerYes(value)) return true;
        if (mapping.vulnerability_if === 'None' && (!value || value === 'None')) return true;
        
        // Numeric comparisons
        const numericValue = Number(value);
        if (mapping.vulnerability_if.startsWith('<') && Number.isFinite(numericValue)) {
            const threshold = parseInt(mapping.vulnerability_if.replace(/[^\d.-]/g, ''));
            return numericValue < threshold;
        }
        if (mapping.vulnerability_if.startsWith('>') && Number.isFinite(numericValue)) {
            const threshold = parseInt(mapping.vulnerability_if.replace(/[^\d.-]/g, ''));
            return numericValue > threshold;
        }
        
        // String comparisons
        if (mapping.vulnerability_if.includes('Only') && value && value.includes('Only')) return true;
        if (mapping.vulnerability_if.includes('Basic') && value === 'Basic') return true;
        if (mapping.vulnerability_if.includes('Poor') && value === 'Poor') return true;
        
        return false;
    }

    /**
     * Options for consideration: OFC option_text from embedded VOFC catalog only (no generated advice).
     */
    getRecommendationsForField(fieldName, mapping) {
        const embedded = typeof window !== 'undefined' && window.EMBEDDED_VOFC_DATA;
        if (!embedded || !Array.isArray(embedded)) return [];

        const hintLists = {
            has_perimeter_barriers: ['high-speed avenues of approach'],
            standoff_vehicle_barriers: ['high-speed avenues of approach'],
            vss_present: ['does not have a cctv system'],
            vss_camera_count: ['cctv coverage of the facility'],
            vss_retention: ['recorded information from the cctv system for no more than 1 month'],
            els_present: ['limited or no access control policies/procedures for employees'],
            els_integration: ['limited or no access control policies/procedures for visitors'],
            soc_present: ['does not use real-time monitoring for the cctv system'],
            monitoring_hours: ['does not use real-time monitoring for the cctv system'],
            secforce_247: ['deploy the security force to regularly patrol'],
            secforce_type: ['deploy the security force to regularly patrol']
        };

        const hints = hintLists[fieldName];
        if (!hints) return [];

        for (let i = 0; i < hints.length; i++) {
            const sub = hints[i].toLowerCase();
            const row = embedded.find(
                (v) => (v.vulnerability_text || '').toLowerCase().includes(sub)
            );
            if (row && Array.isArray(row.options) && row.options.length) {
                return row.options.slice(0, 8).map((o) => o.option_text);
            }
        }

        return [];
    }

    // Generate comprehensive vulnerability report
    generateVulnerabilityReport(vulnerabilities) {
        const highPriority = vulnerabilities.filter(v => v.severity === 'High');
        const mediumPriority = vulnerabilities.filter(v => v.severity === 'Medium');
        const lowPriority = vulnerabilities.filter(v => v.severity === 'Low');

        return {
            summary: `Identified ${vulnerabilities.length} security vulnerabilities requiring attention`,
            total: vulnerabilities.length,
            high: highPriority.length,
            medium: mediumPriority.length,
            low: lowPriority.length,
            vulnerabilities: vulnerabilities,
            categories: this.groupByCategory(vulnerabilities)
        };
    }

    // Group vulnerabilities by category
    groupByCategory(vulnerabilities) {
        const categories = {};
        vulnerabilities.forEach(vuln => {
            if (!categories[vuln.category]) {
                categories[vuln.category] = [];
            }
            categories[vuln.category].push(vuln);
        });
        return categories;
    }
}

// Export for use in main application
window.HeuristicVulnerabilityMapper = HeuristicVulnerabilityMapper;
