/**
 * Information Technology Considerations
 */

import type { AnalyticalConsideration } from './consideration_types';

export const CONSIDERATIONS_IT: Record<string, AnalyticalConsideration> = {
  IT_C1: {
    id: 'IT_C1',
    title: 'Provider visibility',
    narrative:
      'Identifying external IT service providers supports incident coordination and recovery alignment. Limited visibility obscures upstream dependencies and shared risk exposure. This gap reduces the accuracy of outage impact forecasting.',
    citations: [],
  },
  IT_C2: {
    id: 'IT_C2',
    title: 'External service awareness',
    narrative:
      'Awareness of externally hosted services clarifies operational reliance on cloud and managed platforms. When critical services are not fully identified, outage impacts can appear unexpected. This uncertainty complicates response planning.',
    citations: [],
  },
  IT_C3: {
    id: 'IT_C3',
    title: 'Provider concentration',
    narrative:
      'Single-provider reliance concentrates dependency risk into one external platform. This concentration increases the impact of provider outages or regional disruptions. Diversification reduces single-point exposure.',
    citations: [],
  },
  IT_C4: {
    id: 'IT_C4',
    title: 'Fallback capability adequacy',
    narrative:
      'Fallback methods that cannot sustain core operations limit the facility response window. Degraded modes may preserve partial functions but still impede mission-critical activity. This constraint shapes continuity expectations.',
    citations: [],
  },
  IT_C5: {
    id: 'IT_C5',
    title: 'Physical exposure of IT assets',
    narrative:
      'IT infrastructure positioned near exterior access points faces increased exposure to physical damage. Loss of termination equipment can disable critical services rapidly. Physical exposure drives time-to-impact sensitivity.',
    citations: [],
  },
  IT_C6: {
    id: 'IT_C6',
    title: 'Alternate service availability',
    narrative:
      'Alternate service access is a key determinant of operational resilience during provider outages. When no alternate path exists, service loss cascades directly into operational disruption. Availability defines continuity horizon.',
    citations: [],
  },
  IT_C7: {
    id: 'IT_C7',
    title: 'Alternate survivability risk',
    narrative:
      'Fallback services that share the same provider or infrastructure may fail during the same outage. Shared dependencies reduce the practical value of alternates. This coupling increases continuity risk.',
    citations: [],
  },
  IT_C8: {
    id: 'IT_C8',
    title: 'Reliability confidence',
    narrative:
      'Operational confidence improves when alternate methods have been exercised. Without validation, availability and usability during real incidents remain uncertain. This uncertainty can reduce effective response options.',
    citations: [],
  },
  IT_C9: {
    id: 'IT_C9',
    title: 'Restoration coordination posture',
    narrative:
      'Coordination with external IT providers influences restoration prioritization and status transparency. When coordination is limited, recovery timelines are uncertain. This uncertainty can extend operational downtime.',
    citations: [],
  },
  IT_C10: {
    id: 'IT_C10',
    title: 'Time-to-impact compression',
    narrative:
      'Rapid degradation after IT service loss limits decision time for workaround activation. Short windows constrain incident response and degrade situational awareness. This compression elevates operational risk.',
    citations: [],
  },
  IT_C11: {
    id: 'IT_C11',
    title: 'Recovery duration sensitivity',
    narrative:
      'Extended restoration intervals increase exposure to secondary impacts such as data access delays and service desk overload. Longer recovery windows also affect stakeholder expectations. Duration sensitivity shapes business risk.',
    citations: [],
  },
  IT_C12: {
    id: 'IT_C12',
    title: 'Cascading service impact',
    narrative:
      'Loss of external IT services can cascade into communications, operations, and remote access dependencies. This interdependence amplifies total disruption. Cascading effects lengthen recovery complexity.',
    citations: [],
  },
};
