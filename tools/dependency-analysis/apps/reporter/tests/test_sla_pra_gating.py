#!/usr/bin/env python3
"""
SLA/PRA module gating: when sla_pra_module_enabled is False, no SLA or PRA language in narratives.
"""
import sys
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
if str(REPORTER_DIR) not in sys.path:
    sys.path.insert(0, str(REPORTER_DIR))

from main import build_sources_narrative


def test_sources_narrative_no_sla_pra_when_module_disabled():
    """When sla_pra_module_enabled is False, paragraphs must not contain 'SLA:' or 'PRA:'."""
    assessment = {
        "categories": {
            "ELECTRIC_POWER": {
                "supply": {"sources": [{"provider_name": "Utility Co", "independence": "UNKNOWN"}]},
                "agreements": {"has_sla": True, "has_pra": True, "sla_hours": 4},
            },
            "WATER": {"supply": {"sources": []}},
        }
    }
    paragraphs = build_sources_narrative(assessment, [], sla_pra_module_enabled=False)
    full = " ".join(paragraphs)
    assert "SLA:" not in full, "Baseline narrative must not include SLA when module disabled"
    assert "PRA:" not in full, "Baseline narrative must not include PRA when module disabled"


def test_sources_narrative_includes_sla_pra_when_module_enabled():
    """When sla_pra_module_enabled is True, paragraphs can include SLA/PRA."""
    assessment = {
        "categories": {
            "ELECTRIC_POWER": {
                "supply": {"sources": [{"provider_name": "Utility Co"}]},
                "agreements": {"has_sla": True, "sla_hours": 4},
            },
        }
    }
    paragraphs = build_sources_narrative(
        assessment, [], sla_pra_module_enabled=True
    )
    full = " ".join(paragraphs)
    assert "SLA:" in full
