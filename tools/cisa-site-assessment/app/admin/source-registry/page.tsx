"use client";

import React, { useState, useEffect, useRef } from 'react';
import { SourceRegistryCreateSchema, SourceRegistryUpdateSchema, normalizeKey, extractStatusFromNotes, extractDescriptionFromNotes } from '@/app/lib/sourceRegistry/schema';
import { extractPublisherFromUrl, isUnacceptablePublisher, FILTER_NO_PUBLISHER } from '@/app/lib/sourceRegistry/publisherNormalizer';

interface Source {
  id: string;
  source_key: string;
  publisher: string;
  tier: number;
  title: string;
  publication_date: string | null;
  source_type: 'pdf' | 'web' | 'doc';
  canonical_url: string | null;
  local_path: string | null;
  doc_sha256: string | null;
  retrieved_at: string | null;
  scope_tags: string[];
  /** Citation-style label from scope_tags (e.g. "CISA (2025). Title." or "MIT (2025). Title."). */
  citation_label?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Total chunks across corpus_documents linked to this source (CORPUS only). */
  chunk_count?: number;
  /** True when loaded from RUNTIME.module_sources (Module Sources tab) */
  _isModuleSource?: boolean;
  _moduleCode?: string;
  /** True when source is Technology Library (scope_tags.tags.library = 'technology') */
  is_technology_library?: boolean;
}

interface FormErrors {
  [key: string]: string | undefined;
}

