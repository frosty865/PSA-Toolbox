"use client";

interface QuestionSkeletonProps {
  count?: number;
  className?: string;
}

export default function QuestionSkeleton({ count = 1, className = "" }: QuestionSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`question-skeleton ${className}`}
          style={{
            marginBottom: "1.5rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {/* Question text skeleton */}
          <div
            style={{
              marginBottom: "0.75rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "20px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  marginBottom: "8px",
                  width: "85%",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: "20px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  width: "70%",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: "0.2s",
                }}
              />
            </div>
            <div
              style={{
                height: "24px",
                width: "80px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: "0.4s",
              }}
            />
          </div>

          {/* Radio button skeletons */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            {["YES", "NO", "N/A"].map((option, optIndex) => (
              <div
                key={option}
                style={{
                  height: "44px",
                  width: "80px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${0.1 * optIndex}s`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
