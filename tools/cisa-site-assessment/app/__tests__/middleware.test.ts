import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
  ADMIN_API_TOKEN_LABEL: process.env.ADMIN_API_TOKEN_LABEL,
};

function setEnv(name: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[name];
    return;
  }
  env[name] = value;
}

function restoreEnv() {
  setEnv("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
  setEnv("ADMIN_API_TOKEN", ORIGINAL_ENV.ADMIN_API_TOKEN);
  setEnv("ADMIN_API_TOKEN_LABEL", ORIGINAL_ENV.ADMIN_API_TOKEN_LABEL);
}

test.afterEach(() => {
  restoreEnv();
});

test("proxy rejects admin requests without a valid token when configured", () => {
  setEnv("NODE_ENV", "production");
  setEnv("ADMIN_API_TOKEN", "secret-token");
  setEnv("ADMIN_API_TOKEN_LABEL", "ops-admin");

  const request = new NextRequest("https://example.com/api/admin/source-registry", {
    method: "POST",
  });

  const response = proxy(request);

  assert.equal(response.status, 401);
});

test("proxy allows configured admin token", () => {
  setEnv("NODE_ENV", "production");
  setEnv("ADMIN_API_TOKEN", "secret-token");
  setEnv("ADMIN_API_TOKEN_LABEL", "ops-admin");

  const request = new NextRequest("https://example.com/api/admin/source-registry", {
    method: "POST",
    headers: {
      "x-admin-api-token": "secret-token",
    },
  });

  const response = proxy(request);

  assert.equal(response.status, 200);
});

test("proxy allows local development without a token", () => {
  setEnv("NODE_ENV", "development");
  setEnv("ADMIN_API_TOKEN", undefined);
  setEnv("ADMIN_API_TOKEN_LABEL", undefined);

  const request = new NextRequest("http://localhost:3000/api/admin/source-registry", {
    method: "POST",
  });

  const response = proxy(request);

  assert.equal(response.status, 200);
});
