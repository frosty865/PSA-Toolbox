// VOFC Vulnerabilities Database for HOST V3 integration
// This file contains 400+ pre-defined vulnerabilities for automated security assessment

window.VOFC_VULNERABILITIES = [
  {
    "v_number": "V001",
    "vulnerability_text": "Critical perimeter exposure from missing vehicle barriers or fencing",
    "sheet": "Perimeter Security",
    "row": 1,
    "category": "Physical Security",
    "severity": "Critical",
    "5_ds_category": "Deter",
    "description": "The property has no meaningful perimeter barrier, which allows vehicles and pedestrians to approach the site without a strong first layer of control. That increases exposure to unauthorized access and other preventable incidents.",
    "compliance_gap": "CISA Guidelines Section 3.1 - Perimeter Security",
    "attack_vectors": ["Vehicle ramming", "Bomb placement", "Direct building access", "Unauthorized infiltration"],
    "risk_impact": "Raises exposure to unauthorized access, vehicle threats, and other preventable incidents",
    "standards_reference": "CISA Security Guide, DHS Infrastructure Protection Guidelines",
    "trigger_conditions": {
      "perimeter_fencing": "No",
      "vehicle_barriers": "No",
      "property_enclosed": "not_enclosed"
    }
  },
  {
    "v_number": "V002",
    "vulnerability_text": "Critical monitoring gap from missing video surveillance",
    "sheet": "Technology",
    "row": 2,
    "category": "Technology",
    "severity": "Critical",
    "5_ds_category": "Detect",
    "description": "The property lacks a video-surveillance capability that would support early detection, incident review, and response coordination.",
    "compliance_gap": "CISA Guidelines Section 4.2 - Surveillance Systems",
    "attack_vectors": ["Undetected unauthorized access", "Unmonitored suspicious behavior", "No evidence collection", "Delayed threat detection"],
    "risk_impact": "Limits early detection and weakens the ability to review or respond to incidents",
    "standards_reference": "CISA Security Guide, NIST Cybersecurity Framework, ASIS Physical Security Standards",
    "trigger_conditions": {
      "vss_present": "No",
      "video_surveillance": "No"
    }
  },
  {
    "v_number": "V003",
    "vulnerability_text": "Security Force training does not fully support consistent response",
    "sheet": "Personnel Security",
    "row": 3,
    "category": "Personnel Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Security Force training does not fully cover procedures, emergency response, or threat recognition, which can create inconsistency during incidents.",
    "compliance_gap": "Personnel Security Training Requirements",
    "attack_vectors": ["Inadequate response to incidents", "Poor threat recognition", "Inconsistent security procedures"],
    "risk_impact": "Reduces response consistency and increases the chance of avoidable gaps during an incident",
    "standards_reference": "ASIS Personnel Security Standards",
    "trigger_conditions": {
      "staff_training": "basic",
      "security_training": "insufficient"
    }
  },
  {
    "v_number": "V004",
    "vulnerability_text": "Fire-alarm control panels are accessible without sufficient restriction",
    "sheet": "Emergency Preparedness",
    "row": 4,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The fire-alarm control panel is not sufficiently restricted, which can allow unauthorized access, accidental tampering, or delayed intervention during an emergency.",
    "compliance_gap": "Emergency Preparedness Requirements",
    "attack_vectors": ["Uncoordinated emergency response", "Delayed incident management", "Poor crisis communication"],
    "risk_impact": "Can delay alarm response, confuse emergency coordination, and create avoidable life-safety exposure",
    "standards_reference": "FEMA Emergency Management Guidelines",
    "trigger_conditions": {
      "emergency_policies": "No",
      "emergency_procedures": "missing"
    }
  },
  {
    "v_number": "V005",
    "vulnerability_text": "Electronic access control for doors, visitors, and logs is incomplete",
    "sheet": "Access Control",
    "row": 5,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "The property does not show a fully implemented electronic access-control layer for door entry, visitor tracking, and access logging.",
    "compliance_gap": "Access Control System Requirements",
    "attack_vectors": ["Unauthorized access", "Poor visitor tracking", "Limited access control"],
    "risk_impact": "Weakens control over who can enter the property and when",
    "standards_reference": "ASIS Access Control Standards",
    "trigger_conditions": {
      "access_control_system": "No",
      "electronic_access": "No"
    }
  },
  {
    "v_number": "V006",
    "vulnerability_text": "Perimeter lighting is insufficient for reliable visibility",
    "sheet": "Physical Security",
    "row": 6,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Perimeter lighting is not strong enough to eliminate blind spots or fully support monitoring around the site.",
    "compliance_gap": "Perimeter Security Lighting Requirements",
    "attack_vectors": ["Unauthorized access under cover of darkness", "Reduced surveillance effectiveness", "Increased vulnerability to perimeter breaches"],
    "risk_impact": "Reduces visibility and makes unauthorized access harder to spot",
    "standards_reference": "ASIS Physical Security Standards",
    "trigger_conditions": {
      "perimeter_lighting": "inadequate",
      "exterior_lighting": "insufficient"
    }
  },
  {
    "v_number": "V007",
    "vulnerability_text": "Surface parking and perimeter controls do not fully support layered access",
    "sheet": "Access Control",
    "row": 7,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "Open surface parking and weak perimeter controls create a layered-access issue that should be addressed before adding more advanced visitor processes.",
    "compliance_gap": "Visitor Management Requirements",
    "attack_vectors": ["Unauthorized visitor access", "Poor visitor tracking", "Inadequate visitor screening"],
    "risk_impact": "Increases the chance of unmanaged access through parking and entry areas",
    "standards_reference": "ASIS Visitor Management Standards",
    "trigger_conditions": {
      "visitor_management": "No",
      "visitor_tracking": "No"
    }
  },
  {
    "v_number": "V008",
    "vulnerability_text": "Standoff distance between vehicles and buildings is insufficient",
    "sheet": "Physical Security",
    "row": 8,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Guest arrival lanes, drop-off points, and building fronts do not maintain enough separation to support routine hotel operations and emergency access while also limiting vehicle approach risk.",
    "compliance_gap": "Standoff Distance Requirements - DHS recommends minimum 50 feet",
    "attack_vectors": ["Vehicle-borne attacks", "Explosive threats", "Direct building access"],
    "risk_impact": "Can disrupt guest arrival flow, limit safe queuing and emergency access, and leave the building more exposed to vehicle-based threats",
    "standards_reference": "DHS Infrastructure Protection Guidelines - Minimum 50 feet standoff distance",
    "trigger_conditions": {
      "standoff_distance": "insufficient",
      "building_protection": "inadequate"
    }
  },
  {
    "v_number": "V009",
    "vulnerability_text": "Dedicated security coverage is absent",
    "sheet": "Personnel Security",
    "row": 9,
    "category": "Personnel Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "The property does not show dedicated security coverage, which can limit response and visible deterrence.",
    "compliance_gap": "Security Personnel Requirements",
    "attack_vectors": ["Delayed security response", "Inconsistent security presence", "Reduced threat detection"],
    "risk_impact": "Reduces response speed and weakens visible security presence",
    "standards_reference": "ASIS Security Personnel Standards",
    "trigger_conditions": {
      "security_personnel": "No",
      "dedicated_security": "No"
    }
  },
  {
    "v_number": "V010",
    "vulnerability_text": "Emergency communication coverage and incident reporting are not fully defined",
    "sheet": "Emergency Preparedness",
    "row": 10,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The assessment suggests that monitoring coverage and incident-reporting procedures need clearer definition and documentation.",
    "compliance_gap": "Emergency Communication Requirements",
    "attack_vectors": ["Poor emergency coordination", "Delayed emergency response", "Inadequate crisis communication"],
    "risk_impact": "Creates uncertainty during incidents and slows leadership visibility",
    "standards_reference": "FEMA Emergency Communication Guidelines",
    "trigger_conditions": {
      "emergency_communication": "inadequate",
      "crisis_communication": "insufficient"
    }
  },
  {
    "v_number": "V011",
    "vulnerability_text": "Security network segmentation is not clearly separated",
    "sheet": "Technology",
    "row": 11,
    "category": "Technology",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The video and security network do not show clear separation between camera traffic, administrative access, and other systems, which can increase exposure if one path is compromised.",
    "compliance_gap": "Cybersecurity Requirements for Security Systems",
    "attack_vectors": ["System compromise", "Data breach", "Unauthorized access", "System disruption"],
    "risk_impact": "Raises the chance that one compromised system could affect others",
    "standards_reference": "NIST Cybersecurity Framework, CISA Security Guidelines",
    "trigger_conditions": {
      "vss_network_segmentation": "No",
      "cybersecurity_protection": "inadequate"
    }
  },
  {
    "v_number": "V012",
    "vulnerability_text": "Backup power for life-safety loads is not clearly confirmed",
    "sheet": "Emergency Preparedness",
    "row": 12,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The property does not clearly confirm backup power for fire-alarm, egress, or other life-safety loads, so critical safety systems may not stay available during an outage.",
    "compliance_gap": "Fire Safety Integration Requirements",
    "attack_vectors": ["Delayed fire response", "Poor emergency coordination", "System isolation"],
    "risk_impact": "Can interrupt life-safety functions and leave evacuation or alarm support unavailable during a power loss",
    "standards_reference": "NFPA Fire Safety Standards, ASIS Emergency Management Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V013",
    "vulnerability_text": "VIP arrival screening, escort routing, and departure coordination are incomplete",
    "sheet": "VIP Operations",
    "row": 13,
    "category": "VIP Operations",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Missing VIP arrival screening, escort routing, incident escalation, and departure coordination procedures reduce control over high-profile guest movement and response timing.",
    "compliance_gap": "VIP Security Protocol Requirements",
    "attack_vectors": ["VIP targeting", "Event disruption", "Security breach", "Reputation damage"],
    "risk_impact": "Can expose VIP movements, reduce escort reliability, and create avoidable incident response delays during high-profile stays",
    "standards_reference": "ASIS VIP Protection Standards, DHS Protective Security Guidelines",
    "trigger_conditions": {
      "vip_security_protocols": "inadequate",
      "vip_protection_measures": "insufficient"
    }
  },
  {
    "v_number": "V014",
    "vulnerability_text": "Parking vehicle screening, access gating, and surveillance are inadequate",
    "sheet": "Physical Security",
    "row": 14,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deny",
    "description": "Parking areas do not show enough vehicle screening, access gating, or surveillance coverage to separate authorized parking activity from uncontrolled entry.",
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
    "vulnerability_text": "Pool entry control, supervision, and monitoring are insufficient",
    "sheet": "Physical Security",
    "row": 15,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Pool and recreational areas do not show enough controlled entry, supervision, or monitoring to keep guest activity separated from unauthorized access and unattended use.",
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
    "description": "Elevators and stairwells do not show enough access restriction, monitoring, or zone separation to prevent uncontrolled movement between floors.",
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
    "description": "Retail and public areas do not show enough monitoring, access control, or incident visibility to manage high-traffic guest movement and shopping activity.",
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
    "description": "The property does not show a dependable way to log incidents, assign follow-up, and preserve a clear record for supervisors, insurers, and post-incident review.",
    "compliance_gap": "Incident Reporting Requirements",
    "attack_vectors": ["Unreported incidents", "Poor security tracking", "Limited security improvement", "Compliance gaps"],
    "risk_impact": "Can delay corrective action, weaken accountability, and make it harder to prove what happened during a guest, staff, or security incident",
    "standards_reference": "ASIS Incident Reporting Standards, Security Documentation Guidelines",
    "trigger_conditions": {
      "incident_reporting": "inadequate",
      "security_documentation": "insufficient"
    }
  },
  {
    "v_number": "V020",
    "vulnerability_text": "Critical security functions lack backup power and failover redundancy",
    "sheet": "Technology",
    "row": 20,
    "category": "Technology",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security-critical systems do not show backup power, failover, or duplicate control paths for access control, monitoring, or communications if a primary system fails.",
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
    "description": "Security video and related systems do not show separate network zones or access boundaries, which leaves footage, credentials, and administrative access too closely combined.",
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
    "vulnerability_text": "Inadequate receiving and delivery access control",
    "sheet": "Physical Security",
    "row": 22,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Receiving and delivery activity does not show enough control over service entrances, contractor movement, and visibility during delivery windows to support routine operations without avoidable exposure.",
    "compliance_gap": "Physical security of receiving and delivery access",
    "attack_vectors": ["Theft or diversion at receiving", "Unauthorized access via service entrances", "Poor visibility during delivery windows"],
    "risk_impact": "Can allow uncontrolled service-area access, complicate inventory handling, and increase theft or diversion risk during deliveries",
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
    "description": "Laundry and housekeeping areas do not show enough access control, storage separation, or staff oversight to keep linens, supplies, and guest property protected.",
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
    "description": "Maintenance and utility areas do not show enough restricted access, equipment segregation, or supervision to protect critical infrastructure from misuse or tampering.",
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
    "description": "Guest rooms do not show enough lock control, access logging, or intrusion deterrence to protect private guest areas from unauthorized entry.",
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
    "vulnerability_text": "Conference and meeting room access control and document protection are inadequate",
    "sheet": "Physical Security",
    "row": 26,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Conference and meeting rooms do not show enough room access control, document protection, or session oversight to keep business events private.",
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
    "vulnerability_text": "Spa and wellness areas lack clear access control and monitoring",
    "sheet": "Physical Security",
    "row": 27,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Spa and wellness areas do not show clearly defined entry control or surveillance coverage, which can leave higher-privacy guest spaces more exposed than intended.",
    "compliance_gap": "Wellness Area Security Requirements",
    "attack_vectors": ["Unauthorized access", "Privacy violations", "Sensitive area incidents", "Guest safety issues"],
    "risk_impact": "Can reduce privacy for guests, weaken control over sensitive amenities, and increase incident response difficulty in wellness spaces",
    "standards_reference": "ASIS Wellness Security Standards, Spa Security Guidelines",
    "trigger_conditions": {
      "spa_security": "inadequate",
      "wellness_security": "insufficient"
    }
  },
  {
    "v_number": "V028",
    "vulnerability_text": "Fitness center access control, equipment oversight, and supervision are inadequate",
    "sheet": "Physical Security",
    "row": 28,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Fitness centers and gyms do not show enough access control, equipment oversight, or supervision to keep recreational use separate from unauthorized entry.",
    "compliance_gap": "Fitness Area Security Requirements",
    "attack_vectors": ["Unauthorized access", "Equipment theft", "Fitness area incidents", "Guest safety issues"],
    "risk_impact": "Can increase equipment loss, expose guests to unsupervised activity, and weaken control over recreational spaces",
    "standards_reference": "ASIS Fitness Security Standards, Gym Security Guidelines",
    "trigger_conditions": {
      "fitness_security": "inadequate",
      "gym_security": "insufficient"
    }
  },
  {
    "v_number": "V029",
    "vulnerability_text": "Business center access and information control are not clearly segmented",
    "sheet": "Physical Security",
    "row": 29,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Business center areas do not show strong separation between public use, document handling, and monitoring, which can create avoidable exposure during guest and conference activity.",
    "compliance_gap": "Business Center Security Requirements",
    "attack_vectors": ["Unauthorized access", "Information theft", "Business disruption", "Data security risks"],
    "risk_impact": "Can expose guest and business documents, slow response to misuse, and reduce control over a publicly accessible work area",
    "standards_reference": "ASIS Business Security Standards, Office Security Guidelines",
    "trigger_conditions": {
      "business_center_security": "inadequate",
      "office_security": "insufficient"
    }
  },
  {
    "v_number": "V030",
    "vulnerability_text": "Pool access and lifeguarding controls are insufficient for family use",
    "sheet": "Physical Security",
    "row": 30,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Pool access controls and lifeguarding coverage do not show enough protection for family use, which increases the chance of unsafe access or delayed intervention at the waterline.",
    "compliance_gap": "Children's Area Security Requirements",
    "attack_vectors": ["Child safety risks", "Unauthorized access", "Minor safety incidents", "Family security risks"],
    "risk_impact": "Can increase the likelihood of injury, force staff distraction, and create avoidable liability during family-facing operations",
    "standards_reference": "ASIS Children's Security Standards, Family Safety Guidelines",
    "trigger_conditions": {
      "children_security": "inadequate",
      "family_security": "insufficient"
    }
  },
  {
    "v_number": "V031",
    "vulnerability_text": "Continuity planning, recovery order, and minimum-service fallback are incomplete",
    "sheet": "Emergency Preparedness",
    "row": 31,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The property does not show a documented continuity plan, recovery order, or minimum-service fallback for critical operations such as guest intake, communications, access control, and service support.",
    "compliance_gap": "Business Continuity Requirements",
    "attack_vectors": ["Operational disruption", "Service interruption", "Business continuity failure", "Emergency response gaps"],
    "risk_impact": "Can leave the hotel unable to prioritize essential services, maintain guest-facing operations, or recover quickly after an outage or emergency",
    "standards_reference": "ASIS Business Continuity Standards, DHS Emergency Preparedness Guidelines",
    "trigger_conditions": {
      "operational_security": "inadequate",
      "business_continuity": "insufficient"
    }
  },
  {
    "v_number": "V032",
    "vulnerability_text": "Guest services information handling and counter access controls are inadequate",
    "sheet": "Access Control",
    "row": 32,
    "category": "Access Control",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Guest services and concierge areas do not show enough information handling controls, counter access control, or supervision to protect guest data and service continuity.",
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
    "vulnerability_text": "Vehicle handoff, valet staging, and oversight controls are insufficient",
    "sheet": "Physical Security",
    "row": 33,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Transportation and valet operations do not show enough control over vehicle handoff, staging, or staff oversight to separate guest vehicles from general traffic and unauthorized access.",
    "compliance_gap": "Transportation Security Requirements",
    "attack_vectors": ["Vehicle theft", "Unauthorized access", "Transportation incidents", "Guest safety issues"],
    "risk_impact": "Can expose guest vehicles, slow curbside coordination, and weaken control over arrivals and departures",
    "standards_reference": "ASIS Transportation Security Standards, Valet Security Guidelines",
    "trigger_conditions": {
      "transportation_security": "inadequate",
      "valet_security": "insufficient"
    }
  },
  {
    "v_number": "V034",
    "vulnerability_text": "Event guest-list control, entry screening, and staff oversight are inadequate",
    "sheet": "Physical Security",
    "row": 34,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Event and banquet areas do not show enough guest list control, entry screening, or staff oversight to manage large gatherings safely.",
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
    "vulnerability_text": "Nightclub entry screening, crowd control, and incident response coverage are insufficient",
    "sheet": "Physical Security",
    "row": 35,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Nightclub and entertainment areas do not show enough entry screening, crowd control, or incident response coverage to manage late-night operations.",
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
    "vulnerability_text": "Casino surveillance, access control, and fraud detection are inadequate",
    "sheet": "Physical Security",
    "row": 36,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Casino and gaming areas do not show enough surveillance, access control, or fraud detection to protect gaming activity and cash handling.",
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
    "vulnerability_text": "Retail merchandise control, access oversight, and observation coverage are insufficient",
    "sheet": "Physical Security",
    "row": 37,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Retail and shopping areas do not show enough merchandise control, access oversight, or observation coverage to deter shoplifting and theft.",
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
    "vulnerability_text": "Security Force training does not cover all tracked emergency plan families",
    "sheet": "Physical Security",
    "row": 38,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security Force training does not show coverage for the tracked emergency plan families, including active shooter, bomb threat, medical emergency, fire safety, and severe weather procedures.",
    "compliance_gap": "Emergency preparedness training requirements",
    "attack_vectors": ["Weaker coordinated response during incidents", "Gaps in plan execution under stress", "Delayed incident handoff"],
    "risk_impact": "Can slow response, create inconsistent execution, and leave staff unprepared for one or more emergency scenarios",
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
    "v_number": "V051",
    "vulnerability_text": "Security-related systems do not show confirmed backup power",
    "sheet": "Physical Security",
    "row": 51,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security-related systems do not show confirmed backup power, so monitoring, access control, or communications may stop during a utility outage.",
    "compliance_gap": "Security power resilience requirements",
    "attack_vectors": ["Security system outage", "Loss of monitoring", "Loss of access control", "Reduced response capability"],
    "risk_impact": "Can leave monitoring, access control, or communications unavailable during a power loss",
    "standards_reference": "CISA emergency preparedness resources; Ready.gov business continuity concepts",
    "trigger_conditions": {}
  },
  {
    "v_number": "V052",
    "vulnerability_text": "Life-safety-supporting security functions lack enough backup power",
    "sheet": "Emergency Preparedness",
    "row": 52,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security functions that support life safety do not show enough backup power coverage to keep essential alarm or response support running during an outage.",
    "compliance_gap": "Life-safety power resilience requirements",
    "attack_vectors": ["Power loss", "Loss of response coordination", "Loss of life-safety support", "Delayed incident management"],
    "risk_impact": "Can interrupt alarm support, delay emergency coordination, and leave life-safety-related controls unavailable during a power failure",
    "standards_reference": "FEMA Emergency Management Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V040",
    "vulnerability_text": "Multilingual communication, international guest handling, and culturally aware escalation are inadequate",
    "sheet": "Emergency Preparedness",
    "row": 40,
    "category": "Emergency Preparedness",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "The property does not show clear guidance for multilingual communication, international guest handling, or culturally aware escalation during incidents involving diverse visitors.",
    "compliance_gap": "International Security Requirements",
    "attack_vectors": ["Cultural sensitivity issues", "International guest safety", "Diverse population incidents", "Cross-cultural security risks"],
    "risk_impact": "Can slow communication, create guest-service friction, and complicate response when language or cultural context matters",
    "standards_reference": "ASIS International Security Standards, Cultural Security Guidelines",
    "trigger_conditions": {
      "international_security": "inadequate",
      "cultural_security": "insufficient"
    }
  },
  {
    "v_number": "V041",
    "vulnerability_text": "VIP vehicle screening, route planning, and transfer coordination are inadequate",
    "sheet": "VIP Security",
    "row": 41,
    "category": "VIP Security",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "VIP transportation does not show enough control over vehicle screening, route planning, and transfer coordination to support high-profile arrivals and departures.",
    "compliance_gap": "VIP Transportation Security Requirements",
    "attack_vectors": ["Vehicle-based attacks", "Route vulnerabilities", "Transportation security gaps", "VIP vehicle targeting"],
    "risk_impact": "Can expose high-profile guests to route or arrival exposure and make movement coordination harder to secure",
    "standards_reference": "ASIS VIP Security Standards, Transportation Security Guidelines",
    "trigger_conditions": {
      "vip_transportation_security": "inadequate",
      "vehicle_screening": "insufficient"
    }
  },
  {
    "v_number": "V042",
    "vulnerability_text": "Recreational areas lack direct access controls and visible oversight",
    "sheet": "Recreational Security",
    "row": 42,
    "category": "Recreational Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Recreational spaces do not show direct access control or oversight strong enough to separate guest activity from general circulation.",
    "compliance_gap": "Recreational Area Security Requirements",
    "attack_vectors": ["Unauthorized recreational access", "Pool area security gaps", "Fitness center vulnerabilities", "Recreational facility incidents"],
    "risk_impact": "Can allow unmanaged access to guest amenities and complicate supervision during busy operating periods",
    "standards_reference": "ASIS Recreational Security Standards, Pool Safety Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V043",
    "vulnerability_text": "Vendor and contractor screening is not sufficiently controlled",
    "sheet": "Vendor Security",
    "row": 43,
    "category": "Vendor Security",
    "severity": "High",
    "5_ds_category": "Detect",
    "description": "Vendor and contractor access does not show enough screening or control to support reliable separation between outside work crews and guest-facing operations.",
    "compliance_gap": "Vendor Security Screening Requirements",
    "attack_vectors": ["Insider threats", "Unauthorized vendor access", "Contractor security gaps", "Vendor-based attacks"],
    "risk_impact": "Can create uncontrolled access for outside workers and increase the chance of theft, misuse, or after-hours exposure",
    "standards_reference": "ASIS Vendor Security Standards, Contractor Screening Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V044",
    "vulnerability_text": "Elevator and stairwell access restriction and zone separation are insufficient",
    "sheet": "Vertical Security",
    "row": 44,
    "category": "Vertical Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Elevators and stairwells do not show enough control to keep vertical movement separated between guest, staff, and restricted traffic.",
    "compliance_gap": "Vertical Circulation Security Requirements",
    "attack_vectors": ["Elevator security gaps", "Stairwell vulnerabilities", "Vertical access control", "Multi-story security risks"],
    "risk_impact": "Can allow unauthorized movement between floors, weaken zone separation, and complicate response during an incident",
    "standards_reference": "ASIS Vertical Security Standards, Elevator Security Guidelines",
    "trigger_conditions": {
      "elevator_security": "inadequate",
      "stairwell_security": "insufficient"
    }
  },
  {
    "v_number": "V045",
    "vulnerability_text": "Public area monitoring, access control, and crowd observation are inadequate",
    "sheet": "Public Area Security",
    "row": 45,
    "category": "Public Area Security",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Lobbies, restaurants, and common spaces do not show enough monitoring or control to manage high-traffic guest movement without avoidable blind spots.",
    "compliance_gap": "Public Area Security Requirements",
    "attack_vectors": ["Public area security gaps", "Lobby vulnerabilities", "Common space risks", "High-traffic area incidents"],
    "risk_impact": "Can reduce visibility into guest movement, delay intervention, and increase the chance of disorder or opportunistic incidents",
    "standards_reference": "ASIS Public Area Security Standards, Lobby Security Guidelines",
    "trigger_conditions": {
      "public_area_monitoring": "inadequate",
      "lobby_security": "insufficient"
    }
  },
  {
    "v_number": "V046",
    "vulnerability_text": "Incident management and escalation procedures are not clearly documented",
    "sheet": "Incident Management",
    "row": 46,
    "category": "Incident Management",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Incident escalation, handoff, and follow-up responsibilities are not clearly documented enough to support consistent response or review.",
    "compliance_gap": "Incident Management Requirements",
    "attack_vectors": ["Poor incident response", "Crisis management gaps", "Emergency coordination failures", "Incident escalation risks"],
    "risk_impact": "Can slow escalation, blur responsibility, and make it harder to coordinate response during guest or staff incidents",
    "standards_reference": "ASIS Incident Management Standards, Crisis Response Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V047",
    "vulnerability_text": "Security-critical systems lack sufficient redundancy and backup",
    "sheet": "System Redundancy",
    "row": 47,
    "category": "System Redundancy",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security-related systems do not show enough redundancy to keep them operating when a primary power or system path fails.",
    "compliance_gap": "System Redundancy Requirements",
    "attack_vectors": ["System failure vulnerabilities", "Backup system gaps", "Redundancy failures", "Continuity risks"],
    "risk_impact": "Can interrupt security functions, slow recovery, and leave key controls unavailable during outages",
    "standards_reference": "ASIS System Redundancy Standards, Backup System Guidelines",
    "trigger_conditions": {}
  },
  {
    "v_number": "V048",
    "vulnerability_text": "Security video and related systems are not clearly segmented for data protection",
    "sheet": "Data Protection",
    "row": 48,
    "category": "Data Protection",
    "severity": "High",
    "5_ds_category": "Defend",
    "description": "Security video and related systems do not show clear segmentation or separation of access, increasing the chance that footage or related data could be mishandled.",
    "compliance_gap": "Data Protection Requirements",
    "attack_vectors": ["Data breaches", "Privacy violations", "Guest data exposure", "Compliance failures"],
    "risk_impact": "Can expose sensitive footage or related data, complicate access oversight, and increase privacy and compliance risk",
    "standards_reference": "GDPR, CCPA, ASIS Data Protection Standards",
    "trigger_conditions": {}
  },
  {
    "v_number": "V049",
    "vulnerability_text": "Delivery and receiving areas lack sufficient physical security controls",
    "sheet": "Physical Security",
    "row": 49,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Delivery and receiving areas do not show enough physical security control to keep service traffic separated from general operations.",
    "compliance_gap": "Physical security of receiving and delivery access",
    "attack_vectors": ["Theft or diversion at receiving", "Unauthorized service-area access", "Weak controls during delivery windows"],
    "risk_impact": "Can allow untracked access to back-of-house areas, increase diversion risk, and weaken control over deliveries",
    "standards_reference": "CISA physical security; DHS critical infrastructure protection (general concepts)",
    "trigger_conditions": {}
  },
  {
    "v_number": "V050",
    "vulnerability_text": "Service area access control, storage separation, and supervision are insufficient",
    "sheet": "Service Area Security",
    "row": 50,
    "category": "Service Area Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Housekeeping, maintenance, and utility spaces do not show enough access control, storage separation, or supervision to keep service activity from spilling into guest-facing operations.",
    "compliance_gap": "Service Area Security Requirements",
    "attack_vectors": ["Service area vulnerabilities", "Maintenance security gaps", "Utility space risks", "Operational security incidents"],
    "risk_impact": "Can allow unauthorized movement through back-of-house areas, increase theft risk, and weaken control over operational spaces",
    "standards_reference": "ASIS Service Area Security Standards, Operational Security Guidelines",
    "trigger_conditions": {
      "service_area_security": "inadequate",
      "operational_security": "insufficient"
    }
  }
];

