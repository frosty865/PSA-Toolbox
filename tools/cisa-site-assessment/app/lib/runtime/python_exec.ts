import "server-only";

export function getPythonExe(): string {
  return (process.env.PYTHON_EXE?.trim() || process.env.PYTHON?.trim() || "python");
}
