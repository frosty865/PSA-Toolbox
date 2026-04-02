# Google Maps API Testing Guide

## Configuration Status

✅ **Google Maps API key has been added to `.env.local`**

The key is configured as:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBLDmxUqB7dWm4JLRN3v55p1q-oVZUaoFE
```

## Testing Steps

### 1. Restart Development Server

**Important**: Environment variables are loaded at server startup. You must restart the dev server after adding/changing `.env.local`.

```powershell
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Open Create Assessment Dialog

1. Navigate to the assessments page
2. Click "Create Assessment" button
3. The dialog should open

### 3. Verify API Key Loading

Open browser DevTools (F12) and check the Console tab. You should see:

**Success message:**
```
[Google Maps] API key found: AIzaSyBLDm...
```

**If you see a warning instead:**
```
Google Maps API key not found. Address autocomplete will not work.
Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in .env.local and the server has been restarted.
```

**Troubleshooting:**
- Ensure the dev server was restarted after adding the key
- Check that `.env.local` exists in the repo root
- Verify the key starts with `NEXT_PUBLIC_` prefix
- Check for typos in the variable name

### 4. Test Address Autocomplete

1. In the Create Assessment dialog, navigate to Step 1
2. Find the "Address Line 1" field
3. Start typing an address (e.g., "1600 Pennsylvania")
4. **Expected behavior:**
   - Google Places suggestions should appear as you type
   - Selecting a suggestion should auto-fill:
     - Address Line 1
     - City
     - State
     - ZIP Code
     - Latitude (read-only)
     - Longitude (read-only)

### 5. Verify Geocoding

After selecting an address from autocomplete:
- Latitude and Longitude fields should be automatically populated
- These fields should be read-only (grayed out)
- Values should be valid decimal numbers

## Expected Behavior

### ✅ Working Correctly

- Address autocomplete suggestions appear as you type
- Selecting an address fills all address fields automatically
- Latitude/longitude are auto-populated
- No console errors related to Google Maps

### ❌ Not Working

- No autocomplete suggestions appear
- Console shows "API key not found" warning
- Console shows Google Maps API errors (check API key restrictions)
- Address fields don't auto-populate

## Common Issues

### Issue: "API key not found" warning

**Solution:**
1. Verify `.env.local` exists in repo root
2. Check the variable name is exactly `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Restart the dev server
4. Clear browser cache and reload

### Issue: "This API key is not authorized" error

**Solution:**
1. Check Google Cloud Console → Credentials
2. Verify API key restrictions allow your domain
3. For localhost: Add `localhost:3000/*` to HTTP referrer restrictions
4. Ensure Places API and Geocoding API are enabled

### Issue: Autocomplete doesn't show suggestions

**Possible causes:**
1. API key restrictions too strict
2. Places API not enabled in Google Cloud Console
3. Browser blocking the script (check console for errors)
4. Network issues

## API Key Security

⚠️ **Important Security Notes:**

- The API key is exposed to the client (due to `NEXT_PUBLIC_` prefix)
- **Restrict the API key** in Google Cloud Console:
  - Application restrictions: HTTP referrers
  - Add: `localhost:3000/*`, `yourdomain.com/*`
  - API restrictions: Select only Places API and Geocoding API
- Monitor usage in Google Cloud Console
- Never commit `.env.local` to version control (it's gitignored)

## Test Script

A test script is available at `scripts/test_google_maps_api.ps1`:

```powershell
.\scripts\test_google_maps_api.ps1
```

This verifies:
- `.env.local` file exists
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is present
- Key format is valid

## Manual Verification

To manually verify the key is loaded:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
4. Should show the API key (or undefined if not loaded)

**Note**: This only works in development mode. In production, environment variables are embedded at build time.
