#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const targets = [
  "site/server.js",
  "src/server/app.js",
  "scripts/test-providers.js",
  "scripts/test-routes.js",
  "scripts/check-domains.js",
  "scripts/update-manifest.js"
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") ? [path.relative(ROOT, full)] : [];
  });
}

for (const file of [...targets, ...walk(path.join(ROOT, "src"))]) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log("Syntaxe JS OK.");
