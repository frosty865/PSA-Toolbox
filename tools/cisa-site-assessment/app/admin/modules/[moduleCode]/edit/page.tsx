"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { validateModuleJson, type ValidationIssue } from "@/app/lib/admin/module_json_validator";

export default function AdminModuleEditPage() {
  const params = useParams();
  const moduleCode = params.moduleCode as string;
  const [jsonText, setJsonText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    loadModuleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when moduleCode changes
  }, [moduleCode]);

  async function loadModuleData() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/export`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error || "Failed to load module data");
        return;
      }
      const data = await r.json();
      setJsonText(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load module data");
    } finally {
      setLoading(false);
    }
  }

  // Real-time validation
  useMemo(() => {
    if (!jsonText.trim()) {
      setValidationIssues([]);
      return null;
    }
    try {
      const obj = JSON.parse(jsonText);
      const result = validateModuleJson(obj, false);
      setValidationIssues(result.issues);
      return result;
    } catch {
      setValidationIssues([]);
      return null;
    }
  }, [jsonText]);

  const handleAutoFix = () => {
    if (!jsonText.trim()) return;
    
    try {
      const obj = JSON.parse(jsonText);
      const result = validateModuleJson(obj, true);
      
      if (result.correctedJson) {
        setJsonText(JSON.stringify(result.correctedJson, null, 2));
        const newResult = validateModuleJson(result.correctedJson, false);
        setValidationIssues(newResult.issues);
      }
    } catch {
      setError("Failed to auto-fix JSON. Please fix errors manually.");
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const obj = JSON.parse(jsonText);
      
      // Ensure module_code matches
      if (obj.module_code !== moduleCode) {
        setError(`Module code mismatch. Expected "${moduleCode}", got "${obj.module_code}"`);
        setSaving(false);
        return;
      }

      // Ensure mode is REPLACE for edits
      obj.mode = "REPLACE";

      const r = await fetch("/api/admin/modules/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(obj),
      });

      const data = await r.json().catch(() => ({}));
      
      if (!r.ok || !data?.ok) {
        const errorMsg = data?.error || "Import failed";
        if (data?.linter_errors && Array.isArray(data.linter_errors) && data.linter_errors.length > 0) {
          const linterErrorsText = data.linter_errors.slice(0, 5).join("\n");
          const moreErrors = data.linter_errors.length > 5 ? `\n... and ${data.linter_errors.length - 5} more errors` : "";
          setError(`${errorMsg}\n\nValidation Errors:\n${linterErrorsText}${moreErrors}`);
        } else {
          setError(errorMsg);
        }
        setSaving(false);
        return;
      }

      setSuccess("Module updated successfully!");
      setTimeout(() => {
        window.location.href = `/admin/modules/${encodeURIComponent(moduleCode)}`;
      }, 1500);
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : "Unknown error";
      setError(`Invalid JSON: ${msg}`);
      setSaving(false);
    }
  };

  const hasAutoFixableIssues = validationIssues.some(i => i.autoFixable && i.level === "error");
  const hasErrors = validationIssues.some(i => i.level === "error");

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Loading module data...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/admin/modules/${encodeURIComponent(moduleCode)}`} style={{ color: "#0066cc" }}>
          ← Back to Module Details
        </Link>
      </div>

      <h1>Edit Module: {moduleCode}</h1>
      <p style={{ color: "#666", marginTop: 8 }}>
        Edit the module JSON below. Changes will replace all existing module content when saved.
      </p>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: 4,
            color: "#c00",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: "#efe",
            border: "1px solid #cfc",
            borderRadius: 4,
            color: "#060",
          }}
        >
          <strong>Success:</strong> {success}
        </div>
      )}

      {validationIssues.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: `1px solid ${hasErrors ? "#fcc" : "#ffc107"}`,
            borderRadius: 4,
            backgroundColor: hasErrors ? "#fee" : "#fff3cd",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: hasErrors ? "#c00" : "#856404" }}>
              {hasErrors ? "❌ Validation Errors" : "⚠️ Validation Warnings"}
            </h3>
            {hasAutoFixableIssues && (
              <button
                type="button"
                onClick={handleAutoFix}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                🔧 Auto-Fix Issues
              </button>
            )}
          </div>
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {validationIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 12,
                  padding: 8,
                  backgroundColor: "white",
                  borderRadius: 4,
                  borderLeft: `3px solid ${issue.level === "error" ? "#dc3545" : issue.level === "warning" ? "#ffc107" : "#17a2b8"}`
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  [{issue.field}] {issue.message}
                </div>
                {issue.suggestion && (
                  <div style={{ fontSize: "13px", color: "#666", marginTop: 4 }}>
                    💡 {issue.suggestion}
                  </div>
                )}
                {issue.autoFixable && (
                  <div style={{ fontSize: "12px", color: "#28a745", marginTop: 4 }}>
                    ✓ Auto-fixable
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Module JSON:
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          style={{
            width: "100%",
            minHeight: "600px",
            padding: 12,
            fontFamily: "monospace",
            fontSize: "13px",
            border: "1px solid #ddd",
            borderRadius: 4,
            lineHeight: 1.5,
          }}
          spellCheck={false}
        />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={!jsonText.trim() || saving || hasErrors}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: hasErrors ? "#ccc" : "#0066cc",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: saving || !jsonText.trim() || hasErrors ? "not-allowed" : "pointer",
            opacity: saving || !jsonText.trim() || hasErrors ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {hasErrors && (
          <span style={{ color: "#c00", fontSize: "14px" }}>
            Fix validation errors before saving
          </span>
        )}
        <Link
          href={`/admin/modules/${encodeURIComponent(moduleCode)}`}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#6c757d",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            display: "inline-block",
          }}
        >
          Cancel
        </Link>
      </div>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: "#e7f3ff", border: "1px solid #b3d9ff", borderRadius: 4 }}>
        <strong>💡 Tip:</strong> The JSON is validated in real-time as you type. Use the &quot;Auto-Fix Issues&quot; button to automatically correct common mistakes.
      </div>
    </div>
  );
}
