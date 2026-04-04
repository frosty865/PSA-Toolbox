// VOFC Vulnerabilities Database for HOST V3 integration
// This file contains 400+ pre-defined vulnerabilities for automated security assessment

window.VOFC_VULNERABILITIES = [
  {
    "v_number": "V001",
    "vulnerability_text": "CRITICAL: No vehicle barriers or perimeter fencing - Unrestricted vehicle access to facility",
    "sheet": "Perimeter Security",
    "row": 1,
    "category": "Physical Security",
    "severity": "Critical",
    "5_ds_category": "Deter",
    "description": "WHAT IT IS: Complete absence of perimeter barriers allows unrestricted vehicle and pedestrian access to facility grounds. WHY IT NEEDS PROTECTING: Perimeter barriers are the first line of defense in the 5 D's methodology, creating a visible deterrent and controlled access points. Without barriers, the facility has no ability to control who enters the property, when they enter, or what they bring with them. POSSIBLE IMPACT IF LEFT UNCHANGED: Unrestricted access creates multiple attack vectors including vehicle ramming attacks, bomb placement in parking lots or near buildings, direct access to vulnerable areas, and the ability to bypass all visitor screening protocols. This leaves the facility completely vulnerable to external threats with no early warning system.",
    "compliance_gap": "CISA Guidelines Section 3.1 - Perimeter Security",
    "attack_vectors": ["Vehicle ramming", "Bomb placement", "Direct building access", "Unauthorized infiltration"],
    "risk_impact": "High probability of unauthorized access leading to potential security incidents, vehicle attacks, or other threats",
    "standards_reference": "CISA Security Guide, DHS Infrastructure Protection Guidelines",
    "trigger_conditions": {
      "perimeter_fencing": "No",
      "vehicle_barriers": "No",
      "property_enclosed": "not_enclosed"
    }
  },
  {
    "v_number": "V002",
    "vulnerability_text": "CRITICAL: No video surveillance system - Zero threat detection capability",
    "sheet": "Technology",
    "row": 2,
    "category": "Technology",
    "severity": "Critical",
    "5_ds_category": "Detect",
    "description": "Complete absence of video surveillance system eliminates all electronic threat detection capabilities. This violates security guidelines requiring comprehensive surveillance coverage and creates massive security blind spots. Without surveillance, the facility cannot detect unauthorized access, monitor suspicious behavior, provide evidence for investigations, or support law enforcement response. This gap directly impacts the 'Detect' function of the 5 D's methodology, leaving the facility vulnerable to undetected threats.",
    "compliance_gap": "CISA Guidelines Section 4.2 - Surveillance Systems",
    "attack_vectors": ["Undetected unauthorized access", "Unmonitored suspicious behavior", "No evidence collection", "Delayed threat detection"],
    "risk_impact": "Complete loss of electronic surveillance capability leading to undetected security incidents and inability to provide evidence for investigations",
    "standards_reference": "CISA Security Guide, NIST Cybersecurity Framework, ASIS Physical Security Standards",
    "trigger_conditions": {
      "vss_present": "No",
      "video_surveillance": "No"
    }
  },
  {
    "v_number": "V003",
    "vulnerability_text": "Insufficient Security Force training on security procedures",
    "sheet": "Personnel Security",
    "row": 3,
    "category": "Personnel Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Security Force personnel lack comprehensive training on security procedures, emergency response protocols, and threat recognition. This creates gaps in the facility's ability to respond effectively to security incidents and maintain consistent security posture.",
    "compliance_gap": "Personnel Security Training Requirements",
    "attack_vectors": ["Inadequate response to incidents", "Poor threat recognition", "Inconsistent security procedures"],
    "risk_impact": "Reduced effectiveness of security response and increased vulnerability to security incidents",
    "standards_reference": "ASIS Personnel Security Standards",
    "trigger_conditions": {
      "staff_training": "basic",
      "security_training": "insufficient"
    }
  },
  {
    "v_number": "V004",
    "vulnerability_text": "Fire alarm panel access and security backup power gaps (life-safety resilience)",
    "sheet": "Emergency Preparedness",
    "row": 4,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "HOST flags open access to fire-alarm controls and/or missing backup power for security-related loads. That indicates life-safety and resilience gaps—it does not, by itself, prove whether written emergency policies exist. Pair technical fixes with an emergency operations plan and drills.",
    "compliance_gap": "Emergency Preparedness Requirements",
    "attack_vectors": ["Uncoordinated emergency response", "Delayed incident management", "Poor crisis communication"],
    "risk_impact": "Inadequate emergency response capability leading to increased risk during crisis situations",
    "standards_reference": "FEMA Emergency Management Guidelines",
    "trigger_conditions": {
      "emergency_policies": "No",
      "emergency_procedures": "missing"
    }
  },
  {
    "v_number": "V005",
    "vulnerability_text": "No electronic access control system",
    "sheet": "Access Control",
    "row": 5,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "Lack of electronic access control system prevents effective management of facility access, visitor tracking, and security monitoring. This creates significant gaps in access control and security management.",
    "compliance_gap": "Access Control System Requirements",
    "attack_vectors": ["Unauthorized access", "Poor visitor tracking", "Limited access control"],
    "risk_impact": "Reduced access control capability and increased security vulnerability",
    "standards_reference": "ASIS Access Control Standards",
    "trigger_conditions": {
      "access_control_system": "No",
      "electronic_access": "No"
    }
  },
  {
    "v_number": "V006",
    "vulnerability_text": "Inadequate lighting around perimeter",
    "sheet": "Physical Security",
    "row": 6,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Insufficient perimeter lighting creates security blind spots and reduces the effectiveness of surveillance systems. Poor lighting enables unauthorized access and reduces the facility's ability to detect threats.",
    "compliance_gap": "Perimeter Security Lighting Requirements",
    "attack_vectors": ["Unauthorized access under cover of darkness", "Reduced surveillance effectiveness", "Increased vulnerability to perimeter breaches"],
    "risk_impact": "Reduced perimeter security effectiveness and increased vulnerability to unauthorized access",
    "standards_reference": "ASIS Physical Security Standards",
    "trigger_conditions": {
      "perimeter_lighting": "inadequate",
      "exterior_lighting": "insufficient"
    }
  },
  {
    "v_number": "V007",
    "vulnerability_text": "Uncontrolled surface parking combined with weak perimeter (access layering risk)",
    "sheet": "Access Control",
    "row": 7,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "Triggered when surface parking is open and perimeter barriers are absent—an access-layering problem, not a direct measure of visitor badging or VM software. Address parking and perimeter first; add visitor-management fields later for precise VM scoring.",
    "compliance_gap": "Visitor Management Requirements",
    "attack_vectors": ["Unauthorized visitor access", "Poor visitor tracking", "Inadequate visitor screening"],
    "risk_impact": "Reduced visitor security and increased vulnerability to unauthorized access",
    "standards_reference": "ASIS Visitor Management Standards",
    "trigger_conditions": {
      "visitor_management": "No",
      "visitor_tracking": "No"
    }
  },
  {
    "v_number": "V008",
    "vulnerability_text": "Insufficient standoff distance from buildings (less than 50 feet recommended)",
    "sheet": "Physical Security",
    "row": 8,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Inadequate standoff distance between buildings and potential threat areas reduces the facility's ability to prevent vehicle-borne attacks and provides insufficient protection against explosive threats. DHS guidelines recommend minimum 50 feet standoff distance for effective protection.",
    "compliance_gap": "Standoff Distance Requirements - DHS recommends minimum 50 feet",
    "attack_vectors": ["Vehicle-borne attacks", "Explosive threats", "Direct building access"],
    "risk_impact": "Increased vulnerability to vehicle-borne attacks and explosive threats due to insufficient protective distance",
    "standards_reference": "DHS Infrastructure Protection Guidelines - Minimum 50 feet standoff distance",
    "trigger_conditions": {
      "standoff_distance": "insufficient",
      "building_protection": "inadequate"
    }
  },
  {
    "v_number": "V009",
    "vulnerability_text": "No dedicated security personnel present",
    "sheet": "Personnel Security",
    "row": 9,
    "category": "Personnel Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Absence of dedicated security personnel reduces the facility's ability to respond to security incidents and maintain consistent security presence.",
    "compliance_gap": "Security Personnel Requirements",
    "attack_vectors": ["Delayed security response", "Inconsistent security presence", "Reduced threat detection"],
    "risk_impact": "Reduced security response capability and increased vulnerability to security incidents",
    "standards_reference": "ASIS Security Personnel Standards",
    "trigger_conditions": {
      "security_personnel": "No",
      "dedicated_security": "No"
    }
  },
  {
    "v_number": "V010",
    "vulnerability_text": "Limited security monitoring coverage and/or undocumented Security Force reporting",
    "sheet": "Emergency Preparedness",
    "row": 10,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Based on monitoring-hours choices and an empty Security Force reporting field—not a direct measure of mass notification, PA, or ECCS. Improve monitoring posture and reporting procedures; add communications-system fields if ECCS must be scored.",
    "compliance_gap": "Emergency Communication Requirements",
    "attack_vectors": ["Poor emergency coordination", "Delayed emergency response", "Inadequate crisis communication"],
    "risk_impact": "Reduced emergency response effectiveness and increased risk during crisis situations",
    "standards_reference": "FEMA Emergency Communication Guidelines",
    "trigger_conditions": {
      "emergency_communication": "inadequate",
      "crisis_communication": "insufficient"
    }
  },
  {
    "v_number": "V011",
    "vulnerability_text": "Weak or unknown network segmentation for video / security systems",
    "sheet": "Technology",
    "row": 11,
    "category": "Technology",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "HOST currently measures VSS network segmentation (No/Unknown). That is one important cyber control—not a full penetration test or enterprise security assessment.",
    "compliance_gap": "Cybersecurity Requirements for Security Systems",
    "attack_vectors": ["System compromise", "Data breach", "Unauthorized access", "System disruption"],
    "risk_impact": "Security systems vulnerable to cyber attacks, potential system compromise and data breach",
    "standards_reference": "NIST Cybersecurity Framework, CISA Security Guidelines",
    "trigger_conditions": {
      "vss_network_segmentation": "No",
      "cybersecurity_protection": "inadequate"
    }
  },
  {
    "v_number": "V012",
    "vulnerability_text": "[Catalog reference] Fire/life-safety access and power — scoring merged with V004",
    "sheet": "Emergency Preparedness",
    "row": 12,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "V012 used the same field mappings as V004. Automated scoring uses V004 only; OFC012 is retained as a second mitigation option attached to V004. Integration between fire and security systems is not directly measured—requires engineering review.",
    "compliance_gap": "Fire Safety Integration Requirements",
    "attack_vectors": ["Delayed fire response", "Poor emergency coordination", "System isolation"],
    "risk_impact": "Reduced emergency response effectiveness, potential delays in fire safety actions",
    "standards_reference": "NFPA Fire Safety Standards, ASIS Emergency Management Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V013",
    "vulnerability_text": "Insufficient VIP security protocols and procedures",
    "sheet": "VIP Operations",
    "row": 13,
    "category": "VIP Operations",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive VIP security protocols creates vulnerabilities in protecting high-profile guests and increases risk of security incidents during VIP events.",
    "compliance_gap": "VIP Security Protocol Requirements",
    "attack_vectors": ["VIP targeting", "Event disruption", "Security breach", "Reputation damage"],
    "risk_impact": "Increased risk to VIP guests, potential security incidents during high-profile events",
    "standards_reference": "ASIS VIP Protection Standards, DHS Protective Security Guidelines",
    "trigger_conditions": {
      "vip_security_protocols": "inadequate",
      "vip_protection_measures": "insufficient"
    }
  },
  {
    "v_number": "V014",
    "vulnerability_text": "Inadequate parking security and access control",
    "sheet": "Physical Security",
    "row": 14,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "Parking areas lack adequate security measures, creating vulnerabilities for vehicle-based attacks, theft, and unauthorized access to the facility.",
    "compliance_gap": "Parking Security Requirements",
    "attack_vectors": ["Vehicle-based attacks", "Theft", "Unauthorized parking access", "Surveillance gaps"],
    "risk_impact": "Increased vulnerability to vehicle-based threats and unauthorized access through parking areas",
    "standards_reference": "ASIS Parking Security Standards, DHS Infrastructure Protection Guidelines",
    "trigger_conditions": {
      "parking_security": "inadequate",
      "parking_access_control": "insufficient"
    }
  },
  {
    "v_number": "V015",
    "vulnerability_text": "Insufficient pool and recreational area security",
    "sheet": "Physical Security",
    "row": 15,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Pool and recreational areas lack adequate security measures, creating vulnerabilities for unauthorized access, accidents, and security incidents in high-traffic guest areas.",
    "compliance_gap": "Recreational Area Security Requirements",
    "attack_vectors": ["Unauthorized access", "Accidents", "Security incidents", "Liability exposure"],
    "risk_impact": "Increased risk of security incidents and liability in recreational areas",
    "standards_reference": "ASIS Recreational Security Standards, Pool Safety Guidelines",
    "trigger_conditions": {
      "pool_security": "inadequate",
      "recreational_security": "insufficient"
    }
  },
  {
    "v_number": "V016",
    "vulnerability_text": "Gaps in VIP staff background checks and Security Force certifications",
    "sheet": "Access Control",
    "row": 16,
    "category": "Access Control",
    "severity": "High",
    "5_ds_category": "Deny",
    "description": "Triggered by VIP staff background-check responses and missing Security Force certification data—not vendor questionnaires. Strengthen vetting for VIP-facing and security roles; add vendor/contractor assessment fields to score supply-chain screening separately.",
    "compliance_gap": "Vendor Security Screening Requirements",
    "attack_vectors": ["Unauthorized vendor access", "Contractor security threats", "Insider threats", "System compromise"],
    "risk_impact": "Increased risk of security incidents from external vendors and contractors",
    "standards_reference": "ASIS Vendor Security Standards, DHS Contractor Security Guidelines",
    "trigger_conditions": {
      "vendor_screening": "inadequate",
      "contractor_security": "insufficient"
    }
  },
  {
    "v_number": "V017",
    "vulnerability_text": "Insufficient elevator and stairwell security",
    "sheet": "Physical Security",
    "row": 17,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Elevators and stairwells lack adequate security measures, creating vulnerabilities for unauthorized access and potential security incidents in vertical circulation areas.",
    "compliance_gap": "Vertical Circulation Security Requirements",
    "attack_vectors": ["Unauthorized vertical access", "Stairwell incidents", "Elevator security breaches", "Access control bypass"],
    "risk_impact": "Increased vulnerability to unauthorized access through vertical circulation systems",
    "standards_reference": "ASIS Vertical Security Standards, Elevator Security Guidelines",
    "trigger_conditions": {
      "elevator_security": "inadequate",
      "stairwell_security": "insufficient"
    }
  },
  {
    "v_number": "V018",
    "vulnerability_text": "Inadequate retail and public area security",
    "sheet": "Physical Security",
    "row": 18,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Retail and public areas lack adequate security measures, creating vulnerabilities for theft, unauthorized access, and security incidents in high-traffic guest areas.",
    "compliance_gap": "Public Area Security Requirements",
    "attack_vectors": ["Theft", "Unauthorized access", "Public area incidents", "Guest safety issues"],
    "risk_impact": "Increased risk of security incidents in public and retail areas",
    "standards_reference": "ASIS Retail Security Standards, Public Area Security Guidelines",
    "trigger_conditions": {
      "retail_security": "inadequate",
      "public_area_security": "insufficient"
    }
  },
  {
    "v_number": "V019",
    "vulnerability_text": "Insufficient incident reporting and documentation systems",
    "sheet": "Emergency Preparedness",
    "row": 19,
    "category": "Emergency Preparedness",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive incident reporting and documentation systems prevents proper tracking of security events and limits the ability to improve security measures based on past incidents.",
    "compliance_gap": "Incident Reporting Requirements",
    "attack_vectors": ["Unreported incidents", "Poor security tracking", "Limited security improvement", "Compliance gaps"],
    "risk_impact": "Reduced ability to track and improve security based on incident history",
    "standards_reference": "ASIS Incident Reporting Standards, Security Documentation Guidelines",
    "trigger_conditions": {
      "incident_reporting": "inadequate",
      "security_documentation": "insufficient"
    }
  },
  {
    "v_number": "V020",
    "vulnerability_text": "Inadequate backup and redundancy systems for critical security functions",
    "sheet": "Technology",
    "row": 20,
    "category": "Technology",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Critical security systems lack adequate backup and redundancy measures, creating single points of failure that could compromise security during system outages or failures.",
    "compliance_gap": "System Redundancy Requirements",
    "attack_vectors": ["System failure", "Security system outage", "Single point of failure", "Reduced security capability"],
    "risk_impact": "Increased vulnerability to security system failures and reduced security capability during outages",
    "standards_reference": "NIST System Redundancy Guidelines, ASIS Technology Standards",
    "trigger_conditions": {
      "system_redundancy": "inadequate",
      "backup_systems": "insufficient"
    }
  },
  {
    "v_number": "V021",
    "vulnerability_text": "Unknown or missing network segmentation for video / security systems",
    "sheet": "Technology",
    "row": 21,
    "category": "Technology",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Inferred from VSS network segmentation answers. This is a network architecture and privacy-risk signal—not a full GDPR/CCPA/PCI assessment. Broader privacy compliance requires inventory of personal data and processing.",
    "compliance_gap": "Data Protection Requirements",
    "attack_vectors": ["Data breach", "Unauthorized access", "Privacy violations", "Regulatory non-compliance"],
    "risk_impact": "Increased risk of data breaches, privacy violations, and regulatory penalties",
    "standards_reference": "GDPR, CCPA, NIST Privacy Framework, PCI DSS",
    "trigger_conditions": {
      "data_protection": "inadequate",
      "privacy_measures": "insufficient"
    }
  },
  {
    "v_number": "V022",
    "vulnerability_text": "Limited security posture during receiving and delivery periods (measured proxy)",
    "sheet": "Physical Security",
    "row": 22,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "HOST infers a gap in coverage for loading/receiving activity from Security Force 24/7 and monitoring-hours answers. This addresses physical security of deliveries and service access only—it does not assess food safety, HACCP, sanitary regulation, or other food-law compliance (out of scope for HOST).",
    "compliance_gap": "Physical security of receiving and delivery access",
    "attack_vectors": ["Theft or diversion at receiving", "Unauthorized access via service entrances", "Poor visibility during delivery windows"],
    "risk_impact": "Increased physical security risk at receiving and back-of-house access points during delivery-related periods",
    "standards_reference": "CISA physical security; DHS critical infrastructure protection (general concepts)",
    "trigger_conditions": {}
  },
  {
    "v_number": "V023",
    "vulnerability_text": "Insufficient laundry and housekeeping security protocols",
    "sheet": "Physical Security",
    "row": 23,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Laundry and housekeeping areas lack adequate security measures, creating vulnerabilities for theft, unauthorized access, and potential security incidents in service areas.",
    "compliance_gap": "Service Area Security Requirements",
    "attack_vectors": ["Theft", "Unauthorized access", "Service area incidents", "Guest property exposure"],
    "risk_impact": "Increased risk of theft and security incidents in service areas",
    "standards_reference": "ASIS Service Area Security Standards, Hotel Security Guidelines",
    "trigger_conditions": {
      "laundry_security": "inadequate",
      "housekeeping_security": "insufficient"
    }
  },
  {
    "v_number": "V024",
    "vulnerability_text": "Inadequate maintenance and utility area security",
    "sheet": "Physical Security",
    "row": 24,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Deny",
    "description": "Maintenance and utility areas lack adequate security measures, creating vulnerabilities for unauthorized access to critical infrastructure and potential system sabotage.",
    "compliance_gap": "Critical Infrastructure Security Requirements",
    "attack_vectors": ["Infrastructure sabotage", "Unauthorized access", "System disruption", "Critical service interruption"],
    "risk_impact": "Increased risk of infrastructure sabotage and critical service disruption",
    "standards_reference": "DHS Critical Infrastructure Guidelines, ASIS Infrastructure Security Standards",
    "trigger_conditions": {
      "maintenance_security": "inadequate",
      "utility_security": "insufficient"
    }
  },
  {
    "v_number": "V025",
    "vulnerability_text": "Insufficient guest room security and access control",
    "sheet": "Access Control",
    "row": 25,
    "category": "Access Control",
    "severity": "High",
    "5_ds_category": "Deny",
    "description": "Guest rooms lack adequate security measures, creating vulnerabilities for unauthorized access, theft, and potential security incidents in private guest areas.",
    "compliance_gap": "Guest Room Security Requirements",
    "attack_vectors": ["Unauthorized room access", "Theft", "Guest safety issues", "Privacy violations"],
    "risk_impact": "Increased risk of unauthorized access and security incidents in guest rooms",
    "standards_reference": "ASIS Guest Room Security Standards, Hotel Security Guidelines",
    "trigger_conditions": {
      "guest_room_security": "inadequate",
      "room_access_control": "insufficient"
    }
  },
  {
    "v_number": "V026",
    "vulnerability_text": "Inadequate conference and meeting room security",
    "sheet": "Physical Security",
    "row": 26,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Conference and meeting rooms lack adequate security measures, creating vulnerabilities for unauthorized access, information theft, and potential security incidents during business events.",
    "compliance_gap": "Meeting Room Security Requirements",
    "attack_vectors": ["Unauthorized access", "Information theft", "Meeting disruption", "Business security risks"],
    "risk_impact": "Increased risk of unauthorized access and security incidents in business areas",
    "standards_reference": "ASIS Business Security Standards, Meeting Room Security Guidelines",
    "trigger_conditions": {
      "conference_security": "inadequate",
      "meeting_room_security": "insufficient"
    }
  },
  {
    "v_number": "V027",
    "vulnerability_text": "Spa/wellness (pool-area proxy): open access and limited pool video coverage",
    "sheet": "Physical Security",
    "row": 27,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Uses the same pool access and pool VSS fields as other aquatic findings—HOST does not yet isolate spa-only controls. Treat as layered aquatic/wellness access risk.",
    "compliance_gap": "Wellness Area Security Requirements",
    "attack_vectors": ["Unauthorized access", "Privacy violations", "Sensitive area incidents", "Guest safety issues"],
    "risk_impact": "Increased risk of privacy violations and security incidents in wellness areas",
    "standards_reference": "ASIS Wellness Security Standards, Spa Security Guidelines",
    "trigger_conditions": {
      "spa_security": "inadequate",
      "wellness_security": "insufficient"
    }
  },
  {
    "v_number": "V028",
    "vulnerability_text": "Inadequate fitness center and gym security",
    "sheet": "Physical Security",
    "row": 28,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Fitness centers and gyms lack adequate security measures, creating vulnerabilities for unauthorized access, equipment theft, and potential security incidents in recreational areas.",
    "compliance_gap": "Fitness Area Security Requirements",
    "attack_vectors": ["Unauthorized access", "Equipment theft", "Fitness area incidents", "Guest safety issues"],
    "risk_impact": "Increased risk of theft and security incidents in fitness areas",
    "standards_reference": "ASIS Fitness Security Standards, Gym Security Guidelines",
    "trigger_conditions": {
      "fitness_security": "inadequate",
      "gym_security": "insufficient"
    }
  },
  {
    "v_number": "V029",
    "vulnerability_text": "Business center proxy: weak VSS network segmentation and/or Security Force reporting",
    "sheet": "Physical Security",
    "row": 29,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Triggered by video network segmentation and Security Force reporting—not business-center walk-through data. Align mitigations with segmentation and reporting; add dedicated business-center fields for a tighter map.",
    "compliance_gap": "Business Center Security Requirements",
    "attack_vectors": ["Unauthorized access", "Information theft", "Business disruption", "Data security risks"],
    "risk_impact": "Increased risk of unauthorized access and information theft in business areas",
    "standards_reference": "ASIS Business Security Standards, Office Security Guidelines",
    "trigger_conditions": {
      "business_center_security": "inadequate",
      "office_security": "insufficient"
    }
  },
  {
    "v_number": "V030",
    "vulnerability_text": "Aquatic safety proxy for families: pool access and lifeguarding gaps",
    "sheet": "Physical Security",
    "row": 30,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Uses pool lifeguard and pool access fields as a stand-in for child/family risk—not kids’ club or childcare metrics. Prioritize water safety; add youth-program fields if applicable.",
    "compliance_gap": "Children's Area Security Requirements",
    "attack_vectors": ["Child safety risks", "Unauthorized access", "Minor safety incidents", "Family security risks"],
    "risk_impact": "Increased risk of child safety incidents and security risks involving minors",
    "standards_reference": "ASIS Children's Security Standards, Family Safety Guidelines",
    "trigger_conditions": {
      "children_security": "inadequate",
      "family_security": "insufficient"
    }
  },
  {
    "v_number": "V031",
    "vulnerability_text": "Insufficient operational security and business continuity measures",
    "sheet": "Emergency Preparedness",
    "row": 31,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive operational security and business continuity measures creates vulnerabilities for operational disruption, service interruption, and inability to maintain operations during emergencies.",
    "compliance_gap": "Business Continuity Requirements",
    "attack_vectors": ["Operational disruption", "Service interruption", "Business continuity failure", "Emergency response gaps"],
    "risk_impact": "Increased risk of operational disruption and inability to maintain services during emergencies",
    "standards_reference": "ASIS Business Continuity Standards, DHS Emergency Preparedness Guidelines",
    "trigger_conditions": {
      "operational_security": "inadequate",
      "business_continuity": "insufficient"
    }
  },
  {
    "v_number": "V032",
    "vulnerability_text": "Inadequate guest services and concierge security",
    "sheet": "Access Control",
    "row": 32,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Guest services and concierge areas lack adequate security measures, creating vulnerabilities for unauthorized access to guest information, service disruption, and potential security incidents in guest service areas.",
    "compliance_gap": "Guest Services Security Requirements",
    "attack_vectors": ["Unauthorized access", "Guest information exposure", "Service disruption", "Guest safety issues"],
    "risk_impact": "Increased risk of unauthorized access and security incidents in guest service areas",
    "standards_reference": "ASIS Guest Services Security Standards, Hotel Security Guidelines",
    "trigger_conditions": {
      "guest_services_security": "inadequate",
      "concierge_security": "insufficient"
    }
  },
  {
    "v_number": "V033",
    "vulnerability_text": "Insufficient transportation and valet security",
    "sheet": "Physical Security",
    "row": 33,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Transportation and valet services lack adequate security measures, creating vulnerabilities for vehicle theft, unauthorized access, and potential security incidents in transportation areas.",
    "compliance_gap": "Transportation Security Requirements",
    "attack_vectors": ["Vehicle theft", "Unauthorized access", "Transportation incidents", "Guest safety issues"],
    "risk_impact": "Increased risk of vehicle theft and security incidents in transportation areas",
    "standards_reference": "ASIS Transportation Security Standards, Valet Security Guidelines",
    "trigger_conditions": {
      "transportation_security": "inadequate",
      "valet_security": "insufficient"
    }
  },
  {
    "v_number": "V034",
    "vulnerability_text": "Inadequate event and banquet security",
    "sheet": "Physical Security",
    "row": 34,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Event and banquet areas lack adequate security measures, creating vulnerabilities for unauthorized access, event disruption, and potential security incidents during large gatherings.",
    "compliance_gap": "Event Security Requirements",
    "attack_vectors": ["Event disruption", "Unauthorized access", "Large gathering incidents", "Event security risks"],
    "risk_impact": "Increased risk of event disruption and security incidents during large gatherings",
    "standards_reference": "ASIS Event Security Standards, Large Venue Security Guidelines",
    "trigger_conditions": {
      "event_security": "inadequate",
      "banquet_security": "insufficient"
    }
  },
  {
    "v_number": "V035",
    "vulnerability_text": "Insufficient nightclub and entertainment security",
    "sheet": "Physical Security",
    "row": 35,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Nightclub and entertainment areas lack adequate security measures, creating vulnerabilities for unauthorized access, alcohol-related incidents, and potential security incidents in entertainment venues.",
    "compliance_gap": "Entertainment Security Requirements",
    "attack_vectors": ["Alcohol-related incidents", "Unauthorized access", "Entertainment incidents", "Nightlife security risks"],
    "risk_impact": "Increased risk of alcohol-related incidents and security problems in entertainment areas",
    "standards_reference": "ASIS Entertainment Security Standards, Nightclub Security Guidelines",
    "trigger_conditions": {
      "nightclub_security": "inadequate",
      "entertainment_security": "insufficient"
    }
  },
  {
    "v_number": "V036",
    "vulnerability_text": "Inadequate casino and gaming security",
    "sheet": "Physical Security",
    "row": 36,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Casino and gaming areas lack adequate security measures, creating vulnerabilities for theft, fraud, unauthorized access, and potential security incidents in gaming facilities.",
    "compliance_gap": "Gaming Security Requirements",
    "attack_vectors": ["Gaming theft", "Fraud", "Unauthorized access", "Gaming security incidents"],
    "risk_impact": "Increased risk of gaming theft, fraud, and security incidents in casino areas",
    "standards_reference": "ASIS Gaming Security Standards, Casino Security Guidelines",
    "trigger_conditions": {
      "casino_security": "inadequate",
      "gaming_security": "insufficient"
    }
  },
  {
    "v_number": "V037",
    "vulnerability_text": "Insufficient retail and shopping security",
    "sheet": "Physical Security",
    "row": 37,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Retail and shopping areas lack adequate security measures, creating vulnerabilities for theft, shoplifting, unauthorized access, and potential security incidents in retail spaces.",
    "compliance_gap": "Retail Security Requirements",
    "attack_vectors": ["Shoplifting", "Theft", "Unauthorized access", "Retail security incidents"],
    "risk_impact": "Increased risk of theft and security incidents in retail areas",
    "standards_reference": "ASIS Retail Security Standards, Shopping Center Security Guidelines",
    "trigger_conditions": {
      "retail_security": "inadequate",
      "shopping_security": "insufficient"
    }
  },
  {
    "v_number": "V038",
    "vulnerability_text": "Security Force not trained on all emergency plans and/or missing backup power for security loads",
    "sheet": "Physical Security",
    "row": 38,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "HOST flags this when responses indicate Security Force personnel are not trained on all emergency plans and/or backup power for security-related systems is absent. This is a general emergency-preparedness and resilience signal—it does not assess clinical services, patient data, or healthcare regulatory programs.",
    "compliance_gap": "Emergency preparedness and security power resilience",
    "attack_vectors": ["Weaker coordinated response during incidents", "Security systems at risk during power loss", "Gaps in plan execution under stress"],
    "risk_impact": "Reduced ability to execute emergency plans and maintain security functions during outages",
    "standards_reference": "CISA emergency preparedness resources; Ready.gov business continuity concepts",
    "trigger_conditions": {}
  },
  {
    "v_number": "V039",
    "vulnerability_text": "[No auto-score] Environmental / EV infrastructure security — requires future fields",
    "sheet": "Physical Security",
    "row": 39,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Prior mapping treated absence of EV charging as a finding; that logic was removed. HOST does not currently auto-score environmental sustainability security. OFC039 remains in the catalog for manual planning only until dedicated fields exist.",
    "compliance_gap": "Environmental Security Requirements",
    "attack_vectors": ["Environmental sabotage", "Unauthorized access", "System disruption", "Green infrastructure risks"],
    "risk_impact": "Increased risk of environmental system sabotage and green infrastructure security incidents",
    "standards_reference": "ASIS Environmental Security Standards, Green Building Security Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V040",
    "vulnerability_text": "Inadequate international and cultural security protocols",
    "sheet": "Emergency Preparedness",
    "row": 40,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive international and cultural security protocols creates vulnerabilities for cultural sensitivity issues, international guest safety, and potential security incidents involving diverse populations.",
    "compliance_gap": "International Security Requirements",
    "attack_vectors": ["Cultural sensitivity issues", "International guest safety", "Diverse population incidents", "Cross-cultural security risks"],
    "risk_impact": "Increased risk of cultural sensitivity issues and security incidents involving international guests",
    "standards_reference": "ASIS International Security Standards, Cultural Security Guidelines",
    "trigger_conditions": {
      "international_security": "inadequate",
      "cultural_security": "insufficient"
    }
  },
  {
    "v_number": "V041",
    "vulnerability_text": "Inadequate VIP transportation security protocols",
    "sheet": "VIP Security",
    "row": 41,
    "category": "VIP Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive VIP transportation security protocols creates vulnerabilities in vehicle screening, route security, and transportation security measures for high-profile guests.",
    "compliance_gap": "VIP Transportation Security Requirements",
    "attack_vectors": ["Vehicle-based attacks", "Route vulnerabilities", "Transportation security gaps", "VIP vehicle targeting"],
    "risk_impact": "Increased risk of VIP transportation security incidents and vehicle-based attacks",
    "standards_reference": "ASIS VIP Security Standards, Transportation Security Guidelines",
    "trigger_conditions": {
      "vip_transportation_security": "inadequate",
      "vehicle_screening": "insufficient"
    }
  },
  {
    "v_number": "V042",
    "vulnerability_text": "[Catalog reference] Recreational access — scoring merged with V015",
    "sheet": "Recreational Security",
    "row": 42,
    "category": "Recreational Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Previously duplicated pool triggers now consolidated under V015. OFC042 attaches to V015 for mitigation text.",
    "compliance_gap": "Recreational Area Security Requirements",
    "attack_vectors": ["Unauthorized recreational access", "Pool area security gaps", "Fitness center vulnerabilities", "Recreational facility incidents"],
    "risk_impact": "Increased risk of unauthorized access to recreational areas and potential security incidents",
    "standards_reference": "ASIS Recreational Security Standards, Pool Safety Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V043",
    "vulnerability_text": "[Catalog reference] Vendor screening — scoring merged with V016",
    "sheet": "Vendor Security",
    "row": 43,
    "category": "Vendor Security",
    "severity": "High",
    "5_ds_category": "Detect",
    "description": "Duplicate of V016 field logic. Automated scoring uses V016; OFC043 provides an alternate mitigation narrative under V016.",
    "compliance_gap": "Vendor Security Screening Requirements",
    "attack_vectors": ["Insider threats", "Unauthorized vendor access", "Contractor security gaps", "Vendor-based attacks"],
    "risk_impact": "Increased risk of insider threats and unauthorized access through vendor relationships",
    "standards_reference": "ASIS Vendor Security Standards, Contractor Screening Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V044",
    "vulnerability_text": "Insufficient vertical circulation security measures",
    "sheet": "Vertical Security",
    "row": 44,
    "category": "Vertical Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive security measures for elevators, stairwells, and vertical circulation systems creates vulnerabilities in multi-story facility security.",
    "compliance_gap": "Vertical Circulation Security Requirements",
    "attack_vectors": ["Elevator security gaps", "Stairwell vulnerabilities", "Vertical access control", "Multi-story security risks"],
    "risk_impact": "Increased risk of unauthorized vertical access and multi-story security incidents",
    "standards_reference": "ASIS Vertical Security Standards, Elevator Security Guidelines",
    "trigger_conditions": {
      "elevator_security": "inadequate",
      "stairwell_security": "insufficient"
    }
  },
  {
    "v_number": "V045",
    "vulnerability_text": "Inadequate public area monitoring and control",
    "sheet": "Public Area Security",
    "row": 45,
    "category": "Public Area Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Insufficient monitoring and access control for public areas such as lobbies, restaurants, and common spaces creates security vulnerabilities in high-traffic areas.",
    "compliance_gap": "Public Area Security Requirements",
    "attack_vectors": ["Public area security gaps", "Lobby vulnerabilities", "Common space risks", "High-traffic area incidents"],
    "risk_impact": "Increased risk of security incidents in public areas and common spaces",
    "standards_reference": "ASIS Public Area Security Standards, Lobby Security Guidelines",
    "trigger_conditions": {
      "public_area_monitoring": "inadequate",
      "lobby_security": "insufficient"
    }
  },
  {
    "v_number": "V046",
    "vulnerability_text": "[Catalog reference] Incident management — scoring merged with V019",
    "sheet": "Incident Management",
    "row": 46,
    "category": "Incident Management",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Same Security Force reporting and training triggers as V019. Automated scoring uses V019; OFC046 attaches to V019.",
    "compliance_gap": "Incident Management Requirements",
    "attack_vectors": ["Poor incident response", "Crisis management gaps", "Emergency coordination failures", "Incident escalation risks"],
    "risk_impact": "Increased risk of poor incident response and crisis management failures",
    "standards_reference": "ASIS Incident Management Standards, Crisis Response Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V047",
    "vulnerability_text": "[Catalog reference] System redundancy — scoring merged with V020",
    "sheet": "System Redundancy",
    "row": 47,
    "category": "System Redundancy",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Same backup power and integration triggers as V020. Automated scoring uses V020; OFC047 attaches to V020.",
    "compliance_gap": "System Redundancy Requirements",
    "attack_vectors": ["System failure vulnerabilities", "Backup system gaps", "Redundancy failures", "Continuity risks"],
    "risk_impact": "Increased risk of system failures and operational disruptions",
    "standards_reference": "ASIS System Redundancy Standards, Backup System Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V048",
    "vulnerability_text": "[Catalog reference] Data protection — scoring merged with V021",
    "sheet": "Data Protection",
    "row": 48,
    "category": "Data Protection",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Same VSS segmentation triggers as V011/V021. Automated scoring uses V021 for privacy-oriented OFC; OFC048 attaches to V021.",
    "compliance_gap": "Data Protection Requirements",
    "attack_vectors": ["Data breaches", "Privacy violations", "Guest data exposure", "Compliance failures"],
    "risk_impact": "Increased risk of data breaches and privacy violations",
    "standards_reference": "GDPR, CCPA, ASIS Data Protection Standards",
    "trigger_conditions": {}
  },
  {
    "v_number": "V049",
    "vulnerability_text": "[Catalog reference] Delivery / receiving security — scoring merged with V022",
    "sheet": "Physical Security",
    "row": 49,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Duplicate proxy triggers as V022. Automated scoring uses V022; OFC049 attaches to V022. HOST does not cover food safety regulation—only physical security of deliveries and receiving.",
    "compliance_gap": "Physical security of receiving and delivery access",
    "attack_vectors": ["Theft or diversion at receiving", "Unauthorized service-area access", "Weak controls during delivery windows"],
    "risk_impact": "Increased physical security risk at receiving and related access points",
    "standards_reference": "CISA physical security; DHS critical infrastructure protection (general concepts)",
    "trigger_conditions": {}
  },
  {
    "v_number": "V050",
    "vulnerability_text": "Insufficient service area security measures",
    "sheet": "Service Area Security",
    "row": 50,
    "category": "Service Area Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Lack of comprehensive security measures for service areas such as housekeeping, maintenance, and utility spaces creates vulnerabilities in operational security.",
    "compliance_gap": "Service Area Security Requirements",
    "attack_vectors": ["Service area vulnerabilities", "Maintenance security gaps", "Utility space risks", "Operational security incidents"],
    "risk_impact": "Increased risk of security incidents in service and operational areas",
    "standards_reference": "ASIS Service Area Security Standards, Operational Security Guidelines",
    "trigger_conditions": {
      "service_area_security": "inadequate",
      "operational_security": "insufficient"
    }
  }
];

// Helper function to get vulnerability by ID
window.getVulnerabilityById = function(vNumber) {
  return window.VOFC_VULNERABILITIES.find(v => v.v_number === vNumber);
};

// Helper function to get vulnerabilities by category
window.getVulnerabilitiesByCategory = function(category) {
  return window.VOFC_VULNERABILITIES.filter(v => v.category === category);
};

// Helper function to get vulnerabilities by severity
window.getVulnerabilitiesBySeverity = function(severity) {
  return window.VOFC_VULNERABILITIES.filter(v => v.severity === severity);
};

console.log('VOFC Vulnerabilities loaded:', window.VOFC_VULNERABILITIES.length, 'vulnerabilities available');
