const path = require("node:path");
const manifest = require("../manifest.json");

const ROOT = path.resolve(__dirname, "..");

function getProviders(options = {}) {
  const includeDisabled = Boolean(options.includeDisabled);
  return manifest.scrapers.filter((provider) => includeDisabled || provider.enabled !== false);
}

function loadProvider(providerOrId) {
  const provider = typeof providerOrId === "string"
    ? manifest.scrapers.find((item) => item.id === providerOrId)
    : providerOrId;
  if (!provider) return null;
  if (provider.enabled === false) return null;
  const filePath = path.join(ROOT, provider.filename);
  delete require.cache[require.resolve(filePath)];
  return require(filePath);
}

async function testProvider(providerId, request, timeoutMs = 45000) {
  const provider = manifest.scrapers.find((item) => item.id === providerId);
  if (!provider) {
    return { provider: providerId, status: "ERROR", streams: [], error: "Unknown provider" };
  }
  if (provider.enabled === false) {
    return { provider: providerId, status: "DISABLED", streams: [], error: "Provider disabled" };
  }
  const started = Date.now();
  try {
    const mod = loadProvider(provider);
    if (!mod || typeof mod.getStreams !== "function") throw new Error("Missing getStreams");
    const result = await Promise.race([
      mod.getStreams(request.tmdbId || "157336", request.type || "movie", request.season, request.episode),
      new Promise((resolve) => setTimeout(() => resolve({ streams: [], error: new Error("Provider timeout") }), timeoutMs))
    ]);
    const streams = Array.isArray(result.streams) ? result.streams : [];
    return {
      provider: provider.id,
      status: streams.length ? "OK" : result.error ? "ERROR" : "ZERO_RESULT",
      streams,
      timeMs: Date.now() - started,
      error: result.error ? result.error.message : null
    };
  } catch (error) {
    return {
      provider: provider.id,
      status: "ERROR",
      streams: [],
      timeMs: Date.now() - started,
      error: error.message
    };
  }
}

module.exports = { getProviders, loadProvider, testProvider };
