const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("../config/env");
const { PROVIDER_STATUS } = require("../config/constants");

const STATUS_FILE = path.join(ROOT, "data", "provider-status.json");

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

function classify(result) {
  const error = String(result.error || "");
  if (result.disabled) return PROVIDER_STATUS.DISABLED;
  if (/timeout|timed out|aborted/i.test(error)) return PROVIDER_STATUS.TIMEOUT;
  if (error) return PROVIDER_STATUS.ERROR;
  if (!Number(result.streams || 0)) return PROVIDER_STATUS.ZERO_RESULT;
  if (Number(result.timeMs || 0) > 15000) return PROVIDER_STATUS.LENT;
  return PROVIDER_STATUS.OK;
}

function deltaFor(status, result, previous) {
  let delta = 0;
  const streams = Number(result.streams || 0);
  const timeMs = Number(result.timeMs || 0);
  if (streams > 0) delta += 10;
  if (timeMs > 0 && timeMs < 5000) delta += 5;
  if (streams > 1) delta += 3;
  if (status === PROVIDER_STATUS.ZERO_RESULT) delta -= 5;
  if (status === PROVIDER_STATUS.TIMEOUT || status === PROVIDER_STATUS.ERROR) delta -= 10;
  if ((previous.failCount || 0) >= 3 && status !== PROVIDER_STATUS.OK) delta -= 20;
  return delta;
}

function updateProviderStatus(providerId, result) {
  const all = readJson(STATUS_FILE, {});
  const previous = all[providerId] || { score: 70, successCount: 0, failCount: 0 };
  const status = result.status && result.status !== "ZERO" ? result.status : classify(result);
  const success = [PROVIDER_STATUS.OK, PROVIDER_STATUS.LENT].includes(status);
  const score = Math.max(0, Math.min(100, Number(previous.score || 70) + deltaFor(status, result, previous)));
  all[providerId] = {
    status,
    score,
    lastTested: new Date().toISOString(),
    responseTime: Number(result.timeMs || 0),
    lastError: result.error || null,
    successCount: Number(previous.successCount || 0) + (success ? 1 : 0),
    failCount: Number(previous.failCount || 0) + (success ? 0 : 1)
  };
  writeJson(STATUS_FILE, all);
  return all[providerId];
}

function getProviderStatuses() {
  return readJson(STATUS_FILE, {});
}

module.exports = { getProviderStatuses, updateProviderStatus, classify };
