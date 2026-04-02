/**
 * POST /api/admin/modules/[moduleCode]/sources/[moduleSourceId]/promote-to-corpus
 *
 * DISABLED: Module uploads cannot be promoted to CORPUS.
 * 
 * HARD SEGREGATION: CORPUS is read-only from modules.
 * - Module uploads remain in RUNTIME only (module_documents, module_chunks)
 * - Modules can attach CORPUS sources via read-only pointers (module_corpus_links)
 * - No copying, no promotion, no cross-database writes
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Disabled: module uploads cannot be promoted to CORPUS. CORPUS is read-only from modules. Use 'Attach CORPUS Source' to create read-only references.",
    },
    { status: 410 }
  );
}
