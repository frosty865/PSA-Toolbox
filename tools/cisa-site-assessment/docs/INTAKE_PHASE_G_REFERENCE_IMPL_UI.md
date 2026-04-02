# Phase G — Reference Implementation UI (Option B)

This phase adds a separate UI surface titled "Reference Implementation" for question detail pages.

## API
- `GET /api/reference/reference-impl?discipline_subtype_id=<uuid>`
- Returns:
  - `{ ok: true, found: false }` when no reference implementation exists
  - `{ ok: true, found: true, payload: <reference_impl_json> }` when present

## UI Components
- `app/components/reference-impl/ReferenceImplementationPanel.tsx`
- `app/components/question-details/ReferenceImplementationTab.tsx`

## How to wire into your Question Details UI

Find the component that renders the question detail tabs (often includes "Intent", "Evidence", "Notes", etc.).
Add a new tab labeled: **Reference Implementation**.

Render:
```tsx
<ReferenceImplementationTab disciplineSubtypeId={question.discipline_subtype_id} />
```

### Example Integration Points

1. **In `ReviewerQuestionCard.tsx`** (if you want it inline with Intent):
   ```tsx
   import ReferenceImplementationPanel from '@/app/components/reference-impl/ReferenceImplementationPanel';
   
   // After IntentPanel:
   {question.discipline_subtype_id && (
     <ReferenceImplementationPanel disciplineSubtypeId={question.discipline_subtype_id} />
   )}
   ```

2. **In a tabbed question detail view** (if you have tabs):
   ```tsx
   import ReferenceImplementationTab from '@/app/components/question-details/ReferenceImplementationTab';
   
   // In your tabs array:
   { label: "Reference Implementation", content: (
     <ReferenceImplementationTab disciplineSubtypeId={question.discipline_subtype_id} />
   )}
   ```

3. **Standalone panel** (like IntentPanel):
   ```tsx
   import ReferenceImplementationPanel from '@/app/components/reference-impl/ReferenceImplementationPanel';
   
   <ReferenceImplementationPanel disciplineSubtypeId={question.discipline_subtype_id} />
   ```

## Finding Question Objects

Questions typically have `discipline_subtype_id` as an optional field:
- Type: `string | null | undefined`
- Example locations:
  - `app/api/runtime/questions/route.ts` - `BaseQuestion` interface
  - `app/components/SubtypeQuestionBlock.tsx` - `Question` interface
  - `app/reference/baseline-questions/page.tsx` - `BaselineQuestion` interface

## Graceful Fallback

The component handles all edge cases:
- No `discipline_subtype_id`: Shows "No discipline subtype is associated with this question."
- Loading: Shows "Loading reference implementation…"
- Not found: Shows "No reference implementation exists for this subtype yet."
- Error: Shows error message

This ensures the Reference Implementation panel never breaks existing question detail views.
