"use client";

import { useState, useEffect } from "react";

interface Discipline {
  id: string;
  name: string;
  questionCount: number;
}

interface DisciplineNavProps {
  disciplines: Discipline[];
  className?: string;
  defaultExpanded?: boolean;
}

export default function DisciplineNav({ disciplines, className = "", defaultExpanded = false }: DisciplineNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Track which section is currently in view
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -70% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    // Observe all discipline sections
    disciplines.forEach((discipline) => {
      const element = document.getElementById(discipline.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      disciplines.forEach((discipline) => {
        const element = document.getElementById(discipline.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [disciplines]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for sticky nav
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Update active section immediately
      setActiveSection(id);
      setIsExpanded(false);
    }
  };

  if (disciplines.length === 0) return null;

  return (
    <nav
      className={`discipline-nav ${className}`}
      style={{
        backgroundColor: "white",
        border: "1px solid #dfe1e2",
        borderRadius: "0.5rem",
        padding: "1rem",
        marginBottom: "1.5rem",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isExpanded ? "1rem" : "0",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "#1b1b1b",
          }}
        >
          Jump to Discipline
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.25rem",
            color: "#005ea2",
            padding: "0.25rem 0.5rem",
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {disciplines.map((discipline) => {
            const isActive = activeSection === discipline.id;
            return (
              <button
                key={discipline.id}
                onClick={() => scrollToSection(discipline.id)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  backgroundColor: isActive ? "#e7f3f8" : "transparent",
                  border: isActive ? "2px solid #005ea2" : "1px solid #dfe1e2",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "#1b1b1b",
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.2s ease",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#f0f7ff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <span>
                  {discipline.name}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#565c65",
                    backgroundColor: "#f0f0f0",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    marginLeft: "0.5rem",
                  }}
                >
                  {discipline.questionCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Compact view when collapsed */}
      {!isExpanded && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {disciplines.slice(0, 5).map((discipline) => {
            const isActive = activeSection === discipline.id;
            return (
              <button
                key={discipline.id}
                onClick={() => scrollToSection(discipline.id)}
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: isActive ? "#e7f3f8" : "#f0f0f0",
                  border: isActive ? "2px solid #005ea2" : "1px solid #dfe1e2",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  color: "#1b1b1b",
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#e0e0e0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#f0f0f0";
                  }
                }}
              >
                {discipline.name}
              </button>
            );
          })}
          {disciplines.length > 5 && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "#565c65",
                padding: "0.5rem 0.75rem",
                alignSelf: "center",
              }}
            >
              +{disciplines.length - 5} more
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
