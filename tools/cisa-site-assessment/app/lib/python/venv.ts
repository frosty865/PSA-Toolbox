/**
 * PSA System Python Virtual Environment Utilities
 * Resolves Python executable paths from env, PSA System venv, or PATH.
 */

import { execSync } from 'child_process';
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
  }
  return path.join(venvPath, 'bin', 'python');
}

function tryPythonRuns(cmd: string): boolean {
  const trimmed = cmd.trim();
  if (!trimmed) return false;
  if (path.isAbsolute(trimmed) || trimmed.includes(path.sep)) {
    if (!existsSync(trimmed)) return false;
  }
  try {
    const q = trimmed.includes(' ') ? `"${trimmed}"` : trimmed;
    execSync(`${q} --version`, {
      stdio: 'ignore',
      timeout: 4000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Env keys to try first for the processor (ingestion, PDF) stack. */
function processorEnvCandidates(): string[] {
  const keys = ['PROCESSOR_PYTHON', 'PSA_PYTHON_PROCESSOR_EXE', 'PYTHON_PATH', 'PYTHON'] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) out.push(v);
  }
  return out;
}

/** Env keys for engine (reserved; same pattern as processor). */
function engineEnvCandidates(): string[] {
  const keys = ['ENGINE_PYTHON', 'PSA_PYTHON_ENGINE_EXE', 'PYTHON_PATH', 'PYTHON'] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) out.push(v);
  }
  return out;
}

/**
 * Returns true if `cmd` is runnable as Python (by `--version`), including bare names on PATH
 * (e.g. `python3` on Linux). Use this instead of fs.existsSync for commands.
 */
export function isPythonRunnable(cmd: string): boolean {
  return tryPythonRuns(cmd);
}

/**
 * Find Python executable for a service
 * Order: env overrides → PSA venv → system python / python3 / py (Windows)
 * @param serviceName Service name ('engine' | 'processor')
 * @returns Python executable path or command name, or null if not found
 */
export function findPythonExecutable(serviceName: 'engine' | 'processor'): string | null {
  const envFirst = serviceName === 'processor' ? processorEnvCandidates() : engineEnvCandidates();
  for (const cmd of envFirst) {
    if (tryPythonRuns(cmd)) return cmd;
  }

  const venvPython = getPythonExecutablePath(serviceName);
  if (tryPythonRuns(venvPython)) return venvPython;

  const candidates = ['python', 'python3'];
  if (process.platform === 'win32') {
    candidates.push('py');
  }
  for (const cmd of candidates) {
    if (tryPythonRuns(cmd)) return cmd;
  }

  return null;
}
