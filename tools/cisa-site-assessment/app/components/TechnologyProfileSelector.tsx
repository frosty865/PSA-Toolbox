"use client";

import { useState, useEffect } from "react";

interface TechnologyProfile {
  id?: string;
  discipline_code: string;
  subtype_code: string;
  tech_family: string;
  tech_type: string;
  tech_variant?: string;
  evidence_basis?: string;
  notes?: string;
}

interface TechnologyProfileSelectorProps {
  assessmentId: string;
  disciplineCode: string;
  subtypeCode: string;
  subtypeName?: string;
  techFamily: string;
  onUpdate?: () => void;
}

// Evidence basis options (informational only)
const EVIDENCE_BASIS_OPTIONS = [
  { value: "DIRECT_OBSERVATION", label: "Direct Observation" },
  { value: "SYSTEM_DEMONSTRATION", label: "System Demonstration" },
  { value: "INTERFACE_EVIDENCE", label: "Interface Evidence" },
  { value: "DOCUMENTATION_REVIEWED", label: "Documentation Reviewed" },
  { value: "STAKEHOLDER_STATEMENT", label: "Stakeholder Statement" },
] as const;

interface TechTypeOption {
  value: string;
  label: string;
}

export default function TechnologyProfileSelector({
  assessmentId,
  disciplineCode,
  subtypeCode,
  subtypeName,
  techFamily,
  onUpdate,
}: TechnologyProfileSelectorProps) {
  const [profiles, setProfiles] = useState<TechnologyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedTechTypes, setAllowedTechTypes] = useState<TechTypeOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Load allowed tech types from catalog
  useEffect(() => {
    loadTechTypeCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when discipline/subtype change
  }, [disciplineCode, subtypeCode]);

  const loadTechTypeCatalog = async () => {
    try {
      setCatalogLoading(true);
      const response = await fetch("/api/runtime/technology-types-catalog", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load technology types catalog");
      }

      const catalog = await response.json();
      
      // Get tech types for this discipline and subtype
      const disciplineCatalog = catalog.catalog[disciplineCode];
      if (disciplineCatalog && disciplineCatalog[subtypeCode]) {
        setAllowedTechTypes(disciplineCatalog[subtypeCode]);
      } else {
        // No catalog entry for this subtype
        setAllowedTechTypes([]);
      }
    } catch (err: unknown) {
      console.error("Error loading tech type catalog:", err);
      setAllowedTechTypes([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Load existing profiles for this subtype
  useEffect(() => {
    if (!catalogLoading) {
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when catalog ready and ids change
  }, [assessmentId, subtypeCode, catalogLoading]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/tech-profiles`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to load technology profiles");
      }

      const data = await response.json();
      const subtypeProfiles = (data.profiles || []).filter(
        (p: TechnologyProfile) => p.subtype_code === subtypeCode
      );
      
      // Filter out invalid tech types (not in allowed list)
      const validProfiles = subtypeProfiles.filter((p: TechnologyProfile) =>
        allowedTechTypes.some((t) => t.value === p.tech_type)
      );
      
      setProfiles(validProfiles);
    } catch (err: unknown) {
      console.error("Error loading technology profiles:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleTechTypeToggle = async (techType: string) => {
    const existing = profiles.find((p) => p.tech_type === techType);
    
    if (existing) {
      // Remove tech type
      try {
        setSaving(true);
        const response = await fetch(
          `/api/runtime/assessments/${assessmentId}/tech-profiles?subtype_code=${subtypeCode}&tech_type=${techType}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          throw new Error("Failed to remove technology type");
        }

        setProfiles(profiles.filter((p) => p.tech_type !== techType));
        onUpdate?.();
      } catch (err: unknown) {
        console.error("Error removing technology type:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    } else {
      // Validate tech type is allowed
      if (!allowedTechTypes.some((t) => t.value === techType)) {
        setError(`Technology type ${techType} is not allowed for this subtype`);
        return;
      }

      // Add tech type
      const newProfile: TechnologyProfile = {
        discipline_code: disciplineCode,
        subtype_code: subtypeCode,
        tech_family: techFamily,
        tech_type: techType,
      };

      await saveProfiles([...profiles, newProfile]);
    }
  };

  const saveProfiles = async (newProfiles: TechnologyProfile[]) => {
    try {
      setSaving(true);
      setError(null);

      // Validate all tech types are allowed
      for (const profile of newProfiles) {
        if (!allowedTechTypes.some((t) => t.value === profile.tech_type)) {
          throw new Error(`Technology type ${profile.tech_type} is not allowed for this subtype`);
        }
      }

      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/tech-profiles`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profiles: newProfiles }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save technology profiles");
      }

      setProfiles(newProfiles);
      onUpdate?.();
    } catch (err: unknown) {
      console.error("Error saving technology profiles:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (techType: string, updates: Partial<TechnologyProfile>) => {
    const updated = profiles.map((p) =>
      p.tech_type === techType ? { ...p, ...updates } : p
    );
    saveProfiles(updated);
  };

  if (catalogLoading || loading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-sm text-gray-600">Loading technology profile...</p>
      </div>
    );
  }

  // Show message if no tech types available for this subtype
  if (allowedTechTypes.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-sm text-gray-600 italic">
          No technology profile options for this subtype yet.
        </p>
      </div>
    );
  }

  const selectedTechTypes = profiles.map((p) => p.tech_type);

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Technology Profile
          {subtypeName && (
            <span className="text-gray-600 font-normal"> - {subtypeName}</span>
          )}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Select technology types for this subtype. Multiple selections allowed for hybrid systems.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tech Type Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Technology Types
        </label>
        <div className="flex flex-wrap gap-2">
          {allowedTechTypes.map((type) => {
            const isSelected = selectedTechTypes.includes(type.value);
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTechTypeToggle(type.value)}
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
                {type.label}
                {isSelected && (
                  <span className="ml-1.5">×</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Tech Types Details */}
      {profiles.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          {profiles.map((profile) => (
            <div
              key={profile.tech_type}
              className="bg-white rounded p-3 border border-gray-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  {allowedTechTypes.find((t) => t.value === profile.tech_type)?.label ||
                    profile.tech_type}
                </span>
              </div>

              {/* Evidence Basis (Optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Basis for Technology Selection (Optional)
                </label>
                <select
                  value={profile.evidence_basis || ""}
                  onChange={(e) =>
                    updateProfile(profile.tech_type, {
                      evidence_basis: e.target.value || undefined,
                    })
                  }
                  disabled={saving}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                >
                  <option value="">-- Select basis (optional) --</option>
                  {EVIDENCE_BASIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tech Variant (Optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Variant (Optional)
                </label>
                <input
                  type="text"
                  value={profile.tech_variant || ""}
                  onChange={(e) =>
                    updateProfile(profile.tech_type, { tech_variant: e.target.value })
                  }
                  disabled={saving}
                  placeholder="e.g., 'coax + DVR', 'ONVIF VMS'"
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                />
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={profile.notes || ""}
                  onChange={(e) =>
                    updateProfile(profile.tech_type, { notes: e.target.value })
                  }
                  disabled={saving}
                  placeholder="Short notes (non-implementation)"
                  rows={2}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {saving && (
        <div className="text-xs text-gray-500 italic">Saving...</div>
      )}
    </div>
  );
}
