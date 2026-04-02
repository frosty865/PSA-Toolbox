"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect /disciplines to /reference/disciplines for backward compatibility
export default function DisciplinesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reference/disciplines");
  }, [router]);

  return (
    <section className="section active">
      <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
        <p>Redirecting to Disciplines Guide...</p>
      </div>
    </section>
  );
}
