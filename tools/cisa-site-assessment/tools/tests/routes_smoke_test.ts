async function assertRouteExports(
  routePath: string,
  expected: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">
): Promise<void> {
  const mod = await import(routePath);
  for (const method of expected) {
    if (typeof mod[method] !== "function") {
      throw new Error(`Route ${routePath} missing ${method} export`);
    }
  }
}

async function main(): Promise<void> {
  await assertRouteExports(
    "../../app/api/runtime/assessments/route.ts",
    ["GET", "POST"]
  );
  await assertRouteExports(
    "../../app/api/runtime/assessments/[assessmentId]/questions/route.ts",
    ["GET"]
  );
  await assertRouteExports(
    "../../app/api/admin/modules/[moduleCode]/standard/generate/route.ts",
    ["POST"]
  );
  console.log("[test:routes-smoke] Route export smoke checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:routes-smoke] Failed: ${message}`);
  process.exit(1);
});

