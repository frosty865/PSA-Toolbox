/* eslint-disable no-console */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function ok(msg) {
  console.log(msg);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sortKeys(obj) {
  return Object.keys(obj).slice().sort();
}

function sameArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function hasForbiddenFragments(keys, fragments) {
  const lower = keys.map((k) => String(k).toLowerCase());
  const frags = (fragments || []).map((f) => String(f).toLowerCase());
  const hits = [];
  for (const k of lower) {
    for (const f of frags) {
      if (k.includes(f)) hits.push({ key: k, fragment: f });
    }
  }
  return hits;
}

function invokeRouteViaTsx() {
  const script = path.join(process.cwd(), "scripts", "guards", "_invokeRuntimeQuestionsRoute.mts");
  if (!fs.existsSync(script)) {
    throw new Error("_invokeRuntimeQuestionsRoute.mts not found");
  }
  const tmpFile = path.join(os.tmpdir(), "psa_runtime_questions_guard_" + process.pid + ".json");
  const env = { ...process.env, GUARD_OUTPUT_FILE: tmpFile };
  try {
    execSync(`npx tsx "${script}"`, {
      encoding: "utf8",
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      env,
    });
    const raw = fs.readFileSync(tmpFile, "utf8");
    if (!raw || !raw.trim()) throw new Error("Invoker produced empty output");
    return JSON.parse(raw);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

function main() {
  const fixturePath = path.join(process.cwd(), "scripts", "fixtures", "runtime_questions_shape.json");
  if (!fs.existsSync(fixturePath)) {
    die(`[GUARD] Missing fixture: ${fixturePath}`);
  }

  const fixture = readJson(fixturePath);
  const allowed = (fixture.allowed_keys_sorted || []).slice().sort();
  if (!allowed.length) die("[GUARD] Fixture has no allowed_keys_sorted");

  const forbiddenFragments = fixture?.rules?.forbidden_key_fragments_case_insensitive || [];

  let data;
  try {
    data = invokeRouteViaTsx();
  } catch (e) {
    die(
      `[GUARD] Failed to invoke /api/runtime/questions via _invokeRuntimeQuestionsRoute.mts.\n` +
        `Reason: ${e && e.message ? e.message : String(e)}\n` +
        `Fix: ensure app/api/runtime/questions/route.ts exists, exports GET(), and npx tsx can run the invoker.`
    );
  }

  const list = data?.questions;
  if (!Array.isArray(list)) {
    const hint = data?.message ? ` Route error: ${data.message}` : ` Got: ${list === undefined ? "undefined" : typeof list}`;
    die(
      `[GUARD] /api/runtime/questions response.questions is not an array.${hint}\n` +
        `Ensure RUNTIME_DATABASE_URL is set (e.g. via .env) when running this guard.`
    );
  }
  if (list.length < 1) {
    die("[GUARD] /api/runtime/questions returned an empty questions array; cannot validate shape.");
  }

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      die(`[GUARD] questions[${i}] is not an object.`);
    }

    const keys = sortKeys(item);

    const hits = hasForbiddenFragments(keys, forbiddenFragments);
    if (hits.length) {
      die(
        `[GUARD] Forbidden key fragments detected in questions[${i}]. ` +
          `Hits: ${hits.map((h) => `${h.key}~${h.fragment}`).join(", ")}`
      );
    }

    if (!sameArray(keys, allowed)) {
      const missing = allowed.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !allowed.includes(k));
      die(
        `[GUARD] Runtime questions DTO shape drift detected at questions[${i}].\n` +
          `Missing keys: ${missing.length ? missing.join(", ") : "(none)"}\n` +
          `Extra keys: ${extra.length ? extra.join(", ") : "(none)"}\n` +
          `Allowed keys: ${allowed.join(", ")}\n` +
          `Actual keys: ${keys.join(", ")}`
      );
    }
  }

  ok("[OK] /api/runtime/questions DTO shape matches the frozen allowed key set.");
}

main();
