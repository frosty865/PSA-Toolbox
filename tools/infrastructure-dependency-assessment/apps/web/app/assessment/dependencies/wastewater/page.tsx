'use client';

import { WastewaterQuestionnaireSection } from './WastewaterQuestionnaireSection';

export default function WastewaterDependencyPage() {
  return (
    <main className="ida-section active">
      <WastewaterQuestionnaireSection embedded={false} />
    </main>
  );
}
