import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getAdminAuditContext } from "@/app/lib/admin/audit";

test("getAdminAuditContext reads actor metadata from middleware headers", () => {
  const request = new NextRequest("http://localhost:3000/api/admin/source-registry", {
    method: "POST",
    headers: {
      "x-admin-actor": "ops-admin",
      "x-admin-auth-mode": "token",
      "x-admin-request-id": "req-123",
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "node-test",
    },
  });

  const context = getAdminAuditContext(request);

  assert.equal(context.actor, "ops-admin");
  assert.equal(context.authMode, "token");
  assert.equal(context.requestId, "req-123");
  assert.equal(context.path, "/api/admin/source-registry");
  assert.equal(context.method, "POST");
  assert.equal(context.ip, "127.0.0.1");
  assert.equal(context.userAgent, "node-test");
});
