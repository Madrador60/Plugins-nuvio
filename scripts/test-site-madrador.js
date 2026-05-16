#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const REPORT = path.join(ROOT, "data", "reports", "site-madrador-report.json");
const PORT = Number(process.env.TEST_SITE_PORT || 7328);
const BASE = `http://127.0.0.1:${PORT}`;

const checks = [
  { name: "home page", url: "/", expects: ["Madrador Film", "/catalog", "/manifest.json", "/site-madrador/assets/js/catalog.js"] },
  { name: "site-madrador direct", url: "/site-madrador/", expects: ["Madrador Film", "/catalog", "/site-madrador/assets/css/style.css"] },
  { name: "catalog page", url: "/catalog", expects: ["Catalogue", "catalogSearch", "/site-madrador/assets/js/catalog.js", "/site-madrador/assets/js/search.js"] },
  { name: "details page", url: "/details?type=movie&id=157336", expects: ["detailsRoot", "/site-madrador/assets/js/details.js"] },
  { name: "player page", url: "/player?type=movie&id=157336&title=Interstellar", expects: ["sourceList", "/site-madrador/assets/js/player.js"] },
  { name: "providers page", url: "/providers", expects: ["providersGrid", "/site-madrador/assets/js/providers.js", "Tester tous"] },
  { name: "admin page", url: "/admin", expects: ["ADMIN_TOKEN", "/site-madrador/assets/js/admin.js"] },
  { name: "legal page", url: "/legal", expects: ["ne stocke aucune video"] },
  { name: "dmca page", url: "/dmca", expects: ["Retrait de contenu"] },
  { name: "security page", url: "/security", expects: ["Securite"] },
  { name: "css asset", url: "/site-madrador/assets/css/style.css", expects: ["--cyan", ".poster-card"] },
  { name: "app js asset", url: "/site-madrador/assets/js/app.js", expects: ["window.Madrador", "getJson"] },
  { name: "catalog js integration", url: "/site-madrador/assets/js/catalog.js", expects: ["/catalog.json", "MadradorSearch.runSearch"] },
  { name: "search js integration", url: "/site-madrador/assets/js/search.js", expects: ["/search.json"] },
  { name: "details js integration", url: "/site-madrador/assets/js/details.js", expects: ["/details.json", "Madrador.playerUrl"] },
  { name: "player js integration", url: "/site-madrador/assets/js/player.js", expects: ["/stream/", "Hls"] },
  { name: "providers js integration", url: "/site-madrador/assets/js/providers.js", expects: ["/providers.json", "/providers/status.json", "/diagnostics.json"] },
  { name: "admin js integration", url: "/site-madrador/assets/js/admin.js", expects: ["/health", "/providers.json", "x-admin-token"] },
  { name: "catalog api", url: "/catalog.json", json: true, validate: (data) => Array.isArray(data.rows) && data.rows.length > 0 },
  { name: "search api", url: "/search.json?type=movie&q=Interstellar", json: true, validate: (data) => Array.isArray(data.results) },
  { name: "details api", url: "/details.json?type=movie&id=157336", json: true, validate: (data) => Boolean(data.id && data.title) },
  { name: "providers api", url: "/providers.json", json: true, validate: (data) => Array.isArray(data.all) && data.all.length > 0 },
  { name: "provider status api", url: "/providers/status.json", json: true, validate: (data) => data.success === true && typeof data.statuses === "object" },
  { name: "health api", url: "/health", json: true, validate: (data) => data.ok === true }
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error("Server did not start");
}

async function runCheck(check) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${check.url}`);
    const contentType = response.headers.get("content-type") || "";
    if (check.json) {
      const data = await response.json();
      const valid = typeof check.validate === "function" ? check.validate(data) : true;
      return {
        name: check.name,
        url: check.url,
        ok: response.ok && valid,
        status: response.status,
        type: contentType,
        timeMs: Date.now() - started
      };
    }
    const text = await response.text();
    const missing = (check.expects || []).filter((needle) => !text.includes(needle));
    return {
      name: check.name,
      url: check.url,
      ok: response.ok && missing.length === 0,
      status: response.status,
      type: contentType,
      missing,
      timeMs: Date.now() - started
    };
  } catch (error) {
    return {
      name: check.name,
      url: check.url,
      ok: false,
      status: 0,
      error: error.message,
      timeMs: Date.now() - started
    };
  }
}

(async () => {
  const child = spawn(process.execPath, ["site/server.js"], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      TMDB_API_KEY: process.env.TMDB_API_KEY || ""
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await waitForServer();
    const results = [];
    for (const check of checks) results.push(await runCheck(check));
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.table(results.map((result) => ({
      name: result.name,
      ok: result.ok,
      status: result.status,
      timeMs: result.timeMs,
      missing: result.missing && result.missing.length ? result.missing.join(", ") : ""
    })));
    if (results.some((result) => !result.ok)) {
      process.exitCode = 1;
      if (stderr.length) process.stderr.write(stderr.join(""));
    }
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
