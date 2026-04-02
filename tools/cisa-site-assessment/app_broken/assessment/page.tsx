"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Component that uses useSearchParams - must be wrapped in Suspense
function AssessmentRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const documentId = searchParams.get("documentId");
    if (documentId) {
      // Redirect to new results page
      router.replace(`/assessments/${documentId}/results?documentId=${encodeURIComponent(documentId)}`);
    } else {
      // No documentId, redirect to assessments list
      router.replace("/assessments");
    }
  }, [searchParams, router]);

  return (
    <section className="section active">
      <div className="section-header">
        <h2 className="section-title">Assessment</h2>
      </div>
      <div className="card">
        <p>Redirecting...</p>
      </div>
    </section>
  );
}

// Redirect legacy /assessment route to /assessments/[id]/results
export default function AssessmentPage() {
  return (
    <Suspense fallback={
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment</h2>
        </div>
        <div className="card">
          <p>Loading...</p>
        </div>
      </section>
    }>
      <AssessmentRedirect />
    </Suspense>
  );
}
