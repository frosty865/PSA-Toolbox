# HOST-WEB Quick Start Guide

## Getting Started

### Option 1: Local Development (No Server Required)
1. Navigate to the `HOST-WEB` folder
2. Double-click `index.html` to open in your default browser
3. The application runs entirely client-side - no server needed!

### Option 2: Web Server Deployment
1. Upload the entire `HOST-WEB` folder to your web server
2. Maintain the directory structure exactly as provided
3. Access via: `http://your-domain.com/HOST-WEB/`

## First Use

1. **Start Assessment**: Click "Start Assessment" on the landing page
2. **Fill in Facility Info**: Complete the facility information tab
3. **Navigate Tabs**: Use the progress bar to navigate between assessment sections
4. **Save Your Work**: Use "Export Data" to save your assessment as JSON
5. **Generate Reports**: Navigate to Executive Summary or Final Report tabs

## Key Features

### Security Assessment
- Complete multi-tab security assessment
- Real-time progress tracking
- Data validation and error checking

### VOFC Vulnerability Analysis
- Automated vulnerability detection
- Click "Run Analysis" on report pages
- View detailed vulnerability dashboard

### FIFA VIP Standards
- VIP-specific security assessment
- Click "VIP Report" button for FIFA compliance report
- Toggle VIP inclusion/exclusion

### Data Management
- **Export**: Save assessment data as JSON
- **Import**: Load previously saved assessments
- **Sample Data**: Use provided sample files for testing

## Browser Requirements

- **Recommended**: Chrome, Edge, or Firefox (latest versions)
- **Minimum**: Modern browser with JavaScript enabled
- **Not Supported**: Internet Explorer

## Troubleshooting

### Application Won't Load
- Check browser console for errors (F12)
- Verify all files are in correct directories
- Ensure JavaScript is enabled in browser

### Styles Look Broken
- Verify `Assets/css/` directory exists
- Check browser console for 404 errors on CSS files
- Clear browser cache and reload

### JavaScript Errors
- Verify `LocalData/` directory contains all JS files
- Check browser console for specific error messages
- Ensure all script files loaded successfully

## Need Help?

Refer to:
- `README.md` - Full documentation
- `DEPLOYMENT_CHECKLIST.md` - Deployment guide
- Browser console (F12) - Error messages and debugging

## File Structure

```
HOST-WEB/
├── index.html          ← Start here!
├── Assets/            ← CSS and images
├── LocalData/         ← JavaScript modules
└── Data/              ← Sample data files
```

Enjoy using HOST V2!

