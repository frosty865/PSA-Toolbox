/**
 * Storage loaders use try/catch and return null on malformed JSON.
 * In Node (no localStorage), load functions return null without throwing.
 */
import { describe, it, expect } from 'vitest';
import { loadWaterSession } from './water_storage';
import { loadWastewaterSession } from './wastewater_storage';
import { loadItSession } from './it_storage';

describe('session storage (Node: no localStorage)', () => {
  it('water: returns null when storage unavailable', () => {
    expect(loadWaterSession()).toBeNull();
  });

  it('wastewater: returns null when storage unavailable', () => {
    expect(loadWastewaterSession()).toBeNull();
  });

  it('it: returns null when storage unavailable', () => {
    expect(loadItSession()).toBeNull();
  });
});
