# Plan Implementation Checklist

## Phase 1: Safe schema extension
- [x] Inventory every existing field used by save, load, analysis, and reporting.
- [x] Add new operational questions with stable field names.
- [x] Keep old field names intact for backward-compatible restores.
- [x] Ensure new fields default cleanly when loading older saves.

## Phase 2: Technical overview
- [x] Add hotel-operations questions for guest flow, service flow, and operating dependencies.
- [x] Add lobby capacity and staffing questions for peak arrival periods.
- [x] Add receiving and dock throughput questions for service operations.
- [x] Add guest-services capacity questions for valet and front-of-house load.
- [x] Add occupancy pressure questions for peak load and room turnover.
- [x] Separate operational context from security findings in the report.
- [x] Keep technical overview data visible for leadership without marking it as a vulnerability.

## Phase 3: Protective-security assessment
- [x] Add high-value bodyguard and protective-security questions.
- [x] Prioritize VIP movement, vehicle approach, guest access, and monitoring.
- [x] Map each new question to a specific control family and source family.

## Phase 4: Continuity and readiness
- [x] Add incident logging, handoff, and continuity dependency questions.
- [x] Verify these questions drive roadmap and executive priority outputs.

## Phase 5: Compatibility validation
- [ ] Test save, restore, print, and export with old and new data.
- [ ] Verify VIP off/on behavior still works.
- [ ] Confirm no duplicate findings or broken layout after adding fields.
- [x] Confirm new operational and VIP fields serialize through the existing host JSON save/load path.

## Phase 6: Cleanup
- [ ] Remove stale or redundant questions only after new fields are stable.
- [x] Update report labels and matrix ordering to match the final question model.
