/**
 * APA 7 reference list strings for VOFC catalog IDs (V001–V050).
 * Sources are limited to publicly retrievable pages or documents (government, NIST, etc.).
 * HOST uses these instead of informal “standards_reference” labels in the embedded catalog.
 */
(function () {
    'use strict';

    window.VOFC_APA_BASE = {
        cisa_physical:
            'Cybersecurity and Infrastructure Security Agency. (n.d.). Physical security. Cybersecurity and Infrastructure Security Agency. Retrieved April 2, 2026, from https://www.cisa.gov/topics/physical-security',
        cisa_training:
            'Cybersecurity and Infrastructure Security Agency. (n.d.). Training. Cybersecurity and Infrastructure Security Agency. Retrieved April 2, 2026, from https://www.cisa.gov/resources-tools/training',
        cisa_resources:
            'Cybersecurity and Infrastructure Security Agency. (n.d.). Resources. Cybersecurity and Infrastructure Security Agency. Retrieved April 2, 2026, from https://www.cisa.gov/resources-tools/resources',
        dhs_home:
            'U.S. Department of Homeland Security. (n.d.). Homeland security. U.S. Department of Homeland Security. Retrieved April 2, 2026, from https://www.dhs.gov/',
        dhs_see_something:
            'U.S. Department of Homeland Security. (n.d.). If you see something, say something®. U.S. Department of Homeland Security. Retrieved April 2, 2026, from https://www.dhs.gov/see-something-say-something',
        nist_csf:
            'National Institute of Standards and Technology. (2024). The NIST cybersecurity framework (CSF) 2.0 (NIST CSWP 29). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.CSWP.29',
        nist_csrc:
            'National Institute of Standards and Technology. (n.d.). Computer security resource center. NIST. Retrieved April 2, 2026, from https://csrc.nist.gov/',
        nist_privacy:
            'National Institute of Standards and Technology. (n.d.). Privacy framework. NIST. Retrieved April 2, 2026, from https://www.nist.gov/privacy-framework',
        ready_business:
            'Ready.gov. (n.d.). Ready business. Ready.gov. Retrieved April 2, 2026, from https://www.ready.gov/business',
        fema_home:
            'Federal Emergency Management Agency. (n.d.). Federal Emergency Management Agency. FEMA. Retrieved April 2, 2026, from https://www.fema.gov/',
        nfpa_codes:
            'National Fire Protection Association. (n.d.). Codes & standards. NFPA. Retrieved April 2, 2026, from https://www.nfpa.org/codes-and-standards',
        hhs_hipaa_security:
            'U.S. Department of Health and Human Services. (n.d.). Security rule guidance material. U.S. Department of Health & Human Services. Retrieved April 2, 2026, from https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html',
        pci_ssc:
            'PCI Security Standards Council. (n.d.). PCI Security Standards Council. PCI SSC. Retrieved April 2, 2026, from https://www.pcisecuritystandards.org/',
        gdpr:
            'European Parliament & Council of the European Union. (2016). Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data (General Data Protection Regulation). Official Journal of the European Union. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679',
        ccpa:
            'California Department of Justice, Office of the Attorney General. (n.d.). California Consumer Privacy Act (CCPA). State of California Department of Justice. Retrieved April 2, 2026, from https://oag.ca.gov/privacy/ccpa'
    };

    var DEF = ['cisa_physical', 'ready_business', 'dhs_home'];

    window.VOFC_VULNERABILITY_APA_KEYS = {
        DEFAULT: DEF,
        V001: ['cisa_physical', 'dhs_home', 'ready_business'],
        V002: ['cisa_physical', 'nist_csf', 'nist_csrc'],
        V003: ['cisa_physical', 'cisa_training', 'ready_business'],
        V004: ['ready_business', 'fema_home', 'dhs_home'],
        V005: ['cisa_physical', 'nist_csf', 'cisa_resources'],
        V006: ['cisa_physical', 'cisa_resources'],
        V007: ['cisa_physical', 'dhs_see_something', 'cisa_resources'],
        V008: ['cisa_physical', 'fema_home', 'dhs_home'],
        V009: ['cisa_physical', 'cisa_training', 'ready_business'],
        V010: ['ready_business', 'fema_home', 'dhs_home'],
        V011: ['nist_csf', 'nist_csrc', 'cisa_resources'],
        V012: ['nfpa_codes', 'ready_business', 'fema_home'],
        V013: ['cisa_physical', 'dhs_home', 'ready_business'],
        V014: ['cisa_physical', 'cisa_resources'],
        V015: ['cisa_physical', 'ready_business'],
        V016: ['cisa_resources', 'dhs_home', 'ready_business'],
        V017: ['cisa_physical', 'cisa_resources'],
        V018: ['cisa_physical', 'dhs_see_something', 'ready_business'],
        V019: ['cisa_resources', 'ready_business', 'fema_home'],
        V020: ['nist_csf', 'nist_csrc', 'cisa_resources'],
        V021: ['nist_privacy', 'nist_csf', 'pci_ssc', 'gdpr', 'ccpa'],
        V022: ['cisa_physical', 'cisa_resources', 'dhs_home', 'ready_business'],
        V023: ['cisa_physical', 'ready_business'],
        V024: ['cisa_physical', 'cisa_resources'],
        V025: ['cisa_physical', 'dhs_home', 'ready_business'],
        V026: ['cisa_physical', 'ready_business'],
        V027: ['cisa_physical', 'ready_business'],
        V028: ['cisa_physical', 'ready_business'],
        V029: ['nist_csf', 'cisa_physical', 'ready_business'],
        V030: ['cisa_physical', 'ready_business', 'dhs_home'],
        V031: ['ready_business', 'fema_home', 'dhs_home'],
        V032: ['cisa_physical', 'cisa_resources'],
        V033: ['cisa_physical', 'cisa_resources'],
        V034: ['cisa_physical', 'ready_business', 'fema_home'],
        V035: ['cisa_physical', 'dhs_home', 'ready_business'],
        V036: ['cisa_physical', 'dhs_home', 'cisa_resources'],
        V037: ['cisa_physical', 'dhs_see_something', 'ready_business'],
        V038: ['cisa_physical', 'ready_business', 'fema_home'],
        V039: ['ready_business', 'fema_home', 'cisa_resources'],
        V040: ['dhs_home', 'cisa_physical', 'ready_business'],
        V041: ['cisa_physical', 'dhs_home', 'ready_business'],
        V042: ['cisa_physical', 'ready_business'],
        V043: ['cisa_resources', 'dhs_home', 'ready_business'],
        V044: ['cisa_physical', 'cisa_resources'],
        V045: ['cisa_physical', 'dhs_see_something', 'ready_business'],
        V046: ['cisa_resources', 'ready_business', 'fema_home'],
        V047: ['nist_csf', 'nist_csrc', 'cisa_resources'],
        V048: ['nist_privacy', 'nist_csf', 'pci_ssc', 'gdpr', 'ccpa'],
        V049: ['cisa_physical', 'cisa_resources', 'dhs_home', 'ready_business'],
        V050: ['cisa_physical', 'cisa_resources', 'ready_business']
    };

    function normalizeCatalogId(vofcRaw) {
        if (vofcRaw === undefined || vofcRaw === null) return '';
        var s = String(vofcRaw).trim();
        if (!s) return '';
        var m = s.match(/\b(V\d{1,3})\b/i);
        if (!m) return '';
        var n = parseInt(m[1].substring(1), 10);
        if (isNaN(n)) return '';
        return 'V' + String(n).padStart(3, '0');
    }

    function dedupeStrings(arr) {
        var seen = Object.create(null);
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var t = arr[i];
            if (!t || seen[t]) continue;
            seen[t] = true;
            out.push(t);
        }
        return out;
    }

    /**
     * @param {string} vofcRaw — e.g. "V003", "V003, V004", or VIP-* (falls back to DEFAULT).
     * @returns {string[]} APA 7 reference list entries.
     */
    window.getApaReferencesForVulnerability = function (vofcRaw) {
        var base = window.VOFC_APA_BASE || {};
        var map = window.VOFC_VULNERABILITY_APA_KEYS || {};
        var vid = normalizeCatalogId(vofcRaw);
        if (!vid) {
            var keys = map.DEFAULT || DEF;
            return dedupeStrings(keys.map(function (k) {
                return base[k];
            }).filter(Boolean));
        }
        var keyList = map[vid] || map.DEFAULT || DEF;
        return dedupeStrings(
            keyList.map(function (k) {
                return base[k];
            }).filter(Boolean)
        );
    };
})();
