/**
 * Write sessions map to per-tab localStorage keys.
 * Used on progress file import and JSON restore flows.
 */
import type { DependencySessionsMap } from './sessionTypes';
import { saveEnergyAnswers, saveCommsAnswers } from '@/app/lib/dependencies/persistence';
import { saveWaterSession } from './water_storage';
import { saveWastewaterSession } from './wastewater_storage';
import { saveItSession } from './it_storage';

export function writeSessionsToPerTabStorage(sessions: DependencySessionsMap): void {
  const ep = sessions.ELECTRIC_POWER;
  if (ep?.answers && ep.saved_at_iso) {
    saveEnergyAnswers({
      answers: ep.answers as import('@/app/lib/dependencies/infrastructure/energy_spec').EnergyAnswers,
      derived: (ep.derived ?? { vulnerabilities: [], ofcs: [], reportBlocks: [] }) as import('@/app/lib/dependencies/derive_energy_findings').EnergyDerivedFindings,
    });
  }

  const comms = sessions.COMMUNICATIONS;
  if (comms?.answers) {
    saveCommsAnswers({
      answers: comms.answers as import('@/app/lib/dependencies/infrastructure/comms_spec').CommsAnswers,
      derived: comms.derived,
    });
  }

  const water = sessions.WATER;
  if (water?.answers && water.saved_at_iso) {
    saveWaterSession(water);
  }

  const wastewater = sessions.WASTEWATER;
  if (wastewater?.answers && wastewater.saved_at_iso) {
    saveWastewaterSession(wastewater);
  }

  const it = sessions.INFORMATION_TECHNOLOGY;
  if (it?.answers && it.saved_at_iso) {
    saveItSession(it);
  }
}
