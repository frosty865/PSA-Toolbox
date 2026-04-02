"use client";

interface DisciplineSkeletonProps {
  questionCount?: number;
  className?: string;
}

export default function DisciplineSkeleton({ 
  questionCount = 3, 
  className = "" 
}: DisciplineSkeletonProps) {
  return (
    <div
      className={`discipline-skeleton ${className}`}
      style={{
        marginBottom: "2rem",
        paddingBottom: "1.5rem",
        borderBottom: "2px solid #dfe1e2",
      }}
    >
      {/* Discipline header skeleton */}
      <div
        style={{
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid #e6e6e6",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              height: "24px",
              width: "200px",
              backgroundColor: "#e5e7eb",
              borderRadius: "4px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "24px",
              width: "100px",
              backgroundColor: "#e5e7eb",
              borderRadius: "4px",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: "0.2s",
            }}
          />
        </div>
      </div>

      {/* Question skeletons */}
      {Array.from({ length: questionCount }).map((_, index) => (
        <div
          key={index}
          style={{
            marginBottom: "1.5rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                height: "20px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                marginBottom: "8px",
                width: "90%",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${0.1 * index}s`,
              }}
            />
            <div
              style={{
                height: "20px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                width: "75%",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${0.1 * index + 0.2}s`,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "1rem",
            }}
          >
            {[1, 2, 3].map((opt) => (
              <div
                key={opt}
                style={{
                  height: "44px",
                  width: "80px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${0.1 * index + 0.1 * opt}s`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
