"use client";

import { useEffect, useState, useRef } from "react";

interface LogViewerProps {
  logFile: string;
  label: string;
}

export default function LogViewer({ logFile, label }: LogViewerProps) {
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);

  const fetchLogs = async (forceScroll = false) => {
    try {
      // Use relative path for Next.js API routes
      const response = await fetch(`/api/logs?file=${logFile}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setLogs(data.content || '');
      setError(null);
      
      // Force scroll on manual refresh or initial load
      if (forceScroll) {
        shouldAutoScrollRef.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
      setLogs('');
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm(`Are you sure you want to clear ${label}? This action cannot be undone.`)) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch(`/api/logs?file=${logFile}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      // Clear the displayed logs and refresh
      setLogs('');
      shouldAutoScrollRef.current = true;
      await fetchLogs(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
    } finally {
      setIsClearing(false);
    }
  };

  // Check if user is near the bottom of the scroll container
  const checkIfShouldAutoScroll = () => {
    if (!logContainerRef.current) return false;
    const container = logContainerRef.current;
    const threshold = 100; // pixels from bottom
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    return isNearBottom;
  };

  // Handle scroll events to track if user manually scrolled
  const handleScroll = () => {
    shouldAutoScrollRef.current = checkIfShouldAutoScroll();
  };

  useEffect(() => {
    // Initial load - always scroll to bottom
    shouldAutoScrollRef.current = true;
    fetchLogs(true);
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        // Check if we should auto-scroll before fetching
        shouldAutoScrollRef.current = checkIfShouldAutoScroll();
        fetchLogs(false);
      }, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [logFile, autoRefresh]);

  // Auto-scroll to bottom when new logs arrive, but only if user is near bottom
  useEffect(() => {
    if (logContainerRef.current && autoRefresh && shouldAutoScrollRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (logContainerRef.current && shouldAutoScrollRef.current) {
          const container = logContainerRef.current;
          // Scroll to bottom without causing page jumps
          container.scrollTop = container.scrollHeight;
        }
      }, 0);
    }
  }, [logs, autoRefresh]);

  return (
    <div className="card">
      <div className="card-header d-flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title">{label}</h3>
        <div className="d-flex" style={{ gap: '1rem', alignItems: 'center' }}>
          <label className="d-flex" style={{ alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              shouldAutoScrollRef.current = true;
              fetchLogs(true);
            }}
            disabled={isLoading || isClearing}
          >
            Refresh
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={clearLogs}
            disabled={isLoading || isClearing}
            title={`Clear ${label}`}
          >
            {isClearing ? 'Clearing...' : 'Clear'}
          </button>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {error ? (
          <div className="alert alert-danger" style={{ margin: '1rem' }}>
            <strong>Error loading logs:</strong> {error}
          </div>
        ) : (
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="text-left"
            style={{
              backgroundColor: '#1b1b1b',
              color: '#00ff00',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              padding: '1rem',
              maxHeight: '400px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.5'
            }}
          >
            {isLoading ? (
              <div className="text-center">
                <div className="spinner spinner--sm"></div>
                <p className="mt-2">Loading logs...</p>
              </div>
            ) : logs ? (
              <>
                {logs}
                <div ref={logEndRef} />
              </>
            ) : (
              <p>No logs available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
