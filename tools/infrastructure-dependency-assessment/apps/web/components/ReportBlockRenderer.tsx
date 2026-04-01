'use client';

import React from 'react';
import type { ReportBlock } from '@/app/lib/report/blocks';

export interface ReportBlockRendererProps {
  blocks: ReportBlock[];
  /** Optional CSS class for container */
  className?: string;
}

/**
 * Renders an array of ReportBlocks as HTML for preview.
 * This is the UI/preview renderer - export to DOCX uses a different renderer.
 */
export function ReportBlockRenderer({ blocks, className }: ReportBlockRendererProps) {
  return (
    <div className={className}>
      {blocks.map((block, idx) => (
        <BlockComponent key={block.id || `block-${idx}`} block={block} />
      ))}
    </div>
  );
}

function BlockComponent({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'bullet_list':
      return <BulletListBlock block={block} />;
    case 'figure':
      return <FigureBlock block={block} />;
    case 'callout':
      return <CalloutBlock block={block} />;
    case 'separator':
      return <SeparatorBlock />;
    case 'page_break':
      return <PageBreakBlock />;
    case 'table_simple':
      return <TableSimpleBlock block={block} />;
    default:
      return null;
  }
}

function HeadingBlock({ block }: { block: Extract<ReportBlock, { type: 'heading' }> }) {
  const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const fontSize = {
    1: '2rem',
    2: '1.5rem',
    3: '1.25rem',
    4: '1.125rem',
    5: '1rem',
    6: '0.875rem',
  }[block.level];
  
  return (
    <Tag
      id={block.id}
      style={{
        fontSize,
        fontWeight: 600,
        marginTop: block.level === 1 ? '2rem' : '1.5rem',
        marginBottom: '1rem',
        color: 'var(--color-primary)',
        pageBreakBefore: block.pageBreakBefore ? 'always' : undefined,
      }}
    >
      {block.number && <span style={{ marginRight: '0.5rem' }}>{block.number}</span>}
      {block.text}
    </Tag>
  );
}

function ParagraphBlock({ block }: { block: Extract<ReportBlock, { type: 'paragraph' }> }) {
  const indent = block.indent ? `${block.indent * 2}rem` : '0';
  const fontWeight = block.variant === 'emphasis' ? 600 : 400;
  const color = block.variant === 'subtle' ? 'var(--color-secondary)' : 'var(--color-text)';
  
  return (
    <p
      id={block.id}
      style={{
        marginLeft: indent,
        marginBottom: '1rem',
        lineHeight: 1.6,
        fontWeight,
        color,
      }}
    >
      {block.text}
    </p>
  );
}

function BulletListBlock({ block }: { block: Extract<ReportBlock, { type: 'bullet_list' }> }) {
  const indent = block.indent ? `${block.indent * 2}rem` : '0';
  
  return (
    <ul
      id={block.id}
      style={{
        marginLeft: indent,
        marginBottom: '1rem',
        paddingLeft: '1.5rem',
      }}
    >
      {block.items.map((item, idx) => (
        <li key={idx} style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>
          {item.text}
          {item.subitems && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              {item.subitems.map((subitem, subIdx) => (
                <li key={subIdx} style={{ marginBottom: '0.25rem', lineHeight: 1.6 }}>
                  {subitem.text}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function FigureBlock({ block }: { block: Extract<ReportBlock, { type: 'figure' }> }) {
  const maxWidth = {
    small: '400px',
    medium: '600px',
    large: '800px',
    'full-width': '100%',
  }[block.size || 'medium'];
  
  // If dataRef is an SVG string, render it directly
  const isSvgString = typeof block.dataRef === 'string' && block.dataRef.startsWith('<svg');
  
  return (
    <figure
      id={block.id}
      style={{
        margin: '2rem auto',
        maxWidth,
        textAlign: 'center',
      }}
    >
      {isSvgString ? (
        <div dangerouslySetInnerHTML={{ __html: block.dataRef as string }} />
      ) : (
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'var(--cisa-gray-light)',
            borderRadius: 'var(--border-radius)',
            fontStyle: 'italic',
            color: 'var(--color-secondary)',
          }}
        >
          {block.kind} [{block.caption || 'Figure'}]
        </div>
      )}
      {block.caption && (
        <figcaption
          style={{
            marginTop: '0.75rem',
            fontSize: '0.875rem',
            fontStyle: 'italic',
            color: 'var(--color-secondary)',
          }}
        >
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function CalloutBlock({ block }: { block: Extract<ReportBlock, { type: 'callout' }> }) {
  const severityColors = {
    immediate: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
    'short-term': { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
    delayed: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
    strategic: { bg: '#F3F4F6', border: '#6B7280', text: '#374151' },
    info: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  };
  
  const colors = severityColors[block.severity || 'info'];
  
  return (
    <div
      id={block.id}
      style={{
        margin: '1.5rem 0',
        padding: '1rem',
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: 'var(--border-radius)',
      }}
    >
      <h4
        style={{
          margin: '0 0 0.5rem 0',
          fontWeight: 600,
          color: colors.text,
        }}
      >
        {block.icon && <span style={{ marginRight: '0.5rem' }}>{block.icon}</span>}
        {block.title}
      </h4>
      <p style={{ margin: 0, lineHeight: 1.6, color: colors.text }}>
        {block.text}
      </p>
    </div>
  );
}

function SeparatorBlock() {
  return (
    <hr
      style={{
        margin: '2rem 0',
        border: 'none',
        borderTop: '1px solid var(--cisa-gray-light)',
      }}
    />
  );
}

function PageBreakBlock() {
  return (
    <div
      style={{
        margin: '3rem 0',
        padding: '1rem',
        textAlign: 'center',
        border: '1px dashed var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
        color: 'var(--color-secondary)',
        fontSize: '0.875rem',
        fontStyle: 'italic',
      }}
    >
      — Page Break —
    </div>
  );
}

function TableSimpleBlock({ block }: { block: Extract<ReportBlock, { type: 'table_simple' }> }) {
  return (
    <div
      id={block.id}
      style={{
        margin: '1.5rem 0',
        overflow: 'hidden',
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--cisa-gray-light)',
      }}
    >
      {block.title && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--cisa-gray-light)',
            fontWeight: 600,
            borderBottom: '1px solid var(--cisa-gray-light)',
          }}
        >
          {block.title}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {block.rows.map((row, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: idx < block.rows.length - 1 ? '1px solid var(--cisa-gray-light)' : undefined,
              }}
            >
              <td
                style={{
                  padding: block.compact ? '0.5rem 1rem' : '0.75rem 1rem',
                  fontWeight: 600,
                  width: '40%',
                  backgroundColor: 'var(--cisa-gray-light)',
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: block.compact ? '0.5rem 1rem' : '0.75rem 1rem',
                  width: '60%',
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
