/**
 * One-off runner: imports GET from app/api/runtime/questions/route, invokes it, prints JSON to stdout.
 * Used by verifyRuntimeQuestionsShape.js. Run with: npx tsx scripts/guards/_invokeRuntimeQuestionsRoute.mts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const routePath = path.join(process.cwd(), "app", "api", "runtime", "questions", "route.ts");
const mod = await import(pathToFileURL(routePath).href);
if (!mod || typeof mod.GET !== "function") {
  console.error("[_invoke] Route did not export GET");
  process.exit(1);
}
const req = new Request("http://localhost/api/runtime/questions", { method: "GET" });
const res = await mod.GET(req);
if (!res || typeof res.json !== "function") {
  console.error("[_invoke] GET did not return Response-like with .json()");
  process.exit(1);
}
const data = await res.json();
const out = process.env.GUARD_OUTPUT_FILE;
if (out) {
  fs.writeFileSync(out, JSON.stringify(data));
} else {
  process.stdout.write(JSON.stringify(data));
}
