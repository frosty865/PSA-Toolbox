/**
 * Report Block System - Narrative building blocks for report composition
 * 
 * Blocks are an intermediate representation that can be rendered by different exporters
 * (PDF, DOCX, HTML) without coupling to specific rendering logic.
 * 
 * NO VOFC TABLES - all content is narrative-first.
 */

import type { CitationRef } from './citations/registry';

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'figure'
  | 'callout'
  | 'separator'
  | 'page_break'
  | 'table_simple'; // Only for curve input summary tables, NOT VOFC

/**
 * Base block interface
 */
export interface Block {
  type: BlockType;
  id?: string; // optional ID for linking/anchoring
}

/**
 * Heading block (H1-H6)
 */
export interface HeadingBlock extends Block {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** Optional section number (e.g., "1.2.3") */
  number?: string;
  /** Start new page before this heading */
  pageBreakBefore?: boolean;
}

/**
 * Paragraph block with optional inline citations
 */
export interface ParagraphBlock extends Block {
  type: 'paragraph';
  text: string;
  /** Citation keys to render inline at end of paragraph */
  citations?: string[];
  /** Indent level (0 = normal, 1+ = nested) */
  indent?: number;
  /** Style variant */
  variant?: 'normal' | 'emphasis' | 'subtle';
}

/**
 * Bullet list block
 */
export interface BulletListBlock extends Block {
  type: 'bullet_list';
  items: Array<{
    text: string;
    citations?: string[];
    /** Nested sub-items */
    subitems?: Array<{ text: string; citations?: string[] }>;
  }>;
  /** Indent level */
  indent?: number;
}

/**
 * Figure block (charts, diagrams, images)
 */
export interface FigureBlock extends Block {
  type: 'figure';
  kind: 
    | 'curve_overview'           // Executive: Combined impact curves
    | 'curve_individual'          // Individual infrastructure curve
    | 'dependency_matrix'         // Cross-dependency heatmap/matrix
    | 'dependency_graph'          // Node-edge graph diagram
    | 'risk_driver_infographic'   // Key risk driver visual
    | 'custom';
  
  /** Figure caption */
  caption?: string;
  
  /** Data reference for rendering (SVG string, image path, or data object) */
  dataRef: string | Record<string, unknown>;
  
  /** Alt text for accessibility */
  alt?: string;
  
  /** Sizing hint */
  size?: 'small' | 'medium' | 'large' | 'full-width';
}

/**
 * Callout block (for key risk drivers, important notes)
 */
export interface CalloutBlock extends Block {
  type: 'callout';
  title: string;
  text: string;
  /** Severity or importance level */
  severity?: 'immediate' | 'short-term' | 'delayed' | 'strategic' | 'info';
  /** Optional icon hint */
  icon?: string;
  citations?: string[];
}

/**
 * Separator block (horizontal rule)
 */
export interface SeparatorBlock extends Block {
  type: 'separator';
}

/**
 * Page break block (force new page)
 */
export interface PageBreakBlock extends Block {
  type: 'page_break';
}

/**
 * Simple table block (ONLY for curve input summaries, NOT VOFC)
 * Limited to 2-column key-value pairs
 */
export interface TableSimpleBlock extends Block {
  type: 'table_simple';
  title?: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
  /** If true, render as compact inline layout */
  compact?: boolean;
}

/**
 * Union type of all blocks
 */
export type ReportBlock =
  | HeadingBlock
  | ParagraphBlock
  | BulletListBlock
  | FigureBlock
  | CalloutBlock
  | SeparatorBlock
  | PageBreakBlock
  | TableSimpleBlock;

/**
 * Helper: Create heading block
 */
export function heading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text: string,
  options?: { number?: string; pageBreakBefore?: boolean; id?: string }
): HeadingBlock {
  return {
    type: 'heading',
    level,
    text,
    ...options,
  };
}

/**
 * Helper: Create paragraph block
 */
export function paragraph(
  text: string,
  options?: { citations?: string[]; indent?: number; variant?: 'normal' | 'emphasis' | 'subtle'; id?: string }
): ParagraphBlock {
  return {
    type: 'paragraph',
    text,
    ...options,
  };
}

/**
 * Helper: Create bullet list block
 */
export function bulletList(
  items: Array<{ text: string; citations?: string[]; subitems?: Array<{ text: string; citations?: string[] }> }>,
  options?: { indent?: number; id?: string }
): BulletListBlock {
  return {
    type: 'bullet_list',
    items,
    ...options,
  };
}

/**
 * Helper: Create figure block
 */
export function figure(
  kind: FigureBlock['kind'],
  dataRef: string | Record<string, unknown>,
  options?: { caption?: string; alt?: string; size?: 'small' | 'medium' | 'large' | 'full-width'; id?: string }
): FigureBlock {
  return {
    type: 'figure',
    kind,
    dataRef,
    ...options,
  };
}

/**
 * Helper: Create callout block
 */
export function callout(
  title: string,
  text: string,
  options?: { severity?: 'immediate' | 'short-term' | 'delayed' | 'strategic' | 'info'; icon?: string; citations?: string[]; id?: string }
): CalloutBlock {
  return {
    type: 'callout',
    title,
    text,
    ...options,
  };
}

/**
 * Helper: Create separator block
 */
export function separator(id?: string): SeparatorBlock {
  return { type: 'separator', id };
}

/**
 * Helper: Create page break block
 */
export function pageBreak(id?: string): PageBreakBlock {
  return { type: 'page_break', id };
}

/**
 * Helper: Create simple table block
 */
export function tableSimple(
  rows: Array<{ label: string; value: string }>,
  options?: { title?: string; compact?: boolean; id?: string }
): TableSimpleBlock {
  return {
    type: 'table_simple',
    rows,
    ...options,
  };
}
