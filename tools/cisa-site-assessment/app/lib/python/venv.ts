/**
 * PSA System Python Virtual Environment Utilities
 * Resolves Python executable paths from PSA_SYSTEM_ROOT
 */

import { existsSync } from 'fs';
import * as path from 'path';

/**
 * Get PSA System root directory
 * Checks PSA_SYSTEM_ROOT environment variable, defaults to D:\PSA_System
 */
export function getPSASystemRoot(): string {
  return process.env.PSA_SYSTEM_ROOT || 'D:\\PSA_System';
}

/**
 * Get Python virtual environment path for a service
 * @param serviceName Service name ('engine' | 'processor')
 * @returns Path to venv directory
 */
export function getVenvPath(serviceName: 'engine' | 'processor'): string {
  const root = getPSASystemRoot();
  return path.join(root, 'Dependencies', 'python', 'venvs', serviceName);
}

/**
 * Get Python executable path for a service
 * @param serviceName Service name ('engine' | 'processor')
 * @returns Path to python.exe (Windows) or python (Unix)
 */
export function getPythonExecutablePath(serviceName: 'engine' | 'processor'): string {
  const venvPath = getVenvPath(serviceName);
  if (process.platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'python.exe');
  } else {
    return path.join(venvPath, 'bin', 'python');
  }
}

/**
 * Find Python executable for a service
 * Tries PSA System venv first, then falls back to system Python
 * @param serviceName Service name ('engine' | 'processor')
 * @returns Python executable path or null if not found
 */
export function findPythonExecutable(serviceName: 'engine' | 'processor'): string | null {
  const candidates: string[] = [];

  // Check PSA System venv first
  const venvPython = getPythonExecutablePath(serviceName);
  try {
    if (existsSync(venvPython)) {
      candidates.unshift(venvPython);
    }
  } catch {
    // Ignore errors
  }

  // Fallback to system Python
  candidates.push('python', 'python3');
  
  if (process.platform === 'win32') {
    candidates.push('py'); // Windows Python Launcher
  }

  // Try each candidate
  for (const cmd of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic require inside loop
      const { execSync } = require('child_process');
      execSync(`"${cmd}" --version`, { 
        stdio: 'ignore', 
        timeout: 2000,
        windowsHide: true,
      });
      return cmd;
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}
