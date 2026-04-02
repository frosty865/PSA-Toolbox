import fs from "node:fs";
import path from "node:path";

export type ModuleTemplate = {
  module_code: string;
  title: string;
  summary: string;
  scope: {
    hazards: string[];
    areas: string[];
    exclusions: string[];
  };
  question_families: Array<{
    family_code: string;
    title: string;
    intent: string;
    question_prompts: string[];
    anchors?: { discipline_subtype_codes_allow?: string[] };
    evidence_signals?: string[];
  }>;
  ofc_template_bank: Array<{ ofc_code: string; text_template: string }>;
  generation_rules: {
    min_questions_per_family: number;
    min_ofc_candidates_per_family: number;
    require_citation_locator: boolean;
  };
};

const TEMPLATES_DIR = path.join(process.cwd(), "data", "module_templates");

export function loadModuleTemplate(moduleCode: string): ModuleTemplate {
  const p = path.join(TEMPLATES_DIR, `${moduleCode}.template.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Module template not found: ${p}`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const tpl = JSON.parse(raw) as ModuleTemplate;

  // Minimal validation (expand later)
  if (!tpl.module_code || tpl.module_code !== moduleCode) {
    throw new Error(`Invalid module_code in template: expected ${moduleCode}`);
  }
  if (!Array.isArray(tpl.question_families) || tpl.question_families.length === 0) {
    throw new Error("Template must include question_families");
  }
  if (!Array.isArray(tpl.ofc_template_bank) || tpl.ofc_template_bank.length === 0) {
    throw new Error("Template must include ofc_template_bank");
  }
  return tpl;
}
