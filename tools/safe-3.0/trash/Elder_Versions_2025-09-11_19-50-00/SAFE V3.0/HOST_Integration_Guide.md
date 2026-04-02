# HOST Visual Styling Integration Guide

This guide shows you how to apply the SAFE V3.0 visual styling to your HOST project without changing any of your existing JavaScript functions.

## Files Created

1. **`HOST_Visual_Styling.css`** - Complete CSS styling system extracted from SAFE
2. **`HOST_Template.html`** - Example HTML template showing how to use the styles
3. **`HOST_Integration_Guide.md`** - This guide

## Quick Integration Steps

### Step 1: Add the CSS File
Add this line to your HOST HTML file's `<head>` section:
```html
<link rel="stylesheet" href="HOST_Visual_Styling.css">
```

### Step 2: Update Your HTML Structure
Replace your existing HTML structure with the CISA-styled components:

#### Header Section
```html
<header class="header">
    <div class="header-content">
        <div class="logo">
            <div class="logo-text">
                <h1>HOST</h1>
                <p>Your Project Subtitle</p>
            </div>
        </div>
        <div>
            <h1>Your Main Title</h1>
            <p>Your project description</p>
        </div>
    </div>
</header>
```

#### Navigation Tabs
```html
<div class="nav-tabs">
    <button class="nav-tab active" data-tooltip="Home - Main dashboard" onclick="yourExistingFunction()">
        🏠
    </button>
    <button class="nav-tab" data-tooltip="Settings - Configuration" onclick="yourExistingFunction()">
        ⚙️
    </button>
    <!-- Add more tabs as needed -->
</div>
```

#### Content Sections
```html
<section id="yourSection" class="section active">
    <div class="section-header">
        <h2 class="section-title">Your Section Title</h2>
    </div>
    
    <!-- Your existing content here -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Card Title</h3>
        </div>
        <div class="card-body">
            <!-- Your content -->
        </div>
    </div>
</section>
```

### Step 3: Keep Your JavaScript Unchanged
**DO NOT MODIFY** your existing JavaScript functions. The styling system is designed to work with your existing code.

## Available Components

### Buttons
```html
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-success">Success Button</button>
<button class="btn btn-warning">Warning Button</button>
<button class="btn btn-danger">Danger Button</button>
<button class="btn btn-info">Info Button</button>
<button class="btn btn-secondary">Secondary Button</button>
```

### Cards
```html
<div class="card">
    <div class="card-header">
        <h3 class="card-title">Card Title</h3>
    </div>
    <div class="card-body">
        <p>Card content goes here</p>
    </div>
    <div class="card-footer">
        <button class="btn btn-primary">Action</button>
    </div>
</div>
```

### Forms
```html
<div class="form-group">
    <label class="form-label" for="inputId">Label</label>
    <input type="text" class="form-input" id="inputId" placeholder="Enter text">
</div>

<div class="form-row">
    <div class="form-group">
        <label class="form-label">Field 1</label>
        <input type="text" class="form-input">
    </div>
    <div class="form-group">
        <label class="form-label">Field 2</label>
        <select class="form-select">
            <option>Option 1</option>
        </select>
    </div>
</div>
```

### Alerts
```html
<div class="alert alert-info">Info message</div>
<div class="alert alert-success">Success message</div>
<div class="alert alert-warning">Warning message</div>
<div class="alert alert-danger">Danger message</div>
```

### Tables
```html
<table class="table">
    <thead>
        <tr>
            <th>Header 1</th>
            <th>Header 2</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Data 1</td>
            <td>Data 2</td>
        </tr>
    </tbody>
</table>
```

### Grid Layouts
```html
<div class="grid grid-2">  <!-- 2 columns -->
    <div class="card">Content 1</div>
    <div class="card">Content 2</div>
</div>

<div class="grid grid-3">  <!-- 3 columns -->
    <div class="card">Content 1</div>
    <div class="card">Content 2</div>
    <div class="card">Content 3</div>
</div>
```

### Progress Bars
```html
<div class="progress">
    <div class="progress-bar" style="width: 75%">75%</div>
</div>
```

## TLP Banner System (Optional)
```html
<!-- Add to your HTML -->
<div id="tlpBanner" class="tlp-banner white">
    <span>TLP:WHITE - This information may be shared freely</span>
</div>

<!-- JavaScript to show banners -->
function showTLPBanner(type, message) {
    const banner = document.getElementById('tlpBanner');
    banner.className = `tlp-banner ${type}`;
    banner.innerHTML = `<span>${message}</span>`;
    banner.classList.add('show');
    
    setTimeout(() => {
        banner.classList.remove('show');
    }, 5000);
}

// Usage:
showTLPBanner('green', 'TLP:GREEN - Operation completed successfully');
```

## Color System

The styling uses CISA's official color palette:

- **Primary Blue**: `#112e51` (--cisa-blue)
- **Light Blue**: `#205493` (--cisa-blue-light)
- **Lighter Blue**: `#0071bc` (--cisa-blue-lighter)
- **Success Green**: `#28a745` (--cisa-success)
- **Warning Yellow**: `#ffc107` (--cisa-warning)
- **Danger Red**: `#d83933` (--cisa-red)
- **Info Blue**: `#17a2b8` (--cisa-info)

## Responsive Design

The styling is fully responsive and will automatically adapt to different screen sizes. On mobile devices:
- Navigation tabs stack vertically
- Grid layouts become single column
- Form rows stack vertically
- Action bars become vertical

## Print Support

The styling includes print-optimized CSS that:
- Hides navigation and action elements
- Optimizes page breaks
- Ensures proper formatting for printed documents

## Customization

You can customize the styling by modifying the CSS variables in `HOST_Visual_Styling.css`:

```css
:root {
    --cisa-blue: #112e51;        /* Change primary color */
    --font-family: 'Your Font';  /* Change font family */
    --spacing-md: 1rem;          /* Change spacing */
}
```

## Migration Checklist

- [ ] Add `HOST_Visual_Styling.css` to your project
- [ ] Include the CSS file in your HTML `<head>`
- [ ] Update your HTML structure to use the new CSS classes
- [ ] Test all your existing JavaScript functions (they should work unchanged)
- [ ] Verify responsive design on different screen sizes
- [ ] Test print functionality if needed
- [ ] Customize colors/spacing if desired

## Support

The styling system is extracted from SAFE V3.0 and includes:
- ✅ CISA-compliant design
- ✅ Accessibility features
- ✅ Responsive design
- ✅ Print optimization
- ✅ Cross-browser compatibility
- ✅ Professional appearance

Your existing JavaScript functions will work without any modifications!
