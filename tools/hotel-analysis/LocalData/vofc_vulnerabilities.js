// VOFC Vulnerabilities Database for HOST V3 integration
// Curated, source-cited vulnerabilities grounded in the current HOST survey fields

window.VOFC_VULNERABILITIES = [
  {
    "v_number": "V001",
    "vulnerability_text": "VSS retention period is shorter than the reporting benchmark",
    "sheet": "Security Systems",
    "row": 1,
    "category": "Security Systems",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "VSS retention is set to 90 days, but the report uses retention as an evidentiary baseline.",
    "risk_impact": "Retention needs to be explicit so the report can compare it to the site benchmark.",
    "source_field": "security_systems.vss_retention",
    "source_question": "What is the VSS retention period?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "vss_retention": "partial or none"
    }
  },
  {
    "v_number": "V002",
    "vulnerability_text": "VSS network segmentation is not fully defined",
    "sheet": "Security Systems",
    "row": 2,
    "category": "Security Systems",
    "severity": "Low",
    "5_ds_category": "Detect",
    "description": "VSS network segmentation is recorded, but the report cannot assume isolation unless it is explicitly confirmed.",
    "risk_impact": "Without explicit segmentation confirmation, surveillance traffic may not be isolated from other systems.",
    "source_field": "security_systems.vss_network_segmentation",
    "source_question": "Is the VSS network segmented?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "vss_network_segmentation": "No"
    }
  },
  {
    "v_number": "V003",
    "vulnerability_text": "No Security Operations Center for incident coordination",
    "sheet": "Security Systems",
    "row": 3,
    "category": "Security Systems",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "The assessment shows no Security Operations Center for incident coordination.",
    "risk_impact": "Incident coordination is decentralized; incident response and crisis communications are not anchored to a dedicated SOC.",
    "source_field": "security_systems.soc_present",
    "source_question": "What is the SOC presence?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Incident Management",
        "url": "https://www.ready.gov/business/resources/incident-management"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      }
    ],
    "trigger_conditions": {
      "soc_present": "No"
    }
  },
  {
    "v_number": "V004",
    "vulnerability_text": "No standoff distance measures are present",
    "sheet": "Physical Security",
    "row": 4,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "No standoff distance measures are present.",
    "risk_impact": "The site has perimeter barriers, but not the separation distance that reduces vehicle approach risk.",
    "source_field": "physical_security.has_standoff_measures",
    "source_question": "Are standoff distance measures in place?",
    "source_family": "CISA / FEMA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "has_standoff_measures": "No"
    }
  },
  {
    "v_number": "V005",
    "vulnerability_text": "Vehicle barriers do not replace standoff distance",
    "sheet": "Physical Security",
    "row": 5,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Vehicle barriers are present, but they do not replace standoff distance.",
    "risk_impact": "The report should distinguish barrier presence from actual separation distance.",
    "source_field": "physical_security.standoff_vehicle_barriers",
    "source_question": "Are vehicle barriers in place?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_vehicle_barriers": "No"
    }
  },
  {
    "v_number": "V006",
    "vulnerability_text": "Perimeter fencing is decorative rather than exclusionary",
    "sheet": "Physical Security",
    "row": 6,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Perimeter fencing is decorative rather than exclusionary.",
    "risk_impact": "Decorative fencing does not equal a protective perimeter.",
    "source_field": "physical_security.standoff_perimeter_fencing",
    "source_question": "Is perimeter fencing in place?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_perimeter_fencing": "No"
    }
  },
  {
    "v_number": "V007",
    "vulnerability_text": "Perimeter fence condition is only fair",
    "sheet": "Physical Security",
    "row": 7,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "The fence condition is fair, not strong.",
    "risk_impact": "A fair condition reduces confidence in perimeter durability.",
    "source_field": "physical_security.standoff_fence_condition",
    "source_question": "What is the fence condition?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_fence_condition": "Fair"
    }
  },
  {
    "v_number": "V008",
    "vulnerability_text": "Bollards are decorative rather than protective",
    "sheet": "Physical Security",
    "row": 8,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Bollards are decorative rather than protective.",
    "risk_impact": "Decorative bollards do not provide the same vehicle mitigation as rated barriers.",
    "source_field": "physical_security.standoff_bollard_type",
    "source_question": "What bollard type is used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_bollard_type": "No"
    }
  },
  {
    "v_number": "V009",
    "vulnerability_text": "Bollard spacing is too wide to serve as exclusion",
    "sheet": "Physical Security",
    "row": 9,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Bollard spacing is too wide to serve as exclusion.",
    "risk_impact": "The report should call out spacing, not just bollard presence.",
    "source_field": "physical_security.standoff_bollard_spacing",
    "source_question": "What is the bollard spacing?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_bollard_spacing": "No"
    }
  },
  {
    "v_number": "V010",
    "vulnerability_text": "Landscape clear zones require active maintenance",
    "sheet": "Physical Security",
    "row": 10,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Landscape clear zones are present and must be maintained as a control layer.",
    "risk_impact": "Landscape controls only help if they remain unobstructed and deliberately managed.",
    "source_field": "physical_security.standoff_landscaping_clear_zones",
    "source_question": "Are landscaping clear zones maintained?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "standoff_landscaping_clear_zones": "No"
    }
  },
  {
    "v_number": "V011",
    "vulnerability_text": "Security staff are not trained on all emergency plans",
    "sheet": "Physical Security",
    "row": 11,
    "category": "Physical Security",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Security staff are not trained on all emergency plans.",
    "risk_impact": "This creates an execution gap between the written plans and the people expected to use them.",
    "source_field": "physical_security.secforce_trained_all_plans",
    "source_question": "Are security staff trained on all emergency plans?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "secforce_trained_all_plans": "No"
    }
  },
  {
    "v_number": "V012",
    "vulnerability_text": "Pool lifeguard coverage is not present",
    "sheet": "Pool Facilities",
    "row": 12,
    "category": "Pool Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Pool lifeguard coverage is not present.",
    "risk_impact": "The pool lacks live supervision.",
    "source_field": "pool_facilities.pool_lifeguard",
    "source_question": "Is lifeguard coverage provided for the pool?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      }
    ],
    "trigger_conditions": {
      "pool_lifeguard": "No"
    }
  },
  {
    "v_number": "V013",
    "vulnerability_text": "Pool access control is not keyed or supervised",
    "sheet": "Pool Facilities",
    "row": 13,
    "category": "Pool Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Pool access control is not keyed or supervised.",
    "risk_impact": "Open access at the pool increases guest-safety exposure.",
    "source_field": "pool_facilities.pool_access_control",
    "source_question": "What pool access control is used?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      }
    ],
    "trigger_conditions": {
      "pool_access_control": "None"
    }
  },
  {
    "v_number": "V014",
    "vulnerability_text": "Pool VSS coverage is partial",
    "sheet": "Pool Facilities",
    "row": 14,
    "category": "Pool Facilities",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Pool VSS coverage is partial.",
    "risk_impact": "Partial observation leaves blind spots at a guest-safety area.",
    "source_field": "pool_facilities.pool_vss_coverage",
    "source_question": "What pool VSS coverage is provided?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      }
    ],
    "trigger_conditions": {
      "pool_vss_coverage": "Partial"
    }
  },
  {
    "v_number": "V015",
    "vulnerability_text": "Pool chemical storage is not secured",
    "sheet": "Pool Facilities",
    "row": 15,
    "category": "Pool Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Pool chemical storage is not secured.",
    "risk_impact": "That creates a hazardous-material access issue.",
    "source_field": "pool_facilities.pool_chemical_storage_secured",
    "source_question": "Is pool chemical storage secured?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      }
    ],
    "trigger_conditions": {
      "pool_chemical_storage_secured": "No"
    }
  },
  {
    "v_number": "V016",
    "vulnerability_text": "Surface parking control is not defined",
    "sheet": "Parking Facilities",
    "row": 16,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Surface parking control is not defined.",
    "risk_impact": "The lot lacks a clear access-control baseline.",
    "source_field": "parking_facilities.surface_parking_control",
    "source_question": "What surface parking control is used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "surface_parking_control": "None"
    }
  },
  {
    "v_number": "V017",
    "vulnerability_text": "Surface parking lighting is only fair",
    "sheet": "Parking Facilities",
    "row": 17,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Surface parking lighting is only fair.",
    "risk_impact": "Fair lighting does not provide a strong deterrence baseline.",
    "source_field": "parking_facilities.surface_parking_lighting",
    "source_question": "What is the surface parking lighting level?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "surface_parking_lighting": "Poor"
    }
  },
  {
    "v_number": "V018",
    "vulnerability_text": "Garage parking control is not defined",
    "sheet": "Parking Facilities",
    "row": 18,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Garage parking control is not defined.",
    "risk_impact": "The garage lacks a clear control layer.",
    "source_field": "parking_facilities.garage_parking_control",
    "source_question": "What garage parking control is used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "garage_parking_control": "None"
    }
  },
  {
    "v_number": "V019",
    "vulnerability_text": "Garage parking video coverage is only partial",
    "sheet": "Parking Facilities",
    "row": 19,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "Garage parking video coverage is only partial.",
    "risk_impact": "Partial video coverage leaves blind spots in the garage.",
    "source_field": "parking_facilities.garage_parking_vss",
    "source_question": "What garage parking VSS coverage is provided?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "garage_parking_vss": "No"
    }
  },
  {
    "v_number": "V020",
    "vulnerability_text": "Garage parking lighting is poor",
    "sheet": "Parking Facilities",
    "row": 20,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Garage parking lighting is poor.",
    "risk_impact": "Poor lighting weakens deterrence and observation.",
    "source_field": "parking_facilities.garage_parking_lighting",
    "source_question": "What is the garage parking lighting level?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "garage_parking_lighting": "Poor"
    }
  },
  {
    "v_number": "V021",
    "vulnerability_text": "Shared entry points create cross-flow exposure",
    "sheet": "Facility Info",
    "row": 21,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Shared entry points create cross-flow exposure.",
    "risk_impact": "Guest and non-guest movement are not fully separated.",
    "source_field": "facility_info.shared_entry_points",
    "source_question": "Are shared entry points present?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "shared_entry_points": "No"
    }
  },
  {
    "v_number": "V022",
    "vulnerability_text": "Loading dock access is uncontrolled",
    "sheet": "Facility Info",
    "row": 22,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Loading dock access is uncontrolled.",
    "risk_impact": "Receiving and delivery flow is not fully gated.",
    "source_field": "facility_info.loading_dock_control",
    "source_question": "Is loading dock access controlled?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "loading_dock_control": "None"
    }
  },
  {
    "v_number": "V023",
    "vulnerability_text": "Contractor escort requirement is not defined",
    "sheet": "Facility Info",
    "row": 23,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Contractor escort requirement is not defined.",
    "risk_impact": "The report should show whether contractors are escorted into controlled areas.",
    "source_field": "facility_info.contractor_escort_required",
    "source_question": "Is contractor escort required?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "contractor_escort_required": "No"
    }
  },
  {
    "v_number": "V024",
    "vulnerability_text": "Residential space is not fully separated from hotel operations",
    "sheet": "Facility Info",
    "row": 24,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Residential space is not fully separated from hotel operations.",
    "risk_impact": "The mixed-use footprint needs stronger circulation separation.",
    "source_field": "facility_info.residential_separated",
    "source_question": "Is residential space separated?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "residential_separated": "No"
    }
  },
  {
    "v_number": "V025",
    "vulnerability_text": "Short-term rentals add transient occupancy exposure",
    "sheet": "Facility Info",
    "row": 25,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Short-term rentals add transient occupancy exposure.",
    "risk_impact": "This creates additional guest-flow and access-control complexity.",
    "source_field": "facility_info.short_term_rentals",
    "source_question": "Are short-term rentals present?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "short_term_rentals": "No"
    }
  },
  {
    "v_number": "V026",
    "vulnerability_text": "Elevator key access is not universal across controlled levels",
    "sheet": "Facility Info",
    "row": 26,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Elevator key access is not universal across controlled levels.",
    "risk_impact": "Restricted floors should not rely on open elevator movement.",
    "source_field": "facility_info.elevator_key_access",
    "source_question": "Is elevator key access used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "elevator_key_access": "No"
    }
  },
  {
    "v_number": "V027",
    "vulnerability_text": "Stairwell restricted access is not universal",
    "sheet": "Facility Info",
    "row": 27,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Stairwell restricted access is not universal.",
    "risk_impact": "All protected stairwells should be consistently controlled.",
    "source_field": "facility_info.stairwell_restricted_access",
    "source_question": "Is stairwell restricted access used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "stairwell_restricted_access": "No"
    }
  },
  {
    "v_number": "V028",
    "vulnerability_text": "Stairwell access control method is not clearly stated",
    "sheet": "Facility Info",
    "row": 28,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Stairwell access control method is not clearly stated.",
    "risk_impact": "The report should name the method instead of using generic access language.",
    "source_field": "facility_info.stairwell_access_control_method",
    "source_question": "What stairwell access control method is used?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "stairwell_access_control_method": "None"
    }
  },
  {
    "v_number": "V029",
    "vulnerability_text": "Stairwell emergency exit handling is not consistent",
    "sheet": "Facility Info",
    "row": 29,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Stairwell emergency exit handling is not consistent.",
    "risk_impact": "A stairwell should be consistently designated and controlled for egress.",
    "source_field": "facility_info.stairwell_emergency_exit",
    "source_question": "Is the stairwell an emergency exit?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet"
      }
    ],
    "trigger_conditions": {
      "stairwell_emergency_exit": "No"
    }
  },
  {
    "v_number": "V030",
    "vulnerability_text": "Dependency recovery agreements are not documented for every critical dependency",
    "sheet": "Facility Info",
    "row": 30,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Dependency recovery agreements are not documented for every critical dependency.",
    "risk_impact": "Continuity depends on documented recovery alignment with external providers.",
    "source_field": "facility_info.dep_pra",
    "source_question": "Is a PRA documented for the dependency?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Business Continuity Planning",
        "url": "https://www.ready.gov/business-continuity-planning"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      }
    ],
    "trigger_conditions": {
      "dep_pra": "No"
    }
  },
  {
    "v_number": "V031",
    "vulnerability_text": "Backup fuel support is not fully defined",
    "sheet": "Facility Info",
    "row": 31,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Backup fuel support is not fully defined.",
    "risk_impact": "The report should show the fuel source for each backup layer.",
    "source_field": "facility_info.backup_fuel",
    "source_question": "What fuel is used for backup?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Business Continuity Planning",
        "url": "https://www.ready.gov/business-continuity-planning"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      }
    ],
    "trigger_conditions": {
      "backup_fuel": "No"
    }
  },
  {
    "v_number": "V032",
    "vulnerability_text": "Backup location is not clearly separated from primary operations",
    "sheet": "Facility Info",
    "row": 32,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Backup location is not clearly separated from primary operations.",
    "risk_impact": "Location matters because it affects survivability during an incident.",
    "source_field": "facility_info.backup_location",
    "source_question": "Where is the backup located?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Business Continuity Planning",
        "url": "https://www.ready.gov/business-continuity-planning"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      }
    ],
    "trigger_conditions": {
      "backup_location": "No"
    }
  },
  {
    "v_number": "V033",
    "vulnerability_text": "Backup runtime is shorter than the continuity target",
    "sheet": "Facility Info",
    "row": 33,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Backup runtime is shorter than the continuity target.",
    "risk_impact": "Runtime should be compared to the operational recovery window.",
    "source_field": "facility_info.backup_runtime",
    "source_question": "What is the backup runtime?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Business Continuity Planning",
        "url": "https://www.ready.gov/business-continuity-planning"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      }
    ],
    "trigger_conditions": {
      "backup_runtime": "short"
    }
  },
  {
    "v_number": "V034",
    "vulnerability_text": "Restricted elevator access is not fully enforced",
    "sheet": "Facility Info",
    "row": 34,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Restricted elevator access is not fully enforced.",
    "risk_impact": "Protected levels need consistent lift control.",
    "source_field": "facility_info.restricted_elevator_access",
    "source_question": "Is restricted elevator access controlled?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "restricted_elevator_access": "No"
    }
  },
  {
    "v_number": "V035",
    "vulnerability_text": "Restricted stairwell exclusion is not fully enforced",
    "sheet": "Facility Info",
    "row": 35,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Restricted stairwell exclusion is not fully enforced.",
    "risk_impact": "Protected levels need consistent stairwell control.",
    "source_field": "facility_info.restricted_stairwell_exclusion",
    "source_question": "Is stairwell exclusion controlled in restricted areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "restricted_stairwell_exclusion": "No"
    }
  },
  {
    "v_number": "V036",
    "vulnerability_text": "Retail areas are open to the public",
    "sheet": "Facility Info",
    "row": 36,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Retail areas are open to the public.",
    "risk_impact": "Public retail access expands internal exposure inside the property.",
    "source_field": "facility_info.retail_open_to_public",
    "source_question": "Is the retail space open to the public?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "retail_open_to_public": "No"
    }
  },
  {
    "v_number": "V037",
    "vulnerability_text": "Retail access is not consistently restrictable",
    "sheet": "Facility Info",
    "row": 37,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Retail access is not consistently restrictable.",
    "risk_impact": "Retail spaces need a way to be closed off when conditions change.",
    "source_field": "facility_info.retail_restrictable_access",
    "source_question": "Can retail access be restricted?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "retail_restrictable_access": "No"
    }
  },
  {
    "v_number": "V038",
    "vulnerability_text": "Emergency planning is not written for every category",
    "sheet": "Facility Info",
    "row": 38,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Emergency planning is not written for every category.",
    "risk_impact": "Written plans are the baseline for response consistency.",
    "source_field": "facility_info.plan_written",
    "source_question": "Is the emergency plan written?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises"
      }
    ],
    "trigger_conditions": {
      "plan_written": "No"
    }
  },
  {
    "v_number": "V039",
    "vulnerability_text": "Emergency plans are not recently updated",
    "sheet": "Facility Info",
    "row": 39,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Emergency plans are not recently updated.",
    "risk_impact": "Outdated plans weaken response reliability.",
    "source_field": "facility_info.plan_last_updated",
    "source_question": "When was the emergency plan last updated?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises"
      }
    ],
    "trigger_conditions": {
      "plan_last_updated": "stale"
    }
  },
  {
    "v_number": "V040",
    "vulnerability_text": "At least one emergency plan is not exercised",
    "sheet": "Facility Info",
    "row": 40,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "At least one emergency plan is not exercised.",
    "risk_impact": "A written plan that has not been exercised may not work in practice.",
    "source_field": "facility_info.plan_exercise",
    "source_question": "Was the emergency plan exercised?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      },
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises"
      }
    ],
    "trigger_conditions": {
      "plan_exercise": "No"
    }
  },
  {
    "v_number": "V041",
    "vulnerability_text": "Training coverage is not standardized across response topics",
    "sheet": "Facility Info",
    "row": 41,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Training coverage is not standardized across response topics.",
    "risk_impact": "The report should distinguish which training topics exist and which do not.",
    "source_field": "facility_info.training_type",
    "source_question": "What training type is provided?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      }
    ],
    "trigger_conditions": {
      "training_type": "No"
    }
  },
  {
    "v_number": "V042",
    "vulnerability_text": "Training frequency is not uniform across the program",
    "sheet": "Facility Info",
    "row": 42,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "Training frequency is not uniform across the program.",
    "risk_impact": "A consistent cadence is necessary for repeatable readiness.",
    "source_field": "facility_info.training_frequency",
    "source_question": "What is the training frequency?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan"
      }
    ],
    "trigger_conditions": {
      "training_frequency": "No"
    }
  },
  {
    "v_number": "V043",
    "vulnerability_text": "First-responder response time is longer than the target window",
    "sheet": "Facility Info",
    "row": 43,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "First-responder response time is longer than the target window.",
    "risk_impact": "The response window affects whether the site can be stabilized quickly.",
    "source_field": "facility_info.responder_response_time",
    "source_question": "What is the responder response time?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "responder_response_time": "long"
    }
  },
  {
    "v_number": "V044",
    "vulnerability_text": "First-responder capabilities are not fully defined",
    "sheet": "Facility Info",
    "row": 44,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "First-responder capabilities are not fully defined.",
    "risk_impact": "Capability detail matters because not every response team can provide the same support.",
    "source_field": "facility_info.responder_special_capabilities",
    "source_question": "What special capabilities do responders have?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide"
      }
    ],
    "trigger_conditions": {
      "responder_special_capabilities": "No"
    }
  },
  {
    "v_number": "V045",
    "vulnerability_text": "Fire department connection zoning is not fully configured",
    "sheet": "Fire Safety",
    "row": 45,
    "category": "Fire Safety",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Fire department connection zoning is not fully configured.",
    "risk_impact": "Zoned FDCs support clearer fire response coordination.",
    "source_field": "fire_safety.fdc_zoned",
    "source_question": "Is the fire department connection zoned?",
    "source_family": "USFA / NFPA",
    "source_citations": [
      {
        "label": "U.S. Fire Administration Hotel Fires",
        "url": "https://www.usfa.fema.gov/prevention/hotel-fires/"
      },
      {
        "label": "NFPA High-Rise Building Fires Research",
        "url": "https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2"
      }
    ],
    "trigger_conditions": {
      "fdc_zoned": "No"
    }
  },
  {
    "v_number": "V046",
    "vulnerability_text": "Standpipe testing is not current",
    "sheet": "Fire Safety",
    "row": 46,
    "category": "Fire Safety",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Standpipe testing is not current.",
    "risk_impact": "The report should show whether the test cycle is current.",
    "source_field": "fire_safety.standpipe_test_date",
    "source_question": "When was the standpipe tested?",
    "source_family": "USFA / NFPA",
    "source_citations": [
      {
        "label": "U.S. Fire Administration Hotel Fires",
        "url": "https://www.usfa.fema.gov/prevention/hotel-fires/"
      },
      {
        "label": "NFPA High-Rise Building Fires Research",
        "url": "https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2"
      }
    ],
    "trigger_conditions": {
      "standpipe_test_date": "stale"
    }
  },
  {
    "v_number": "V047",
    "vulnerability_text": "Sprinkler coverage is not complete",
    "sheet": "Fire Safety",
    "row": 47,
    "category": "Fire Safety",
    "severity": "High",
    "5_ds_category": "Deter",
    "description": "Sprinkler coverage is not complete.",
    "risk_impact": "Partial coverage leaves life-safety gaps.",
    "source_field": "fire_safety.sprinkler_partial",
    "source_question": "Is any sprinkler coverage partial?",
    "source_family": "USFA / NFPA",
    "source_citations": [
      {
        "label": "U.S. Fire Administration Hotel Fires",
        "url": "https://www.usfa.fema.gov/prevention/hotel-fires/"
      },
      {
        "label": "NFPA High-Rise Building Fires Research",
        "url": "https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2"
      }
    ],
    "trigger_conditions": {
      "sprinkler_partial": "No"
    }
  },
  {
    "v_number": "V048",
    "vulnerability_text": "Sprinkler pumping support is not fully documented",
    "sheet": "Fire Safety",
    "row": 48,
    "category": "Fire Safety",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "Sprinkler pumping support is not fully documented.",
    "risk_impact": "Pump support is a key resilience element for fire suppression.",
    "source_field": "fire_safety.sprinkler_pumps",
    "source_question": "Are sprinkler pumps present?",
    "source_family": "USFA / NFPA",
    "source_citations": [
      {
        "label": "U.S. Fire Administration Hotel Fires",
        "url": "https://www.usfa.fema.gov/prevention/hotel-fires/"
      },
      {
        "label": "NFPA High-Rise Building Fires Research",
        "url": "https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2"
      }
    ],
    "trigger_conditions": {
      "sprinkler_pumps": "No"
    }
  },
  {
    "v_number": "V049",
    "vulnerability_text": "VIP transport coordination is not fully defined",
    "sheet": "VIP Planning",
    "row": 49,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "VIP transport coordination is not fully defined.",
    "risk_impact": "The report should state how VIP movement is coordinated.",
    "source_field": "vip_planning.vip_transport_coordination",
    "source_question": "How is VIP transportation coordinated?",
    "source_family": "ISO 31030 / ASIS",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "vip_transport_coordination": "No"
    }
  },
  {
    "v_number": "V050",
    "vulnerability_text": "VIP staff background checks are standard, not enhanced",
    "sheet": "VIP Planning",
    "row": 50,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "VIP staff background checks are standard, not enhanced.",
    "risk_impact": "VIP-facing staff warrant a clearer screening baseline.",
    "source_field": "vip_planning.vip_staff_background_checks",
    "source_question": "What VIP staff background check level is used?",
    "source_family": "ISO 31030 / ASIS",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "vip_staff_background_checks": "Not Required"
    }
  },
  {
    "v_number": "V051",
    "vulnerability_text": "VIP emergency communication is not dedicated",
    "sheet": "VIP Planning",
    "row": 51,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Defend",
    "description": "VIP emergency communication is not dedicated.",
    "risk_impact": "VIP operations need a direct communication path during incidents.",
    "source_field": "vip_planning.vip_emergency_communication",
    "source_question": "What VIP emergency communication capability is configured?",
    "source_family": "ISO 31030 / ASIS",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "vip_emergency_communication": "No"
    }
  },
  {
    "v_number": "V052",
    "vulnerability_text": "VIP access control systems are not clearly defined",
    "sheet": "VIP Planning",
    "row": 52,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "VIP access control systems are not clearly defined.",
    "risk_impact": "VIP spaces need a named access-control layer.",
    "source_field": "vip_planning.vip_access_control_systems",
    "source_question": "What VIP access control system is used?",
    "source_family": "ISO 31030 / ASIS",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "vip_access_control_systems": "None"
    }
  },
  {
    "v_number": "V053",
    "vulnerability_text": "VIP monitoring and surveillance are not fully integrated",
    "sheet": "VIP Planning",
    "row": 53,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "VIP monitoring and surveillance are not fully integrated.",
    "risk_impact": "VIP protection depends on coordinated observation.",
    "source_field": "vip_planning.vip_monitoring_surveillance",
    "source_question": "What VIP monitoring and surveillance level is used?",
    "source_family": "ISO 31030 / ASIS",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf"
      }
    ],
    "trigger_conditions": {
      "vip_monitoring_surveillance": "No"
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


const REC_SOURCE = {
  cisaVenue: { label: 'CISA Venue Guide for Security Enhancements', url: 'https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements', page: 'HOST/CISA toolkit pages 8-11' },
  cisaTemp: { label: 'CISA Physical Security Considerations for Temporary Facilities', url: 'https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet', page: 'HOST/CISA toolkit pages 8-11' },
  cisaScreen: { label: 'CISA Public Venue Security Screening Guide', url: 'https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide', page: 'HOST/CISA toolkit pages 8-11' },
  readyPlans: { label: 'Ready.gov Emergency Plans', url: 'https://www.ready.gov/business/emergency-plans', page: 'Ready.gov emergency plans page' },
  readyResp: { label: 'Ready.gov Emergency Response Plan', url: 'https://www.ready.gov/business/emergency-plans/emergency-response-plan', page: 'Ready.gov emergency response plan page' },
  readyInc: { label: 'Ready.gov Incident Management', url: 'https://www.ready.gov/business/resources/incident-management', page: 'Ready.gov incident management page' },
  readyEx: { label: 'Ready.gov Testing & Exercises', url: 'https://www.ready.gov/business/training/testing-exercises', page: 'Ready.gov testing and exercises page' },
  readyCont: { label: 'Ready.gov Business Continuity Planning', url: 'https://www.ready.gov/business-continuity-planning', page: 'Ready.gov business continuity planning page' },
  iso31030: { label: 'ISO 31030:2021 Travel risk management', url: 'https://www.iso.org/standard/54204.html', page: 'ISO 31030:2021 overview page' },
  usfa: { label: 'U.S. Fire Administration Hotel Fires', url: 'https://www.usfa.fema.gov/prevention/hotel-fires/', page: 'USFA hotel fires page' },
  nfpa: { label: 'NFPA High-Rise Building Fires Research', url: 'https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2', page: 'NFPA high-rise fires research PDF' },
  ahla: { label: 'AHLA Individual Hotel Brand Commitments to Advance Safety and Security', url: 'https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf', page: 'AHLA hotel safety and security commitments PDF' }
};

function rec(text, sourceKeys) {
  return {
    text,
    citations: sourceKeys.map(k => REC_SOURCE[k]).filter(Boolean)
  };
}

function recommendationsForVulnerability(v) {
  const field = String(v?.source_field || '');
  const base = field.replace('[]', '');
  const out = [];
  const add = (text, keys) => out.push(rec(text, keys));

  if (base === 'security_systems.soc_present') {
    add('Establish a staffed incident-coordination point and define who owns incident logging, dispatch, and executive notification. (CISA toolkit remediation themes: incident reporting and documentation; incident management.)', ['readyInc', 'readyPlans']);
    add('Assign an emergency operations lead and a documented escalation tree so response decisions are not ad hoc.', ['readyInc', 'readyResp']);
    add('Link the SOC function to crisis communications and business continuity roles so incident handling is continuous.', ['readyPlans', 'readyCont']);
  } else if (base === 'physical_security.has_standoff_measures') {
    add('Add standoff distance using barriers, bollards, landscaping, or site redesign so vehicles are kept away from the building envelope. (CISA toolkit remediation theme: insufficient standoff distance from buildings.)', ['cisaVenue', 'cisaTemp']);
    add('Rework traffic flow and parking geometry to preserve a measurable buffer between public approaches and critical facades.', ['cisaVenue', 'cisaScreen']);
    add('Validate that any installed barriers are positioned to create true separation, not only visual deterrence.', ['cisaVenue', 'cisaTemp']);
  } else if (['physical_security.standoff_vehicle_barriers','physical_security.standoff_perimeter_fencing','physical_security.standoff_fence_condition','physical_security.standoff_bollard_type','physical_security.standoff_bollard_spacing','physical_security.standoff_landscaping_clear_zones'].includes(base)) {
    add('Use a layered perimeter design that combines barriers, landscaping, and controlled entry points rather than a single element.', ['cisaVenue', 'cisaTemp']);
    add('Reassess approach routes and vehicle paths so protective elements are aligned to the actual threat directions at the site.', ['cisaVenue', 'cisaScreen']);
    add('Document the protective intent of each perimeter element so decorative features are not mistaken for rated protection.', ['cisaVenue', 'cisaTemp']);
  } else if (base == 'physical_security.secforce_trained_all_plans') {
    add('Train security staff on each emergency plan type and validate the role-specific actions they must execute.', ['readyEx', 'readyResp']);
    add('Run recurring tabletop and functional exercises that force staff to perform the plan, not just read it.', ['readyEx', 'readyPlans']);
    add('Keep attendance and completion records so leadership can verify every plan has personnel coverage.', ['readyEx', 'readyCont']);
  } else if (['pool_facilities.pool_lifeguard','pool_facilities.pool_access_control','pool_facilities.pool_vss_coverage','pool_facilities.pool_chemical_storage_secured'].includes(base)) {
    add('Tighten guest-area supervision with access control and observation that matches the pool operating schedule.', ['cisaVenue', 'cisaTemp']);
    add('Secure hazardous pool chemicals in locked storage with controlled entry and documented responsibility.', ['readyResp', 'cisaVenue']);
    add('Match supervision and surveillance to pool hours so opening periods and after-hours conditions are both covered.', ['cisaVenue', 'readyPlans']);
  } else if (['parking_facilities.surface_parking_control','parking_facilities.surface_parking_lighting','parking_facilities.garage_parking_control','parking_facilities.garage_parking_vss','parking_facilities.garage_parking_lighting'].includes(base)) {
    add('Define vehicle and pedestrian routes, then align lighting and surveillance to those movement paths. (CISA toolkit remediation themes: parking security and perimeter lighting.)', ['cisaVenue', 'cisaTemp']);
    add('Use access control or staffed oversight at the garage and surface lot entry points where the site allows it.', ['cisaVenue', 'cisaScreen']);
    add('Treat parking as a monitored security zone, not just a convenience area.', ['cisaVenue', 'cisaTemp']);
  } else if (['facility_info.shared_entry_points','facility_info.loading_dock_control','facility_info.contractor_escort_required','facility_info.residential_separated','facility_info.short_term_rentals'].includes(base)) {
    add('Separate guest, resident, contractor, and delivery flows so mixed-use exposure is not left to informal practice.', ['cisaVenue', 'ahla']);
    add('Define escort, verification, and access rules for non-guest movement through shared corridors and service routes.', ['cisaScreen', 'cisaVenue']);
    add('Limit uncontrolled loading-dock and delivery access to approved windows and accountable staff only.', ['cisaVenue', 'cisaScreen']);
  } else if (['facility_info.elevator_key_access','facility_info.stairwell_restricted_access','facility_info.stairwell_access_control_method','facility_info.stairwell_emergency_exit','facility_info.restricted_elevator_access','facility_info.restricted_stairwell_exclusion'].includes(base)) {
    add('Standardize vertical-circulation controls so restricted levels are reached only through approved methods.', ['cisaVenue', 'cisaTemp']);
    add('Record which floors, shafts, and stairwells are restricted, then test that the controls actually work.', ['readyEx', 'cisaVenue']);
    add('Use the same control logic for access, egress, and emergency operations so staff do not bypass restrictions in an incident.', ['readyResp', 'cisaScreen']);
  } else if (['facility_info.dep_pra','facility_info.backup_fuel','facility_info.backup_location','facility_info.backup_runtime'].includes(base)) {
    add('Document continuity dependencies, recovery agreements, and backup runtime against the business recovery objective.', ['readyCont', 'readyPlans']);
    add('Place backup resources in a location that survives the most likely disruption paths for the property.', ['readyCont', 'cisaVenue']);
    add('Test the backup fuel, runtime, and handoff assumptions before relying on them in an incident.', ['readyEx', 'readyCont']);
  } else if (['facility_info.retail_open_to_public','facility_info.retail_restrictable_access','facility_info.retail_vss_coverage','facility_info.amenities_table.amenity_public_access','facility_info.amenities_table.amenity_restrictable_access','facility_info.amenities_table.amenity_vss_coverage'].includes(base)) {
    add('Separate public retail and amenity access from protected hotel circulation with clear control points.', ['cisaVenue', 'cisaScreen']);
    add('Use surveillance and restrictable access so public-facing areas can be tightened when threat conditions change.', ['cisaVenue', 'cisaTemp']);
    add('Document who can open, close, and override each space so public exposure does not become uncontrolled exposure.', ['cisaVenue', 'readyInc']);
  } else if (['facility_info.plan_written','facility_info.plan_last_updated','facility_info.plan_exercise','facility_info.training_type','facility_info.training_frequency'].includes(base)) {
    add('Keep plans written, current, and exercised on a recurring cycle so response actions are based on current operations. (Ready.gov emergency plans and testing/exercises.)', ['readyPlans', 'readyEx']);
    add('Tie each training topic to a named plan and a recurring schedule so preparedness is measurable.', ['readyEx', 'readyResp']);
    add('Use after-action review findings to refresh the plan rather than letting it drift stale.', ['readyEx', 'readyCont']);
  } else if (['facility_info.responder_response_time','facility_info.responder_special_capabilities','contacts_table.contact_emergency_contact','emergency_contacts_table.emergency_email'].includes(base)) {
    add('Keep responder and emergency-contact records complete enough to support immediate escalation during an incident.', ['readyInc', 'readyResp']);
    add('Verify response time and special capabilities against the most likely hotel scenarios, not just a generic contact list.', ['readyResp', 'readyPlans']);
    add('Exercise the contact path so leadership knows the call tree works after hours.', ['readyEx', 'readyInc']);
  } else if (['fire_safety.fdc_zoned','fire_safety.standpipe_test_date','fire_safety.sprinkler_partial','fire_safety.sprinkler_pumps','fire_safety.fire_panel_access'].includes(base)) {
    add('Keep fire-safety infrastructure zoned, tested, and documented so responders can rely on the system during an event. (USFA / NFPA fire-safety guidance.)', ['usfa', 'nfpa']);
    add('Confirm sprinkler, standpipe, and fire-panel controls during recurring inspection and drill cycles.', ['usfa', 'readyEx']);
    add('Treat fire-system access as a protected function with controlled access and current testing records.', ['usfa', 'nfpa']);
  } else if (['vip_planning.vip_travel_risk_plan','vip_planning.vip_transport_coordination','vip_planning.vip_emergency_communication','vip_planning.vip_access_control_systems','vip_planning.vip_staff_background_checks','vip_planning.vip_monitoring_surveillance'].includes(base)) {
    add('Create a written VIP travel-risk and movement plan that names coordination, communication, and escalation roles.', ['iso31030', 'ahla']);
    add('Match VIP staffing, screening, and monitoring to the actual protection level the guest profile requires.', ['iso31030', 'cisaVenue']);
    add('Maintain a direct emergency communication path for VIP movements, independent of general guest comms.', ['iso31030', 'readyInc']);
  } else if (['security_systems.vss_retention','security_systems.vss_network_segmentation'].includes(base)) {
    add('Set the surveillance retention period and network design explicitly, then test that the chosen configuration is actually working.', ['cisaVenue', 'cisaTemp']);
    add('Keep video evidence and surveillance traffic separated from non-security systems where the architecture allows it.', ['cisaVenue', 'cisaScreen']);
    add('Document the retention, segmentation, and access model so future audits do not rely on assumptions.', ['cisaVenue', 'readyEx']);
  }

  return out.slice(0, 3);
}

window.VOFC_VULNERABILITIES = window.VOFC_VULNERABILITIES.map(vulnerability => ({
  ...vulnerability,
  severity: getSeverityFromEvidence(vulnerability),
  recommendations: recommendationsForVulnerability(vulnerability)
}));

const DEFINITIVE_SOURCE_REFERENCES = {
  usfa: { label: 'U.S. Fire Administration', url: 'https://www.usfa.fema.gov/prevention/hotel-fires/' },
  readyResponse: { label: 'Ready.gov Emergency Response Plan', url: 'https://www.ready.gov/business/emergency-plans/emergency-response-plan', page: 'Ready.gov emergency response plan page' },
  readyPlanning: { label: 'Ready.gov Emergency Plans', url: 'https://www.ready.gov/business/emergency-plans', page: 'Ready.gov emergency plans page' },
  cisaVenue: { label: 'CISA Venue Guide for Security Enhancements', url: 'https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements', page: 'HOST/CISA toolkit pages 8-11' },
  cisaTemporary: { label: 'CISA Physical Security Considerations for Temporary Facilities', url: 'https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet', page: 'HOST/CISA toolkit pages 8-11' },
  asis: { label: 'ASIS Standards & Guidelines Quick Reference Guide', url: 'https://www.asisonline.org/globalassets/standards-and-guidelines/documents/sgquickreferenceguide.pdf' },
  ahla: { label: 'AHLA Individual Hotel Brand Commitments to Advance Safety and Security', url: 'https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf', page: 'AHLA hotel safety and security commitments PDF' },
  nfpa: { label: 'NFPA High-Rise Building Fires Research', url: 'https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2', page: 'NFPA high-rise fires research PDF' }
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
