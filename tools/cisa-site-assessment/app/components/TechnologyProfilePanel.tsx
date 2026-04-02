"use client";

import { useState, useEffect } from "react";
import { getTechnologyTypes, type TechnologyType } from "@/app/lib/technology/technology_types";

interface TechnologyProfilePanelProps {
  assessmentId: string;
  assessmentInstanceId: string | null;
  disciplineSubtypeId: string;
  disciplineSubtypeName?: string;
  onUpdate?: () => void;
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function TechnologyProfilePanel({
  assessmentId,
  assessmentInstanceId,
  disciplineSubtypeId,
  disciplineSubtypeName,
  onUpdate,
}: TechnologyProfilePanelProps) {
  const [selectedTechCodes, setSelectedTechCodes] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTechTypes, setAvailableTechTypes] = useState<TechnologyType[]>([]);

  // Load available technology types
  useEffect(() => {
    const techTypes = getTechnologyTypes(null, disciplineSubtypeId);
    setAvailableTechTypes(techTypes);
  }, [disciplineSubtypeId]);

  // Load existing selections
  useEffect(() => {
    if (assessmentInstanceId) {
      loadSelections();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + ids only; loadSelections is stable
  }, [assessmentId, assessmentInstanceId, disciplineSubtypeId]);

  const loadSelections = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/technology-profiles`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to load technology profiles");
      }

      const data = await response.json();
      const subtypeSelections = (data.selections || []).filter(
        (s: Record<string, unknown>) => s.discipline_subtype_id === disciplineSubtypeId
      );

      setSelectedTechCodes(subtypeSelections.map((s: Record<string, unknown>) => String(s.technology_code ?? "")));
      // Use notes from first selection (if multiple, they should have same notes)
      if (subtypeSelections.length > 0) {
        setNotes(subtypeSelections[0].notes || "");
      }
      } catch (err: unknown) {
        console.error("Error loading technology profiles:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Debounced save
  const debouncedTechCodes = useDebounce(selectedTechCodes, 1000);
  const debouncedNotes = useDebounce(notes, 1000);

  useEffect(() => {
    if (!assessmentInstanceId || loading) return;

    const saveSelections = async () => {
      try {
        setSaving(true);
        setError(null);

        const response = await fetch(
          `/api/runtime/assessments/${assessmentId}/technology-profiles`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              discipline_subtype_id: disciplineSubtypeId,
              technology_codes: debouncedTechCodes,
              notes: debouncedNotes || undefined,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save technology profiles");
        }

        onUpdate?.();
      } catch (err: unknown) {
        console.error("Error saving technology profiles:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    };

    saveSelections();
  }, [debouncedTechCodes, debouncedNotes, assessmentId, assessmentInstanceId, disciplineSubtypeId, loading, onUpdate]);

  const handleTechTypeToggle = (techCode: string) => {
    setSelectedTechCodes((prev) => {
      if (prev.includes(techCode)) {
        return prev.filter((c) => c !== techCode);
      } else {
        return [...prev, techCode];
      }
    });
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-3 bg-gray-50 mb-4">
        <p className="text-sm text-gray-600">Loading technology profile...</p>
      </div>
    );
  }

  // Show message if no tech types available
  if (availableTechTypes.length === 0) {
    return (
      <div className="border rounded-lg p-3 bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 italic">
          No technology profile options for this subtype yet.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 mb-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          Technology Profile
          {disciplineSubtypeName && (
            <span className="text-gray-600 font-normal"> - {disciplineSubtypeName}</span>
          )}
        </h4>
        <p className="text-xs text-gray-500">
          Select technology types for this subtype. Multiple selections allowed for hybrid systems.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Technology Type Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Technology Types
        </label>
        <div className="flex flex-wrap gap-2">
          {availableTechTypes.map((techType) => {
            const isSelected = selectedTechCodes.includes(techType.code);
            return (
              <button
                key={techType.code}
                type="button"
                onClick={() => handleTechTypeToggle(techType.code)}
                disabled={saving}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }
                  ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {techType.label}
                {isSelected && <span className="ml-1.5">×</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes (Optional) */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={saving}
          placeholder="Optional notes about technology selection"
          rows={2}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
        />
      </div>

      {saving && (
        <div className="text-xs text-gray-500 italic">Saving...</div>
      )}
    </div>
  );
}

