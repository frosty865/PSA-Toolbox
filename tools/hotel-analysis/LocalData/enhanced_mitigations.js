// Legacy hook — speculative “innovative / emerging / alternative” mitigation lists were removed.
// HOST reports use OFC option text from the VOFC scripts loaded in LocalData and matcher output.

class EnhancedMitigationDatabase {
    constructor() {}

    /**
     * @returns {{ summary: string, totalVulnerabilities: number, mitigationCategories: object, recommendations: [] }}
     */
    generateEnhancedMitigationReport(vulnerabilities) {
        const n = Array.isArray(vulnerabilities) ? vulnerabilities.length : 0;
        return {
            summary:
                'No separate speculative mitigation catalog is included. Options for consideration are drawn from the VOFC data and the findings sections above.',
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
