/**
 * SAFE Production Print System
 * Comprehensive A4 report export with intelligent page breaks and proper margins
 * 
 * Features:
 * - A4 format with proper margins (20mm all around)
 * - Intelligent content analysis for page breaks
 * - Dynamic content height calculation
 * - Professional report formatting
 * - Multiple export options (Browser Print, PDF, HTML)
 */

class SAFEProductionPrintSystem {
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
        
        // Content analysis settings
        this.MIN_SECTION_HEIGHT_PX = 100; // Minimum height for a section
        this.HEADER_FOOTER_HEIGHT_PX = 50; // Space for headers/footers
        this.AVAILABLE_CONTENT_HEIGHT_PX = this.CONTENT_HEIGHT_PX - this.HEADER_FOOTER_HEIGHT_PX;
    }

    mmToPx(mm) {
        return (mm * 96) / 25.4; // 96 DPI conversion
    }

    pxToMm(px) {
        return (px * 25.4) / 96;
    }

    /**
     * Analyze content and calculate optimal page breaks
     */
    analyzeContentForPageBreaks(contentElement) {
        const sections = this.identifySections(contentElement);
        const pageBreaks = [];
        let currentPageHeight = 0;
        let currentPageSections = [];

        sections.forEach((section, index) => {
            const sectionHeight = this.calculateElementHeight(section.element);
            const sectionWithHeader = sectionHeight + this.getSectionHeaderHeight(section);

            // Check if section fits on current page
            if (currentPageHeight + sectionWithHeader <= this.AVAILABLE_CONTENT_HEIGHT_PX) {
                currentPageSections.push(section);
                currentPageHeight += sectionWithHeader;
            } else {
                // Need a page break
                if (currentPageSections.length > 0) {
                    pageBreaks.push({
                        type: 'section',
                        beforeSection: index,
                        sections: [...currentPageSections],
                        pageHeight: currentPageHeight
                    });
                }

                // Start new page
                currentPageSections = [section];
                currentPageHeight = sectionWithHeader;
            }
        });

        // Add final page
        if (currentPageSections.length > 0) {
            pageBreaks.push({
                type: 'section',
                beforeSection: sections.length,
                sections: currentPageSections,
                pageHeight: currentPageHeight
            });
        }

        return pageBreaks;
    }

    /**
     * Identify major sections in the content
     */
    identifySections(contentElement) {
        const sections = [];
        const sectionSelectors = [
            '.report-section',
            '.executive-summary',
            '.key-findings',
            '.security-posture',
            '.recommendations',
            '.findings-detail',
            '.assessment-results',
            '.implementation-guide'
        ];

        sectionSelectors.forEach(selector => {
            const elements = contentElement.querySelectorAll(selector);
            elements.forEach(element => {
                if (element.offsetHeight > this.MIN_SECTION_HEIGHT_PX) {
                    sections.push({
                        element: element,
                        type: this.getSectionType(element),
                        title: this.getSectionTitle(element),
                        height: element.offsetHeight
                    });
                }
            });
        });

        return sections;
    }

    getSectionType(element) {
        if (element.classList.contains('executive-summary')) return 'executive-summary';
        if (element.classList.contains('key-findings')) return 'key-findings';
        if (element.classList.contains('security-posture')) return 'security-posture';
        if (element.classList.contains('recommendations')) return 'recommendations';
        if (element.classList.contains('findings-detail')) return 'findings-detail';
        if (element.classList.contains('assessment-results')) return 'assessment-results';
        if (element.classList.contains('implementation-guide')) return 'implementation-guide';
        return 'report-section';
    }

    getSectionTitle(element) {
        const h2 = element.querySelector('h2');
        const h3 = element.querySelector('h3');
        return h2 ? h2.textContent : (h3 ? h3.textContent : 'Section');
    }

    getSectionHeaderHeight(section) {
        const header = section.element.querySelector('h2, h3');
        return header ? header.offsetHeight + 20 : 0; // 20px margin
    }

    calculateElementHeight(element) {
        // Create a temporary clone to measure height
        const clone = element.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.width = this.CONTENT_WIDTH_PX + 'px';
        clone.style.height = 'auto';
        
        document.body.appendChild(clone);
        const height = clone.offsetHeight;
        document.body.removeChild(clone);
        
        return height;
    }

    /**
     * Generate production-ready A4 print HTML
     */
    generateProductionPrintHTML(reportContent, facilityInfo = {}) {
        const pageBreaks = this.analyzeContentForPageBreaks(reportContent);
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAFE Final Report - ${facilityInfo.facilityName || 'Security Assessment'}</title>
    <style>
        /* A4 Production Print Styles */
        @page {
            size: A4;
            margin: ${this.MARGIN_MM}mm;
            @top-center {
                content: "SAFE Security Assessment Report";
                font-family: 'Segoe UI', sans-serif;
                font-size: 10pt;
                color: #112e51;
            }
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: 'Segoe UI', sans-serif;
                font-size: 9pt;
                color: #5b616b;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #1b1b1b;
            background: white;
            width: ${this.CONTENT_WIDTH_PX}px;
            margin: 0 auto;
        }

        /* Print-specific styles */
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            .page-break {
                page-break-before: always;
                break-before: page;
            }
            
            .avoid-break {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            .keep-together {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                break-after: avoid;
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            table {
                page-break-inside: auto;
                break-inside: auto;
            }
            
            thead {
                display: table-header-group;
            }
            
            tbody tr {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }

        /* Report Header */
        .report-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #112e51;
            page-break-after: avoid;
        }

        .report-header h1 {
            color: #112e51;
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 10px;
        }

        .report-header .subtitle {
            color: #5b616b;
            font-size: 14pt;
            margin-bottom: 5px;
        }

        .report-header .facility-info {
            color: #5b616b;
            font-size: 11pt;
            margin-top: 10px;
        }

        .report-header .generated-date {
            color: #5b616b;
            font-size: 10pt;
            font-style: italic;
        }

        /* Section Styling */
        .report-section {
            margin-bottom: 25px;
            page-break-inside: auto;
        }

        .report-section h2 {
            color: #112e51;
            font-size: 16pt;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #0071bc;
            page-break-after: avoid;
        }

        .report-section h3 {
            color: #112e51;
            font-size: 13pt;
            font-weight: 600;
            margin: 15px 0 10px 0;
            page-break-after: avoid;
        }

        .report-section h4 {
            color: #112e51;
            font-size: 11pt;
            font-weight: 600;
            margin: 10px 0 8px 0;
            page-break-after: avoid;
        }

        .report-section p {
            margin-bottom: 8px;
            line-height: 1.5;
        }

        /* Executive Summary Special Styling */
        .executive-summary {
            background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%);
            border: 3px solid #28a745;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            page-break-inside: avoid;
        }

        .executive-summary h2 {
            color: #28a745;
            border-bottom: 2px solid #28a745;
        }

        .overall-score {
            font-size: 36pt;
            font-weight: 800;
            color: #28a745;
            text-align: center;
            margin: 15px 0;
        }

        /* Key Findings Grid */
        .key-findings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .key-finding-card {
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid;
            background: #f8f9fa;
        }

        .key-finding-card.enhancement {
            border-left-color: #ffc107;
            background: #fff8e1;
        }

        .key-finding-card.standards {
            border-left-color: #0071bc;
            background: #e1f3fd;
        }

        .key-finding-card.total {
            border-left-color: #28a745;
            background: #e8f5e8;
        }

        /* Progress Bars */
        .progress-bar-container {
            background: #e5e7eb;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            margin: 8px 0;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 6px;
            transition: width 0.3s ease;
        }

        .progress-bar-fill.success {
            background: #28a745;
        }

        .progress-bar-fill.warning {
            background: #ffc107;
        }

        .progress-bar-fill.danger {
            background: #dc3545;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10pt;
        }

        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #112e51;
        }

        tbody tr:hover {
            background: #f8f9fa;
        }

        /* Lists */
        ul, ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }

        li {
            margin-bottom: 5px;
            line-height: 1.4;
        }

        /* Vulnerability and Enhancement Items */
        .vofc-item, .enhancement-item, .commendable-item {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }

        .vofc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .vofc-type {
            background: #dc3545;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 600;
        }

        .vofc-question {
            color: #112e51;
            font-weight: 600;
            font-size: 11pt;
        }

        .vofc-ofc {
            background: #e1f3fd;
            border-left: 3px solid #0071bc;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
            color: #112e51;
            font-size: 10pt;
        }

        /* Utility Classes */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 600; }
        .text-sm { font-size: 10pt; }
        .text-lg { font-size: 14pt; }
        .mb-0 { margin-bottom: 0; }
        .mb-1 { margin-bottom: 8px; }
        .mb-2 { margin-bottom: 15px; }
        .mb-3 { margin-bottom: 20px; }

        /* Page Break Helpers */
        .page-break {
            page-break-before: always;
            break-before: page;
        }

        .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <h1>SAFE Security Assessment Report</h1>
        <div class="subtitle">Comprehensive Security Assessment and Recommendations</div>
        ${facilityInfo.facilityName ? `<div class="facility-info">${facilityInfo.facilityName}</div>` : ''}
        ${facilityInfo.facilityAddress ? `<div class="facility-info">${facilityInfo.facilityAddress}</div>` : ''}
        <div class="generated-date">Generated on: ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</div>
    </div>

    <div class="report-content">
        ${this.insertPageBreaks(reportContent.innerHTML, pageBreaks)}
    </div>
