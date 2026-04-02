# Question Focus Page Availability Issue

## Problem Summary

The Question Focus pages for Video Surveillance Systems show "(page not available)" for all 11 subtypes, even though 6 markdown files exist.

## Root Cause

1. **Missing Subtype Codes**: The Video Surveillance subtypes in the taxonomy (`discipline_subtypes.json`) do not have `subtype_code` fields.

2. **Matching Logic**: The `hasQuestionFocusPage()` function in `app/reference/question-focus/page.tsx` checks for page availability by matching:
   - `subtype.code` (normalized to uppercase) 
   - With markdown filename (without `.md` extension)

3. **Mismatch**: Since subtypes lack codes, the matching fails and all subtypes show as unavailable.

## Current State

### Taxonomy Subtypes (11 total, all without codes):
- Analytics / Behavior Detection
- Camera Coverage / Line of Sight
- Exterior Cameras
- Fixed Cameras
- Interior Cameras
- IP Cameras
- Monitoring / Workstations
- PTZ Cameras
- Recording / Storage (NVR/DVR)
- System Architecture
- Video Wall / Display Systems

### Existing Markdown Files (6 total):
- `VIDEO_SURVEILLANCE/VSS_ANALYTICS_CAPABILITY.md`
- `VIDEO_SURVEILLANCE/VSS_CAMERA_COVERAGE.md`
- `VIDEO_SURVEILLANCE/VSS_MONITORING.md`
- `VIDEO_SURVEILLANCE/VSS_RECORDING_AND_RETENTION.md`
- `VIDEO_SURVEILLANCE/VSS_SYSTEM_MANAGEMENT.md`
- `VIDEO_SURVEILLANCE/VSS_SYSTEM_PRESENCE.md`

## Solution Options

### Option 1: Add Subtype Codes to Taxonomy (Recommended)
Add `subtype_code` fields to match the markdown filenames:
- "Analytics / Behavior Detection" → `VSS_ANALYTICS_CAPABILITY`
- "Camera Coverage / Line of Sight" → `VSS_CAMERA_COVERAGE`
- "Monitoring / Workstations" → `VSS_MONITORING`
- "Recording / Storage (NVR/DVR)" → `VSS_RECORDING_AND_RETENTION`
- "System Architecture" → `VSS_SYSTEM_MANAGEMENT` (or create new file)
- (Other subtypes need new markdown files or mapping)

### Option 2: Update Matching Logic
Modify `hasQuestionFocusPage()` to:
- First try matching by `subtype.code`
- If no code exists, try matching by `subtype.name` (normalized)
- Use a mapping function to convert subtype names to markdown filenames

### Option 3: Create Missing Markdown Files
Create markdown files for the 5 missing subtypes:
- Exterior Cameras
- Fixed Cameras
- Interior Cameras
- IP Cameras
- PTZ Cameras
- Video Wall / Display Systems

## Files Involved

- `app/reference/question-focus/page.tsx` - UI component with `hasQuestionFocusPage()` function
- `app/api/reference/question-focus/route.ts` - API that scans for markdown files
- `app/api/reference/question-focus/[discipline]/[subtype]/route.ts` - API that loads markdown content
- `../psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json` - Taxonomy file (missing codes)
- `../psa_engine/docs/reference/question_focus/VIDEO_SURVEILLANCE/*.md` - Markdown files

## Next Steps

1. Decide on solution approach (Option 1, 2, or 3)
2. Implement the chosen solution
3. Test that pages are now available
4. Verify all 11 subtypes either have pages or show appropriate "not available" message






