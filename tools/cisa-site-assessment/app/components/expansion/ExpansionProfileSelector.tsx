"use client";

import { useState, useEffect } from "react";

interface ExpansionProfile {
  profile_id: string;
  sector: string;
  subsector: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  description?: string;
}

interface AppliedProfile {
  profile_id: string;
  sector: string;
  subsector: string;
  version: number;
  applied_at: string;
}

interface ExpansionProfileSelectorProps {
  assessmentId: string;
  onProfilesChanged?: () => void;
}

export default function ExpansionProfileSelector({
  assessmentId,
  onProfilesChanged
}: ExpansionProfileSelectorProps) {
  const [availableProfiles, setAvailableProfiles] = useState<ExpansionProfile[]>([]);
  const [appliedProfiles, setAppliedProfiles] = useState<AppliedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + assessmentId only
  }, [assessmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch available profiles (ACTIVE only)
      const profilesResponse = await fetch('/api/runtime/expansion-profiles?status=ACTIVE');
      if (profilesResponse.ok) {
        const profiles = await profilesResponse.json();
        setAvailableProfiles(profiles);
      }

      // Fetch applied profiles
      const appliedResponse = await fetch(`/api/runtime/assessments/${assessmentId}/expansion-profiles`);
      if (appliedResponse.ok) {
        const applied = await appliedResponse.json();
        setAppliedProfiles(applied);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyProfiles = async (profileIds: string[]) => {
    try {
      setApplying(true);
      setError(null);

      const response = await fetch(`/api/runtime/assessments/${assessmentId}/expansion-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_ids: profileIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply profiles');
      }

      await fetchData();
      if (onProfilesChanged) {
        onProfilesChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply profiles');
    } finally {
      setApplying(false);
    }
  };

  const handleRemoveProfile = async (profileId: string) => {
    void profileId;
    // Note: This would require a DELETE endpoint, which we can add if needed
    alert('Profile removal not yet implemented. Use the API directly if needed.');
  };

  if (loading) {
    return <div>Loading profiles...</div>;
  }

  const appliedProfileIds = new Set(appliedProfiles.map(p => p.profile_id));
  const unappliedProfiles = availableProfiles.filter(p => !appliedProfileIds.has(p.profile_id));

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginBottom: "1rem" }}>Sector / Context-Specific Considerations</h3>
      <p style={{ fontSize: "0.875rem", color: "#71767a", marginBottom: "1rem" }}>
        Apply expansion profiles to add sector/subsector-specific questions beyond the baseline.
        Expansion questions are separate from baseline and do not affect baseline scoring.
      </p>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Applied Profiles */}
      {appliedProfiles.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Applied Profiles:</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {appliedProfiles.map((profile) => (
              <span
                key={profile.profile_id}
                style={{
                  padding: "0.25rem 0.75rem",
                  backgroundColor: "#005ea2",
                  color: "white",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                {profile.profile_id} (v{profile.version})
                <button
                  onClick={() => handleRemoveProfile(profile.profile_id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    padding: 0,
                    marginLeft: "0.25rem"
                  }}
                  title="Remove profile"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Available Profiles Selector */}
      {unappliedProfiles.length > 0 && (
        <div>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Available Profiles:</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {unappliedProfiles.map((profile) => (
              <div
                key={profile.profile_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem",
                  border: "1px solid #d3d3d3",
                  borderRadius: "0.25rem"
                }}
              >
                <div>
                  <strong>{profile.profile_id}</strong>
                  <div style={{ fontSize: "0.875rem", color: "#71767a" }}>
                    {profile.sector} / {profile.subsector} (v{profile.version})
                    {profile.description && ` - ${profile.description}`}
                  </div>
                </div>
                <button
                  onClick={() => handleApplyProfiles([profile.profile_id])}
                  disabled={applying}
                  className="btn btn-sm btn-primary"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {appliedProfiles.length === 0 && unappliedProfiles.length === 0 && (
        <p style={{ color: "#71767a", fontStyle: "italic" }}>
          No profiles available. Create profiles in the Admin section.
        </p>
      )}
    </div>
  );
}

