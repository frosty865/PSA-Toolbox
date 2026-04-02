"use client";

interface UndoButtonProps {
  onUndo: () => void;
  disabled?: boolean;
  className?: string;
}

export default function UndoButton({ onUndo, disabled = false, className = "" }: UndoButtonProps) {
  return (
    <button
      onClick={onUndo}
      disabled={disabled}
      className={`undo-button ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        backgroundColor: disabled ? "#f0f0f0" : "#005ea2",
        color: disabled ? "#757575" : "white",
        border: "none",
        borderRadius: "0.25rem",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "all 0.2s ease",
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "#004080";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "#005ea2";
        }
      }}
      aria-label="Undo last response"
      title={disabled ? "No actions to undo" : "Undo last response"}
    >
      <span style={{ fontSize: "16px" }}>↶</span>
      <span>Undo</span>
    </button>
  );
}
