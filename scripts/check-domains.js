#!/usr/bin/env node
const domainService = require("../src/services/domain.service");

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

(async () => {
  const timeoutMs = Number(argValue("timeout", 10000));
  const report = await domainService.checkDomains({ timeoutMs });
  const rows = Object.entries(report).map(([provider, item]) => ({
    provider,
    status: item.status,
    active: item.activeDomain || "-",
    checked: item.domains.length
  }));
  console.table(rows);
  const down = rows.filter((row) => row.status !== "working");
  if (down.length) {
    console.warn(`${down.length} provider(s) sans domaine actif. Rapport: data/reports/domains-report.json`);
  } else {
    console.log("Tous les domaines testes ont au moins une URL active.");
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
