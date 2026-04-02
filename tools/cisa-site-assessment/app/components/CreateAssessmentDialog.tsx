"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getGoogleMapsApiKey } from "@/app/lib/env";

declare global {
  interface Window {
    google?: {
      maps?: {
        event?: { clearInstanceListeners?: (instance: unknown) => void };
        places?: {
          Autocomplete: new (
            element: HTMLInputElement,
            options: { types: string[]; fields: string[] }
          ) => {
            addListener: (eventName: string, cb: () => void) => void;
            getPlace: () => {
              geometry?: {
                location?: {
                  lat: (() => number) | number;
                  lng: (() => number) | number;
                };
              };
              address_components?: Array<{ types: string[]; long_name: string; short_name: string }>;
            };
          };
        };
      };
    };
    initGoogleMaps?: () => void;
  }
}

type SubsectorField = {
  key: string;
  type: "checkbox" | "select" | "number" | "text";
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

type SubsectorSchema = {
  allowed_modules?: string[];
  fields?: SubsectorField[];
};

type Metadata = {
  sectors: { sector_code: string; label: string }[];
  subsectors: { subsector_code: string; sector_code: string; label: string }[];
  modules: { module_code: string; label: string }[];
  subsectorSchemas: Record<string, SubsectorSchema>;
};

function toInputValue(value: unknown): string | number {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

interface CreateAssessmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (assessmentId: string, instanceId: string) => void;
}

export default function CreateAssessmentDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateAssessmentDialogProps) {
  const [meta, setMeta] = useState<Metadata | null>(null);

  const [step, setStep] = useState(1);
  const [assessmentName, setAssessmentName] = useState("");

  const [facility, setFacility] = useState({
    facility_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    latitude: "",
    longitude: "",
    poc_name: "",
    poc_email: "",
    poc_phone: ""
  });

  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<unknown>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const [sectorCode, setSectorCode] = useState("");
  const [subsectorCode, setSubsectorCode] = useState("");
  const [subsectorDetails, setSubsectorDetails] = useState<Record<string, unknown>>({});
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps API
  useEffect(() => {
    if (isOpen && !googleLoaded) {
      // Import from centralized env utility
      const apiKey = getGoogleMapsApiKey();
      // Debug: log the key (first 10 chars only for security)
      if (apiKey) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Google Maps] API key found: ${apiKey.substring(0, 10)}...`);
        }
      } else {
        // Only warn once per page load (module-level flag)
        const win = window as Window & { __googleMapsApiKeyWarned?: boolean };
        if (!win.__googleMapsApiKeyWarned) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Google Maps API key not found. Address autocomplete will not work.");
            console.warn("Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in .env.local and the server has been restarted.");
          }
          win.__googleMapsApiKeyWarned = true;
        }
        return;
      }

      if (window.google && window.google.maps) {
        setGoogleLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      
      window.initGoogleMaps = () => {
        setGoogleLoaded(true);
      };

      document.head.appendChild(script);

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        delete (window as Window & { initGoogleMaps?: () => void }).initGoogleMaps;
      };
    }
  }, [isOpen, googleLoaded]);

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!isOpen) {
      // Clean up autocomplete when dialog closes
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      return;
    }

    if (googleLoaded && addressInputRef.current && !autocompleteRef.current && window.google?.maps?.places?.Autocomplete) {
      const AutocompleteCtor = window.google.maps.places.Autocomplete;
      const autocomplete = new AutocompleteCtor(
        addressInputRef.current,
        {
          types: ['address'],
          fields: ['address_components', 'geometry', 'formatted_address']
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        console.log('Place selected:', place);
        
        if (!place.geometry) {
          console.warn('Place has no geometry');
          return;
        }

        // Extract address components
        const addressComponents: Record<string, string> = {};
        place.address_components?.forEach((component: { types: string[]; long_name: string; short_name: string }) => {
          const types = component.types;
          if (types.includes('street_number')) {
            addressComponents.street_number = component.long_name;
          } else if (types.includes('route')) {
            addressComponents.route = component.long_name;
          } else if (types.includes('locality')) {
            addressComponents.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            addressComponents.state = component.short_name;
          } else if (types.includes('postal_code')) {
            addressComponents.postal_code = component.long_name;
          }
        });

        const streetNumber = addressComponents.street_number || '';
        const route = addressComponents.route || '';
        const addressLine1 = `${streetNumber} ${route}`.trim();

        // Get coordinates - handle both old and new API formats
        let lat: number;
        let lng: number;
        
        if (place.geometry.location) {
          // New API: location is a LatLng object
          const latRaw = place.geometry.location.lat;
          const lngRaw = place.geometry.location.lng;
          if (typeof latRaw === 'function' && typeof lngRaw === 'function') {
            lat = latRaw();
            lng = lngRaw();
          } else {
            // Old API: location has lat/lng properties
            lat = Number(latRaw);
            lng = Number(lngRaw);
          }
        } else {
          console.warn('Place has no location in geometry');
          return;
        }

        console.log('Coordinates:', { lat, lng });

        // Update facility with address and coordinates
        setFacility(prev => ({
          ...prev,
          address_line1: addressLine1,
          city: addressComponents.city || '',
          state: addressComponents.state || '',
          postal_code: addressComponents.postal_code || '',
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
      });

      autocompleteRef.current = autocomplete;
    }
  }, [googleLoaded, isOpen]);

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const response = await fetch("/api/runtime/metadata", { cache: "no-store" });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('[CreateAssessmentDialog] API Error Response:', errorData);
            setError(`Database error: ${errorData.message || errorData.error || 'Failed to fetch metadata'}`);
            return;
          }
          
          const r = await response.json();
          console.log('[CreateAssessmentDialog] Received metadata:', {
            sectorsCount: r?.sectors?.length,
            sectors: r?.sectors,
            subsectorsCount: r?.subsectors?.length,
            subsectors: r?.subsectors
          });
          
          // Log debug information if available
          if (r?._debug) {
            console.log('[CreateAssessmentDialog] API Debug Info:', r._debug);
            if (r._debug.database) {
              console.log('[CreateAssessmentDialog] Database Info:', r._debug.database);
            }
            if (r._debug.sectorsRaw) {
              console.log('[CreateAssessmentDialog] Raw sectors from DB:', r._debug.sectorsRaw);
            }
            if (r._debug.subsectorsRaw) {
              console.log('[CreateAssessmentDialog] Raw subsectors from DB:', r._debug.subsectorsRaw);
            }
          }
          
          setMeta(r);
          // default sector if only one
          if (r?.sectors?.length === 1) setSectorCode(r.sectors[0].sector_code);
        } catch (err) {
          console.error("Failed to load metadata:", err);
          setError(`Failed to load metadata: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      })();
    }
  }, [isOpen]);

  const availableSubsectors = useMemo(() => {
    if (!meta) return [];
    return meta.subsectors.filter(s => !sectorCode || s.sector_code === sectorCode);
  }, [meta, sectorCode]);

  const schema = useMemo(() => {
    if (!meta || !subsectorCode) return null;
    return (meta.subsectorSchemas?.[subsectorCode] ?? null) as SubsectorSchema | null;
  }, [meta, subsectorCode]);

  const allowedModules = useMemo(() => {
    if (!meta) return [];
      if (!schema?.allowed_modules) return meta.modules; // If no restrictions, show all
      const allow = new Set(schema.allowed_modules);
      return meta.modules.filter(m => allow.has(m.module_code));
  }, [meta, schema]);

  function toggleModule(code: string) {
    setModules(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  }

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const templateId = `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const body = {
        assessment_name: assessmentName,
        sector_code: sectorCode,
        subsector_code: subsectorCode,
        facility: {
          facility_name: facility.facility_name,
          address_line1: facility.address_line1 || undefined,
          address_line2: facility.address_line2 || undefined,
          city: facility.city || undefined,
          state: facility.state || undefined,
          postal_code: facility.postal_code || undefined,
          latitude: facility.latitude ? Number(facility.latitude) : undefined,
          longitude: facility.longitude ? Number(facility.longitude) : undefined,
          poc_name: facility.poc_name || undefined,
          poc_email: facility.poc_email || undefined,
          poc_phone: facility.poc_phone || undefined
        },
        subsector_details: subsectorDetails,
        modules,
        template: {
          id: templateId,
          name: assessmentName?.trim() || 'Untitled Template',
          description: null
        }
      };

      const res = await fetch("/api/runtime/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { _parseError: true, _preview: text?.slice(0, 300) || "(empty)" };
      }

      if (!res.ok) {
        const hasDetails = json && typeof json === "object" && "error" in json;
        console.error(
          "[CreateAssessmentDialog] API Error Response:",
          hasDetails ? json : { status: res.status, statusText: res.statusText, body: json._parseError ? json._preview : json }
        );

        let errorMessage: string;
        if (json?.error && typeof json.error === "string") {
          const error = json.error.toLowerCase();
          if (error.includes("sector") || error.includes("subsector")) {
            errorMessage = "Please select a valid sector and subsector from the dropdown menus.";
          } else if (error.includes("facility") || error.includes("address")) {
            errorMessage = "Please enter a facility name and complete address information.";
          } else if (error.includes("name") || error.includes("assessment_name")) {
            errorMessage = "Please enter an assessment name.";
          } else if (error.includes("validation") || error.includes("required")) {
            errorMessage = "Please complete all required fields before creating the assessment.";
          } else {
            errorMessage = json.error;
          }
        } else if (res.status === 400) {
          errorMessage = "Please check your input and try again. All required fields must be completed.";
        } else if (res.status === 500) {
          errorMessage = "A server error occurred. Please try again in a moment. If the problem persists, contact support.";
        } else if (!hasDetails && (json._parseError || Object.keys(json).length === 0)) {
          errorMessage = `Server error (${res.status} ${res.statusText}). No error details were returned. Check the browser console and server logs.`;
        } else {
          errorMessage = `Unable to create assessment (Error ${res.status}). Please try again.`;
        }

        throw new Error(errorMessage);
      }

      const aid = (json as Record<string, unknown>).assessment_id;
      const iid = (json as Record<string, unknown>).assessment_instance_id;
      if (aid && iid) {
        onCreated(String(aid), String(iid));
        onClose();
      } else {
        throw new Error("Server did not return assessment_id or assessment_instance_id.");
      }
    } catch (e: unknown) {
      console.error("[CreateAssessmentDialog] Error creating assessment:", e);
      setError(e instanceof Error ? e.message : "Unknown error occurred");
    } finally {
      setSaving(false);
    }
  }

  function canNext() {
    if (step === 1) {
      return assessmentName.trim().length > 0 && 
             facility.facility_name.trim().length > 0 &&
             facility.poc_name.trim().length > 0 &&
             facility.poc_email.trim().length > 0 &&
             facility.poc_phone.trim().length > 0;
    }
    if (step === 2) return !!sectorCode && !!subsectorCode;
    return true;
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "0.5rem",
          maxWidth: "680px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "18px", fontWeight: 700 }}>
          Create New Assessment
        </h2>
        
        {error && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #d13212",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
              color: "#d13212",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#71767a" }}>
          Step {step} of 4
        </div>

        {step === 1 && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Assessment Name *</div>
              <input
                value={assessmentName}
                onChange={e => setAssessmentName(e.target.value)}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                placeholder="Enter assessment name"
              />
            </label>

            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Facility Name *</div>
              <input
                value={facility.facility_name}
                onChange={e => setFacility(v => ({ ...v, facility_name: e.target.value }))}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                placeholder="Enter facility name"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Address Line 1</div>
              <input
                ref={addressInputRef}
                value={facility.address_line1}
                onChange={e => {
                  // Allow manual typing but don't interfere with autocomplete selection
                  setFacility(v => ({ ...v, address_line1: e.target.value }));
                }}
                placeholder="Start typing address (Google autocomplete)"
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                autoComplete="off"
              />
              {!googleLoaded && (
                <div style={{ fontSize: "0.75rem", color: "#71767a", marginTop: "0.25rem" }}>
                  Google Maps API key not configured. Address autocomplete unavailable.
                </div>
              )}
            </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Address Line 2</div>
                <input
                  value={facility.address_line2}
                  onChange={e => setFacility(v => ({ ...v, address_line2: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: "1rem" }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>City</div>
                <input
                  value={facility.city}
                  onChange={e => setFacility(v => ({ ...v, city: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>State</div>
                <input
                  value={facility.state}
                  onChange={e => setFacility(v => ({ ...v, state: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>ZIP</div>
                <input
                  value={facility.postal_code}
                  onChange={e => setFacility(v => ({ ...v, postal_code: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Latitude (auto-filled)</div>
                <input
                  type="number"
                  step="any"
                  value={facility.latitude}
                  readOnly
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem", backgroundColor: "#f3f4f6" }}
                />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Longitude (auto-filled)</div>
                <input
                  type="number"
                  step="any"
                  value={facility.longitude}
                  readOnly
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem", backgroundColor: "#f3f4f6" }}
                />
              </label>
            </div>
            {facility.latitude && facility.longitude && (
              <div style={{ fontSize: "0.75rem", color: "#005ea2", marginTop: "-0.5rem" }}>
                ✓ Coordinates auto-populated from address
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>POC Name *</div>
                <input
                  value={facility.poc_name}
                  onChange={e => setFacility(v => ({ ...v, poc_name: e.target.value }))}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>POC Email *</div>
                <input
                  type="email"
                  value={facility.poc_email}
                  onChange={e => setFacility(v => ({ ...v, poc_email: e.target.value }))}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                />
              </label>
            </div>

            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>POC Phone *</div>
              <input
                type="tel"
                value={facility.poc_phone}
                onChange={e => setFacility(v => ({ ...v, poc_phone: e.target.value }))}
                required
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Sector *</div>
              <select
                value={sectorCode}
                onChange={e => {
                  setSectorCode(e.target.value);
                  setSubsectorCode("");
                  setSubsectorDetails({});
                  setModules([]);
                }}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
              >
                <option value="">Select…</option>
                {meta?.sectors?.map(s => (
                  <option key={s.sector_code} value={s.sector_code}>{s.label}</option>
                ))}
              </select>
            </label>

            <label>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Subsector *</div>
              <select
                value={subsectorCode}
                onChange={e => {
                  setSubsectorCode(e.target.value);
                  setSubsectorDetails({});
                  setModules([]);
                }}
                disabled={!sectorCode}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
              >
                <option value="">Select…</option>
                {availableSubsectors.map(s => (
                  <option key={s.subsector_code} value={s.subsector_code}>{s.label}</option>
                ))}
              </select>
            </label>

            <div style={{ fontSize: "0.875rem", color: "#71767a" }}>
              Only subsector-relevant fields will appear on the next step.
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Subsector Details</div>
            {!schema ? (
              <div style={{ opacity: 0.75 }}>No additional fields defined for this subsector.</div>
            ) : (
              (schema.fields ?? []).map((f) => {
                const v = subsectorDetails?.[f.key];
                if (f.type === "checkbox") {
                  return (
                    <label key={f.key} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!v}
                        onChange={e => setSubsectorDetails(p => ({ ...p, [f.key]: e.target.checked }))}
                      />
                      <span><b>{f.label}</b>{f.required ? " *" : ""}</span>
                    </label>
                  );
                }
                if (f.type === "select") {
                  return (
                    <label key={f.key}>
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{f.label}{f.required ? " *" : ""}</div>
                      <select
                        value={toInputValue(v)}
                        onChange={e => setSubsectorDetails(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                      >
                        <option value="">Select…</option>
                        {(f.options ?? []).map((o: { value: string; label: string }) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (f.type === "number") {
                  return (
                    <label key={f.key}>
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{f.label}{f.required ? " *" : ""}</div>
                      <input
                        type="number"
                        value={toInputValue(v)}
                        onChange={e => setSubsectorDetails(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                      />
                    </label>
                  );
                }
                return (
                  <label key={f.key}>
                    <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{f.label}{f.required ? " *" : ""}</div>
                    <input
                      value={toInputValue(v)}
                      onChange={e => setSubsectorDetails(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "0.75rem", border: "1px solid #dfe1e2", borderRadius: "0.25rem" }}
                    />
                  </label>
                );
              })
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Optional Modules (Additive Only)</div>
            {allowedModules.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No modules available for this subsector.</div>
            ) : (
              allowedModules.map(m => (
                <label key={m.module_code} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={modules.includes(m.module_code)}
                    onChange={() => toggleModule(m.module_code)}
                  />
                  <span>{m.label}</span>
                </label>
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#f3f4f6",
              border: "1px solid #dfe1e2",
              borderRadius: "0.25rem",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || saving}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#f3f4f6",
                border: "1px solid #dfe1e2",
                borderRadius: "0.25rem",
                cursor: (step === 1 || saving) ? "not-allowed" : "pointer",
              }}
            >
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext() || saving}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: !canNext() || saving ? "#9ca3af" : "#005ea2",
                  color: "white",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor: (!canNext() || saving) ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={create}
                disabled={saving || !canNext()}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: saving || !canNext() ? "#9ca3af" : "#005ea2",
                  color: "white",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor: (saving || !canNext()) ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {saving ? "Creating…" : "Create Assessment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
