"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

/** Only log planPreview.capabilities[0] once per page load when ?debugPlan is in the URL. */
let __loggedPlanPreviewOnce = false;

interface DisciplineWithSubtypes {
  id: string;
  name?: string;
  discipline_subtypes?: Array<{ id: string; name?: string; is_active?: boolean }>;
}

interface ModuleSourceRow {
  id: string;
  source_type?: string;
  source_url?: string;
  source_label?: string;
  [key: string]: unknown;
}

interface VofcRow {
  id?: string;
  citations?: Array<{ id?: string; source_key?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Matches GET /api/admin/modules/[moduleCode] response (minus error). */
interface ModuleDetailData {
  module: {
    module_code?: string;
    module_name?: string;
    description?: string;
    status?: string;
    standard_class?: string;
    [key: string]: unknown;
  };
  module_questions?: Record<string, unknown>[];
  module_ofcs?: Record<string, unknown>[];
  risk_drivers?: Record<string, unknown>[];
  module_instance?: { id: string; standard_key: string; standard_version: string; [key: string]: unknown } | null;
  module_instance_criteria?: Record<string, unknown>[];
  module_instance_ofcs?: Record<string, unknown>[];
  module_instance_checklist_groups?: Record<string, unknown>[];
  module_instance_checklist_items?: Record<string, unknown>[];
  chunk_count?: number;
  standard_class?: string;
  [key: string]: unknown;
}

interface SourcesDataSummary {
  total_sources?: number;
  total_linked_documents?: number;
  total_linked_chunks?: number;
}

interface ModuleSourceReportData {
  report_date: string;
  module: { module_code: string; title: string | null; summary: string | null };
  summary: {
    statistics: {
      total_sources?: number;
      by_type?: Record<string, number>;
      by_status?: Record<string, number>;
      total_linked_documents?: number;
      total_linked_chunks?: number;
      sources_with_documents?: number;
      sources_without_documents?: number;
    };
    issues_count: {
      missing_files: number;
      failed_downloads: number;
      sources_without_documents: number;
      missing_labels: number;
    };
  };
  sources: Array<{
    id: string;
    source_type?: string;
    source_label?: string;
    source_url?: string;
    linked_documents_count?: number;
    file_exists?: boolean | null;
    fetch_status?: string | null;
    fetch_error?: string | null;
  }>;
  issues: {
    missing_files: Array<{ id: string; source_label?: string; storage_relpath?: string }>;
    failed_downloads: Array<{ id: string; source_label?: string; fetch_error?: string | null }>;
    sources_without_documents: Array<{ id: string; source_label?: string }>;
    missing_labels: Array<{ id: string; source_label?: string }>;
  };
}

export default function AdminModuleDetailPage() {
  const params = useParams();
  const moduleCode = params.moduleCode as string;
  const [data, setData] = useState<ModuleDetailData | null>(null);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "sources" | "comprehension" | "standard" | "vofcs" | "review">("overview");
  const [sourcesData, setSourcesData] = useState<{ sources?: ModuleSourceRow[]; summary?: SourcesDataSummary } | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourceReportData, setSourceReportData] = useState<ModuleSourceReportData | null>(null);
  const [sourceReportLoading, setSourceReportLoading] = useState(false);
  const [sourceReportError, setSourceReportError] = useState<string | null>(null);
  const [showAddQ, setShowAddQ] = useState(false);
  const [showAddO, setShowAddO] = useState(false);
  const [disciplines, setDisciplines] = useState<DisciplineWithSubtypes[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addApiError, setAddApiError] = useState<{ message: string; code?: string; request_id?: string; details?: unknown } | null>(null);
  const [addQForm, setAddQForm] = useState<{ question_text: string; discipline_id: string; discipline_subtype_id: string; asset_or_location: string; event_trigger: "OTHER" | "FIRE" | "TAMPERING" | "IMPACT" | "OUTAGE" }>({ question_text: "", discipline_id: "", discipline_subtype_id: "", asset_or_location: "", event_trigger: "OTHER" });
  const [addOForm, setAddOForm] = useState({ discipline_id: "", discipline_subtype_id: "", source_url: "", source_label: "" });
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [registerRegisteringId, setRegisterRegisteringId] = useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [showAttachCorpus, setShowAttachCorpus] = useState(false);
  const [attachSourceTab, setAttachSourceTab] = useState<"module" | "corpus" | "pending">("module");
  const [pendingSources, setPendingSources] = useState<Array<{ id: string; label: string; sha256: string; status: string }>>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [assignPendingId, setAssignPendingId] = useState<string | null>(null);
  const [showUploadModule, setShowUploadModule] = useState(false);
  const [showAddFromUrl, setShowAddFromUrl] = useState(false);
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null);
  const [movingToPendingId, setMovingToPendingId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");
  const [savingLabel, setSavingLabel] = useState(false);
  const [corpusPickerSources, setCorpusPickerSources] = useState<Array<{ id: string; source_key: string; publisher?: string; title?: string }>>([]);
  const [corpusPickerLoading, setCorpusPickerLoading] = useState(false);
  const [registrySourcesForModule, setRegistrySourcesForModule] = useState<Array<{ id: string; source_key: string; title?: string; publisher?: string; scope_tags?: string[] }>>([]);
  const [registrySourcesForModuleLoading, setRegistrySourcesForModuleLoading] = useState(false);
  const [attachCorpusSaving, setAttachCorpusSaving] = useState(false);
  const [uploadModuleSaving, setUploadModuleSaving] = useState(false);
  const [addFromUrlSaving, setAddFromUrlSaving] = useState(false);
  const [addFromUrlUrl, setAddFromUrlUrl] = useState("");
  const [addFromUrlLabel, setAddFromUrlLabel] = useState("");
  const [processIncomingRunning, setProcessIncomingRunning] = useState(false);
  // Standard Class (structure only: Measures vs Plan). Topic = module_code/title.
  const STANDARD_CLASS_OPTIONS = [
    { value: "PHYSICAL_SECURITY_MEASURES", label: "Physical Security Measures (Object)" },
    { value: "PHYSICAL_SECURITY_PLAN", label: "Physical Security Plan (Plan)" },
  ] as const;
  const [selectedStandardKey, setSelectedStandardKey] = useState<string>("PHYSICAL_SECURITY_MEASURES");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future standard detail UI
  const [standardDetail, setStandardDetail] = useState<{ standard: { standard_key: string; name: string; description: string; version: string } } | null>(null);
  const [generatePreview, setGeneratePreview] = useState<{
    criteria: Array<{ criterion_key: string; title: string; question_text: string; applicability: string }>;
    ofcs: Array<{ criterion_key: string; template_key: string; ofc_text: string; ofc_reason?: string }>;
    missingOfcCitations?: string[];
    validForPersist?: boolean;
    /** PLAN mode: checklist at top level (canonical); prefer over planPreview.checklist_items */
    checklist_items?: Array<{ id: string; text: string; subitems?: string[] }>;
    /** PLAN mode: resolved plan type */
    plan_type?: string;
    preflight?: {
      source_count: number;
      usable_source_count: number;
      chunk_count: number;
      sources_used: Array<{ source_id: string; label: string; type: string; contributed_chunks: number }>;
    };
    planPreview?: {
      gate_question?: { id: string; text: string; response_type?: string };
      checklist_items?: Array<{ id: string; text: string; subitems?: string[] }>;
      /** PLAN capabilities (section-derived) or standards-style criteria with required_elements */
      capabilities: Array<
        | { criterion_key: string; title: string; capability_state: string; rollup_status?: string; applicable_count?: number; checked_count?: number; required_elements?: unknown }
        | { id: string; text: string; capability_title?: string; capability_statement?: string; source_id?: string; source_label?: string | null; locator_type?: string; locator: string; vital_elements?: Array<{ vital_title: string; locator?: string }> }
      >;
      groups: Array<{ criterion_key: string; group_key: string; title: string }>;
      items: Array<{ criterion_key: string; group_key: string; item_key: string; text: string; rationale: string; checked: boolean; is_na: boolean; order_index: number; ofcs?: Array<{ criterion_key: string; template_key: string; ofc_text: string; ofc_reason?: string }> }>;
      ofcs: Array<{ criterion_key: string; template_key: string; ofc_text: string; ofc_reason?: string }>;
    };
  } | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateDryRun, setGenerateDryRun] = useState(true);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [generateHint, setGenerateHint] = useState<string | null>(null);
  const [generateFailureReason, setGenerateFailureReason] = useState<string | null>(null);
  const [generatePreflight, setGeneratePreflight] = useState<{
    source_count: number;
    usable_source_count: number;
    chunk_count: number;
    sources_used: Array<{ source_id: string; label: string; type: string; contributed_chunks: number }>;
    plan_schema_id?: string;
    plan_schema_derive_method?: string;
    plan_schema_confidence?: string;
    plan_schema_sections_count?: number;
    plan_schema_elements_count?: number;
    plan_schema_missing?: boolean;
  } | null>(null);
  const [generateViolations, setGenerateViolations] = useState<{
    violated_rule_ids: string[];
    samples: string[] | unknown[];
    rule_descriptions: Record<string, string>;
  } | null>(null);
  const [generateCriteriaErrors, setGenerateCriteriaErrors] = useState<string[] | null>(null);
  const [generateFailures, setGenerateFailures] = useState<Array<{ rule: string; index: number; text: string }> | null>(null);
  const [generateRewrites, setGenerateRewrites] = useState<Array<{ from: string; to: string }> | null>(null);
  const [generateOfcErrors, setGenerateOfcErrors] = useState<string[] | null>(null);
  const [standardLoadErr, setStandardLoadErr] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter reserved for future use
  const [standardLoadHint, setStandardLoadHint] = useState<string | null>(null);
  const [deriveSchemaLoading, setDeriveSchemaLoading] = useState(false);
  const [deriveSchemaErr, setDeriveSchemaErr] = useState<string | null>(null);
  const [deriveSchemaResult, setDeriveSchemaResult] = useState<{
    section_count: number;
    element_count: number;
    section_titles: string[];
    idempotent?: boolean;
    used_force?: boolean;
    schema_version?: number;
    trust_mode?: string;
    engine_used?: string;
    sections_count?: number;
    elements_count?: number;
    structure_source_title?: string | null;
    structure_source_options?: Array<{ source_registry_id: string; title: string }>;
  } | null>(null);
  const [planStructureTrust, setPlanStructureTrust] = useState<"INFERRED" | "BALANCED" | "TOC">("BALANCED");
  const [planSchemaEngine, setPlanSchemaEngine] = useState<"auto" | "legacy">("auto");
  const [structureSourceRegistryId, setStructureSourceRegistryId] = useState<string | null>(null);
  const [structureSourceOptions, setStructureSourceOptions] = useState<Array<{ source_registry_id: string; title: string }>>([]);
  const [planSchemaStatus, setPlanSchemaStatus] = useState<{
    active: boolean;
    plan_schema_id?: string;
    structure_source_registry_id?: string | null;
    structure_source_title?: string | null;
    derive_method?: string;
    confidence?: string;
    sections_count?: number;
    elements_count?: number;
    plan_schema_engine?: string;
    /** Stored schema snapshot; single source of truth for rendering sections/elements. */
    schema_json?: { sections?: Array<{ section_key: string; section_title: string; section_ord: number; elements?: Array<{ element_key: string; element_label: string; element_ord: number }> }> } | null;
  } | null>(null);
  const [planSchemaStatusLoading, setPlanSchemaStatusLoading] = useState(false);
  // Module VOFCs tab
  const [vofcsData, setVofcsData] = useState<{ count: number; rows: VofcRow[] } | null>(null);
  const [vofcsLoading, setVofcsLoading] = useState(false);
  // Review & Edit tab (doctrine instance only): local edits before PATCH
  const [reviewCriteriaEdits, setReviewCriteriaEdits] = useState<Record<string, { question_text: string; title: string }>>({});
  const [reviewOfcsEdits, setReviewOfcsEdits] = useState<Record<string, string>>({});
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSaveMessage, setReviewSaveMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  // Comprehension tab (diagnostic only)
  const [comprehensionSummary, setComprehensionSummary] = useState<{
    status: "present" | "missing";
    comprehension_rows: number;
    last_updated_at: string | null;
    model_used_distribution?: Record<string, number>;
    by_priority: { "0": number; "1": number; "2": number; "3": number };
    supports_qg_true: number;
    life_safety_hist: { "0": number; "1": number };
    ops_hist: { "0": number; "1": number };
    cyber_awareness_hist: { "0": number; "1": number };
    top_topics: Array<{ topic: string; count: number }>;
    top_domains: Array<{ domain: string; count: number }>;
    sample_chunks: Array<{ chunk_id: string; locator: string; excerpt: string; generation_priority: string | null; implied_risks: string[]; explicit_topics: string[] }>;
  } | null>(null);
  const [comprehensionLoading, setComprehensionLoading] = useState(false);
  const [comprehensionSynopsis, setComprehensionSynopsis] = useState<string | null>(null);
  const [comprehensionSynopsisLoading, setComprehensionSynopsisLoading] = useState(false);
  const [comprehensionBuildRunning, setComprehensionBuildRunning] = useState(false);
  const [lastBuildEffectiveModel, setLastBuildEffectiveModel] = useState<string | null>(null);

