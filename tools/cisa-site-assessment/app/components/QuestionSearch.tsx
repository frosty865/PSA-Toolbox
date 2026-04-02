"use client";

import { useState, useMemo } from "react";

interface QuestionSearchProps {
  questions: Array<{
    canon_id: string;
    question_text: string;
    discipline_name?: string;
    discipline_subtype_name?: string;
  }>;
  onQuestionSelect?: (canonId: string) => void;
  className?: string;
}

export default function QuestionSearch({
  questions,
  onQuestionSelect,
  className = "",
}: QuestionSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return questions.filter((q) => {
      const text = (q.question_text || "").toLowerCase();
      const code = (q.canon_id || "").toLowerCase();
      const discipline = (q.discipline_name || "").toLowerCase();
      const subtype = (q.discipline_subtype_name || "").toLowerCase();
      
      return (
        text.includes(query) ||
        code.includes(query) ||
        discipline.includes(query) ||
        subtype.includes(query)
      );
    }).slice(0, 10); // Limit to 10 results
  }, [searchQuery, questions]);

  const handleQuestionClick = (canonId: string) => {
    if (onQuestionSelect) {
      onQuestionSelect(canonId);
    }
    setIsExpanded(false);
    setSearchQuery("");
  };

  return (
    <div className={`question-search ${className}`} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          style={{
            flex: 1,
            padding: "0.5rem 1rem",
            fontSize: "14px",
            border: "1px solid #dfe1e2",
            borderRadius: "0.25rem",
            minWidth: "200px",
          }}
          aria-label="Search questions"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setIsExpanded(false);
            }}
            style={{
              padding: "0.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "#565c65",
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isExpanded && filteredQuestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            backgroundColor: "white",
            border: "1px solid #dfe1e2",
            borderRadius: "0.25rem",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            maxHeight: "400px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          {filteredQuestions.map((q) => (
            <button
              key={q.canon_id}
              onClick={() => handleQuestionClick(q.canon_id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.75rem 1rem",
                border: "none",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "14px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f7ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#1b1b1b" }}>
                {q.canon_id}
              </div>
              <div style={{ fontSize: "12px", color: "#565c65", lineHeight: "1.4" }}>
                {q.question_text}
              </div>
              {(q.discipline_name || q.discipline_subtype_name) && (
                <div style={{ fontSize: "11px", color: "#757575", marginTop: "0.25rem" }}>
                  {q.discipline_name}
                  {q.discipline_subtype_name && ` - ${q.discipline_subtype_name}`}
                </div>
              )}
            </button>
          ))}
          {filteredQuestions.length === 10 && (
            <div style={{ padding: "0.5rem 1rem", fontSize: "12px", color: "#757575", textAlign: "center" }}>
              Showing first 10 results. Refine your search for more.
            </div>
          )}
        </div>
      )}

      {isExpanded && searchQuery && filteredQuestions.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            backgroundColor: "white",
            border: "1px solid #dfe1e2",
            borderRadius: "0.25rem",
            padding: "1rem",
            textAlign: "center",
            color: "#565c65",
            zIndex: 1000,
          }}
        >
          No questions found matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
