/**
 * Build the Asset Dependency Assessment Report template DOCX from scratch.
 * Snapshot Model v3 – latest design. All REQUIRED_TEMPLATE_ANCHORS in order
 * with section headings. Output: assets/templates/Asset Dependency Assessment Report_BLANK.docx
 *
 * Run from repo root: pnpm template:build
 */
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';
import { REQUIRED_TEMPLATE_ANCHORS } from '../packages/schema/src/template_anchors';

const TEMPLATE_FILENAME = 'Asset Dependency Assessment Report_BLANK.docx';
const OUTPUT_RELATIVE = path.join('assets', 'templates', TEMPLATE_FILENAME);

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** One paragraph containing only the anchor text (own line). */
function paragraphWithAnchor(anchor: string): string {
  const safe = escapeXml(anchor);
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
}

/** Heading paragraph (e.g. "1. Executive Risk Posture Snapshot"). */
function headingParagraph(text: string, style = 'Heading1'): string {
  const safe = escapeXml(text);
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
}

/** Section headings for anchor groups (Part I / Part II). */
const ANCHOR_HEADINGS: Record<string, string> = {
  '[[SNAPSHOT_POSTURE]]': '1. Executive Risk Posture Snapshot',
  '[[CHART_ELECTRIC_POWER]]': '2. Impact Curves',
  '[[INFRA_ENERGY]]': '3. Infrastructure Sections',
  '[[SYNTHESIS]]': '4. Cross-Infrastructure Synthesis',
  '[[PRIORITY_ACTIONS]]': '5. Priority Actions',
  '[[DEP_SUMMARY_TABLE]]': 'Part II – Technical Annex',
};

/** Sub-headings for infrastructure anchors (Heading2). */
const INFRA_SUBHEADINGS: Record<string, string> = {
  '[[INFRA_ENERGY]]': '3.1 Electric Power',
  '[[INFRA_COMMS]]': '3.2 Communications',
  '[[INFRA_IT]]': '3.3 Information Technology',
  '[[INFRA_WATER]]': '3.4 Water',
  '[[INFRA_WASTEWATER]]': '3.5 Wastewater',
};

function buildDocumentXml(): string {
  const parts: string[] = [];

  parts.push(headingParagraph('Asset Dependency Assessment Report', 'Title'));
  parts.push('<w:p/>');

  let lastHeading = '';
  for (const anchor of REQUIRED_TEMPLATE_ANCHORS) {
    const heading = ANCHOR_HEADINGS[anchor];
    if (heading && heading !== lastHeading) {
      parts.push(headingParagraph(heading, 'Heading1'));
      if (lastHeading) parts.push('<w:p/>');
      lastHeading = heading;
    }
    const sub = INFRA_SUBHEADINGS[anchor];
    if (sub) parts.push(headingParagraph(sub, 'Heading2'));
    parts.push(paragraphWithAnchor(anchor));
  }

  parts.push(
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:docGrid w:linePitch="360"/></w:sectPr>'
  );

  const body = parts.join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS_W}">
  <w:body>
${body}
  </w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS_ROOT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS_W}">
  <w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

async function main(): Promise<number> {
  const repoRoot = process.cwd();
  const outPath = path.join(repoRoot, OUTPUT_RELATIVE);
  const outDir = path.dirname(outPath);

  await fs.mkdir(outDir, { recursive: true });

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS_ROOT);
  zip.file('word/_rels/document.xml.rels', WORD_RELS);
  zip.file('word/document.xml', buildDocumentXml());
  zip.file('word/styles.xml', STYLES_XML);

  const blob = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outPath, blob);

  console.log(`Wrote: ${outPath}`);
  console.log(`Anchors: ${REQUIRED_TEMPLATE_ANCHORS.length} (Snapshot Model v3)`);
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e);
  process.exit(1);
});
