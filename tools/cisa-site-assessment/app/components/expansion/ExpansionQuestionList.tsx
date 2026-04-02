"use client";

import { useState, useEffect } from "react";

interface ExpansionQuestion {
  question_id: string;
  profile_id: string;
  subtype_code: string;
  question_text: string;
  response_enum: string[];
  introduced_version: number;
}

interface ExpansionQuestionListProps {
  assessmentId: string;
  onResponseChange?: () => void;
}

export default function ExpansionQuestionList({
  assessmentId,
  onResponseChange
}: ExpansionQuestionListProps) {
  const [questions, setQuestions] = useState<ExpansionQuestion[]>([]);
  const [responses, setResponses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + assessmentId only
  }, [assessmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch questions
      const questionsResponse = await fetch(`/api/runtime/assessments/${assessmentId}/expansion-questions`);
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        setQuestions(questionsData);
      }

      // Fetch responses
      const responsesResponse = await fetch(`/api/runtime/assessments/${assessmentId}/expansion-responses`);
      if (responsesResponse.ok) {
        const responsesData = await responsesResponse.json();
        const responseMap = new Map<string, string>();
        for (const r of responsesData) {
          responseMap.set(r.question_id, r.response);
        }
        setResponses(responseMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expansion questions');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = async (questionId: string, response: string) => {
    const newResponses = new Map(responses);
    newResponses.set(questionId, response);
    setResponses(newResponses);

    // Autosave
    await saveResponse(questionId, response);
  };

  const saveResponse = async (questionId: string, response: string) => {
    try {
      setSaving(true);
      setError(null);

      const saveResponse = await fetch(`/api/runtime/assessments/${assessmentId}/expansion-responses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: [{ question_id: questionId, response }]
        })
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.message || 'Failed to save response');
      }

      if (onResponseChange) {
        onResponseChange();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save response');
      // Revert on error
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading expansion questions...</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Expansion Questions</h3>
        <p style={{ color: "#71767a", fontStyle: "italic" }}>
          No expansion questions available. Apply expansion profiles to see sector/subsector-specific questions.
        </p>
      </div>
    );
  }

  // Group questions by profile and subtype
  const questionsByProfile = new Map<string, Map<string, ExpansionQuestion[]>>();
  for (const question of questions) {
    if (!questionsByProfile.has(question.profile_id)) {
      questionsByProfile.set(question.profile_id, new Map());
    }
    const bySubtype = questionsByProfile.get(question.profile_id)!;
    if (!bySubtype.has(question.subtype_code)) {
      bySubtype.set(question.subtype_code, []);
    }
    bySubtype.get(question.subtype_code)!.push(question);
  }

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginBottom: "1rem" }}>Expansion Questions</h3>
      <p style={{ fontSize: "0.875rem", color: "#71767a", marginBottom: "1rem" }}>
        These questions are separate from baseline and do not affect baseline scoring.
      </p>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {saving && (
        <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
          Saving...
        </div>
      )}

      {Array.from(questionsByProfile.entries()).map(([profileId, bySubtype]) => (
        <div key={profileId} style={{ marginBottom: "2rem" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "#005ea2" }}>
            Profile: {profileId}
          </h4>
          {Array.from(bySubtype.entries()).map(([subtypeCode, subtypeQuestions]) => (
            <div key={subtypeCode} style={{ marginBottom: "1.5rem", marginLeft: "1rem" }}>
              <h5 style={{ fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                {subtypeCode}
              </h5>
              {subtypeQuestions.map((question) => (
                <div
                  key={question.question_id}
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    border: "1px solid #d3d3d3",
                    borderRadius: "0.25rem",
                    backgroundColor: "#f9f9f9"
                  }}
                >
                  <div style={{ marginBottom: "0.5rem", fontWeight: "500" }}>
                    {question.question_text}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    {question.response_enum.map((option) => (
                      <label
                        key={option}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="radio"
                          name={question.question_id}
                          value={option}
                          checked={responses.get(question.question_id) === option}
                          onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

