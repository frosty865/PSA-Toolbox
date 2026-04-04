"use client";

import * as React from "react";

type NumericInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number | null | undefined;
  onValueChange: (next: number | null) => void;
  integer?: boolean;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
};

function clamp(n: number, min?: number, max?: number) {
  if (typeof min === "number" && n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

function roundToStep(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function NumericInput(props: NumericInputProps) {
  const {
    value,
    onValueChange,
    integer = true,
    min,
    max,
    step,
    allowEmpty = true,
    className,
    onBlur,
    onKeyDown,
    ...rest
  } = props;

  const [draft, setDraft] = React.useState<string>(() => {
    if (value === null || value === undefined) return "";
    return String(value);
  });

  React.useEffect(() => {
    const next = value === null || value === undefined ? "" : String(value);
    if (next !== draft) setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sanitize = React.useCallback(
    (s: string) => {
      if (s === "") return s;
      s = s.trim();
      if (integer) {
        s = s.replace(/[^\d]/g, "");
        s = s.replace(/^0+(?=\d)/, "");
        return s;
      }
      s = s.replace(/[^\d.]/g, "");
      const parts = s.split(".");
      if (parts.length > 2) {
        s = parts[0] + "." + parts.slice(1).join("");
      }
      s = s.replace(/^0+(?=\d)/, "");
      if (s.startsWith(".")) s = "0" + s;
      return s;
    },
    [integer]
  );

  const commit = React.useCallback(
    (raw: string) => {
      if (raw === "") {
        if (allowEmpty) onValueChange(null);
        else onValueChange(typeof min === "number" ? min : 0);
        return;
      }
      const n = integer ? parseInt(raw, 10) : parseFloat(raw);
      if (!Number.isFinite(n)) {
        if (allowEmpty) onValueChange(null);
        else onValueChange(typeof min === "number" ? min : 0);
        return;
      }
      let result = clamp(n, min, max);
      if (typeof step === "number" && step > 0) {
        result = roundToStep(result, step);
        result = clamp(result, min, max);
      }
      onValueChange(result);
      setDraft(String(result));
    },
    [allowEmpty, integer, max, min, onValueChange, step]
  );

  const baseClass = "form-control w-full";
  const resolvedClassName = className ? `${baseClass} ${className}` : baseClass;

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern={integer ? "[0-9]*" : "[0-9]*[.]?[0-9]*"}
      className={resolvedClassName}
      value={draft}
      onChange={(e) => {
        const next = sanitize(e.target.value);
        setDraft(next);
      }}
      onBlur={(e) => {
        commit(draft);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (integer) {
          if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
            e.preventDefault();
          }
        } else {
          if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
        }
        if (e.key === "Enter") {
          commit(draft);
        }
        onKeyDown?.(e);
      }}
      aria-valuemin={min}
      aria-valuemax={max}
    />
  );
}
