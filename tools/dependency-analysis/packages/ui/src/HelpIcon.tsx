import * as React from 'react';

function isEditableTextElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const el = target;
  const tagName = el.tagName;
  if (tagName === 'TEXTAREA') return true;
  if (tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    return ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(type);
  }
  return el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '';
}

export interface HelpIconProps {
  /** Help text to show in the popover. */
  help: string;
  /** Optional intent description (what we are trying to capture). */
  intent?: string;
  /** Optional impact description (why the answer matters). */
  impact?: string;
  /** Optional examples (max 3). */
  examples?: string[];
  /** Optional id for the popover (for aria-describedby). */
  id?: string;
}

/**
 * Accessible help icon: shows "i" button; on click/Enter/Space opens popover with help and optional examples.
 * Escape or click outside closes. No persistence; no third-party UI lib.
 */
export function HelpIcon({ help, intent, impact, examples, id: idProp }: HelpIconProps) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const id = idProp ?? `help-${React.useId()}`;

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      )
        return;
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, close]);

  return (
    <span className="help-icon-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '0.25rem' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Help"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (isEditableTextElement(e.target)) return;
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.25rem',
          height: '1.25rem',
          padding: 0,
          border: '1px solid currentColor',
          borderRadius: '50%',
          background: 'transparent',
          color: 'var(--color-text-secondary, #555)',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        i
      </button>
      {open && (
        <div
          ref={popoverRef}
          id={id}
          role="dialog"
          aria-label="Help"
          style={{
            position: 'absolute',
            zIndex: 1000,
            marginTop: '0.25rem',
            marginLeft: 0,
            minWidth: '220px',
            maxWidth: '320px',
            padding: '0.75rem',
            background: 'var(--color-background, #fff)',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
          }}
        >
          {help ? <p style={{ margin: 0, marginBottom: (intent ?? impact ?? examples?.length) ? '0.5rem' : 0 }}>{help}</p> : null}
          {intent ? (
            <p style={{ margin: 0, marginBottom: impact || examples?.length ? '0.5rem' : 0 }}>
              <strong>Intent:</strong> {intent}
            </p>
          ) : null}
          {impact ? (
            <p style={{ margin: 0, marginBottom: examples?.length ? '0.5rem' : 0 }}>
              <strong>Impact:</strong> {impact}
            </p>
          ) : null}
          {examples && examples.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {examples.slice(0, 3).map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
