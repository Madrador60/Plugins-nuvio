const fs = require("node:fs");
const path = require("node:path");
const fetchWithTimeout = require("../utils/fetchWithTimeout");
const { ROOT } = require("../config/env");
const { asUrl } = require("../utils/sanitize");

const DOMAINS_FILE = path.join(ROOT, "domains.json");
const STATUS_FILE = path.join(ROOT, "data", "domains-status.json");
const REPORT_FILE = path.join(ROOT, "data", "reports", "domains-report.json");
const DNS_TYPES = ["A", "AAAA", "CNAME"];

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
      candidates: (Array.isArray(value.candidates) ? value.candidates : []).map(asUrl).filter(Boolean),
      lastChecked: value.lastChecked || null,
      status: value.status || "unknown",
      activeDomain: value.activeDomain || null
    };
  }
  return output;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function resolveCloudflare(hostname, timeoutMs = 5000) {
  const cleanHost = String(hostname || "").replace(/^www\./, "");
  if (!cleanHost) return { ok: false, records: [], error: "Invalid hostname" };
  const records = [];
  const errors = [];
  for (const type of DNS_TYPES) {
    try {
      const endpoint = "https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(cleanHost) + "&type=" + type;
      const response = await fetchWithTimeout(endpoint, {
        timeoutMs,
        headers: {
          accept: "application/dns-json",
          "user-agent": "MadradorFilm/3.0 domain-dns-check"
        }
      });
      if (!response.ok) {
        errors.push(type + ": HTTP " + response.status);
        continue;
      }
      const data = await response.json();
      if (Array.isArray(data.Answer)) {
        data.Answer.forEach((answer) => {
          if (answer && answer.data) records.push({ type, value: answer.data, ttl: answer.TTL || 0 });
        });
      }
    } catch (error) {
      errors.push(type + ": " + error.message);
    }
  }
  return {
    ok: records.length > 0,
    provider: "cloudflare-dns",
    hostname: cleanHost,
    records,
    error: records.length ? null : errors.join(" | ") || "No DNS record"
  };
}

async function testDomain(url, timeoutMs = 10000) {
  const started = Date.now();
  const hostname = hostnameFromUrl(url);
  const dns = await resolveCloudflare(hostname, Math.min(timeoutMs, 5000));
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
      hostname,
      dns,
      error: null
    };
  } catch (error) {
    return {
      url,
      ok: false,
      statusCode: 0,
      responseTime: Date.now() - started,
      hostname,
      dns,
      error: error.message
    };
  }
}

async function checkDomains(options = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const shouldWriteDomains = options.writeDomains !== false;
  const source = normalizeDomains(readJson(DOMAINS_FILE, {}));
  const status = {};
  for (const [provider, entry] of Object.entries(source)) {
    const tests = [];
    const candidates = Array.from(new Set([...(entry.domains || []), ...(entry.candidates || [])]));
    for (const domain of candidates) {
      tests.push(await testDomain(domain, timeoutMs));
    }
    const working = tests.filter((test) => test.ok).sort((a, b) => a.responseTime - b.responseTime);
    const dnsOnly = tests.filter((test) => !test.ok && test.dns && test.dns.ok).sort((a, b) => a.responseTime - b.responseTime);
    const activeDomain = working[0] ? working[0].url : dnsOnly[0] ? dnsOnly[0].url : null;
    status[provider] = {
      status: working.length ? "working" : "down",
      activeDomain,
      dnsWorking: tests.filter((test) => test.dns && test.dns.ok).length,
      httpWorking: working.length,
      lastChecked: new Date().toISOString(),
      domains: tests
    };
    source[provider] = Object.assign({}, entry, {
      domains: activeDomain
        ? [activeDomain].concat(candidates.filter((domain) => domain !== activeDomain))
        : candidates,
      activeDomain,
      lastChecked: status[provider].lastChecked,
      status: status[provider].status
    });
  }
  writeJson(STATUS_FILE, status);
  writeJson(REPORT_FILE, status);
  if (shouldWriteDomains) writeJson(DOMAINS_FILE, source);
  return status;
}

function getDomainStatus() {
  return readJson(STATUS_FILE, {});
}

module.exports = { normalizeDomains, checkDomains, testDomain, resolveCloudflare, getDomainStatus };
