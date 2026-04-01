/**
 * Add [[SNAPSHOT_CASCADE]] anchor to a DOCX template, immediately after [[SNAPSHOT_MATRIX]].
 * Run: pnpm tsx scripts/inject_snapshot_cascade.ts
 * Uses ADA/report template.docx unless ADA_TEMPLATE_PATH is set.
 */
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';

const TEMPLATE_PATH =
  process.env.ADA_TEMPLATE_PATH ||
  path.join(process.cwd(), 'ADA', 'report template.docx');

const CASCADE_PARAGRAPH = `<w:p><w:pPr/><w:r><w:t xml:space="preserve">[[SNAPSHOT_CASCADE]]</w:t></w:r></w:p>`;

async function main(): Promise<number> {
  const resolved = path.resolve(TEMPLATE_PATH);
  console.log(`Template: ${resolved}`);

  const buf = await fs.readFile(resolved);
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file('word/document.xml');
  if (!entry) {
    console.error('ERROR: Not a valid DOCX (missing word/document.xml)');
    return 1;
  }

  let xml = await entry.async('string');

  if (xml.includes('[[SNAPSHOT_CASCADE]]')) {
    console.log('[[SNAPSHOT_CASCADE]] already present. No change.');
    return 0;
  }

  const matrixIdx = xml.indexOf('[[SNAPSHOT_MATRIX]]');
  if (matrixIdx < 0) {
    console.error('ERROR: [[SNAPSHOT_MATRIX]] not found. Cannot determine insertion point.');
    return 1;
  }

  // Find the </w:p> that closes the paragraph containing SNAPSHOT_MATRIX
  const afterMatrix = xml.slice(matrixIdx);
  const paraEnd = afterMatrix.indexOf('</w:p>');
  if (paraEnd < 0) {
    console.error('ERROR: Could not find paragraph boundary after SNAPSHOT_MATRIX');
    return 1;
  }

  const insertPos = matrixIdx + paraEnd + '</w:p>'.length;
  xml = xml.slice(0, insertPos) + CASCADE_PARAGRAPH + xml.slice(insertPos);

  zip.file('word/document.xml', xml);
  const out = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(resolved, out);

  console.log('Added [[SNAPSHOT_CASCADE]] after [[SNAPSHOT_MATRIX]].');
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(e);
  process.exit(1);
});
