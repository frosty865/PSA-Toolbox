"use client";

import React from "react";
import ReferenceImplementationPanel from "@/app/components/reference-impl/ReferenceImplementationPanel";

export default function ReferenceImplementationTab({
  disciplineSubtypeId,
}: {
  disciplineSubtypeId: string | null | undefined;
}) {
  return (
    <div className="p-4">
      <ReferenceImplementationPanel disciplineSubtypeId={disciplineSubtypeId} />
    </div>
  );
}
