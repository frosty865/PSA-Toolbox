# CISA Design System CSS

A comprehensive CSS framework extracted from the SAFE V3.0 Comprehensive Security Assessment application, designed to provide CISA-compliant styling for government and security applications.

## Features

### 🎨 **Official CISA Color Palette**
- Primary blues, grays, and accent colors
- TLP (Traffic Light Protocol) color system
- Consistent color variables for easy theming

### 📝 **Typography System**
- Source Sans Pro font family (with system font fallbacks)
- Consistent font sizes and weights
- CISA house style compliance

### 📏 **Spacing System**
- Standardized spacing scale (xs, sm, md, lg, xl, xxl)
- Consistent margins and padding
- Grid-based layout support

### 🧩 **Component Library**
- **Buttons**: Primary, secondary, success, warning, danger, info variants
- **Forms**: Inputs, selects, textareas, radio buttons, checkboxes
- **Alerts**: Info, warning, success, danger with left border styling
- **Cards**: Flexible card components with headers and bodies
- **Tables**: Responsive tables with hover effects
- **Navigation**: Tab-based navigation with tooltips
- **Progress Bars**: Animated progress indicators

### 🚨 **TLP Banner System**
- Color-coded slide-in banners
- TLP compliance (White, Green, Amber, Red, Black)
- Animated show/hide transitions
- Auto-dismiss functionality

### 🖨️ **Print Optimization**
- Print-safe styles
- Page break controls
- Color preservation
- Optimized for Letter/A4 formats

### 📱 **Responsive Design**
- Mobile-first approach
- Flexible grid system
- Responsive navigation
- Touch-friendly interactions

### ♿ **Accessibility Features**
- Focus indicators
- High contrast support
- Screen reader friendly
- Keyboard navigation support

## Quick Start

1. **Include the CSS file:**
```html
<link rel="stylesheet" href="CISA_Design_System.css">
```

2. **Use the CSS variables:**
```css
.my-component {
    background-color: var(--cisa-blue);
    color: var(--cisa-white);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
}
```

3. **Apply component classes:**
```html
<button class="btn btn-primary">Primary Action</button>
<div class="alert alert-info">Information message</div>
<div class="card">
    <div class="card-header">
        <h3 class="card-title">Card Title</h3>
    </div>
    <div class="card-body">Card content goes here</div>
</div>
```

## Color Palette

### Primary Colors
- `--cisa-blue`: #112e51 (Primary blue)
- `--cisa-blue-light`: #205493 (Light blue)
- `--cisa-blue-lighter`: #0071bc (Lighter blue)
- `--cisa-blue-lightest`: #e1f3fd (Lightest blue)

### Secondary Colors
- `--cisa-gray`: #5b616b (Primary gray)
- `--cisa-gray-light`: #d6d7d9 (Light gray)
- `--cisa-gray-lighter`: #f1f1f2 (Lighter gray)

### Status Colors
- `--cisa-success`: #28a745 (Success green)
- `--cisa-warning`: #ffc107 (Warning yellow)
- `--cisa-info`: #17a2b8 (Info blue)
- `--cisa-red`: #d83933 (Danger red)

### TLP Colors (Using CISA Official Colors)
- `--tlp-white`: var(--cisa-white) (TLP:WHITE)
- `--tlp-green`: var(--cisa-success) (TLP:GREEN)
- `--tlp-amber`: var(--cisa-warning) (TLP:AMBER)
- `--tlp-red`: var(--cisa-red) (TLP:RED)
- `--tlp-black`: var(--cisa-black) (TLP:BLACK)

## Component Examples

### Buttons
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-success">Success</button>
<button class="btn btn-warning">Warning</button>
<button class="btn btn-danger">Danger</button>
<button class="btn btn-info">Info</button>
```

### Alerts
```html
<div class="alert alert-info">Information alert</div>
<div class="alert alert-warning">Warning alert</div>
<div class="alert alert-success">Success alert</div>
<div class="alert alert-danger">Danger alert</div>
```

### Forms
```html
<div class="form-group">
    <label class="form-label">Input Label</label>
    <input type="text" class="form-input" placeholder="Enter text">
</div>

<div class="form-group">
    <label class="form-label">Select Label</label>
    <select class="form-select">
        <option>Option 1</option>
        <option>Option 2</option>
    </select>
</div>
```

### TLP Banners
```html
<div class="banner-container show">
    <div class="banner banner-tlp-green">
        <div class="banner-header">
            <span>TLP:GREEN</span>
            <button class="banner-close">&times;</button>
        </div>
        <div class="banner-content">
            TLP:GREEN information can be shared with the community.
        </div>
    </div>
</div>
```

## Utility Classes

### Spacing
- `mt-0` to `mt-5`: Margin top
- `mb-0` to `mb-5`: Margin bottom
- `p-0` to `p-5`: Padding
- `m-0` to `m-5`: Margin

### Display
- `d-none`: Display none
- `d-block`: Display block
- `d-flex`: Display flex
- `d-grid`: Display grid

### Text
- `text-center`: Center align
- `text-left`: Left align
- `text-right`: Right align
- `text-primary`: Primary color text
- `text-success`: Success color text

### Backgrounds
- `bg-primary`: Primary background
- `bg-success`: Success background
- `bg-light`: Light background
- `bg-white`: White background

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
- Internet Explorer 11+ (with limited support)

## License

This CSS framework is extracted from the SAFE V3.0 application and follows CISA design guidelines. Use in accordance with your organization's policies and CISA guidelines.

## Contributing

This framework is extracted from a working application. For modifications, please ensure compliance with CISA design standards and accessibility guidelines.

## Version

**Version**: 1.0.0  
**Extracted from**: SAFE V3.0 Comprehensive Security Assessment  
**Date**: 2024-12-19  
**CISA Compliance**: Yes
