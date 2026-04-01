#!/usr/bin/env python3
"""
Tests for DEPENDENCY SUMMARY de-duplication and routing.
- ISP only in Internet Transport; hosted only in Critical Hosted Services.
- No "Not assessed" in output.
- Transport provider classifier matches registry logic.
"""
import sys
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
if str(REPORTER_DIR) not in sys.path:
    sys.path.insert(0, str(REPORTER_DIR))

from main import (
    _is_transport_provider,
    _get_it_isp_names_from_curve,
    _format_it_internet_connectivity_narrative,
    _internet_transport_table,
    _it_critical_hosted_table,
    _service_loss_description,
    _hosted_continuity_label,
    _hosted_continuity_label_for_summary,
)


class TestIsTransportProvider:
    """Reporter transport classifier must match web registry (Comcast/Xfinity/AT&T = transport; AWS = not)."""

    def test_known_isp_returns_true(self):
        assert _is_transport_provider("Xfinity") is True
        assert _is_transport_provider("Comcast") is True
        assert _is_transport_provider("AT&T") is True
        assert _is_transport_provider("AT&T Internet") is True
        assert _is_transport_provider("Verizon Fios") is True
        assert _is_transport_provider("Spectrum") is True
        assert _is_transport_provider("Charter") is True
        assert _is_transport_provider("xfinity") is True

    def test_non_isp_returns_false(self):
        assert _is_transport_provider("Amazon Web Services") is False
        assert _is_transport_provider("Microsoft") is False
        assert _is_transport_provider("AWS") is False
        assert _is_transport_provider("Acme MSP") is False


class TestInternetTransportTable:
    """Internet Transport table uses curve_primary_provider and curve_secondary_provider only (no supply.sources, IT-1, or hosted)."""

    def test_curve_primary_and_secondary_yield_two_rows(self):
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "curve_primary_provider": "Verizon",
                        "curve_secondary_provider": "Xfinity",
                    }
                }
            }
        }
        block = _internet_transport_table(payload)
        assert block["title"] == "INTERNET TRANSPORT"
        assert block["headers"] == ["Role", "Provider", "Demarcation", "Independence", "Notes"]
        rows = block["rows"]
        assert len(rows) == 2
        assert rows[0][0] == "Primary Internet Provider"
        assert rows[0][1] == "Verizon"
        assert rows[1][0] == "Secondary Internet Provider"
        assert rows[1][1] == "Xfinity"

    def test_curve_only_not_supply_or_it1(self):
        """Report must not use supply.sources or IT-1_service_providers for ISP names."""
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "curve_primary_provider": "Comcast",
                        "supply": {
                            "sources": [{"provider_name": "OtherISP", "independence": "UNKNOWN"}],
                        },
                        "IT-1_service_providers": [{"provider_name": "MSP Corp", "designation": "primary"}],
                    }
                }
            }
        }
        block = _internet_transport_table(payload)
        rows = block["rows"]
        assert len(rows) >= 1
        assert rows[0][1] == "Comcast"
        assert "OtherISP" not in [r[1] for r in rows]
        assert "MSP Corp" not in [r[1] for r in rows]

    def test_no_provider_shows_not_provided(self):
        block = _internet_transport_table({"assessment": {"categories": {"INFORMATION_TECHNOLOGY": {}}}})
        assert len(block["rows"]) == 1
        assert block["rows"][0][0] == "Primary Internet Provider"
        assert block["rows"][0][1] == "Not provided"

    def test_curve_primary_only_one_row(self):
        """Only curve_primary_provider and curve_secondary_provider are used; max two rows."""
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "curve_primary_provider": "Verizon",
                    }
                }
            }
        }
        block = _internet_transport_table(payload)
        assert len(block["rows"]) == 1
        assert block["rows"][0][0] == "Primary Internet Provider"
        assert block["rows"][0][1] == "Verizon"

    def test_isp_narrative_from_curve_only(self):
        """Narrative uses curve_primary_provider and curve_secondary_provider only."""
        assessment = {
            "categories": {
                "INFORMATION_TECHNOLOGY": {
                    "curve_primary_provider": "Verizon",
                    "curve_secondary_provider": "Xfinity",
                }
            }
        }
        narrative = _format_it_internet_connectivity_narrative(assessment)
        assert "Verizon" in narrative
        assert "Xfinity" in narrative
        assert "primary internet connectivity" in narrative.lower()
        assert "secondary connection" in narrative.lower()


class TestGetItIspNamesFromCurve:
    """ISP names must come only from curve; filter nulls."""

    def test_primary_and_secondary_filtered(self):
        assessment = {"categories": {"INFORMATION_TECHNOLOGY": {"curve_primary_provider": "Verizon", "curve_secondary_provider": "Xfinity"}}}
        names = _get_it_isp_names_from_curve(assessment)
        assert names == ["Verizon", "Xfinity"]

    def test_primary_only(self):
        assessment = {"categories": {"INFORMATION_TECHNOLOGY": {"curve_primary_provider": "Comcast"}}}
        names = _get_it_isp_names_from_curve(assessment)
        assert names == ["Comcast"]

    def test_empty_when_no_curve(self):
        names = _get_it_isp_names_from_curve({"categories": {"INFORMATION_TECHNOLOGY": {}}})
        assert names == []


