"use client";

import LogViewer from "./LogViewer";

export default function ProcessingLogs() {
  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Processing Logs</h2>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <LogViewer logFile="watcher.log" label="Watcher Log" />
        <LogViewer logFile="phase1.log" label="Phase 1 Log" />
        <LogViewer logFile="phase2.log" label="Phase 2 Log" />
        <LogViewer logFile="phase3.log" label="Phase 3 Log" />
      </div>
    </>
  );
}
