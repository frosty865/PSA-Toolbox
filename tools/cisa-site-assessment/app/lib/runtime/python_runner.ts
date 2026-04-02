import "server-only";

export type PythonRunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export async function runPython(
  pythonExe: string,
  args: string[],
  opts: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs?: number;
  }
): Promise<PythonRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional spawn
  const { spawn } = require("child_process") as typeof import("child_process");

  const timeoutMs = Number(opts.timeoutMs ?? 8000);
  return await new Promise((resolve) => {
    const proc = spawn(pythonExe, args, {
      cwd: opts.cwd,
      env: opts.env,
      windowsHide: true,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    let finished = false;

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (finished) return;
            finished = true;
            try {
              proc.kill();
            } catch {
              /* noop */
            }
            resolve({
              ok: false,
              code: null,
              stdout: Buffer.concat(out).toString("utf-8"),
              stderr: Buffer.concat(err).toString("utf-8"),
              error: `Python timed out after ${timeoutMs}ms`,
            });
          }, timeoutMs)
        : null;

    proc.stdout?.on("data", (d: Buffer) => out.push(d));
    proc.stderr?.on("data", (d: Buffer) => err.push(d));

    proc.on("error", (e: Error) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        stdout: Buffer.concat(out).toString("utf-8"),
        stderr: Buffer.concat(err).toString("utf-8"),
        error: String(e?.message ?? e),
      });
    });

    proc.on("close", (code: number) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      const stdout = Buffer.concat(out).toString("utf-8");
      const stderr = Buffer.concat(err).toString("utf-8");
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        error: code === 0 ? undefined : `Python exited with code ${code}`,
      });
    });
  });
}
