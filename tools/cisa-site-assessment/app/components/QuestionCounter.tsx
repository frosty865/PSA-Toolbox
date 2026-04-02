"use client";

interface QuestionCounterProps {
  current: number;
  total: number;
  className?: string;
}

export default function QuestionCounter({
  current,
  total,
  className = "",
}: QuestionCounterProps) {
  return (
    <div 
      className={`question-counter ${className}`}
      style={{
        fontSize: "14px",
        color: "#565c65",
        fontWeight: 500
      }}
      aria-label={`Question ${current} of ${total}`}
    >
      Question <strong style={{ color: "#1b1b1b" }}>{current}</strong> of <strong style={{ color: "#1b1b1b" }}>{total}</strong>
    </div>
  );
}