function getSeverityFromEvidence(v) {
  const text = `${String(v?.vulnerability_text || '')} ${String(v?.description || '')} ${String(v?.risk_impact || '')} ${String(v?.category || '')}`.toLowerCase();
  const triggerText = JSON.stringify(v?.trigger_conditions || {}).toLowerCase();
  const vectors = Array.isArray(v?.attack_vectors) ? v.attack_vectors.join(' ').toLowerCase() : '';
  const lifeSafetySignals = /(life-safety|evacuation|fire|sprinkler|standpipe|medical|panic|hostile|hostage|active shooter)/.test(text);
  const perimeterSignals = /(perimeter|fencing|vehicle barrier|bollard|standoff|public access|restricted access|unauthorized access)/.test(text);
  const continuitySignals = /(backup power|runtime|utility|dependency|generator|redundancy|single point of failure|outage)/.test(text);
  const cyberPhysicalSignals = /(surveillance|video|access control|network|cyber|system compromise|credential|electronic lock|alarm)/.test(text);
  const highConsequenceAbsence = /(no|not|missing|absent|unavailable|disabled|lacks?|lack of)\b/.test(text);
  const broadExposure = /(guest|public|site-wide|facility-wide|restricted|vip|crowd|multi-story)/.test(text);
  const manyVectors = (Array.isArray(v?.attack_vectors) ? v.attack_vectors.length : 0) >= 4 || vectors.includes('system compromise') || vectors.includes('unauthorized access');
  const incompleteTriggers = triggerText.includes('no') || triggerText.includes('missing') || triggerText.includes('false') || triggerText.includes('off');
  const immediateLifeThreat = /(fire|sprinkler|standpipe|evacuation|medical|panic|hostile|hostage|active shooter)/.test(text);
  const directEntryFailure = /(perimeter|fencing|vehicle barrier|bollard|standoff|restricted access|unauthorized access)/.test(text) && highConsequenceAbsence;
  const coreSafeguardFailure = /(backup power|single point of failure|system compromise|network|access control|surveillance|video)/.test(text) && highConsequenceAbsence && broadExposure;

  if (lifeSafetySignals) {
    return 'High';
  }
  if (perimeterSignals) {
    return 'High';
  }
  if (continuitySignals) {
    return (highConsequenceAbsence || broadExposure || manyVectors) ? 'High' : 'Medium';
  }
  if (cyberPhysicalSignals) {
    return (highConsequenceAbsence || broadExposure || manyVectors) ? 'High' : 'Medium';
  }
  if (coreSafeguardFailure) {
    return 'High';
  }
  if (broadExposure || highConsequenceAbsence) {
    return 'Medium';
  }
  return 'Low';
}

