'use client';

import { CommsQuestionnaireSection } from './CommsQuestionnaireSection';

export default function CommunicationsDependencyPage() {
  return (
    <main className="ida-section active">
      <CommsQuestionnaireSection embedded={false} />
    </main>
  );
}
