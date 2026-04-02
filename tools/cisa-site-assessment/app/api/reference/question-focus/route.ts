import { NextResponse } from 'next/server';
import { readdir } from "fs/promises";
import { join } from 'path';

interface QuestionFocusPage {
  discipline: string;
  subtype: string;
  path: string;
}

/**
 * GET /api/reference/question-focus
 * 
 * Returns list of available baseline question focus pages.
 * 
 * SCOPE: Baseline questions only
 * CONTENT: Markdown files from docs/reference/question_focus/
 * READ-ONLY: Reference material only, no modifications
 */
export async function GET() {
  try {
    // Path to question focus pages (baseline scope only)
    // Content is read-only reference material
    const questionFocusRoot = join(
      process.cwd(),
      '..',
      'psa_engine',
      'docs',
      'reference',
      'question_focus'
    );

    const pages: QuestionFocusPage[] = [];

    try {
      // Read discipline directories
      const disciplineDirs = await readdir(questionFocusRoot, { withFileTypes: true });
      
      for (const dir of disciplineDirs) {
        if (!dir.isDirectory()) continue;
        
        const discipline = dir.name;
        const disciplinePath = join(questionFocusRoot, discipline);
        
        // Read subtype markdown files
        const files = await readdir(disciplinePath);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        for (const file of mdFiles) {
          const subtype = file.replace('.md', '');
          pages.push({
            discipline,
            subtype,
            path: `${discipline}/${subtype}`
          });
        }
      }
    } catch (err: unknown) {
      const e = err && typeof err === "object" && "code" in err ? (err as { code?: string }) : {};
      if (e.code === "ENOENT") {
        return NextResponse.json({ pages: [] });
      }
      throw err;
    }

    return NextResponse.json({ pages });
  } catch (error: unknown) {
    console.error("Error loading question focus pages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load question focus pages" },
      { status: 500 }
    );
  }
}


