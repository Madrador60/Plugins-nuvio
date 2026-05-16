const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

function boolEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function intEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  ROOT,
  HOST: process.env.HOST || "0.0.0.0",
  PORT: intEnv("PORT", 7000),
  NODE_ENV: process.env.NODE_ENV || "development",
  TMDB_API_KEY: process.env.TMDB_API_KEY || "",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
  ENABLE_ADMIN: boolEnv("ENABLE_ADMIN", false),
  ENABLE_PROVIDER_TESTS: boolEnv("ENABLE_PROVIDER_TESTS", true),
  CACHE_TTL_MINUTES: intEnv("CACHE_TTL_MINUTES", 30),
  PROVIDER_TIMEOUT_MS: intEnv("PROVIDER_TIMEOUT_MS", 45000)
};
