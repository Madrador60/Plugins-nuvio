#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const REPORT = path.join(ROOT, "data", "reports", "routes-report.json");
const PORT = Number(process.env.TEST_PORT || 7317);
const BASE = `http://127.0.0.1:${PORT}`;

const routes = [
  "/health",
  "/health.json",
  "/config.json",
  "/providers",
  "/providers.json",
  "/providers/status.json",
  "/catalog.json",
  "/search.json?type=movie&q=Interstellar",
  "/details.json?type=movie&id=157336",
  "/legal",
  "/security"
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${BASE}/health.json`);
      if (response.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error("Server did not start");
}

async function testRoute(route) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${route}`);
    return {
      route,
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
      timeMs: Date.now() - started
    };
  } catch (error) {
    return { route, ok: false, status: 0, timeMs: Date.now() - started, error: error.message };
  }
}

(async () => {
  const child = spawn(process.execPath, ["site/server.js"], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: "127.0.0.1", NODE_ENV: "test" }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();
    const results = [];
    for (const route of routes) results.push(await testRoute(route));
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.table(results);
    if (results.some((item) => !item.ok)) process.exitCode = 1;
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
