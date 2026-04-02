/**
 * SAFE Paged.js Production Print System
 * Advanced A4 report export using paged.js for professional pagination
 * 
 * Features:
 * - A4 format with proper margins (20mm all around)
 * - Advanced pagination with paged.js
 * - Running headers and footers
 * - Professional report formatting
 * - Multiple export options (Browser Print, PDF, HTML)
 * - Table of contents support
 * - Cross-references with page numbers
 */

class SAFEPagedJSPrintSystem {
    constructor() {
        this.A4_WIDTH_MM = 210;
        this.A4_HEIGHT_MM = 297;
        this.MARGIN_MM = 20;
        this.CONTENT_WIDTH_MM = this.A4_WIDTH_MM - (this.MARGIN_MM * 2);
        this.CONTENT_HEIGHT_MM = this.A4_HEIGHT_MM - (this.MARGIN_MM * 2);
        
        // Convert mm to pixels (assuming 96 DPI)
        this.A4_WIDTH_PX = this.mmToPx(this.A4_WIDTH_MM);
        this.A4_HEIGHT_PX = this.mmToPx(this.A4_HEIGHT_MM);
        this.MARGIN_PX = this.mmToPx(this.MARGIN_MM);
        this.CONTENT_WIDTH_PX = this.mmToPx(this.CONTENT_WIDTH_MM);
        this.CONTENT_HEIGHT_PX = this.mmToPx(this.CONTENT_HEIGHT_MM);
        
        // Initialize paged.js
        this.initializePagedJS();
    }

    mmToPx(mm) {
        return (mm * 96) / 25.4; // 96 DPI conversion
    }

    pxToMm(px) {
        return (px * 25.4) / 96;
    }

