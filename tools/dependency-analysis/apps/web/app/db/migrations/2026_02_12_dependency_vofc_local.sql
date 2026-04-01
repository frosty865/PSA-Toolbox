-- dependency_vofc_local: curated VOFC rows for dependency export (condition_code-driven).
-- One row per condition_code; max 4 OFCs; neutral language only.

CREATE TABLE IF NOT EXISTS dependency_vofc_local (
  id TEXT PRIMARY KEY,
  condition_code TEXT NOT NULL UNIQUE,
  infrastructure TEXT NOT NULL CHECK (infrastructure IN ('ENERGY','COMMUNICATIONS','INFORMATION_TRANSPORT','WATER','WASTEWATER')),
  vulnerability_text TEXT NOT NULL,
  ofc_1 TEXT,
  ofc_2 TEXT,
  ofc_3 TEXT,
  ofc_4 TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('VOFC_XLS','CISA_GUIDE','NIST','OTHER')),
  source_reference TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT 'dep_v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dependency_vofc_condition_code ON dependency_vofc_local(condition_code);
CREATE INDEX IF NOT EXISTS idx_dependency_vofc_infrastructure ON dependency_vofc_local(infrastructure);
CREATE INDEX IF NOT EXISTS idx_dependency_vofc_approved ON dependency_vofc_local(approved);
