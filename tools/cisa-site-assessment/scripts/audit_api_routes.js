#!/usr/bin/env node
/**
 * One-off: audit app/api routes and export path + inferred HTTP methods.
 * Output: JSON to stdout.
 */
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const cwd = process.cwd();
const files = globSync("app/api/**/route.ts", { cwd });
const routes = [];

for (const f of files) {
  const normalized = f.replace(/\\/g, "/");
  const routePath = "/api/" + normalized.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
  const fullPath = path.join(cwd, f);
  let content = "";
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch (_) {}
  const methods = [];
  if (/\bexport\s+(async\s+)?function\s+GET\b/.test(content)) methods.push("GET");
  if (/\bexport\s+(async\s+)?function\s+POST\b/.test(content)) methods.push("POST");
  if (/\bexport\s+(async\s+)?function\s+PUT\b/.test(content)) methods.push("PUT");
  if (/\bexport\s+(async\s+)?function\s+PATCH\b/.test(content)) methods.push("PATCH");
  if (/\bexport\s+(async\s+)?function\s+DELETE\b/.test(content)) methods.push("DELETE");
  routes.push({ path: routePath, methods: methods.length ? methods.join(",") : "?" });
}

routes.sort((a, b) => a.path.localeCompare(b.path));

const byPrefix = {};
for (const r of routes) {
  const parts = r.path.split("/").filter(Boolean);
  const prefix = "/" + parts.slice(0, Math.min(4, parts.length)).join("/");
  if (!byPrefix[prefix]) byPrefix[prefix] = [];
  byPrefix[prefix].push(r);
}

console.log(JSON.stringify({ total: routes.length, byPrefix, routes }, null, 2));