    /**
     * Load paged.js dynamically when needed
     */
    async loadPagedJS() {
        if (typeof Paged !== 'undefined') {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';
            script.onload = () => {
                this.setupPagedJS();
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load paged.js'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize paged.js with custom configuration
     */
    initializePagedJS() {
        // Don't auto-initialize - wait for explicit call
        console.log('Paged.js system ready - will load when needed');
    }

    setupPagedJS() {
        // Configure paged.js
        Paged.registerHandlers({
            beforeParsed: (content) => {
                this.prepareContentForPagination(content);
            },
            afterParsed: (content) => {
                this.finalizePagination(content);
            },
            beforePage: (page) => {
                this.beforePageRender(page);
            },
            afterPage: (page) => {
                this.afterPageRender(page);
            }
        });
    }

    /**
     * Prepare content for pagination
     */
    prepareContentForPagination(content) {
        // Add page break classes to major sections
        const sections = content.querySelectorAll('.report-section, .executive-summary, .key-findings, .security-posture, .recommendations, .findings-detail, .assessment-results');
        
        sections.forEach((section, index) => {
            if (index > 0) {
                // Add page break before major sections (except first)
                section.classList.add('page-break');
            }
            
            // Add keep-together class to prevent breaking within sections
            section.classList.add('keep-together');
        });

        // Add string-set for running headers
        const headings = content.querySelectorAll('h1, h2');
        headings.forEach(heading => {
            heading.setAttribute('data-string-set', 'chapter-title');
        });

        // Prepare table of contents if needed
        this.generateTableOfContents(content);
    }

    /**
     * Generate table of contents
     */
    generateTableOfContents(content) {
        const tocContainer = content.querySelector('.table-of-contents');
        if (!tocContainer) return;

        const headings = content.querySelectorAll('h1, h2, h3');
        const tocList = document.createElement('ul');
        tocList.className = 'toc-list';

        headings.forEach((heading, index) => {
            const id = `heading-${index}`;
            heading.id = id;

            const tocItem = document.createElement('li');
            tocItem.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
            
            const link = document.createElement('a');
            link.href = `#${id}`;
            link.textContent = heading.textContent;
            link.className = 'toc-link';
            
            tocItem.appendChild(link);
            tocList.appendChild(tocItem);
        });

        tocContainer.appendChild(tocList);
    }

    /**
     * Finalize pagination after paged.js processing
     */
    finalizePagination(content) {
        // Add cross-references with page numbers
        const links = content.querySelectorAll('a[href^="#"]');
        links.forEach(link => {
            const target = content.querySelector(link.getAttribute('href'));
            if (target) {
                link.setAttribute('data-target-counter', 'page');
            }
        });

        // Ensure proper page breaks for long content
        this.optimizePageBreaks(content);
    }

    /**
     * Optimize page breaks for better layout
     */
    optimizePageBreaks(content) {
        // Find elements that might need manual page breaks
        const longElements = content.querySelectorAll('.long-content, .vofc-item, .enhancement-item, .commendable-item');
        
        longElements.forEach(element => {
            const height = element.offsetHeight;
            if (height > this.CONTENT_HEIGHT_PX * 0.8) {
                element.classList.add('allow-break');
            }
        });
    }

    /**
     * Before page render callback
     */
    beforePageRender(page) {
        // Add any pre-page rendering logic here
        console.log('Rendering page:', page);
    }

    /**
     * After page render callback
     */
    afterPageRender(page) {
        // Add any post-page rendering logic here
        console.log('Page rendered:', page);
    }

    /**
     * Export to PDF using paged.js and browser print
     */
    async exportToPDF(reportContentParam, facilityInfo = {}) {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            console.error('Report content not found');
            return;
        }

        // Load paged.js if not already loaded
        try {
            await this.loadPagedJS();
        } catch (error) {
            console.error('Failed to load paged.js:', error);
            return;
        }

        // Create a new window with paged.js enabled
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        
        // Get all CSS from the main document
        const allStyles = Array.from(document.querySelectorAll('style')).map(style => style.innerHTML).join('\n');
        
        // Get the paged.js CSS content
        const pagedJSCSS = this.getPagedJSCSS();
        
        // Create HTML with paged.js
        const printHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAFE Final Report - ${facilityInfo.facilityName || 'Security Assessment'}</title>
    <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
    <style>
        /* Include all main application CSS */
        ${allStyles}
        
        /* Include paged.js CSS */
        ${pagedJSCSS}
        
        /* Print-specific overrides */
        body {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        .report-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <h1>SAFE Report</h1>
        ${facilityInfo.facilityName ? `<div class="facility-info">${facilityInfo.facilityName}</div>` : ''}
    </div>
    
    <div class="report-content">
        ${reportContent.innerHTML}
    </div>
    
    <script>
        // Initialize paged.js
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Paged !== 'undefined') {
                Paged.registerHandlers({
                    beforeParsed: (content) => {
                        // Prepare content for pagination
                        const sections = content.querySelectorAll('.report-section, .executive-summary, .key-findings, .security-posture, .recommendations, .findings-detail, .assessment-results');
                        sections.forEach((section, index) => {
                            if (index > 0) {
                                section.classList.add('page-break');
                            }
                            section.classList.add('keep-together');
                        });
                    }
                });
                
                // Process the content
                Paged.preview();
            }
        });
    </script>
</body>
</html>`;
        
        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        printWindow.onload = () => {
            // Wait for paged.js to process the content
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 2000);
        };
    }

    /**
     * Export to HTML file with paged.js
     */
    async exportToHTML(reportContentParam, facilityInfo = {}) {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            console.error('Report content not found');
            return;
        }

        // Load paged.js if not already loaded
        try {
            await this.loadPagedJS();
        } catch (error) {
            console.error('Failed to load paged.js:', error);
            return;
        }

        // Get all CSS from the main document
        const allStyles = Array.from(document.querySelectorAll('style')).map(style => style.innerHTML).join('\n');
        
        // Get the paged.js CSS content
        const pagedJSCSS = this.getPagedJSCSS();
        
        // Create HTML with paged.js
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAFE Final Report - ${facilityInfo.facilityName || 'Security Assessment'}</title>
    <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
    <style>
        /* Include all main application CSS */
        ${allStyles}
        
        /* Include paged.js CSS */
        ${pagedJSCSS}
        
        /* Preview styling */
        body {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        .report-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <h1>SAFE Report</h1>
        ${facilityInfo.facilityName ? `<div class="facility-info">${facilityInfo.facilityName}</div>` : ''}
    </div>
    
    <div class="report-content">
        ${reportContent.innerHTML}
    </div>
    
    <script>
        // Initialize paged.js
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Paged !== 'undefined') {
                Paged.registerHandlers({
                    beforeParsed: (content) => {
                        // Prepare content for pagination
                        const sections = content.querySelectorAll('.report-section, .executive-summary, .key-findings, .security-posture, .recommendations, .findings-detail, .assessment-results');
                        sections.forEach((section, index) => {
                            if (index > 0) {
                                section.classList.add('page-break');
                            }
                            section.classList.add('keep-together');
                        });
                    }
                });
                
                // Process the content
                Paged.preview();
            }
        });
    </script>
</body>
</html>`;
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAFE_Report_${facilityInfo.facilityName || 'Assessment'}_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get the paged.js CSS content
     */
    getPagedJSCSS() {
        // This would normally load from the CSS file, but for now we'll return the key styles
        return `
        @page {
            size: A4;
            margin: 20mm;
            @top-center {
                content: "SAFE Security Assessment Report";
                font-family: 'Segoe UI', sans-serif;
                font-size: 10pt;
                color: #112e51;
                font-weight: 500;
            }
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: 'Segoe UI', sans-serif;
                font-size: 9pt;
                color: #5b616b;
            }
            @top-left {
                content: "CISA";
                font-family: 'Segoe UI', sans-serif;
                font-size: 9pt;
                color: #5b616b;
                font-weight: 600;
            }
            @bottom-left {
                content: "Confidential - For Official Use Only";
                font-family: 'Segoe UI', sans-serif;
                font-size: 8pt;
                color: #5b616b;
            }
        }
        
        .page-break {
            break-before: page;
        }
        
        .keep-together {
            break-inside: avoid;
        }
        
        .avoid-break {
            break-inside: avoid;
        }
        `;
    }

    /**
     * Enable paged.js preview mode
     */
    enablePreview() {
        if (typeof Paged !== 'undefined') {
            Paged.preview();
        } else {
            console.warn('Paged.js not available');
        }
    }

    /**
     * Disable paged.js preview mode
     */
    disablePreview() {
        if (typeof Paged !== 'undefined') {
            Paged.unpreview();
        }
    }
}

// Global instance
window.SAFEPagedJSPrint = new SAFEPagedJSPrintSystem();

// Convenience functions
window.exportPagedJSPDF = async function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showWarningBanner('Please generate a Final Report first before exporting.', 'warning');
        return;
    }
    
    const facilityInfo = {
        facilityName: document.getElementById('facilityName')?.value || '',
        facilityAddress: document.getElementById('facilityAddress')?.value || ''
    };
    
    try {
        await window.SAFEPagedJSPrint.exportToPDF(reportContent, facilityInfo);
    } catch (error) {
        console.error('Export failed:', error);
        showWarningBanner('Export failed. Please try again.', 'error');
    }
};

