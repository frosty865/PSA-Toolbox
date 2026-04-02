/**
 * PSA Data Provider
 * 
 * Single adapter layer that switches between fixture data and real backend APIs.
 * UI components import ONLY this provider, never direct API calls.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const USE_FIXTURES = process.env.USE_FIXTURES === 'true' || process.env.USE_FIXTURES === '1';
const FLASK_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.FLASK_URL || 'http://localhost:5000';

// In-memory state for fixture mode (simulates persistence)
// Using a module-level Map that persists across requests in the same process
const fixtureState: Map<string, any> = new Map();

// Load fixture file helper
function loadFixture(filename: string): any {
  try {
    // Use process.cwd() for Next.js server context
    const filePath = join(process.cwd(), 'app', 'lib', 'fixtures', filename);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[Fixture] Error loading ${filename}:`, error);
    return null;
  }
}

// Get assessments list
export async function getAssessments(): Promise<any[]> {
  if (USE_FIXTURES) {
    const assessments = loadFixture('assessments.json');
    return Array.isArray(assessments) ? assessments : [];
  }

  // Real backend call
  try {
    const url = `${FLASK_BASE}/api/assessments`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      if (response.status === 404) return [];
      if (response.status === 500) {
        console.warn('[API] /api/assessments endpoint may not be implemented');
        return [];
      }
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.assessments || [];
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return [];
  }
}

// Get assessment detail with required elements
export async function getAssessment(assessmentId: string): Promise<any> {
  if (USE_FIXTURES) {
    // Check if we have in-memory state (for updated responses)
    const stateKey = `assessment_${assessmentId}`;
    if (fixtureState.has(stateKey)) {
      return fixtureState.get(stateKey);
    }

    // Load from fixture files
    if (assessmentId === 'fixture-assessment-001') {
      return loadFixture('assessment_detail_baseline.json');
    } else if (assessmentId === 'fixture-assessment-002') {
      return loadFixture('assessment_detail_healthcare.json');
    } else if (assessmentId === 'fixture-assessment-003') {
      return loadFixture('assessment_detail_aviation.json');
    }
    
    return null;
  }

  // Real backend call
  try {
    const url = `${FLASK_BASE}/api/assessments/${encodeURIComponent(assessmentId)}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching assessment:', error);
    throw error;
  }
}

// Save assessment response
export async function saveResponse(
  assessmentId: string,
  elementId: string,
  response: 'YES' | 'NO' | 'N/A'
): Promise<any> {
  if (USE_FIXTURES) {
    // Update in-memory state
    const stateKey = `assessment_${assessmentId}`;
    let assessment = fixtureState.get(stateKey);
    
    if (!assessment) {
      // Load from fixture first
      assessment = await getAssessment(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
    }

    // Update the response
    assessment.required_elements = assessment.required_elements.map((el: any) =>
      el.element_id === elementId
        ? { ...el, current_response: response }
        : el
    );

    // Store updated state
    fixtureState.set(stateKey, assessment);

    // Return success response
    return { status: 'saved', element_id: elementId, response };
  }

  // Real backend call - use Next.js API endpoint
  try {
    const backendResponse = await fetch(`/api/runtime/assessments/${encodeURIComponent(assessmentId)}/responses`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        responses: [{
          question_template_id: elementId,
          response: response,
        }],
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Backend returned ${backendResponse.status}`);
    }

    return await backendResponse.json();
  } catch (error) {
    console.error('Error saving response:', error);
    throw error;
  }
}

// Get assessment scoring results
export async function getResults(assessmentId: string): Promise<any> {
  if (USE_FIXTURES) {
    // Load from fixture files
    if (assessmentId === 'fixture-assessment-001') {
      return loadFixture('scoring_result_baseline.json');
    } else if (assessmentId === 'fixture-assessment-002') {
      return loadFixture('scoring_result_healthcare.json');
    } else if (assessmentId === 'fixture-assessment-003') {
      return loadFixture('scoring_result_aviation.json');
    }
    
    // Default: return baseline-only result
    return loadFixture('scoring_result_baseline.json');
  }

  // Real backend call
  try {
    const url = `${FLASK_BASE}/api/assessment/scoring?documentId=${encodeURIComponent(assessmentId)}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching results:', error);
    throw error;
  }
}

/**
 * Update assessment status
 */
export async function updateAssessmentStatus(
  assessmentId: string,
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'LOCKED'
): Promise<any> {
  try {
    const response = await fetch(`/api/runtime/assessments/${encodeURIComponent(assessmentId)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Backend returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating assessment status:', error);
    throw error;
  }
}
