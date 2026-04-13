# HOST V2 - Web Version
## Hotel Operations Security Tool

### Overview
This is the web deployment version of the HOST V2 (Hotel Operations Security Tool) application. It provides comprehensive security assessment capabilities for hotel facilities, including VIP security evaluation using FIFA standards.

### Features
- **Comprehensive Security Assessment** - Multi-tab assessment covering facility information, dependencies, physical security, security systems, VIP operations, and emergency planning
- **VOFC Integration** - Automated vulnerability detection and options for consideration
- **FIFA VIP Standards** - Specialized VIP security assessment using FIFA World Cup hosting standards
- **Executive Reporting** - Comprehensive executive summaries and detailed security reports
- **Data Management** - JSON import/export for assessment data
- **Offline Capable** - All assets and dependencies are local, no external CDN requirements

### Directory Structure
```
HOST-WEB/
├── index.html              # Main application file
├── Assets/
│   ├── css/               # Stylesheet files
│   │   ├── styles.css
│   │   ├── cisa_styles.css
│   │   ├── inline_styles.css
│   │   └── fontawesome-local.css
│   └── images/           # Image assets
├── LocalData/             # JavaScript modules
│   ├── vofc_*.js         # VOFC vulnerability analysis system
│   ├── fifa_standards.js  # FIFA VIP standards
│   ├── enhanced_mitigations.js
│   └── heuristic_mapping.js
└── Data/                  # Sample data and configuration
    ├── Complete_Assessment_Scenario.json
    ├── Sample_Assessment_Data.json
    └── extracted_css.css
```

### Deployment

#### Local Development
1. Open `index.html` in a modern web browser
2. The application runs entirely client-side - no server required

#### Web Server Deployment
1. Upload all files maintaining the directory structure
2. Ensure web server supports:
   - Static file serving (HTML, CSS, JS, JSON)
   - Proper MIME types for JSON files
3. Access via: `http://your-domain.com/HOST-WEB/`

#### Recommended Web Servers
- **Apache** - Works out of the box
- **Nginx** - Requires JSON MIME type configuration
- **IIS** - May require MIME type configuration for JSON
- **Node.js/Express** - Static file serving
- **GitHub Pages** - Direct deployment from repository

### Browser Compatibility
- **Chrome/Edge** (Recommended) - Full feature support
- **Firefox** - Full feature support
- **Safari** - Full feature support
- **Internet Explorer** - Not supported (use Edge instead)

### Key Functionality

#### Security Assessment Tabs
1. **Landing Page** - Application overview and navigation
2. **Facility Info** - Basic facility information and classification
3. **Dependencies** - Critical infrastructure dependencies
4. **Physical Security** - Perimeter barriers, standoff distances, lighting
5. **Security Systems** - Video surveillance, access control, monitoring
6. **VIP Operations** - VIP security measures and FIFA compliance
7. **Emergency Planning** - Emergency procedures and training
8. **Executive Summary** - Assessment overview and analysis
9. **Final Report** - Comprehensive security assessment report

#### VOFC Vulnerability Analysis
- Automated vulnerability detection based on form data
- Options for consideration for each identified vulnerability
- Real-time vulnerability dashboard
- Manual analysis trigger

#### FIFA VIP Standards
- VIP-specific security assessment
- FIFA World Cup hosting standards compliance
- Dedicated VIP report generation
- VIP inclusion/exclusion toggle

### Data Management

#### Export Assessment Data
- Click "Export Data" button in data management panel
- Generates timestamped JSON file
- Contains all form data and assessment information

#### Import Assessment Data
- Click "Load Assessment Data" button
- Select previously exported JSON file
- All form fields populate automatically

#### Sample Data
- `Complete_Assessment_Scenario.json` - Complete example assessment
- `Sample_Assessment_Data.json` - Basic sample data

### Security Features
- **Offline Operation** - No external network dependencies
- **Local Data Storage** - All data remains on user's device
- **No Cloud Services** - Fully air-gapped capable
- **Client-Side Processing** - All analysis runs in browser

### Troubleshooting

#### CSS Not Loading
- Verify `Assets/css/` directory exists and contains all CSS files
- Check browser console for 404 errors
- Ensure web server allows CSS file serving

#### JavaScript Errors
- Verify `LocalData/` directory contains all JS files
- Check browser console for specific error messages
- Ensure JSON files in `Data/` directory are valid

#### Images Not Displaying
- Verify `Assets/images/` directory exists
- Check image file paths in form data
- Ensure web server allows image file serving

### Version Information
- **Version**: 2.0 (Web Deployment)
- **Last Updated**: November 2025
- **Base Package**: HOST_V1_Deployment_Package

### Support
For issues or questions, refer to the main HOST_V1_Deployment_Package documentation.

### License
This tool is designed for security assessment purposes. Ensure proper authorization before conducting assessments.

