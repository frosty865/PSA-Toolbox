import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFileSync, unlinkSync, existsSync } from 'fs';

const execAsync = promisify(exec);

const toolScripts: Record<string, string> = {
  'module-watch': 'watch_module_ingestion',
  'corpus-watch-general': 'watch_general_corpus_ingestion',
  'corpus-watch-technology': 'watch_technology_corpus_ingestion',
  'crawler-start': 'start_server',
};

/**
 * Check if a process with the given PID is still running.
 */
async function isPidAlive(pid: number): Promise<boolean> {
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue"`,
        { maxBuffer: 4096 }
      );
      return stdout.trim().length > 0;
    }
    await execAsync(`kill -0 ${pid}`, { maxBuffer: 0 });
    return true;
  } catch {
    return false;
  }
}

/**
 * API endpoint to check tool/process status
 *
 * GET /api/admin/server-tools/status?toolId=<toolId>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json(
        { error: 'toolId is required' },
        { status: 400 }
      );
    }

    // If we have a PID file (from UI "Run Tool" watcher start), check that process first
    const pidDir = join(process.cwd(), 'storage', 'tool_pids');
    const pidFile = join(pidDir, `${toolId}.pid`);
    if (existsSync(pidFile)) {
      try {
        const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
        if (Number.isInteger(pid) && (await isPidAlive(pid))) {
          return NextResponse.json({
            running: true,
            pid,
            message: 'Tool is running (started from Server Tools)',
          });
        }
        // Stale PID file: process no longer running
        unlinkSync(pidFile);
      } catch {
        // Ignore read/unlink errors; fall through to script-name check
      }
    }

    const scriptName = toolScripts[toolId];
    if (!scriptName) {
      return NextResponse.json({
        running: false,
        message: 'Status check not available for this tool',
      });
    }

    const isWin = process.platform === 'win32';

    if (isWin) {
      // Windows: get node processes with ProcessId and CommandLine (script name may appear with / or \).
      try {
        const ps = `Get-CimInstance Win32_Process -Filter "name='node.exe'" | Select-Object ProcessId, CommandLine | ForEach-Object { $_.ProcessId.ToString() + '|' + $_.CommandLine }`;
        const escaped = ps.replace(/'/g, "''");
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command '${escaped}'`,
          { maxBuffer: 1024 * 1024 }
        );
        const normalizedScript = scriptName.replace(/\//g, '\\');
        const lines = stdout.split(/\r?\n/).filter((l: string) => l.trim());
        const match = lines.find((line: string) => {
          const cmd = line.includes('|') ? line.slice(line.indexOf('|') + 1) : line;
          return cmd.includes(scriptName) || cmd.includes(normalizedScript);
        });
        const isRunning = !!match;
        const pidMatch = match && match.includes('|') ? parseInt(match.split('|')[0], 10) : undefined;
        return NextResponse.json({
          running: isRunning,
          ...(Number.isInteger(pidMatch) ? { pid: pidMatch } : {}),
          message: isRunning ? 'Tool is running' : 'Tool is not running',
        });
      } catch {
        return NextResponse.json({
          running: false,
          message: 'Tool is not running',
        });
      }
    }

    // Unix: use pgrep / ps to find process with script name in command line
    try {
      const { stdout } = await execAsync(
        `pgrep -f "${scriptName}" || true`,
        { maxBuffer: 4096 }
      );
      const isRunning = stdout.trim().length > 0;
      return NextResponse.json({
        running: isRunning,
        message: isRunning ? 'Tool is running' : 'Tool is not running',
      });
    } catch {
      return NextResponse.json({
        running: false,
        message: 'Tool is not running',
      });
    }
  } catch (error: unknown) {
    console.error('[API /api/admin/server-tools/status] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        running: false,
      },
      { status: 500 }
    );
  }
}