</body>
</html>`;
    }

    /**
     * Insert page breaks based on content analysis
     */
    insertPageBreaks(htmlContent, pageBreaks) {
        let content = htmlContent;
        
        // Add page breaks before major sections
        pageBreaks.forEach((pageBreak, index) => {
            if (index > 0) { // Don't add break before first section
                const sectionIndex = pageBreak.beforeSection;
                const sectionSelectors = [
                    '.executive-summary',
                    '.key-findings', 
                    '.security-posture',
                    '.recommendations',
                    '.findings-detail',
                    '.assessment-results',
                    '.implementation-guide'
                ];
                
                sectionSelectors.forEach(selector => {
                    const regex = new RegExp(`(<div[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>)`, 'g');
                    content = content.replace(regex, `<div class="page-break"></div>$1`);
                });
            }
        });

        return content;
    }

    /**
     * Export to PDF using browser print
     */
    exportToPDF(reportContentParam, facilityInfo = {}) {
        // Create a production-ready print window with proper A4 layout
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        
        // Get the final report content (not the entire section)
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            console.error('Report content not found');
            return;
        }
        
        // Get all CSS from the main document
        const allStyles = Array.from(document.querySelectorAll('style')).map(style => style.innerHTML).join('\n');
        
        // Get the production print CSS content
        const productionPrintCSS = `/* SAFE A4 Production Print Styles - Embedded */
@page {
    size: A4;
    margin: 20mm;
    @top-center { content: "SAFE Security Assessment Report"; font-family: 'Segoe UI', sans-serif; font-size: 10pt; color: #112e51; font-weight: 500; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: 'Segoe UI', sans-serif; font-size: 9pt; color: #5b616b; }
    @top-left { content: "CISA"; font-family: 'Segoe UI', sans-serif; font-size: 9pt; color: #5b616b; font-weight: 600; }
    @bottom-left { content: "Confidential - For Official Use Only"; font-family: 'Segoe UI', sans-serif; font-size: 8pt; color: #5b616b; }
}

@media print {
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #1b1b1b; background: white; width: 170mm; margin: 0 auto; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    .nav-tabs, .top-action-bar, .back-to-top, .banner-container, .report-action-bar { display: none !important; }
    .btn:not(.print-preserve), button:not(.print-preserve):not(.print-only) { display: none !important; }
    .page-break { page-break-before: always !important; break-before: page !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
    .force-break { page-break-before: always !important; break-before: page !important; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid !important; break-after: avoid !important; page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3; widows: 3; }
    table { page-break-inside: auto !important; break-inside: auto !important; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    ul, ol { page-break-inside: auto !important; break-inside: auto !important; }
    li { page-break-inside: avoid !important; break-inside: avoid !important; }
    .section, .report-section { page-break-inside: auto !important; break-inside: auto !important; border: inherit !important; box-shadow: inherit !important; margin-bottom: inherit !important; padding: inherit !important; background: inherit !important; }
    .category-performance, .key-findings-grid, .posture-overview, .discipline-progress { border: inherit !important; box-shadow: inherit !important; background: inherit !important; padding: inherit !important; margin: inherit !important; }
    .key-finding-card, .posture-card, .discipline-card { border: inherit !important; box-shadow: inherit !important; background: inherit !important; padding: inherit !important; margin: inherit !important; border-radius: inherit !important; }
    .alert, .alert-info, .alert-warning, .alert-success, .alert-danger { display: block !important; background: inherit !important; border: inherit !important; padding: inherit !important; margin: inherit !important; border-radius: inherit !important; }
    .key-findings-grid, .posture-overview, .category-performance, .discipline-progress { display: inherit !important; grid-template-columns: inherit !important; gap: inherit !important; align-items: inherit !important; justify-content: inherit !important; }
    .flex-container, .flex-row, .flex-column { display: inherit !important; flex-direction: inherit !important; align-items: inherit !important; justify-content: inherit !important; gap: inherit !important; }
    .text-center, .text-left, .text-right { text-align: inherit !important; }
    .progress-bar-container, .progress-bar-fill, .posture-chart, .key-finding-card { display: inherit !important; background: inherit !important; border: inherit !important; }
    .report-header { text-align: center; margin-bottom: 25mm; padding-bottom: 15mm; border-bottom: 3px solid #112e51; page-break-after: avoid; }
    .report-header h1 { color: #112e51; font-size: 24pt; font-weight: 700; margin-bottom: 8mm; letter-spacing: -0.5px; }
    .report-header .subtitle { color: #5b616b; font-size: 14pt; margin-bottom: 4mm; font-weight: 500; }
    .report-header .facility-info { color: #5b616b; font-size: 11pt; margin: 2mm 0; }
    .report-header .generated-date { color: #5b616b; font-size: 10pt; font-style: italic; margin-top: 4mm; }
    .executive-summary { background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%); border: 3px solid #28a745; border-radius: 8px; padding: 15mm; margin-bottom: 20mm; page-break-inside: avoid; }
    .executive-summary h2 { color: #28a745; border-bottom: 2px solid #28a745; font-size: 18pt; margin-bottom: 10mm; }
    .overall-score { font-size: 36pt; font-weight: 800; color: #28a745; text-align: center; margin: 8mm 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); }
    .score-description { font-size: 14pt; font-weight: 500; color: #1b1b1b; text-align: center; margin-top: 4mm; }
    .report-section { margin-bottom: 20mm; page-break-inside: auto; }
    .report-section h2 { color: #112e51; font-size: 16pt; font-weight: 600; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 2px solid #0071bc; page-break-after: avoid; }
    .report-section h3 { color: #112e51; font-size: 13pt; font-weight: 600; margin: 8mm 0 4mm 0; page-break-after: avoid; }
    .report-section h4 { color: #112e51; font-size: 11pt; font-weight: 600; margin: 6mm 0 3mm 0; page-break-after: avoid; }
    .report-section p { margin-bottom: 4mm; line-height: 1.5; text-align: justify; }
    .key-findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(60mm, 1fr)); gap: 8mm; margin-bottom: 15mm; }
    .key-finding-card { padding: 8mm; border-radius: 6px; border-left: 4px solid; background: #f8f9fa; page-break-inside: avoid; }
    .key-finding-card.enhancement { border-left-color: #ffc107; background: #fff8e1; }
    .key-finding-card.standards { border-left-color: #0071bc; background: #e1f3fd; }
    .key-finding-card.total { border-left-color: #28a745; background: #e8f5e8; }
    .key-finding-card h4 { color: inherit; margin: 0 0 4mm 0; font-size: 12pt; font-weight: 600; }
    .key-finding-card .number { font-size: 24pt; font-weight: 700; color: inherit; margin: 2mm 0; }
    .progress-bar-container { background: #e5e7eb; height: 12px; border-radius: 6px; overflow: hidden; margin: 4mm 0; }
    .progress-bar-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
    .progress-bar-fill.success { background: #28a745; }
    .progress-bar-fill.warning { background: #ffc107; }
    .progress-bar-fill.danger { background: #dc3545; }
    .discipline-progress { margin-bottom: 8mm; padding: 6mm; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb; page-break-inside: avoid; }
    .discipline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
    .discipline-title { color: #112e51; font-weight: 600; font-size: 11pt; }
    .discipline-percentage { font-size: 10pt; color: #5b616b; font-weight: 600; }
    .discipline-progress-bar { background: #e5e7eb; height: 16px; border-radius: 8px; overflow: hidden; margin-bottom: 4mm; }
    .discipline-progress-fill { height: 100%; border-radius: 8px; transition: width 0.5s ease; }
    table { width: 100%; border-collapse: collapse; margin: 8mm 0; font-size: 10pt; page-break-inside: auto; }
    th, td { padding: 6mm 4mm; text-align: left; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { background: #f8f9fa; font-weight: 600; color: #112e51; font-size: 10pt; }
    tbody tr:hover { background: #f8f9fa; }
    ul, ol { margin-left: 8mm; margin-bottom: 6mm; }
    li { margin-bottom: 2mm; line-height: 1.4; }
    .vofc-item, .enhancement-item, .commendable-item { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8mm; margin-bottom: 6mm; page-break-inside: avoid; }
    .vofc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
    .vofc-type { background: #dc3545; color: white; padding: 2mm 4mm; border-radius: 4px; font-size: 9pt; font-weight: 600; }
    .vofc-question { color: #112e51; font-weight: 600; font-size: 11pt; }
    .vofc-content, .enhancement-content, .commendable-action { color: #1b1b1b; margin-bottom: 4mm; line-height: 1.5; }
    .vofc-ofc { background: #e1f3fd; border-left: 3px solid #0071bc; padding: 4mm; margin-top: 4mm; border-radius: 4px; color: #112e51; font-size: 10pt; }
    .enhancement-question { color: #112e51; font-weight: 600; margin-bottom: 4mm; font-size: 11pt; }
    .commendable-impact { background: #e8f5e8; border-left: 3px solid #28a745; padding: 4mm; border-radius: 4px; color: #1b5e20; font-size: 10pt; margin-top: 4mm; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-justify { text-align: justify; }
    .font-bold { font-weight: 600; }
    .font-semibold { font-weight: 500; }
    .text-sm { font-size: 10pt; }
    .text-lg { font-size: 14pt; }
    .text-xl { font-size: 16pt; }
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 2mm; }
    .mb-2 { margin-bottom: 4mm; }
    .mb-3 { margin-bottom: 8mm; }
    .mb-4 { margin-bottom: 12mm; }
    .mb-5 { margin-bottom: 16mm; }
    .text-primary { color: #112e51; }
    .text-secondary { color: #5b616b; }
    .text-success { color: #28a745; }
    .text-warning { color: #ffc107; }
    .text-danger { color: #dc3545; }
    .text-info { color: #17a2b8; }
    .bg-primary { background-color: #112e51; }
    .bg-secondary { background-color: #5b616b; }
    .bg-success { background-color: #28a745; }
    .bg-warning { background-color: #ffc107; }
    .bg-danger { background-color: #dc3545; }
    .bg-info { background-color: #17a2b8; }
    .bg-light { background-color: #f8f9fa; }
    .print-only { display: block !important; }
}`;
        
        // Create production-ready HTML with proper A4 layout matching preview
        const printHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAFE Final Report - ${facilityInfo.facilityName || 'Security Assessment'}</title>
    <style>
        /* Include all main application CSS */
        ${allStyles}
        
        /* Include production print CSS */
        ${productionPrintCSS}
        
        /* A4 Preview styling for consistency */
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
        
        /* Ensure graphics don't get cut off */
        img, svg, canvas, figure, .chart, .graphic, .image {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            margin: 0 auto !important;
        }
        
        /* Fix grid layouts for print */
        .key-findings-grid,
        .posture-overview,
        .category-performance {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            gap: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
        }
        
        /* Ensure cards don't overflow */
        .key-finding-card,
        .posture-card,
        .discipline-card {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            word-wrap: break-word !important;
        }
        
        /* Fix any overflow issues */
        * {
            overflow: visible !important;
            max-width: 100% !important;
        }
    </style>
</head>
<body>
    <div class="report-header" style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #112e51;">
        <h1 style="color: #112e51; font-size: 24pt; font-weight: 700; margin-bottom: 10px;">SAFE Security Assessment Report</h1>
        <div style="color: #5b616b; font-size: 14pt; margin-bottom: 5px;">Comprehensive Security Assessment and Recommendations</div>
        <div style="color: #5b616b; font-size: 11pt; margin-top: 10px;">${facilityInfo.facilityName || 'Security Assessment'}</div>
        <div style="color: #5b616b; font-size: 10pt; font-style: italic;">Generated on: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="report-content">
        ${reportContent.innerHTML}
    </div>
</body>
</html>`;
        
        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 1000);
        };
    }

    /**
     * Export to HTML file - Use actual report content with full styling
     */
    exportToHTML(reportContentParam, facilityInfo = {}) {
        // Create production-ready HTML with proper A4 layout
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            console.error('Report content not found');
            return;
        }
        
        // Get all CSS from the main document
        const allStyles = Array.from(document.querySelectorAll('style')).map(style => style.innerHTML).join('\n');
        
        // Get the production print CSS content (same as PDF export)
        const productionPrintCSS = `/* SAFE A4 Production Print Styles - Embedded */
@page {
    size: A4;
    margin: 20mm;
    @top-center { content: "SAFE Security Assessment Report"; font-family: 'Segoe UI', sans-serif; font-size: 10pt; color: #112e51; font-weight: 500; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: 'Segoe UI', sans-serif; font-size: 9pt; color: #5b616b; }
    @top-left { content: "CISA"; font-family: 'Segoe UI', sans-serif; font-size: 9pt; color: #5b616b; font-weight: 600; }
    @bottom-left { content: "Confidential - For Official Use Only"; font-family: 'Segoe UI', sans-serif; font-size: 8pt; color: #5b616b; }
}

@media print {
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #1b1b1b; background: white; width: 170mm; margin: 0 auto; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    .nav-tabs, .top-action-bar, .back-to-top, .banner-container, .report-action-bar { display: none !important; }
    .btn:not(.print-preserve), button:not(.print-preserve):not(.print-only) { display: none !important; }
    .page-break { page-break-before: always !important; break-before: page !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
    .force-break { page-break-before: always !important; break-before: page !important; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid !important; break-after: avoid !important; page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3; widows: 3; }
    table { page-break-inside: auto !important; break-inside: auto !important; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    ul, ol { page-break-inside: auto !important; break-inside: auto !important; }
    li { page-break-inside: avoid !important; break-inside: avoid !important; }
    .section, .report-section { page-break-inside: auto !important; break-inside: auto !important; border: inherit !important; box-shadow: inherit !important; margin-bottom: inherit !important; padding: inherit !important; background: inherit !important; }
    .category-performance, .key-findings-grid, .posture-overview, .discipline-progress { border: inherit !important; box-shadow: inherit !important; background: inherit !important; padding: inherit !important; margin: inherit !important; }
    .key-finding-card, .posture-card, .discipline-card { border: inherit !important; box-shadow: inherit !important; background: inherit !important; padding: inherit !important; margin: inherit !important; border-radius: inherit !important; }
    .alert, .alert-info, .alert-warning, .alert-success, .alert-danger { display: block !important; background: inherit !important; border: inherit !important; padding: inherit !important; margin: inherit !important; border-radius: inherit !important; }
    .key-findings-grid, .posture-overview, .category-performance, .discipline-progress { display: inherit !important; grid-template-columns: inherit !important; gap: inherit !important; align-items: inherit !important; justify-content: inherit !important; }
    .flex-container, .flex-row, .flex-column { display: inherit !important; flex-direction: inherit !important; align-items: inherit !important; justify-content: inherit !important; gap: inherit !important; }
    .text-center, .text-left, .text-right { text-align: inherit !important; }
    .progress-bar-container, .progress-bar-fill, .posture-chart, .key-finding-card { display: inherit !important; background: inherit !important; border: inherit !important; }
    .report-header { text-align: center; margin-bottom: 25mm; padding-bottom: 15mm; border-bottom: 3px solid #112e51; page-break-after: avoid; }
    .report-header h1 { color: #112e51; font-size: 24pt; font-weight: 700; margin-bottom: 8mm; letter-spacing: -0.5px; }
    .report-header .subtitle { color: #5b616b; font-size: 14pt; margin-bottom: 4mm; font-weight: 500; }
    .report-header .facility-info { color: #5b616b; font-size: 11pt; margin: 2mm 0; }
    .report-header .generated-date { color: #5b616b; font-size: 10pt; font-style: italic; margin-top: 4mm; }
    .executive-summary { background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%); border: 3px solid #28a745; border-radius: 8px; padding: 15mm; margin-bottom: 20mm; page-break-inside: avoid; }
    .executive-summary h2 { color: #28a745; border-bottom: 2px solid #28a745; font-size: 18pt; margin-bottom: 10mm; }
    .overall-score { font-size: 36pt; font-weight: 800; color: #28a745; text-align: center; margin: 8mm 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); }
    .score-description { font-size: 14pt; font-weight: 500; color: #1b1b1b; text-align: center; margin-top: 4mm; }
    .report-section { margin-bottom: 20mm; page-break-inside: auto; }
    .report-section h2 { color: #112e51; font-size: 16pt; font-weight: 600; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 2px solid #0071bc; page-break-after: avoid; }
    .report-section h3 { color: #112e51; font-size: 13pt; font-weight: 600; margin: 8mm 0 4mm 0; page-break-after: avoid; }
    .report-section h4 { color: #112e51; font-size: 11pt; font-weight: 600; margin: 6mm 0 3mm 0; page-break-after: avoid; }
    .report-section p { margin-bottom: 4mm; line-height: 1.5; text-align: justify; }
    .key-findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(60mm, 1fr)); gap: 8mm; margin-bottom: 15mm; }
    .key-finding-card { padding: 8mm; border-radius: 6px; border-left: 4px solid; background: #f8f9fa; page-break-inside: avoid; }
    .key-finding-card.enhancement { border-left-color: #ffc107; background: #fff8e1; }
    .key-finding-card.standards { border-left-color: #0071bc; background: #e1f3fd; }
    .key-finding-card.total { border-left-color: #28a745; background: #e8f5e8; }
    .key-finding-card h4 { color: inherit; margin: 0 0 4mm 0; font-size: 12pt; font-weight: 600; }
    .key-finding-card .number { font-size: 24pt; font-weight: 700; color: inherit; margin: 2mm 0; }
    .progress-bar-container { background: #e5e7eb; height: 12px; border-radius: 6px; overflow: hidden; margin: 4mm 0; }
    .progress-bar-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
    .progress-bar-fill.success { background: #28a745; }
    .progress-bar-fill.warning { background: #ffc107; }
    .progress-bar-fill.danger { background: #dc3545; }
    .discipline-progress { margin-bottom: 8mm; padding: 6mm; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb; page-break-inside: avoid; }
    .discipline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
    .discipline-title { color: #112e51; font-weight: 600; font-size: 11pt; }
    .discipline-percentage { font-size: 10pt; color: #5b616b; font-weight: 600; }
    .discipline-progress-bar { background: #e5e7eb; height: 16px; border-radius: 8px; overflow: hidden; margin-bottom: 4mm; }
    .discipline-progress-fill { height: 100%; border-radius: 8px; transition: width 0.5s ease; }
    table { width: 100%; border-collapse: collapse; margin: 8mm 0; font-size: 10pt; page-break-inside: auto; }
    th, td { padding: 6mm 4mm; text-align: left; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { background: #f8f9fa; font-weight: 600; color: #112e51; font-size: 10pt; }
    tbody tr:hover { background: #f8f9fa; }
    ul, ol { margin-left: 8mm; margin-bottom: 6mm; }
    li { margin-bottom: 2mm; line-height: 1.4; }
    .vofc-item, .enhancement-item, .commendable-item { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8mm; margin-bottom: 6mm; page-break-inside: avoid; }
    .vofc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
    .vofc-type { background: #dc3545; color: white; padding: 2mm 4mm; border-radius: 4px; font-size: 9pt; font-weight: 600; }
    .vofc-question { color: #112e51; font-weight: 600; font-size: 11pt; }
    .vofc-content, .enhancement-content, .commendable-action { color: #1b1b1b; margin-bottom: 4mm; line-height: 1.5; }
    .vofc-ofc { background: #e1f3fd; border-left: 3px solid #0071bc; padding: 4mm; margin-top: 4mm; border-radius: 4px; color: #112e51; font-size: 10pt; }
    .enhancement-question { color: #112e51; font-weight: 600; margin-bottom: 4mm; font-size: 11pt; }
    .commendable-impact { background: #e8f5e8; border-left: 3px solid #28a745; padding: 4mm; border-radius: 4px; color: #1b5e20; font-size: 10pt; margin-top: 4mm; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-justify { text-align: justify; }
    .font-bold { font-weight: 600; }
    .font-semibold { font-weight: 500; }
    .text-sm { font-size: 10pt; }
    .text-lg { font-size: 14pt; }
    .text-xl { font-size: 16pt; }
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 2mm; }
    .mb-2 { margin-bottom: 4mm; }
    .mb-3 { margin-bottom: 8mm; }
    .mb-4 { margin-bottom: 12mm; }
    .mb-5 { margin-bottom: 16mm; }
    .text-primary { color: #112e51; }
    .text-secondary { color: #5b616b; }
    .text-success { color: #28a745; }
    .text-warning { color: #ffc107; }
    .text-danger { color: #dc3545; }
    .text-info { color: #17a2b8; }
    .bg-primary { background-color: #112e51; }
    .bg-secondary { background-color: #5b616b; }
    .bg-success { background-color: #28a745; }
    .bg-warning { background-color: #ffc107; }
    .bg-danger { background-color: #dc3545; }
    .bg-info { background-color: #17a2b8; }
    .bg-light { background-color: #f8f9fa; }
    .print-only { display: block !important; }
}`;
        
        // Create production-ready HTML with A4 preview consistency
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAFE Final Report - ${facilityInfo.facilityName || 'Security Assessment'}</title>
    <style>
        /* Include all main application CSS */
        ${allStyles}
        
        /* Include production print CSS */
        ${productionPrintCSS}
        
        /* A4 Preview styling for consistency */
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
        
        /* Ensure graphics don't get cut off */
        img, svg, canvas, figure, .chart, .graphic, .image {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            margin: 0 auto !important;
        }
        
        /* Fix grid layouts for print */
        .key-findings-grid,
        .posture-overview,
        .category-performance {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            gap: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
        }
        
        /* Ensure cards don't overflow */
        .key-finding-card,
        .posture-card,
        .discipline-card {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            word-wrap: break-word !important;
        }
        
        /* Fix any overflow issues */
        * {
            overflow: visible !important;
            max-width: 100% !important;
        }
    </style>
</head>
<body>
    <div class="report-header" style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #112e51;">
        <h1 style="color: #112e51; font-size: 24pt; font-weight: 700; margin-bottom: 10px;">SAFE Security Assessment Report</h1>
        <div style="color: #5b616b; font-size: 14pt; margin-bottom: 5px;">Comprehensive Security Assessment and Recommendations</div>
        <div style="color: #5b616b; font-size: 11pt; margin-top: 10px;">${facilityInfo.facilityName || 'Security Assessment'}</div>
        <div style="color: #5b616b; font-size: 10pt; font-style: italic;">Generated on: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="report-content">
        ${reportContent.innerHTML}
    </div>
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

}

// Global instance
window.SAFEProductionPrint = new SAFEProductionPrintSystem();

// Convenience functions
window.exportProductionPDF = function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showWarningBanner('Please generate a Final Report first before exporting.', 'warning');
        return;
    }
    
    const facilityInfo = {
        facilityName: document.getElementById('facilityName')?.value || '',
        facilityAddress: document.getElementById('facilityAddress')?.value || ''
    };
    
    window.SAFEProductionPrint.exportToPDF(reportContent, facilityInfo);
};

window.exportProductionHTML = function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showWarningBanner('Please generate a Final Report first before exporting.', 'warning');
        return;
    }
    
    const facilityInfo = {
        facilityName: document.getElementById('facilityName')?.value || '',
        facilityAddress: document.getElementById('facilityAddress')?.value || ''
    };
    
    window.SAFEProductionPrint.exportToHTML(reportContent, facilityInfo);
};


