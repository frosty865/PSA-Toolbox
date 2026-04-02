/**
 * Post-process apps/web/out after static export so the bundle works from file://
 * (no HTTP server, no Python). Rewrites root-absolute paths to relative URLs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(__dirname, '..', 'apps', 'web', 'out');

function depthPrefix(depth) {
  if (depth <= 0) return './';
  return `${'../'.repeat(depth)}`;
}

function injectHtmlDepth(content, depth) {
  if (/\sdata-idt-out-depth=/.test(content)) return content;
  return content.replace(/<html(\s[^>]*)?>/i, `<html data-idt-out-depth="${depth}"$1>`);
}

function rewriteBulkNext(content, pre) {
  let s = content;
  s = s.replace(/"\/_next\//g, `"${pre}_next/`);
  s = s.replace(/'\/_next\//g, `'${pre}_next/`);
  s = s.replace(/\\"\/_next\//g, `\\"${pre}_next/`);
  return s;
}

function resolveOutTarget(outRootNorm, urlPath) {
  const clean = urlPath.replace(/^\/+/, '').replace(/\/$/, '');
  if (!clean) return path.join(outRootNorm, 'index.html');
  const direct = path.join(outRootNorm, ...clean.split('/'));
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const indexUnder = path.join(direct, 'index.html');
  if (fs.existsSync(indexUnder)) return indexUnder;
  const htmlFile = `${direct}.html`;
  if (fs.existsSync(htmlFile)) return htmlFile;
  return null;
}

function toHrefRel(fromDir, targetFile, outRootNorm) {
  let rel = path.relative(fromDir, targetFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const resolved = path.resolve(targetFile);
  if (resolved.endsWith(`${path.sep}index.html`) || targetFile.endsWith('index.html')) {
    rel = rel.replace(/\/?index\.html$/, '/');
  }
  return rel;
}

function rewriteHrefSrcAbsolute(htmlPath, content, outRootNorm) {
  const fromDir = path.dirname(htmlPath);
  return content.replace(/(href|src)=(["'])\/(?!\/)([^"']*)\2/g, (full, attr, q, rest) => {
    if (/^https?:/i.test(rest)) return full;
    const target = resolveOutTarget(outRootNorm, `/${rest}`);
    if (!target || !fs.existsSync(target)) return full;
    if (!path.resolve(target).startsWith(outRootNorm)) return full;
    const rel = toHrefRel(fromDir, target, outRootNorm);
    return `${attr}=${q}${rel}${q}`;
  });
}

function patchTurbopackRuntime(chunksDir) {
  const files = fs.readdirSync(chunksDir).filter((f) => f.startsWith('turbopack-') && f.endsWith('.js'));
  const needle = 'let t="/_next/"';
  const replacement = `let t=(function(){var s=document.currentScript&&document.currentScript.src;if(!s)return"/_next/";try{var p=new URL(s).pathname,n=p.indexOf("/_next/");return n>=0?p.slice(0,n)+"/_next/":"/_next/"}catch(e){return"/_next/"}})()`;
  for (const f of files) {
    const p = path.join(chunksDir, f);
    let txt = fs.readFileSync(p, 'utf8');
    if (!txt.includes(needle)) continue;
    txt = txt.replace(needle, replacement);
    fs.writeFileSync(p, txt, 'utf8');
    console.log('[rewrite-field-file] patched', path.relative(outRoot, p));
  }
}

function walkHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walkHtmlFiles(full, out);
    else if (name.isFile() && name.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(outRoot)) {
    console.error('[rewrite-field-file] Missing', outRoot);
    process.exit(1);
  }

  const outRootNorm = path.resolve(outRoot);
  const htmlFiles = walkHtmlFiles(outRoot);

  for (const htmlPath of htmlFiles) {
    const dir = path.dirname(htmlPath);
    const relDir = path.relative(outRootNorm, dir);
    const depth = relDir && relDir !== '.' ? relDir.split(path.sep).filter(Boolean).length : 0;
    const pre = depthPrefix(depth);
    let content = fs.readFileSync(htmlPath, 'utf8');
    content = injectHtmlDepth(content, depth);
    content = rewriteBulkNext(content, pre);
    content = rewriteHrefSrcAbsolute(htmlPath, content, outRootNorm);
    fs.writeFileSync(htmlPath, content, 'utf8');
  }

  const chunksDir = path.join(outRoot, '_next', 'static', 'chunks');
  if (fs.existsSync(chunksDir)) {
    patchTurbopackRuntime(chunksDir);
  }

  console.log('[rewrite-field-file] OK —', htmlFiles.length, 'HTML files (file://-safe)');
}

main();
