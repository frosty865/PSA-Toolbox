"use client";

import { useState, useEffect } from "react";

interface TechOverlayQuestion {
  id: string;
  tech_type: string;
  discipline_code: string;
  subtype_code: string;
  question_text: string;
  response_enum: string[];
  overlay_level: string;
  order_index: number;
  current_response: "YES" | "NO" | "N/A" | null;
  notes?: string;
}

interface TechOverlayQuestionsProps {
  assessmentId: string;
  subtypeCode: string;
  techTypes: string[];
  onResponseChange?: (questionId: string, response: "YES" | "NO" | "N/A") => void;
  isReadOnly?: boolean;
}

export default function TechOverlayQuestions({
  assessmentId,
  subtypeCode,
  techTypes,
  onResponseChange,
  isReadOnly = false,
}: TechOverlayQuestionsProps) {
  const [questions, setQuestions] = useState<TechOverlayQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (techTypes.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + ids only; loadQuestions is stable
  }, [assessmentId, subtypeCode, techTypes.join(",")]);

  // Listen for tech profile updates
  useEffect(() => {
    const handleUpdate = () => {
      if (techTypes.length > 0) {
        loadQuestions();
      }
    };
    window.addEventListener("tech-profile-updated", handleUpdate);
    return () => window.removeEventListener("tech-profile-updated", handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- techTypes identity; loadQuestions is stable
  }, [techTypes]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/tech-overlay-questions`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to load technology overlay questions");
      }

      const data = await response.json();
      // Filter by subtype and tech types
      const filtered = (data.questions || []).filter(
        (q: TechOverlayQuestion) =>
          q.subtype_code === subtypeCode && techTypes.includes(q.tech_type)
      );
      setQuestions(filtered);
    } catch (err: unknown) {
      console.error("Error loading tech overlay questions:", err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = async (questionId: string, response: "YES" | "NO" | "N/A") => {
    if (isReadOnly) return;

    setSaving((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch(
        `/api/runtime/assessments/${assessmentId}/tech-overlay-questions/responses`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responses: [
              {
                tech_question_template_id: questionId,
                response: response === "N/A" ? "N_A" : response,
              },
            ],
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save response");
      }

      // Update local state
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, current_response: response } : q
        )
      );

      onResponseChange?.(questionId, response);
    } catch (err: unknown) {
      console.error("Error saving tech overlay response:", err);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  if (loading) {
    return null; // Don't show loading state, just hide until loaded
  }

  if (questions.length === 0) {
    return null; // No overlay questions for this tech type
  }

  // Group questions by tech type
  const questionsByTechType = new Map<string, TechOverlayQuestion[]>();
  for (const q of questions) {
    if (!questionsByTechType.has(q.tech_type)) {
      questionsByTechType.set(q.tech_type, []);
    }
    questionsByTechType.get(q.tech_type)!.push(q);
  }

  return (
    <div
      style={{
        marginTop: "2rem",
        paddingTop: "2rem",
        borderTop: "2px solid #dfe1e2",
      }}
    >
      <h4
        style={{
          marginBottom: "1rem",
          fontSize: "1.1rem",
          color: "#1b1b1b",
          fontWeight: 600,
        }}
      >
        Technology-Specific Checks
      </h4>
      <p
        style={{
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
          color: "#71767a",
          fontStyle: "italic",
        }}
      >
        These questions are technology-specific and do not affect baseline scoring.
      </p>

      {Array.from(questionsByTechType.entries()).map(([techType, techQuestions]) => (
        <div
          key={techType}
          style={{
            marginBottom: "2rem",
            padding: "1rem",
            backgroundColor: "#f9fafb",
            border: "1px solid #dfe1e2",
            borderRadius: "0.25rem",
          }}
        >
          <h5
            style={{
              marginBottom: "1rem",
              fontSize: "1rem",
              color: "#1b1b1b",
              fontWeight: 600,
            }}
          >
            {techType.replace(/_/g, " ")}
          </h5>

          {techQuestions
            .sort((a, b) => a.order_index - b.order_index)
            .map((question) => (
              <div
                key={question.id}
                style={{
                  marginBottom: "1.5rem",
                  paddingBottom: "1.5rem",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <p
                  style={{
                    marginBottom: "1rem",
                    color: "#1b1b1b",
                    fontWeight: 500,
                  }}
                >
                  {question.question_text}
                </p>

                <fieldset className="usa-fieldset" disabled={isReadOnly || saving[question.id]}>
                  <div className="usa-radio">
                    {question.response_enum.map((option) => {
                      const normalizedOption =
                        option === "N_A" ? "N/A" : option;
                      const isSelected =
                        question.current_response === normalizedOption;

                      return (
                        <div key={option} className="usa-radio__item">
                          <input
                            className="usa-radio__input"
                            id={`tech-overlay-${question.id}-${option}`}
                            type="radio"
                            name={`tech-overlay-${question.id}`}
                            value={normalizedOption}
                            checked={isSelected}
                            onChange={() =>
                              handleResponseChange(question.id, normalizedOption as "YES" | "NO" | "N/A")
                            }
                            disabled={isReadOnly || saving[question.id]}
                          />
                          <label
                            className="usa-radio__label"
                            htmlFor={`tech-overlay-${question.id}-${option}`}
                          >
                            {normalizedOption}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>

                {saving[question.id] && (
                  <p
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.75rem",
                      color: "#71767a",
                      fontStyle: "italic",
                    }}
                  >
                    Saving...
                  </p>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

