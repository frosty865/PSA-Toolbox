# UI Reference — Electricity (Archived)

Legacy UI reference for electricity assessment screens. Maintained here for historical context; see current design system documentation for up-to-date patterns.

## Sections

1. **Service Overview** — Captures basic metadata (service name, contact, operating jurisdiction).
2. **Infrastructure** — Lists primary substations, generation assets, and distribution nodes.
3. **Dependencies** — Records upstream/downstream dependencies and critical interconnections.
4. **Backup & Contingency** — Captures backup power sources, load shedding plans, restoration timelines.
5. **Risk & Exposure** — Qualitative risk scores for natural hazards, cyber threats, supply chain.

## UI Components

- Tabs for navigation between sections.
- Editable tables for dependencies and infrastructure nodes.
- Inline validation messages for required fields.
- Help tooltips tied to glossary entries.

## Visual Notes

- Prior to v2, used custom color palette for hazard indicators.
- Layout optimized for 1280px width; responsive behavior limited on smaller screens.
- Modal dialogs for adding infrastructure components, now replaced with drawer UX.

## Replacement

- Refer to design specs in `docs/design-system/electricity.md` (current location) or Figma file linked in the design documentation.