window.exportPagedJSHTML = async function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showWarningBanner('Please generate a Final Report first before exporting.', 'warning');
        return;
    }
    
    const facilityInfo = {
        facilityName: document.getElementById('facilityName')?.value || '',
        facilityAddress: document.getElementById('facilityAddress')?.value || ''
    };
    
    try {
        await window.SAFEPagedJSPrint.exportToHTML(reportContent, facilityInfo);
    } catch (error) {
        console.error('Export failed:', error);
        showWarningBanner('Export failed. Please try again.', 'error');
    }
};

window.togglePagedJSPreview = async function() {
    if (document.body.classList.contains('pagedjs-preview')) {
        window.SAFEPagedJSPrint.disablePreview();
        document.body.classList.remove('pagedjs-preview');
    } else {
        try {
            await window.SAFEPagedJSPrint.loadPagedJS();
            window.SAFEPagedJSPrint.enablePreview();
            document.body.classList.add('pagedjs-preview');
        } catch (error) {
            console.error('Failed to load paged.js for preview:', error);
            showWarningBanner('Preview failed to load. Please try again.', 'error');
        }
    }
};

// Debug: Check if functions are properly defined
console.log('SAFE Paged.js Print System loaded');
console.log('SAFEPagedJSPrint available:', typeof window.SAFEPagedJSPrint !== 'undefined');
console.log('exportPagedJSPDF available:', typeof window.exportPagedJSPDF !== 'undefined');
console.log('exportPagedJSHTML available:', typeof window.exportPagedJSHTML !== 'undefined');
console.log('togglePagedJSPreview available:', typeof window.togglePagedJSPreview !== 'undefined');
