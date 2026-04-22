import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buildProgressFile,
  buildProgressFileV2,
  parseProgressFile,
  type ProgressFileV1,
  type EnergySnapshot,
  type CommsSnapshot,
} from './progressFile';
import { getDefaultAssessment } from '@/lib/default-assessment';
import { buildCategoryChartData, shouldShowChart } from '@/app/lib/charts/chartService';

describe('progressFile', () => {
  it('valid file loads', () => {
    const assessment = getDefaultAssessment();
    const file = buildProgressFile(assessment, undefined);
    const raw = JSON.stringify(file);
    const result = parseProgressFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assessment.meta.tool_version).toBe(assessment.meta.tool_version);
      expect(result.assessment.asset.asset_name).toBe(assessment.asset.asset_name);
      expect(Object.keys(result.assessment.categories)).toEqual(
        Object.keys(assessment.categories)
      );
    }
  });

  it('invalid JSON rejected', () => {
    const result = parseProgressFile('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('JSON');
  });

  it('wrong tool rejected', () => {
    const assessment = getDefaultAssessment();
    const file = buildProgressFile(assessment, undefined) as ProgressFileV1 & { tool: string };
    file.tool = 'other-tool';
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Infrastructure Dependency Tool');
  });

  it('version mismatch handled cleanly', () => {
    const assessment = getDefaultAssessment();
    const file = buildProgressFile(assessment, undefined) as ProgressFileV1 & { version: number };
    file.version = 99;
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version|Unsupported/);
  });

  it('missing assessment rejected', () => {
    const file = {
      tool: 'asset-dependency-tool',
      version: 1,
      saved_at_iso: new Date().toISOString(),
    };
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/assessment|missing/);
  });

  it('invalid assessment shape rejected', () => {
    const file = {
      tool: 'asset-dependency-tool',
      version: 1,
      saved_at_iso: new Date().toISOString(),
      assessment: { meta: {}, asset: {}, categories: {} },
    };
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
  });

  it('imports legacy null optional object blocks', () => {
    const assessment = getDefaultAssessment();
    const file = buildProgressFileV2(assessment, undefined) as {
      assessment: typeof assessment & {
        categories: Record<string, Record<string, unknown>>;
      };
    };

    const comms = file.assessment.categories.COMMUNICATIONS;
    const it = file.assessment.categories.INFORMATION_TECHNOLOGY;
    if (!comms || !it) throw new Error('Expected legacy categories to exist');

    (comms as Record<string, unknown> & { redundancy_activation?: unknown }).redundancy_activation = null;
    (it as Record<string, unknown> & { redundancy_activation?: unknown }).redundancy_activation = null;

    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsedComms = result.assessment.categories.COMMUNICATIONS as Record<string, unknown>;
    const parsedIt = result.assessment.categories.INFORMATION_TECHNOLOGY as Record<string, unknown>;
    expect(parsedComms.redundancy_activation).toBeUndefined();
    expect(parsedIt.redundancy_activation).toBeUndefined();
  });

  it('V1 import migrates energy and comms to sessions map', () => {
    const assessment = getDefaultAssessment();
    const energy: EnergySnapshot = {
      answers: { 'E-2_can_identify_substations': 'yes' },
      derived: { vulnerabilities: [], ofcs: [], reportBlocks: [] },
      saved_at_iso: new Date().toISOString(),
    };
    const comms: CommsSnapshot = {
      answers: { 'CO-1_can_identify_providers': 'no' },
      saved_at_iso: new Date().toISOString(),
    };
    const file = buildProgressFile(assessment, energy, comms) as ProgressFileV1;
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions.ELECTRIC_POWER?.answers).toEqual(energy.answers);
    expect(result.sessions.COMMUNICATIONS?.answers).toEqual(comms.answers);
  });

  it('V2 round-trips with sessions', () => {
    const assessment = getDefaultAssessment();
    const sessions = {
      ELECTRIC_POWER: {
        answers: { 'E-2_can_identify_substations': 'yes' },
        derived: { vulnerabilities: [], ofcs: [], reportBlocks: [] },
        saved_at_iso: new Date().toISOString(),
      },
      WATER: {
        answers: { curve_requires_service: true },
        saved_at_iso: new Date().toISOString(),
      },
    };
    const file = buildProgressFileV2(assessment, sessions);
    expect(file.version).toBe(2);
    expect(file.sessions).toEqual(sessions);
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions.ELECTRIC_POWER?.answers).toEqual(sessions.ELECTRIC_POWER.answers);
    expect(result.sessions.WATER?.answers).toEqual(sessions.WATER.answers);
  });

  it('V2 round-trips all five dependency sessions', () => {
    const assessment = getDefaultAssessment();
    const sessions = {
      ELECTRIC_POWER: {
        answers: { 'E-2_can_identify_substations': 'yes' },
        derived: { vulnerabilities: [], ofcs: [], reportBlocks: [] },
        saved_at_iso: new Date().toISOString(),
      },
      COMMUNICATIONS: {
        answers: { 'CO-1_can_identify_providers': 'no' },
        saved_at_iso: new Date().toISOString(),
      },
      INFORMATION_TECHNOLOGY: {
        answers: { 'IT-1_can_identify_providers': 'unknown' },
        saved_at_iso: new Date().toISOString(),
      },
      WATER: {
        answers: { 'WA-1_can_identify_providers': 'yes' },
        saved_at_iso: new Date().toISOString(),
      },
      WASTEWATER: {
        answers: { 'WW-1_can_identify_providers': 'no' },
        saved_at_iso: new Date().toISOString(),
      },
    };
    const file = buildProgressFileV2(assessment, sessions);
    expect(file.version).toBe(2);
    expect(file.sessions).toEqual(sessions);
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions.ELECTRIC_POWER?.answers).toEqual(sessions.ELECTRIC_POWER.answers);
    expect(result.sessions.COMMUNICATIONS?.answers).toEqual(sessions.COMMUNICATIONS.answers);
    expect(result.sessions.INFORMATION_TECHNOLOGY?.answers).toEqual(sessions.INFORMATION_TECHNOLOGY.answers);
    expect(result.sessions.WATER?.answers).toEqual(sessions.WATER.answers);
    expect(result.sessions.WASTEWATER?.answers).toEqual(sessions.WASTEWATER.answers);
  });

  it('imports V2 sessions even when saved_at_iso is missing', () => {
    const assessment = getDefaultAssessment();
    const raw = JSON.stringify({
      tool: 'asset-dependency-tool',
      version: 2,
      saved_at_iso: new Date().toISOString(),
      assessment,
      sessions: {
        ELECTRIC_POWER: {
          answers: { 'E-2_can_identify_substations': 'yes' },
          derived: { vulnerabilities: [], ofcs: [], reportBlocks: [] },
        },
      },
    });

    const result = parseProgressFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions.ELECTRIC_POWER?.answers['E-2_can_identify_substations']).toBe('yes');
    expect(typeof result.sessions.ELECTRIC_POWER?.saved_at_iso).toBe('string');
    expect((result.sessions.ELECTRIC_POWER?.saved_at_iso ?? '').length).toBeGreaterThan(0);
  });

  it('accepts legacy asset-dependency-tool progress files', () => {
    const assessment = getDefaultAssessment();
    const raw = JSON.stringify({
      tool: 'asset-dependency-tool',
      version: 2,
      saved_at_iso: new Date().toISOString(),
      assessment,
    });

    const result = parseProgressFile(raw);
    expect(result.ok).toBe(true);
  });

  it('preserves imported category keys without destructive legacy stripping', () => {
    const assessment = getDefaultAssessment();
    assessment.categories.INFORMATION_TECHNOLOGY = {
      ...assessment.categories.INFORMATION_TECHNOLOGY,
      curve_backup_duration_hours: 96,
      'IT-8_backup_available': 'yes',
    };

    const file = buildProgressFileV2(assessment, undefined);
    const result = parseProgressFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const it = result.assessment.categories.INFORMATION_TECHNOLOGY as Record<string, unknown>;
    expect(it.curve_backup_duration_hours).toBe(96);
    expect(it['IT-8_backup_available']).toBe('yes');
  });

  it('smoke: save then load then build chart data', () => {
    const assessment = getDefaultAssessment();
    const electric = assessment.categories.ELECTRIC_POWER;
    const withData = {
      ...electric,
      requires_service: true,
      time_to_impact_hours: 6,
      loss_fraction_no_backup: 0.5,
    };
    const filled = {
      ...assessment,
      categories: {
        ...assessment.categories,
        ELECTRIC_POWER: withData,
      },
    };
    const file = buildProgressFile(filled, undefined);
    const raw = JSON.stringify(file);
    const parsed = parseProgressFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const loaded = parsed.assessment;
    const chartData = buildCategoryChartData('ELECTRIC_POWER', loaded.categories.ELECTRIC_POWER);
    expect(chartData).not.toBeNull();
    expect(chartData!.withoutBackup.length).toBeGreaterThan(0);
    expect(shouldShowChart('ELECTRIC_POWER', loaded.categories.ELECTRIC_POWER)).toBe(true);
  });

  it('showcase fixture parses', () => {
    const fixturePath = path.join(process.cwd(), 'scripts', 'fixtures', 'showcase_progress.json');
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const result = parseProgressFile(raw);
    expect(result.ok).toBe(true);
  });
});
