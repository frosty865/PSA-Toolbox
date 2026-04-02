"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type TabId = "modules" | "build" | "module-data" | "overview";

interface ModuleRow {
  module_code: string;
  module_name?: string | null;
  description?: string | null;
  status?: string | null;
  question_count: number;
}

function ModuleManagementInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("modules");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && ["modules", "build", "module-data", "overview"].includes(t)) {
      setActiveTab(t as TabId);
    }
  }, [searchParams]);

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    router.replace(`/admin/module-management?tab=${id}`, { scroll: false });
  };

  // Modules tab state
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  // Process Incoming PDFs modal
  const [processModalModule, setProcessModalModule] = useState<string | null>(null);
  const [processDryRun, setProcessDryRun] = useState(true);
  const [processLimit, setProcessLimit] = useState("");
  const [processPdfDir, setProcessPdfDir] = useState("");
  const [processAdvanced, setProcessAdvanced] = useState(false);
  const [processRunning, setProcessRunning] = useState(false);
  const [processResult, setProcessResult] = useState<{
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    command: string;
    dryRun?: boolean;
  } | null>(null);

  // Delete module modal
  const [deleteModalModule, setDeleteModalModule] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteRunning, setDeleteRunning] = useState(false);

  // Deactivate (set status to DRAFT) so module can be deleted
  const [deactivatingCode, setDeactivatingCode] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "modules") loadModules();
  }, [activeTab]);

  const loadModules = async () => {
    try {
      setLoadingModules(true);
      setModuleError(null);
      const r = await fetch("/api/admin/modules/library", { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.message || data?.error || "Failed to load modules");
      }
      const rows: ModuleRow[] = (data.modules || []).map((m: Record<string, unknown>) => ({
        module_code: String(m.module_code ?? ''),
        module_name: (m.module_name as string | null) ?? null,
        description: (m.description as string | null) ?? null,
        status: (m.status as string | null) ?? null,
        question_count: Number(m.question_count ?? 0),
      }));
      setModules(rows);
    } catch (e) {
      setModuleError(e instanceof Error ? e.message : "Failed to load modules");
      setModules([]);
    } finally {
      setLoadingModules(false);
    }
  };

  const handleDeactivateModule = async (moduleCode: string) => {
    try {
      setDeactivatingCode(moduleCode);
      setModuleError(null);
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.message || data?.error || "Failed to deactivate module");
      }
      await loadModules();
    } catch (e) {
      setModuleError(e instanceof Error ? e.message : "Failed to deactivate module");
    } finally {
      setDeactivatingCode(null);
    }
  };

  const handleDeleteModule = async () => {
    if (!deleteModalModule) return;
    if (deleteConfirmText !== deleteModalModule) {
      setModuleError("Module code does not match. Please type the module code exactly to confirm deletion.");
      return;
    }

    try {
      setDeleteRunning(true);
      setModuleError(null);
      const r = await fetch(`/api/admin/modules/${encodeURIComponent(deleteModalModule)}`, {
        method: "DELETE",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Check if it's the specific "only draft modules" error
        if (r.status === 409 && data?.error?.includes("Only draft modules can be deleted")) {
          throw new Error("Only draft modules can be deleted. Active modules must be deactivated first by changing their status to DRAFT.");
        }
        throw new Error(data?.message || data?.error || "Failed to delete module");
      }
      // Close modal and reload modules
      setDeleteModalModule(null);
      setDeleteConfirmText("");
      await loadModules();
    } catch (e) {
      setModuleError(e instanceof Error ? e.message : "Failed to delete module");
    } finally {
      setDeleteRunning(false);
    }
  };

  const runProcessIncomingPdfs = async () => {
    if (!processModalModule) return;
    if (!processDryRun && !confirm("This will copy files and write to the database.")) return;
    setProcessRunning(true);
    setProcessResult(null);
    try {
      const limitVal = processLimit.trim() ? parseInt(processLimit, 10) : null;
      const r = await fetch(
        `/api/admin/modules/${encodeURIComponent(processModalModule)}/process-incoming-pdfs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: processDryRun,
            limit: limitVal != null && !Number.isNaN(limitVal) ? limitVal : null,
            pdfDir: processPdfDir.trim() || null,
          }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProcessResult({
          ok: false,
          exitCode: -1,
          stdout: "",
          stderr: data?.message || data?.error || String(r.status) || "Request failed",
          command: "",
          dryRun: processDryRun,
        });
        return;
      }
      setProcessResult({
        ok: data.ok ?? false,
        exitCode: data.exitCode ?? -1,
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        command: data.command ?? "",
        dryRun: processDryRun,
      });
    } catch (e) {
      setProcessResult({
        ok: false,
        exitCode: -1,
        stdout: "",
        stderr: e instanceof Error ? e.message : "Request failed",
        command: "",
        dryRun: processDryRun,
      });
    } finally {
      setProcessRunning(false);
    }
  };

  const tabBarStyle = {
    display: "flex" as const,
    gap: "var(--spacing-sm)",
    borderBottom: "2px solid var(--cisa-gray-light)",
    marginBottom: "var(--spacing-lg)",
  };

  const tabBtnStyle = (active: boolean) => ({
    padding: "var(--spacing-sm) var(--spacing-md)",
    backgroundColor: active ? "var(--cisa-blue)" : "transparent",
    color: active ? "#ffffff" : "var(--cisa-gray-dark)",
    border: "none",
    borderBottom: active ? "2px solid var(--cisa-blue)" : "2px solid transparent",
    borderRadius: "var(--border-radius) var(--border-radius) 0 0",
    fontSize: "var(--font-size-sm)",
    fontWeight: active ? 600 : 400,
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "var(--spacing-xs)",
    transition: "all 0.2s ease",
  });

  const cardLinkBase = {
    padding: "var(--spacing-lg)",
    borderRadius: "var(--border-radius)",
    textDecoration: "none" as const,
    color: "inherit",
    display: "block",
    transition: "background-color 0.2s, border-color 0.2s",
  };

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Module Management</h1>
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--cisa-gray)",
            lineHeight: 1.6,
            marginTop: "var(--spacing-md)",
            maxWidth: "800px",
          }}
        >
          Build, manage, and curate modules. Work module‑first: questions, OFCs, and sources live in the module.
        </p>
      </div>

      {/* Tabs — mirror Assessment Management */}
      <div style={tabBarStyle}>
        {[
          { id: "modules" as const, label: "Modules", icon: "📦" },
          { id: "build" as const, label: "Build", icon: "🔨" },
          { id: "module-data" as const, label: "Module Data", icon: "🔬" },
          { id: "overview" as const, label: "Overview", icon: "📋" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={tabBtnStyle(activeTab === tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Modules Tab */}
      {activeTab === "modules" && (
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--spacing-md)",
                marginBottom: "var(--spacing-md)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, margin: 0 }}>
                  Module List ({modules.length})
                </h2>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: "var(--spacing-xs) 0 0" }}>
                  Create modules via the wizard or import from JSON.
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-sm)", alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href="/admin/modules/new"
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    backgroundColor: "var(--cisa-blue)",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                  }}
                >
                  + New Module
                </Link>
                <Link
                  href="/admin/modules/import"
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    border: "1px solid var(--cisa-gray-light)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-sm)",
                    color: "inherit",
                    textDecoration: "none",
                    backgroundColor: "#fff",
                  }}
                >
                  Import from JSON
                </Link>
                <Link
                  href="/admin/modules"
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    border: "1px solid var(--cisa-gray-light)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-sm)",
                    color: "inherit",
                    textDecoration: "none",
                    backgroundColor: "#fff",
                  }}
                >
                  View all
                </Link>
                <button
                  onClick={loadModules}
                  className="btn btn-secondary"
                  style={{ fontSize: "var(--font-size-sm)" }}
                  disabled={loadingModules}
                >
                  {loadingModules ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {moduleError && (
              <div
                style={{
                  padding: "var(--spacing-sm)",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--border-radius)",
                  color: "#991b1b",
                  marginBottom: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Error: {moduleError}
              </div>
            )}

            {loadingModules && modules.length === 0 ? (
              <p>Loading modules…</p>
            ) : modules.length === 0 ? (
              <p
                style={{
                  color: "var(--cisa-gray)",
                  textAlign: "center",
                  padding: "var(--spacing-xl)",
                }}
              >
                No modules found
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--cisa-gray-light)" }}>
                      <th
                        style={{
                          padding: "var(--spacing-sm)",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Module Code
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-sm)",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-sm)",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-sm)",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Questions
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-sm)",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => (
                      <tr
                        key={m.module_code}
                        style={{ borderBottom: "1px solid var(--cisa-gray-light)" }}
                      >
                        <td style={{ padding: "var(--spacing-sm)", fontFamily: "monospace" }}>
                          {m.module_code}
                        </td>
                        <td style={{ padding: "var(--spacing-sm)" }}>
                          {m.module_name || "—"}
                        </td>
                        <td style={{ padding: "var(--spacing-sm)" }}>
                          {m.status || "—"}
                        </td>
                        <td style={{ padding: "var(--spacing-sm)" }}>
                          {m.question_count}
                        </td>
                        <td style={{ padding: "var(--spacing-sm)" }}>
                          <div style={{ display: "flex", gap: "var(--spacing-sm)", flexWrap: "wrap" }}>
                            <Link
                              href={`/admin/modules/${encodeURIComponent(m.module_code)}`}
                              style={{
                                padding: "4px 12px",
                                backgroundColor: "var(--cisa-blue)",
                                color: "#ffffff",
                                textDecoration: "none",
                                borderRadius: "var(--border-radius)",
                                fontSize: "var(--font-size-sm)",
                                display: "inline-block",
                              }}
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setProcessModalModule(m.module_code);
                                setProcessResult(null);
                                setProcessDryRun(true);
                                setProcessLimit("");
                                setProcessPdfDir("");
                                setProcessAdvanced(false);
                              }}
                              style={{
                                padding: "4px 12px",
                                border: "1px solid var(--cisa-gray-light)",
                                borderRadius: "var(--border-radius)",
                                fontSize: "var(--font-size-sm)",
                                backgroundColor: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Process Incoming PDFs
                            </button>
                            {m.status === "DRAFT" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteModalModule(m.module_code);
                                  setDeleteConfirmText("");
                                  setModuleError(null);
                                }}
                                style={{
                                  padding: "4px 12px",
                                  border: "1px solid #dc2626",
                                  borderRadius: "var(--border-radius)",
                                  fontSize: "var(--font-size-sm)",
                                  backgroundColor: "#fff",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateModule(m.module_code)}
                                  disabled={deactivatingCode === m.module_code}
                                  title="Set status to DRAFT so you can delete this module"
                                  style={{
                                    padding: "4px 12px",
                                    border: "1px solid #d97706",
                                    borderRadius: "var(--border-radius)",
                                    fontSize: "var(--font-size-sm)",
                                    backgroundColor: "#fff",
                                    color: "#d97706",
                                    cursor: deactivatingCode === m.module_code ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {deactivatingCode === m.module_code ? "Deactivating…" : "Deactivate"}
                                </button>
                                <button
                                  type="button"
                                  disabled
                                  title={`Only draft modules can be deleted. Click Deactivate first, then Delete.`}
                                  style={{
                                    padding: "4px 12px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "var(--border-radius)",
                                    fontSize: "var(--font-size-sm)",
                                    backgroundColor: "#f3f4f6",
                                    color: "#9ca3af",
                                    cursor: "not-allowed",
                                  }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Build Tab */}
      {activeTab === "build" && (
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
            <Link
              href="/admin/module-drafts/build"
              style={{
                ...cardLinkBase,
                border: "1px solid #bfdbfe",
                backgroundColor: "#eff6ff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#dbeafe";
                e.currentTarget.style.borderColor = "var(--cisa-blue)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#eff6ff";
                e.currentTarget.style.borderColor = "#bfdbfe";
              }}
            >
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "var(--spacing-sm)" }}>
                🔨
              </span>
              <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                Build Module from Sources
              </h3>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: 0 }}>
                Automated draft builder: pick sources, get a draft module shell and suggested question stubs. Review and accept before publishing. No OFCs auto-generated.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Module Data Tab */}
      {activeTab === "module-data" && (
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
            <Link
              href="/admin/module-data"
              style={{
                ...cardLinkBase,
                border: "1px solid #fef3c7",
                backgroundColor: "#fffbeb",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fef3c7";
                e.currentTarget.style.borderColor = "#f59e0b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fffbeb";
                e.currentTarget.style.borderColor = "#fef3c7";
              }}
            >
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "var(--spacing-sm)" }}>
                🔬
              </span>
              <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                Module Data (MODULE OFC queue)
              </h3>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: 0 }}>
                <strong>Global, not scoped to a module.</strong> MODULE‑origin candidates in the candidate queue. OFCs in a module&apos;s Overview do <em>not</em> appear here. Prefer adding OFCs via the module&apos;s Overview to avoid cross‑contamination. Module OFCs can be registered into this queue via the <strong>Register</strong> action on a module&apos;s Overview (explicit, not automatic).
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div>
          <div className="card">
            <p
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--cisa-gray)",
                marginBottom: "var(--spacing-md)",
              }}
            >
              Work module‑first to avoid cross‑contamination: open a module, then manage its questions, OFCs, and sources only within that module.
            </p>
            <div
              style={{
                padding: "var(--spacing-md)",
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "var(--border-radius)",
                marginBottom: "var(--spacing-lg)",
                fontSize: "var(--font-size-sm)",
                color: "#1e40af",
              }}
            >
              <strong>Review sources &amp; add content:</strong> In each module, use the <strong>Overview</strong> tab to add questions and OFCs, and the <strong>Sources</strong> tab to review research. Add questions/OFCs from the Overview after reviewing a source.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--spacing-md)",
              }}
            >
              <Link
                href="/admin/module-drafts/build"
                style={{
                  ...cardLinkBase,
                  border: "1px solid #bfdbfe",
                  backgroundColor: "#eff6ff",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#dbeafe";
                  e.currentTarget.style.borderColor = "var(--cisa-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#eff6ff";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                }}
              >
                <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "var(--spacing-sm)" }}>🔨</span>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                  Build Module from Sources
                </h3>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: 0 }}>
                  Automated draft builder: pick sources, get a draft module shell and suggested question stubs. Review and accept before publishing. No OFCs auto-generated.
                </p>
              </Link>
              <Link
                href="/admin/modules"
                style={{
                  ...cardLinkBase,
                  border: "1px solid var(--cisa-gray-light)",
                  backgroundColor: "#f9fafb",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "var(--cisa-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                  e.currentTarget.style.borderColor = "var(--cisa-gray-light)";
                }}
              >
                <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "var(--spacing-sm)" }}>📦</span>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                  Modules
                </h3>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: 0 }}>
                  Open a module to manage its questions, OFCs, and sources. Use <strong>Add question</strong> and <strong>Add OFC</strong> in the Overview after reviewing sources. Module OFCs can be registered into the global Module Data queue via the <strong>Register</strong> action (explicit, not automatic).
                </p>
              </Link>
              <Link
                href="/admin/module-data"
                style={{
                  ...cardLinkBase,
                  border: "1px solid #fef3c7",
                  backgroundColor: "#fffbeb",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#fef3c7";
                  e.currentTarget.style.borderColor = "#f59e0b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#fffbeb";
                  e.currentTarget.style.borderColor = "#fef3c7";
                }}
              >
                <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "var(--spacing-sm)" }}>🔬</span>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                  Module Data (MODULE OFC queue)
                </h3>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", margin: 0 }}>
                  <strong>Global, not scoped to a module.</strong> MODULE‑origin candidates in the candidate queue. OFCs in a module&apos;s Overview do <em>not</em> appear here. Prefer adding OFCs via the module&apos;s Overview to avoid cross‑contamination. Module OFCs can be registered into this queue via the <strong>Register</strong> action on a module&apos;s Overview (explicit, not automatic).
                </p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Process Incoming PDFs modal */}
      {processModalModule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !processRunning) {
              setProcessModalModule(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "var(--border-radius)",
              padding: "var(--spacing-lg)",
              maxWidth: "560px",
              width: "90%",
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 var(--spacing-md)", fontSize: "var(--font-size-lg)" }}>
              Process Incoming PDFs — {processModalModule}
            </h3>

            <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-md)" }}>
              <input
                type="checkbox"
                checked={processDryRun}
                onChange={(e) => setProcessDryRun(e.target.checked)}
                disabled={processRunning}
              />
              <span>Dry run (no copies/DB writes)</span>
            </label>

            <div style={{ marginBottom: "var(--spacing-md)" }}>
              <label style={{ display: "block", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-xs)" }}>
                Limit (optional)
              </label>
              <input
                type="number"
                value={processLimit}
                onChange={(e) => setProcessLimit(e.target.value)}
                disabled={processRunning}
                placeholder="e.g. 5"
                min={1}
                style={{
                  width: "120px",
                  padding: "var(--spacing-xs) var(--spacing-sm)",
                  border: "1px solid var(--cisa-gray-light)",
                  borderRadius: "var(--border-radius)",
                }}
              />
            </div>

            <details
              open={processAdvanced}
              onToggle={(e) => setProcessAdvanced((e.target as HTMLDetailsElement).open)}
              style={{ marginBottom: "var(--spacing-md)" }}
            >
              <summary style={{ cursor: "pointer", fontSize: "var(--font-size-sm)" }}>Advanced</summary>
              <div style={{ marginTop: "var(--spacing-sm)" }}>
                <label style={{ display: "block", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-xs)" }}>
                  PDF directory override
                </label>
                <input
                  type="text"
                  value={processPdfDir}
                  onChange={(e) => setProcessPdfDir(e.target.value)}
                  disabled={processRunning}
                  placeholder="Default: data/incoming"
                  style={{
                    width: "100%",
                    padding: "var(--spacing-xs) var(--spacing-sm)",
                    border: "1px solid var(--cisa-gray-light)",
                    borderRadius: "var(--border-radius)",
                  }}
                />
              </div>
            </details>

            <div style={{ display: "flex", gap: "var(--spacing-sm)", marginBottom: processResult ? "var(--spacing-md)" : 0, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={runProcessIncomingPdfs}
                disabled={processRunning}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  backgroundColor: "var(--cisa-blue)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  cursor: processRunning ? "not-allowed" : "pointer",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {processRunning ? "Running…" : "Run"}
              </button>
              {!processDryRun && (
                <button
                  type="button"
                  onClick={runProcessIncomingPdfs}
                  disabled={processRunning}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    backgroundColor: "#b91c1c",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    cursor: processRunning ? "not-allowed" : "pointer",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  Execute
                </button>
              )}
              {!processRunning && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setProcessResult(null);
                      setProcessLimit("");
                      setProcessPdfDir("");
                      setProcessDryRun(true);
                      setProcessAdvanced(false);
                    }}
                    style={{
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      border: "1px solid var(--cisa-gray-light)",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      fontSize: "var(--font-size-sm)",
                      backgroundColor: "#fff",
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setProcessModalModule(null)}
                    style={{
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      border: "1px solid var(--cisa-gray-light)",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      fontSize: "var(--font-size-sm)",
                      backgroundColor: "#fff",
                    }}
                  >
                    Close
                  </button>
                </>
              )}
            </div>

            {processResult && (
              <div
                style={{
                  marginTop: "var(--spacing-md)",
                  border: "1px solid var(--cisa-gray-light)",
                  borderRadius: "var(--border-radius)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    padding: "var(--spacing-sm)",
                    fontWeight: 600,
                    fontSize: "var(--font-size-sm)",
                    backgroundColor: processResult.ok ? "#dcfce7" : "#fef2f2",
                    color: processResult.ok ? "#166534" : "#991b1b",
                  }}
                >
                  {processResult.ok ? "Success (exit 0)" : `Failed (exit ${processResult.exitCode})`}
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: "auto",
                    maxHeight: "240px",
                    padding: "var(--spacing-sm)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {processResult.stdout ? <div>{processResult.stdout}</div> : null}
                  {processResult.stderr ? (
                    <div style={{ marginTop: "var(--spacing-sm)", color: "#b91c1b" }}>{processResult.stderr}</div>
                  ) : null}
                </div>
                {processResult.command && (
                  <div
                    style={{
                      padding: "var(--spacing-xs) var(--spacing-sm)",
                      fontSize: "11px",
                      color: "var(--cisa-gray)",
                      borderTop: "1px solid var(--cisa-gray-light)",
                    }}
                  >
                    {processResult.command}
                  </div>
                )}
                {processResult.ok && processResult.dryRun === false && (
                  <div style={{ padding: "var(--spacing-sm)", borderTop: "1px solid var(--cisa-gray-light)" }}>
                    <button
                      type="button"
                      onClick={() => {
                        loadModules();
                      }}
                      style={{
                        padding: "var(--spacing-xs) var(--spacing-md)",
                        backgroundColor: "var(--cisa-blue)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        cursor: "pointer",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      Refresh module list
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Module Confirmation Modal */}
      {deleteModalModule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteRunning) {
              setDeleteModalModule(null);
              setDeleteConfirmText("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "var(--border-radius)",
              padding: "var(--spacing-lg)",
              maxWidth: "480px",
              width: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 var(--spacing-md)", fontSize: "var(--font-size-lg)", color: "#dc2626" }}>
              Delete Module
            </h3>
            <div
              style={{
                padding: "var(--spacing-sm)",
                backgroundColor: "#fef3c7",
                border: "1px solid #fbbf24",
                borderRadius: "var(--border-radius)",
                marginBottom: "var(--spacing-md)",
                fontSize: "var(--font-size-sm)",
                color: "#92400e",
              }}
            >
              <strong>Note:</strong> Only DRAFT modules can be deleted. If this module is ACTIVE, you must deactivate it first by changing its status to DRAFT.
            </div>
            <p style={{ margin: "0 0 var(--spacing-md)", fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)" }}>
              This will permanently delete the module <strong>{deleteModalModule}</strong> and its associated data (questions, OFCs, criteria). The module’s link to sources will be removed; source files and documents remain in the module library and are not deleted.
            </p>
            <div style={{ marginBottom: "var(--spacing-md)" }}>
              <label style={{ display: "block", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-xs)", fontWeight: 600 }}>
                Type the module code to confirm: <code style={{ fontFamily: "monospace" }}>{deleteModalModule}</code>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleteRunning}
                placeholder={deleteModalModule}
                style={{
                  width: "100%",
                  padding: "var(--spacing-sm)",
                  border: "1px solid var(--cisa-gray-light)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "monospace",
                }}
                autoFocus
              />
            </div>
            {moduleError && (
              <div
                style={{
                  padding: "var(--spacing-sm)",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--border-radius)",
                  color: "#991b1b",
                  marginBottom: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {moduleError}
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--spacing-sm)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModalModule(null);
                  setDeleteConfirmText("");
                  setModuleError(null);
                }}
                disabled={deleteRunning}
                style={{
                  padding: "var(--spacing-xs) var(--spacing-md)",
                  border: "1px solid var(--cisa-gray-light)",
                  borderRadius: "var(--border-radius)",
                  backgroundColor: "#fff",
                  cursor: deleteRunning ? "not-allowed" : "pointer",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteModule}
                disabled={deleteRunning || deleteConfirmText !== deleteModalModule}
                style={{
                  padding: "var(--spacing-xs) var(--spacing-md)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  backgroundColor: deleteConfirmText === deleteModalModule && !deleteRunning ? "#dc2626" : "#fca5a5",
                  color: "#fff",
                  cursor: deleteConfirmText === deleteModalModule && !deleteRunning ? "pointer" : "not-allowed",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {deleteRunning ? "Deleting..." : "Delete Module"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ModuleManagementPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--spacing-xl)", textAlign: "center" }}>
          Loading…
        </div>
      }
    >
      <ModuleManagementInner />
    </Suspense>
  );
}
