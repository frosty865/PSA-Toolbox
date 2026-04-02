const fs = require("fs");
const path = require("path");

const templatesDir = path.join(process.cwd(), "data", "module_templates");

function fail(msg) {
  console.error("[GUARD][MODULE_TEMPLATES]", msg);
  process.exit(1);
}

if (!fs.existsSync(templatesDir)) fail(`Missing templates dir: ${templatesDir}`);

const files = fs.readdirSync(templatesDir).filter(f => f.endsWith(".template.json"));
if (files.length === 0) fail("No module templates found.");

for (const f of files) {
  const p = path.join(templatesDir, f);
  const raw = fs.readFileSync(p, "utf-8");
  let j;
  try { j = JSON.parse(raw); } catch (e) { fail(`Invalid JSON: ${f}`); }
  if (!j.module_code) fail(`Missing module_code: ${f}`);
  if (!Array.isArray(j.question_families) || j.question_families.length < 1) fail(`No question_families: ${f}`);
  if (!Array.isArray(j.ofc_template_bank) || j.ofc_template_bank.length < 1) fail(`No ofc_template_bank: ${f}`);
  if (!j.generation_rules) fail(`Missing generation_rules: ${f}`);
}

console.log(`[OK][MODULE_TEMPLATES] ${files.length} templates validated.`);
