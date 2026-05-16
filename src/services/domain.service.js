const fs = require("node:fs");
const path = require("node:path");
const fetchWithTimeout = require("../utils/fetchWithTimeout");
const { ROOT } = require("../config/env");
const { asUrl } = require("../utils/sanitize");

const DOMAINS_FILE = path.join(ROOT, "domains.json");
const STATUS_FILE = path.join(ROOT, "data", "domains-status.json");
const REPORT_FILE = path.join(ROOT, "data", "reports", "domains-report.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeDomains(input) {
  const output = {};
  for (const [provider, value] of Object.entries(input || {})) {
    const domains = Array.isArray(value) ? value : value.domains;
    output[provider] = {
      domains: (domains || []).map(asUrl).filter(Boolean),
      lastChecked: value.lastChecked || null,
      status: value.status || "unknown"
    };
  }
  return output;
}

async function testDomain(url, timeoutMs = 10000) {
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "follow",
      timeoutMs,
      headers: { "user-agent": "MadradorFilm/2.0 domain-check" }
    });
    return {
      url,
      ok: response.status < 500,
      statusCode: response.status,
      responseTime: Date.now() - started,
      error: null
    };
  } catch (error) {
    return {
      url,
      ok: false,
      statusCode: 0,
      responseTime: Date.now() - started,
      error: error.message
    };
  }
}

async function checkDomains(options = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const source = normalizeDomains(readJson(DOMAINS_FILE, {}));
  const status = {};
  for (const [provider, entry] of Object.entries(source)) {
    const tests = [];
    for (const domain of entry.domains) {
      tests.push(await testDomain(domain, timeoutMs));
    }
    const working = tests.filter((test) => test.ok).sort((a, b) => a.responseTime - b.responseTime);
    status[provider] = {
      status: working.length ? "working" : "down",
      activeDomain: working[0] ? working[0].url : null,
      lastChecked: new Date().toISOString(),
      domains: tests
    };
  }
  writeJson(STATUS_FILE, status);
  writeJson(REPORT_FILE, status);
  return status;
}

module.exports = { normalizeDomains, checkDomains, testDomain };
