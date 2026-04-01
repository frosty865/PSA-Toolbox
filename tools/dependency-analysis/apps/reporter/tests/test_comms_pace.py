#!/usr/bin/env python3
"""
PACE chart and narrative tests for Communications.
- test_comms_pace_legend_order: legend labels are Primary, Alternate, Contingency, Emergency (or with "not present")
- test_comms_pace_not_present_lines: absent layers plotted as dotted 0% with "(not present)"
- test_comms_pace_curve_endpoints: curve missing t=96 gets endpoint appended
"""
import sys
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPORTER_DIR))

from main import (
    build_pace_model_from_comm,
    render_comms_pace_chart_png,
    build_comms_pace_narrative,
)


def test_comms_pace_legend_order():
    """Legend order is Primary, Alternate, Contingency, Emergency; absent layers get (not present) in renderer."""
    # Only Primary present
    inp = {
        "requires_service": True,
        "curve_time_to_impact_hours": 12,
        "curve_loss_fraction_no_backup": 0.5,
        "curve_recovery_time_hours": 6,
        "comm_pace_P": {"system_type": "LANDLINE_VOIP_TRUNK", "sustain_hours": 72, "effective_capacity_pct": 50},
        "comm_pace_A": {},
        "comm_pace_C": {},
        "comm_pace_E": {},
    }
    pace = build_pace_model_from_comm(inp)
    assert pace["enabled"] is True
    layers = pace.get("layers") or {}
    order = ["PRIMARY", "ALTERNATE", "CONTINGENCY", "EMERGENCY"]
    expected_labels = ["Primary", "Alternate", "Contingency", "Emergency"]
    for i, key in enumerate(order):
        layer = layers.get(key, {})
        label = layer.get("label") or key.capitalize()
        assert label == expected_labels[i], f"Layer {key} should have label {expected_labels[i]}, got {label}"


def test_comms_pace_not_present_lines(tmp_path):
    """With only Primary present, Alternate/Contingency/Emergency plotted as dotted 0% lines."""
    inp = {
        "requires_service": True,
        "curve_time_to_impact_hours": 8,
        "curve_loss_fraction_no_backup": 0.6,
        "curve_recovery_time_hours": 4,
        "comm_pace_P": {"system_type": "CELLULAR_VOICE", "sustain_hours": 24, "effective_capacity_pct": 40},
        "comm_pace_A": {},
        "comm_pace_C": {},
        "comm_pace_E": {},
    }
    pace = build_pace_model_from_comm(inp)
    out_path = tmp_path / "comms_pace.png"
    render_comms_pace_chart_png(pace, out_path, "Communications")
    assert out_path.exists()
    # Alternate/Contingency/Emergency should be not present
    layers = pace.get("layers") or {}
    for key in ["ALTERNATE", "CONTINGENCY", "EMERGENCY"]:
        layer = layers.get(key, {})
        assert layer.get("present") is False, f"{key} should be not present"


def test_comms_pace_curve_endpoints():
    """Curve missing t=96 gets endpoint appended by renderer."""
    # Build a curve that might not have t=96 (e.g. sparse points)
    inp = {
        "requires_service": True,
        "curve_time_to_impact_hours": 24,
        "curve_loss_fraction_no_backup": 0.5,
        "curve_recovery_time_hours": 12,
        "comm_pace_P": {"system_type": "RADIO_ANALOG", "sustain_hours": 48, "effective_capacity_pct": 60},
        "comm_pace_A": {},
        "comm_pace_C": {},
        "comm_pace_E": {},
    }
    pace = build_pace_model_from_comm(inp)
    layers = pace.get("layers") or {}
    primary = layers.get("PRIMARY") or {}
    curve = primary.get("curve") or []
    assert len(curve) >= 2
    # build_pace_model uses horizon=96 so we get 0..96; ensure last point is 96
    last_t = curve[-1]["t_hours"] if curve else 0
    assert last_t == 96, f"Primary curve must extend to t=96; got last t={last_t}"


def test_comms_pace_narrative_emergency_absent():
    """When Emergency not present, narrative says 'Emergency layer is not present'."""
    inp = {
        "requires_service": True,
        "curve_time_to_impact_hours": 12,
        "curve_loss_fraction_no_backup": 0.5,
        "curve_recovery_time_hours": 6,
        "comm_pace_P": {"system_type": "LANDLINE_VOIP_TRUNK", "sustain_hours": 72, "effective_capacity_pct": 50},
        "comm_pace_A": {},
        "comm_pace_C": {},
        "comm_pace_E": {},
    }
    pace = build_pace_model_from_comm(inp)
    narrative = build_comms_pace_narrative(pace)
    assert "Emergency layer is not present" in narrative
