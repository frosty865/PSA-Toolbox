'use client';

import { useEffect, useState } from 'react';
import FederalDisclaimerSplash from '@/components/FederalDisclaimerSplash';
import { AssessmentChrome } from '@/components/AssessmentChrome';

/**
 * Federal notice applies to the Infrastructure Dependency Assessment only.
 * Shown on first entry to any /assessment/* route until the user accepts.
 */
export function AssessmentDisclaimerGate({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      setAccepted(localStorage.getItem('federal-disclaimer-accepted') === 'true');
    } catch {
      setAccepted(false);
    }
  }, []);

  if (!isClient) {
    return null;
  }

  if (!accepted) {
    return <FederalDisclaimerSplash onAccept={() => setAccepted(true)} />;
  }

  return <AssessmentChrome>{children}</AssessmentChrome>;
}
