export function isServerToolsEnabled(): boolean {
  return process.env.ENABLE_SERVER_TOOLS === "1";
}
