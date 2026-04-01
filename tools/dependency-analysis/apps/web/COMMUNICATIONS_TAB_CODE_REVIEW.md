# Communications Tab — Code Review Data

**Issue:** PACE system type dropdown appears locked / unchangeable.

---

## 1. CommsQuestionnaireSection — Props & Mount

```tsx
// apps/web/app/assessment/dependencies/communications/CommsQuestionnaireSection.tsx

export type CommsQuestionnaireSectionProps = {
  embedded?: boolean;
  onCurveDataChange?: (categoryInput: CategoryInput & Record<string, unknown>) => void;
  existingCommsCategory?: Partial<CategoryInput> & Record<string, unknown>;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
};

export function CommsQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingCommsCategory = {},
  ...
}) {
  const [answers, setAnswers] = useState<CommsAnswers>(getDefaultCommsAnswers());
```

**Categories page usage (embedded=true):**
```tsx
<CommsQuestionnaireSection
  embedded={true}
  onCurveDataChange={onCommsCurveDataChange}
  existingCommsCategory={input as Partial<CategoryInput>}
  ...
/>
```

---

## 2. Init Effect — Merge Logic (runs once on mount)

```tsx
useEffect(() => {
  const fromStorage = getCommsAnswersForUI();
  if (embedded && existingCommsCategory) {
    const existing = existingCommsCategory as Record<string, unknown>;
    const merged: CommsAnswers = { ...fromStorage };
    for (const layer of ['P', 'A', 'C', 'E'] as const) {
      const key = `comm_pace_${layer}` as keyof CommsAnswers;
      const fromStorageVal = merged[key] as CommPaceLayer | undefined;
      const existingVal = existing[key];
      if (existingVal != null && typeof existingVal === 'object' && Object.keys(existingVal).length > 0) {
        const base = (fromStorageVal != null && typeof fromStorageVal === 'object' ? fromStorageVal : {}) as Record<string, unknown>;
        (merged as Record<string, unknown>)[key] = { ...base, ...(existingVal as Record<string, unknown>) } as CommPaceLayer;
      } else if (fromStorageVal != null && typeof fromStorageVal === 'object' && Object.keys(fromStorageVal).length > 0) {
        continue;
      }
    }
    setAnswers(merged);
  } else {
    setAnswers(fromStorage);
  }
}, []); // Only on mount
```

---

## 3. updatePaceLayer — Handler for PACE System Type Change

```tsx
const updatePaceLayer = useCallback(
  (layer: 'P' | 'A' | 'C' | 'E', field: keyof CommPaceLayer, value: unknown) => {
    setAnswers((prev) => {
      const current = prev[`comm_pace_${layer}`] as CommPaceLayer | undefined;
      let next: CommPaceLayer;
      if (field === 'system_type') {
        next = clearLayerForSystemType(current, value as CommPaceSystemType);
      } else {
        next = { ...(current ?? {}), [field]: value };
      }
      const updated = { ...prev, [`comm_pace_${layer}`]: next };
      if (onCurveDataChange) {
        const categoryInput = commsAnswersToCommsImpactCategoryInput(updated, existingCommsCategory);
        queueMicrotask(() => onCurveDataChange(categoryInput));
      }
      const derived = deriveCommsFindings(updated);
      queueMicrotask(() => saveCommsAnswers({ answers: updated, derived }));
      return updated;
    });
    setValidationError(null);
  },
  [onCurveDataChange, existingCommsCategory]
);
```

---

## 4. lastCurvePayloadRef Effect — Syncs answers → assessment

```tsx
const lastCurvePayloadRef = useRef<string | null>(null);
useEffect(() => {
  if (!onCurveDataChange) return;
  const categoryInput = commsAnswersToCommsImpactCategoryInput(answers, existingCommsCategory);
  const payload = JSON.stringify(categoryInput);
  if (payload === lastCurvePayloadRef.current) return;
  lastCurvePayloadRef.current = payload;
  onCurveDataChange(categoryInput);
}, [answers, existingCommsCategory, onCurveDataChange]);
```

