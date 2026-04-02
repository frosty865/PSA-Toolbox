async function assertPageComponent(pagePath: string): Promise<void> {
  const mod = await import(pagePath);
  if (typeof mod.default !== "function") {
    throw new Error(`Page ${pagePath} missing default component export`);
  }
}

async function main(): Promise<void> {
  await assertPageComponent("../../app/reference/sectors/page.tsx");
  await assertPageComponent("../../app/reference/disciplines/page.tsx");
  await assertPageComponent("../../app/reference/question-focus/page.tsx");
  console.log("[test:pages-smoke] Page export smoke checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:pages-smoke] Failed: ${message}`);
  process.exit(1);
});
