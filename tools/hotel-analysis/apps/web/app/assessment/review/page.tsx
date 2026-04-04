'use client';

import React from 'react';
import { ReviewExportPage } from '@/components/ReviewExport/ReviewExportPage';

/**
 * Review page: NEW report-structured assessment preview (replaces legacy grid)
 */
export default function ReviewPage() {
  return (
    <main className="section active">
      <ReviewExportPage />
    </main>
  );
}