  const loadData = async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error || "Failed to load module");
        return;
      }
      setData(j as ModuleDetailData);
      if (j?.module_ofcs?.length) {
        try {
          const rr = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/ofcs/registrations`);
          const reg = await rr.json().catch(() => ({}));
          if (rr.ok && Array.isArray(reg.registered_module_ofc_ids)) setRegisteredIds(reg.registered_module_ofc_ids);
          else setRegisteredIds([]);
        } catch {
          setRegisteredIds([]);
        }
      } else {
        setRegisteredIds([]);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load module");
    }
  };

  const loadComprehension = async () => {
    setComprehensionLoading(true);
    setComprehensionSummary(null);
    try {
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/comprehension/summary`);
      const j = await r.json().catch(() => ({}));
      if (r.ok) setComprehensionSummary(j);
      else setComprehensionSummary({ status: "missing", comprehension_rows: 0, last_updated_at: null, by_priority: { "0": 0, "1": 0, "2": 0, "3": 0 }, supports_qg_true: 0, life_safety_hist: { "0": 0, "1": 0 }, ops_hist: { "0": 0, "1": 0 }, cyber_awareness_hist: { "0": 0, "1": 0 }, top_topics: [], top_domains: [], sample_chunks: [] });
    } catch {
      setComprehensionSummary(null);
    } finally {
      setComprehensionLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when moduleCode changes
  }, [moduleCode]);

  useEffect(() => {
    if (!registerMessage) return;
    const t = setTimeout(() => setRegisterMessage(null), 3000);
    return () => clearTimeout(t);
  }, [registerMessage]);

  // When Review tab is active and we have instance data, init edit state from data if not yet set
  useEffect(() => {
    if (activeTab !== "review" || !data?.module_instance) return;
    const crit = (data.module_instance_criteria || []) as Array<{ id: string; question_text?: string; title?: string }>;
    const ofcs = (data.module_instance_ofcs || []) as Array<{ id: string; ofc_text?: string }>;
    if (crit.length > 0 && Object.keys(reviewCriteriaEdits).length === 0) {
      setReviewCriteriaEdits(Object.fromEntries(crit.map((c) => [c.id, { question_text: c.question_text ?? "", title: c.title ?? "" }])));
      setReviewOfcsEdits(Object.fromEntries(ofcs.map((o) => [o.id, o.ofc_text ?? ""])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init edit state from instance data once
  }, [activeTab, data?.module_instance, data?.module_instance_criteria, data?.module_instance_ofcs]);

  // When data loads, sync selected Standard Class from instance or module.standard_class
  useEffect(() => {
    if (!data?.module_instance && data?.standard_class == null) return;
    const fromInstance = data.module_instance?.standard_key;
    const fromModule = data.standard_class;
    const want = (fromInstance ?? fromModule ?? "PHYSICAL_SECURITY_MEASURES") as string;
    const valid = STANDARD_CLASS_OPTIONS.some((o) => o.value === want);
    if (valid) setSelectedStandardKey(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when instance/standard_class changes only
  }, [data?.module_instance?.standard_key, data?.standard_class]);

  const fetchPlanSchemaStatus = React.useCallback(async () => {
    if (!moduleCode?.trim()) return;
    setPlanSchemaStatusLoading(true);
    try {
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/plan-schema`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j != null) {
        setPlanSchemaStatus({
          active: j.active === true,
          plan_schema_id: j.plan_schema_id,
          structure_source_registry_id: j.structure_source_registry_id ?? null,
          structure_source_title: j.structure_source_title ?? null,
          derive_method: j.derive_method,
          confidence: j.confidence,
          sections_count: typeof j.sections_count === "number" ? j.sections_count : 0,
          elements_count: typeof j.elements_count === "number" ? j.elements_count : 0,
          plan_schema_engine: j.plan_schema_engine,
          schema_json: j.schema_json ?? null,
        });
      } else {
        setPlanSchemaStatus(null);
      }
    } catch {
      setPlanSchemaStatus(null);
    } finally {
      setPlanSchemaStatusLoading(false);
    }
  }, [moduleCode]);

  useEffect(() => {
    if (selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" || !moduleCode?.trim()) return;
    fetchPlanSchemaStatus();
  }, [selectedStandardKey, moduleCode, fetchPlanSchemaStatus]);

  const loadSources = async () => {
    if (!moduleCode?.trim()) return;
    setSourcesLoading(true);
    try {
      const r = await fetch(
        `/api/admin/modules/${encodeURIComponent(moduleCode)}/sources`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("Failed to load sources:", j?.error);
        setSourcesData({ sources: [], summary: { total_sources: 0, total_linked_documents: 0, total_linked_chunks: 0 } });
        return;
      }
      setSourcesData(j);
    } catch (e: unknown) {
      console.error("Failed to load sources:", e);
      setSourcesData({ sources: [], summary: { total_sources: 0, total_linked_documents: 0, total_linked_chunks: 0 } });
    } finally {
      setSourcesLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 24, color: "crimson" }}>
        <div>{err}</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/admin/modules" style={{ color: "#0066cc" }}>
            ← Back to Modules
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24 }}>
        <div>No data</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/modules" style={{ color: "#0066cc" }}>
          ← Back to Modules
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>{data.module.module_name}</h1>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            <code>{data.module.module_code}</code>
            {data.module.status && (
              <span
                style={{
                  marginLeft: 12,
                  padding: "4px 12px",
                  borderRadius: 3,
                  backgroundColor: data.module.status === "DRAFT" ? "#fff3cd" : "#d1ecf1",
                  color: data.module.status === "DRAFT" ? "#856404" : "#0c5460",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {data.module.status}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              try {
                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/export`);
                if (!r.ok) {
                  alert("Failed to export module");
                  return;
                }
                const data = await r.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${moduleCode}_export.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (e: unknown) {
                alert(`Failed to export: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 4,
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            📥 Export JSON
          </button>
          <Link
            href={`/admin/modules/${encodeURIComponent(moduleCode)}/edit`}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0066cc",
              color: "white",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            ✏️ Edit Module
          </Link>
        </div>
      </div>
      {data.module.description && (
        <p style={{ marginTop: 12, color: "#666" }}>
          {data.module.description}
        </p>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "14px", color: "#555" }}>
        <span><strong>Questions:</strong> {data.module_questions?.length ?? 0}</span>
        <span><strong>OFCs:</strong> {data.module_ofcs?.length ?? 0}</span>
        <span><strong># Chunks (ingested):</strong> {typeof data.chunk_count === "number" ? data.chunk_count : "—"}</span>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 24, borderBottom: "1px solid #ddd" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid #0066cc" : "2px solid transparent",
            backgroundColor: "transparent",
            color: activeTab === "overview" ? "#0066cc" : "#666",
            cursor: "pointer",
            fontWeight: activeTab === "overview" ? 600 : 400,
            fontSize: "14px",
          }}
        >
          Overview
        </button>
        <button
          onClick={() => {
            setActiveTab("sources");
            if (!sourcesData && !sourcesLoading) {
              loadSources();
            }
          }}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom: activeTab === "sources" ? "2px solid #0066cc" : "2px solid transparent",
            backgroundColor: "transparent",
            color: activeTab === "sources" ? "#0066cc" : "#666",
            cursor: "pointer",
            fontWeight: activeTab === "sources" ? 600 : 400,
            fontSize: "14px",
          }}
        >
          Sources
        </button>
        <button
          onClick={() => {
            setActiveTab("comprehension");
            if (!comprehensionSummary && !comprehensionLoading) loadComprehension();
          }}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom: activeTab === "comprehension" ? "2px solid #0066cc" : "2px solid transparent",
            backgroundColor: "transparent",
            color: activeTab === "comprehension" ? "#0066cc" : "#666",
            cursor: "pointer",
            fontWeight: activeTab === "comprehension" ? 600 : 400,
            fontSize: "14px",
          }}
        >
          Comprehension
        </button>
        <button
          onClick={() => {
            setActiveTab("standard");
            setStandardLoadErr(null);
            // Sync Standard Class from instance or module.standard_class when opening tab
            const sk = (data?.module_instance?.standard_key || data?.standard_class || "PHYSICAL_SECURITY_MEASURES") as string;
            const isClass = STANDARD_CLASS_OPTIONS.some((o) => o.value === sk);
            if (isClass) setSelectedStandardKey(sk);
            if (sk) {
              fetch(`/api/admin/module-standards/${encodeURIComponent(sk)}`)
                .then((r) => r.json().catch(() => ({})))
                .then((j: { standard?: { standard_key: string; name: string; description: string; version: string }; error?: unknown }) => {
                  if (j?.standard) {
                    setStandardDetail({ standard: j.standard });
                    setStandardLoadErr(null);
                  } else if (j?.error !== undefined && j?.error !== null) {
                    setStandardDetail(null);
                    setStandardLoadErr(`${String(j.error)}. Run: node scripts/run_corpus_module_standards.js`);
                  } else {
                    setStandardDetail(null);
                    setStandardLoadErr(null);
                  }
                })
                .catch(() => {});
            }
          }}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom: activeTab === "standard" ? "2px solid #0066cc" : "2px solid transparent",
            backgroundColor: "transparent",
            color: activeTab === "standard" ? "#0066cc" : "#666",
            cursor: "pointer",
            fontWeight: activeTab === "standard" ? 600 : 400,
            fontSize: "14px",
          }}
        >
          Standard
        </button>
        {data.module_instance && (
          <button
            onClick={() => {
              setActiveTab("review");
              setReviewSaveMessage(null);
              const crit = (data.module_instance_criteria || []) as Array<{ id: string; question_text: string; title: string }>;
              const ofcs = (data.module_instance_ofcs || []) as Array<{ id: string; ofc_text: string }>;
              setReviewCriteriaEdits(
                Object.fromEntries(crit.map((c: Record<string, unknown>) => [c.id, { question_text: c.question_text || "", title: c.title || "" }]))
              );
              setReviewOfcsEdits(Object.fromEntries(ofcs.map((o: Record<string, unknown>) => [o.id, o.ofc_text || ""])));
            }}
            style={{
              padding: "12px 24px",
              border: "none",
              borderBottom: activeTab === "review" ? "2px solid #0066cc" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "review" ? "#0066cc" : "#666",
              cursor: "pointer",
              fontWeight: activeTab === "review" ? 600 : 400,
              fontSize: "14px",
            }}
          >
            Review & Edit
          </button>
        )}
        <button
          onClick={async () => {
            setActiveTab("vofcs");
            if (!vofcsData && !vofcsLoading) {
              setVofcsLoading(true);
              try {
                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/vofcs`);
                const j = await r.json().catch(() => ({}));
                if (r.ok) {
                  setVofcsData(j);
                } else {
                  console.error("Failed to load module VOFCs:", j?.error);
                  setVofcsData({ count: 0, rows: [] });
                }
              } catch (e: unknown) {
                console.error("Failed to load module VOFCs:", e);
                setVofcsData({ count: 0, rows: [] });
              } finally {
                setVofcsLoading(false);
              }
            }
          }}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom: activeTab === "vofcs" ? "2px solid #0066cc" : "2px solid transparent",
            backgroundColor: "transparent",
            color: activeTab === "vofcs" ? "#0066cc" : "#666",
            cursor: "pointer",
            fontWeight: activeTab === "vofcs" ? 600 : 400,
            fontSize: "14px",
          }}
        >
          Module VOFCs
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ marginTop: 24 }}>
          {/* Doctrine instance: Criteria + OFCs from standard (replaces ad‑hoc questions/OFCs) */}
          {data.module_instance && (
            <>
              <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 4, fontSize: "14px", color: "#2e7d32", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <span>
                  <strong>Doctrine instance:</strong> standard <code>{data.module_instance.standard_key}</code> v{data.module_instance.standard_version}. Criteria and OFCs are generated from the standard. Edit in the Standard tab.
                </span>
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={async () => {
                    if (!confirm("Reset this module? This will remove all criteria, OFCs, and checklist data. The module and its sources will remain. You can regenerate from the Standard tab.")) return;
                    setResetLoading(true);
                    setResetMessage(null);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/reset`, { method: "POST" });
                      const j = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        setResetMessage(j?.message || j?.error || "Reset failed");
                        return;
                      }
                      setResetMessage("Instance cleared. You can regenerate from the Standard tab.");
                      await loadData();
                    } catch (e: unknown) {
                      setResetMessage(e instanceof Error ? e.message : "Reset failed");
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                  style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: resetLoading ? "not-allowed" : "pointer", opacity: resetLoading ? 0.7 : 1 }}
                >
                  {resetLoading ? "Resetting…" : "Reset module"}
                </button>
              </div>
              {resetMessage && (
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: resetMessage.startsWith("Instance cleared") ? "#d4edda" : "#f8d7da", border: `1px solid ${resetMessage.startsWith("Instance cleared") ? "#c3e6cb" : "#f5c6cb"}`, borderRadius: 4, fontSize: "14px", color: resetMessage.startsWith("Instance cleared") ? "#155724" : "#721c24" }}>
                  {resetMessage}
                </div>
              )}
              {(data.module_instance_checklist_items?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 4, backgroundColor: "#f9fafb" }}>
                  {data.standard_class === "PHYSICAL_SECURITY_PLAN" ? (
                    <>
                      <h2 style={{ marginBottom: 8 }}>Plan Element Review</h2>
                      <p style={{ marginBottom: 12, fontSize: "14px", color: "#374151" }}>
                        This review identifies whether required plan elements are documented.
                        Findings are based solely on the presence or absence of written procedures.
                      </p>
                      <div style={{ marginBottom: 12 }}>
                        {(data.module_instance_checklist_items as Record<string, unknown>[])
                          ?.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) ?? 0) - (Number(b.order_index) ?? 0))
                          .map((item: Record<string, unknown>, i: number) => (
                            <div key={String(item.id)} style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600 }}>Section {i + 1}: {String(item.text ?? "")}</div>
                              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>This section reviews whether the plan documents the following required elements.</p>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 style={{ marginBottom: 8 }}>Does it include the following sections?</h2>
                      <p style={{ marginBottom: 12, fontSize: "14px", color: "#6b7280" }}>Checklist items ({data.module_instance_checklist_items?.length ?? 0})</p>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {(data.module_instance_checklist_items as Record<string, unknown>[])
                          ?.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) ?? 0) - (Number(b.order_index) ?? 0))
                          .map((item: Record<string, unknown>) => (
                            <li key={String(item.id)} style={{ marginBottom: 6, lineHeight: 1.5 }}>{String(item.text ?? "")}</li>
                          ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {(data.module_instance_checklist_groups?.length ?? 0) > 0 && (data.module_instance_checklist_items?.length ?? 0) > 0 ? (
                <>
                  <h2 style={{ marginBottom: 8 }}>{data.standard_class === "PHYSICAL_SECURITY_PLAN" ? "Required plan elements" : `PLAN capabilities (${data.module_instance_criteria?.length ?? 0})`}</h2>
                  {(data.module_instance_criteria as Record<string, unknown>[])
                    ?.filter((c: Record<string, unknown>) => c.criteria_type === "PLAN_CAPABILITY")
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0))
                    .map((c: Record<string, unknown>) => {
                      const group = (data.module_instance_checklist_groups as Record<string, unknown>[])?.find((g: Record<string, unknown>) => g.criterion_key === c.criterion_key);
                      const items = (data.module_instance_checklist_items as Record<string, unknown>[])?.filter((i: Record<string, unknown>) => group && i.group_id === group.id) ?? [];
                      const ofcsByItemId = (data.module_instance_ofcs as Record<string, unknown>[])?.reduce((acc: Record<string, Record<string, unknown>[]>, o: Record<string, unknown>) => {
                        const cid = o.checklist_item_id as string | undefined;
                        if (cid) { (acc[cid] = acc[cid] || []).push(o); }
                        return acc;
                      }, {}) ?? {};
                      return (
                        <div key={String(c.id)} style={{ marginBottom: 24, border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ padding: 12, backgroundColor: "#f5f5f5", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <strong>{String(c.title ?? "")}</strong>
                            <code style={{ fontSize: "12px" }}>{String(c.criterion_key ?? "")}</code>
                            {c.rollup_status != null && (
                              <span style={{ padding: "2px 8px", borderRadius: 3, fontSize: "12px", fontWeight: 600, backgroundColor: c.rollup_status === "COMPLETE" ? "#d4edda" : c.rollup_status === "ABSENT" ? "#f8d7da" : "#fff3cd", color: c.rollup_status === "COMPLETE" ? "#155724" : c.rollup_status === "ABSENT" ? "#721c24" : "#856404" }}>{String(c.rollup_status)}</span>
                            )}
                            {(c.applicable_count != null || c.checked_count != null) && (
                              <span style={{ fontSize: "13px", color: "#666" }}>{Number(c.checked_count) ?? 0} of {Number(c.applicable_count) ?? 0} elements present</span>
                            )}
                          </div>
                          <div style={{ padding: 12 }}>
                            {items.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0)).map((item: Record<string, unknown>) => (
                              <div key={String(item.id)} style={{ marginTop: 12, padding: 10, backgroundColor: item.checked ? "#f0f9f0" : "#fff9f0", borderLeft: "3px solid " + (item.checked ? "#28a745" : "#ffc107"), borderRadius: 4 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                  <span style={{ fontWeight: 600 }}>{item.checked ? "✓" : "○"}</span>
                                  <div>
                                    <div style={{ lineHeight: 1.5 }}>{String(item.text ?? "")}</div>
                                    <div style={{ marginTop: 6, fontSize: "13px", color: "#555", fontStyle: "italic" }}>{String(item.rationale ?? "")}</div>
                                    {!item.checked && !item.is_na && ((ofcsByItemId[String(item.id)]?.length ?? 0) > 0) && (
                                      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                                        {(ofcsByItemId[String(item.id)] ?? []).map((o: Record<string, unknown>) => (
                                          <li key={String(o.id)} style={{ marginTop: 4, lineHeight: 1.5 }}>
                                            {data.standard_class === "PHYSICAL_SECURITY_PLAN" && <span style={{ fontWeight: 600, display: "block", marginBottom: 2 }}>Documented Plan Element Missing</span>}
                                            {String(o.ofc_text ?? "")}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {data.standard_class === "PHYSICAL_SECURITY_PLAN" && (() => {
                      const items = (data.module_instance_checklist_items ?? []) as Array<Record<string, unknown>>;
                      const total = items.length;
                      const yesCount = items.filter((i) => i.checked === true).length;
                      const naCount = items.filter((i) => i.is_na === true).length;
                      const noCount = total - yesCount - naCount;
                      return (
                        <>
                          <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Plan Documentation Summary</div>
                            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#475569" }}>
                              This summary reflects the documented status of required plan elements at the time of review.
                              It does not evaluate plan quality, effectiveness, or implementation.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "14px" }}>
                              <span>Total Required Elements:</span><span>{total}</span>
                              <span>Elements Documented (Yes):</span><span>{yesCount}</span>
                              <span>Elements Not Documented (No):</span><span>{noCount}</span>
                              <span>Elements Not Applicable:</span><span>{naCount}</span>
                            </div>
                          </div>
                          <p style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                            This plan review is limited to the presence of documented elements.
                            Operational readiness, training effectiveness, and real-world performance are outside the scope of this review.
                          </p>
                        </>
                      );
                    })()}
                </>
              ) : (
                <>
                  <h2 style={{ marginBottom: 8 }}>Criteria ({data.module_instance_criteria?.filter((c: Record<string, unknown>) => c.applicability === "APPLIES").length || 0} applicable)</h2>
                  {(!data.module_instance_criteria || data.module_instance_criteria.length === 0) ? (
                    <div style={{ color: "#999", fontStyle: "italic" }}>No criteria.</div>
                  ) : (
                    <div style={{ overflowX: "auto", marginBottom: 24 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", borderRadius: 4 }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>#</th>
                            <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Key</th>
                            <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Question</th>
                            <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Applicability</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.module_instance_criteria
                            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0))
                            .map((c: Record<string, unknown>, idx: number) => (
                              <tr key={String(c.id)} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                                <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>{String(c.order_index ?? "")}</td>
                                <td style={{ padding: 12, borderBottom: "1px solid #eee" }}><code>{String(c.criterion_key ?? "")}</code></td>
                                <td style={{ padding: 12, borderBottom: "1px solid #eee", lineHeight: 1.6 }}>{String(c.question_text ?? "")}</td>
                                <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 3, backgroundColor: c.applicability === "N_A" ? "#fff3cd" : "#d1ecf1", color: c.applicability === "N_A" ? "#856404" : "#0c5460", fontSize: "12px", fontWeight: 600 }}>{String(c.applicability ?? "")}</span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <h2 style={{ marginBottom: 8 }}>OFCs (attach on NO) ({data.module_instance_ofcs?.length || 0})</h2>
                  {(!data.module_instance_ofcs || data.module_instance_ofcs.length === 0) ? (
                    <div style={{ color: "#999", fontStyle: "italic" }}>No OFCs.</div>
                  ) : (
                    <div style={{ border: "1px solid #ddd", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
                      {Object.entries(
                        (data.module_instance_ofcs as Record<string, unknown>[]).reduce((acc: Record<string, Record<string, unknown>[]>, o: Record<string, unknown>) => {
                          const k = String(o.criterion_key ?? "");
                          (acc[k] = acc[k] || []).push(o);
                          return acc;
                        }, {})
                      ).map(([ckey, arr]: [string, Record<string, unknown>[]]) => (
                        <div key={ckey} style={{ padding: 16, borderTop: "1px solid #eee", backgroundColor: "#fafafa" }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Criterion: <code>{ckey}</code></div>
                          {arr.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0)).map((o: Record<string, unknown>) => (
                            <div key={String(o.id)} style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid #0066cc" }}>
                              <div style={{ fontSize: "12px", color: "#666" }}>{String(o.template_key ?? "")}</div>
                              <div style={{ marginTop: 4, lineHeight: 1.6 }}>{String(o.ofc_text ?? "")}</div>
                              {Array.isArray(o.sources) && (o.sources as Record<string, unknown>[]).length > 0 && (
                                <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                                  {(o.sources as Record<string, unknown>[]).map((s: Record<string, unknown>, si: number) => (
                                    <li key={si}>
                                      {s.source_url ? <a href={String(s.source_url)} target="_blank" rel="noreferrer" style={{ color: "#0066cc" }}>{String(s.source_label || s.source_url || "—")}</a> : String(s.source_label || "—")}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Legacy: module_questions and module_ofcs when no doctrine instance */}
          {!data.module_instance && (
            <>
          {/* Draft State Banner */}
          {data.module.status === "DRAFT" && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: 4,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                ⚠️ Draft Module
              </div>
              <div style={{ marginBottom: 16 }}>
                This module has no imported content yet. Import module content to make it active.
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href="/admin/modules/import"
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#28a745",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: 4,
                  }}
                >
                  Import Module Content
                </Link>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `Are you sure you want to delete the draft module "${data.module.module_code}"? This action cannot be undone.`
                      )
                    ) {
                      return;
                    }
                    try {
                      const r = await fetch(
                        `/api/admin/modules/${encodeURIComponent(moduleCode)}`,
                        { method: "DELETE" }
                      );
                      if (r.ok) {
                        window.location.href = "/admin/modules";
                      } else {
                        const j = await r.json();
                        alert(j?.error || "Failed to delete module");
                      }
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Failed to delete module");
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Delete Draft Module
                </button>
              </div>
            </div>
          )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>
            Module Questions ({data.module_questions?.length || 0})
          </h2>
          <button
            onClick={async () => {
              setAddError(null); setAddApiError(null); setShowAddO(false); setShowAddQ(true);
              setAddQForm({ question_text: "", discipline_id: "", discipline_subtype_id: "", asset_or_location: "", event_trigger: "OTHER" });
              if (disciplines.length === 0) {
                try {
                  const r = await fetch("/api/reference/disciplines?active=true");
                  const j = await r.json().catch(() => ({}));
                  setDisciplines(j.disciplines || []);
                } catch { setDisciplines([]); }
              }
            }}
            style={{ padding: "6px 14px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            + Add question
          </button>
        </div>
        <div style={{ marginBottom: 8, color: "#666", fontSize: "14px" }}>
          <em>Module-specific questions (NOT baseline). These are answered only when the module is attached to an assessment. Add after reviewing sources.</em>
        </div>
        {!data.module_questions || data.module_questions.length === 0 ? (
          <div style={{ color: "#999", fontStyle: "italic" }}>
            No module questions defined for this module.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", borderRadius: 4 }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Order</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Question ID</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Question Text</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Discipline</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Subtype</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Asset/Location</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #ddd" }}>Event Trigger</th>
                </tr>
              </thead>
              <tbody>
                {data.module_questions.map((q: Record<string, unknown>, idx: number) => (
                  <tr
                    key={String(q.module_question_id ?? idx)}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                    }}
                  >
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>{String(q.order_index ?? "")}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                      <code style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: 3 }}>
                        {String(q.module_question_id ?? "")}
                      </code>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee", lineHeight: 1.6 }}>
                      {String(q.question_text ?? "")}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                      {String(q.discipline_name || q.discipline_code || "N/A")}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                      {String(q.discipline_subtype_name || q.discipline_subtype_code || "N/A")}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                      {String(q.asset_or_location || "N/A")}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 3,
                          backgroundColor: "#e7f3ff",
                          color: "#0066cc",
                          fontSize: "12px",
                        }}
                      >
                        {String(q.event_trigger || "N/A")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

          {/* Risk Drivers (Context Only) */}
          {data.risk_drivers && data.risk_drivers.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 16 }}>
            Risk Drivers ({data.risk_drivers.length}) - Context Only
          </h2>
          <div style={{ marginBottom: 8, color: "#666", fontSize: "14px" }}>
            <em>These cyber/fraud drivers are acknowledged as initiating causes with physical-security consequences. They are stored as context but do NOT become assessment requirements.</em>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
            {data.risk_drivers.map((driver: Record<string, unknown>, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  borderTop: idx > 0 ? "1px solid #eee" : "none",
                  backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>Type:</strong>{" "}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 3,
                      backgroundColor:
                        driver.driver_type === "CYBER_DRIVER" ? "#fff3cd" : "#d1ecf1",
                      color: driver.driver_type === "CYBER_DRIVER" ? "#856404" : "#0c5460",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {driver.driver_type === "CYBER_DRIVER" ? "Cyber Driver" : "Fraud Driver"}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Description:</strong> {String(driver.driver_text ?? "")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* Module OFCs */}
          <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>
            Module OFCs ({data.module_ofcs?.length || 0})
          </h2>
          <button
            onClick={async () => {
              setAddError(null); setAddApiError(null); setShowAddQ(false); setShowAddO(true);
              setAddOForm({ discipline_id: "", discipline_subtype_id: "", source_url: "", source_label: "" });
              if (disciplines.length === 0) {
                try {
                  const r = await fetch("/api/reference/disciplines?active=true");
                  const j = await r.json().catch(() => ({}));
                  setDisciplines(j.disciplines || []);
                } catch { setDisciplines([]); }
              }
              if (!sourcesData && !sourcesLoading) loadSources();
            }}
            style={{ padding: "6px 14px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            + Add OFC
          </button>
        </div>
        <div style={{ marginBottom: 8, color: "#666", fontSize: "14px" }}>
          <em>Module-specific OFCs (NOT baseline). These are displayed only when the module is attached to an assessment. Add after reviewing sources; you can link a source. Module OFCs can be registered into the global Module Data queue using the Register action (explicit, not automatic).</em>
        </div>
        {registerMessage && (
          <div style={{ marginBottom: 8, padding: "8px 12px", backgroundColor: "#d1ecf1", border: "1px solid #bee5eb", borderRadius: 4, fontSize: "14px", color: "#0c5460" }}>
            {registerMessage}
          </div>
        )}
        {!data.module_ofcs || data.module_ofcs.length === 0 ? (
          <div style={{ color: "#999", fontStyle: "italic" }}>
            No module OFCs defined for this module.
          </div>
        ) : (
          <div style={{ border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
            {data.module_ofcs.map((o: Record<string, unknown>, idx: number) => {
              const oId = String(o.id ?? "");
              return (
              <div
                key={oId}
                style={{
                  padding: 16,
                  borderTop: idx > 0 ? "1px solid #eee" : "none",
                  backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span>
                    <strong>
                      {o.ofc_num != null ? `${String(o.ofc_num)}.` : ""} {String(o.ofc_id ?? "")}
                    </strong>
                    {o.source_ofc_id != null && o.source_ofc_id !== "" ? (
                      <span style={{ marginLeft: 12, fontSize: "12px", color: "#666", fontWeight: "normal", fontStyle: "italic" }}>
                        (Source trace: {String(o.source_ofc_id)})
                      </span>
                    ) : null}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {registeredIds.includes(oId) ? (
                      <span style={{ padding: "2px 8px", borderRadius: 3, backgroundColor: "#d1ecf1", color: "#0c5460", fontSize: "12px", fontWeight: 600 }}>Registered</span>
                    ) : (
                      <button
                        type="button"
                        title="Creates a candidate entry in the global Module Data queue."
                        disabled={registerRegisteringId === oId}
                        onClick={async () => {
                          setRegisterRegisteringId(oId);
                          setRegisterMessage(null);
                          try {
                            const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/ofcs/${encodeURIComponent(oId)}/register`, { method: "POST" });
                            const j = await r.json().catch(() => ({})) as { status?: string };
                            const msg = j.status === "already_registered" ? "Already registered." : "Registered in Module Data queue.";
                            setRegisterMessage(msg);
                            setRegisteredIds((prev) => (prev.includes(oId) ? prev : [...prev, oId]));
                          } catch {
                            setRegisterMessage("Failed to register.");
                          } finally {
                            setRegisterRegisteringId(null);
                          }
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px", border: "1px solid #0066cc", backgroundColor: "transparent", color: "#0066cc", borderRadius: 4, cursor: registerRegisteringId === oId ? "not-allowed" : "pointer", opacity: registerRegisteringId === oId ? 0.6 : 1 }}
                      >
                        {registerRegisteringId === oId ? "Registering…" : "Register in Module Data queue"}
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                  {String(o.ofc_text ?? "")}
                </div>
                {Array.isArray(o.sources) && (o.sources as Record<string, unknown>[]).length > 0 ? (
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {(o.sources as Record<string, unknown>[]).map((s: Record<string, unknown>, sIdx: number) => (
                      <li key={sIdx} style={{ marginTop: 4 }}>
                        {s.source_url && String(s.source_url).trim() ? (
                          <a
                            href={String(s.source_url)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#0066cc" }}
                          >
                            {String(s.source_label || s.source_url || "")}
                          </a>
                        ) : (
                          <span style={{ color: "#666" }}>
                            {String(s.source_label || "Reference")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ marginTop: 8, opacity: 0.7, fontSize: "14px" }}>
                    No sources
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
          </div>
        </> )}
        </div>
      )}

      {activeTab === "review" && data.module_instance && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Review & Edit</h2>
          <p style={{ color: "#666", marginBottom: 24, fontSize: "14px" }}>
            Fix what the wizard got wrong. Same logic as the wizard Review step: edit question text and OFC text, then Save.
          </p>
          {reviewSaveMessage && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#d1ecf1", border: "1px solid #bee5eb", borderRadius: 4, color: "#0c5460" }}>
              {reviewSaveMessage}
            </div>
          )}
          {(!data.module_instance_criteria || data.module_instance_criteria.length === 0) ? (
            <div style={{ color: "#999", fontStyle: "italic" }}>No criteria to edit. Generate from the Standard tab first.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {(data.module_instance_criteria as Record<string, unknown>[])
                .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0))
                .map((c: Record<string, unknown>) => {
                  const cId = String(c.id ?? "");
                  const critEdit = reviewCriteriaEdits[cId] ?? { question_text: String(c.question_text ?? ""), title: String(c.title ?? "") };
                  const ofcsForCriterion = (data.module_instance_ofcs as Record<string, unknown>[] || []).filter((o: Record<string, unknown>) => o.criterion_key === c.criterion_key);
                  return (
                    <div
                      key={cId}
                      style={{
                        padding: 20,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        backgroundColor: "#f9fafb",
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "14px" }}>
                          <code style={{ backgroundColor: "#e5e7eb", padding: "2px 6px", borderRadius: 4 }}>{String(c.criterion_key ?? "")}</code> — Question
                        </label>
                        <textarea
                          value={critEdit.question_text}
                          onChange={(e) =>
                            setReviewCriteriaEdits((prev) => ({
                              ...prev,
                              [cId]: { ...prev[cId], question_text: e.target.value, title: prev[cId]?.title ?? String(c.title ?? "") },
                            }))
                          }
                          rows={3}
                          style={{
                            width: "100%",
                            padding: 10,
                            fontSize: "14px",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      {ofcsForCriterion.length > 0 && (
                        <div>
                          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "14px" }}>OFCs (shown when answer is NO)</label>
                          {ofcsForCriterion.map((o: Record<string, unknown>) => {
                            const oId = String(o.id ?? "");
                            return (
                            <div key={oId} style={{ marginBottom: 12 }}>
                              <label style={{ display: "block", marginBottom: 4, fontSize: "12px", color: "#6b7280" }}>
                                <code>{String(o.template_key ?? "")}</code>
                              </label>
                              <textarea
                                value={reviewOfcsEdits[oId] ?? String(o.ofc_text ?? "")}
                                onChange={(e) =>
                                  setReviewOfcsEdits((prev) => ({ ...prev, [oId]: e.target.value }))
                                }
                                rows={2}
                                style={{
                                  width: "100%",
                                  padding: 10,
                                  fontSize: "14px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: 4,
                                }}
                              />
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  type="button"
                  disabled={reviewSaving}
                  onClick={async () => {
                    setReviewSaving(true);
                    setReviewSaveMessage(null);
                    try {
                      const crit = (data.module_instance_criteria || []) as Array<{ id: string; question_text: string; title: string }>;
                      const ofcs = (data.module_instance_ofcs || []) as Array<{ id: string; ofc_text: string }>;
                      for (const c of crit) {
                        const edit = reviewCriteriaEdits[c.id];
                        if (edit && (edit.question_text !== c.question_text || edit.title !== (c.title ?? ""))) {
                          const r = await fetch(
                            `/api/admin/modules/${encodeURIComponent(moduleCode)}/instance/criteria/${encodeURIComponent(c.id)}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ question_text: edit.question_text, title: edit.title || c.title }),
                            }
                          );
                          if (!r.ok) {
                            const j = await r.json().catch(() => ({}));
                            throw new Error(j?.message || j?.error || "Failed to update criterion");
                          }
                        }
                      }
                      for (const o of ofcs) {
                        const edit = reviewOfcsEdits[o.id];
                        if (edit !== undefined && edit !== (o.ofc_text ?? "")) {
                          const r = await fetch(
                            `/api/admin/modules/${encodeURIComponent(moduleCode)}/instance/ofcs/${encodeURIComponent(o.id)}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ofc_text: edit }),
                            }
                          );
                          if (!r.ok) {
                            const j = await r.json().catch(() => ({}));
                            throw new Error(j?.message || j?.error || "Failed to update OFC");
                          }
                        }
                      }
                      setReviewSaveMessage("Saved. Criteria and OFCs updated.");
                      await loadData();
                    } catch (e: unknown) {
                      setReviewSaveMessage(e instanceof Error ? e.message : "Save failed");
                    } finally {
                      setReviewSaving(false);
                    }
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: reviewSaving ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {reviewSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "standard" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, fontSize: "14px", color: "#1e40af" }}>
            Choose the assessment structure: <strong>Measures</strong> (physical conditions and objects) or <strong>Plan</strong> (plans and procedures). Add sources on the Sources tab first, then click <strong>Generate</strong> to create questions and OFCs from your documents. Use <strong>Dry run</strong> to preview; uncheck to save the generated content to this module.
          </div>
          {standardLoadErr && (
            <div style={{ marginBottom: 12, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
              <strong>Error loading standards:</strong> {standardLoadErr}
              {standardLoadHint && (
                <div style={{ marginTop: 8, fontSize: "13px", opacity: 0.95 }}>
                  {standardLoadHint}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: "13px", opacity: 0.95 }}>
                From project root (with <code>CORPUS_DATABASE_URL</code> in .env.local):<br />
                <code style={{ fontSize: "12px", display: "inline-block", marginTop: 4, padding: "6px 8px", background: "#fef2f2", borderRadius: 4 }}>
                  node scripts/run_corpus_module_standards.js
                </code>
              </div>
            </div>
          )}
          {generateErr && (
            <div style={{ marginBottom: 12, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
              <strong>Standard generation failed</strong>
              <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "13px", fontFamily: "inherit" }}>{generateErr}</pre>
              {generateFailureReason && (
                <div style={{ marginTop: 8, padding: 8, backgroundColor: "#fef2f2", borderRadius: 4 }}>
                  <strong>Call to action:</strong>{" "}
                  {generateFailureReason === "NORMALIZATION_LINT_FAILED"
                    ? "Fix capability/checklist/OFC phrasing per the rules below. Generator should run rewriteChecklistItems() before lint, then retry."
                    : generateFailureReason === "CHECKLIST_NORMALIZATION_FAILED"
                      ? "Checklist items must be declarative (no questions). Generator should run rewriteChecklistItems() before lint, then retry."
                      : generateFailureReason === "OFC_QUALITY_FAILED"
                        ? "OFCs must be succinct (no boilerplate) and each must have an evidence-derived Reason. Fix generator or run rewrite step."
                        : generateFailureReason === "CRITERIA_SCENARIO_OR_FORMAT"
                          ? "Criteria must be EAP plan elements only (Plan element exists: …). No hazards, scenarios, or 'what to do if…'."
                          : generateFailureReason === "SCO_CRITERIA_VALIDATION_FAILED"
                            ? "See failing criteria below (rule, index, text). What/How leads are auto-rewritten to existence form; fix any other rule (e.g. deep cyber, purpose/role) and retry."
                            : "Add sources on the Sources tab, then retry."}
                  <div style={{ marginTop: 6, fontSize: "13px" }}>
                    <code>failure_reason</code>: {generateFailureReason}
                  </div>
                </div>
              )}
              {generateFailures && generateFailures.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, fontSize: "13px" }}>
                  <strong>Failing criteria (rule + index + text):</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, maxHeight: 200, overflow: "auto" }}>
                    {generateFailures.slice(0, 15).map((f, i) => (
                      <li key={i} style={{ wordBreak: "break-word", marginBottom: 6 }}>
                        <code style={{ fontSize: "12px" }}>{f.rule}</code> (index {f.index}): &quot;{f.text}&quot;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {generateRewrites && generateRewrites.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, fontSize: "13px" }}>
                  <strong>Auto-normalized criteria:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, maxHeight: 160, overflow: "auto" }}>
                    {generateRewrites.slice(0, 10).map((r, i) => (
                      <li key={i} style={{ wordBreak: "break-word", marginBottom: 4 }}>
                        <span style={{ color: "#b91c1c" }}>from:</span> &quot;{r.from}&quot; → <span style={{ color: "#15803d" }}>to:</span> &quot;{r.to}&quot;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {generateCriteriaErrors && generateCriteriaErrors.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 4, fontSize: "13px" }}>
                  <strong>Criteria validation errors:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, maxHeight: 120, overflow: "auto" }}>
                    {generateCriteriaErrors.slice(0, 10).map((msg, i) => (
                      <li key={i} style={{ wordBreak: "break-word" }}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {generateOfcErrors && generateOfcErrors.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 4, fontSize: "13px" }}>
                  <strong>OFC validation errors:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, maxHeight: 120, overflow: "auto" }}>
                    {generateOfcErrors.slice(0, 10).map((msg, i) => (
                      <li key={i} style={{ wordBreak: "break-word" }}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {generateViolations && (generateViolations.violated_rule_ids.length > 0 || generateViolations.samples.length > 0) && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 4, fontSize: "13px" }}>
                  <strong>Rules violated (fix these in source content or generator output):</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {generateViolations.violated_rule_ids.map((id) => (
                      <li key={id}>
                        <code>{id}</code>
                        {generateViolations.rule_descriptions[id] && (
                          <span style={{ marginLeft: 6, color: "#9a3412" }}>{" - "}{generateViolations.rule_descriptions[id]}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {generateViolations.samples.length > 0 && (
                    <>
                      <strong style={{ display: "block", marginTop: 10 }}>Example snippets that failed:</strong>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 20, maxHeight: 160, overflow: "auto" }}>
                        {generateViolations.samples.slice(0, 8).map((s, i) => (
                          <li key={i} style={{ wordBreak: "break-word" }}>&quot;{typeof s === "string" ? s : String(s)}&quot;</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {selectedStandardKey === "PHYSICAL_SECURITY_PLAN" && (
                <div style={{ marginTop: 12, padding: 12, backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4, fontSize: "14px" }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Plan Structure Verification</div>
                  <p style={{ margin: "0 0 10px", color: "#0c4a6e" }}>
                    This module evaluates the presence of documented plan elements based on an authoritative plan structure.
                    The structure is derived from an approved template or guide and is used as the baseline for plan review.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", marginBottom: 8 }}>
                    <span>Plan Sections Identified:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.sections_count ?? 0)}</span>
                    <span>Vital Elements Identified:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.elements_count ?? 0)}</span>
                    <span>Structure Source:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.structure_source_title ?? planSchemaStatus?.structure_source_registry_id ?? "—")}</span>
                    <span>Derivation Method:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.derive_method ?? "—")} {planSchemaStatus?.derive_method === "TOC" ? "(Table of Contents)" : planSchemaStatus?.derive_method === "HEADINGS" ? "(Document Headings)" : ""}</span>
                    <span>Confidence Level:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.confidence ?? "—")}</span>
                    <span>Status:</span><span>{planSchemaStatusLoading ? "—" : (planSchemaStatus?.active && (planSchemaStatus?.sections_count ?? 0) > 0 ? "Plan structure verified." : "Plan structure not established.")}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Confidence reflects the reliability of the document structure extraction, not plan quality.
                  </p>
                  {!planSchemaStatusLoading && (!planSchemaStatus?.active || (planSchemaStatus?.sections_count ?? 0) === 0 || (planSchemaStatus?.elements_count ?? 0) === 0) && (
                    <p style={{ margin: "10px 0 0", fontWeight: 500, color: "#0c4a6e" }}>
                      Action Required: Select a plan template or guide and run Derive or Rebuild below to establish plan structure.
                    </p>
                  )}
                  {!planSchemaStatusLoading && (!planSchemaStatus?.active || (planSchemaStatus?.sections_count ?? 0) === 0 || (planSchemaStatus?.elements_count ?? 0) === 0) && (
                    <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#64748b" }}>
                      No plan elements are available for review until plan structure is established.
                    </p>
                  )}
                </div>
              )}
              {generatePreflight && selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" && (
                <div style={{ marginTop: 8, fontSize: "13px", opacity: 0.95 }}>
                  <strong>Preflight:</strong> Sources attached: {generatePreflight.source_count}; usable: {generatePreflight.usable_source_count}; chunks: {generatePreflight.chunk_count}.
                  {(generatePreflight.sources_used?.length ?? 0) > 0 && (
                    <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                      {generatePreflight.sources_used.slice(0, 5).map((s, i) => (
                        <li key={i}>{s.label || s.type} — {s.contributed_chunks} chunks</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: "13px", opacity: 0.95, whiteSpace: "pre-line" }}>
                {generateHint ? (
                  generateHint
                ) : (
                  <>
                    Ensure the module has ingested sources on the Sources tab and the generation service is available. If generation fails, try re-running from the Sources tab after processing your PDFs.
                  </>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Standard Class</label>
              <select
                value={selectedStandardKey}
                onChange={async (e) => {
                  const k = e.target.value;
                  setSelectedStandardKey(k);
                  setGeneratePreview(null);
                  setStandardDetail(null);
                  setGenerateErr(null);
                  setGenerateHint(null);
                  setGenerateFailureReason(null);
                  setGeneratePreflight(null);
                  setGenerateViolations(null);
                  setGenerateCriteriaErrors(null);
                  setGenerateFailures(null);
                  setGenerateRewrites(null);
                  setGenerateOfcErrors(null);
                  if (!k) return;
                  // Persist Standard Class immediately so Object vs Plan is stored under the module
                  try {
                    const patchRes = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ standard_class: k }),
                    });
                    if (patchRes.ok) await loadData();
                  } catch {
                    /* non-blocking; dropdown still updated locally */
                  }
                  try {
                    const r = await fetch(`/api/admin/module-standards/${encodeURIComponent(k)}`);
                    const j = await r.json().catch(() => ({}));
                    if (r.ok) {
                      setStandardDetail(j);
                      setStandardLoadErr(null);
                    } else setStandardLoadErr(j?.error || "Failed to load standard");
                  } catch (err: unknown) { setStandardLoadErr(err instanceof Error ? err.message : "Failed to load"); }
                }}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              >
                {STANDARD_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {selectedStandardKey === "PHYSICAL_SECURITY_PLAN" && (
              <div style={{ padding: 16, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "15px" }}>Plan schema</div>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#166534" }}>
                  Derive sections and critical elements from your template/guide. Generate then uses the stored schema. Choose a structure source and run Derive or Rebuild below.
                </p>

                {/* Current schema status */}
                <div style={{ marginBottom: 16, padding: 10, backgroundColor: planSchemaStatus?.active ? "#dcfce7" : "#fef3c7", border: `1px solid ${planSchemaStatus?.active ? "#86efac" : "#fcd34d"}`, borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4, fontSize: "13px" }}>
                    {planSchemaStatusLoading ? "Loading…" : planSchemaStatus?.active ? "Active schema" : "No active schema"}
                  </div>
                  {!planSchemaStatusLoading && planSchemaStatus?.active && (
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: "12px", color: "#166534" }}>
                      <span>Sections</span><span>{planSchemaStatus.sections_count ?? "—"}</span>
                      <span>Elements</span><span>{planSchemaStatus.elements_count ?? "—"}</span>
                      {planSchemaStatus.derive_method && <span>Method</span>}<span>{planSchemaStatus.derive_method ?? "—"}</span>
                      {planSchemaStatus.confidence && <span>Confidence</span>}<span>{planSchemaStatus.confidence ?? "—"}</span>
                      {planSchemaStatus.plan_schema_engine && <span>Engine</span>}<span>{planSchemaStatus.plan_schema_engine}</span>
                    </div>
                  )}
                  {!planSchemaStatusLoading && !planSchemaStatus?.active && (
                    <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>Derive or Rebuild below to create a schema. Ensure chunks are exported (run Generate once or export chunks) and pick a structure source.</p>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: 4 }} title="Which requirement document defines section structure (TOC/headings).">
                    Structure source
                  </label>
                  <select
                    value={structureSourceRegistryId ?? ""}
                    onChange={(e) => setStructureSourceRegistryId(e.target.value || null)}
                    style={{ minWidth: 280, padding: "8px 10px", fontSize: "13px", borderRadius: 4, border: "1px solid #ccc" }}
                    title="Pick the template/guide used for TOC or headings."
                  >
                    <option value="">Auto (prefer template)</option>
                    {structureSourceOptions.map((opt) => (
                      <option key={opt.source_registry_id} value={opt.source_registry_id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#666" }}>
                    Document used for section structure. Required for Rebuild (schema-first).
                  </p>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>Plan structure trust</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={planStructureTrust === "INFERRED" ? 0 : planStructureTrust === "BALANCED" ? 1 : 2}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPlanStructureTrust(v === 0 ? "INFERRED" : v === 1 ? "BALANCED" : "TOC");
                      }}
                      title="Inferred / Balanced / TOC-Driven"
                      style={{ width: 120 }}
                    />
                    <span style={{ fontSize: "13px" }}>{planStructureTrust === "INFERRED" ? "Inferred" : planStructureTrust === "BALANCED" ? "Balanced" : "TOC-driven"}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>Schema engine</label>
                  <select
                    value={planSchemaEngine}
                    onChange={(e) => setPlanSchemaEngine(e.target.value === "legacy" ? "legacy" : "auto")}
                    style={{ minWidth: 200, padding: "8px 10px", fontSize: "13px", borderRadius: 4, border: "1px solid #ccc" }}
                  >
                    <option value="auto">Auto (recommended)</option>
                    <option value="legacy">Legacy (deprecated)</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button
                  disabled={deriveSchemaLoading}
                  onClick={async () => {
                    setDeriveSchemaLoading(true);
                    setDeriveSchemaErr(null);
                    setDeriveSchemaResult(null);
                    try {
                      const body: { trust: string; structure_source_registry_id?: string; engine?: string } = { trust: planStructureTrust };
                      if (structureSourceRegistryId) body.structure_source_registry_id = structureSourceRegistryId;
                      if (planSchemaEngine === "legacy") body.engine = "LEGACY";
                      const engineParam = planSchemaEngine === "legacy" ? "&engine=LEGACY" : "";
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/plan/derive-schema?trust=${encodeURIComponent(planStructureTrust)}${engineParam}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        let msg = (j.error ?? j.message ?? `HTTP ${r.status}`) as string;
                        if (Array.isArray(j.validation_errors) && j.validation_errors.length) msg += "\n" + (j.validation_errors as string[]).join("\n");
                        if (j.hint) msg += "\n" + (j.hint as string);
                        if (r.status === 500 && !j.message && !j.error) msg += "\nCheck the terminal where the dev server is running for [plan/derive-schema].";
                        setDeriveSchemaErr(msg);
                        return;
                      }
                      const opts = Array.isArray(j.structure_source_options) ? j.structure_source_options : [];
                      if (opts.length > 0) setStructureSourceOptions(opts);
                      setDeriveSchemaResult({
                        section_count: j.section_count ?? 0,
                        element_count: j.element_count ?? 0,
                        section_titles: Array.isArray(j.section_titles) ? j.section_titles : [],
                        idempotent: j.idempotent === true,
                        used_force: j.used_force === true,
                        schema_version: typeof j.schema_version === "number" ? j.schema_version : undefined,
                        trust_mode: typeof j.trust_mode === "string" ? j.trust_mode : undefined,
                        engine_used: typeof j.engine_used === "string" ? j.engine_used : undefined,
                        sections_count: typeof j.sections_count === "number" ? j.sections_count : undefined,
                        elements_count: typeof j.elements_count === "number" ? j.elements_count : undefined,
                        structure_source_title: typeof j.structure_source_title === "string" ? j.structure_source_title : j.structure_source_title === null ? null : undefined,
                        structure_source_options: opts.length > 0 ? opts : undefined,
                      });
                      fetchPlanSchemaStatus();
                    } catch (e: unknown) {
                      setDeriveSchemaErr(e instanceof Error ? e.message : "Derive schema failed");
                    } finally {
                      setDeriveSchemaLoading(false);
                    }
                  }}
                  style={{ padding: "8px 14px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: 4, cursor: deriveSchemaLoading ? "not-allowed" : "pointer", fontWeight: 500 }}
                >
                  {deriveSchemaLoading ? "Deriving…" : "Derive Plan Schema"}
                </button>
                <button
                  disabled={deriveSchemaLoading || !structureSourceRegistryId}
                  title={!structureSourceRegistryId ? "Select a structure source first" : undefined}
                  onClick={async () => {
                    setDeriveSchemaLoading(true);
                    setDeriveSchemaErr(null);
                    setDeriveSchemaResult(null);
                    try {
                      const body: { trust: string; structure_source_registry_id?: string; engine?: string } = { trust: planStructureTrust };
                      if (structureSourceRegistryId) body.structure_source_registry_id = structureSourceRegistryId;
                      if (planSchemaEngine === "legacy") body.engine = "LEGACY";
                      const engineParam = planSchemaEngine === "legacy" ? "&engine=LEGACY" : "";
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/plan/derive-schema?force=1&trust=${encodeURIComponent(planStructureTrust)}${engineParam}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        let msg = (j.error ?? j.message ?? `HTTP ${r.status}`) as string;
                        if (Array.isArray(j.validation_errors) && j.validation_errors.length) msg += "\n" + (j.validation_errors as string[]).join("\n");
                        if (j.hint) msg += "\n" + (j.hint as string);
                        setDeriveSchemaErr(msg);
                        return;
                      }
                      const opts = Array.isArray(j.structure_source_options) ? j.structure_source_options : [];
                      if (opts.length > 0) setStructureSourceOptions(opts);
                      setDeriveSchemaResult({
                        section_count: j.section_count ?? 0,
                        element_count: j.element_count ?? 0,
                        section_titles: Array.isArray(j.section_titles) ? j.section_titles : [],
                        idempotent: j.idempotent === true,
                        used_force: j.used_force === true,
                        schema_version: typeof j.schema_version === "number" ? j.schema_version : undefined,
                        trust_mode: typeof j.trust_mode === "string" ? j.trust_mode : undefined,
                        engine_used: typeof j.engine_used === "string" ? j.engine_used : undefined,
                        sections_count: typeof j.sections_count === "number" ? j.sections_count : undefined,
                        elements_count: typeof j.elements_count === "number" ? j.elements_count : undefined,
                        structure_source_title: typeof j.structure_source_title === "string" ? j.structure_source_title : j.structure_source_title === null ? null : undefined,
                        structure_source_options: opts.length > 0 ? opts : undefined,
                      });
                      fetchPlanSchemaStatus();
                    } catch (e: unknown) {
                      setDeriveSchemaErr(e instanceof Error ? e.message : "Force re-derive failed");
                    } finally {
                      setDeriveSchemaLoading(false);
                    }
                  }}
                  style={{ padding: "8px 14px", backgroundColor: "#ca8a04", color: "white", border: "none", borderRadius: 4, cursor: deriveSchemaLoading ? "not-allowed" : "pointer" }}
                >
                  {deriveSchemaLoading ? "Deriving…" : "Force re-derive"}
                </button>
                <button
                  disabled={deriveSchemaLoading || !structureSourceRegistryId}
                  title={!structureSourceRegistryId ? "Select a structure source first" : "Create or replace schema in schema-first pipeline (plan_schemas)"}
                  onClick={async () => {
                    if (!structureSourceRegistryId) return;
                    setDeriveSchemaLoading(true);
                    setDeriveSchemaErr(null);
                    setDeriveSchemaResult(null);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/plan-schema/rebuild`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ structure_source_registry_id: structureSourceRegistryId, engine: planSchemaEngine === "legacy" ? "LEGACY" : undefined }),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        const msg = [j.error ?? j.message ?? `HTTP ${r.status}`].concat(j.hint ? [j.hint] : []).filter(Boolean).join("\n");
                        setDeriveSchemaErr(msg);
                        return;
                      }
                      setDeriveSchemaResult({
                        section_count: j.sections_count ?? 0,
                        element_count: j.elements_count ?? 0,
                        section_titles: [],
                        idempotent: false,
                        used_force: false,
                        engine_used: j.plan_schema_engine ?? undefined,
                        sections_count: j.sections_count,
                        elements_count: j.elements_count,
                      });
                      fetchPlanSchemaStatus();
                    } catch (e: unknown) {
                      setDeriveSchemaErr(e instanceof Error ? e.message : "Rebuild failed");
                    } finally {
                      setDeriveSchemaLoading(false);
                    }
                  }}
                  style={{ padding: "8px 14px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: deriveSchemaLoading ? "not-allowed" : "pointer" }}
                >
                  {deriveSchemaLoading ? "…" : "Rebuild (schema-first)"}
                </button>
                </div>
                {deriveSchemaErr && (
                  <div style={{ marginTop: 8, padding: 10, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4, fontSize: "13px", whiteSpace: "pre-wrap" }}>{deriveSchemaErr}</div>
                )}
                {deriveSchemaResult && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: "#dcfce7", borderRadius: 4, fontSize: "13px" }}>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>{deriveSchemaResult.idempotent ? "Schema unchanged (same sources)" : "Schema saved"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", marginBottom: deriveSchemaResult.section_titles.length > 0 ? 8 : 0 }}>
                      <span>Sections</span><span>{deriveSchemaResult.sections_count ?? deriveSchemaResult.section_count}</span>
                      <span>Elements</span><span>{deriveSchemaResult.elements_count ?? deriveSchemaResult.element_count}</span>
                      {deriveSchemaResult.structure_source_title != null && deriveSchemaResult.structure_source_title !== "" && (
                        <>
                          <span>Structure source</span><span>{deriveSchemaResult.structure_source_title}</span>
                        </>
                      )}
                      {deriveSchemaResult.engine_used != null && <><span>Engine</span><span>{deriveSchemaResult.engine_used}</span></>}
                    </div>
                    {deriveSchemaResult.section_titles.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer", fontSize: "12px" }}>Section titles ({deriveSchemaResult.section_titles.length})</summary>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                          {deriveSchemaResult.section_titles.slice(0, 15).map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                          {deriveSchemaResult.section_titles.length > 15 && <li>…and {deriveSchemaResult.section_titles.length - 15} more</li>}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={!!generateDryRun} onChange={(e) => setGenerateDryRun(e.target.checked)} />
                <span>Dry run (preview only)</span>
              </label>
              <button
                disabled={!selectedStandardKey || generateLoading || (!generateDryRun && !!generatePreview && (generatePreview.validForPersist ?? false) === false)}
                title={!generateDryRun && generatePreview && generatePreview.validForPersist === false ? "Add citations in CORPUS for all OFC templates before persisting" : undefined}
                onClick={async () => {
                  setGenerateLoading(true);
                  setGenerateErr(null);
                  setGenerateHint(null);
                  setGenerateFailureReason(null);
                  setGeneratePreflight(null);
                  setGenerateViolations(null);
                  setGenerateCriteriaErrors(null);
                  setGenerateFailures(null);
                  setGenerateRewrites(null);
                  setGenerateOfcErrors(null);
                  try {
                    const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/standard/generate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ standard_key: selectedStandardKey, dryRun: generateDryRun }),
                    });

                    if (!r.ok) {
                      const ct = r.headers.get("content-type") ?? "";
                      let j: Record<string, unknown>;
                      try {
                        j = ct.includes("application/json") ? await r.json() : { message: (await r.text())?.slice(0, 2000) || `HTTP ${r.status}` };
                      } catch {
                        j = { message: `HTTP ${r.status}` };
                      }
                      const failureReason = (j?.failure_reason ?? j?.failureReason ?? j?.code) as string | null;
                      const msg = (j?.message ?? j?.error ?? `Request failed (${r.status})`) as string;
                      const callToAction = (j?.call_to_action ?? j?.callToAction ?? j?.hint) as string | null;
                      const lines = [
                        `standard/generate failed (${r.status})`,
                        failureReason ? `failure_reason: ${failureReason}` : null,
                        msg ? `message: ${msg}` : null,
                        callToAction ? `call_to_action: ${callToAction}` : null,
                      ].filter(Boolean) as string[];
                      if (j?.preflight && typeof j.preflight === "object" && "source_count" in j.preflight) {
                        const pf = j.preflight as { source_count?: number; usable_source_count?: number; chunk_count?: number };
                        lines.push(`Preflight: Sources attached: ${pf.source_count ?? "—"}; usable: ${pf.usable_source_count ?? "—"}; chunks: ${pf.chunk_count ?? "—"}.`);
                      }
                      setGenerateErr(lines.join("\n"));
                      setGenerateHint(callToAction ?? null);
                      setGenerateFailureReason(failureReason ?? null);
                      setGeneratePreflight((j?.preflight as typeof generatePreflight) ?? null);
                      setGenerateCriteriaErrors(Array.isArray(j?.criteria_validation_errors) ? j.criteria_validation_errors : null);
                      setGenerateFailures(Array.isArray(j?.failures) ? j.failures as Array<{ rule: string; index: number; text: string }> : null);
                      setGenerateRewrites(Array.isArray(j?.rewrites) ? j.rewrites as Array<{ from: string; to: string }> : null);
                      setGenerateOfcErrors(Array.isArray(j?.ofc_validation_errors) ? j.ofc_validation_errors : null);
                      if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && j != null) {
                        console.warn("[standard/generate] error payload:", j);
                      }
                      setGenerateViolations(
                        Array.isArray(j?.violated_rule_ids) && j.violated_rule_ids.length > 0
                          ? {
                              violated_rule_ids: j.violated_rule_ids as string[],
                              samples: Array.isArray(j.samples) ? j.samples : [],
                              rule_descriptions: (j?.rule_descriptions ?? {}) as Record<string, string>,
                            }
                          : Array.isArray(j?.samples) && j.samples.length > 0
                            ? { violated_rule_ids: [], samples: j.samples, rule_descriptions: (j?.rule_descriptions ?? {}) as Record<string, string> }
                            : null
                      );
                      if (Array.isArray(j?.missingOfcCitations) && j.missingOfcCitations.length > 0) {
                        setGeneratePreview((p) => p ? { ...p, missingOfcCitations: j.missingOfcCitations as string[], validForPersist: false } : null);
                      }
                      return;
                    }
                    const j = (await r.json()) as Record<string, unknown> & {
                      planPreview?: (NonNullable<typeof generatePreview>)["planPreview"];
                    };
                    const parsedPlanPreview =
                      j.planPreview && typeof j.planPreview === "object"
                        ? (j.planPreview as (NonNullable<typeof generatePreview>)["planPreview"])
                        : undefined;
                    setGenerateFailureReason(null);
                    setGeneratePreflight(null);
                    setGenerateViolations(null);
                    setGenerateFailures(null);
                    setGenerateRewrites(null);
                    setGeneratePreview({
                      criteria: (Array.isArray(j.criteria) ? j.criteria : []) as Array<{ criterion_key: string; title: string; question_text: string; applicability: string }>,
                      ofcs: (Array.isArray(j.ofcs) ? j.ofcs : []) as Array<{ criterion_key: string; template_key: string; ofc_text: string; ofc_reason?: string }>,
                      missingOfcCitations: Array.isArray(j.missingOfcCitations) ? (j.missingOfcCitations as string[]) : [],
                      validForPersist: j.validForPersist !== false,
                      preflight: (j.preflight as typeof generatePreflight) ?? undefined,
                      checklist_items: Array.isArray(j.checklist_items) ? j.checklist_items : undefined,
                      plan_type: typeof j.plan_type === "string" ? j.plan_type : undefined,
                      planPreview: parsedPlanPreview,
                    });
                    if (!__loggedPlanPreviewOnce && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugPlan") && parsedPlanPreview?.capabilities?.length) {
                      __loggedPlanPreviewOnce = true;
                      console.log("planPreview.capabilities[0]", parsedPlanPreview.capabilities[0], "keys:", Object.keys(parsedPlanPreview.capabilities[0] ?? {}));
                    }
                    if (!generateDryRun) { await loadData(); setActiveTab("overview"); }
                  } catch (e: unknown) {
                    setGenerateErr(e instanceof Error ? e.message : "Generate failed");
                    setGenerateHint(null);
                  } finally {
                    setGenerateLoading(false);
                  }
                }}
                style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: generateLoading ? "not-allowed" : "pointer", opacity: generateLoading ? 0.7 : 1 }}
              >
                {generateLoading ? "Running…" : generateDryRun ? "Generate (preview)" : "Generate (write instance)"}
              </button>
              {generateLoading && (
                <span style={{ fontSize: "13px", color: "#666" }}>This can take 2–10 minutes. Keep this page open.</span>
              )}
            </div>
          </div>
          {generatePreview && (
            <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
              {selectedStandardKey === "PHYSICAL_SECURITY_PLAN" ? (
                <>
                  <h3 style={{ margin: 0, padding: 12, backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>Plan Element Review</h3>
                  <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                      This review identifies whether required plan elements are documented.
                      Findings are based solely on the presence or absence of written procedures.
                    </p>
                  </div>
                </>
              ) : (
                <h3 style={{ margin: 0, padding: 12, backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>Preview</h3>
              )}
              <div style={{ padding: 12 }}>
                {generatePreview.preflight && selectedStandardKey === "PHYSICAL_SECURITY_PLAN" && (
                  <p style={{ marginBottom: 16, fontSize: "13px", color: "#64748b" }}>
                    Plan structure and element counts are shown in the Plan Structure Verification block above (from stored schema).
                  </p>
                )}
                {generatePreview.preflight && selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" && (
                  <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4, fontSize: "14px" }}>
                    <strong>Preflight report</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                      <li>Sources attached: {generatePreview.preflight.source_count}</li>
                      <li>Sources usable: {generatePreview.preflight.usable_source_count}</li>
                      <li>Chunks retrieved: {(generatePreview.preflight as { chunks_retrieved_total?: number }).chunks_retrieved_total ?? generatePreview.preflight.chunk_count}</li>
                      {typeof (generatePreview.preflight as { comprehension_status?: string }).comprehension_status === "string" && (
                        <li>Comprehension: {(generatePreview.preflight as { comprehension_status?: string }).comprehension_status} ({(generatePreview.preflight as { comprehension_rows?: number }).comprehension_rows ?? 0} rows)</li>
                      )}
                      {typeof (generatePreview.preflight as { chunks_top_source?: number }).chunks_top_source === "number" && (
                        <li>Chunks (top source, used for plan): {(generatePreview.preflight as { chunks_top_source?: number }).chunks_top_source}</li>
                      )}
                      {typeof (generatePreview.preflight as { plan_capabilities_count?: number }).plan_capabilities_count === "number" && (
                        <li>PLAN capabilities ({(generatePreview.preflight as { plan_capabilities_count?: number }).plan_capabilities_count})</li>
                      )}
                      {typeof (generatePreview.preflight as { plan_vital_elements_count?: number }).plan_vital_elements_count === "number" && (
                        <li>Vital elements ({(generatePreview.preflight as { plan_vital_elements_count?: number }).plan_vital_elements_count})</li>
                      )}
                      {(generatePreview.preflight as { plan_vital_elements_reason?: string }).plan_vital_elements_reason && (
                        <li style={{ color: "#b45309" }}>Vitals reason: {(generatePreview.preflight as { plan_vital_elements_reason?: string }).plan_vital_elements_reason}</li>
                      )}
                      {(() => {
                        const diag = (generatePreview.preflight as { plan_vital_elements_diagnostics?: { top_source_chunks: number; parsed_pages_count: number; sections_with_nonempty_text: number; sections_with_marker_present: number } }).plan_vital_elements_diagnostics;
                        return diag ? (
                          <li style={{ fontSize: "0.9em", color: "#666" }}>
                            Vitals diagnostics: top_source_chunks={diag.top_source_chunks} parsed_pages={diag.parsed_pages_count} sections_with_text={diag.sections_with_nonempty_text} sections_with_marker={diag.sections_with_marker_present}
                          </li>
                        ) : null;
                      })()}
                    </ul>
                    {(generatePreview.preflight.sources_used?.length ?? 0) > 0 && (
                      <>
                        <div style={{ marginTop: 8, fontWeight: 600 }}>Top sources used</div>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                          {generatePreview.preflight.sources_used.slice(0, 5).map((s, i) => (
                            <li key={i}>{s.label || s.type} — {s.contributed_chunks} chunks</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {(generatePreview.checklist_items?.length ?? generatePreview.planPreview?.checklist_items?.length ?? 0) > 0 && (() => {
                      const items = generatePreview.checklist_items ?? generatePreview.planPreview?.checklist_items ?? [];
                      const n = items.length;
                      return (
                        <>
                          <div style={{ marginTop: 12, fontWeight: 600 }}>Checklist items ({n})</div>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                            {items.slice(0, 10).map((item: { id?: string; text?: string }, i: number) => (
                              <li key={item.id ?? i} style={{ marginBottom: 4 }}>{item.text}</li>
                            ))}
                          </ul>
                          {n > 10 && <div style={{ marginTop: 4, fontSize: "13px", color: "#666" }}>… and {n - 10} more</div>}
                        </>
                      );
                    })()}
                  </div>
                )}
                {generatePreview.validForPersist === false && ((generatePreview.missingOfcCitations ?? []).length) > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
                    <strong>Cannot persist:</strong> All OFCs must have at least one citation. Add citations in CORPUS (module_standard_citations) for these OFC templates:
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                      {(generatePreview.missingOfcCitations ?? []).map((key: string, i: number) => (
                        <li key={i}><code>{key}</code></li>
                      ))}
                    </ul>
                    <span style={{ display: "block", marginTop: 8, fontSize: "13px" }}>Generate (write instance) is disabled until every OFC has a citation.</span>
                  </div>
                )}
                {selectedStandardKey === "PHYSICAL_SECURITY_PLAN" ? (
                  <>
                    {(() => {
                      const schemaEstablished = planSchemaStatus?.active === true && (planSchemaStatus?.sections_count ?? 0) > 0 && (planSchemaStatus?.elements_count ?? 0) > 0;
                      const schemaJson = planSchemaStatus?.schema_json;
                      if (!schemaEstablished || !schemaJson?.sections?.length) {
                        return (
                          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                            No plan sections or elements are available for review until plan structure is established. Run Derive or Rebuild in the Plan schema section above; the list below will update once a schema is active.
                          </p>
                        );
                      }
                      type Sec = { section_key: string; section_title: string; section_ord: number; elements?: Array<{ element_key: string; element_label: string; element_ord: number }> };
                      const sections = schemaJson.sections as Sec[];
                      const seen = new Set<string>();
                      const flattened: Array<{ section_key: string; section_title: string; section_ord: number; element_key: string; element_label: string; element_ord: number }> = [];
                      for (const sec of sections) {
                        const els = sec.elements ?? [];
                        for (const el of els) {
                          const key = `${sec.section_key}::${el.element_key}`;
                          if (seen.has(key)) continue;
                          seen.add(key);
                          flattened.push({ ...el, section_key: sec.section_key, section_title: sec.section_title, section_ord: sec.section_ord });
                        }
                      }
                      const sectionOrder = [...new Map(sections.map((s) => [s.section_key, s])).values()].sort((a, b) => (a.section_ord ?? 0) - (b.section_ord ?? 0));
                      return (
                        <>
                          {sectionOrder.map((sec, i) => (
                            <div key={sec.section_key} style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600 }}>Section {i + 1}: {sec.section_title}</div>
                              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>This section reviews whether the plan documents the following required elements.</p>
                            </div>
                          ))}
                          <div style={{ marginTop: 16, marginBottom: 16 }}>
                            {flattened.map((el, j) => (
                              <div key={`${el.section_key}-${el.element_key}-${j}`} style={{ marginBottom: 14, padding: 10, backgroundColor: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                                <div style={{ fontWeight: 500, marginBottom: 4 }}>Does the plan include documented procedures for {el.element_label}?</div>
                                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: 4 }}>[ ] Yes  [ ] No  [ ] Not Applicable</div>
                                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>Documented procedures may include written descriptions, roles, or responsibilities.</p>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 20, padding: 12, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Plan Documentation Summary</div>
                            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#475569" }}>
                              This summary reflects the documented status of required plan elements at the time of review.
                              It does not evaluate plan quality, effectiveness, or implementation.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "14px" }}>
                              <span>Total Required Elements:</span><span>{flattened.length}</span>
                              <span>Elements Documented (Yes):</span><span>—</span>
                              <span>Elements Not Documented (No):</span><span>—</span>
                              <span>Elements Not Applicable:</span><span>—</span>
                            </div>
                          </div>
                          <p style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                            This plan review is limited to the presence of documented elements.
                            Operational readiness, training effectiveness, and real-world performance are outside the scope of this review.
                          </p>
                        </>
                      );
                    })()}
                  </>
                ) : (generatePreview.plan_type || generatePreview.planPreview) ? (
                  <>
                    {(generatePreview.planPreview?.gate_question ?? generatePreview.criteria?.[0]) && (
                      <div style={{ marginBottom: 12, padding: 10, backgroundColor: "#ecfdf5", borderRadius: 4, borderLeft: "4px solid #10b981" }}>
                        <strong>Gate question</strong>: {generatePreview.planPreview?.gate_question?.text ?? (generatePreview.criteria?.[0] as { question_text?: string })?.question_text ?? ""}
                      </div>
                    )}
                    {(() => {
                      const checklistItems = generatePreview.checklist_items ?? generatePreview.planPreview?.checklist_items ?? [];
                      const n = checklistItems.length;
                      if (n === 0) return null;
                      return (
                        <>
                          <div style={{ marginBottom: 8, fontWeight: 600 }}>Does it include the following sections?</div>
                          <div style={{ marginBottom: 12 }}><strong>Checklist items ({n})</strong></div>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                            {checklistItems.slice(0, 10).map((item: { id?: string; text?: string; subitems?: string[] }, i: number) => (
                              <li key={item.id ?? i} style={{ marginBottom: 6 }}>
                                {item.text}
                                {Array.isArray(item.subitems) && item.subitems.length > 0 && (
                                  <ul style={{ marginTop: 4, paddingLeft: 20, fontSize: "13px", color: "#555" }}>
                                    {item.subitems.map((s, j) => (
                                      <li key={j}>{s}</li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                          {n > 10 && <div style={{ marginTop: 4, fontSize: "13px", color: "#666" }}>… and {n - 10} more</div>}
                        </>
                      );
                    })()}
                    <div style={{ marginBottom: 12, marginTop: 16 }}><strong>PLAN capabilities ({(generatePreview.planPreview?.capabilities ?? []).length})</strong></div>
                    {(() => {
                      const caps = generatePreview.planPreview?.capabilities ?? [];
                      const looksLikeStandard = caps.length > 0 && caps[0] != null && "required_elements" in caps[0];
                      if (looksLikeStandard) {
                        return caps.map((c) => (
                          <div key={(c as { criterion_key: string }).criterion_key} style={{ marginBottom: 16, padding: 10, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600 }}>{(c as { title?: string }).title ?? "—"}</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>{(c as { criterion_key: string }).criterion_key} · {(c as { capability_state?: string }).capability_state} · {(c as { rollup_status?: string }).rollup_status ?? "—"} · {(c as { checked_count?: number }).checked_count ?? 0}/{(c as { applicable_count?: number }).applicable_count ?? 0} elements</div>
                            {(generatePreview.planPreview?.items ?? []).filter((i) => i.criterion_key === (c as { criterion_key: string }).criterion_key).map((item) => (
                              <div key={item.item_key} style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid #0066cc" }}>
                                <div>{item.checked ? "✓" : "○"} {item.text}</div>
                                <div style={{ fontSize: "12px", color: "#555", fontStyle: "italic", marginTop: 4 }}>{item.rationale}</div>
                                {!item.checked && ((item.ofcs?.length ?? 0) > 0) && (
                                  <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                                    {(item.ofcs ?? []).map((o, i) => (
                                      <li key={i} style={{ marginTop: 2 }}>
                                        <span style={{ fontWeight: 500 }}>{o.ofc_text}</span>
                                        {o.ofc_reason && (
                                          <div style={{ fontSize: "12px", color: "#555", marginTop: 4, marginLeft: 12 }}>{o.ofc_reason}</div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        ));
                      }
                      return caps.map((c) => {
                        const cap = c as { id?: string; capability_title?: string; capability_statement?: string; locator?: string; text?: string; source_id?: string; source_label?: string | null; locator_type?: string; vital_elements?: Array<{ id?: string; text?: string; vital_title?: string; locator?: string }>; vital_elements_count?: number };
                        const title = cap.capability_title ?? cap.locator ?? cap.text ?? "(Untitled capability)";
                        const statement = cap.capability_statement ?? cap.text;
                        const showStatement = statement && statement !== title;
                        const sourceLabel = cap.source_label ?? (cap.source_id ? `Source ${cap.source_id}` : null);
                        const locatorType = cap.locator_type ?? "section";
                        const locator = cap.locator ?? title;
                        const vitals = cap.vital_elements ?? [];
                        const vitalCount = cap.vital_elements_count ?? vitals.length;
                        const showCount = vitalCount > 0;
                        const first3 = vitals.slice(0, 3);
                        const restCount = vitals.length - 3;
                        return (
                          <div key={cap.id ?? title} style={{ marginBottom: 12, padding: 10, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600 }}>
                              {title}
                              {showCount && <span style={{ fontWeight: 500, color: "#555" }}> — {vitalCount} elements</span>}
                            </div>
                            {showStatement && <div style={{ fontSize: "13px", color: "#555", marginTop: 4 }}>{statement}</div>}
                            {vitals.length > 0 && (
                              <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 20, fontSize: "13px", color: "#555" }}>
                                {first3.map((v, idx) => (
                                  <li key={v.id ?? idx}>{v.text ?? (v as { vital_title?: string }).vital_title ?? v.locator ?? ""}</li>
                                ))}
                                {restCount > 0 && (
                                  <li style={{ color: "#666", fontStyle: "italic" }}>… and {restCount} more</li>
                                )}
                              </ul>
                            )}
                            <div style={{ fontSize: "12px", color: "#666", marginTop: 6 }}>
                              {sourceLabel && <span>Source: {sourceLabel}</span>}
                              {sourceLabel && locator && " · "}
                              {locator && <span>{locatorType}: {locator}</span>}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}><strong>Criteria ({generatePreview.criteria.length})</strong></div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {generatePreview.criteria.map((c: Record<string, unknown>) => (
                        <li key={String(c.criterion_key ?? "")} style={{ marginBottom: 6 }}>
                          <code>{String(c.criterion_key ?? "")}</code> [{String(c.applicability ?? "")}] {String(c.question_text ?? "")}
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 16, marginBottom: 8 }}><strong>OFCs ({generatePreview.ofcs.length})</strong></div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {generatePreview.ofcs.map((o: Record<string, unknown>, i: number) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          <code>{String(o.criterion_key ?? "")}</code> / {String(o.template_key ?? "")}: <span style={{ whiteSpace: "normal", fontWeight: 500 }}>{String(o.ofc_text ?? "")}</span>
                          {(o as Record<string, unknown>).ofc_reason != null && (
                            <div style={{ fontSize: "12px", color: "#555", marginTop: 4, marginLeft: 8 }}>{String((o as Record<string, unknown>).ofc_reason)}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "sources" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, fontSize: "14px", color: "#1e40af" }}>
            <strong>Two distinct source types:</strong> <strong>Module Uploads</strong> are files stored only for this module. <strong>Attached Evidence (from global registry)</strong> are read-only pointers to global evidence. Upload or add from URL for module-only files; use &quot;Attach from global registry&quot; to link existing evidence. After reviewing, add questions and OFCs in the Overview tab.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setShowAttachCorpus(true);
                setAttachSourceTab("module");
                loadSources();
              }}
              style={{ padding: "8px 16px", backgroundColor: "#0066cc", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              Add / attach source
            </button>
            <button
              onClick={() => setShowUploadModule(true)}
              style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              Upload Module Source
            </button>
            <button
              onClick={() => { setShowAddFromUrl(true); setAddFromUrlUrl(""); setAddFromUrlLabel(""); }}
              style={{ padding: "8px 16px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              Add from URL
            </button>
            <button
              onClick={async () => {
                try {
                  setSourceReportLoading(true);
                  setSourceReportError(null);
                  const response = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/report`, {
                    cache: 'no-store'
                  });
                  
                  if (!response.ok) {
                    throw new Error(`Failed to generate report: ${response.status}`);
                  }
                  
                  const data = (await response.json()) as ModuleSourceReportData;
                  setSourceReportData(data);
                  
                  // Create a downloadable JSON file
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `module-${moduleCode}-sources-report-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Unknown error';
                  setSourceReportError(message);
                }
                finally {
                  setSourceReportLoading(false);
                }
              }}
              style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4, fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              Generate Source Report
            </button>
          </div>
          {sourceReportLoading && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#334155", fontSize: 14 }}>
              Generating report…
            </div>
          )}
          {sourceReportError && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 14 }}>
              {sourceReportError}
            </div>
          )}
          {sourceReportData && !sourceReportLoading && (
            <div style={{ marginBottom: 24, padding: 16, background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", border: "1px solid #dbe3ee", borderRadius: 12, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Source report</div>
                <h3 style={{ margin: "4px 0 0", fontSize: 22, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}>{data?.module?.module_name || moduleCode}</h3>
                <p style={{ margin: "6px 0 0", color: "#475569" }}>
                  Module uploads are maintained within the module. Attached evidence is read-only and references the global registry. This report summarizes source mix, link status, and outstanding issues.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Total sources", value: sourceReportData.summary.statistics.total_sources ?? 0 },
                  { label: "Linked documents", value: sourceReportData.summary.statistics.total_linked_documents ?? 0 },
                  { label: "Linked chunks", value: sourceReportData.summary.statistics.total_linked_chunks ?? 0 },
                  { label: "Sources with docs", value: sourceReportData.summary.statistics.sources_with_documents ?? 0 },
                ].map((card) => (
                  <div key={card.label} style={{ padding: 12, backgroundColor: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                    <div style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{card.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <section style={{ padding: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Source mix</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                    <div style={{ padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}><strong>Module uploads</strong><br />{sourceReportData.summary.statistics.by_type?.MODULE_UPLOAD ?? 0}</div>
                    <div style={{ padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}><strong>Attached evidence</strong><br />{sourceReportData.summary.statistics.by_type?.CORPUS_POINTER ?? 0}</div>
                    <div style={{ padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}><strong>Pending</strong><br />{sourceReportData.summary.statistics.by_status?.PENDING ?? 0}</div>
                    <div style={{ padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}><strong>Downloaded</strong><br />{sourceReportData.summary.statistics.by_status?.DOWNLOADED ?? 0}</div>
                    <div style={{ padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}><strong>Failed</strong><br />{sourceReportData.summary.statistics.by_status?.FAILED ?? 0}</div>
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {[
                      { label: "Module uploads", value: sourceReportData.summary.statistics.by_type?.MODULE_UPLOAD ?? 0, color: "#2563eb" },
                      { label: "Attached evidence", value: sourceReportData.summary.statistics.by_type?.CORPUS_POINTER ?? 0, color: "#0f766e" },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                        <div style={{ height: 8, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(4, Math.round((row.value / Math.max(1, sourceReportData.summary.statistics.total_sources ?? 1)) * 100))}%`, height: "100%", backgroundColor: row.color }} />
                        </div>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <section style={{ padding: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Issues requiring attention</h4>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[
                      { label: "Missing files", value: sourceReportData.summary.issues_count.missing_files },
                      { label: "Failed downloads", value: sourceReportData.summary.issues_count.failed_downloads },
                      { label: "Without documents", value: sourceReportData.summary.issues_count.sources_without_documents },
                      { label: "Missing labels", value: sourceReportData.summary.issues_count.missing_labels },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", backgroundColor: row.value > 0 ? "#fff7ed" : "#f8fafc", borderRadius: 8 }}>
                        <span style={{ fontWeight: 500 }}>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {[
                      { label: "Missing files", value: sourceReportData.summary.issues_count.missing_files, color: "#ea580c" },
                      { label: "Failed downloads", value: sourceReportData.summary.issues_count.failed_downloads, color: "#b91c1c" },
                      { label: "Without documents", value: sourceReportData.summary.issues_count.sources_without_documents, color: "#a16207" },
                      { label: "Missing labels", value: sourceReportData.summary.issues_count.missing_labels, color: "#64748b" },
                    ].map((row) => (
                      <div key={`bar-${row.label}`} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                        <div style={{ height: 8, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(2, Math.round((row.value / Math.max(1, sourceReportData.summary.statistics.total_sources ?? 1)) * 100))}%`, height: "100%", backgroundColor: row.color }} />
                        </div>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
          {sourcesLoading ? (
            <div>Loading sources...</div>
          ) : sourcesData ? (
            <>
              {/* Module Uploads — show first so module sources are primary */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Module Uploads</h3>
                <button
                  disabled={processIncomingRunning}
                  onClick={async () => {
                    if (!confirm("Process PDFs in incoming for this module? This will copy files, ingest to RUNTIME and CORPUS, and run comprehension. Continue?")) return;
                    setProcessIncomingRunning(true);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/process-incoming-pdfs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dryRun: false }),
                      });
                      const data = await r.json().catch(() => ({}));
                      if (r.ok && data.ok) {
                        loadSources();
                        alert("Process incoming completed. Sources refreshed.");
                      } else {
                        alert(data?.message || data?.error || `Request failed (${r.status}). Check console for details.`);
                      }
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Request failed");
                    } finally {
                      setProcessIncomingRunning(false);
                    }
                  }}
                  style={{ padding: "6px 14px", fontSize: "13px", fontWeight: 500, border: "1px solid #6f42c1", color: "#6f42c1", backgroundColor: "#fff", borderRadius: 4, cursor: processIncomingRunning ? "not-allowed" : "pointer" }}
                >
                  {processIncomingRunning ? "Processing…" : "Process incoming PDFs"}
                </button>
              </div>
              {(!sourcesData?.sources?.length || (sourcesData.sources?.filter((s: ModuleSourceRow) => s.source_type === "MODULE_UPLOAD" || !s.source_type).length ?? 0) === 0) ? (
                <div style={{ padding: 16, color: "#666", fontStyle: "italic", border: "1px solid #eee", borderRadius: 4 }}>None. Use &quot;Upload Module Source&quot; or &quot;Add from URL&quot; to add files for this module only.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Label</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Status</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Linked docs</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sourcesData?.sources ?? []).filter((s: ModuleSourceRow) => s.source_type === "MODULE_UPLOAD" || !s.source_type).map((source: ModuleSourceRow) => (
                      <tr key={source.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px" }}>
                          {editingSourceId === source.id ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="text"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 }}
                                placeholder="Label"
                              />
                              <button type="button" onClick={async () => {
                                setSavingLabel(true);
                                try {
                                  const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_label: editingLabel }) });
                                  const j = await r.json().catch(() => ({}));
                                  if (r.ok) { setEditingSourceId(null); loadSources(); } else alert(j?.error || j?.message || "Update failed");
                                } catch (e: unknown) { alert(e instanceof Error ? e.message : "Update failed"); } finally { setSavingLabel(false); }
                              }} disabled={savingLabel} style={{ padding: "6px 10px", fontSize: "12px", border: "1px solid #0066cc", color: "#0066cc", background: "transparent", borderRadius: 4, cursor: savingLabel ? "not-allowed" : "pointer" }}>Save</button>
                              <button type="button" onClick={() => { setEditingSourceId(null); setEditingLabel(""); }} style={{ padding: "6px 10px", fontSize: "12px", border: "1px solid #666", color: "#666", background: "transparent", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            String(source.source_label || source.source_url || "—")
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ padding: "4px 8px", borderRadius: 3, fontSize: "12px", fontWeight: 600, backgroundColor: source.fetch_status === "DOWNLOADED" ? "#d1ecf1" : source.fetch_status === "FAILED" ? "#f8d7da" : "#fff3cd", color: source.fetch_status === "DOWNLOADED" ? "#0c5460" : source.fetch_status === "FAILED" ? "#721c24" : "#856404" }}>{String(source.fetch_status || "—")}</span>
                        </td>
                        <td style={{ padding: "12px" }}>{Number(source.linked_documents_count) || 0}</td>
                        <td style={{ padding: "12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {editingSourceId !== source.id ? (
                            <button type="button" onClick={() => { setEditingSourceId(source.id); setEditingLabel(String(source.source_label || "")); }} style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #0066cc", color: "#0066cc", background: "transparent", borderRadius: 4, cursor: "pointer" }}>Rename</button>
                          ) : null}
                          {source.id ? (
                            <a href={`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}/file`} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #28a745", color: "#28a745", background: "transparent", borderRadius: 4, textDecoration: "none" }}>View PDF</a>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Move this source back to Unassigned? It will no longer appear in this module and will show under unassigned library.")) return;
                              setMovingToPendingId(source.id);
                              try {
                                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}/move-to-pending`, { method: "POST" });
                                const j = await r.json().catch(() => ({}));
                                if (r.ok) loadSources(); else alert(j?.error || j?.message || "Move failed");
                              } catch (e: unknown) { alert(e instanceof Error ? e.message : "Move failed"); } finally { setMovingToPendingId(null); }
                            }}
                            disabled={movingToPendingId === source.id}
                            style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #6c757d", color: "#6c757d", background: "transparent", borderRadius: 4, cursor: movingToPendingId === source.id ? "not-allowed" : "pointer" }}
                          >
                            {movingToPendingId === source.id ? "Moving…" : "Move to unassigned"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Remove this source from the module? Ingested documents and chunks remain in the database but will no longer be linked to this source.")) return;
                              setRemovingSourceId(source.id);
                              try {
                                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}`, { method: "DELETE" });
                                const j = await r.json().catch(() => ({}));
                                if (r.ok) loadSources(); else alert(j?.error || j?.message || "Remove failed");
                              } catch (e: unknown) { alert(e instanceof Error ? e.message : "Remove failed"); } finally { setRemovingSourceId(null); }
                            }}
                            disabled={removingSourceId === source.id}
                            style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #dc3545", color: "#dc3545", background: "transparent", borderRadius: 4, cursor: removingSourceId === source.id ? "not-allowed" : "pointer" }}
                          >
                            {removingSourceId === source.id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Attached Evidence (from global registry) — shown after Module Uploads */}
              <h3 style={{ marginTop: 24, marginBottom: 12 }}>Attached Evidence (from global registry)</h3>
              {(!sourcesData.sources || sourcesData.sources.filter((s: ModuleSourceRow) => s.source_type === "CORPUS_POINTER").length === 0) ? (
                <div style={{ padding: 16, color: "#666", fontStyle: "italic", border: "1px solid #eee", borderRadius: 4 }}>None. Use &quot;Add / attach source&quot; → &quot;Attach from global registry&quot; to link evidence from the global registry.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Source</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Linked docs</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesData.sources.filter((s: ModuleSourceRow) => s.source_type === "CORPUS_POINTER").map((source: ModuleSourceRow) => (
                      <tr key={source.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px" }}>
                          {editingSourceId === source.id ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="text"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 }}
                                placeholder="Label"
                              />
                              <button type="button" onClick={async () => {
                                setSavingLabel(true);
                                try {
                                  const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_label: editingLabel }) });
                                  const j = await r.json().catch(() => ({}));
                                  if (r.ok) { setEditingSourceId(null); loadSources(); } else alert(j?.error || j?.message || "Update failed");
                                } catch (e: unknown) { alert(e instanceof Error ? e.message : "Update failed"); } finally { setSavingLabel(false); }
                              }} disabled={savingLabel} style={{ padding: "6px 10px", fontSize: "12px", border: "1px solid #0066cc", color: "#0066cc", background: "transparent", borderRadius: 4, cursor: savingLabel ? "not-allowed" : "pointer" }}>Save</button>
                              <button type="button" onClick={() => { setEditingSourceId(null); setEditingLabel(""); }} style={{ padding: "6px 10px", fontSize: "12px", border: "1px solid #666", color: "#666", background: "transparent", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 500 }}>{String(source.source_label || "Attached source")}</div>
                              {source.source_url && <a href={String(source.source_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#0066cc" }}>{String(source.source_url).length > 60 ? String(source.source_url).slice(0, 60) + "…" : String(source.source_url)}</a>}
                            </>
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>{Number(source.linked_documents_count) || 0}</td>
                        <td style={{ padding: "12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {editingSourceId !== source.id && (
                            <button type="button" onClick={() => { setEditingSourceId(source.id); setEditingLabel(String(source.source_label || "")); }} style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #0066cc", color: "#0066cc", background: "transparent", borderRadius: 4, cursor: "pointer" }}>Rename</button>
                          )}
                          {source.source_url && (
                            <a href={source.source_url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #28a745", color: "#28a745", background: "transparent", borderRadius: 4, textDecoration: "none" }}>View document</a>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Remove this source from the module? The document in the global registry is not deleted.")) return;
                              setRemovingSourceId(source.id);
                              try {
                                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(source.id)}`, { method: "DELETE" });
                                const j = await r.json().catch(() => ({}));
                                if (r.ok) loadSources(); else alert(j?.error || j?.message || "Remove failed");
                              } catch (e: unknown) { alert(e instanceof Error ? e.message : "Remove failed"); } finally { setRemovingSourceId(null); }
                            }}
                            disabled={removingSourceId === source.id}
                            style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #dc3545", color: "#dc3545", background: "transparent", borderRadius: 4, cursor: removingSourceId === source.id ? "not-allowed" : "pointer" }}
                          >
                            {removingSourceId === source.id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div>No sources data</div>
          )}

          {/* Add / attach source modal: Module sources first, then Attach from global registry */}
          {showAttachCorpus && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !attachCorpusSaving && setShowAttachCorpus(false)}>
              <div style={{ backgroundColor: "white", padding: 24, borderRadius: 8, maxWidth: 480, width: "90%", maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>Add / attach source</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachSourceTab("module");
                      loadSources();
                      setRegistrySourcesForModuleLoading(true);
                      fetch(`/api/admin/source-registry?category=module&moduleCode=${encodeURIComponent(moduleCode)}`)
                        .then((r) => r.json().catch(() => ({})))
                        .then((j) => { setRegistrySourcesForModule(Array.isArray(j?.sources) ? j.sources : []); setRegistrySourcesForModuleLoading(false); })
                        .catch(() => setRegistrySourcesForModuleLoading(false));
                    }}
                    style={{ padding: "6px 12px", border: attachSourceTab === "module" ? "2px solid #0066cc" : "1px solid #ddd", borderRadius: 4, background: attachSourceTab === "module" ? "#eff6ff" : "transparent", cursor: "pointer", fontWeight: attachSourceTab === "module" ? 600 : 400 }}
                  >
                    Module sources
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachSourceTab("pending");
                      setPendingLoading(true);
                      fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/pending`)
                        .then((r) => r.json().catch(() => ({})))
                        .then((j) => { setPendingSources(j?.pending ?? []); setPendingLoading(false); })
                        .catch(() => setPendingLoading(false));
                    }}
                    style={{ padding: "6px 12px", border: attachSourceTab === "pending" ? "2px solid #0066cc" : "1px solid #ddd", borderRadius: 4, background: attachSourceTab === "pending" ? "#eff6ff" : "transparent", cursor: "pointer", fontWeight: attachSourceTab === "pending" ? 600 : 400 }}
                  >
                    From unassigned
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachSourceTab("corpus");
                      setCorpusPickerLoading(true);
                      fetch("/api/admin/source-registry?category=corpus")
                        .then((r) => r.json().catch(() => ({})))
                        .then((j) => {
                          setCorpusPickerSources(Array.isArray(j?.sources) ? j.sources : []);
                        })
                        .catch(() => setCorpusPickerSources([]))
                        .finally(() => setCorpusPickerLoading(false));
                    }}
                    style={{ padding: "6px 12px", border: attachSourceTab === "corpus" ? "2px solid #0066cc" : "1px solid #ddd", borderRadius: 4, background: attachSourceTab === "corpus" ? "#eff6ff" : "transparent", cursor: "pointer", fontWeight: attachSourceTab === "corpus" ? 600 : 400 }}
                  >
                    Attach from global registry
                  </button>
                </div>
                {attachSourceTab === "module" ? (
                  <>
                    <p style={{ color: "#666", fontSize: "14px", marginBottom: 8 }}>Sources already in this module (uploads and URLs).</p>
                    {sourcesLoading ? (
                      <div style={{ color: "#666" }}>Loading…</div>
                    ) : (() => {
                      const moduleOnly = (sourcesData?.sources ?? []).filter((s: ModuleSourceRow) => s.source_type !== "CORPUS_POINTER");
                      return moduleOnly.length === 0 ? (
                        <p style={{ color: "#666", fontStyle: "italic" }}>No module uploads yet. Use <strong>Upload Module Source</strong> or <strong>Add from URL</strong> above.</p>
                      ) : (
                        <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #eee", borderRadius: 4, marginBottom: 16 }}>
                          {moduleOnly.map((s: ModuleSourceRow) => (
                            <div key={s.id} style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "14px" }}>
                              <strong>{String(s.source_label || s.source_url || s.id)}</strong>
                              <span style={{ fontSize: "12px", color: "#666", marginLeft: 8 }}>Already in this module</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <p style={{ color: "#666", fontSize: "14px", marginBottom: 8 }}>From source registry (scope includes this module).</p>
                    {registrySourcesForModuleLoading ? (
                      <div style={{ color: "#666" }}>Loading…</div>
                    ) : registrySourcesForModule.length === 0 ? (
                      <p style={{ color: "#666", fontStyle: "italic" }}>No source_registry entries with this module in scope. Entries appear here after module sources are ingested into the corpus or after running the backfill (e.g. <code style={{ fontSize: "12px" }}>npx tsx tools/corpus/backfill_module_sources_to_corpus.ts {moduleCode}</code>).</p>
                    ) : (
                      <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #eee", borderRadius: 4 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #ddd", background: "#f8f9fa" }}>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Title</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Scope</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, width: 80 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {registrySourcesForModule.map((s: { id: string; source_key?: string; title?: string; scope_tags?: string[] }) => (
                              <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                                <td style={{ padding: "8px 12px" }}>{String(s.title || s.source_key || s.id)}</td>
                                <td style={{ padding: "8px 12px", color: "#555" }}>{Array.isArray(s.scope_tags) ? s.scope_tags.join(", ") : "—"}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  {s.source_key ? (
                                    <a
                                      href={`/api/admin/source-registry/${encodeURIComponent(s.source_key)}/file`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ fontSize: "13px", padding: "4px 8px", textDecoration: "none", border: "1px solid #0071bc", borderRadius: 4, color: "#0071bc", background: "#fff" }}
                                      title="View document"
                                    >
                                      View
                                    </a>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : attachSourceTab === "pending" ? (
                  <>
                    <p style={{ color: "#666", fontSize: "14px", marginBottom: 8 }}>Ingested files not yet assigned to a module. Assign to this module to use them here.</p>
                    {pendingLoading ? (
                      <div style={{ color: "#666" }}>Loading…</div>
                    ) : pendingSources.length === 0 ? (
                      <p style={{ color: "#666", fontStyle: "italic" }}>No unassigned sources. Upload or ingest files to incoming first; they will appear here after ingestion.</p>
                    ) : (
                      <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #eee", borderRadius: 4 }}>
                        {pendingSources.map((p) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "14px" }}>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.label}>{p.label}</span>
                            <button
                              type="button"
                              disabled={!!assignPendingId}
                              onClick={async () => {
                                setAssignPendingId(p.id);
                                try {
                                  const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/assign-from-pending`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ source_id: p.id }),
                                  });
                                  const j = await r.json().catch(() => ({}));
                                  if (r.ok && j?.moved) {
                                    setShowAttachCorpus(false);
                                    loadSources();
                                  } else {
                                    alert(j?.error || "Assign failed");
                                  }
                                } catch (e: unknown) {
                                  alert(e instanceof Error ? e.message : "Assign failed");
                                } finally {
                                  setAssignPendingId(null);
                                }
                              }}
                              style={{ marginLeft: 8, padding: "6px 12px", border: "1px solid #0066cc", borderRadius: 4, background: "#0066cc", color: "white", cursor: assignPendingId ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                            >
                              {assignPendingId === p.id ? "Assigning…" : "Assign to this module"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ color: "#666", fontSize: "14px", marginBottom: 8 }}>Select evidence from the global registry. No file is copied.</p>
                    {corpusPickerLoading ? (
                      <div style={{ color: "#666" }}>Loading…</div>
                    ) : corpusPickerSources.length === 0 ? (
                      <p style={{ color: "#666", fontStyle: "italic" }}>No sources in the global registry. Add evidence via the Source Registry page first.</p>
                    ) : (
                      <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #eee", borderRadius: 4 }}>
                        {corpusPickerSources.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={async () => {
                              setAttachCorpusSaving(true);
                              try {
                                const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/attach-corpus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ corpus_source_id: s.id }) });
                                const j = await r.json().catch(() => ({}));
                                if (r.ok) { setShowAttachCorpus(false); loadSources(); } else alert(j?.message || j?.error || "Attach failed");
                              } catch (e: unknown) { alert(e instanceof Error ? e.message : "Attach failed"); } finally { setAttachCorpusSaving(false); }
                            }}
                            disabled={attachCorpusSaving}
                            style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left", border: "none", borderBottom: "1px solid #eee", background: "transparent", cursor: attachCorpusSaving ? "not-allowed" : "pointer", fontSize: "14px" }}
                          ><strong>{s.title || s.source_key}</strong><br /><span style={{ fontSize: "12px", color: "#666" }}>{s.source_key} {s.publisher ? ` · ${s.publisher}` : ""}</span></button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div style={{ marginTop: 16 }}><button onClick={() => !attachCorpusSaving && setShowAttachCorpus(false)} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}>Cancel</button></div>
              </div>
            </div>
          )}

          {/* Upload Module Source modal */}
          {showUploadModule && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !uploadModuleSaving && setShowUploadModule(false)}>
              <div style={{ backgroundColor: "white", padding: 24, borderRadius: 8, maxWidth: 420, width: "90%" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>Upload Module Source</h3>
                <p style={{ color: "#666", fontSize: "14px" }}>File is stored under module storage only. It is not added to the global registry.</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const file = fd.get("file") as File | null;
                    if (!file || file.size === 0) { alert("Choose a file"); return; }
                    setUploadModuleSaving(true);
                    try {
                      const form = new FormData(); form.set("file", file); form.set("source_label", (fd.get("source_label") as string) || file.name);
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/upload`, { method: "POST", body: form });
                      const j = await r.json().catch(() => ({}));
                      if (r.ok) { setShowUploadModule(false); loadSources(); (e.target as HTMLFormElement).reset(); } else alert(j?.message || j?.error || "Upload failed");
                    } catch (err: unknown) { alert(err instanceof Error ? err.message : "Upload failed"); } finally { setUploadModuleSaving(false); }
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}
                >
                  <div><label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>File</label><input name="file" type="file" required style={{ width: "100%" }} /></div>
                  <div><label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Label (optional)</label><input name="source_label" type="text" placeholder="e.g. Site policy 2024" style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }} /></div>
                  <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => !uploadModuleSaving && setShowUploadModule(false)} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}>Cancel</button><button type="submit" disabled={uploadModuleSaving} style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: uploadModuleSaving ? "not-allowed" : "pointer" }}>{uploadModuleSaving ? "Uploading…" : "Upload"}</button></div>
                </form>
              </div>
            </div>
          )}

          {/* Add from URL modal */}
          {showAddFromUrl && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !addFromUrlSaving && setShowAddFromUrl(false)}>
              <div style={{ backgroundColor: "white", padding: 24, borderRadius: 8, maxWidth: 480, width: "90%" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>Add source from URL</h3>
                <p style={{ color: "#666", fontSize: "14px" }}>The file is downloaded from the URL and stored under module storage only. Supports PDF, HTML, and text. Max 100MB.</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const url = addFromUrlUrl.trim();
                    if (!url) { alert("URL is required"); return; }
                    setAddFromUrlSaving(true);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/add-from-url`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source_url: url, source_label: addFromUrlLabel.trim() || undefined }),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (r.ok) {
                        setShowAddFromUrl(false);
                        setAddFromUrlUrl("");
                        setAddFromUrlLabel("");
                        loadSources();
                      } else {
                        alert(j?.message || j?.error || "Add from URL failed");
                      }
                    } catch (err: unknown) {
                      alert(err instanceof Error ? err.message : "Add from URL failed");
                    } finally {
                      setAddFromUrlSaving(false);
                    }
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>URL *</label>
                    <input
                      type="url"
                      value={addFromUrlUrl}
                      onChange={(e) => setAddFromUrlUrl(e.target.value)}
                      placeholder="https://example.com/document.pdf"
                      required
                      style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Label (optional)</label>
                    <input
                      type="text"
                      value={addFromUrlLabel}
                      onChange={(e) => setAddFromUrlLabel(e.target.value)}
                      placeholder="e.g. NFPA report 2024"
                      style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => !addFromUrlSaving && setShowAddFromUrl(false)} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                    <button type="submit" disabled={addFromUrlSaving} style={{ padding: "8px 16px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: 4, cursor: addFromUrlSaving ? "not-allowed" : "pointer" }}>{addFromUrlSaving ? "Downloading…" : "Add"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "comprehension" && (
        <div style={{ marginTop: 24 }}>
          {selectedStandardKey === "PHYSICAL_SECURITY_PLAN" && (
            <div style={{ padding: 16, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4 }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#166534" }}>
                Plan modules do not use comprehension diagnostics. Structure is derived from the plan template or guide; review is limited to the presence of documented elements.
              </p>
            </div>
          )}
          {selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" && comprehensionLoading && (
            <p style={{ color: "#666" }}>Loading comprehension summary…</p>
          )}
          {selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" && !comprehensionLoading && comprehensionSummary && comprehensionSummary.status === "missing" && (
            <>
              <div style={{ padding: 16, backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 4, marginBottom: 16 }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#92400e" }}>Comprehension not built for this module.</p>
                <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#78350f" }}>Build comprehension to run the same diagnostic step used before standards generation. Then you can view metrics and generate a synopsis.</p>
                <button
                  type="button"
                  disabled={comprehensionBuildRunning}
                  onClick={async () => {
                    setComprehensionBuildRunning(true);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/comprehension/build`, { method: "POST" });
                      const j = await r.json().catch(() => ({}));
                      if (r.ok) {
                        await loadComprehension();
                      } else {
                        alert(j?.message || j?.error || "Build failed");
                      }
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Build failed");
                    } finally {
                      setComprehensionBuildRunning(false);
                    }
                  }}
                  style={{ marginTop: 12, padding: "8px 16px", backgroundColor: "#d97706", color: "white", border: "none", borderRadius: 4, cursor: comprehensionBuildRunning ? "not-allowed" : "pointer", fontWeight: 500 }}
                >
                  {comprehensionBuildRunning ? "Building…" : "Build comprehension now"}
                </button>
              </div>
              <p style={{ color: "#666", fontSize: "14px" }}>Synopsis generation is disabled until comprehension rows exist.</p>
            </>
          )}
          {selectedStandardKey !== "PHYSICAL_SECURITY_PLAN" && !comprehensionLoading && comprehensionSummary && comprehensionSummary.status === "present" && (
            <>
              <div style={{ marginBottom: 24, padding: 16, backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Status</h4>
                <p style={{ margin: 0 }}><strong>Rows:</strong> {comprehensionSummary.comprehension_rows}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Last updated:</strong> {comprehensionSummary.last_updated_at ? new Date(comprehensionSummary.last_updated_at).toLocaleString() : "—"}</p>
                {lastBuildEffectiveModel && (
                  <p style={{ margin: "4px 0 0 0" }}><strong>Model used (last rebuild):</strong> {lastBuildEffectiveModel}</p>
                )}
                {comprehensionSummary.model_used_distribution && Object.keys(comprehensionSummary.model_used_distribution).length > 0 && (
                  <p style={{ margin: "4px 0 0 0" }}><strong>Model distribution:</strong> {Object.entries(comprehensionSummary.model_used_distribution).map(([m, n]) => `${m}: ${n}`).join(", ")}</p>
                )}
                <button
                  type="button"
                  disabled={comprehensionBuildRunning}
                  onClick={async () => {
                    if (!confirm("Delete existing comprehension rows and rerun on all chunks? This may take a few minutes.")) return;
                    setComprehensionBuildRunning(true);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/comprehension/build`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ forceRebuild: true }),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (r.ok) {
                        if (j.effective_model != null) setLastBuildEffectiveModel(String(j.effective_model));
                        await loadComprehension();
                      } else {
                        alert(j?.message || j?.error || "Rebuild failed");
                      }
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Rebuild failed");
                    } finally {
                      setComprehensionBuildRunning(false);
                    }
                  }}
                  style={{ marginTop: 12, padding: "8px 16px", backgroundColor: "#0369a1", color: "white", border: "none", borderRadius: 4, cursor: comprehensionBuildRunning ? "not-allowed" : "pointer", fontWeight: 500 }}
                >
                  {comprehensionBuildRunning ? "Rebuilding…" : "Rebuild comprehension"}
                </button>
              </div>
              <div style={{ marginBottom: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 4 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Metrics</h4>
                <p style={{ margin: 0 }}><strong>By priority:</strong> 0: {comprehensionSummary.by_priority["0"]}, 1 (LOW): {comprehensionSummary.by_priority["1"]}, 2 (MEDIUM): {comprehensionSummary.by_priority["2"]}, 3 (HIGH): {comprehensionSummary.by_priority["3"]}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Supports question generation (true):</strong> {comprehensionSummary.supports_qg_true}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Life safety signal:</strong> false={comprehensionSummary.life_safety_hist["0"]}, true={comprehensionSummary.life_safety_hist["1"]}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Ops signal:</strong> false={comprehensionSummary.ops_hist["0"]}, true={comprehensionSummary.ops_hist["1"]}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Cyber awareness signal:</strong> false={comprehensionSummary.cyber_awareness_hist["0"]}, true={comprehensionSummary.cyber_awareness_hist["1"]}</p>
                {comprehensionSummary.top_topics.length > 0 && (
                  <p style={{ margin: "8px 0 0 0" }}><strong>Top topics:</strong> {comprehensionSummary.top_topics.slice(0, 10).map((t) => t.topic).join(", ")}</p>
                )}
                {comprehensionSummary.top_domains.length > 0 && (
                  <p style={{ margin: "4px 0 0 0" }}><strong>Top domains:</strong> {comprehensionSummary.top_domains.map((d) => d.domain).join(", ")}</p>
                )}
              </div>
              <div style={{ marginBottom: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 4 }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Synopsis</h4>
                <button
                  type="button"
                  disabled={comprehensionSynopsisLoading}
                  onClick={async () => {
                    setComprehensionSynopsisLoading(true);
                    setComprehensionSynopsis(null);
                    try {
                      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/comprehension/summary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: true }) });
                      const j = await r.json().catch(() => ({}));
                      if (r.ok && j.synopsis != null) setComprehensionSynopsis(j.synopsis);
                      else if (j.error === "NO_COMPREHENSION_ROWS") setComprehensionSynopsis(null);
                      else if (j.error) console.error("Synopsis error:", j.error);
                    } finally {
                      setComprehensionSynopsisLoading(false);
                    }
                  }}
                  style={{ marginBottom: 12, padding: "8px 16px", backgroundColor: "#0066cc", color: "white", border: "none", borderRadius: 4, cursor: comprehensionSynopsisLoading ? "not-allowed" : "pointer", fontWeight: 500 }}
                >
                  {comprehensionSynopsisLoading ? "Generating…" : "Regenerate synopsis"}
                </button>
                {comprehensionSynopsis ? (
                  <div style={{ whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.5, color: "#374151" }}>{comprehensionSynopsis}</div>
                ) : (
                  <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>Click &quot;Regenerate synopsis&quot; to generate an LLM summary from the comprehension evidence (diagnostic only).</p>
                )}
              </div>
              {comprehensionSummary.sample_chunks.length > 0 && (
                <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 4 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 12 }}>Sample chunks ({comprehensionSummary.sample_chunks.length})</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc" }}>
                    {comprehensionSummary.sample_chunks.slice(0, 6).map((c) => (
                      <li key={c.chunk_id} style={{ marginBottom: 12 }}>
                        <code style={{ fontSize: "12px" }}>{c.locator}</code> [{c.generation_priority ?? "—"}]
                        {c.explicit_topics.length > 0 && <span style={{ marginLeft: 8 }}>topics: {c.explicit_topics.join(", ")}</span>}
                        <div style={{ marginTop: 4, fontSize: "13px", color: "#4b5563" }}>{c.excerpt ? `${c.excerpt.slice(0, 200)}…` : "—"}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add question modal */}
      {showAddQ && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !addSaving && setShowAddQ(false)}>
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 8, maxWidth: 480, width: "90%", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Add module question</h3>
            {addApiError && (
              <div style={{ marginBottom: 12, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4, fontSize: "14px" }}>
                <div><strong>{addApiError.message}</strong></div>
                {addApiError.code && <div style={{ marginTop: 4 }}>code: {addApiError.code}</div>}
                {addApiError.request_id && <div style={{ marginTop: 2, fontSize: "12px", opacity: 0.9 }}>request_id: {addApiError.request_id}</div>}
                {addApiError.details != null && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Details</summary>
                    <pre style={{ marginTop: 4, padding: 8, background: "#fff", fontSize: "11px", overflow: "auto", maxHeight: 120 }}>{JSON.stringify(addApiError.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            )}
            {addError && !addApiError && <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4, fontSize: "14px" }}>{addError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Question text *</label>
                <textarea value={addQForm.question_text} onChange={(e) => setAddQForm((f) => ({ ...f, question_text: e.target.value }))} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4, fontFamily: "inherit" }} placeholder="Enter question text..." />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Discipline *</label>
                <select value={addQForm.discipline_id} onChange={(e) => setAddQForm((f) => ({ ...f, discipline_id: e.target.value, discipline_subtype_id: "" }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}>
                  <option value="">Select discipline</option>
                  {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Subtype *</label>
                <select value={addQForm.discipline_subtype_id} onChange={(e) => setAddQForm((f) => ({ ...f, discipline_subtype_id: e.target.value }))} disabled={!addQForm.discipline_id} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4, opacity: addQForm.discipline_id ? 1 : 0.7 }}>
                  <option value="">Select subtype</option>
                  {(disciplines.find((d) => d.id === addQForm.discipline_id)?.discipline_subtypes || []).filter((s: { id: string; name?: string; is_active?: boolean }) => s.is_active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Asset or location *</label>
                <input type="text" value={addQForm.asset_or_location} onChange={(e) => setAddQForm((f) => ({ ...f, asset_or_location: e.target.value }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }} placeholder="e.g. EV parking area" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Event trigger *</label>
                <select value={addQForm.event_trigger} onChange={(e) => setAddQForm((f) => ({ ...f, event_trigger: (e.target.value as "FIRE" | "TAMPERING" | "IMPACT" | "OUTAGE" | "OTHER") }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}>
                  <option value="FIRE">FIRE</option><option value="TAMPERING">TAMPERING</option><option value="IMPACT">IMPACT</option><option value="OUTAGE">OUTAGE</option><option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => !addSaving && setShowAddQ(false)} disabled={addSaving} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 4, cursor: addSaving ? "not-allowed" : "pointer", opacity: addSaving ? 0.6 : 1 }}>Cancel</button>
              <button
                onClick={async () => {
                  if (!addQForm.question_text.trim() || !addQForm.discipline_id || !addQForm.discipline_subtype_id || !addQForm.asset_or_location.trim()) { setAddError("Question text, discipline, subtype, and asset/location are required."); setAddApiError(null); return; }
                  setAddSaving(true); setAddError(null); setAddApiError(null);
                  try {
                    const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_text: addQForm.question_text.trim(), discipline_id: addQForm.discipline_id, discipline_subtype_id: addQForm.discipline_subtype_id, asset_or_location: addQForm.asset_or_location.trim(), event_trigger: addQForm.event_trigger }) });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      setAddApiError({ message: j?.message || j?.error || "Failed to add question", code: j?.code, request_id: j?.request_id, details: j?.details });
                      return;
                    }
                    setShowAddQ(false); await loadData();
                  } catch (e: unknown) {
                    setAddApiError({ message: e instanceof Error ? e.message : "Failed to add question", code: "NETWORK_ERROR", details: { error: String(e) } });
                  } finally { setAddSaving(false); }
                }}
                disabled={addSaving} style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: addSaving ? "not-allowed" : "pointer", opacity: addSaving ? 0.6 : 1 }}
              >{addSaving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add OFC modal — template-driven: discipline_subtype_id selects OFC template; ofc_text from doctrine */}
      {showAddO && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !addSaving && setShowAddO(false)}>
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 8, maxWidth: 480, width: "90%", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Add module OFC</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: 12 }}>OFC text is taken from the template for the selected subtype. Optionally link a source.</p>
            {addApiError && (
              <div style={{ marginBottom: 12, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4, fontSize: "14px" }}>
                <div><strong>{addApiError.message}</strong></div>
                {addApiError.code && <div style={{ marginTop: 4 }}>code: {addApiError.code}</div>}
                {addApiError.request_id && <div style={{ marginTop: 2, fontSize: "12px", opacity: 0.9 }}>request_id: {addApiError.request_id}</div>}
                {addApiError.details != null && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Details</summary>
                    <pre style={{ marginTop: 4, padding: 8, background: "#fff", fontSize: "11px", overflow: "auto", maxHeight: 120 }}>{JSON.stringify(addApiError.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            )}
            {addError && !addApiError && <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 4, fontSize: "14px" }}>{addError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Discipline *</label>
                <select value={addOForm.discipline_id} onChange={(e) => setAddOForm((f) => ({ ...f, discipline_id: e.target.value, discipline_subtype_id: "" }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}>
                  <option value="">Select discipline</option>
                  {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Subtype *</label>
                <select value={addOForm.discipline_subtype_id} onChange={(e) => setAddOForm((f) => ({ ...f, discipline_subtype_id: e.target.value }))} disabled={!addOForm.discipline_id} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4, opacity: addOForm.discipline_id ? 1 : 0.7 }}>
                  <option value="">{addOForm.discipline_id ? "Select subtype" : "Select discipline first"}</option>
                  {(addOForm.discipline_id ? (disciplines.find((d) => d.id === addOForm.discipline_id)?.discipline_subtypes || []) : []).filter((s: { id: string; name?: string; is_active?: boolean }) => s.is_active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {(() => {
                const moduleOnly = (sourcesData?.sources ?? []).filter((s: ModuleSourceRow) => s.source_type !== "CORPUS_POINTER");
                return moduleOnly.length > 0;
              })() && (
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Link to source (optional)</label>
                  <select
                    style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                    value=""
                    onChange={(e) => {
                      const id = e.target.value; if (!id) return;
                      const s = sourcesData?.sources?.find((x: ModuleSourceRow) => x.id === id); if (s) setAddOForm((f) => ({ ...f, source_url: s.source_url || "", source_label: s.source_label || s.source_url || "" }));
                    }}
                  >
                    <option value="">— None —</option>
                    {(sourcesData?.sources ?? []).filter((s: ModuleSourceRow) => s.source_type !== "CORPUS_POINTER").map((s: ModuleSourceRow) => <option key={s.id} value={s.id}>{String(s.source_label || s.source_url || s.id)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Source URL (optional)</label>
                <input type="text" value={addOForm.source_url} onChange={(e) => setAddOForm((f) => ({ ...f, source_url: e.target.value }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }} placeholder="https://..." />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>Source label (optional)</label>
                <input type="text" value={addOForm.source_label} onChange={(e) => setAddOForm((f) => ({ ...f, source_label: e.target.value }))} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }} placeholder="e.g. NFPA 1 (2024)" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => !addSaving && setShowAddO(false)} disabled={addSaving} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 4, cursor: addSaving ? "not-allowed" : "pointer", opacity: addSaving ? 0.6 : 1 }}>Cancel</button>
              <button
                onClick={async () => {
                  if (!addOForm.discipline_subtype_id) { setAddError("Subtype is required. Select a discipline, then a subtype with an OFC template."); setAddApiError(null); return; }
                  setAddSaving(true); setAddError(null); setAddApiError(null);
                  try {
                    const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/ofcs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discipline_subtype_id: addOForm.discipline_subtype_id, source_url: addOForm.source_url || undefined, source_label: addOForm.source_label || undefined }) });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      setAddApiError({ message: j?.message || j?.error || "Failed to add OFC", code: j?.code, request_id: j?.request_id, details: j?.details });
                      return;
                    }
                    setShowAddO(false); await loadData();
                  } catch (e: unknown) {
                    setAddApiError({ message: e instanceof Error ? e.message : "Failed to add OFC", code: "NETWORK_ERROR", details: { error: String(e) } });
                  } finally { setAddSaving(false); }
                }}
                disabled={addSaving} style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: addSaving ? "not-allowed" : "pointer", opacity: addSaving ? 0.6 : 1 }}
              >{addSaving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "vofcs" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, fontSize: "14px", color: "#1e40af" }}>
            <strong>Module VOFCs:</strong> Options for Consideration specific to this module. These are separate from global OFCs and are loaded from module seed data (e.g., VOFC_Library.xlsx).
          </div>
          {vofcsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading module VOFCs...</div>
          ) : vofcsData ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>Module VOFCs ({vofcsData.count})</h2>
              </div>
              {vofcsData.count === 0 ? (
                <div style={{ color: "#999", fontStyle: "italic", padding: 24 }}>
                  No module VOFCs found for this module. Load module VOFCs using the module seed loader.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {vofcsData.rows.map((vofc: VofcRow, idx: number) => (
                    <div
                      key={String(vofc.id ?? idx)}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        padding: 16,
                        backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{String(vofc.title ?? "")}</h3>
                      </div>
                      <div style={{ marginTop: 8, lineHeight: 1.6, color: "#333" }}>{String(vofc.vofc_text ?? "")}</div>
                      {vofc.tags && Array.isArray(vofc.tags) && (vofc.tags as string[]).length > 0 ? (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(vofc.tags as string[]).map((tag: string, ti: number) => (
                            <span
                              key={ti}
                              style={{
                                padding: "2px 8px",
                                backgroundColor: "#e3f2fd",
                                color: "#1976d2",
                                borderRadius: 3,
                                fontSize: "12px",
                              }}
                            >
                              {String(tag ?? "")}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {vofc.citations && Array.isArray(vofc.citations) && vofc.citations.length > 0 ? (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: 6 }}>Citations:</div>
                          {vofc.citations.map((cit: Record<string, unknown>, ci: number) => {
                            const loc = cit.locator_json as { sheet?: string; row?: string } | undefined;
                            return (
                            <div key={ci} style={{ marginTop: 4, fontSize: "13px", color: "#555" }}>
                              {cit.locator_type === "XLSX_SHEET_ROW" && loc ? (
                                <span>
                                  Sheet: <code>{loc.sheet ?? "—"}</code> / Row: <code>{loc.row ?? "—"}</code>
                                </span>
                              ) : (
                                <span>
                                  {String(cit.locator_type || "Unknown")} {cit.locator_json != null ? `(${JSON.stringify(cit.locator_json)})` : ""}
                                </span>
                              )}
                            </div>
                          );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#999", fontStyle: "italic", padding: 24 }}>Click the &quot;Module VOFCs&quot; tab to load data.</div>
          )}
        </div>
      )}
    </div>
  );
}