---

## 5. CommsForm → PaceLayerCard Wiring

```tsx
// CommsForm receives:
<CommsForm answers={answers} onUpdate={update} onUpdatePaceLayer={updatePaceLayer} validationError={validationError} />

// PACE section renders:
{(['P', 'A', 'C', 'E'] as const).map((layer) => (
  <PaceLayerCard
    key={layer}
    layer={layer}
    layerLabel={...}
    data={answers[`comm_pace_${layer}`]}
    onUpdate={(field, value) => onUpdatePaceLayer(layer, field, value)}
    answers={answers}
  />
))}
```

---

## 6. PaceLayerCard — System Type Select

```tsx
function PaceLayerCard({
  layer,
  layerLabel,
  data,
  onUpdate,
}: {
  layer: 'P' | 'A' | 'C' | 'E';
  layerLabel: string;
  data: CommPaceLayer | undefined;
  onUpdate: (field: keyof CommPaceLayer, value: unknown) => void;
  answers: CommsAnswers;  // in type but not destructured
}) {
  // ...
  return (
    <div className="mb-4 pl-4 border-l-4" style={{ borderColor: 'var(--cisa-blue-lighter)' }}>
      <h4 className="font-semibold mb-2">{layerLabel}</h4>
      <div className="grid gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
            System type
            <HelpTooltip helpText={COMMS_FIELD_HELP.pace_system_type} />
          </label>
          <p className="text-xs text-gray-600 mb-1">{TRIPWIRE_PROVIDER}</p>
          <select
            className="form-control max-w-md"
            value={data?.system_type ?? ''}
            onChange={(e) => onUpdate('system_type', (e.target.value || undefined) as CommPaceSystemType)}
          >
            <option value="">— Select —</option>
            {COMM_PACE_SYSTEM_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {PACE_SYSTEM_LABELS[v] ?? v}
              </option>
            ))}
          </select>
        </div>
        // ... conditional fields for cellular, landline, etc.
```

---

## 7. Categories Page — COMMUNICATIONS Tab Render

```tsx
// page.tsx renderContent when tabId === 'COMMUNICATIONS'
const input = data as Record<string, unknown>;  // from assessment.categories.COMMUNICATIONS
// ...
<CommsQuestionnaireSection
  embedded={true}
  onCurveDataChange={onCommsCurveDataChange}  // → updateCategoryForCurve('COMMUNICATIONS', categoryInput)
  existingCommsCategory={input as Partial<CategoryInput>}
  ...
/>
```

---

## 8. Layout Hierarchy (Categories Page)

```
main.section.active
├── div (header: Category data, ProgressActions)
└── SectionTabsShell
    ├── div.section-tabs-tablist (tab buttons)
    ├── div.section-tabs-panel (role="tabpanel")
    │   └── renderContent(activeTabId) → CommsQuestionnaireSection when COMMUNICATIONS
    └── div.section-tabs-nav (Prev/Next)
```

---

## 9. CSS — Section Tabs

```css
/* CISA_Design_System.css */
.section-tabs-shell {
    min-width: 0;
    overflow: visible;
}

.section-tabs-panel {
    min-width: 0;
    overflow-x: auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
```

---

## 10. Scope Modal — Blocks Form Until Dismissed?

```tsx
{!scopeConfirmed && !scopeModalDismissed && (
  <div role="dialog" ...>
    <h3>This section is VOICE / COMMAND communications, not internet/data.</h3>
    <button onClick={handleScopeContinue}>Continue (Voice)</button>
    <a href="...">Go to IT</a>
  </div>
)}
// CommsForm is rendered AFTER this modal in the DOM
<CommsForm ... />
```

**scopeConfirmed** = `(existingCommsCategory as Record<string, unknown>)?._comms_scope_confirmed === true`

