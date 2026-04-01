import { describe, it, expect } from 'vitest';
import { buildCurve } from './curve';
import type { CategoryInput } from 'schema';

describe('buildCurve', () => {
  it('requires_service=false: both capacities always 100', () => {
    const input: CategoryInput = {
      requires_service: false,
      time_to_impact_hours: 12,
      loss_fraction_no_backup: 0.5,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    };
    const points = buildCurve(input, 72, 3);
    expect(points.length).toBe(25); // 0,3,...,72
    points.forEach((p) => {
      expect(p.capacity_without_backup).toBe(100);
      expect(p.capacity_with_backup).toBe(100);
      expect(p.t_hours).toBeGreaterThanOrEqual(0);
      expect(p.t_hours).toBeLessThanOrEqual(72);
    });
  });

  it('no backup: impact at 0 gives capacity (1 - loss)*100 after t=0', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.4,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 48,
    };
    const points = buildCurve(input, 12, 3);
    // t=0 and all t>0: capacity = (1 - 0.4)*100 = 60
    expect(points[0].capacity_without_backup).toBe(60);
    expect(points[0].capacity_with_backup).toBe(60);
    expect(points[points.length - 1].capacity_without_backup).toBe(60);
  });

  it('no backup impact at t before time_to_impact: capacity 100', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 24,
      loss_fraction_no_backup: 0.5,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    };
    const points = buildCurve(input, 30, 3);
    // t=0,3,6,9,12,15,18,21 < 24 => 100
    const beforeImpact = points.filter((p) => p.t_hours < 24);
    beforeImpact.forEach((p) => {
      expect(p.capacity_without_backup).toBe(100);
      expect(p.capacity_with_backup).toBe(100);
    });
    // t=24,27,30 => (1-0.5)*100 = 50
    const afterImpact = points.filter((p) => p.t_hours >= 24);
    afterImpact.forEach((p) => {
      expect(p.capacity_without_backup).toBe(50);
      expect(p.capacity_with_backup).toBe(50);
    });
  });

  it('backup covers whole horizon: with_backup 100 until t=72 then drops', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.8,
      has_backup: true,
      backup_duration_hours: 72,
      loss_fraction_with_backup: 0.2,
      recovery_time_hours: 48,
    };
    const points = buildCurve(input, 72, 3);
    points.forEach((p) => expect(p.capacity_without_backup).toBe(20)); // (1-0.8)*100
    // t < 72 => 100; t >= 72 => (1-0.2)*100 = 80
    points.filter((p) => p.t_hours < 72).forEach((p) => expect(p.capacity_with_backup).toBe(100));
    const at72 = points.find((p) => p.t_hours === 72);
    expect(at72?.capacity_with_backup).toBe(80);
  });

  it('backup exhausted after duration: capacity_with_backup drops', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.5,
      has_backup: true,
      backup_duration_hours: 12,
      loss_fraction_with_backup: 0.3,
      recovery_time_hours: 24,
    };
    const points = buildCurve(input, 24, 3);
    // t < 12: with_backup = 100
    points.filter((p) => p.t_hours < 12).forEach((p) => {
      expect(p.capacity_with_backup).toBe(100);
    });
    // t >= 12: with_backup = (1-0.3)*100 = 70
    points.filter((p) => p.t_hours >= 12).forEach((p) => {
      expect(p.capacity_with_backup).toBe(70);
    });
    // without_backup = 50 for all (impact at 0)
    points.forEach((p) => expect(p.capacity_without_backup).toBe(50));
  });

  it('clamps and rounds to 1 decimal', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.333,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    };
    const points = buildCurve(input, 3, 3);
    const cap = (1 - 0.333) * 100; // 66.7
    expect(points[0].capacity_without_backup).toBe(66.7);
    expect(points[0].capacity_with_backup).toBe(66.7);
  });
});
