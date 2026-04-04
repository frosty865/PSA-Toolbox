'use client';

import { EnergyQuestionnaireSection } from './EnergyQuestionnaireSection';

export default function EnergyDependencyPage() {
  return (
    <main className="section active">
      <EnergyQuestionnaireSection embedded={false} />
    </main>
  );
}
