#!/usr/bin/env python3
"""
Self-test: INTERNET TRANSPORT table must show real demarcation/independence when
a curve provider matches an IT supply source by provider_name.
"""
import sys
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
if str(REPORTER_DIR) not in sys.path:
    sys.path.insert(0, str(REPORTER_DIR))

from main import _internet_transport_table


def test_internet_transport_demarcation_when_source_matches():
    """When provider exists and a supply source with same provider_name exists, demarcation must not be '—'."""
    assessment = {
        "categories": {
            "INFORMATION_TECHNOLOGY": {
                "curve_primary_provider": "Verizon",
                "curve_secondary_provider": "Xfinity",
                "supply": {
                    "sources": [
                        {
                            "provider_name": "Verizon",
                            "demarcation_description": "Main IDF, Room 101",
                            "demarcation_lat": None,
                            "demarcation_lon": None,
                            "independence": "Diverse path",
                            "notes": "Primary circuit",
                        },
                        {
                            "provider_name": "Xfinity",
                            "demarcation_description": "",
                            "demarcation_lat": 39.1,
                            "demarcation_lon": -77.2,
                            "independence": "Secondary",
                            "notes": "",
                        },
                    ]
                },
            },
        },
    }
    payload = {"assessment": assessment}
    block = _internet_transport_table(payload)
    assert block["type"] == "table"
    assert block["title"] == "INTERNET TRANSPORT"
    rows = block["rows"]
    assert len(rows) >= 2
    # Role, Provider, Demarcation, Independence, Notes
    primary_row = next((r for r in rows if r[0] == "Primary Internet Provider"), None)
    secondary_row = next((r for r in rows if r[0] == "Secondary Internet Provider"), None)
    assert primary_row is not None
    assert secondary_row is not None
    assert primary_row[2] == "Main IDF, Room 101", "Demarcation must be populated when supply source has demarcation_description"
    assert primary_row[3] == "Diverse path"
    assert primary_row[4] == "Primary circuit"
    # Secondary: no description, so "lat, lon"
    assert secondary_row[2], "Demarcation must be populated (lat, lon) when no description"
    assert "39.1" in secondary_row[2] and "-77.2" in secondary_row[2]
    assert secondary_row[3] == "Secondary"


def test_internet_transport_demarcation_missing_source():
    """When no supply source matches provider, demarcation/independence show Not provided, notes show —."""
    assessment = {
        "categories": {
            "INFORMATION_TECHNOLOGY": {
                "curve_primary_provider": "Unknown ISP",
                "supply": {"sources": [{"provider_name": "Other ISP", "demarcation_description": "Somewhere"}]},
            },
        },
    }
    block = _internet_transport_table({"assessment": assessment})
    rows = block["rows"]
    primary_row = next((r for r in rows if r[0] == "Primary Internet Provider"), None)
    assert primary_row is not None
    assert primary_row[1] == "Unknown ISP"
    assert primary_row[2] == "Not provided", "Demarcation must be Not provided when no matching source"
    assert primary_row[3] == "Not provided", "Independence must be Not provided when no matching source"
    assert primary_row[4] == "—", "Notes must be — when missing"


def test_internet_transport_fuzzy_provider_match_and_transport_fallbacks():
    """Fuzzy provider match (e.g. Verizon vs Verizon Business) and IT transport fallback fields are applied."""
    assessment = {
        "categories": {
            "INFORMATION_TECHNOLOGY": {
                "curve_primary_provider": "Verizon",
                "curve_secondary_provider": "Xfinity",
                "it_transport_resilience": {"transport_route_independence": "CONFIRMED"},
                "IT-4_service_connections": [
                    {"associated_provider": "Xfinity", "facility_entry_location": "North MPOE"},
                ],
                "supply": {
                    "sources": [
                        {
                            "provider_name": "Verizon Business",
                            "demarcation_description": "MDF Rack A",
                            "independence": "DIFFERENT_LOOP_OR_PATH",
                            "notes": "",
                        },
                    ]
                },
            },
        },
    }
    block = _internet_transport_table({"assessment": assessment})
    rows = block["rows"]
    primary = next((r for r in rows if r[0] == "Primary Internet Provider"), None)
    secondary = next((r for r in rows if r[0] == "Secondary Internet Provider"), None)
    assert primary is not None
    assert secondary is not None
    assert primary[2] == "MDF Rack A"
    assert "Different loop/path" in primary[3]
    assert secondary[2] == "North MPOE"
    assert secondary[3] == "Confirmed"
