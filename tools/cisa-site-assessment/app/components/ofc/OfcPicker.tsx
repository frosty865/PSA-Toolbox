"use client";

import { useEffect, useMemo, useState } from "react";
import type { OfcOrigin } from "@/app/lib/doctrine/ofc_doctrine";

type OfcItem = {
  id: string;
  title: string | null;
  ofc_text: string;
  discipline_id: string | null;
  discipline_subtype_id: string;
  origin: OfcOrigin;
  status: string;
  created_at: string;
};

export function OfcPicker(props: {
  origin: OfcOrigin;
  discipline_subtype_id: string;
  discipline_id?: string | null;
  onSelect: (ofcId: string) => void;
}) {
  const { origin, discipline_subtype_id, discipline_id, onSelect } = props;
  const [items, setItems] = useState<OfcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({
          origin,
          discipline_subtype_id,
        });
        if (discipline_id) {
          params.append("discipline_id", discipline_id);
        }

        const res = await fetch(`/api/ofcs/list?${params.toString()}`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!alive) return;
        setItems(json.items || []);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load OFCs");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [origin, discipline_subtype_id, discipline_id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (x) =>
        (x.title || "").toLowerCase().includes(needle) ||
        (x.ofc_text || "").toLowerCase().includes(needle)
    );
  }, [items, q]);

  const originLabel = origin === "CORPUS" ? "CORPUS OFCs" : "MODULE OFCs";

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="text-sm font-semibold">{originLabel}</div>
      <input
        className="w-full rounded-xl border px-3 py-2 text-sm"
        placeholder="Search OFCs..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={loading}
      />
      {loading && (
        <div className="text-xs text-neutral-500">Loading approved OFCs...</div>
      )}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          Error: {error}
        </div>
      )}
      {!loading && !error && (
        <div className="max-h-72 overflow-auto space-y-2">
          {filtered.map((ofc) => (
            <button
              key={ofc.id}
              className="w-full text-left rounded-xl border p-3 hover:bg-neutral-50 transition-colors"
              onClick={() => onSelect(ofc.id)}
            >
              <div className="text-sm font-medium">
                {ofc.title || "Untitled OFC"}
              </div>
              <div className="text-xs text-neutral-600 line-clamp-3 mt-1">
                {ofc.ofc_text}
              </div>
            </button>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="text-xs text-neutral-500 p-2">
              {q.trim()
                ? "No matching approved OFCs found."
                : "No approved OFCs available for this subtype."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
