/**
 * Admin OFC Data Provider
 * 
 * Provides functions to interact with backend Governance OFC Approval APIs.
 * All functions require GOVERNING_BODY role.
 * All functions call backend endpoints - no local mocks.
 */

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000';

export interface AdminOfc {
  ofc_id: string;
  ofc_root_id: string;
  version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETIRED' | 'SUPERSEDED';
  ofc_text: string;
  rationale: string;
  context_conditions?: string;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  decision_reason?: string;
  supersedes_ofc_id?: string;
}

export interface ApproveOfcRequest {
  notes?: string;
}

export interface RejectOfcRequest {
  decision_reason: string;
}

export interface RequestRevisionRequest {
  decision_reason: string;
}

export interface RetireOfcRequest {
  decision_reason: string;
}

/**
 * Get review queue (SUBMITTED and UNDER_REVIEW OFCs)
 */
export async function getReviewQueue(): Promise<AdminOfc[]> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/review-queue`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch review queue: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.ofcs || [];
  } catch (error) {
    console.error('Error fetching review queue:', error);
    throw error;
  }
}

/**
 * Begin review (claim OFC for review)
 */
export async function beginReview(ofcId: string): Promise<AdminOfc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcId}/begin-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        throw new Error('OFC not found');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to begin review: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error beginning review:', error);
    throw error;
  }
}

/**
 * Get OFC by ID (for review)
 */
export async function getOfcForReview(ofcId: string): Promise<AdminOfc | null> {
  try {
    // First, begin review (idempotent)
    await beginReview(ofcId);
    
    // Then fetch the OFC details
    // Note: This assumes there's a GET endpoint, or we use review-queue data
    // For now, we'll fetch from review queue and find the matching one
    const queue = await getReviewQueue();
    const ofc = queue.find(o => o.ofc_id === ofcId);
    
    if (!ofc) {
      // If not in queue, it might be approved - we'd need a different endpoint
      // For now, return null
      return null;
    }
    
    return ofc;
  } catch (error) {
    console.error('Error fetching OFC for review:', error);
    throw error;
  }
}

/**
 * Get superseded OFC (if this OFC supersedes another)
 */
export async function getSupersededOfc(supersedesOfcId: string): Promise<AdminOfc | null> {
  try {
    // This would require a GET endpoint for individual OFCs
    // For now, we'll need to get it from history or a separate endpoint
    // Placeholder - actual implementation depends on backend API
    return null;
  } catch (error) {
    console.error('Error fetching superseded OFC:', error);
    return null;
  }
}

/**
 * Approve OFC
 */
export async function approveOfc(ofcId: string, request: ApproveOfcRequest): Promise<AdminOfc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        throw new Error('OFC not found');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to approve OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error approving OFC:', error);
    throw error;
  }
}

/**
 * Reject OFC
 */
export async function rejectOfc(ofcId: string, request: RejectOfcRequest): Promise<AdminOfc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        throw new Error('OFC not found');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to reject OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error rejecting OFC:', error);
    throw error;
  }
}

/**
 * Request revision (send back to draft)
 */
export async function requestRevision(ofcId: string, request: RequestRevisionRequest): Promise<AdminOfc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcId}/request-revision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        throw new Error('OFC not found');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to request revision: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting revision:', error);
    throw error;
  }
}

/**
 * Retire approved OFC
 */
export async function retireOfc(ofcId: string, request: RetireOfcRequest): Promise<AdminOfc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcId}/retire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        throw new Error('OFC not found');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to retire OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retiring OFC:', error);
    throw error;
  }
}

/**
 * Get OFC history (all versions for a root ID)
 */
export async function getOfcHistory(ofcRootId: string): Promise<AdminOfc[]> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/admin/ofcs/${ofcRootId}/history`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized - GOVERNING_BODY role required');
      }
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch OFC history: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching OFC history:', error);
    throw error;
  }
}