export default function SourceRegistryPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [publisherFilter, setPublisherFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [sourceCategory, setSourceCategory] = useState<'module' | 'corpus' | 'technology' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [addFormValid, setAddFormValid] = useState(false);
  const [updateFormValid, setUpdateFormValid] = useState(true);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState(false);
  const [extractingFromPdf, setExtractingFromPdf] = useState(false);
  const [pdfMetadataError, setPdfMetadataError] = useState<string | null>(null);
  const [pdfMetadataSuccess, setPdfMetadataSuccess] = useState(false);
  const [_extractingMetadata, _setExtractingMetadata] = useState(false);
  void _setExtractingMetadata;
  const [createMetadataError, setCreateMetadataError] = useState<string | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const [_activeSources, setActiveSources] = useState<Array<{ id: string; source_key: string; publisher: string; title: string; tier: number }>>([]);
  const [_loadingSources, setLoadingSources] = useState(false);
  void _extractingMetadata;
  void _activeSources;
  void _loadingSources;
  const [zeroChunkDocCount, setZeroChunkDocCount] = useState<number | null>(null);
  const [reprocessZeroChunkLoading, setReprocessZeroChunkLoading] = useState(false);
  const [reprocessZeroChunkRecursiveLoading, setReprocessZeroChunkRecursiveLoading] = useState(false);
  const [syncChunkCountsLoading, setSyncChunkCountsLoading] = useState(false);
  const [purgeZeroChunkLoading, setPurgeZeroChunkLoading] = useState(false);
  const [purgeNonPdfLoading, setPurgeNonPdfLoading] = useState(false);
  const [rerunScopeTagsLoading, setRerunScopeTagsLoading] = useState(false);
  const [ingestLoadingSourceKey, setIngestLoadingSourceKey] = useState<string | null>(null);
  const [chunksFilter, setChunksFilter] = useState<'all' | 'zero'>('all');
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportData, setReportData] = useState<{
    report_date: string;
    summary: { statistics: Record<string, unknown>; duplicates_count: number; missing_info_count: Record<string, number> };
    duplicates: Array<{ type: string; sources: Array<{ source_key: string; publisher: string; title: string; canonical_url?: string | null }> }>;
    missing_info: Record<string, Array<{ source_key: string; publisher: string; title: string; [k: string]: unknown }>>;
    all_sources: Array<{ source_key: string; publisher: string; tier: number; title: string; publication_date: string | null; source_type: string; canonical_url: string | null; ingested: boolean; retrieved_at: string | null; created_at: string }>;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [schemaLimitWarning, setSchemaLimitWarning] = useState(false);
  const [sortKey, setSortKey] = useState<'publisher' | 'tier' | 'title' | 'chunk_count' | 'source_type'>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [scopeTagOptions, setScopeTagOptions] = useState<{
    sectors: Array<{ value: string; label: string }>;
    subsectors: Array<{ value: string; label: string; sector_id: string }>;
    modules: string[];
    disciplines: string[];
    subtypes: string[];
    fallback: string[];
  } | null>(null);
  const [editingScopeTags, setEditingScopeTags] = useState<string[]>([]);
  const [editingSector, setEditingSector] = useState<string>('');
  const [editingSubsector, setEditingSubsector] = useState<string>('');
  const [editingModule, setEditingModule] = useState<string>('');
  const [editingIsTechnologyLibrary, setEditingIsTechnologyLibrary] = useState<boolean>(false);
  /** Sectors from /api/reference/sectors (same as reference/sectors page). */
  const [referenceSectors, setReferenceSectors] = useState<Array<{ id: string; sector_name: string; name?: string }>>([]);
  /** Subsectors for selected sector from /api/reference/subsectors?sectorId= */
  const [referenceSubsectors, setReferenceSubsectors] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSubsectors, setLoadingSubsectors] = useState(false);

  useEffect(() => {
    loadSources();
    loadActiveSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when filters change
  }, [publisherFilter, tierFilter, sourceCategory, chunksFilter]);

  // Load sectors from reference API (same as reference/sectors page)
  useEffect(() => {
    fetch('/api/reference/sectors', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.sectors || []).filter((s: { is_active?: boolean }) => s.is_active !== false);
        setReferenceSectors(list.sort((a: { sector_name?: string; name?: string }, b: { sector_name?: string; name?: string }) => (a.sector_name || a.name || '').localeCompare(b.sector_name || b.name || '')));
      })
      .catch(() => setReferenceSectors([]));
  }, []);

  // When sector is selected, fetch subsectors from reference API (same as reference/sectors page)
  useEffect(() => {
    if (!editingSector) {
      setReferenceSubsectors([]);
      setLoadingSubsectors(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingSubsectors(true);
    fetch(`/api/reference/subsectors?sectorId=${encodeURIComponent(editingSector)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.subsectors || []).filter((s: { is_active?: boolean }) => s.is_active !== false);
        setReferenceSubsectors(list.sort((a: { name?: string }, b: { name?: string }) => (a.name || '').localeCompare(b.name || '')));
      })
      .catch(() => { if (!cancelled) setReferenceSubsectors([]); })
      .finally(() => { if (!cancelled) setLoadingSubsectors(false); });
    return () => { cancelled = true; };
  }, [editingSector]);

  // Load scope-tag options on mount for Module/Other dropdown only
  useEffect(() => {
    if (scopeTagOptions) return;
    fetch('/api/admin/source-registry/scope-tag-options', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.modules) {
          const dropNumeric = (arr: unknown[]) => (arr ?? []).filter((s): s is string => typeof s === 'string' && s.trim() !== '' && !/^\d+$/.test(s.trim()));
          setScopeTagOptions({
            sectors: [],
            subsectors: [],
            modules: dropNumeric(data.modules ?? []),
            disciplines: dropNumeric(data.disciplines ?? []),
            subtypes: dropNumeric(data.subtypes ?? []),
            fallback: dropNumeric(data.fallback ?? []),
          });
        }
      })
      .catch(() => {});
  }, [scopeTagOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, chunksFilter, sourceCategory]);

  /** Client-side: exclude purely numeric strings from scope tag options/selection. */
  const isNumericScopeTag = (t: string) => /^\d+$/.test(String(t).trim());

  /** Initial scope_tags from API (display names) for resolving sector/subsector/module before we replace with codes. */
  const initialScopeTagsForRef = useRef<string[]>([]);

  // When opening edit modal: set scope tags from source, clear dropdowns, load options if needed
  useEffect(() => {
    if (editingSource) {
      const tags = (editingSource.scope_tags ?? [])
        .filter((t: unknown) => typeof t === 'string' && (t as string).trim())
        .filter((t) => !isNumericScopeTag(t as string))
        .slice(0, 2) as string[];
      initialScopeTagsForRef.current = tags;
      setEditingScopeTags(tags);
      setEditingSector('');
      setEditingSubsector('');
      setEditingModule('');
      setEditingIsTechnologyLibrary(!!editingSource.is_technology_library);
      setUpdateFormValid(
        editingSource._isModuleSource ? !!editingSource.title : tags.length >= 1
      );
      if (!scopeTagOptions) {
        fetch('/api/admin/source-registry/scope-tag-options', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok && data.modules) {
              const dropNumeric = (arr: unknown[]) => (arr ?? []).filter((s): s is string => typeof s === 'string' && s.trim() !== '' && !/^\d+$/.test(s.trim()));
              setScopeTagOptions({
                sectors: [],
                subsectors: [],
                modules: dropNumeric(data.modules ?? []),
                disciplines: dropNumeric(data.disciplines ?? []),
                subtypes: dropNumeric(data.subtypes ?? []),
                fallback: dropNumeric(data.fallback ?? []),
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [editingSource]); // eslint-disable-line react-hooks/exhaustive-deps -- only when editingSource opens

  // When we first open edit: populate Sector / Subsector / Module from source scope_tags (once per source, using reference APIs).
  // Also set editingScopeTags to resolved *codes* so PATCH receives canonical codes, not display names.
  const populatedScopeTagsForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingSource) {
      populatedScopeTagsForRef.current = null;
      return;
    }
    if (populatedScopeTagsForRef.current === editingSource.source_key) return;
    if (editingScopeTags.length === 0) return;
    const sectorMatch = referenceSectors.find((s) => editingScopeTags.some((t) => t === s.id || t === (s.sector_name || s.name)));
    const moduleMatch = editingScopeTags.find((t) => scopeTagOptions?.modules.includes(t) || scopeTagOptions?.fallback?.includes(t));
    if (sectorMatch) setEditingSector(sectorMatch.id);
    if (moduleMatch) setEditingModule(moduleMatch);
    // Send codes to API, not display names: use sector id and module code
    const codesFromSectorAndModule = [sectorMatch?.id, moduleMatch].filter((x): x is string => Boolean(x));
    if (codesFromSectorAndModule.length > 0) setEditingScopeTags(codesFromSectorAndModule);
    populatedScopeTagsForRef.current = editingSource.source_key;
  }, [editingSource, editingScopeTags, referenceSectors, scopeTagOptions]);

  // After subsectors load for selected sector, set editingSubsector from original tags (display names) and set scope_tags to codes.
  useEffect(() => {
    if (!editingSource || referenceSubsectors.length === 0) return;
    if (populatedScopeTagsForRef.current !== editingSource.source_key) return;
    const originalTags = initialScopeTagsForRef.current ?? [];
    const subsectorMatch = referenceSubsectors.find((s) => originalTags.some((t) => t === s.id || t === s.name));
    if (subsectorMatch) {
      setEditingSubsector(subsectorMatch.id);
      // PATCH expects codes: sector, subsector, module (use current dropdown state)
      const codes = [editingSector, subsectorMatch.id, editingModule].filter((x): x is string => Boolean(x));
      setEditingScopeTags(codes);
    }
  }, [editingSource, referenceSubsectors, editingSector, editingModule]);

  // Load count of CORPUS documents with 0 chunks; auto re-run (our failure – queue reprocess + sync drift).
  useEffect(() => {
    if (sourceCategory === 'module') {
      setZeroChunkDocCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok && typeof data.count === 'number') {
          setZeroChunkDocCount(data.count);
          // 0 chunks is our failure: fix drift then queue reprocessing (re-run), don't ignore.
          if (data.count > 0) {
            try {
              await fetch('/api/admin/corpus/sync-chunk-counts', { method: 'POST' });
              await fetch('/api/admin/corpus/reprocess-zero-chunk', { method: 'POST' });
            } catch {
              // Non-blocking; banner still shows manual Sync / Queue / Purge
            }
          }
        } else if (!cancelled) setZeroChunkDocCount(null);
      } catch {
        if (!cancelled) setZeroChunkDocCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceCategory, loading]);

  const loadActiveSources = async () => {
    try {
      setLoadingSources(true);
      const response = await fetch('/api/admin/source-registry/active', {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to load active sources: ${response.status}`);
      }

      const data = await response.json();
      if (data.ok && data.data) {
        setActiveSources(data.data);
      }
    } catch (err) {
      console.error('Failed to load active sources:', err);
    } finally {
      setLoadingSources(false);
    }
  };

  const loadSources = async (cacheBust?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      setSchemaLimitWarning(false);

      // Module sources live in RUNTIME.module_sources (not CORPUS source_registry)
      if (sourceCategory === 'module') {
        const response = await fetch(`/api/admin/module-sources?${cacheBust ? `_t=${Date.now()}` : ''}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load module sources: ${response.status}`);
        }
        const data = await response.json();
        const raw = data.sources || [];
        // Map to Source-like shape so the table and filters work
        const sourcesWithDefaults = raw.map((ms: Record<string, unknown>) => {
          const pub = ms.publisher as string | null | undefined;
          const publisher = (pub != null && String(pub).trim() !== '' && !isUnacceptablePublisher(pub))
            ? String(pub)
            : '';
          const moduleCode = ms.module_code != null ? String(ms.module_code) : undefined;
          const scopeTags = ['Module Upload', ...(moduleCode ? [moduleCode] : [])];
          return {
          id: String(ms.id ?? ''),
          source_key: String(ms.storage_relpath ?? '') || `${String(ms.module_code ?? '')}:${String(ms.id ?? '')}`,
          publisher,
          tier: 0,
          title: String(ms.source_label ?? ms.storage_relpath ?? 'Unnamed'),
          publication_date: null,
          source_type: 'pdf' as const,
          canonical_url: ms.source_url != null ? String(ms.source_url) : null,
          local_path: ms.storage_relpath != null ? String(ms.storage_relpath) : null,
          doc_sha256: ms.sha256 != null ? String(ms.sha256) : null,
          retrieved_at: null,
          scope_tags: scopeTags,
          notes: `Module source (${String(ms.source_type ?? '')})`,
          created_at: String(ms.created_at ?? ''),
          updated_at: String(ms.created_at ?? ''),
          chunk_count: typeof ms.chunk_count === 'number' ? ms.chunk_count : 0,
          _isModuleSource: true as const,
          _moduleCode: moduleCode,
        };
        });
        setSources(sourcesWithDefaults);
        return;
      }

      // All: CORPUS source_registry + RUNTIME module_sources (so module-only docs appear)
      if (sourceCategory === 'all') {
        const params = new URLSearchParams();
        if (publisherFilter) params.set('publisher', publisherFilter);
        if (tierFilter) params.set('tier', tierFilter);
        if (chunksFilter === 'zero') params.set('zeroChunkOnly', 'true');
        if (cacheBust) params.set('_t', String(Date.now()));
        const [registryRes, moduleRes] = await Promise.all([
          fetch(`/api/admin/source-registry?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/admin/module-sources?${cacheBust ? `_t=${Date.now()}` : ''}`, { cache: 'no-store' }),
        ]);
        if (!registryRes.ok) throw new Error(`Failed to load sources: ${registryRes.status}`);
        if (!moduleRes.ok) throw new Error(`Failed to load module sources: ${moduleRes.status}`);
        const registryData = await registryRes.json();
        if (registryData.schema_limit) setSchemaLimitWarning(true);
        const moduleData = await moduleRes.json();
        const corpusSources = (registryData.sources || []).map((source: Record<string, unknown>) => ({
          ...source,
          id: String(source.id ?? ''),
          scope_tags: Array.isArray(source.scope_tags) ? (source.scope_tags as unknown[]).filter((tag: unknown) => typeof tag === 'string') : [],
          citation_label: source.citation_label ?? null,
          _isModuleSource: false as const,
        }));
        const rawModule = moduleData.sources || [];
        const corpusIds = new Set(corpusSources.map((s: { id: string }) => s.id));
        const corpusSha256Set = new Set(
          corpusSources
            .map((s: { doc_sha256?: string | null }) => s.doc_sha256)
            .filter((h: string | null | undefined): h is string => !!h && String(h).trim() !== '')
        );
        const moduleSources = rawModule
          .map((ms: Record<string, unknown>) => {
            const pub = ms.publisher as string | null | undefined;
            const publisher = (pub != null && String(pub).trim() !== '' && !isUnacceptablePublisher(pub))
              ? String(pub)
              : '';
            const moduleCode = ms.module_code != null ? String(ms.module_code) : undefined;
            const scopeTags = ['Module Upload', ...(moduleCode ? [moduleCode] : [])];
            return {
              id: String(ms.id ?? ''),
              source_key: String(ms.storage_relpath ?? '') || `${String(ms.module_code ?? '')}:${String(ms.id ?? '')}`,
              publisher,
              tier: 0,
              title: String(ms.source_label ?? ms.storage_relpath ?? 'Unnamed'),
              publication_date: null,
              source_type: 'pdf' as const,
              canonical_url: ms.source_url != null ? String(ms.source_url) : null,
              local_path: ms.storage_relpath != null ? String(ms.storage_relpath) : null,
              doc_sha256: ms.sha256 != null ? String(ms.sha256) : null,
              retrieved_at: null,
              scope_tags: scopeTags,
              notes: `Module source (${String(ms.source_type ?? '')})`,
              created_at: String(ms.created_at ?? ''),
              updated_at: String(ms.created_at ?? ''),
              chunk_count: typeof ms.chunk_count === 'number' ? ms.chunk_count : 0,
              _isModuleSource: true as const,
              _moduleCode: moduleCode,
              _corpus_source_id: ms.corpus_source_id != null ? String(ms.corpus_source_id) : null as string | null,
            };
          })
          // Dedupe: skip module rows that point at a corpus source we already show, or same doc by sha256
          .filter((ms: { _corpus_source_id?: string | null; doc_sha256?: string | null }) => {
            if (ms._corpus_source_id && corpusIds.has(ms._corpus_source_id)) return false;
            if (ms.doc_sha256 && corpusSha256Set.has(ms.doc_sha256)) return false;
            return true;
          });
        setSources([...corpusSources, ...moduleSources]);
        try {
          const zRes = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
          const zData = await zRes.json();
          if (zRes.ok && typeof zData.count === 'number') setZeroChunkDocCount(zData.count);
        } catch { /* non-blocking */ }
        return;
      }

      const params = new URLSearchParams();
      if (publisherFilter) params.set('publisher', publisherFilter);
      if (tierFilter) params.set('tier', tierFilter);
      if ((sourceCategory as 'module' | 'corpus' | 'technology' | 'all') !== 'all') params.set('category', sourceCategory);
      if (chunksFilter === 'zero') params.set('zeroChunkOnly', 'true');
      if (cacheBust) params.set('_t', String(Date.now()));

      const response = await fetch(`/api/admin/source-registry?${params.toString()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to load sources: ${response.status}`);
      }

      const data = await response.json();
      if (data.schema_limit) setSchemaLimitWarning(true);
      // API returns scope_tags as string[] and optional citation_label
      const sourcesWithDefaults = (data.sources || []).map((source: Record<string, unknown>) => ({
        ...source,
        id: String(source.id ?? ''),
        scope_tags: Array.isArray(source.scope_tags)
          ? (source.scope_tags as unknown[]).filter((tag: unknown) => typeof tag === 'string')
          : [],
        citation_label: source.citation_label ?? null
      }));
      setSources(sourcesWithDefaults);
      if ((sourceCategory as 'module' | 'corpus' | 'all') !== 'module') {
        try {
          const zRes = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
          const zData = await zRes.json();
          if (zRes.ok && typeof zData.count === 'number') setZeroChunkDocCount(zData.count);
        } catch { /* non-blocking */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadataFromUrl = async (url: string) => {
    if (!url || !url.trim()) {
      setMetadataError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setMetadataError('Invalid URL format');
      return;
    }

    setFetchingMetadata(true);
    setMetadataError(null);
    setMetadataSuccess(false);

    try {
      const response = await fetch('/api/admin/source-registry/fetch-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData.error ||
          (errorData.reasons?.length ? `URL did not pass screening: ${errorData.reasons.join('; ')}` : null) ||
          'Failed to fetch metadata';
        throw new Error(message);
      }

      const data = await response.json();
      const metadata = data.metadata;

      // Populate form fields
      const form = document.querySelector('form') as HTMLFormElement;
      if (form) {
        // Helper to set value and trigger change event
        const setValueAndTrigger = (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Set URL field
        const urlInput = form.querySelector('input[name="url"]') as HTMLInputElement;
        if (urlInput) setValueAndTrigger(urlInput, url);

        // Set title
        if (metadata.title) {
          const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
          if (titleInput) setValueAndTrigger(titleInput, metadata.title);
        }

        // Set publisher
        if (metadata.publisher) {
          const publisherInput = form.querySelector('input[name="publisher"]') as HTMLInputElement;
          if (publisherInput) setValueAndTrigger(publisherInput, metadata.publisher);
        }

        // Set description
        if (metadata.description) {
          const descriptionInput = form.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
          if (descriptionInput) setValueAndTrigger(descriptionInput, metadata.description);
        }

        // Set year
        if (metadata.year) {
          const yearInput = form.querySelector('input[name="year"]') as HTMLInputElement;
          if (yearInput) setValueAndTrigger(yearInput, metadata.year.toString());
        }

        // Auto-generate source_key from title and publisher if empty
        const sourceKeyInput = form.querySelector('input[name="source_key"]') as HTMLInputElement;
        if (sourceKeyInput && !sourceKeyInput.value) {
          let suggestedKey = '';
          
          // Use publisher + title if both available
          if (metadata.publisher && metadata.title) {
            suggestedKey = normalizeKey(`${metadata.publisher}_${metadata.title}`);
          } else if (metadata.title) {
            suggestedKey = normalizeKey(metadata.title);
          }
          
          // Ensure minimum length
          if (suggestedKey.length >= 6) {
            setValueAndTrigger(sourceKeyInput, suggestedKey);
          } else if (suggestedKey.length > 0) {
            // Pad with year if available
            if (metadata.year) {
              suggestedKey = normalizeKey(`${suggestedKey}_${metadata.year}`);
              if (suggestedKey.length >= 6) {
                setValueAndTrigger(sourceKeyInput, suggestedKey);
              }
            }
          }
        }

        // Trigger validation after a short delay to ensure all values are set
        setTimeout(() => {
          const validation = validateCreateForm(new FormData(form));
          setAddFormValid(validation.valid);
          setFormErrors(validation.errors);
        }, 100);
        
        // Show success message
        setMetadataSuccess(true);
        setTimeout(() => setMetadataSuccess(false), 3000);
      }

    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : 'Failed to fetch metadata');
      setMetadataSuccess(false);
    } finally {
      setFetchingMetadata(false);
    }
  };

  /** Pull title, publisher, citation from a PDF file (content-only; filename is never used). */
  const fetchMetadataFromPdf = async (file: File) => {
    setPdfMetadataError(null);
    setPdfMetadataSuccess(false);
    setExtractingFromPdf(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/source-registry/extract-pdf-metadata', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to extract metadata from PDF');
      }
      const metadata = data.metadata || data;
      const form = document.querySelector('form') as HTMLFormElement;
      if (!form) return;
      const setValueAndTrigger = (el: HTMLInputElement | HTMLTextAreaElement | null, value: string) => {
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      if (metadata.title) {
        const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
        if (titleInput) setValueAndTrigger(titleInput, metadata.title);
      }
      if (metadata.publisher) {
        const publisherInput = form.querySelector('input[name="publisher"]') as HTMLInputElement;
        if (publisherInput) setValueAndTrigger(publisherInput, metadata.publisher);
      }
      if (metadata.year != null) {
        const yearInput = form.querySelector('input[name="year"]') as HTMLInputElement;
        if (yearInput) setValueAndTrigger(yearInput, String(metadata.year));
      }
      if (metadata.citation_short || metadata.citation_full) {
        const notesInput = form.querySelector('textarea[name="notes"]') as HTMLTextAreaElement;
        if (notesInput) {
          const citation = metadata.citation_short || metadata.citation_full || '';
          setValueAndTrigger(notesInput, citation);
        }
      }
      const sourceKeyInput = form.querySelector('input[name="source_key"]') as HTMLInputElement;
      if (sourceKeyInput && !sourceKeyInput.value && metadata.title) {
        const pub = metadata.publisher || '';
        const suggested = pub ? normalizeKey(`${pub}_${metadata.title}`) : normalizeKey(metadata.title);
        if (suggested.length >= 6) setValueAndTrigger(sourceKeyInput, suggested);
      }
      setTimeout(() => {
        const validation = validateCreateForm(new FormData(form));
        setAddFormValid(validation.valid);
        setFormErrors(validation.errors);
      }, 100);
      setPdfMetadataSuccess(true);
      setTimeout(() => setPdfMetadataSuccess(false), 3000);
    } catch (err) {
      setPdfMetadataError(err instanceof Error ? err.message : 'Failed to extract metadata from PDF');
    } finally {
      setExtractingFromPdf(false);
    }
  };

  /** Create suggested title and publisher metadata from URL only (no fetch). */
  const createMetadataFromUrl = (urlInput: string) => {
    setCreateMetadataError(null);
    const urlStr = (urlInput || '').trim();
    if (!urlStr) {
      setCreateMetadataError('Please enter a URL');
      return;
    }
    try {
      const url = new URL(urlStr);
      const publisher = extractPublisherFromUrl(urlStr)
        ?? (() => {
          const host = url.hostname.replace(/^www\./, '');
          const segment = host.split('.')[0] || host;
          return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : 'Source';
        })();
      const pathSegments = url.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1] || 'Document';
      const titleFromPath = lastSegment
        .replace(/\.(pdf|html?)$/i, '')
        .replace(/-|_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const form = document.querySelector('form') as HTMLFormElement;
      if (!form) {
        setCreateMetadataError('Form not found');
        return;
      }
      const setVal = (el: HTMLInputElement | HTMLTextAreaElement | null, val: string) => {
        if (!el) return;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal(form.querySelector('input[name="url"]'), urlStr);
      setVal(form.querySelector('input[name="title"]'), titleFromPath);
      setVal(form.querySelector('input[name="publisher"]'), publisher);
      setVal(form.querySelector('input[name="year"]'), new Date().getFullYear().toString());
      const keyInput = form.querySelector('input[name="source_key"]') as HTMLInputElement;
      if (keyInput && !keyInput.value) {
        const suggested = normalizeKey(`${publisher}_${titleFromPath}`);
        if (suggested.length >= 6) setVal(keyInput, suggested);
      }
      setTimeout(() => {
        const validation = validateCreateForm(new FormData(form));
        setAddFormValid(validation.valid);
        setFormErrors(validation.errors);
      }, 0);
    } catch {
      setCreateMetadataError('Invalid URL format');
    }
  };

  const validateCreateForm = (formData: FormData): { valid: boolean; errors: FormErrors; data?: Record<string, unknown> } => {
    const rawData: Record<string, unknown> = {
      source_key: formData.get('source_key') || '',
      publisher: formData.get('publisher') || '',
      title: formData.get('title') || '',
      authority_tier: formData.get('authority_tier') || '',
      status: formData.get('status') || '',
      description: formData.get('description') || null,
      year: formData.get('year') ? parseInt(String(formData.get('year')), 10) : null,
      url: formData.get('url') || null,
      notes: formData.get('notes') || null,
    };

    // Convert year to number or null
    if (rawData.year === '' || rawData.year === null) rawData.year = null;
    if (rawData.year !== null && isNaN(Number(rawData.year))) rawData.year = null;

    // Convert empty strings to null for optional fields
    if (rawData.description === '') rawData.description = null;
    if (rawData.url === '') rawData.url = null;
    if (rawData.notes === '') rawData.notes = null;

    const result = SourceRegistryCreateSchema.safeParse(rawData);
    
    if (!result.success) {
      const errors: FormErrors = {};
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.') || 'root';
        errors[path] = issue.message;
      });
      return { valid: false, errors };
    }

    return { valid: true, errors: {}, data: result.data };
  };

  const handleAddSource = async (formData: FormData) => {
    try {
      setFormErrors({});
      setError(null);

      // Client-side validation
      const validation = validateCreateForm(formData);
      if (!validation.valid) {
        setFormErrors(validation.errors);
        return;
      }

      const response = await fetch('/api/admin/source-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'VALIDATION_ERROR' && errorData.issues) {
          const errors: FormErrors = {};
          errorData.issues.forEach((issue: { path?: (string | number)[] | string; message?: string }) => {
            const key = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? 'root');
            errors[key] = issue.message ?? 'Validation failed';
          });
          setFormErrors(errors);
        } else {
          throw new Error(errorData.message || errorData.error || 'Failed to create source');
        }
        return;
      }

      setShowAddForm(false);
      setFormErrors({});
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    }
  };

  const validateUpdateForm = (formData: FormData): { valid: boolean; errors: FormErrors; data?: Record<string, unknown> } => {
    const rawData: Record<string, unknown> = {};
    
    const publisher = formData.get('publisher');
    if (publisher) rawData.publisher = publisher;
    
    const title = formData.get('title');
    if (title) rawData.title = title;
    
    const authority_tier = formData.get('authority_tier');
    if (authority_tier) rawData.authority_tier = authority_tier;
    
    const status = formData.get('status');
    if (status) rawData.status = status;
    
    const description = formData.get('description');
    rawData.description = description && description !== '' ? description : null;
    
    const year = formData.get('year');
    rawData.year = year && year !== '' ? parseInt(String(year), 10) : null;
    if (rawData.year !== null && isNaN(Number(rawData.year))) rawData.year = null;
    
    const url = formData.get('url');
    rawData.url = url && url !== '' ? url : null;
    
    const notes = formData.get('notes');
    rawData.notes = notes && notes !== '' ? notes : null;

    const result = SourceRegistryUpdateSchema.safeParse(rawData);
    
    if (!result.success) {
      const errors: FormErrors = {};
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.') || 'root';
        errors[path] = issue.message;
      });
      return { valid: false, errors };
    }

    return { valid: true, errors: {}, data: result.data };
  };

  const handleUpdateSource = async (sourceKey: string, formData: FormData) => {
    try {
      setFormErrors({});
      setError(null);

      const isModuleSource = editingSource?._isModuleSource && editingSource?._moduleCode;

      if (isModuleSource) {
        // Module source: PATCH module_sources / module_documents (title + publisher only)
        const source_label = (formData.get('title') as string)?.trim() || editingSource?.title || '';
        const publisher = (formData.get('publisher') as string)?.trim() || null;
        const response = await fetch(
          `/api/admin/modules/${encodeURIComponent(editingSource!._moduleCode!)}/sources/${encodeURIComponent(editingSource!.id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_label, publisher })
          }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || 'Failed to update module source');
        }
        setEditingSource(null);
        setFormErrors({});
        loadSources();
        return;
      }

      // Corpus source: require scope tags and full validation
      if (!editingScopeTags.length) {
        setFormErrors((prev) => ({ ...prev, scope_tags: 'At least one scope tag is required.' }));
        return;
      }

      const validation = validateUpdateForm(formData);
      if (!validation.valid) {
        setFormErrors(validation.errors);
        return;
      }

      const body = { ...validation.data, scope_tags: editingScopeTags, is_technology_library: editingIsTechnologyLibrary };
      const response = await fetch(`/api/admin/source-registry/${encodeURIComponent(sourceKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'VALIDATION_ERROR' && errorData.issues) {
          const errors: FormErrors = {};
          errorData.issues.forEach((issue: { path?: (string | number)[] | string; message?: string }) => {
            const key = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? 'root');
            errors[key] = issue.message ?? 'Validation failed';
          });
          setFormErrors(errors);
        } else {
          throw new Error(errorData.message || errorData.error || 'Failed to update source');
        }
        return;
      }

      setEditingSource(null);
      setFormErrors({});
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source');
    }
  };

  const handleDeleteSource = async (sourceKey: string) => {
    if (!confirm(`Delete source "${sourceKey}"? This will remove the source and all linked data.`)) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/admin/source-registry/${encodeURIComponent(sourceKey)}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.message || errorData.error || 'Failed to delete source';
        const hint = errorData.hint ? ` ${errorData.hint}` : '';
        const full = response.status === 404
          ? `${msg}. The row may already be deleted, or this may be a module-linked row — try "Delete" from the module source view.${hint}`
          : msg + hint;
        throw new Error(full);
      }

      // Remove the row from the table immediately so the UI updates
      setSources((prev) => prev.filter((s) => s.source_key !== sourceKey));
      // Refetch with cache-bust so the list is never stale (avoids reappearing after refresh)
      await loadSources(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source');
    }
  };

  const handleDeleteModuleSource = async (moduleCode: string, moduleSourceId: string, title: string) => {
    if (!confirm(`Remove source "${title}" from module ${moduleCode}?`)) {
      return;
    }
    try {
      setError(null);
      const response = await fetch(
        `/api/admin/modules/${encodeURIComponent(moduleCode)}/sources/${encodeURIComponent(moduleSourceId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Failed to remove source from module');
      }
      setSources((prev) => prev.filter((s) => !(s._isModuleSource && s._moduleCode === moduleCode && s.id === moduleSourceId)));
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove module source');
    }
  };

  const handleIngestSource = async (sourceKey: string) => {
    try {
      setError(null);
      setIngestLoadingSourceKey(sourceKey);
      const response = await fetch(`/api/admin/source-registry/${encodeURIComponent(sourceKey)}/ingest`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || `Ingest failed: ${response.status}`);
      }

      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest source');
    } finally {
      setIngestLoadingSourceKey(null);
    }
  };

  const uniquePublishers = Array.from(new Set(sources.map(s => (s.publisher && !isUnacceptablePublisher(s.publisher) ? s.publisher : null)))).filter(Boolean) as string[];
  uniquePublishers.sort();

  // Client-side search + chunks filter
  let filteredSources = searchQuery.trim()
    ? sources.filter(source => {
        const query = searchQuery.toLowerCase();
        return (
          source.title?.toLowerCase().includes(query) ||
          source.source_key.toLowerCase().includes(query) ||
          source.publisher?.toLowerCase().includes(query) ||
          source.notes?.toLowerCase().includes(query) ||
          source.citation_label?.toLowerCase().includes(query) ||
          source.scope_tags?.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(query))
        );
      })
    : sources;
  if (chunksFilter === 'zero' && sourceCategory !== 'module') {
    filteredSources = filteredSources.filter(s => typeof s.chunk_count === 'number' && s.chunk_count === 0);
  }
  // Corpus (Assessment Data) view: never show sources with scope "Module Upload" or module-only rows
  if (sourceCategory === 'corpus') {
    filteredSources = filteredSources.filter(
      s => !(s as { _isModuleSource?: boolean })._isModuleSource
        && !(s.scope_tags && s.scope_tags.some((t: string) => String(t) === 'Module Upload'))
    );
  }

  // Sort
  const sortedSources = [...filteredSources].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'publisher':
        cmp = (a.publisher ?? '').localeCompare(b.publisher ?? '');
        break;
      case 'tier':
        cmp = a.tier - b.tier;
        break;
      case 'title':
        cmp = (a.title ?? '').localeCompare(b.title ?? '');
        break;
      case 'chunk_count': {
        const ac = typeof a.chunk_count === 'number' ? a.chunk_count : -1;
        const bc = typeof b.chunk_count === 'number' ? b.chunk_count : -1;
        cmp = ac - bc;
        break;
      }
      case 'source_type':
        cmp = (a.source_type ?? '').localeCompare(b.source_type ?? '');
        break;
      default:
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedSources.length / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);
  const displaySources = sortedSources.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };

  const handleQueueZeroChunkReprocess = async () => {
    setReprocessZeroChunkLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/corpus/reprocess-zero-chunk', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to queue reprocess');
      const skipped = data.skipped_missing_source_registry_id ?? 0;
      const msg = data.queued === 0
        ? (skipped > 0
          ? `No queueable 0-chunk documents. ${skipped} untraceable document(s) (missing source_registry_id) cannot be reprocessed.`
          : 'No 0-chunk documents to reprocess.')
        : (skipped > 0
          ? `Queued ${data.queued} documents. ${skipped} untraceable document(s) skipped. Run the reprocess worker to process the queue.`
          : `Queued ${data.queued} documents. Run the reprocess worker to process the queue.`);
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      loadSources();
      // Refetch zero-chunk count (effect will run after loadSources finishes)
      const refetch = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
      const refetchData = await refetch.json();
      if (refetch.ok && typeof refetchData.count === 'number') setZeroChunkDocCount(refetchData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue reprocess');
    } finally {
      setReprocessZeroChunkLoading(false);
    }
  };

  const handleQueueZeroChunkRecursive = async () => {
    setReprocessZeroChunkRecursiveLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/corpus/reprocess-zero-chunk-recursive', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to queue reprocess (recursive)');
      const msg = data.message ?? (data.total_queued > 0
        ? `Queued ${data.total_queued} document(s) over ${data.rounds ?? 1} round(s). Run the reprocess worker to chunk them.`
        : 'No zero-chunk documents to queue.');
      if (typeof window !== 'undefined' && window.alert) window.alert(msg);
      loadSources();
      const refetch = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
      const refetchData = await refetch.json();
      if (refetch.ok && typeof refetchData.count === 'number') setZeroChunkDocCount(refetchData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue reprocess (recursive)');
    } finally {
      setReprocessZeroChunkRecursiveLoading(false);
    }
  };

  const handleSyncChunkCounts = async () => {
    setSyncChunkCountsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/corpus/sync-chunk-counts', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Sync failed');
      const updated = data.updated ?? 0;
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(updated > 0 ? `Updated chunk_count for ${updated} document(s).` : 'No documents needed syncing (chunk_count already matches document_chunks).');
      }
      const refetch = await fetch('/api/admin/corpus/zero-chunk', { cache: 'no-store' });
      const refetchData = await refetch.json();
      if (refetch.ok && typeof refetchData.count === 'number') setZeroChunkDocCount(refetchData.count);
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync chunk counts');
    } finally {
      setSyncChunkCountsLoading(false);
    }
  };

  const handlePurgeZeroChunkDocuments = async () => {
    if (zeroChunkDocCount == null || zeroChunkDocCount === 0) return;
    if (!confirm(`Permanently delete ${zeroChunkDocCount} CORPUS document(s) with 0 chunks? This cannot be undone.`)) return;
    setPurgeZeroChunkLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/corpus/purge-zero-chunk', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Purge failed');
      const deleted = data.deleted ?? 0;
      if (typeof window !== 'undefined' && window.alert) window.alert(`Deleted ${deleted} zero-chunk document(s).`);
      setZeroChunkDocCount(0);
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge zero-chunk documents');
    } finally {
      setPurgeZeroChunkLoading(false);
    }
  };

  const handlePurgeNonPdfSources = async () => {
    if (!confirm('Permanently remove all non-PDF sources (web, doc) from the registry? This cannot be undone.')) return;
    setPurgeNonPdfLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/source-registry/purge-non-pdf', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Purge failed');
      const deleted = data.deleted ?? 0;
      if (typeof window !== 'undefined' && window.alert) window.alert(`Removed ${deleted} non-PDF source(s).`);
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge non-PDF sources');
    } finally {
      setPurgeNonPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>Source Registry</h2>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading sources...
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Source Registry</h2>
      <p style={{ color: '#666', marginBottom: 'var(--spacing-lg)' }}>
        Manage authoritative sources for OFC citations. Sources are tiered by authority (1=CISA/DHS/National Laboratories, 2=FEMA/ISC/etc, 3=ASIS/NFPA).
      </p>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #d13212', borderRadius: '0.25rem', marginBottom: '1rem', color: '#d13212' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {schemaLimitWarning && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#e8f4fc', border: '1px solid #0071bc', borderRadius: '0.25rem', marginBottom: '1rem', color: '#1b1b1b', fontSize: '0.875rem' }}>
          Category filter (Module / Corpus / Technology) is unavailable: CORPUS may be missing <code>module_source_documents</code> or <code>corpus_documents.document_role</code>. Run CORPUS migrations if you need those filters.
        </div>
      )}

      {sourceCategory !== 'module' && zeroChunkDocCount != null && zeroChunkDocCount > 0 && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#fffbf0',
          border: '1px solid #f5e79e',
          borderRadius: '0.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#5c4a00', fontWeight: 500 }}>
            <strong>{zeroChunkDocCount}</strong> CORPUS document{zeroChunkDocCount !== 1 ? 's' : ''} had 0 chunks (our failure). Sync ran; reprocess queued — run the reprocess worker to re-run.
          </span>
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={handleSyncChunkCounts}
            disabled={syncChunkCountsLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              opacity: syncChunkCountsLoading ? 0.7 : 1,
              cursor: syncChunkCountsLoading ? 'not-allowed' : 'pointer'
            }}
            title="Recalc chunk_count from document_chunks for rows that have chunks but show 0"
          >
            {syncChunkCountsLoading ? 'Syncing…' : 'Sync chunk counts'}
          </button>
          <button
            type="button"
            className="usa-button"
            onClick={handleQueueZeroChunkReprocess}
            disabled={reprocessZeroChunkLoading || reprocessZeroChunkRecursiveLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              opacity: reprocessZeroChunkLoading ? 0.7 : 1,
              cursor: reprocessZeroChunkLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {reprocessZeroChunkLoading ? 'Queuing…' : 'Queue for reprocessing'}
          </button>
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={handleQueueZeroChunkRecursive}
            disabled={reprocessZeroChunkLoading || reprocessZeroChunkRecursiveLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              opacity: reprocessZeroChunkRecursiveLoading ? 0.7 : 1,
              cursor: reprocessZeroChunkRecursiveLoading ? 'not-allowed' : 'pointer'
            }}
            title="Sync and queue all zero-chunk docs in multiple rounds (up to 20); then run the reprocess worker"
          >
            {reprocessZeroChunkRecursiveLoading ? 'Queuing all…' : 'Queue all (recursive)'}
          </button>
          <button
            type="button"
            className="usa-button usa-button--secondary"
            onClick={handlePurgeZeroChunkDocuments}
            disabled={purgeZeroChunkLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              opacity: purgeZeroChunkLoading ? 0.7 : 1,
              cursor: purgeZeroChunkLoading ? 'not-allowed' : 'pointer',
              color: '#b50909',
              borderColor: '#b50909'
            }}
            title="Permanently delete all CORPUS documents with 0 chunks"
          >
            {purgeZeroChunkLoading ? 'Purging…' : 'Purge zero-chunk documents'}
          </button>
          <span style={{ fontSize: '0.8125rem', color: '#71767a' }}>
            Sync fixes drift. Queue re-runs reprocessing. Run the reprocess worker to process the queue. Purge only if you want to remove permanently.
          </span>
        </div>
      )}

      {/* Source Category Tabs */}
      <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid #dfe1e2' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSourceCategory('all')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: sourceCategory === 'all' ? '3px solid #005ea2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: sourceCategory === 'all' ? '#005ea2' : '#666',
              fontWeight: sourceCategory === 'all' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            All Sources
          </button>
          <button
            onClick={() => setSourceCategory('module')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: sourceCategory === 'module' ? '3px solid #005ea2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: sourceCategory === 'module' ? '#005ea2' : '#666',
              fontWeight: sourceCategory === 'module' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Module Sources
          </button>
          <button
            onClick={() => setSourceCategory('corpus')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: sourceCategory === 'corpus' ? '3px solid #005ea2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: sourceCategory === 'corpus' ? '#005ea2' : '#666',
              fontWeight: sourceCategory === 'corpus' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Corpus (Assessment Data)
          </button>
          <button
            onClick={() => setSourceCategory('technology')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderBottom: sourceCategory === 'technology' ? '3px solid #005ea2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: sourceCategory === 'technology' ? '#005ea2' : '#666',
              fontWeight: sourceCategory === 'technology' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Technology
          </button>
        </div>
      </div>

      {/* Search and Filter Controls — row 1: search + filters */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-end',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1 1 280px', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, key, publisher, notes, or tags…"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #dfe1e2',
                borderRadius: '0.25rem'
              }}
            />
            {searchQuery && (
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                {filteredSources.length} of {sources.length} sources
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Publisher</label>
            <select
              value={publisherFilter}
              onChange={(e) => setPublisherFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', minWidth: '140px', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}
            >
              <option value="">All</option>
              {uniquePublishers.map((p, i) => (
                <option key={`pub-${i}-${String(p).slice(0, 50)}`} value={p}>{p}</option>
              ))}
              {sources.some(s => !s.publisher || isUnacceptablePublisher(s.publisher)) && (
                <option value={FILTER_NO_PUBLISHER}>No publisher</option>
              )}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Tier</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', minWidth: '180px', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}
            >
              <option value="">All</option>
              <option value="1">Tier 1 (CISA/DHS/National Labs)</option>
              <option value="2">Tier 2 (FEMA/ISC/etc)</option>
              <option value="3">Tier 3 (ASIS/NFPA)</option>
            </select>
          </div>
          {sourceCategory !== 'module' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Chunks</label>
              <select
                value={chunksFilter}
                onChange={(e) => setChunksFilter(e.target.value as 'all' | 'zero')}
                title="Show only sources with 0 chunks (not yet ingested)."
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', minWidth: '110px', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}
              >
                <option value="all">All</option>
                <option value="zero">Zero only</option>
              </select>
            </div>
          )}
        </div>
        {/* Row 2: actions — primary Add Source, secondary Update/Report, danger Purge separate */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: '#005ea2',
              color: '#fff',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Add Source
          </button>
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={() => { loadSources(); loadActiveSources(); }}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #005ea2',
              backgroundColor: 'transparent',
              color: '#005ea2',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
            title="Refresh sources list"
          >
            {loading ? 'Loading…' : 'Update Sources'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setReportLoading(true);
              setReportError(null);
              setReportData(null);
              setShowReportPanel(true);
              try {
                const res = await fetch('/api/admin/source-registry/report', { cache: 'no-store' });
                if (!res.ok) throw new Error(`Failed to generate report: ${res.status}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Report failed');
                setReportData(data);
              } catch (err) {
                setReportError(err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setReportLoading(false);
              }
            }}
            disabled={reportLoading}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #005ea2',
              backgroundColor: 'transparent',
              color: '#005ea2',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              cursor: reportLoading ? 'not-allowed' : 'pointer',
              opacity: reportLoading ? 0.7 : 1
            }}
          >
            {reportLoading ? 'Generating report…' : 'Generate Sources Report'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setRerunScopeTagsLoading(true);
              setError(null);
              try {
                const res = await fetch('/api/admin/source-registry/rerun-scope-tags', { method: 'POST' });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Rerun failed');
                if (typeof window !== 'undefined' && window.alert) {
                  const firstError = data.errors?.[0];
                  const fromTitle = data.from_title ?? 0;
                  const noChunks = data.no_chunks ?? 0;
                  const analysisEmpty = data.analysis_empty ?? 0;
                  let msg = `Rerun scope tags: ${data.updated ?? 0} of ${data.total ?? 0} sources updated.`;
                  if (fromTitle) msg += ` ${fromTitle} from title.`;
                  if (noChunks) msg += ` ${noChunks} had no chunks.`;
                  if (analysisEmpty) msg += ` ${analysisEmpty} had empty analysis (no tags chosen).`;
                  if (data.failed) msg += ` ${data.failed} failed.${firstError ? ` First error: ${firstError}` : ''}`;
                  window.alert(msg);
                }
                loadSources();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Rerun scope tags failed');
              } finally {
                setRerunScopeTagsLoading(false);
              }
            }}
            disabled={rerunScopeTagsLoading || sourceCategory === 'module'}
            title="Normalize scope_tags for all sources to only discipline, subtype, module, sector, subsector"
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #005ea2',
              backgroundColor: 'transparent',
              color: '#005ea2',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              cursor: rerunScopeTagsLoading || sourceCategory === 'module' ? 'not-allowed' : 'pointer',
              opacity: rerunScopeTagsLoading || sourceCategory === 'module' ? 0.7 : 1
            }}
          >
            {rerunScopeTagsLoading ? 'Rerunning…' : 'Rerun scope tags'}
          </button>
          <span style={{ width: '1px', height: '1.5rem', backgroundColor: '#d1d5db', marginLeft: '0.25rem' }} aria-hidden />
          <button
            type="button"
            onClick={handlePurgeNonPdfSources}
            disabled={purgeNonPdfLoading}
            title="Remove all sources with type web or doc (PDF only). Cannot be undone."
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #b50909',
              backgroundColor: 'transparent',
              color: '#b50909',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              cursor: purgeNonPdfLoading ? 'not-allowed' : 'pointer',
              opacity: purgeNonPdfLoading ? 0.7 : 1
            }}
          >
            {purgeNonPdfLoading ? 'Purging…' : 'Purge non-PDF sources'}
          </button>
        </div>
      </div>

      {/* Sources Report Panel */}
      {showReportPanel && (
        <div style={{ border: '1px solid #005ea2', borderRadius: '0.25rem', padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: '#f0f9ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Sources Report</h2>
            <button
              type="button"
              onClick={() => { setShowReportPanel(false); setReportData(null); setReportError(null); }}
              style={{ padding: '0.25rem 0.75rem', border: '1px solid #005ea2', backgroundColor: 'transparent', color: '#005ea2', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Close
            </button>
          </div>
          {reportLoading && <p style={{ margin: 0, color: '#1b1b1b' }}>Generating report…</p>}
          {reportError && (
            <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.25rem', color: '#991b1b', fontSize: '0.875rem' }}>
              {reportError}
            </div>
          )}
          {reportData && !reportLoading && (
            <div style={{ fontSize: '0.875rem' }}>
              <section style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Total sources</strong><br />{String((reportData.summary.statistics as { total?: number }).total)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Tier 1</strong><br />{String((reportData.summary.statistics as { by_tier?: Record<number, number> }).by_tier?.[1] ?? 0)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Tier 2</strong><br />{String((reportData.summary.statistics as { by_tier?: Record<number, number> }).by_tier?.[2] ?? 0)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Tier 3</strong><br />{String((reportData.summary.statistics as { by_tier?: Record<number, number> }).by_tier?.[3] ?? 0)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Ingested</strong><br />{String((reportData.summary.statistics as { ingested?: number }).ingested ?? 0)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Not ingested (has URL)</strong><br />{String((reportData.summary.statistics as { not_ingested?: number }).not_ingested ?? 0)}
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                    <strong>Duplicates</strong><br />{reportData.summary.duplicates_count}
                  </div>
                </div>
              </section>
              {reportData.summary.duplicates_count > 0 && (
                <section style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Duplicate groups</h3>
                  <div style={{ overflowX: 'auto' }}>
                    {reportData.duplicates.map((group, i) => (
                      <div key={i} style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}>
                        <strong>{group.type === 'url' ? 'Same URL' : 'Same publisher + title'}</strong>
                        <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                          {group.sources.map((s, j) => (
                            <li key={j}>{s.source_key} — {s.publisher} — {s.title}{group.type === 'url' && s.canonical_url ? ` (${s.canonical_url})` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Missing information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {reportData.summary.missing_info_count.no_publisher > 0 && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.25rem' }}>
                      <strong>No publisher</strong> ({reportData.summary.missing_info_count.no_publisher})
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
                        {reportData.missing_info.no_publisher.slice(0, 5).map((s, j) => <li key={j}>{s.source_key}</li>)}
                        {reportData.missing_info.no_publisher.length > 5 && <li>… and {reportData.missing_info.no_publisher.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                  {reportData.summary.missing_info_count.no_title > 0 && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.25rem' }}>
                      <strong>No title</strong> ({reportData.summary.missing_info_count.no_title})
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
                        {reportData.missing_info.no_title.slice(0, 5).map((s, j) => <li key={j}>{s.source_key}</li>)}
                        {reportData.missing_info.no_title.length > 5 && <li>… and {reportData.missing_info.no_title.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                  {reportData.summary.missing_info_count.no_publication_date > 0 && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.25rem' }}>
                      <strong>No publication date</strong> ({reportData.summary.missing_info_count.no_publication_date})
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
                        {reportData.missing_info.no_publication_date.slice(0, 5).map((s, j) => <li key={j}>{s.source_key}</li>)}
                        {reportData.missing_info.no_publication_date.length > 5 && <li>… and {reportData.missing_info.no_publication_date.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                  {reportData.summary.missing_info_count.no_url > 0 && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.25rem' }}>
                      <strong>Web source, no URL</strong> ({reportData.summary.missing_info_count.no_url})
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
                        {reportData.missing_info.no_url.slice(0, 5).map((s, j) => <li key={j}>{s.source_key}</li>)}
                        {reportData.missing_info.no_url.length > 5 && <li>… and {reportData.missing_info.no_url.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                  {reportData.summary.missing_info_count.not_ingested_with_url > 0 && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.25rem' }}>
                      <strong>Has URL but not ingested</strong> ({reportData.summary.missing_info_count.not_ingested_with_url})
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
                        {reportData.missing_info.not_ingested_with_url.slice(0, 5).map((s, j) => <li key={j}>{s.source_key}</li>)}
                        {reportData.missing_info.not_ingested_with_url.length > 5 && <li>… and {reportData.missing_info.not_ingested_with_url.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                  {Object.values(reportData.summary.missing_info_count).every(n => n === 0) && (
                    <p style={{ margin: 0, color: '#065f46' }}>No missing critical information.</p>
                  )}
                </div>
              </section>
              <p style={{ margin: 0, color: '#71717a', fontSize: '0.8125rem' }}>
                Report generated {reportData.report_date ? new Date(reportData.report_date).toLocaleString() : ''}. {reportData.all_sources.length} sources total.
              </p>
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <div style={{ border: '1px solid #dfe1e2', borderRadius: '0.25rem', padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb' }}>
          <h2>Add New Source</h2>
          
          {/* Pull or create title metadata */}
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e7f3f8', 
            borderRadius: '0.25rem', 
            marginBottom: '1.5rem',
            border: '1px solid #b3d9e8'
          }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Pull or create title metadata
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="url"
                id="metadata-url-input"
                placeholder="https://www.cisa.gov/..."
                style={{ 
                  flex: '1 1 280px', 
                  padding: '0.5rem',
                  border: '1px solid #dfe1e2',
                  borderRadius: '0.25rem'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    fetchMetadataFromUrl(input.value);
                  }
                }}
              />
              <button
                type="button"
                className="usa-button usa-button--outline"
                onClick={() => {
                  const input = document.getElementById('metadata-url-input') as HTMLInputElement;
                  if (input) fetchMetadataFromUrl(input.value);
                }}
                disabled={fetchingMetadata}
                style={{ whiteSpace: 'nowrap', opacity: fetchingMetadata ? 0.5 : 1, cursor: fetchingMetadata ? 'not-allowed' : 'pointer' }}
              >
                {fetchingMetadata ? 'Fetching...' : 'Pull from URL'}
              </button>
              <button
                type="button"
                className="usa-button usa-button--outline"
                onClick={() => {
                  const input = document.getElementById('metadata-url-input') as HTMLInputElement;
                  if (input) createMetadataFromUrl(input.value);
                }}
                style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                Create from URL
              </button>
              <input
                ref={pdfFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) fetchMetadataFromPdf(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="usa-button usa-button--outline"
                onClick={() => pdfFileInputRef.current?.click()}
                disabled={extractingFromPdf}
                style={{ whiteSpace: 'nowrap', opacity: extractingFromPdf ? 0.5 : 1, cursor: extractingFromPdf ? 'not-allowed' : 'pointer' }}
              >
                {extractingFromPdf ? 'Extracting...' : 'Pull from PDF'}
              </button>
            </div>
            {metadataError && (
              <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.25rem' }}>
                {metadataError}
              </div>
            )}
            {createMetadataError && (
              <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.25rem' }}>
                {createMetadataError}
              </div>
            )}
            {metadataSuccess && !metadataError && (
              <div style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '0.25rem' }}>
                ✓ Metadata fetched. Form fields have been populated.
              </div>
            )}
            {pdfMetadataError && (
              <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.25rem' }}>
                {pdfMetadataError}
              </div>
            )}
            {pdfMetadataSuccess && !pdfMetadataError && (
              <div style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '0.25rem' }}>
                ✓ Title, publisher, and citation scraped from PDF (content only; filename not used). Form fields populated.
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
              <strong>Pull from URL</strong> fetches the page and fills title, publisher, description, year. <strong>Create from URL</strong> infers from the URL only. <strong>Pull from PDF</strong> scrapes title, publisher, and citation from the PDF content (filename is never used). Then click Create Source below.
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const validation = validateCreateForm(formData);
              setAddFormValid(validation.valid);
              if (validation.valid) {
                handleAddSource(formData);
              } else {
                setFormErrors(validation.errors);
              }
            }}
            onChange={(e) => {
              // Validate on change, but only after user has interacted with the form
              const form = (e.target as HTMLElement).closest('form') as HTMLFormElement;
              if (form) {
                const validation = validateCreateForm(new FormData(form));
                setAddFormValid(validation.valid);
                setFormErrors(validation.errors);
              }
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Source Key *</label>
                <input
                  type="text"
                  name="source_key"
                  required
                  placeholder="CISA_SECURITY_CONVERGENCE_2024"
                  onBlur={(e) => {
                    const rawValue = e.target.value;
                    if (rawValue) {
                      const normalized = normalizeKey(rawValue);
                      e.target.value = normalized;
                      // Trigger change event to update form state
                      e.target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    const form = e.target.form;
                    if (form) {
                      // Small delay to ensure value is updated
                      setTimeout(() => {
                        const validation = validateCreateForm(new FormData(form));
                        setAddFormValid(validation.valid);
                        setFormErrors(validation.errors);
                      }, 0);
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem',
                    borderColor: formErrors.source_key ? '#d13212' : undefined
                  }}
                />
                {formErrors.source_key && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.source_key}</div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  Format: 6-50 chars (prefer shorter), starts with letter, A-Z, 0-9, underscore only. Auto-uppercased.
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Publisher *</label>
                <input
                  type="text"
                  name="publisher"
                  required
                  placeholder="CISA"
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem',
                    borderColor: formErrors.publisher ? '#d13212' : undefined
                  }}
                />
                {formErrors.publisher && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.publisher}</div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Authority Tier *</label>
                <select name="authority_tier" required style={{ 
                  width: '100%', 
                  padding: '0.5rem',
                  borderColor: formErrors.authority_tier ? '#d13212' : undefined
                }}>
                  <option value="">Select tier</option>
                  <option value="BASELINE_AUTHORITY">BASELINE_AUTHORITY (Tier 1 - CISA/DHS/National Laboratories)</option>
                  <option value="SECTOR_AUTHORITY">SECTOR_AUTHORITY (Tier 2 - FEMA/ISC/GSA/DoD UFC/NIST)</option>
                  <option value="SUBSECTOR_AUTHORITY">SUBSECTOR_AUTHORITY (Tier 3 - ASIS/NFPA)</option>
                </select>
                {formErrors.authority_tier && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.authority_tier}</div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Status *</label>
                <select name="status" required style={{ 
                  width: '100%', 
                  padding: '0.5rem',
                  borderColor: formErrors.status ? '#d13212' : undefined
                }}>
                  <option value="">Select status</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                {formErrors.status && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.status}</div>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Title *</label>
              <input
                type="text"
                name="title"
                required
                style={{ 
                  width: '100%', 
                  padding: '0.5rem',
                  borderColor: formErrors.title ? '#d13212' : undefined
                }}
              />
              {formErrors.title && (
                <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.title}</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Year</label>
                <input
                  type="number"
                  name="year"
                  min="1900"
                  max="2100"
                  placeholder="2024"
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem',
                    borderColor: formErrors.year ? '#d13212' : undefined
                  }}
                />
                {formErrors.year && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.year}</div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>URL</label>
                <input
                  type="url"
                  name="url"
                  placeholder="https://..."
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem',
                    borderColor: formErrors.url ? '#d13212' : undefined
                  }}
                />
                {formErrors.url && (
                  <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.url}</div>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
              <textarea
                name="description"
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem',
                  borderColor: formErrors.description ? '#d13212' : undefined
                }}
              />
              {formErrors.description && (
                <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.description}</div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Notes</label>
              <textarea
                name="notes"
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem',
                  borderColor: formErrors.notes ? '#d13212' : undefined
                }}
              />
              {formErrors.notes && (
                <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.notes}</div>
              )}
            </div>
            {formErrors.root && (
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #d13212', 
                borderRadius: '0.25rem', 
                marginBottom: '1rem',
                color: '#d13212'
              }}>
                {formErrors.root}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="submit" 
                className="usa-button"
                disabled={!addFormValid}
                style={{ opacity: addFormValid ? 1 : 0.5, cursor: addFormValid ? 'pointer' : 'not-allowed' }}
              >
                Create Source
              </button>
              <button 
                type="button" 
                className="usa-button usa-button--outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setFormErrors({});
                  setAddFormValid(false);
                  setMetadataError(null);
                  setMetadataSuccess(false);
                  setFetchingMetadata(false);
                  setCreateMetadataError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* When editing a source that is not on the current page, show panel above table so user can cancel */}
      {editingSource && !displaySources.some((s) => s.source_key === editingSource.source_key) && (
        <div style={{ border: '1px solid #dfe1e2', borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f9fafb' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#666' }}>Editing: {editingSource.source_key} (not on current page)</p>
          <button type="button" className="usa-button usa-button--outline" onClick={() => { setEditingSource(null); setFormErrors({}); setUpdateFormValid(true); }}>Close</button>
        </div>
      )}

      <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '100%', minWidth: 0, border: '1px solid #dfe1e2', borderRadius: '0.25rem', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #dfe1e2' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <button type="button" onClick={() => handleSort('publisher')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }} title="Sort by publisher">
                  Publisher {sortKey === 'publisher' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <button type="button" onClick={() => handleSort('tier')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }} title="Sort by tier">
                  Tier {sortKey === 'tier' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                <button type="button" onClick={() => handleSort('title')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }} title="Sort by title">
                  Title {sortKey === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <button type="button" onClick={() => handleSort('source_type')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }} title="Sort by type">
                  Type {sortKey === 'source_type' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Scope Tags</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <button type="button" onClick={() => handleSort('chunk_count')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }} title="Sort by chunk count">
                  # Chunks {sortKey === 'chunk_count' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Ingestion Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displaySources.map((source) => (
              <React.Fragment key={source._isModuleSource ? `module-${source._moduleCode ?? ''}-${source.id}` : `corpus-${source.id}`}>
              <tr style={{ borderBottom: '1px solid #dfe1e2' }}>
                <td style={{ padding: '0.75rem', overflow: 'hidden', wordBreak: 'break-word' }}>
                  {(source.source_key?.startsWith('module:') || (source._isModuleSource && !(source.publisher && !isUnacceptablePublisher(source.publisher))))
                    ? 'Module Upload'
                    : (source.publisher && !isUnacceptablePublisher(source.publisher) ? source.publisher : '')}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: source.tier === 1 ? '#e7f3f8' : source.tier === 2 ? '#fffbf0' : '#f3f4f6',
                    color: source.tier === 1 ? '#005ea2' : source.tier === 2 ? '#fdb81e' : '#71767a'
                  }}>
                    Tier {source.tier}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', overflow: 'hidden', wordBreak: 'break-word' }} title={source.title ?? undefined}>{source.title}</td>
                <td style={{ padding: '0.75rem', textTransform: 'uppercase' }}>{source.source_type}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', overflow: 'hidden', wordBreak: 'break-word' }} title={source.citation_label ? `${String(source.citation_label)}\n\nScope: ${(source.scope_tags ?? []).join(', ') || '—'}` : (source.scope_tags?.join(', ') ?? undefined)}>
                  {source.scope_tags && source.scope_tags.length > 0 ? (
                    <span style={{ color: '#111', fontSize: '0.875rem' }}>
                      {source.scope_tags.join(', ')}
                    </span>
                  ) : (
                    <span style={{ color: '#666', fontSize: '0.875rem' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>{typeof source.chunk_count === 'number' ? source.chunk_count : '—'}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', overflow: 'hidden', wordBreak: 'break-word' }}>
                  {source.doc_sha256 ? (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: '#2e8540',
                      fontWeight: 500
                    }}>
                      <span>✓</span>
                      <span>Ingested</span>
                      {source.retrieved_at && (
                        <span style={{ color: '#666', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                          ({new Date(source.retrieved_at).toLocaleDateString()})
                        </span>
                      )}
                    </span>
                  ) : source.canonical_url ? (
                    <span style={{ color: '#666', fontStyle: 'italic' }}>Not ingested</span>
                  ) : (
                    <span style={{ color: '#999' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {source._isModuleSource && source._moduleCode ? (
                      <>
                        <a
                          href={`/api/admin/modules/${encodeURIComponent(source._moduleCode)}/sources/${encodeURIComponent(source.id)}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="usa-button usa-button--outline"
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                          title="Open PDF"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          className="usa-button usa-button--outline"
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => setEditingSource(source)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="usa-button usa-button--outline"
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', color: '#d13212' }}
                          onClick={() => handleDeleteModuleSource(source._moduleCode!, source.id, source.title ?? source.source_key)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        {source.canonical_url && !source.doc_sha256 && (
                          <button
                            type="button"
                            className="usa-button"
                            style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => handleIngestSource(source.source_key)}
                            disabled={ingestLoadingSourceKey === source.source_key}
                            title="Download PDF from URL and ingest into corpus"
                          >
                            {ingestLoadingSourceKey === source.source_key ? 'Ingesting…' : 'Ingest'}
                          </button>
                        )}
                        {source.local_path ? (
                          <a
                            href={`/api/admin/source-registry/${encodeURIComponent(source.source_key)}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="usa-button usa-button--outline"
                            style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                            title="Open local document"
                          >
                            View
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="usa-button usa-button--outline"
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => setEditingSource(source)}
                          title="Edit source"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="usa-button usa-button--outline"
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', color: '#d13212' }}
                          onClick={() => handleDeleteSource(source.source_key)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              {editingSource && editingSource.source_key === source.source_key && (
                <tr>
                  <td colSpan={8} style={{ padding: '1rem', verticalAlign: 'top', backgroundColor: '#f9fafb', borderBottom: '1px solid #dfe1e2' }}>
                    <div style={{ border: '1px solid #dfe1e2', borderRadius: '0.25rem', padding: '1.5rem', backgroundColor: '#fff' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem' }}>Edit Source: {editingSource.source_key}</h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const isModuleSource = editingSource._isModuleSource && editingSource._moduleCode;
                          if (isModuleSource) {
                            const title = (formData.get('title') as string)?.trim();
                            if (!title) {
                              setFormErrors({ title: 'Title is required.' });
                              setUpdateFormValid(false);
                              return;
                            }
                            setFormErrors({});
                            setUpdateFormValid(true);
                            handleUpdateSource(editingSource.source_key, formData);
                            return;
                          }
                          const validation = validateUpdateForm(formData);
                          const scopeValid = editingScopeTags.length >= 1;
                          setUpdateFormValid(validation.valid && scopeValid);
                          if (validation.valid && scopeValid) {
                            handleUpdateSource(editingSource.source_key, formData);
                          } else {
                            setFormErrors(() => ({
                              ...validation.errors,
                              ...(scopeValid ? {} : { scope_tags: 'At least one scope tag is required.' }),
                            }));
                          }
                        }}
                        onChange={(e) => {
                          const form = (e.target as HTMLElement).closest('form') as HTMLFormElement;
                          if (form) {
                            const formData = new FormData(form);
                            const isModuleSource = editingSource._isModuleSource && editingSource._moduleCode;
                            if (isModuleSource) {
                              const title = (formData.get('title') as string)?.trim();
                              setUpdateFormValid(!!title);
                              if (formErrors.title && title) setFormErrors((prev) => ({ ...prev, title: undefined }));
                            } else {
                              const validation = validateUpdateForm(formData);
                              const scopeValid = editingScopeTags.length >= 1;
                              setUpdateFormValid(validation.valid && scopeValid);
                              setFormErrors(validation.errors);
                            }
                          }
                        }}
                      >
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#e7f3f8', borderRadius: '0.25rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Source Key (Immutable)</label>
                          <input
                            type="text"
                            value={editingSource.source_key}
                            readOnly
                            disabled
                            style={{ width: '100%', padding: '0.5rem', backgroundColor: '#f3f4f6', color: '#666', fontFamily: 'monospace', cursor: 'not-allowed' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Publisher</label>
                            <input type="text" name="publisher" defaultValue={editingSource.publisher} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.publisher ? '#d13212' : undefined }} />
                            {formErrors.publisher && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.publisher}</div>}
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Authority Tier</label>
                            <select name="authority_tier" defaultValue={editingSource.tier === 1 ? 'BASELINE_AUTHORITY' : editingSource.tier === 2 ? 'SECTOR_AUTHORITY' : 'SUBSECTOR_AUTHORITY'} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.authority_tier ? '#d13212' : undefined }}>
                              <option value="BASELINE_AUTHORITY">BASELINE_AUTHORITY (Tier 1)</option>
                              <option value="SECTOR_AUTHORITY">SECTOR_AUTHORITY (Tier 2)</option>
                              <option value="SUBSECTOR_AUTHORITY">SUBSECTOR_AUTHORITY (Tier 3)</option>
                            </select>
                            {formErrors.authority_tier && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.authority_tier}</div>}
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Status</label>
                            <select name="status" defaultValue={extractStatusFromNotes(editingSource.notes)} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.status ? '#d13212' : undefined }}>
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                            {formErrors.status && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.status}</div>}
                          </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Title</label>
                          <input type="text" name="title" defaultValue={editingSource.title} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.title ? '#d13212' : undefined }} />
                          {formErrors.title && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.title}</div>}
                        </div>
                        {!editingSource._isModuleSource && (
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Scope tags (max 2)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Sector</label>
                              <select value={editingSector} onChange={(e) => { const v = e.target.value; setEditingSector(v); setEditingSubsector(''); const next = [v, '', editingModule].filter((s) => s && !isNumericScopeTag(s)).slice(0, 2); setEditingScopeTags(next); setFormErrors((prev) => ({ ...prev, scope_tags: '' })); const form = (e.target as HTMLElement).closest('form'); if (form) setUpdateFormValid(validateUpdateForm(new FormData(form)).valid && next.length >= 1); }} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.scope_tags ? '#d13212' : undefined }}>
                                <option value="">—</option>
                                {referenceSectors.map((s, i) => (<option key={`sector-${i}-${s.id}`} value={s.id}>{s.sector_name || s.name || s.id}</option>))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Subsector</label>
                              <select value={editingSubsector} onChange={(e) => { const v = e.target.value; setEditingSubsector(v); const next = [editingSector, v, editingModule].filter((s) => s && !isNumericScopeTag(s)).slice(0, 2); setEditingScopeTags(next); setFormErrors((prev) => ({ ...prev, scope_tags: '' })); const form = (e.target as HTMLElement).closest('form'); if (form) setUpdateFormValid(validateUpdateForm(new FormData(form)).valid && next.length >= 1); }} disabled={!editingSector || loadingSubsectors} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.scope_tags ? '#d13212' : undefined }}>
                                <option value="">—</option>
                                {loadingSubsectors ? <option value="" disabled>Loading…</option> : referenceSubsectors.map((s) => (<option key={`subsector-${s.id}`} value={s.id}>{s.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Module / Other</label>
                              <select value={editingModule} onChange={(e) => { const v = e.target.value; setEditingModule(v); const next = [editingSector, editingSubsector, v].filter((s) => s && !isNumericScopeTag(s)).slice(0, 2); setEditingScopeTags(next); setFormErrors((prev) => ({ ...prev, scope_tags: '' })); const form = (e.target as HTMLElement).closest('form'); if (form) setUpdateFormValid(validateUpdateForm(new FormData(form)).valid && next.length >= 1); }} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.scope_tags ? '#d13212' : undefined }}>
                                <option value="">—</option>
                                {scopeTagOptions?.modules.map((m) => (<option key={`mod-${m}`} value={m}>{m}</option>))}
                                {scopeTagOptions?.fallback?.map((f) => (<option key={`fb-${f}`} value={f}>{f}</option>))}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginTop: '0.75rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                              <input
                                type="checkbox"
                                checked={editingIsTechnologyLibrary}
                                onChange={(e) => setEditingIsTechnologyLibrary(e.target.checked)}
                              />
                              Technology Library (ingest as document_role = TECHNOLOGY_LIBRARY, RAG tag library: technology)
                            </label>
                          </div>
                          {formErrors.scope_tags && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.scope_tags}</div>}
                        </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Year</label>
                            <input type="number" name="year" min="1900" max="2100" defaultValue={editingSource.publication_date ? new Date(editingSource.publication_date).getFullYear() : ''} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.year ? '#d13212' : undefined }} />
                            {formErrors.year && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.year}</div>}
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem' }}>URL</label>
                            <input type="url" name="url" defaultValue={editingSource.canonical_url || ''} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.url ? '#d13212' : undefined }} />
                            {formErrors.url && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.url}</div>}
                          </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
                          <textarea name="description" rows={3} defaultValue={extractDescriptionFromNotes(editingSource.notes) || ''} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.description ? '#d13212' : undefined }} />
                          {formErrors.description && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.description}</div>}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Notes</label>
                          <textarea name="notes" rows={3} defaultValue={(editingSource.notes || '').split('\n\n').filter((line: string) => !line.startsWith('Description:') && !line.startsWith('Status:')).join('\n\n').trim()} style={{ width: '100%', padding: '0.5rem', borderColor: formErrors.notes ? '#d13212' : undefined }} />
                          {formErrors.notes && <div style={{ color: '#d13212', fontSize: '0.875rem', marginTop: '0.25rem' }}>{formErrors.notes}</div>}
                        </div>
                        {formErrors.root && <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #d13212', borderRadius: '0.25rem', marginBottom: '1rem', color: '#d13212' }}>{formErrors.root}</div>}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="submit" className="usa-button" disabled={!updateFormValid} style={{ opacity: updateFormValid ? 1 : 0.5, cursor: updateFormValid ? 'pointer' : 'not-allowed' }}>Update Source</button>
                          <button type="button" className="usa-button usa-button--outline" onClick={() => { setEditingSource(null); setFormErrors({}); setUpdateFormValid(true); }}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {sortedSources.length === 0 && sources.length > 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No sources match your search criteria. Try adjusting your filters or search query.
          </div>
        )}
        {sources.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No sources found. Click &quot;Add Source&quot; to create one.
          </div>
        )}
      </div>

      {/* Pagination */}
      {sortedSources.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: '1rem',
          padding: '0.75rem 0',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
            Showing {(effectivePage - 1) * pageSize + 1}–{Math.min(effectivePage * pageSize, sortedSources.length)} of {sortedSources.length} sources
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.875rem', marginRight: '0.25rem' }}>Per page</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', border: '1px solid #dfe1e2', borderRadius: '0.25rem' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span style={{ marginLeft: '0.5rem', marginRight: '0.5rem' }}>|</span>
            <button
              type="button"
              disabled={effectivePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #dfe1e2',
                borderRadius: '0.25rem',
                backgroundColor: effectivePage <= 1 ? '#f3f4f6' : '#fff',
                cursor: effectivePage <= 1 ? 'not-allowed' : 'pointer',
                color: effectivePage <= 1 ? '#9ca3af' : '#374151'
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.875rem', padding: '0 0.5rem' }}>
              Page {effectivePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={effectivePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #dfe1e2',
                borderRadius: '0.25rem',
                backgroundColor: effectivePage >= totalPages ? '#f3f4f6' : '#fff',
                cursor: effectivePage >= totalPages ? 'not-allowed' : 'pointer',
                color: effectivePage >= totalPages ? '#9ca3af' : '#374151'
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
