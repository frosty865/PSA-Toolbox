import { NextRequest, NextResponse } from 'next/server';
import { getIntentByCanonId, getAllIntentObjects, getIntentObjectsBySubtype, getIntentIndex } from '@/app/lib/intentLoader';
import type { IntentObject, IntentObjectsFile } from '@/app/lib/types/intent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/intent-objects
 * 
 * Returns intent objects for baseline questions.
 * 
 * Query params:
 * - canon_id: Return single intent object for this canon_id
 * - subtype_code: Return all intent objects for this subtype_code
 * - format: 'index' | 'list' (default: 'list')
 *   - 'index': Returns Map-like object { [canon_id]: IntentObject }
 *   - 'list': Returns array of IntentObject[]
 * 
 * Response:
 * - Single object: IntentObject | null
 * - By subtype: IntentObject[]
 * - All: IntentObjectsFile | { [canon_id]: IntentObject }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const canonId = searchParams.get('canon_id');
    const subtypeCode = searchParams.get('subtype_code');
    const format = searchParams.get('format') || 'list';

    // Single canon_id lookup (with meaning enrichment)
    if (canonId) {
      const intent = await getIntentByCanonId(canonId);
      return NextResponse.json(intent);
    }

    // By subtype_code
    if (subtypeCode) {
      const intents = getIntentObjectsBySubtype(subtypeCode);
      return NextResponse.json(intents);
    }

    // All intent objects
    if (format === 'index') {
      const index = getIntentIndex();
      const indexObj: Record<string, IntentObject> = {};
      
      for (const [canonId, intent] of index.entries()) {
        indexObj[canonId] = intent;
      }
      
      return NextResponse.json(indexObj);
    }

    // Default: return full file structure
    const allIntents = getAllIntentObjects();
    
    // Build counts
    const depth1 = allIntents.filter(i => i.depth === 1).length;
    const depth2 = allIntents.filter(i => i.depth === 2).length;
    
    const response: IntentObjectsFile = {
      version: '1.0',
      generated_at: new Date().toISOString(), // We don't store this in the file, use current time
      counts: {
        depth1,
        depth2,
        total: allIntents.length
      },
      questions: allIntents
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[API /api/runtime/intent-objects] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load intent objects',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

