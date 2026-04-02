"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect /sectors to /reference/sectors for backward compatibility
export default function SectorsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reference/sectors");
  }, [router]);

  return (
    <section className="section active">
      <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
        <p>Redirecting to Sectors Guide...</p>
      </div>
    </section>
  );
}
