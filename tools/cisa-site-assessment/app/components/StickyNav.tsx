"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface StickyNavProps {
  assessmentId: string;
  facilityName?: string;
  className?: string;
}

export default function StickyNav({ 
  assessmentId, 
  facilityName,
  className = "" 
}: StickyNavProps) {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky nav after scrolling past 100px
      setIsSticky(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isSticky) return null;

  return (
    <nav
      className={`sticky-nav ${className}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "white",
        padding: "12px 0",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        borderBottom: "1px solid #dfe1e2",
        marginBottom: "1rem",
      }}
      aria-label="Sticky navigation"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 1rem",
        }}
      >
        <div style={{ fontSize: "14px", color: "#565c65", fontWeight: 500 }}>
          {facilityName && (
            <span>{facilityName}</span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
          }}
        >
          <Link
            href="/assessments"
            className="usa-button usa-button--outline"
            style={{
              textDecoration: "none",
              fontSize: "14px",
              padding: "8px 16px",
            }}
          >
            Back to Assessments
          </Link>
          <Link
            href={`/assessments/${assessmentId}/results`}
            className="usa-button"
            style={{
              textDecoration: "none",
              fontSize: "14px",
              padding: "8px 16px",
            }}
          >
            View Results
          </Link>
        </div>
      </div>
    </nav>
  );
}
