'use client';

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { Assessment } from 'schema';
import { getDefaultAssessment } from '@/lib/default-assessment';
import { loadAssessmentFromLocal, saveAssessmentToLocal, repairCanonicalFromPerTabIfMissing } from '@/app/lib/io/assessmentStorage';
import { DEFAULT_PRIORITY_RESTORATION } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';
import { mergeModulesState } from '@/app/lib/modules/registry';
import { migrateAssessmentItIsp } from '@/app/lib/dependencies/it_to_category_input';
import { initializeUnloadHandlers, registerPendingSave } from '@/app/lib/io/unloadHandler';
import { createDebouncedFn } from '@/app/lib/io/debouncedSave';

type AssessmentContextValue = {
  assessment: Assessment;
  setAssessment: React.Dispatch<React.SetStateAction<Assessment>>;
};

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

/** Merge PSA contact from localStorage (landing page) into assessment.asset. Runs only in browser. */
function mergePsaFromStorage(a: Assessment): Assessment {
  if (typeof window === 'undefined') return a;
  const name = localStorage.getItem('ada_psa_name') ?? '';
  const region = localStorage.getItem('ada_psa_region') ?? '';
  const city = localStorage.getItem('ada_psa_city') ?? '';
  const cell = localStorage.getItem('ada_psa_cell') ?? '';
  const email = localStorage.getItem('ada_psa_email') ?? '';
  if (!name && !region && !city && !cell && !email) return a;
  return {
    ...a,
    asset: {
      ...a.asset,
      ...(name && { psa_name: name }),
      ...(region && { psa_region: region }),
      ...(city && { psa_city: city }),
      ...(cell && { psa_cell: cell }),
      ...(email && { psa_email: email }),
    },
  };
}

/** Ensure assessment has priority_restoration (SLA/PRA) and run IT ISP migration (IT-1 ISP → supply.sources). */
function prepareAssessment(a: Assessment): Assessment {
  const withPra = a.priority_restoration != null && typeof a.priority_restoration === 'object'
    ? a
    : { ...a, priority_restoration: DEFAULT_PRIORITY_RESTORATION };
  const withModules = { ...withPra, modules: mergeModulesState(withPra.modules) };
  migrateAssessmentItIsp(withModules);
  return normalizeCurveStorage(withModules);
}

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [assessment, setAssessment] = useState<Assessment>(() =>
    prepareAssessment(getDefaultAssessment())
  );
  const isFirstSaveRun = useRef(true);
  const debouncedSaveRef = useRef<(a: Assessment) => void | null>(null);
  const assessmentRef = useRef<Assessment>(assessment);
  assessmentRef.current = assessment;

  useEffect(() => {
    // Initialize unload handlers once on mount
    initializeUnloadHandlers();

    // Create debounced save function with 2s delay (balances responsiveness vs performance)
    const debouncedSave = createDebouncedFn((a: Assessment) => {
      saveAssessmentToLocal(a);
    }, 2000);
    debouncedSaveRef.current = debouncedSave;

    // Register unload save: use ref so we always save latest assessment (closure would be stale)
    registerPendingSave(() => {
      saveAssessmentToLocal(assessmentRef.current);
    });
  }, []);

  useEffect(() => {
    const loaded = loadAssessmentFromLocal();
    if (loaded) {
      setAssessment(prepareAssessment(loaded));
    } else {
      const defaultAssess = prepareAssessment(mergePsaFromStorage(getDefaultAssessment()));
      setAssessment(defaultAssess);
      repairCanonicalFromPerTabIfMissing(defaultAssess);
    }
  }, []);

  useEffect(() => {
    // Skip the first save: it runs before load from localStorage completes and would overwrite stored data.
    if (isFirstSaveRun.current) {
      isFirstSaveRun.current = false;
      return;
    }
    // Use debounced save to reduce localStorage write frequency and memory churn
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(assessment);
    }
  }, [assessment]);

  const value: AssessmentContextValue = { assessment, setAssessment };
  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment(): AssessmentContextValue {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used within AssessmentProvider');
  return ctx;
}
