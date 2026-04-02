"use client";

import { useEffect, useState } from "react";

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved?: Date | null;
  className?: string;
}

export default function AutoSaveIndicator({
  isSaving,
  lastSaved,
  className = "",
}: AutoSaveIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!isSaving && lastSaved) {
      const showTimer = setTimeout(() => setShowSaved(true), 0);
      const hideTimer = setTimeout(() => setShowSaved(false), 2000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isSaving, lastSaved]);

  if (isSaving) {
    return (
      <div
        className={`auto-save-indicator saving ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "14px",
          color: "#565c65",
        }}
        aria-live="polite"
        aria-label="Saving changes"
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid #005ea2",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span>Saving...</span>
      </div>
    );
  }

  if (showSaved && lastSaved) {
    return (
      <div
        className={`auto-save-indicator saved ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "14px",
          color: "#00a91c",
        }}
        aria-live="polite"
        aria-label="Changes saved"
      >
        <span style={{ fontSize: "16px" }}>✓</span>
        <span>Saved</span>
      </div>
    );
  }

  return null;
}