class TestCriticalHostedServicesTable:
    """Critical Hosted Services includes only hosted (IT-2); no ISP rows; no 'Not assessed'."""

    def test_hosted_only_no_isp_rows(self):
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "IT-2_upstream_assets": [
                            {"service_id": "aws", "service_provider": "Amazon Web Services"},
                            {"service_id": "m365", "service_provider": "Microsoft"},
                        ],
                        "IT-1_service_providers": [{"provider_name": "Xfinity"}],
                    }
                }
            }
        }
        block = _it_critical_hosted_table(payload)
        assert block["title"] == "CRITICAL HOSTED SERVICES"
        assert block["headers"][-1] == "Service Loss"
        rows = block["rows"]
        services = [r[0] for r in rows]
        providers = [r[1] for r in rows]
        assert "aws" in services or "Amazon" in str(services)
        assert "Xfinity" not in providers
        assert "IT service provider" not in str(rows)
        # Service Loss column (4th) never shows "Not assessed"
        for row in rows:
            assert "Not assessed" not in str(row)

    def test_service_loss_column_mapped_not_continuity_state(self):
        """Service Loss column shows plain-language description of what is lost; never 'Not assessed'."""
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "IT-2_upstream_assets": [
                            {"service_id": "aws", "service_provider": "Amazon"},
                            {"service_id": "cloudflare", "service_provider": "Cloudflare"},
                            {"service_id": "zscaler", "service_provider": "Zscaler"},
                            {"service_id": "adp_hris", "service_provider": "ADP"},
                        ],
                    }
                }
            }
        }
        block = _it_critical_hosted_table(payload)
        assert block["headers"] == ["Service", "Provider", "Operational Impact (Time to Severe Impact)", "Service Loss"]
        rows = block["rows"]
        assert len(rows) == 4
        service_loss_col = [r[3] for r in rows]
        assert "hosted compute" in service_loss_col[0].lower() or "business applications" in service_loss_col[0].lower()
        assert "name resolution" in service_loss_col[1].lower() or "content delivery" in service_loss_col[1].lower()
        assert "controlled access" in service_loss_col[2].lower() or "remote access" in service_loss_col[2].lower()
        assert "hr" in service_loss_col[3].lower() or "payroll" in service_loss_col[3].lower()
        assert not any("Not assessed" in s for s in service_loss_col)

    def test_service_loss_unmapped_defaults_to_hosted_application_service(self):
        """When service_id is not in map, Service Loss = 'Hosted Application Service'."""
        payload = {
            "assessment": {
                "categories": {
                    "INFORMATION_TECHNOLOGY": {
                        "IT-2_upstream_assets": [{"service_id": "unknown_svc", "service_provider": "Acme"}],
                    }
                }
            }
        }
        block = _it_critical_hosted_table(payload)
        assert block["rows"][0][3] == "Hosted Application Service"
        assert _service_loss_description("other") == "Hosted Application Service"
        assert _service_loss_description("") == "Hosted Application Service"


class TestContinuityLabels:
    """Undefined survivability → 'Not assessed'; NO_CONTINUITY/NONE → 'No continuity'; new 4-state enum."""

    def test_summary_label_undefined_is_not_assessed(self):
        assert _hosted_continuity_label_for_summary(None) == "Not assessed"
        assert _hosted_continuity_label_for_summary({}) == "Not assessed"

    def test_summary_label_four_states_and_legacy(self):
        assert _hosted_continuity_label_for_summary({"survivability": "NO_CONTINUITY"}) == "No continuity"
        assert _hosted_continuity_label_for_summary({"survivability": "NONE"}) == "No continuity"
        assert _hosted_continuity_label_for_summary({"survivability": "ALTERNATE_PLATFORM_OR_PROVIDER"}) == "Alternate platform/provider"
        assert _hosted_continuity_label_for_summary({"survivability": "MANUAL_FALLBACK"}) == "Alternate platform/provider"
        assert _hosted_continuity_label_for_summary({"survivability": "LOCAL_MIRROR_OR_CACHE"}) == "Local mirror/cache"
        assert _hosted_continuity_label_for_summary({"survivability": "LOCAL_MIRROR"}) == "Local mirror/cache"
        assert _hosted_continuity_label_for_summary({"survivability": "UNKNOWN"}) == "Unknown"

    def test_general_label_undefined_not_assessed(self):
        assert _hosted_continuity_label(None) == "Not assessed"
        assert _hosted_continuity_label({}) == "Not assessed"
