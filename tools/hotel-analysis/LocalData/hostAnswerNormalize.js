/**
 * Shared answer normalization for HOST form values (Yes/yes, No/n/a, etc.).
 * Loaded before other LocalData modules that compare assessment answers.
 */
(function (g) {
    'use strict';

    function normalizeAnswer(value) {
        return String(value ?? '').trim().toLowerCase();
    }

    function isAffirmativeYes(value) {
        return normalizeAnswer(value) === 'yes';
    }

    function isNegativeResponse(value) {
        const n = normalizeAnswer(value);
        return n === 'no' || n === 'false' || n === '0' || n === 'none' || n === 'n/a' || n === 'na';
    }

    g.HostAnswerNormalize = {
        normalizeAnswer: normalizeAnswer,
        isAffirmativeYes: isAffirmativeYes,
        isNegativeResponse: isNegativeResponse
    };
})(typeof window !== 'undefined' ? window : globalThis);
