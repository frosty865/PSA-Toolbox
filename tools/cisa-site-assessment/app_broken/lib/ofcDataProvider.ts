/**
 * OFC Data Provider
 * 
 * Provides functions to interact with backend OFC APIs.
 * All functions call backend endpoints - no local mocks.
 */

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000';

export interface Ofc {
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

export interface CreateOfcRequest {
  ofc_text: string;
  rationale: string;
  context_conditions?: string;
  discipline?: string;
  subtype?: string;
  assessment_id?: string;
}

export interface SubmitOfcResponse {
  ofc_id: string;
  status: string;
}

export interface ProposeChangeRequest {
  ofc_text: string;
  rationale: string;
  context_conditions?: string;
}

/**
 * Get OFCs submitted by current user
 */
export async function getMyOfcs(): Promise<Ofc[]> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs/mine`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch my OFCs: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.ofcs || [];
  } catch (error) {
    console.error('Error fetching my OFCs:', error);
    throw error;
  }
}

/**
 * Get approved OFCs
 */
export async function getApprovedOfcs(): Promise<Ofc[]> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs/approved`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch approved OFCs: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.ofcs || [];
  } catch (error) {
    console.error('Error fetching approved OFCs:', error);
    throw error;
  }
}

/**
 * Get OFC by ID
 */
export async function getOfcById(ofcId: string): Promise<Ofc | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs/${ofcId}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      throw new Error(`Failed to fetch OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching OFC:', error);
    throw error;
  }
}

/**
 * Get latest approved OFC for a root ID
 */
export async function getLatestApprovedOfc(ofcRootId: string): Promise<Ofc | null> {
  try {
    const approved = await getApprovedOfcs();
    const rootOfcs = approved.filter(ofc => ofc.ofc_root_id === ofcRootId);
    
    if (rootOfcs.length === 0) {
      return null;
    }
    
    // Get highest version
    return rootOfcs.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
  } catch (error) {
    console.error('Error fetching latest approved OFC:', error);
    throw error;
  }
}

/**
 * Create new OFC (nomination)
 */
export async function createOfc(request: CreateOfcRequest): Promise<Ofc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating OFC:', error);
    throw error;
  }
}

/**
 * Submit OFC for review
 */
export async function submitOfc(ofcId: string): Promise<SubmitOfcResponse> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs/${ofcId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid state transition');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to submit OFC: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error submitting OFC:', error);
    throw error;
  }
}

/**
 * Propose change to approved OFC
 */
export async function proposeChange(ofcRootId: string, request: ProposeChangeRequest): Promise<Ofc> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/runtime/ofcs/${ofcRootId}/propose-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized');
      }
      if (response.status === 404) {
        throw new Error('OFC root not found');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to propose change: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error proposing change:', error);
    throw error;
  }
}