window.VOFC_VULNERABILITIES = window.VOFC_VULNERABILITIES.map(vulnerability => ({
  ...vulnerability,
  severity: getSeverityFromEvidence(vulnerability)
}));

const DEFINITIVE_SOURCE_REFERENCES = {
  usfa: { label: 'U.S. Fire Administration', url: 'https://www.usfa.fema.gov/prevention/hotel-fires/' },
  readyResponse: { label: 'Ready.gov Emergency Response Plan', url: 'https://www.ready.gov/business/emergency-plans/emergency-response-plan' },
  readyPlanning: { label: 'Ready.gov Emergency Plans', url: 'https://www.ready.gov/business/emergency-plans' },
  cisaVenue: { label: 'CISA Venue Guide for Security Enhancements', url: 'https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements' },
  cisaTemporary: { label: 'CISA Physical Security Considerations for Temporary Facilities', url: 'https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet' },
  asis: { label: 'ASIS Standards & Guidelines Quick Reference Guide', url: 'https://www.asisonline.org/globalassets/standards-and-guidelines/documents/sgquickreferenceguide.pdf' },
  ahla: { label: 'AHLA Individual Hotel Brand Commitments to Advance Safety and Security', url: 'https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf' },
  nfpa: { label: 'NFPA High-Rise Building Fires Research', url: 'https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2' }
};

