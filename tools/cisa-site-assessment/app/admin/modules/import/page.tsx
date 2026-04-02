"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { validateModuleJson, type ValidationIssue } from "@/app/lib/admin/module_json_validator";

export default function AdminModuleImportPage() {
  // Suppress browser extension errors (React DevTools, Redux DevTools, etc.)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || '';
      if (
        errorMessage.includes('message channel') ||
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('channel closed')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason || '';
      if (
        errorMessage.includes('message channel') ||
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('channel closed')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };
    
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection, true);
    
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection, true);
    };
  }, []);

  const [jsonText, setJsonText] = useState<string>("");
  const [preview, setPreview] = useState<{ module_code?: string; title?: string; module_questions: number; module_ofcs: number; sources: number; risk_drivers: number } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [_showAutoFix, setShowAutoFix] = useState(false);
  void _showAutoFix;

  function buildPreview(raw: Record<string, unknown> | null): { module_code?: string; title?: string; module_questions: number; module_ofcs: number; sources: number; risk_drivers: number } {
    const moduleQuestions = Array.isArray(raw?.module_questions) ? raw.module_questions.length : 0;
    const moduleOFCs = Array.isArray(raw?.module_ofcs) ? raw.module_ofcs.length : 0;
    const riskDrivers = Array.isArray(raw?.risk_drivers) ? raw.risk_drivers.length : 0;
    let sources = 0;
    if (Array.isArray(raw?.module_ofcs)) {
      for (const o of raw.module_ofcs) {
        sources += Array.isArray((o as Record<string, unknown>)?.sources) ? ((o as Record<string, unknown>).sources as unknown[]).length : 0;
      }
    }
    return {
      module_code: raw?.module_code != null ? String(raw.module_code) : undefined,
      title: raw?.title != null ? String(raw.title) : undefined,
      module_questions: moduleQuestions,
      module_ofcs: moduleOFCs,
      sources,
      risk_drivers: riskDrivers,
    };
  }

  /** Payload from /admin/modules/import/builder via "Open in Import page". */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("psa_module_import_builder_json");
      if (!raw?.trim()) return;
      setJsonText(raw);
      try {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        setPreview(buildPreview(obj));
      } catch {
        setPreview(null);
      }
      sessionStorage.removeItem("psa_module_import_builder_json");
    } catch {
      /* ignore */
    }
  }, []);

  // Real-time validation
  useMemo(() => {
    if (!jsonText.trim()) {
      setValidationIssues([]);
      return null;
    }
    try {
      const obj = JSON.parse(jsonText);
      const res = validateModuleJson(obj, false);
      setValidationIssues(res.issues);
      return res;
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
        setShowAutoFix(false);
        // Re-validate after auto-fix
        const newResult = validateModuleJson(result.correctedJson, false);
        setValidationIssues(newResult.issues);
      }
    } catch {
      setError("Failed to auto-fix JSON. Please fix errors manually.");
    }
  };

  const hasAutoFixableIssues = validationIssues.some(i => i.autoFixable && i.level === "error");

  function onLoadFile(file: File) {
    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || "");
      setJsonText(txt);
      try {
        const obj = JSON.parse(txt);
        setPreview(buildPreview(obj));
      } catch {
        setPreview(null);
        setError("Invalid JSON");
      }
    };
    reader.readAsText(file);
  }

  async function onImport() {
    setError("");
    setResult(null);
    setLoading(true);
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      setError("Invalid JSON");
      setLoading(false);
      return;
    }

    try {
      const r = await fetch("/api/admin/modules/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(obj),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        const errorMsg = data?.error || "Import failed";
        // Include linter errors in the error message if present
        if (data?.linter_errors && Array.isArray(data.linter_errors) && data.linter_errors.length > 0) {
          const linterErrorsText = data.linter_errors.slice(0, 5).join("\n");
          const moreErrors = data.linter_errors.length > 5 ? `\n... and ${data.linter_errors.length - 5} more errors` : "";
          setError(`${errorMsg}\n\nValidation Errors:\n${linterErrorsText}${moreErrors}`);
        } else {
          setError(errorMsg);
        }
        setResult(data); // Include linter_errors if present
        return;
      }
      setResult((data.result ?? data) as Record<string, unknown>);
      setError(""); // Clear any previous errors on success
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/modules" style={{ color: "#0066cc" }}>
          ← Back to Modules
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Import Module</h1>
          <p style={{ color: "#666", marginTop: 8, marginBottom: 0 }}>
            Import a module definition including metadata, module-specific questions, and module-specific OFCs.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/admin/modules/import/builder"
            style={{
              padding: "8px 16px",
              backgroundColor: "#1a4480",
              color: "white",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: "14px",
              whiteSpace: "nowrap",
            }}
          >
            JSON builder
          </Link>
          <Link
            href="/admin/modules/import/help"
            style={{
              padding: "8px 16px",
              backgroundColor: "#0066cc",
              color: "white",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: "14px",
              whiteSpace: "nowrap",
            }}
          >
            📚 View Help Guide
          </Link>
        </div>
      </div>
      
      <div style={{ 
        marginTop: 16, 
        padding: 12, 
        backgroundColor: "#fff3cd", 
        border: "1px solid #ffc107", 
        borderRadius: 4,
        fontSize: "14px"
      }}>
        <strong>⚠️ Quick Reference:</strong> Module questions must use <code>MODULEQ_*</code> IDs, 
        OFCs must use <code>MOD_OFC_*</code> IDs. All questions require discipline_id, discipline_subtype_id, 
        asset_or_location, and event_trigger. See{" "}
        <Link href="/admin/modules/import/help" style={{ color: "#0066cc", textDecoration: "underline" }}>
          Help Guide
        </Link>
        {" "}for complete requirements.
      </div>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Upload JSON File
        </label>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadFile(f);
          }}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Or Paste JSON
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => {
            const text = e.target.value;
            setJsonText(text);
            
            if (!text.trim()) {
              setPreview(null);
              setError("");
              return;
            }
            
            try {
              const obj = JSON.parse(text);
              setPreview(buildPreview(obj));
              setError(""); // Clear JSON parse errors, validation issues shown separately
            } catch (parseError: unknown) {
              setPreview(null);
              const err = parseError instanceof Error ? parseError : new Error(String(parseError));
              const errorMsg = err.message || "Invalid JSON syntax";
              const position = err.message?.match(/position (\d+)/)?.[1];
              setError(`JSON Syntax Error: ${errorMsg}${position ? ` (at position ${position})` : ""}`);
            }
          }}
          rows={18}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "13px",
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
          placeholder='{"module_code": "MODULE_EV_CHARGING", "title": "...", "module_questions": [...], "module_ofcs": [...]}'
        />
      </div>

      {validationIssues.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: `1px solid ${validationIssues.some(i => i.level === "error") ? "#fcc" : "#ffc107"}`,
            borderRadius: 4,
            backgroundColor: validationIssues.some(i => i.level === "error") ? "#fee" : "#fff3cd",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: validationIssues.some(i => i.level === "error") ? "#c00" : "#856404" }}>
              {validationIssues.some(i => i.level === "error") ? "❌ Validation Errors" : "⚠️ Validation Warnings"}
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

      {preview && validationIssues.length === 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #cfc",
            borderRadius: 4,
            backgroundColor: "#efe",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: "20px", marginRight: 8 }}>✅</span>
            <h3 style={{ margin: 0, color: "#060" }}>JSON Valid</h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <strong>module_code:</strong> {preview.module_code}
            </div>
            <div>
              <strong>title:</strong> {preview.title}
            </div>
            <div>
              <strong>module_questions:</strong> {preview.module_questions}
            </div>
            <div>
              <strong>module_ofcs:</strong> {preview.module_ofcs}
            </div>
            <div>
              <strong>sources:</strong> {preview.sources}
            </div>
            {preview.risk_drivers > 0 && (
              <div>
                <strong>risk_drivers:</strong> {preview.risk_drivers} (context only)
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: 4,
            color: "crimson",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Import Failed</div>
          <div style={{ marginBottom: 8 }}>{error}</div>
          {!!(result?.linter_errors && Array.isArray(result.linter_errors) && (result.linter_errors as unknown[]).length > 0) ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Validation Errors:</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {(result.linter_errors as unknown[]).slice(0, 10).map((err: unknown, idx: number) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{String(err)}</li>
                ))}
                {(result.linter_errors as unknown[]).length > 10 && (
                  <li style={{ color: "#999", fontStyle: "italic" }}>
                    ... and {(result.linter_errors as unknown[]).length - 10} more errors
                  </li>
                )}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: "#efe",
            border: "1px solid #cfc",
            borderRadius: 4,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12, color: "#060" }}>
            ✅ Import Successful
          </h3>
          <div style={{ marginBottom: 12 }}>
            <strong>Module Code:</strong> {String(result.module_code ?? "")}
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong>Module Questions:</strong> {Number(result.module_questions_imported ?? result.questions ?? 0)}
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong>Module OFCs:</strong> {Number(result.module_ofcs_imported ?? result.ofcs ?? 0)}
          </div>
          {result.sources_imported !== undefined && (
            <>
              <div style={{ marginBottom: 12 }}>
                <strong>Sources Imported:</strong> {String(result.sources_imported)}
              </div>
              {result.sources_registered !== undefined && (
                <div style={{ marginBottom: 12 }}>
                  <strong>Sources Registered:</strong> {String(result.sources_registered)}
                </div>
              )}
              {(result.sources_skipped != null && Number(result.sources_skipped) > 0) && (
                <div style={{ marginBottom: 12, opacity: 0.7 }}>
                  <strong>Sources Skipped (duplicates):</strong> {String(result.sources_skipped)}
                </div>
              )}
            </>
          )}
          {(result.risk_drivers_imported != null && Number(result.risk_drivers_imported) > 0) && (
            <div style={{ marginBottom: 12 }}>
              <strong>Risk Drivers:</strong> {String(result.risk_drivers_imported)} (context only)
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Link
              href={`/admin/modules/${encodeURIComponent(String(result.module_code ?? ""))}`}
              style={{
                display: "inline-block",
                padding: "8px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                textDecoration: "none",
                borderRadius: 4,
              }}
            >
              View Module Details →
            </Link>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={onImport}
          disabled={!jsonText.trim() || loading || validationIssues.some(i => i.level === "error")}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: validationIssues.some(i => i.level === "error") ? "#ccc" : "#0066cc",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading || !jsonText.trim() || validationIssues.some(i => i.level === "error") ? "not-allowed" : "pointer",
            opacity: loading || !jsonText.trim() || validationIssues.some(i => i.level === "error") ? 0.6 : 1,
          }}
        >
          {loading ? "Importing..." : "Import Module"}
        </button>
        {validationIssues.some(i => i.level === "error") && (
          <span style={{ color: "#c00", fontSize: "14px" }}>
            Fix validation errors before importing
          </span>
        )}
      </div>
    </div>
  );
}
