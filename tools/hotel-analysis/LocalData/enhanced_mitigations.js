// Legacy hook — speculative “innovative / emerging / alternative” mitigation lists were removed.
// HOST reports use OFC option text from the embedded VOFC catalog (see EMBEDDED_VOFC_DATA) and
// matcher output — not generated marketing-style mitigations.

class EnhancedMitigationDatabase {
    constructor() {}

    /**
     * @returns {{ summary: string, totalVulnerabilities: number, mitigationCategories: object, recommendations: [] }}
     */
    generateEnhancedMitigationReport(vulnerabilities) {
        const n = Array.isArray(vulnerabilities) ? vulnerabilities.length : 0;
        return {
            summary:
                'No separate speculative mitigation catalog is included. Options for consideration are drawn from the OFC-linked text in HOST (embedded VOFC data) and the findings sections above.',
            totalVulnerabilities: n,
            mitigationCategories: {},
            recommendations: []
        };
    }
}

// Host code historically called the wrong casing; support both.
EnhancedMitigationDatabase.prototype.generateenhancedMitigationReport =
    EnhancedMitigationDatabase.prototype.generateEnhancedMitigationReport;

window.EnhancedMitigationDatabase = EnhancedMitigationDatabase;
