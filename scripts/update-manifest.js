#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const providersDir = path.join(ROOT, "providers");
const manifestFile = path.join(ROOT, "manifest.json");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") && entry.name !== "index.js" ? [full] : [];
  });
}

function titleFromId(id) {
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const known = new Set(manifest.scrapers.map((provider) => provider.filename));
let changes = 0;

for (const file of walk(providersDir)) {
  const filename = path.relative(ROOT, file).replace(/\\/g, "/");
  if (known.has(filename)) continue;
  const id = path.basename(file, ".js");
  const disabled = filename.includes("/disabled/");
  manifest.scrapers.push({
    id,
    name: titleFromId(id),
    description: disabled
      ? `Provider ${titleFromId(id)} archive/desactive.`
      : `Provider ${titleFromId(id)} ajoute automatiquement.`,
    version: "1.0.0",
    author: "Madrador60",
    supportedTypes: ["movie", "tv"],
    filename,
    enabled: !disabled,
    formats: ["mp4", "m3u8"],
    contentLanguage: ["fr"],
    limited: disabled
  });
  changes += 1;
}

manifest.scrapers.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(changes ? `Manifest mis a jour: ${changes} provider(s) ajoute(s).` : "Manifest deja a jour.");
