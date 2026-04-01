# Duplicate Provider Question Check — All Tabs

## Summary

| Tab | Q2 (standardized) | Later "provider" question | Duplicate? |
|-----|-------------------|---------------------------|------------|
| **Electric Power** | `curve_primary_provider` — "Who provides electric power to the facility/site?" | **E-1** "Providers" — Can identify? YES → list of utility providers (name + designation) | **Yes** |
| **Communications** | `curve_primary_provider` — "Who provides primary voice/telephony service?" | PACE layers each have **provider_name** (per Primary/Alternate/Contingency/Emergency) | **Partial** (one primary vs per-layer) |
| **Information Technology** | `curve_primary_provider` — "Who provides primary internet/data connectivity?" | **IT-1** "Providers" — Can identify? YES → list of service providers (name + designation) | **Yes** |
| **Water** | `curve_primary_provider` — "Who provides potable/process water to the facility/site?" | **W_Q5** "Providers" — Yes/No "know your water utility provider name and upstream dependencies" | **Yes** |
| **Wastewater** | `curve_primary_provider` — "Who provides wastewater/sewer service to the facility/site?" | **WW_Q5** "Providers" — Yes/No "provider name and upstream assets known and documented" | **Yes** |

---

## 1. Electric Power

- **Q2:** Single text — "Who provides electric power to the facility/site?" (`curve_primary_provider`)
- **Later:** E-1 "Providers" — Yes/No "Can you identify providers?" → if YES, repeatable list of utility providers (provider_name, designation)
- **Verdict:** Duplicate. Both collect who supplies power: Q2 is one name; E-1 is "can you identify?" plus a list.

---

## 2. Communications

- **Q2:** Single text — "Who provides primary voice/telephony service?" (`curve_primary_provider`)
- **Later:** Each PACE layer (Primary, Alternate, Contingency, Emergency) has a **provider_name** field (carrier/provider per layer).
- **Verdict:** Partial duplicate. Q2 is the single primary provider; PACE captures per-layer provider. Different granularity but overlapping.

---

## 3. Information Technology

- **Q2:** Single text — "Who provides primary internet/data connectivity?" (`curve_primary_provider`)
- **Later:** IT-1 "Providers" — Yes/No "Can the facility identify providers?" → if YES, list of IT service providers (provider_name, designation)
- **Verdict:** Duplicate. Same pattern as Energy: one primary name at Q2, then "can identify?" + list later.

---

## 4. Water

- **Q2:** Single text — "Who provides potable/process water to the facility/site?" (`curve_primary_provider`)
- **Later:** W_Q5 "Providers" — Yes/No "Answer YES when you know your water utility provider name and understand upstream dependencies (storage tanks, pump stations, treatment plants)..."
- **Verdict:** Duplicate. Provider name is already captured at Q2; W_Q5 asks whether they "know" the provider name, which is redundant.

---

## 5. Wastewater

- **Q2:** Single text — "Who provides wastewater/sewer service to the facility/site?" (`curve_primary_provider`)
- **Later:** WW_Q5 "Providers" — Yes/No "Answer YES when provider name and upstream assets (e.g., pump station, treatment plant) are known and documented."
- **Verdict:** Duplicate. Same as Water: name at Q2; WW_Q5 asks if provider/upstream are "known," which overlaps.

---

## Location reference

- **Specs (question definitions):**
  - Energy: `energy_spec.ts` — ENERGY_CURVE_QUESTIONS (curve_primary_provider), ENERGY_QUESTIONS (E-1)
  - Comms: `comms_spec.ts` — COMMUNICATIONS_QUESTIONS (curve_primary_provider), PACE layer `provider_name`
  - IT: `it_spec.ts` — IT_CURVE_QUESTIONS (curve_primary_provider), IT_QUESTIONS (IT-1)
  - Water: `water_spec.ts` — WATER_CURVE_QUESTIONS (curve_primary_provider), WATER_QUESTIONS (W_Q5)
  - Wastewater: `wastewater_spec.ts` — WASTEWATER_CURVE_QUESTIONS (curve_primary_provider), WASTEWATER_QUESTIONS (WW_Q5)
- **UI:** Same IDs used in each tab’s questionnaire section component.

No renumbering or ID changes were made; this is a check-only report.
