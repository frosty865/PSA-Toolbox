import { describe, expect, it } from 'vitest';
import type { Assessment, CrossDependencyEdge } from 'schema';
import { dedupeCrossDependencyEdges, getCrossDependenciesNode } from './normalize';

describe('cross-dependencies normalize', () => {
  it('dedupes semantic duplicate edges and keeps the strongest evidence', () => {
    const edges: CrossDependencyEdge[] = [
      {
        from_category: 'ELECTRIC_POWER',
        to_category: 'COMMUNICATIONS',
        purpose: 'primary_operations',
        criticality: 'important',
        time_to_cascade_bucket: 'short',
        single_path: 'unknown',
        confidence: 'documented',
        notes: 'Provider note',
        source: 'auto_suggest',
      },
      {
        from_category: 'ELECTRIC_POWER',
        to_category: 'COMMUNICATIONS',
        purpose: 'primary_operations',
        criticality: 'critical',
        time_to_cascade_bucket: 'immediate',
        single_path: 'yes',
        confidence: 'confirmed',
        notes: 'Field note',
        source: 'user',
      },
    ];

    const deduped = dedupeCrossDependencyEdges(edges);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toMatchObject({
      from_category: 'ELECTRIC_POWER',
      to_category: 'COMMUNICATIONS',
      purpose: 'primary_operations',
      criticality: 'critical',
      time_to_cascade_bucket: 'immediate',
      single_path: 'yes',
      confidence: 'confirmed',
      source: 'user',
    });
    expect(deduped[0].notes).toContain('Provider note');
    expect(deduped[0].notes).toContain('Field note');
  });

  it('getCrossDependenciesNode returns deduped edges and recalculated derived flags', () => {
    const assessment = {
      cross_dependencies: {
        edges: [
          {
            from_category: 'ELECTRIC_POWER',
            to_category: 'COMMUNICATIONS',
            purpose: 'primary_operations',
            criticality: 'critical',
            time_to_cascade_bucket: 'immediate',
            single_path: 'yes',
            confidence: 'confirmed',
            source: 'user',
          },
          {
            from_category: 'ELECTRIC_POWER',
            to_category: 'COMMUNICATIONS',
            purpose: 'primary_operations',
            criticality: 'critical',
            time_to_cascade_bucket: 'immediate',
            single_path: 'yes',
            confidence: 'confirmed',
            source: 'user',
          },
          {
            from_category: 'COMMUNICATIONS',
            to_category: 'ELECTRIC_POWER',
            purpose: 'primary_operations',
            criticality: 'critical',
            time_to_cascade_bucket: 'immediate',
            single_path: 'yes',
            confidence: 'confirmed',
            source: 'user',
          },
        ],
        derived: {
          circular_dependencies: [],
          common_mode_spof: [],
        },
      },
    } as unknown as Assessment;

    const node = getCrossDependenciesNode(assessment);

    expect(node.edges).toHaveLength(2);
    expect(node.derived?.circular_dependencies?.length).toBeGreaterThan(0);
  });
});