If the modal is shown, it appears *above* CommsForm in the DOM. It does NOT have `position: fixed` or `pointer-events: none`. It could block clicks if it overlaps the PACE section when scrolled.

---

## 11. clearLayerForSystemType (comms_spec.ts)

```ts
export function clearLayerForSystemType(
  layer: CommPaceLayer | undefined,
  systemType: CommPaceSystemType | undefined
): CommPaceLayer {
  const allowed = new Set(getApplicableFieldsForSystemType(systemType));
  const out: CommPaceLayer = {};
  if (systemType != null) out.system_type = systemType;
  for (const key of Object.keys(layer ?? {}) as (keyof CommPaceLayer)[]) {
    if (allowed.has(key)) {
      const v = (layer as Record<string, unknown>)?.[key];
      if (v !== undefined && v !== null) (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
```

---

## 12. Data Flow Summary

| Step | Action |
|------|--------|
| 1 | User selects system type in `<select>` |
| 2 | `onChange` fires → `onUpdate('system_type', value)` |
| 3 | `onUpdate` = `(field, value) => onUpdatePaceLayer(layer, field, value)` |
| 4 | `updatePaceLayer` runs `setAnswers` with new PACE layer |
| 5 | `queueMicrotask` → `onCurveDataChange(categoryInput)` → `setAssessment` |
| 6 | `queueMicrotask` → `saveCommsAnswers` → localStorage `comms:storage` |
| 7 | `lastCurvePayloadRef` effect may also call `onCurveDataChange` when `answers` changes |

---

## 13. Potential Failure Points

1. **Scope modal** — If `!scopeConfirmed && !scopeModalDismissed`, the modal div is in the DOM before CommsForm. When user scrolls to PACE, does the modal overlap? (Modal has no fixed position; it scrolls with content.)
2. **HelpTooltip** — Wraps a `<span>` with `position: relative`. The `?` button could capture clicks if misaligned. Tooltip popup has `pointer-events: none`.
3. **React Strict Mode** — Double-mount could run init effect twice; second run might overwrite.
4. **existingCommsCategory reference** — When parent re-renders, does `input` change identity and cause `updatePaceLayer` to be recreated with stale closure?
5. **Controlled select** — `value={data?.system_type ?? ''}`. If `data` is undefined or has unexpected shape, could the select be in an invalid state?
6. **COMM_PACE_SYSTEM_TYPE_VALUES** — Ensure `e.target.value` matches an option value exactly.

---

## 14. Categories Page — activeTabId & input

```tsx
// page.tsx
const [activeTabId, setActiveTabId] = useState<SectionTabId>('ASSET_INFORMATION');

// When tabId is COMMUNICATIONS:
let data = { ...defaults, ...(assessment.categories?.[tabId] ?? {}) };
if (isCurveTab(tabId)) {
  data = mergeCurveIntoCategory(assessment, tabId as CategoryCode, data);
}
const input = data as Record<string, unknown>;
```

---

## 15. SectionTabsShell — Tab Panel

```tsx
<div
  role="tabpanel"
  id={`panel-${activeTabId}`}
  aria-labelledby={`tab-${activeTabId}`}
  className="section-tabs-panel"
>
  {renderContent(activeTabId)}
</div>
```

Only the active tab's content is rendered. When switching away from COMMUNICATIONS, CommsQuestionnaireSection unmounts. When switching back, it remounts and the init effect runs again.

---

## 16. Persistence — comms:storage

- **Load:** `getCommsAnswersForUI()` reads from `localStorage.getItem('comms:storage')`
- **Save:** `saveCommsAnswers({ answers, derived })` writes to `localStorage.setItem('comms:storage', ...)`
- **On load from progress file:** `mergeSessionsIntoAssessment` merges sessions into assessment; `writeSessionsToPerTabStorage` writes to comms:storage
