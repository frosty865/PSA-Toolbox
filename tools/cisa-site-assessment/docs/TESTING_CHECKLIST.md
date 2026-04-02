# UX/UI Implementation Testing Checklist

## Phase 1: Quick Wins (Weeks 1-2) - Testing Guide

### 1. Progress Indicators ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Progress bar appears at the top of the assessment page
- [ ] Progress bar shows correct count (e.g., "5 of 20 questions answered")
- [ ] Progress bar shows correct percentage
- [ ] Progress bar updates in real-time as you answer questions
- [ ] Progress bar turns green when 100% complete
- [ ] Progress bar is visible on mobile devices

**Expected Behavior:**
- Progress bar should be visible immediately when page loads
- Updates should be instant (no delay)
- Percentage should be accurate

---

### 2. Save Confirmations (Toast Notifications) ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Toast notification appears when saving a response
- [ ] Success toast shows "Saved X response(s)" message
- [ ] Toast appears in bottom-right corner
- [ ] Toast auto-dismisses after 2 seconds
- [ ] Error toast appears if save fails
- [ ] Error toast shows helpful error message
- [ ] Multiple rapid saves show correct count

**Expected Behavior:**
- Toast should appear immediately after selecting a response
- Should not interfere with page interaction
- Should be accessible (visible, readable)

---

### 3. Better Error Messages ✅
**Test Location:** `/assessments` → Create New Assessment

**What to Test:**
- [ ] Create assessment with missing required fields
- [ ] Error message is user-friendly (not technical)
- [ ] Error message provides guidance on what to fix
- [ ] Different error types show appropriate messages:
  - Sector/subsector selection errors
  - Facility/address errors
  - Validation errors
  - Server errors

**Expected Behavior:**
- Error messages should be clear and actionable
- Should not show technical details (stack traces, etc.)
- Should guide user to fix the issue

---

### 4. Mobile Responsiveness ✅
**Test Location:** All pages, especially `/assessments/[assessmentId]`

**What to Test:**
- [ ] Open on mobile device or browser dev tools (mobile view)
- [ ] Touch targets are at least 44x44px
- [ ] Radio buttons are easy to tap
- [ ] Buttons are easy to tap
- [ ] Form inputs don't zoom on iOS (16px font size)
- [ ] Layout stacks vertically on mobile
- [ ] No horizontal scrolling
- [ ] Text is readable without zooming
- [ ] Progress bar is visible and functional

**Expected Behavior:**
- All interactive elements should be easily tappable
- Layout should adapt to smaller screens
- No content should be cut off or require horizontal scrolling

---

### 5. Breadcrumb Navigation ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Breadcrumbs appear at top of assessment page
- [ ] Shows: Assessments → Facility Name → Questions
- [ ] "Assessments" link is clickable and navigates correctly
- [ ] Current page (Questions) is not a link
- [ ] Breadcrumbs are visible on mobile
- [ ] Breadcrumbs are accessible (screen reader friendly)

**Expected Behavior:**
- Breadcrumbs should provide clear navigation context
- Should be visible immediately when page loads
- Should be responsive on mobile

---

### 6. Sticky Navigation ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Scroll down the page
- [ ] Sticky nav appears after scrolling ~100px
- [ ] Shows facility name
- [ ] Shows "Back to Assessments" button
- [ ] Shows "View Results" button
- [ ] Buttons are functional
- [ ] Sticky nav stays at top when scrolling
- [ ] Sticky nav has shadow for visibility
- [ ] Sticky nav disappears when scrolling back to top

**Expected Behavior:**
- Should appear smoothly (not jarring)
- Should not cover important content
- Should be easy to access navigation buttons

---

### 7. Question Grouping Visual Improvements ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Discipline/subtype headers are clearly visible
- [ ] Question count badges appear next to headers
- [ ] Visual separation between sections is clear
- [ ] Sections are easy to distinguish
- [ ] Layout is clean and uncluttered
- [ ] Headers are properly styled

**Expected Behavior:**
- Sections should be visually distinct
- Question counts should be accurate
- Layout should be professional and clean

---

### 8. Keyboard Navigation ✅
**Test Location:** `/assessments/[assessmentId]`

**What to Test:**
- [ ] Press Arrow Down - navigates to next question
- [ ] Press Arrow Up - navigates to previous question
- [ ] Focused question has blue outline
- [ ] Focused question has light blue background
- [ ] Page scrolls to focused question
- [ ] First radio button is auto-focused
- [ ] Press Enter/Space - focuses first radio button
- [ ] Press 1 - selects YES (if not in text input)
- [ ] Press 2 - selects NO (if not in text input)
- [ ] Press 3 - selects N/A (if not in text input)
- [ ] Tab key still works for normal form navigation
- [ ] Keyboard nav doesn't interfere with typing in inputs

**Expected Behavior:**
- Navigation should be smooth and intuitive
- Visual focus indicators should be clear
- Should not interfere with normal form interaction
- Should work throughout the entire assessment

---

## Testing Workflow

### Step 1: Start the Server
```bash
npm run dev
```

### Step 2: Open Browser
Navigate to: `http://localhost:3000`

### Step 3: Test Assessment Creation
1. Go to `/assessments`
2. Click "Create New Assessment"
3. Test error messages by submitting incomplete forms
4. Create a valid assessment

### Step 4: Test Assessment Execution
1. Open an assessment
2. Test all features listed above
3. Try on mobile device or browser dev tools
4. Test keyboard navigation

### Step 5: Test Edge Cases
- [ ] Very long facility names
- [ ] Many questions (100+)
- [ ] Rapid clicking/typing
- [ ] Network errors (disconnect internet, try to save)
- [ ] Browser back/forward buttons
- [ ] Page refresh during assessment

---

## Known Issues to Watch For

1. **Toast Notifications:**
   - May appear too quickly if saves are batched
   - Should still show correct count

2. **Keyboard Navigation:**
   - May need adjustment if questions are conditionally hidden
   - Should skip hidden questions

3. **Mobile:**
   - Sticky nav may need adjustment for very small screens
   - Touch targets should be tested on actual devices

4. **Progress Bar:**
   - Should handle 0 questions gracefully
   - Should handle 100% correctly

---

## Reporting Issues

When reporting issues, please include:
- Browser and version
- Device type (desktop/mobile)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Console errors (if any)

---

## Success Criteria

✅ All features work as expected
✅ No console errors
✅ No visual glitches
✅ Mobile experience is smooth
✅ Keyboard navigation is intuitive
✅ Error messages are helpful
✅ Performance is acceptable (no lag)
