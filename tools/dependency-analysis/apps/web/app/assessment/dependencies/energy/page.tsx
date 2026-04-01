'use client';

import { EnergyQuestionnaireSection } from './EnergyQuestionnaireSection';

export default function EnergyDependencyPage() {
  return (
    <main className="ida-section active">
      <EnergyQuestionnaireSection embedded={false} />
    </main>
  );
}
