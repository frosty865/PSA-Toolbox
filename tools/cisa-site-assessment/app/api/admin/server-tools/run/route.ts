import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { isServerToolsEnabled } from '@/app/lib/config/admin';
import { getAdminAuditContext, writeAdminAuditLog } from '@/app/lib/admin/audit';
import {
  getLocalTsxBinary,
  parseServerToolBody,
  resolveServerToolConfig,
  runScopeFilterDiagnostic,
  WATCHER_COMMANDS,
} from '@/app/lib/admin/serverTools';

/**
 * API endpoint to run server-side tools
 *
 * POST /api/admin/server-tools/run
 * Body: { toolId: string, command: string, params?: Record<string, string> }
 */
export async function POST(request: NextRequest) {
  try {
    const audit = getAdminAuditContext(request);
    if (!isServerToolsEnabled()) {
      writeAdminAuditLog('server_tools_blocked', audit, { reason: 'disabled' });
      return NextResponse.json(
        {
          error: 'Server tools are disabled',
          message: 'Set ENABLE_SERVER_TOOLS=1 to allow tool execution from the admin UI.',
        },
        { status: 403 }
      );
    }

    const { toolId, command, params } = parseServerToolBody(await request.json());
    writeAdminAuditLog('server_tools_requested', audit, { toolId, command });

    // In-process diagnostics: PSA scope filter (no script spawn)
    if (command === 'diagnostics:scope-filter') {
      const output = runScopeFilterDiagnostic(params.text ?? '');
      writeAdminAuditLog('server_tools_scope_filter_completed', audit, { toolId, command });
      return NextResponse.json({ success: true, output, message: 'Scope filter check completed' });
    }

    const cwd = process.cwd();
    const toolConfig = resolveServerToolConfig(cwd, command, params);
    if (!toolConfig) {
      return NextResponse.json(
        { error: `Unknown command: ${command}` },
        { status: 400 }
      );
    }

    // Build command: use local tsx so npx is not required on PATH (important on Windows/server)
    const scriptPath = toolConfig.script;
    const args = toolConfig.args || [];
    const tsxBin = getLocalTsxBinary(cwd);
    if (!tsxBin) {
      return NextResponse.json(
        { error: 'Local tsx not found. Run: npm install', details: `Expected under: ${join(cwd, 'node_modules', '.bin')}` },
        { status: 500 }
      );
    }
    const execArgs = [scriptPath, ...args];

    // Watchers: spawn detached, write PID, return immediately (no waiting for close)
    if (WATCHER_COMMANDS.has(command)) {
      const pidDir = join(cwd, 'storage', 'tool_pids');
      mkdirSync(pidDir, { recursive: true });

      const proc = spawn(tsxBin, execArgs, {
        cwd,
        env: { ...process.env },
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();

      const pid = proc.pid;
      if (pid === undefined) {
        return NextResponse.json(
          { success: false, error: 'Watcher failed to start (no PID)' },
          { status: 500 }
        );
      }
      const pidFile = join(pidDir, `${toolId}.pid`);
      writeFileSync(pidFile, String(pid), 'utf8');
      writeAdminAuditLog('server_tools_watcher_started', audit, { toolId, command, pid });

      return NextResponse.json({
        success: true,
        running: true,
        pid,
        output: `Watcher started (PID ${pid}). Use Check Status to confirm.`,
        message: 'Watcher started',
      });
    }

    // Short-running tools: wait for exit and return output
    return new Promise<NextResponse>((resolvePromise) => {
      const proc = spawn(tsxBin, execArgs, {
        cwd,
        env: { ...process.env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
        writeAdminAuditLog('server_tools_completed', audit, {
          toolId,
          command,
          exitCode: code,
          stderrLength: stderr.length,
        });

        if (code === 0) {
          resolvePromise(NextResponse.json({
            success: true,
            output,
            message: 'Tool executed successfully',
          }));
        } else {
          resolvePromise(NextResponse.json({
            success: false,
            output,
            error: `Tool exited with code ${code}`,
          }, { status: 500 }));
        }
      });

      proc.on('error', (error) => {
        writeAdminAuditLog('server_tools_failed_to_start', audit, {
          toolId,
          command,
          error: error.message,
        });
        resolvePromise(NextResponse.json({
          success: false,
          error: `Failed to start tool: ${error.message}`,
          output: stderr,
        }, { status: 500 }));
      });
    });

  } catch (error: unknown) {
    const audit = getAdminAuditContext(request);
    writeAdminAuditLog('server_tools_handler_error', audit, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
    console.error('[API /api/admin/server-tools/run] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

