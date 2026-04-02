'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchJson } from '@/app/lib/http/apiJson'
import {
  parseDisciplinesPayload,
  parseDisciplineSubtypesPayload,
  type DisciplineDto as Discipline,
  type DisciplineSubtypeDto as DisciplineSubtype,
} from '@/app/lib/dto/reference'

// Comprehensive discipline descriptions and examples
// Based on actual disciplines in Supabase database
const DISCIPLINE_DESCRIPTIONS = {
  'Security Management & Governance': {
    description: 'Security policies, procedures, risk management, training, and governance frameworks that establish the foundation for an effective security program.',
    examples: [
      'Security policy development and maintenance',
      'Risk assessment and management frameworks',
      'Security awareness and training programs',
      'Security governance and oversight',
      'Compliance and audit procedures',
      'Security program management'
    ]
  },
  'Access Control Systems': {
    description: 'Physical and electronic access control systems including PACS (Physical Access Control Systems), visitor management, biometrics, and locking hardware that control who can enter facilities and access resources.',
    examples: [
      'Physical Access Control Systems (PACS)',
      'Badge reader and keycard systems',
      'Biometric authentication (fingerprint, retina, face)',
      'Visitor management systems',
      'Electronic locks and access hardware',
      'Multi-factor authentication systems'
    ]
  },
  'Video Surveillance Systems': {
    description: 'Video surveillance and monitoring systems including IP cameras, analog cameras, hybrid systems, storage, and analytics that provide observation and recording capabilities.',
    examples: [
      'IP camera networks and systems',
      'Analog CCTV camera systems',
      'Hybrid camera systems',
      'Video recording and storage systems',
      'Video analytics and AI detection',
      'Remote monitoring and viewing capabilities'
    ]
  },
  'Intrusion Detection Systems': {
    description: 'Intrusion detection and alarm systems including door contacts, glass break sensors, motion detectors, and perimeter IDS that detect unauthorized entry or activity.',
    examples: [
      'Door and window contact sensors',
      'Glass break detection sensors',
      'Motion detectors and PIR sensors',
      'Perimeter intrusion detection systems',
      'Alarm monitoring and notification',
      'Integration with access control systems'
    ]
  },
  'Perimeter Security': {
    description: 'Perimeter security measures including fencing, clear zones, barriers/bollards, perimeter lighting, and waterside security that protect facility boundaries.',
    examples: [
      'Perimeter fencing and barriers',
      'Vehicle barriers and crash-rated bollards',
      'Security gates and access points',
      'Perimeter lighting systems',
      'Clear zones and standoff distances',
      'Waterside security measures'
    ]
  },
  'Interior Security & Physical Barriers': {
    description: 'Interior security measures including secure areas, safe rooms, physical barriers, locks, and interior lighting that protect assets and people inside facilities.',
    examples: [
      'Secure areas and restricted zones',
      'Safe rooms and secure enclosures',
      'Physical barriers and interior bollards',
      'High-security locks and safes',
      'Interior security lighting',
      'Asset protection measures'
    ]
  },
  'Security Force / Operations': {
    description: 'Security operations including security operations centers (SOC), patrols/posts, radios & communications, and response procedures that provide active security presence.',
    examples: [
      'Security Operations Centers (SOC)',
      'Security guard patrols and posts',
      'Radio and communication systems',
      'Security response procedures',
      'Incident response and coordination',
      'Security force training and readiness'
    ]
  },
  'Emergency Management & Resilience': {
    description: 'Emergency management and resilience planning including EAP (Emergency Action Plans), BCP (Business Continuity Plans), drills & exercises, and mass notification systems.',
    examples: [
      'Emergency Action Plans (EAP)',
      'Business Continuity Planning (BCP)',
      'Emergency drills and exercises',
      'Mass notification systems',
      'Evacuation procedures and signage',
      'Emergency response coordination'
    ]
  },
  'Information Sharing & Coordination': {
    description: 'Information sharing and coordination mechanisms including law enforcement liaison, fusion centers, JTTF (Joint Terrorism Task Force), HSIN (Homeland Security Information Network), and ISAC/ISAO (Information Sharing and Analysis Centers/Organizations).',
    examples: [
      'Law enforcement liaison programs',
      'Fusion center participation',
      'Joint Terrorism Task Force (JTTF) coordination',
      'Homeland Security Information Network (HSIN)',
      'Information Sharing and Analysis Centers (ISAC)',
      'Threat intelligence sharing'
    ]
  },
  'Cyber-Physical Infrastructure Support': {
    description: 'Cyber-physical infrastructure support including UPS/power systems, switches & ESS network, server rooms, and cable security that protect the physical infrastructure supporting IT systems.',
    examples: [
      'Uninterruptible Power Supply (UPS) systems',
      'Network switches and ESS infrastructure',
      'Server room security and environmental controls',
      'Cable security and protection',
      'Data center physical security',
      'Critical infrastructure redundancy'
    ]
  }
}

