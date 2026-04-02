import { NextRequest, NextResponse } from 'next/server';
import { normalizePublisherName, getPublisherFromSources } from '@/app/lib/sourceRegistry/publisherNormalizer';
import { screenCandidateUrl } from '@/app/lib/crawler/screenCandidateUrl';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/source-registry/fetch-metadata
 * Fetch metadata from a URL (title, description, etc.)
 * URL is screened first: must be a usable PDF (or landing that resolves to one).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'url is required (string)' },
        { status: 400 }
      );
    }

    const screen = await screenCandidateUrl(url, {
      target: { kind: 'corpus' },
      strictness: 'strict',
      resolveLandingToPdf: true,
    });
    if (!screen.ok) {
      const reasonText = screen.reasons?.length
        ? `: ${screen.reasons.join('; ')}`
        : screen.rejectCode
          ? ` (${screen.rejectCode})`
          : '';
      return NextResponse.json(
        {
          ok: false,
          error: `URL did not pass screening${reasonText}`,
          rejectCode: screen.rejectCode,
          reasons: screen.reasons,
          canonicalUrl: screen.canonicalUrl,
        },
        { status: 400 }
      );
    }

    const urlToFetch = screen.finalUrl;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlToFetch);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format after screening' },
        { status: 400 }
      );
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(urlToFetch, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      const html = await response.text();
      
      // Extract metadata from HTML
      const metadata = extractMetadata(html, parsedUrl);

      return NextResponse.json({
        success: true,
        metadata
      });

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: 'Request timeout - URL took too long to respond' },
          { status: 408 }
        );
      }

      throw error;
    }

  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/fetch-metadata POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metadata',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Extract metadata from HTML content
 * Enhanced for government documents that often lack meta tags
 */
function extractMetadata(html: string, url: URL): {
  title: string | null;
  description: string | null;
  publisher: string | null;
  year: number | null;
} {
  const result: {
    title: string | null;
    description: string | null;
    publisher: string | null;
    year: number | null;
  } = {
    title: null,
    description: null,
    publisher: null,
    year: null,
  };

  // Step 1: Try meta tags first (standard approach)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.title = cleanText(titleMatch[1]);
  }

  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch && !result.title) {
    result.title = cleanText(ogTitleMatch[1]);
  }

  const ogDescriptionMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescriptionMatch) {
    result.description = cleanText(ogDescriptionMatch[1]);
  }

  const metaDescriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaDescriptionMatch && !result.description) {
    result.description = cleanText(metaDescriptionMatch[1]);
  }

  // Step 2: Extract visible content from HTML (for government documents)
  const visibleContent = extractVisibleContent(html);
  
  // Extract title from headings if not found in meta tags
  if (!result.title || result.title.length < 10) {
    const headingTitle = extractTitleFromHeadings(visibleContent);
    if (headingTitle && headingTitle.length > (result.title?.length ?? 0)) {
      result.title = headingTitle;
    }
  }

  // Extract description from first paragraph if not found
  if (!result.description) {
    const firstParagraph = extractFirstParagraph(visibleContent);
    if (firstParagraph && firstParagraph.length > 50) {
      result.description = truncateText(firstParagraph, 500);
    }
  }

  // Step 3: Extract publisher from visible content or domain
  // Use the publisher normalizer to ensure consistent naming
  const inferredFromDomain = inferPublisher(url.hostname);

  // Use the getPublisherFromSources function which handles normalization
  result.publisher = getPublisherFromSources(
    null, // No provided publisher
    url.toString(), // URL
    visibleContent // Content to search
  );
  
  // Fallback to domain inference if nothing found
  if (!result.publisher && inferredFromDomain) {
    result.publisher = normalizePublisherName(inferredFromDomain) || inferredFromDomain;
  }

  // Step 4: Extract year from visible content and meta tags
  const yearMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*name=["']publication-date["'][^>]*content=["']([^"']+)["']/i);
  
  if (yearMatch) {
    const dateStr = yearMatch[1];
    const year = extractYearFromDate(dateStr);
    if (year) result.year = year;
  }

  // Extract year from visible content (common in government docs)
  if (!result.year) {
    const visibleYear = extractYearFromContent(visibleContent);
    if (visibleYear) result.year = visibleYear;
  }

  // Try to extract year from title if still not found
  if (!result.year && result.title) {
    const yearFromTitle = extractYearFromTitle(result.title);
    if (yearFromTitle) result.year = yearFromTitle;
  }

  return result;
}

/**
 * Extract visible text content from HTML (removes script/style tags)
 */
function extractVisibleContent(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Extract text from main content areas (prioritize main, article, content areas)
  const mainContentMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                          text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                          text.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                          text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  
  if (mainContentMatch) {
    text = mainContentMatch[1];
  }
  
  // Remove HTML tags and decode entities
  text = text.replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/\s+/g, ' ')
             .trim();
  
  return text;
}

/**
 * Extract title from HTML headings (h1, h2, h3)
 * Handles nested tags and multi-line content
 */
