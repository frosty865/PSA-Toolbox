'use client';

import { WastewaterQuestionnaireSection } from './WastewaterQuestionnaireSection';

export default function WastewaterDependencyPage() {
  return (
    <main className="section active">
      <WastewaterQuestionnaireSection embedded={false} />
    </main>
  );
}