// Function to get discipline description and examples
function getDisciplineInfo(disciplineName: string) {
  const normalized = disciplineName.trim()
  
  // Try exact match first
  if (normalized in DISCIPLINE_DESCRIPTIONS) {
    return DISCIPLINE_DESCRIPTIONS[normalized as keyof typeof DISCIPLINE_DESCRIPTIONS]
  }
  
  // Try case-insensitive match
  for (const [key, value] of Object.entries(DISCIPLINE_DESCRIPTIONS)) {
    if (key.toLowerCase() === normalized.toLowerCase()) {
      return value
    }
  }
  
  // Fallback
  return {
    description: `Security discipline focused on ${normalized.toLowerCase()}. This discipline encompasses practices, technologies, and procedures related to protecting facilities, systems, and assets.`,
    examples: []
  }
}

export default function DisciplinesPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<DisciplineSubtype | null>(null)
  const [subtypeDetails, setSubtypeDetails] = useState<DisciplineSubtype | null>(null)
  const [loadingSubtype, setLoadingSubtype] = useState(false)

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || ''
      if (
        errorMessage.includes('message channel') ||
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('channel closed')
      ) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason || ''
      if (
        errorMessage.includes('message channel') ||
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('channel closed')
      ) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }
    
    window.addEventListener('error', handleError, true)
    window.addEventListener('unhandledrejection', handleRejection, true)
    
    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleRejection, true)
    }
  }, [])

  // Load disciplines
  useEffect(() => {
    const loadDisciplines = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const data = await fetchJson(
          '/api/reference/disciplines?active=true',
          { cache: 'no-store' },
          parseDisciplinesPayload
        )
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load disciplines')
        }
        
        const rawDisciplines = data.disciplines
        
        if (rawDisciplines.length === 0) {
          setDisciplines([])
          setError('No disciplines found in database')
          return
        }
        
        // Deduplicate by ID (keep first occurrence)
        const seenIds = new Set<string>()
        const uniqueDisciplines = rawDisciplines.filter((d) => {
          if (!d.id) {
            console.warn('[DisciplinesPage] Discipline without ID:', d.name)
            return false // Skip entries without ID
          }
          if (seenIds.has(d.id)) {
            console.warn(`[DisciplinesPage] Duplicate discipline found: ${d.name} (ID: ${d.id})`)
            return false
          }
          seenIds.add(d.id)
          return true
        })
        
        // Also deduplicate by name as a fallback (in case IDs are different but names are same)
        const seenNames = new Set<string>()
        const finalDisciplines = uniqueDisciplines.filter((d) => {
          const name = (d.name || '').trim().toLowerCase()
          if (!name) {
            console.warn('[DisciplinesPage] Discipline without name:', d.id)
            return false
          }
          if (seenNames.has(name)) {
            console.warn(`[DisciplinesPage] Duplicate discipline name found: ${d.name} (ID: ${d.id})`)
            return false
          }
          seenNames.add(name)
          return true
        })
        
        const disciplinesData: Discipline[] = finalDisciplines
          .filter((d) => d.is_active !== false)
          .sort((a, b) => {
            // Sort by category first, then name
            const catA = (a.category || '').toLowerCase()
            const catB = (b.category || '').toLowerCase()
            if (catA !== catB) {
              return catA.localeCompare(catB)
            }
            const nameA = (a.name || '').toLowerCase()
            const nameB = (b.name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
          .map((d) => {
            // Ensure discipline_subtypes is preserved and is an array
            const subtypes = Array.isArray(d.discipline_subtypes) ? d.discipline_subtypes : [];
            return {
              ...d,
              discipline_subtypes: subtypes
            } as Discipline;
          })
        
        setDisciplines(disciplinesData)
        setError(null)
      } catch (err) {
        console.error('[DisciplinesPage] Error loading disciplines:', err)
        setError(err instanceof Error ? err.message : 'Failed to load disciplines')
        setDisciplines([])
      } finally {
        setLoading(false)
      }
    }

    loadDisciplines()
  }, [])

  // Toggle discipline expansion
  const toggleDiscipline = (disciplineId: string) => {
    setExpandedDisciplines(prev => {
      const newSet = new Set(prev)
      if (newSet.has(disciplineId)) {
        newSet.delete(disciplineId)
      } else {
        newSet.add(disciplineId)
      }
      return newSet
    })
  }

  // Load detailed subtype information
  const loadSubtypeDetails = async (subtype: DisciplineSubtype) => {
    try {
      setLoadingSubtype(true)
      setSelectedSubtype(subtype)
      
      // Fetch subtype directly by ID to get all extended fields from database
      const url = `/api/reference/discipline-subtypes?subtype_id=${subtype.id}`
      
      const data = await fetchJson(
        url,
        { cache: 'no-store' },
        parseDisciplineSubtypesPayload
      )
      if (!data.success) {
        throw new Error(data.error || 'Failed to load subtype details')
      }
      const fullSubtype = data.subtypes[0] // Direct lookup returns single result
      
      if (fullSubtype) {
        setSubtypeDetails(fullSubtype)
      } else {
        // Fallback to the subtype we have
        setSubtypeDetails(subtype)
      }
    } catch (err) {
      console.error('Error loading subtype details:', err)
      // Fallback to the subtype we have
      setSubtypeDetails(subtype)
    } finally {
      setLoadingSubtype(false)
    }
  }

  // Close subtype detail modal
  const closeSubtypeDetails = () => {
    setSelectedSubtype(null)
    setSubtypeDetails(null)
  }

  // Helper function to check if an array field has content
  const hasArrayContent = (field: unknown) => {
    if (!field) {
      return false
    }
    if (Array.isArray(field)) {
      return field.length > 0
    }
    return false
  }

  // Helper function to get array safely
  const getArray = (field: unknown) => {
    if (Array.isArray(field)) {
      return field
    }
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // Failed to parse, return empty array
      }
    }
    return []
  }

  // Expand/collapse all
  const expandAll = () => {
    setExpandedDisciplines(new Set(disciplines.map((d: Discipline) => d.id)))
  }

  const collapseAll = () => {
    setExpandedDisciplines(new Set())
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    disciplines.forEach((d: Discipline) => {
      if (d.category) {
        cats.add(d.category)
      }
    })
    return Array.from(cats).sort()
  }, [disciplines])

  // Filter disciplines
  const filteredDisciplines = useMemo(() => {
    let filtered = disciplines

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((d: Discipline) => d.category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((discipline: Discipline) => {
        const name = (discipline.name || '').toLowerCase()
        const desc = (discipline.description || '').toLowerCase()
        const code = (discipline.code || '').toLowerCase()
        const category = (discipline.category || '').toLowerCase()
        
        if (name.includes(term) || desc.includes(term) || code.includes(term) || category.includes(term)) {
          return true
        }

        // Check subtypes
        const subtypes = discipline.discipline_subtypes || []
        return subtypes.some((st: DisciplineSubtype) => {
          const stName = (st.name || '').toLowerCase()
          const stDesc = (st.description || '').toLowerCase()
          return stName.includes(term) || stDesc.includes(term)
        })
      })
    }

    return filtered
  }, [disciplines, selectedCategory, searchTerm])

  // Group by category
  const disciplinesByCategory = useMemo(() => {
    const grouped: Record<string, Discipline[]> = {}
    filteredDisciplines.forEach((d: Discipline) => {
      const cat = d.category || 'Uncategorized'
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push(d)
    })
    return grouped
  }, [filteredDisciplines])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSubtypes = disciplines.reduce((sum: number, d: Discipline) => {
      return sum + (d.discipline_subtypes?.length || 0)
    }, 0)
    
    return {
      totalDisciplines: disciplines.length,
      totalSubtypes,
      categories: categories.length
    }
  }, [disciplines, categories])

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--cisa-gray-light)',
          borderTop: '4px solid var(--cisa-blue)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto var(--spacing-md)'
        }}></div>
        <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)' }}>
          Loading disciplines...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <div className="card" style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--cisa-red-light)',
          border: '1px solid var(--cisa-red)',
          color: 'var(--cisa-red-dark)'
        }}>
          <h2 style={{ marginTop: 0 }}>Error Loading Disciplines</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: 'var(--font-size-xxl)',
          fontWeight: 700,
          color: 'var(--cisa-blue)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Security Disciplines
        </h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: '1.6',
          marginBottom: 'var(--spacing-md)'
        }}>
          This page displays the security disciplines used to classify vulnerabilities and options 
          for consideration. Disciplines are organized by category (Cyber, Physical, OT) and may 
          include subtypes for more specific classification.
        </p>

        {/* Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.totalDisciplines}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Total Disciplines
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.categories}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Categories
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.totalSubtypes}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Subtypes
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search disciplines, subtypes, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  fontSize: 'var(--font-size-base)'
                }}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-base)',
                minWidth: '150px'
              }}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              onClick={expandAll}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--cisa-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)'
              }}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--cisa-gray)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)'
              }}
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Disciplines List - Grouped by Category */}
      {Object.keys(disciplinesByCategory).length === 0 ? (
        <div className="card" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)' }}>
            No disciplines found matching your search criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {Object.entries(disciplinesByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryDisciplines]) => (
            <div key={category}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 600,
                color: 'var(--cisa-blue)',
                marginBottom: 'var(--spacing-md)',
                paddingBottom: 'var(--spacing-sm)',
                borderBottom: '2px solid var(--cisa-gray-light)'
              }}>
                {category} ({categoryDisciplines.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {categoryDisciplines.map(discipline => {
                  const disciplineName = discipline.name || 'Unknown Discipline'
                  const disciplineId = discipline.id
                  const isExpanded = expandedDisciplines.has(disciplineId)
                  const subtypes = discipline.discipline_subtypes || []
                  
                  // Filter active subtypes (is_active can be true, null, or undefined - all should be shown)
                  const activeSubtypes = subtypes.filter((st) => {
                    // Show if is_active is true, null, or undefined (only hide if explicitly false)
                    return st.is_active !== false;
                  });
                  
                  const subtypeCount = activeSubtypes.length
                  
                  // Always prioritize database description and examples
                  const dbDescription = discipline.description?.trim()
                  const info = getDisciplineInfo(disciplineName)
                  // Use database description if available, otherwise use fallback
                  const displayDescription = dbDescription || info.description
                  // Check if database has examples field (from extended information)
                  // For now, examples are only in fallback - database doesn't have examples field for disciplines yet
                  const examples = discipline.examples || info.examples || []

                  return (
                    <div
                      key={disciplineId}
                      className="card"
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        border: '1px solid var(--cisa-gray-light)'
                      }}
                    >
                      {/* Discipline Header */}
                      <div style={{
                        backgroundColor: 'var(--cisa-blue)',
                        color: 'white',
                        padding: 'var(--spacing-lg)',
                        borderBottom: displayDescription ? '1px solid rgba(255,255,255,0.2)' : 'none'
                      }}>
                        <button
                          onClick={() => toggleDiscipline(disciplineId)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            backgroundColor: 'transparent',
                            color: 'inherit',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 0
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <h3 style={{
                              margin: 0,
                              fontSize: 'var(--font-size-xl)',
                              fontWeight: 600,
                              marginBottom: 'var(--spacing-xs)'
                            }}>
                              {disciplineName}
                              {discipline.code && (
                                <span style={{
                                  marginLeft: 'var(--spacing-sm)',
                                  fontSize: 'var(--font-size-sm)',
                                  fontWeight: 400,
                                  opacity: 0.9
                                }}>
                                  ({discipline.code})
                                </span>
                              )}
                            </h3>
                            <div style={{
                              fontSize: 'var(--font-size-sm)',
                              opacity: 0.95,
                              fontWeight: 400
                            }}>
                              {subtypeCount} {subtypeCount === 1 ? 'subtype' : 'subtypes'}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 'var(--font-size-xl)',
                            fontWeight: 600,
                            marginLeft: 'var(--spacing-md)'
                          }}>
                            {isExpanded ? '▼' : '▶'}
                          </div>
                        </button>
                        {displayDescription && (
                          <div style={{
                            marginTop: 'var(--spacing-md)',
                            paddingTop: 'var(--spacing-md)',
                            borderTop: '1px solid rgba(255,255,255,0.2)',
                            fontSize: 'var(--font-size-base)',
                            lineHeight: '1.6',
                            color: 'rgba(255,255,255,0.95)',
                            fontWeight: 400
                          }}>
                            {displayDescription}
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div style={{
                          padding: 'var(--spacing-lg)',
                          backgroundColor: 'var(--cisa-gray-lighter)',
                          borderTop: '1px solid var(--cisa-gray-light)'
                        }}>
                          {/* Examples Section */}
                          {examples.length > 0 && (
                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                              <h4 style={{
                                fontSize: 'var(--font-size-base)',
                                fontWeight: 600,
                                color: 'var(--cisa-blue)',
                                marginBottom: 'var(--spacing-sm)'
                              }}>
                                Examples
                              </h4>
                              <ul style={{
                                margin: 0,
                                paddingLeft: 'var(--spacing-lg)',
                                color: 'var(--cisa-gray-dark)',
                                lineHeight: '1.8'
                              }}>
                                {examples.map((example: string, idx: number) => (
                                  <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                                    {example}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Subtypes Section */}
                          {subtypeCount > 0 ? (
                            <div>
                              <h4 style={{
                                fontSize: 'var(--font-size-base)',
                                fontWeight: 600,
                                color: 'var(--cisa-blue)',
                                marginBottom: 'var(--spacing-sm)'
                              }}>
                                Subtypes ({subtypeCount})
                              </h4>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: 'var(--spacing-sm)'
                              }}>
                                {activeSubtypes.map((subtype) => {
                                  if (!subtype.id) {
                                    console.error('[DisciplinesPage] Subtype missing ID:', subtype);
                                  }
                                  return (
                                  <div
                                    key={subtype.id}
                                    onClick={() => loadSubtypeDetails(subtype)}
                                    style={{
                                      padding: 'var(--spacing-md)',
                                      backgroundColor: 'white',
                                      borderRadius: 'var(--border-radius)',
                                      border: '1px solid var(--cisa-gray-light)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      transition: 'all 0.2s',
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
                                      e.currentTarget.style.borderColor = 'var(--cisa-blue)'
                                      e.currentTarget.style.transform = 'translateY(-2px)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                                      e.currentTarget.style.borderColor = 'var(--cisa-gray-light)'
                                      e.currentTarget.style.transform = 'translateY(0)'
                                    }}
                                  >
                                    <div style={{
                                      fontWeight: 600,
                                      fontSize: 'var(--font-size-base)',
                                      color: 'var(--cisa-blue)',
                                      marginBottom: 'var(--spacing-xs)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between'
                                    }}>
                                      <span>
                                        {subtype.name || 'Unknown Subtype'}
                                        {subtype.code && (
                                          <span style={{
                                            marginLeft: 'var(--spacing-xs)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--cisa-gray)',
                                            fontWeight: 400
                                          }}>
                                            ({subtype.code})
                                          </span>
                                        )}
                                      </span>
                                      <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--cisa-gray)',
                                        fontWeight: 400
                                      }}>
                                        Click for details →
                                      </span>
                                    </div>
                                    {subtype.description && (
                                      <div style={{
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--cisa-gray-dark)',
                                        lineHeight: '1.6',
                                        marginTop: 'var(--spacing-xs)'
                                      }}>
                                        {subtype.description}
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p style={{
                                color: 'var(--cisa-gray)',
                                fontSize: 'var(--font-size-sm)',
                                fontStyle: 'italic',
                                margin: 0
                              }}>
                                No subtypes available for this discipline.
                              </p>
                              {subtypes.length > 0 && (
                                <p style={{
                                  color: 'var(--cisa-warning)',
                                  fontSize: 'var(--font-size-xs)',
                                  marginTop: 'var(--spacing-xs)'
                                }}>
                                  ({subtypes.length} subtype(s) found but filtered out - check is_active status)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtype Detail Modal */}
      {selectedSubtype && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--spacing-lg)'
          }}
          onClick={closeSubtypeDetails}
        >
          <div
            className="card"
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'var(--spacing-xl)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeSubtypeDetails}
              style={{
                position: 'absolute',
                top: 'var(--spacing-md)',
                right: 'var(--spacing-md)',
                background: 'none',
                border: 'none',
                fontSize: 'var(--font-size-xl)',
                cursor: 'pointer',
                color: 'var(--cisa-gray)',
                padding: 'var(--spacing-xs)',
                lineHeight: 1
              }}
            >
              ×
            </button>

            {loadingSubtype ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid var(--cisa-gray-light)',
                  borderTop: '4px solid var(--cisa-blue)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto var(--spacing-md)'
                }}></div>
                <p>Loading subtype details...</p>
              </div>
            ) : subtypeDetails ? (
              <>
                {/* Header */}
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h2 style={{
                    fontSize: 'var(--font-size-xxl)',
                    fontWeight: 700,
                    color: 'var(--cisa-blue)',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    {subtypeDetails.name || 'Unknown Subtype'}
                    {subtypeDetails.code && (
                      <span style={{
                        marginLeft: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 400,
                        color: 'var(--cisa-gray)'
                      }}>
                        ({subtypeDetails.code})
                      </span>
                    )}
                  </h2>
                  {subtypeDetails.description && (
                    <p style={{
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.6',
                      marginTop: 'var(--spacing-sm)'
                    }}>
                      {subtypeDetails.description}
                    </p>
                  )}
                </div>

                {/* Overview */}
                {subtypeDetails.overview && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Overview
                    </h3>
                    <p style={{
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.6',
                      margin: 0
                    }}>
                      {subtypeDetails.overview}
                    </p>
                  </div>
                )}

                {/* Indicators of Risk */}
                {hasArrayContent(subtypeDetails.indicators_of_risk) && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Indicators of Risk
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {getArray(subtypeDetails.indicators_of_risk).map((indicator: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Common Failures */}
                {hasArrayContent(subtypeDetails.common_failures) && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Common Failures
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {getArray(subtypeDetails.common_failures).map((failure: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {failure}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Assessment Questions */}
                {hasArrayContent(subtypeDetails.assessment_questions) && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Assessment Questions
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {getArray(subtypeDetails.assessment_questions).map((question: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mitigation Guidance */}
                {hasArrayContent(subtypeDetails.mitigation_guidance) && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Mitigation Guidance
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {getArray(subtypeDetails.mitigation_guidance).map((guidance: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {guidance}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Standards References */}
                {hasArrayContent(subtypeDetails.standards_references) && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Standards & References
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {getArray(subtypeDetails.standards_references).map((standard: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {standard}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* PSA Notes */}
                {subtypeDetails.psa_notes && (
                  <div style={{
                    marginTop: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--cisa-gray-lighter)',
                    borderRadius: 'var(--border-radius)',
                    borderLeft: '4px solid var(--cisa-blue)'
                  }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      PSA Notes
                    </h3>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.6',
                      margin: 0
                    }}>
                      {subtypeDetails.psa_notes}
                    </p>
                  </div>
                )}

                {/* Legacy fields support (examples, use_cases, best_practices, etc.) */}
                {subtypeDetails.examples && Array.isArray(subtypeDetails.examples) && subtypeDetails.examples.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Examples
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {subtypeDetails.examples.map((example: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {subtypeDetails.use_cases && Array.isArray(subtypeDetails.use_cases) && subtypeDetails.use_cases.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Use Cases
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {subtypeDetails.use_cases.map((useCase: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {useCase}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {subtypeDetails.best_practices && Array.isArray(subtypeDetails.best_practices) && subtypeDetails.best_practices.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Best Practices
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {subtypeDetails.best_practices.map((practice: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {subtypeDetails.key_features && Array.isArray(subtypeDetails.key_features) && subtypeDetails.key_features.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Key Features
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {subtypeDetails.key_features.map((feature: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {subtypeDetails.related_standards && Array.isArray(subtypeDetails.related_standards) && subtypeDetails.related_standards.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Related Standards & Guidelines
                    </h3>
                    <ul style={{
                      margin: 0,
                      paddingLeft: 'var(--spacing-lg)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.8'
                    }}>
                      {subtypeDetails.related_standards.map((standard: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>
                          {standard}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {subtypeDetails.implementation_notes && (
                  <div style={{
                    marginTop: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--cisa-gray-lighter)',
                    borderRadius: 'var(--border-radius)',
                    borderLeft: '4px solid var(--cisa-blue)'
                  }}>
                    <h3 style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 600,
                      color: 'var(--cisa-blue)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Implementation Notes
                    </h3>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--cisa-gray-dark)',
                      lineHeight: '1.6',
                      margin: 0
                    }}>
                      {subtypeDetails.implementation_notes}
                    </p>
                  </div>
                )}

                {/* Show message if no extended information is available */}
                {!subtypeDetails.overview &&
                 (!subtypeDetails.indicators_of_risk || !Array.isArray(subtypeDetails.indicators_of_risk) || subtypeDetails.indicators_of_risk.length === 0) &&
                 (!subtypeDetails.common_failures || !Array.isArray(subtypeDetails.common_failures) || subtypeDetails.common_failures.length === 0) &&
                 (!subtypeDetails.assessment_questions || !Array.isArray(subtypeDetails.assessment_questions) || subtypeDetails.assessment_questions.length === 0) &&
                 (!subtypeDetails.mitigation_guidance || !Array.isArray(subtypeDetails.mitigation_guidance) || subtypeDetails.mitigation_guidance.length === 0) &&
                 (!subtypeDetails.standards_references || !Array.isArray(subtypeDetails.standards_references) || subtypeDetails.standards_references.length === 0) &&
                 !subtypeDetails.psa_notes &&
                 (!subtypeDetails.examples || !Array.isArray(subtypeDetails.examples) || subtypeDetails.examples.length === 0) &&
                 (!subtypeDetails.use_cases || !Array.isArray(subtypeDetails.use_cases) || subtypeDetails.use_cases.length === 0) &&
                 (!subtypeDetails.best_practices || !Array.isArray(subtypeDetails.best_practices) || subtypeDetails.best_practices.length === 0) &&
                 (!subtypeDetails.key_features || !Array.isArray(subtypeDetails.key_features) || subtypeDetails.key_features.length === 0) &&
                 (!subtypeDetails.related_standards || !Array.isArray(subtypeDetails.related_standards) || subtypeDetails.related_standards.length === 0) &&
                 !subtypeDetails.implementation_notes && (
                  <div style={{
                    marginTop: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--cisa-gray-lighter)',
                    borderRadius: 'var(--border-radius)',
                    borderLeft: '4px solid var(--cisa-warning)',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--cisa-gray-dark)',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      Extended information (examples, use cases, best practices, etc.) is not yet available for this subtype.
                      <br />
                      An administrator can add this information in the database.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <p>No details available for this subtype.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

