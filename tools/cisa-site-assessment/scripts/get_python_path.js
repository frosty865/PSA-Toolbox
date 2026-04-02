#!/usr/bin/env node
/**
 * Cross-platform Python runner
 * Usage: node scripts/get_python_path.js <script> [args...]
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function getPythonPath() {
  const isWindows = process.platform === 'win32';
  const venvRoot = path.join(__dirname, '..', 'venv');
  
  if (isWindows) {
    const pythonExe = path.join(venvRoot, 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      return pythonExe;
    }
  } else {
    const pythonBin = path.join(venvRoot, 'bin', 'python');
    if (fs.existsSync(pythonBin)) {
      return pythonBin;
    }
    // Fallback to python3 if venv/bin/python doesn't exist
    const python3Bin = path.join(venvRoot, 'bin', 'python3');
    if (fs.existsSync(python3Bin)) {
      return python3Bin;
    }
  }
  
  // Fallback to system python
  return isWindows ? 'python' : 'python3';
}

if (require.main === module) {
  // If run directly, execute Python script with args
  const pythonPath = getPythonPath();
  const scriptArgs = process.argv.slice(2);
  
  if (scriptArgs.length === 0) {
    console.error('Usage: node scripts/get_python_path.js <script> [args...]');
    process.exit(1);
  }
  
  const scriptPath = path.resolve(scriptArgs[0]);
  const args = scriptArgs.slice(1);
  
  const proc = spawn(pythonPath, [scriptPath, ...args], {
    stdio: 'inherit',
    shell: false
  });
  
  proc.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  proc.on('error', (err) => {
    console.error(`Failed to run Python: ${err.message}`);
    process.exit(1);
  });
} else {
  module.exports = { getPythonPath };
}
