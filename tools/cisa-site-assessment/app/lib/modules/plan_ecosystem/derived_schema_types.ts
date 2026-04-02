/**
 * Strict schema contract for derived plan schema (sections + critical elements).
 */

export type DerivedPlanSchema = {
  sections: Array<{
    section_title: string;
    section_key: string;
    elements: Array<{
      element_title: string;
      element_key: string;
      observation: string;
      ofc: string;
      impact: string;
      evidence_terms?: string[];
      /** TOC-derived sub-entries and __core fallback are vital (documentation-critical). */
      is_vital?: boolean;
    }>;
  }>;
};
