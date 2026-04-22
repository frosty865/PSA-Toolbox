// VOFC Vulnerabilities Database for HOST V3 integration
// Curated, source-cited vulnerabilities grounded in the current HOST survey fields

window.VOFC_VULNERABILITIES = [
  {
    "v_number": "V001",
    "vulnerability_text": "No Security Operations Center is recorded for this hotel",
    "sheet": "Security Systems",
    "row": 1,
    "category": "Security Systems",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the 450-room, 25-floor Grand Plaza Hotel & Convention Center, the assessment records no Security Operations Center, so incident coordination is not anchored to a dedicated command function.",
    "risk_impact": "Incident logging, dispatch, and escalation rely on distributed staff rather than one coordination point.",
    "source_field": "security_systems.soc_present",
    "source_question": "What is the SOC presence?",
    "source_family": "CISA / Ready.gov",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "Ready.gov Incident Management",
        "url": "https://www.ready.gov/business/resources/incident-management",
        "page": "incident management page"
      }
    ],
    "trigger_conditions": {
      "soc_present": "No"
    }
  },
  {
    "v_number": "V002",
    "vulnerability_text": "The hotel records no standoff program and a 35-foot minimum distance",
    "sheet": "Physical Security",
    "row": 2,
    "category": "Physical Security",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "At the hotel, the survey records no standoff program and a minimum observed distance of 35 feet, which is below the commonly used 50-foot protective benchmark.",
    "risk_impact": "The recorded geometry leaves the building closer to potential vehicle approach paths than the benchmark used in the toolkit.",
    "source_field": "physical_security.has_standoff_measures",
    "source_question": "Are standoff distance measures in place?",
    "source_family": "CISA / FEMA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "has_standoff_measures": "No"
    }
  },
  {
    "v_number": "V004",
    "vulnerability_text": "The hotel loading dock is uncontrolled",
    "sheet": "Facility Info",
    "row": 4,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "At the hotel, the loading dock is explicitly marked uncontrolled, so service access is not being bounded by a defined control point.",
    "risk_impact": "Delivery and service traffic can enter without a documented gatekeeping process.",
    "source_field": "facility_info.loading_dock_control",
    "source_question": "How is loading dock access controlled?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "loading_dock_control": "Uncontrolled"
    }
  },
  {
    "v_number": "V005",
    "vulnerability_text": "Shared entry points and an uncontrolled loading dock create mixed circulation",
    "sheet": "Facility Info",
    "row": 5,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the hotel, shared entry points are present and the loading dock is uncontrolled, which leaves mixed circulation controlled by informal practice rather than a written rule.",
    "risk_impact": "Guest, staff, and contractor movement can cross without a single hardened ingress path.",
    "source_field": "facility_info.shared_entry_points",
    "source_question": "Are there shared entry points?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "shared_entry_points": "Yes",
      "loading_dock_control": "Uncontrolled"
    }
  },
  {
    "v_number": "V006",
    "vulnerability_text": "Residential and short-term rental occupancy is mixed into hotel operations",
    "sheet": "Facility Info",
    "row": 6,
    "category": "Facility Info",
    "severity": "Low",
    "5_ds_category": "Deter",
    "description": "At the hotel, hotel, residential, and short-term rental occupancy are mixed, which creates a more complex access-control problem than a single-use hotel layout.",
    "risk_impact": "More occupant types and circulation patterns increase the number of places where access assumptions can fail.",
    "source_field": "facility_info.short_term_rentals",
    "source_question": "Are short-term rentals present?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "short_term_rentals": "Yes"
    }
  },
  {
    "v_number": "V007",
    "vulnerability_text": "At least one restricted area reports no elevator access control",
    "sheet": "Facility Info",
    "row": 7,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the hotel, at least one restricted-area row reports no elevator access control, so vertical access is not consistent across all controlled zones.",
    "risk_impact": "A user can gain different elevator access outcomes depending on the destination zone rather than a single control policy.",
    "source_field": "restricted_table.restricted_elevator_access[]",
    "source_question": "Is elevator access restricted in controlled areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "restricted_elevator_access": "No"
    }
  },
  {
    "v_number": "V008",
    "vulnerability_text": "At least one stairwell records No emergency exit handling",
    "sheet": "Facility Info",
    "row": 8,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the hotel, one stairwell records no emergency-exit handling, so egress handling is not consistent across the vertical circulation system.",
    "risk_impact": "A stairwell can function differently in an emergency than the rest of the secured vertical path.",
    "source_field": "facility_info.stairwell_emergency_exit[]",
    "source_question": "How is stairwell emergency egress handled?",
    "source_family": "CISA / Ready.gov",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans",
        "page": "emergency plans page"
      }
    ],
    "trigger_conditions": {
      "stairwell_emergency_exit": "No"
    }
  },
  {
    "v_number": "V009",
    "vulnerability_text": "Restricted areas have only partial video coverage",
    "sheet": "Security Systems",
    "row": 9,
    "category": "Security Systems",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "At the hotel, restricted areas are only partially covered by video surveillance, which means surveillance expectations vary by protected zone.",
    "risk_impact": "Not every restricted area has the same level of observation or evidence capture.",
    "source_field": "restricted_table.restricted_vss_coverage[]",
    "source_question": "What is the VSS coverage in restricted areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "restricted_vss_coverage": "Partial Coverage"
    }
  },
  {
    "v_number": "V010",
    "vulnerability_text": "The garage has partial video coverage",
    "sheet": "Parking Facilities",
    "row": 10,
    "category": "Parking Facilities",
    "severity": "High",
    "5_ds_category": "Detect",
    "description": "At the hotel, the garage has partial surveillance coverage, so observation is not uniform across the parking structure.",
    "risk_impact": "Vehicle and pedestrian threats can move through at least part of the garage with reduced evidentiary coverage.",
    "source_field": "parking_facilities.garage_parking_vss",
    "source_question": "What is the garage parking surveillance coverage?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "garage_parking_vss": "Partial"
    }
  },
  {
    "v_number": "V011",
    "vulnerability_text": "The garage lighting is poor",
    "sheet": "Parking Facilities",
    "row": 11,
    "category": "Parking Facilities",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "At the hotel, the garage lighting is poor, so observation quality is weaker than the control level expected for a monitored parking structure.",
    "risk_impact": "Poor lighting can reduce surveillance effectiveness and increase approach opportunities in the garage.",
    "source_field": "parking_facilities.garage_parking_lighting",
    "source_question": "What is the garage parking lighting condition?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Physical Security Considerations for Temporary Facilities",
        "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "garage_parking_lighting": "Poor"
    }
  },
  {
    "v_number": "V012",
    "vulnerability_text": "The surface lot lighting is fair rather than strong",
    "sheet": "Facility Info",
    "row": 12,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "At the hotel, the surface lot lighting is fair rather than strong, which leaves the outer parking field with a less robust observation environment.",
    "risk_impact": "Lighting blind spots can reduce surveillance effectiveness and increase approach opportunities in the surface lot.",
    "source_field": "parking_facilities.surface_parking_lighting",
    "source_question": "What is the surface parking lighting condition?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      { "label": "CISA Venue Guide for Security Enhancements", "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements", "page": "8-11" },
      { "label": "CISA Physical Security Considerations for Temporary Facilities", "url": "https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet", "page": "8-11" }
    ],
    "trigger_conditions": { "surface_parking_lighting": "Fair" }
  },
  {
    "v_number": "V014",
    "vulnerability_text": "Public, contractor, and service routes create the easiest ingress path",
    "sheet": "Facility Info",
    "row": 14,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "At the hotel, shared entry points are present, the loading dock is uncontrolled, and retail is public-facing, so the least controlled route is not clearly separated from protected circulation.",
    "risk_impact": "The assessment does not document a single hardened ingress path that is separated from public and service circulation.",
    "source_field": "facility_info.shared_entry_points",
    "source_question": "Are there shared entry points?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "shared_entry_points": "Yes",
      "loading_dock_control": "Uncontrolled"
    }
  },
  {
    "v_number": "V013",
    "vulnerability_text": "Public retail exposure overlaps with partial retail surveillance",
    "sheet": "Facility Info",
    "row": 13,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Detect",
    "description": "At the hotel, the property has public retail exposure and at least one retail space with partial video coverage, so public access is not paired with uniform observation.",
    "risk_impact": "Public-facing spaces are not paired with uniform observation and access control.",
    "source_field": "retail_spaces_table.retail_vss_coverage",
    "source_question": "What is the retail VSS coverage?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "retail_open_to_public": "Yes",
      "retail_vss_coverage": "Partial"
    }
  },
  {
    "v_number": "V015",
    "vulnerability_text": "Security staff are missing training coverage for at least one emergency plan",
    "sheet": "Security Systems",
    "row": 14,
    "category": "Security Systems",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the hotel, security staff are not trained on all emergency plans, so plan execution coverage is incomplete even though plans exist.",
    "risk_impact": "There is a gap between written plans and the people expected to execute them.",
    "source_field": "physical_security.secforce_trained_all_plans",
    "source_question": "Are security staff trained on all emergency plans?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises",
        "page": "testing and exercises page"
      },
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "secforce_trained_all_plans": "No"
    }
  },
  {
    "v_number": "V016",
    "vulnerability_text": "At least one written emergency plan was not exercised",
    "sheet": "Emergency Planning",
    "row": 17,
    "category": "Emergency Planning",
    "severity": "Medium",
    "5_ds_category": "Deter",
    "description": "At the hotel, the plan set includes at least one emergency plan that was not exercised, so written readiness is not validated across the full plan library.",
    "risk_impact": "A plan that is not exercised can remain untested even when it looks complete on paper.",
    "source_field": "plan-table.plan_exercise",
    "source_question": "Was the emergency plan exercised?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans",
        "page": "emergency plans page"
      },
      {
        "label": "Ready.gov Testing & Exercises",
        "url": "https://www.ready.gov/business/training/testing-exercises",
        "page": "testing and exercises page"
      }
    ],
    "trigger_conditions": {
      "plan_exercise": "No"
    }
  },
  {
    "v_number": "V017",
    "vulnerability_text": "Some contacts are not marked as emergency contacts",
    "sheet": "Emergency Planning",
    "row": 17,
    "category": "Emergency Planning",
    "severity": "Medium",
    "5_ds_category": "Respond",
    "description": "At the hotel, the contact roster includes rows marked No for emergency contact, so the emergency-contact list is not uniformly designated for response use.",
    "risk_impact": "A responder can reach a contact list that mixes ordinary contacts with emergency contacts instead of a response-ready roster.",
    "source_field": "contacts_table.contact_emergency_contact",
    "source_question": "Is this contact an emergency contact?",
    "source_family": "Ready.gov / CISA",
    "source_citations": [
      {
        "label": "Ready.gov Incident Management",
        "url": "https://www.ready.gov/business/resources/incident-management",
        "page": "incident management page"
      },
      {
        "label": "Ready.gov Emergency Plans",
        "url": "https://www.ready.gov/business/emergency-plans",
        "page": "emergency plans page"
      }
    ],
    "trigger_conditions": {
      "contact_emergency_contact": "No"
    }
  },
  {
    "v_number": "V018",
    "vulnerability_text": "At least one critical dependency does not have a documented recovery agreement",
    "sheet": "Facility Info",
    "row": 19,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Recover",
    "description": "At the hotel, at least one critical dependency lacks a documented recovery agreement, so not every dependency has a recovery path on record.",
    "risk_impact": "A utility or service interruption can outpace the property’s documented response path for that dependency.",
    "source_field": "dep-table.dep_pra",
    "source_question": "Is there a recovery agreement for the dependency?",
    "source_family": "Ready.gov / FEMA",
    "source_citations": [
      {
        "label": "Ready.gov Business Continuity Planning",
        "url": "https://www.ready.gov/business-continuity-planning",
        "page": "business continuity planning page"
      },
      {
        "label": "Ready.gov Incident Management",
        "url": "https://www.ready.gov/business/resources/incident-management",
        "page": "incident management page"
      }
    ],
    "trigger_conditions": {
      "dep_pra": "No"
    }
  },
  {
    "v_number": "V019",
    "vulnerability_text": "Vendor escort and background-check controls vary by service type",
    "sheet": "Facility Info",
    "row": 19,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "At the hotel, vendor controls are not uniform across all service types; some vendors are not escorted and some are on basic rather than full background checks.",
    "risk_impact": "Third-party access is being governed by mixed control levels rather than one consistent baseline.",
    "source_field": "vendor_table.vendor_escort",
    "source_question": "Is a vendor escort required?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "vendor_escort": "No"
    }
  },
  {
    "v_number": "V020",
    "vulnerability_text": "VIP staff use standard background checks instead of enhanced screening",
    "sheet": "VIP Planning",
    "row": 20,
    "category": "VIP Planning",
    "severity": "Medium",
    "5_ds_category": "Protect",
    "description": "At the hotel, VIP staffing uses standard background checks rather than enhanced screening, which is a weaker control for a higher-exposure protection context.",
    "risk_impact": "The VIP security posture is not differentiated from ordinary service-staff screening.",
    "source_field": "vip_planning.vip_staff_background_checks",
    "source_question": "What background checks are used for VIP staff?",
    "source_family": "ISO 31030 / AHLA",
    "source_citations": [
      {
        "label": "ISO 31030:2021 Travel risk management",
        "url": "https://www.iso.org/standard/54204.html",
        "page": "overview page"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "vip_staff_background_checks": "Standard Background Checks"
    }
  }
  ,
  {
    "v_number": "V021",
    "vulnerability_text": "No lockdown or containment boundary is documented between public and protected zones",
    "sheet": "Facility Info",
    "row": 21,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "At the hotel, shared entry points, an uncontrolled loading dock, open public retail, restricted areas, and no restriction on some vertical circulation show a mixed circulation model without a documented lockdown boundary.",
    "risk_impact": "If an incident occurs, the property may not be able to separate public movement from protected movement quickly enough to contain the event.",
    "source_field": "facility_info.shared_entry_points",
    "source_question": "Are there shared entry points?",
    "source_family": "CISA / Ready.gov / AHLA",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "Ready.gov Emergency Response Plan",
        "url": "https://www.ready.gov/business/emergency-plans/emergency-response-plan",
        "page": "emergency response plan page"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "shared_entry_points": "Yes",
      "loading_dock_control": "Uncontrolled",
      "retail_open_to_public": "Yes",
      "restricted_elevator_access": "No"
    }
  },
  {
    "v_number": "V022",
    "vulnerability_text": "The Data Center / IT Room has no elevator access control",
    "sheet": "Facility Info",
    "row": 22,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "The restricted-area table marks the Data Center / IT Room as having no elevator access control, so one of the most sensitive backend spaces is not protected at the vertical entry point.",
    "risk_impact": "A person reaching the correct floor may still arrive without a vertical-access barrier at the room level.",
    "source_field": "restricted_table.restricted_elevator_access",
    "source_question": "Is elevator access restricted in controlled areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "restricted_area_type": "Data Center / IT Room",
      "restricted_elevator_access": "No"
    }
  },
  {
    "v_number": "V029",
    "vulnerability_text": "The Security Operations Center has no elevator access control",
    "sheet": "Facility Info",
    "row": 23,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "The restricted-area table marks the Security Operations Center as having no elevator access control, so the incident-coordination room itself is not protected by a vertical-access barrier.",
    "risk_impact": "A person can reach the SOC floor without an elevator control gate at the restricted area level.",
    "source_field": "restricted_table.restricted_elevator_access",
    "source_question": "Is elevator access restricted in controlled areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "restricted_area_type": "Security Operations Center",
      "restricted_elevator_access": "No"
    }
  },
  {
    "v_number": "V027",
    "vulnerability_text": "The Mechanical Room has no elevator access control and only partial video coverage",
    "sheet": "Facility Info",
    "row": 24,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "The restricted-area table marks the Mechanical Room as lacking elevator access control and having only partial video coverage, so the support space has two separate control gaps at once.",
    "risk_impact": "An intruder reaching the area has weaker vertical control and weaker surveillance than the fully covered restricted spaces.",
    "source_field": "restricted_table.restricted_vss_coverage",
    "source_question": "What is the VSS coverage in restricted areas?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "restricted_area_type": "Mechanical Room",
      "restricted_elevator_access": "No",
      "restricted_vss_coverage": "Partial Coverage"
    }
  },
  {
    "v_number": "V028",
    "vulnerability_text": "Some vendors are only on basic background checks",
    "sheet": "Facility Info",
    "row": 25,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "At the hotel, the vendor table includes multiple service providers on basic background checks, so vendor screening depth is not uniform across the supply chain.",
    "risk_impact": "Some third-party access is being granted with a lighter screening standard than the higher-risk services suggest.",
    "source_field": "vendor_table.vendor_background_check",
    "source_question": "What background check is required for the vendor?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "vendor_background_check": "Required - Basic Background Check"
    }
  },
  {
    "v_number": "V023",
    "vulnerability_text": "Vendor access mode varies from permanent badges to remote access only",
    "sheet": "Facility Info",
    "row": 23,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "The vendor table shows permanent badges, temporary badges, escort-only access, conditional escort, and remote access only, so vendor access is not controlled with one uniform access mode.",
    "risk_impact": "Third-party access is being granted through different access channels without a single baseline control model.",
    "source_field": "vendor_table.vendor_access",
    "source_question": "What access is provided to the vendor?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "vendor_access": "Permanent Badges"
    }
  },
  {
    "v_number": "V024",
    "vulnerability_text": "Main lobby entry doors have no access control",
    "sheet": "Facility Info",
    "row": 24,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "The main lobby entrance and main lobby side doors are both marked with no access control, so the hotel’s primary public entry point is not being actively controlled at the door level.",
    "risk_impact": "Guests and visitors can enter through the primary lobby doors without a documented access-control decision at the point of entry.",
    "source_field": "exterior-doors-table.door_access_control",
    "source_question": "What access control is used at the exterior door?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "door_access_control": "None"
    }
  },
  {
    "v_number": "V025",
    "vulnerability_text": "Third-party service entry is split across escort-only, temporary badge, permanent badge, and remote access modes",
    "sheet": "Facility Info",
    "row": 25,
    "category": "Facility Info",
    "severity": "Medium",
    "5_ds_category": "Delay",
    "description": "The vendor table shows escort-only, temporary-badge, permanent-badge, conditional, and remote-access modes, so third-party entry is not controlled with one consistent access rule.",
    "risk_impact": "A third party can enter the property under different control levels depending on the service provider rather than a uniform standard.",
    "source_field": "vendor_table.vendor_access",
    "source_question": "What access is provided to the vendor?",
    "source_family": "CISA / AHLA",
    "source_citations": [
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      },
      {
        "label": "AHLA Individual Hotel Brand Commitments to Advance Safety and Security",
        "url": "https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf",
        "page": "commitments PDF"
      }
    ],
    "trigger_conditions": {
      "vendor_access": "Permanent Badges"
    }
  },
  {
    "v_number": "V026",
    "vulnerability_text": "Main lobby side doors have no access control",
    "sheet": "Facility Info",
    "row": 26,
    "category": "Facility Info",
    "severity": "High",
    "5_ds_category": "Delay",
    "description": "The main lobby side doors are explicitly marked with no access control, so the hotel’s primary public entry point has more than one uncontrolled opening.",
    "risk_impact": "A person can enter the lobby through a secondary public door without a documented access-control decision at the door level.",
    "source_field": "exterior-doors-table.door_access_control",
    "source_question": "What access control is used at the exterior door?",
    "source_family": "CISA / ASIS",
    "source_citations": [
      {
        "label": "CISA Venue Guide for Security Enhancements",
        "url": "https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements",
        "page": "8-11"
      },
      {
        "label": "CISA Public Venue Security Screening Guide",
        "url": "https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide",
        "page": "8-11"
      }
    ],
    "trigger_conditions": {
      "door_location": "Main Lobby Side Doors",
      "door_access_control": "None"
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
  cisaVenue: { label: 'CISA Venue Guide for Security Enhancements', url: 'https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements', page: 'pages 8-11' },
  cisaTemp: { label: 'CISA Physical Security Considerations for Temporary Facilities', url: 'https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet', page: 'pages 8-11' },
  cisaScreen: { label: 'CISA Public Venue Security Screening Guide', url: 'https://www.cisa.gov/resources-tools/resources/public-venue-security-screening-guide', page: 'pages 8-11' },
  readyPlans: { label: 'Ready.gov Emergency Plans', url: 'https://www.ready.gov/business/emergency-plans', page: 'emergency plans page' },
  readyResp: { label: 'Ready.gov Emergency Response Plan', url: 'https://www.ready.gov/business/emergency-plans/emergency-response-plan', page: 'emergency response plan page' },
  readyInc: { label: 'Ready.gov Incident Management', url: 'https://www.ready.gov/business/resources/incident-management', page: 'incident management page' },
  readyEx: { label: 'Ready.gov Testing & Exercises', url: 'https://www.ready.gov/business/training/testing-exercises', page: 'testing and exercises page' },
  readyCont: { label: 'Ready.gov Business Continuity Planning', url: 'https://www.ready.gov/business-continuity-planning', page: 'business continuity planning page' },
  iso31030: { label: 'ISO 31030:2021 Travel risk management', url: 'https://www.iso.org/standard/54204.html', page: 'overview page' },
  usfa: { label: 'U.S. Fire Administration Hotel Fires', url: 'https://www.usfa.fema.gov/prevention/hotel-fires/', page: 'hotel fires page' },
  nfpa: { label: 'NFPA High-Rise Building Fires Research', url: 'https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2', page: 'high-rise fires research PDF' },
  ahla: { label: 'AHLA Individual Hotel Brand Commitments to Advance Safety and Security', url: 'https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf', page: 'commitments PDF' }
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
  } else if (base === 'contacts_table.contact_emergency_contact' || base === 'facility_info.contact_emergency_contact' || base === 'planning_emergency.emergency_contact' || base === 'emergency_contacts_table.emergency_email') {
    add('Keep emergency-contact records complete, current, and clearly marked so escalation paths do not depend on guesswork.', ['readyPlans', 'readyInc']);
    add('Verify emergency-contact lists during exercises so the missing-contact condition is discovered before an incident.', ['readyEx', 'readyPlans']);
    add('Tie every contact record to a role and after-hours method so response teams can act on it immediately.', ['readyInc', 'readyCont']);
  } else if (base === 'vip_planning.vip_access_type') {
    add('Define the VIP access profile in writing so movement, screening, and escort decisions can be made against one standard.', ['iso31030', 'ahla']);
    add('Match VIP access routing to the selected protection level instead of leaving the path implicit.', ['iso31030', 'cisaVenue']);
    add('Record the VIP access standard with the same rigor used for other controlled areas.', ['iso31030', 'ahla']);
  } else if (base === 'vendor_table.vendor_escort') {
    add('Require escort rules by vendor type so temporary, permanent, and remote access are not treated the same.', ['cisaScreen', 'ahla']);
    add('Align background-check depth with the service being provided and the space being accessed.', ['cisaScreen', 'ahla']);
    add('Revalidate vendor access after scope changes so recurring vendors do not drift into uncontrolled access.', ['cisaVenue', 'cisaScreen']);
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
  } else if (['facility_info.retail_open_to_public','facility_info.retail_restrictable_access','facility_info.retail_vss_coverage','restricted_table.restricted_vss_coverage','facility_info.amenities_table.amenity_public_access','facility_info.amenities_table.amenity_restrictable_access','facility_info.amenities_table.amenity_vss_coverage'].includes(base)) {
    add('Separate public retail and amenity access from protected hotel circulation with clear control points.', ['cisaVenue', 'cisaScreen']);
    add('Use surveillance and restrictable access so public-facing areas can be tightened when threat conditions change.', ['cisaVenue', 'cisaTemp']);
    add('Document who can open, close, and override each space so public exposure does not become uncontrolled exposure.', ['cisaVenue', 'readyInc']);
  } else if (['facility_info.plan_written','facility_info.plan_last_updated','facility_info.plan_exercise','facility_info.training_type','facility_info.training_frequency'].includes(base)) {
    add('Keep plans written, current, and exercised on a recurring cycle so response actions are based on current operations. (Ready.gov emergency plans and testing/exercises.)', ['readyPlans', 'readyEx']);
    add('Tie each training topic to a named plan and a recurring schedule so preparedness is measurable.', ['readyEx', 'readyResp']);
    add('Use after-action review findings to refresh the plan rather than letting it drift stale.', ['readyEx', 'readyCont']);
  } else if (['facility_info.responder_response_time','facility_info.responder_special_capabilities','contacts_table.contact_emergency_contact','facility_info.contact_emergency_contact','planning_emergency.emergency_contact','emergency_contacts_table.emergency_email'].includes(base)) {
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
  readyResponse: { label: 'Ready.gov Emergency Response Plan', url: 'https://www.ready.gov/business/emergency-plans/emergency-response-plan', page: 'emergency response plan page' },
  readyPlanning: { label: 'Ready.gov Emergency Plans', url: 'https://www.ready.gov/business/emergency-plans', page: 'emergency plans page' },
  cisaVenue: { label: 'CISA Venue Guide for Security Enhancements', url: 'https://www.cisa.gov/resources-tools/resources/venue-guide-security-enhancements', page: 'pages 8-11' },
  cisaTemporary: { label: 'CISA Physical Security Considerations for Temporary Facilities', url: 'https://www.cisa.gov/resources-tools/resources/physical-security-considerations-temporary-facilities-fact-sheet', page: 'pages 8-11' },
  asis: { label: 'ASIS Standards & Guidelines Quick Reference Guide', url: 'https://www.asisonline.org/globalassets/standards-and-guidelines/documents/sgquickreferenceguide.pdf' },
  ahla: { label: 'AHLA Individual Hotel Brand Commitments to Advance Safety and Security', url: 'https://www.ahla.com/sites/default/files/5star_additional_commitments_may2019.pdf', page: 'commitments PDF' },
  nfpa: { label: 'NFPA High-Rise Building Fires Research', url: 'https://content.nfpa.org/-/media/Project/Storefront/Catalog/Files/Research/NFPA-Research/Building-and-life-safety/oshighrise.pdf?rev=fddf967144b344c483efaa478540b4e2', page: 'high-rise fires research PDF' }
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
