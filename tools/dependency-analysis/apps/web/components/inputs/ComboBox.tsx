"use client";

import * as React from "react";

export type ComboBoxOption = {
  value: string;
  label: string;
  group?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: ComboBoxOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function ComboBox(props: Props) {
  const { value, onChange, options, placeholder, ariaLabel, disabled } = props;
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q));
  }, [options, query]);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ComboBoxOption[]>();
    for (const opt of filtered) {
      const g = opt.group ?? "Options";
      const arr = map.get(g) ?? [];
      arr.push(opt);
      map.set(g, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div ref={rootRef} className="combo-root">
      <button
        type="button"
        dir="ltr"
        disabled={disabled}
        aria-label={ariaLabel ?? "Select option"}
        onClick={() => setOpen((o) => !o)}
        className="combo-trigger"
      >
        {selected?.label ?? placeholder ?? "Select..."}
      </button>

      {open && !disabled && (
        <div className="combo-dropdown">
          <input
            type="search"
            dir="ltr"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="form-control combo-search"
          />

          {grouped.length === 0 ? (
            <div className="combo-empty">No matches.</div>
          ) : (
            grouped.map(([group, opts]) => (
              <div key={group} className="combo-group">
                <div className="combo-group-label">{group}</div>
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`combo-option ${opt.value === value ? "combo-option-selected" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
