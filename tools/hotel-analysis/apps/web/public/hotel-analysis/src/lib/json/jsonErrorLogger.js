/**
 * JSON Error Logger - Systemwide Error Logging
 * Logs all JSON errors to localStorage (browser) or file (Node.js)
 */

(function(global) {
    'use strict';

    const LOGS_KEY = 'host_json_error_logs';
    const MAX_LOGS = 1000;

    /**
     * Log JSON error with full context
     * @param {string} toolId - Tool identifier
     * @param {Error|Object} error - Error object or error info
     * @param {Object} [payload] - JSON payload snapshot
     */
    function logJsonError(toolId, error, payload) {
        const timestamp = new Date().toISOString();
        const errorMessage = error?.message || error?.error_message || String(error);
        const errorPath = error?.path || error?.field || null;
        
        const logEntry = {
            timestamp: timestamp,
            tool_id: toolId || 'unknown',
            error_message: errorMessage,
            field: errorPath,
            payload_snapshot: payload ? JSON.stringify(payload, null, 2) : null
        };

        try {
            // Browser: Store in localStorage
            if (typeof localStorage !== 'undefined') {
                const existingLogs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
                existingLogs.push(logEntry);
                
                // Keep only last MAX_LOGS entries
                if (existingLogs.length > MAX_LOGS) {
                    existingLogs.shift();
                }
                
                localStorage.setItem(LOGS_KEY, JSON.stringify(existingLogs));
            }
            
            // Always log to console
            console.error(`[${timestamp}] TOOL=${toolId}`);
            console.error(`Error: ${errorMessage}`);
            if (errorPath) {
                console.error(`Field: ${errorPath}`);
            }
            if (payload) {
                console.error('Payload snapshot:', payload);
            }
        } catch (e) {
            console.error('[JSON Error Logger Failed]', e, logEntry);
        }
    }

    /**
     * Get JSON error logs
     * @param {number} [limit=100] - Maximum number of logs to return
     * @returns {Array} Array of error log entries
     */
    function getJsonErrorLogs(limit = 100) {
        try {
            if (typeof localStorage !== 'undefined') {
                const logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
                return logs.slice(-limit);
            }
            return [];
        } catch (e) {
            console.error('Failed to get JSON error logs:', e);
            return [];
        }
    }

    /**
     * Clear JSON error logs
     */
    function clearJsonErrorLogs() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(LOGS_KEY);
            }
        } catch (e) {
            console.error('Failed to clear JSON error logs:', e);
        }
    }

    /**
     * Export error logs as JSON file
     */
    function exportErrorLogs() {
        try {
            const logs = getJsonErrorLogs(1000);
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `host_json_errors_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export error logs:', e);
        }
    }

    // Export to global
    global.HostJsonErrorLogger = {
        logJsonError,
        getJsonErrorLogs,
        clearJsonErrorLogs,
        exportErrorLogs
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