function extractTitleFromHeadings(html: string): string | null {
  // Try h1 first (most prominent) - handle nested tags
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const title = extractTextFromHtml(h1Match[1]);
    if (title && title.length >= 10 && title.length <= 200) {
      return title;
    }
  }

  // Try h2
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const title = extractTextFromHtml(h2Match[1]);
    if (title && title.length >= 10 && title.length <= 200) {
      return title;
    }
  }

  // Try h3
  const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (h3Match) {
    const title = extractTextFromHtml(h3Match[1]);
    if (title && title.length >= 10 && title.length <= 200) {
      return title;
    }
  }

  // Fallback: look for prominent text in cover page area (first 2000 chars)
  const coverHtml = html.substring(0, 2000);
  const strongMatch = coverHtml.match(/<strong[^>]*>([\s\S]{20,150}?)<\/strong>/i);
  if (strongMatch) {
    const title = extractTextFromHtml(strongMatch[1]);
    if (title && title.length >= 10 && title.length <= 200) {
      return title;
    }
  }

  return null;
}

/**
 * Extract plain text from HTML fragment (removes tags, decodes entities)
 */
function extractTextFromHtml(htmlFragment: string): string {
  return htmlFragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract first substantial paragraph from content
 */
function extractFirstParagraph(html: string): string | null {
  // Try to find first <p> tag (handle nested tags)
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch) {
    const text = extractTextFromHtml(pMatch[1]);
    if (text && text.length >= 50) {
      return text;
    }
  }

  // Fallback: extract first substantial text block
  const visibleText = extractVisibleContent(html);
  const sentences = visibleText.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    return sentences.slice(0, 2).join('. ').trim();
  }

  return null;
}

/**
 * Extract publisher/agency name from visible content
 * @internal Reserved for future use when publisher is not inferred from getPublisherFromSources
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future use
function extractPublisherFromContent(html: string): string | null {
  const text = extractVisibleContent(html);
  
  // Common government agency patterns
  const agencyPatterns = [
    /U\.?S\.?\s*(?:Department\s+of\s+)?(?:Homeland\s+Security|DHS)/i,
    /(?:Cybersecurity\s+and\s+Infrastructure\s+Security\s+Agency|CISA)/i,
    /(?:Federal\s+Emergency\s+Management\s+Agency|FEMA)/i,
    /(?:National\s+Institute\s+of\s+Standards\s+and\s+Technology|NIST)/i,
    /(?:National\s+Fire\s+Protection\s+Association|NFPA)/i,
    /(?:American\s+Society\s+for\s+Industrial\s+Security|ASIS)/i,
    /(?:Infrastructure\s+Security\s+Coalition|ISC)/i,
    /(?:General\s+Services\s+Administration|GSA)/i,
  ];

  // Check first 2000 characters (cover page area)
  const coverPageText = text.substring(0, 2000);
  
  // Use the publisher normalizer to find and normalize publisher names
  for (const pattern of agencyPatterns) {
    const match = coverPageText.match(pattern);
    if (match) {
      const matched = match[0];
      const normalized = normalizePublisherName(matched);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * Extract year from visible content (common patterns in government docs)
 */
function extractYearFromContent(html: string): number | null {
  const text = extractVisibleContent(html);
  
  // Look for common date patterns in first 3000 chars (cover page)
  const coverPageText = text.substring(0, 3000);
  
  // Patterns: "Published: 2024", "Date: 2024", "© 2024", "(2024)", etc.
  const datePatterns = [
    /(?:published|date|issued|released|copyright|©)[\s:]*(\d{4})/i,
    /\((\d{4})\)/,
    /\b(19\d{2}|20\d{2})\b/,
  ];

  for (const pattern of datePatterns) {
    const matches = coverPageText.matchAll(new RegExp(pattern.source, 'gi'));
    for (const match of matches) {
      const year = parseInt(match[1] || match[0], 10);
      if (year >= 1900 && year <= 2100) {
        return year;
      }
    }
  }

  return null;
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Truncate text to max length, preserving word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Infer publisher from hostname
 * Uses the publisher normalizer for consistent naming
 */
function inferPublisher(hostname: string): string | null {
  // Remove www. prefix
  const domain = hostname.replace(/^www\./, '');
  
  // Extract organization from domain
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const org = parts[parts.length - 2];
    
    // Use the publisher normalizer
    const normalized = normalizePublisherName(org);
    if (normalized) {
      return normalized;
    }
    
    // Fallback: capitalize properly
    return org.charAt(0).toUpperCase() + org.slice(1).toLowerCase();
  }

  return null;
}

/**
 * Extract year from date string
 */
function extractYearFromDate(dateStr: string): number | null {
  // Try ISO format: 2024-01-15
  const isoMatch = dateStr.match(/(\d{4})-\d{2}-\d{2}/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    if (year >= 1900 && year <= 2100) return year;
  }

  // Try other formats
  const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1900 && year <= 2100) return year;
  }

  return null;
}

/**
 * Extract year from title text
 */
function extractYearFromTitle(title: string): number | null {
  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1900 && year <= 2100) return year;
  }
  return null;
}

