# Google Maps API Setup

## Overview

The Create Assessment wizard now includes:
- **Google Places Autocomplete** for address input
- **Automatic geocoding** to populate latitude/longitude from address
- **Required POC fields** (name, email, phone)

## Setup Instructions

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (for address autocomplete)
   - **Geocoding API** (for lat/long conversion)
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the API key (recommended):
   - Application restrictions: HTTP referrers
   - Add your domain (e.g., `localhost:3000/*`, `yourdomain.com/*`)
   - API restrictions: Select "Restrict key" and choose:
     - Places API
     - Geocoding API

### 2. Add to Environment Variables

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important**: The `NEXT_PUBLIC_` prefix is required for client-side access.

### 3. Restart Development Server

After adding the environment variable, restart your Next.js dev server:

```bash
npm run dev
```

## Features

### Address Autocomplete
- Type in the "Address Line 1" field
- Google Places will suggest addresses as you type
- Selecting an address automatically fills:
  - Address Line 1 (street number + route)
  - City
  - State
  - ZIP Code
  - Latitude (read-only, auto-filled)
  - Longitude (read-only, auto-filled)

### Required Fields
- **POC Name** - Required
- **POC Email** - Required (validated as email)
- **POC Phone** - Required

### Validation
- Step 1 cannot proceed without:
  - Assessment Name
  - Facility Name
  - POC Name
  - POC Email
  - POC Phone

## Fallback Behavior

If the Google Maps API key is not configured:
- Address autocomplete will not work
- Users can still manually enter address fields
- Latitude/longitude can be manually entered (though they should auto-populate from address)
- A warning message will appear below the address field

## API Costs

Google Maps Platform uses a pay-as-you-go pricing model:
- **Places API (Autocomplete)**: $2.83 per 1,000 requests
- **Geocoding API**: $5.00 per 1,000 requests

For development/testing, Google provides $200/month in free credits.

## Security Notes

- Never commit your API key to version control
- Use environment variables (`.env.local` is gitignored)
- Restrict your API key to specific domains/APIs
- Monitor usage in Google Cloud Console
