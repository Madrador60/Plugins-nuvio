#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../manifest.json");
const statusService = require("../src/services/provider-status.service");

const ROOT = path.resolve(__dirname, "..");
const reportPath = path.join(ROOT, "data", "reports", "providers-report.json");
const statuses = statusService.getProviderStatuses();
const report = {
  generatedAt: new Date().toISOString(),
  providers: manifest.scrapers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled !== false,
    filename: provider.filename,
    status: statuses[provider.id] || null
  }))
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Rapport providers genere: ${path.relative(ROOT, reportPath)}`);