function getDefinitiveSourceProfile(v) {
  const text = `${String(v?.vulnerability_text || '')} ${String(v?.description || '')} ${String(v?.risk_impact || '')} ${String(v?.category || '')} ${String(v?.sheet || '')}`.toLowerCase();
  const cat = String(v?.category || '').toLowerCase();
  const base = { label: 'ASIS Standards & Guidelines', urls: [DEFINITIVE_SOURCE_REFERENCES.asis], control: String(v?.category || 'security control') };

  if (/(fire|sprinkler|alarm|egress|evacuation|life safety|standpipe|smoke|panic)/.test(text)) {
    return {
      label: 'USFA / NFPA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.usfa, DEFINITIVE_SOURCE_REFERENCES.nfpa],
      control: /alarm|egress|evacuation/.test(text) ? 'fire alarm and evacuation' : 'fire and life safety'
    };
  }

  if (/(emergency|continuity|incident management|crisis|recovery|communication|reunification|plan)/.test(text)) {
    return {
      label: 'Ready.gov / FEMA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.readyResponse, DEFINITIVE_SOURCE_REFERENCES.readyPlanning],
      control: /continuity|recovery/.test(text) ? 'business continuity and recovery' : 'emergency response and incident management'
    };
  }

  if (/(perimeter|standoff|bollard|barrier|fencing|vehicle|parking|driveway|entry road)/.test(text)) {
    return {
      label: 'CISA / ASIS / AHLA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.cisaVenue, DEFINITIVE_SOURCE_REFERENCES.cisaTemporary, DEFINITIVE_SOURCE_REFERENCES.asis, DEFINITIVE_SOURCE_REFERENCES.ahla],
      control: 'perimeter and vehicle access'
    };
  }

  if (/(vip|principal|escort|motorcade)/.test(text) || cat === 'vip security' || cat === 'vip operations') {
    return {
      label: 'ASIS / AHLA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.asis, DEFINITIVE_SOURCE_REFERENCES.ahla],
      control: 'vip movement and guest protection'
    };
  }

  if (/(guest room|business center|retail|public area|recreational|pool|fitness|service area|vertical|elevator|stair|valet|concierge|vendor|delivery|receiving|access control|visitor|door|credential)/.test(text)) {
    return {
      label: 'CISA / ASIS / AHLA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.cisaVenue, DEFINITIVE_SOURCE_REFERENCES.asis, DEFINITIVE_SOURCE_REFERENCES.ahla],
      control: /guest room/.test(text) ? 'guest-area access control' :
               /business center/.test(text) ? 'business center access and information protection' :
               /retail/.test(text) ? 'retail area access and theft prevention' :
               /pool/.test(text) ? 'pool access control and observation' :
               /fitness/.test(text) ? 'fitness area access control and supervision' :
               /service area/.test(text) ? 'service area separation and supervision' :
               /vertical|elevator|stair/.test(text) ? 'vertical circulation access control' :
               /valet|concierge/.test(text) ? 'guest services and valet coordination' :
               /vendor|delivery|receiving/.test(text) ? 'vendor and delivery access control' :
               'physical access control and visitor management'
    };
  }

  if (/(video|surveillance|network|system|data protection|backup power|redundancy|electronic|alarm|monitoring|soc)/.test(text) || cat === 'technology' || cat === 'system redundancy') {
    return {
      label: 'CISA / ASIS',
      urls: [DEFINITIVE_SOURCE_REFERENCES.cisaVenue, DEFINITIVE_SOURCE_REFERENCES.asis],
      control: /surveillance|video|monitoring/.test(text) ? 'surveillance and monitoring' :
               /backup power|redundancy/.test(text) ? 'system redundancy and backup power' :
               /data protection/.test(text) ? 'security data protection' :
               'technology and system resilience'
    };
  }

  if (/(personnel|training|staff|security force|vendor|contractor)/.test(text) || cat === 'personnel security' || cat === 'vendor security') {
    return {
      label: 'ASIS / AHLA',
      urls: [DEFINITIVE_SOURCE_REFERENCES.asis, DEFINITIVE_SOURCE_REFERENCES.ahla],
      control: /training/.test(text) ? 'security training and exercise readiness' :
               /vendor|contractor/.test(text) ? 'vendor and contractor screening' :
               'personnel security and oversight'
    };
  }

  return base;
}

window.VOFC_VULNERABILITIES = window.VOFC_VULNERABILITIES.map(vulnerability => {
  const sourceProfile = getDefinitiveSourceProfile(vulnerability);
  return {
    ...vulnerability,
    source_family: sourceProfile.label,
    source_control: sourceProfile.control || vulnerability.category || 'security control',
    source_citations: sourceProfile.urls.map(ref => ({ label: ref.label, url: ref.url }))
  };
});

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
