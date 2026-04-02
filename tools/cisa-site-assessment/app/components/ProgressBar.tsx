"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  percentage?: number;
  showCount?: boolean;
  label?: string;
  /** Short explanation shown under the bar (e.g. depth-1 vs depth-2 breakdown). */
  caption?: string;
}

export default function ProgressBar({
  current,
  total,
  percentage,
  showCount = true,
  label = "Progress",
  caption,
}: ProgressBarProps) {
  const calculatedPercentage = percentage ?? Math.round((current / total) * 100);
  const safePercentage = Math.min(100, Math.max(0, calculatedPercentage));

  return (
    <div className="progress-bar-container" style={{ marginBottom: "24px" }}>
      <div className="progress-bar-header" style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "8px"
      }}>
        <span className="progress-label" style={{ 
          fontSize: "14px", 
          fontWeight: 600,
          color: "#1b1b1b"
        }}>
          {label}
        </span>
        {showCount && (
          <span className="progress-count" style={{ 
            fontSize: "14px", 
            color: "#565c65"
          }}>
            {current} of {total} questions answered
          </span>
        )}
      </div>
      <div className="progress-bar-wrapper" style={{
        width: "100%",
        height: "8px",
        backgroundColor: "#f0f0f0",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative"
      }}>
        <div 
          className="progress-bar-fill"
          style={{
            width: `${safePercentage}%`,
            height: "100%",
            backgroundColor: safePercentage === 100 ? "#00a91c" : "#005ea2",
            borderRadius: "4px",
            transition: "width 0.3s ease, background-color 0.3s ease",
            position: "absolute",
            left: 0,
            top: 0
          }}
          role="progressbar"
          aria-valuenow={safePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${safePercentage}% complete`}
        />
      </div>
      {showCount && (
        <div className="progress-percentage" style={{
          textAlign: "right",
          fontSize: "12px",
          color: "#757575",
          marginTop: "4px"
        }}>
          {safePercentage}% complete
        </div>
      )}
      {caption ? (
        <p
          className="progress-caption"
          style={{
            margin: "10px 0 0",
            fontSize: "12px",
            lineHeight: 1.45,
            color: "#565c65",
            maxWidth: "52rem",
          }}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
