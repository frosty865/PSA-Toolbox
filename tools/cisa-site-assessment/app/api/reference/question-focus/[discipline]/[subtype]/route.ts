import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Horizontal rules first (before other processing)
  html = html.replace(/^---$/gim, '<hr>');
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  
  // Process lists - group consecutive list items
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = /^- /.test(line);
    
    if (isListItem) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(line.replace(/^- (.*)$/, '<li>$1</li>'));
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  html = processedLines.join('\n');
  
  // Paragraphs - split on double newlines, but preserve single newlines within paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map(p => {
      p = p.trim();
      if (!p || p.startsWith('<') || p === '<hr>') {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  
  // Clean up empty paragraphs and fix nested tags
  html = html.replace(/<p><\/p>/gim, '');
  html = html.replace(/<p><br><\/p>/gim, '');
  html = html.replace(/<p>(<[h|u|o])/gim, '$1');
  html = html.replace(/(<\/[h|u|o]>)<\/p>/gim, '$1');
  
  return html;
}

/**
 * GET /api/reference/question-focus/[discipline]/[subtype]
 * 
 * Returns markdown content for a specific baseline question focus page.
 * 
 * SCOPE: Baseline questions only
 * CONTENT: Static markdown files, rendered as HTML
 * READ-ONLY: No write operations, reference material only
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ discipline: string; subtype: string }> }
) {
  try {
    const { discipline, subtype } = await params;

    // Path to question focus page (baseline scope only)
    // Content is read-only reference material
    const filePath = join(
      process.cwd(),
      '..',
      'psa_engine',
      'docs',
      'reference',
      'question_focus',
      discipline,
      `${subtype}.md`
    );

    console.log('Looking for file at:', filePath);
    console.log('Current working directory:', process.cwd());

    try {
      const markdown = await readFile(filePath, 'utf-8');
      
      // Convert markdown to HTML
      const html = markdownToHtml(markdown);
      
      return NextResponse.json({ content: html });
    } catch (err: unknown) {
      const e = err && typeof err === "object" ? err as { code?: string; message?: string } : {};
      console.error("File read error:", err);
      console.error("Error code:", e.code);
      console.error("Error message:", e.message);

      if (e.code === "ENOENT") {
        return NextResponse.json(
          { 
            error: 'Question focus page not found',
            debug: {
              filePath,
              discipline,
              subtype,
              cwd: process.cwd()
            }
          },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error loading question focus page:", error);
    let discipline = "unknown";
    let subtype = "unknown";
    try {
      const resolvedParams = await params;
      discipline = resolvedParams.discipline;
      subtype = resolvedParams.subtype;
    } catch {}

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load question focus page",
        debug: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          discipline,
          subtype
        }
      },
      { status: 500 }
    );
  }
}
