const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

const TIMEOUT_ARG = Number((process.argv.find((arg) => arg.startsWith("--timeout=")) || "").slice("--timeout=".length) || 0);
const DEFAULT_TIMEOUT_MS = TIMEOUT_ARG || Number(process.env.PROVIDER_TIMEOUT_MS || 30000);
const ONLY = (process.argv.find((arg) => arg.startsWith("--only=")) || "").slice("--only=".length);
const LIMIT = Number((process.argv.find((arg) => arg.startsWith("--limit=")) || "").slice("--limit=".length) || 0);
const WORKER = (process.argv.find((arg) => arg.startsWith("--worker=")) || "").slice("--worker=".length);
const VERBOSE = process.argv.includes("--verbose");

const animeProviders = new Set([
  "anime-sama",
  "voiranime",
  "vostfree",
  "animoflix",
  "french-anime",
  "animevostfr",
  "animesultra",
  "jetanimes",
  "sekai",
  "mugiwarastream",
  "animesite"
]);

const testCases = {
  anime: {
    tmdbId: "37854",
    mediaType: "tv",
    season: 1,
    episode: 1,
    label: "One Piece S1E1"
  },
  movie: {
    tmdbId: "157336",
    mediaType: "movie",
    season: undefined,
    episode: undefined,
    label: "Interstellar"
  }
};

const originalFetch = global.fetch;
if (typeof originalFetch === "function") {
  global.fetch = function fetchWithDefaultTimeout(url, options) {
    options = options || {};
    if (options.signal) return originalFetch(url, options);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    return originalFetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  };
}

function streamCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function statusFromResult(result) {
  if (result.error) return "ERROR";
  return result.streams > 0 ? "OK" : "ZERO";
}

function formatError(error) {
  if (!error) return "";
  return String(error.message || error).replace(/\s+/g, " ").slice(0, 180);
}

function pickCase(provider) {
  if (animeProviders.has(provider.id)) return testCases.anime;
  return testCases.movie;
}

function callProvider(provider, testCase) {
  const providerPath = path.join(ROOT, provider.filename);
  delete require.cache[require.resolve(providerPath)];
  const mod = require(providerPath);
  if (!mod || typeof mod.getStreams !== "function") {
    throw new Error("Missing getStreams export");
  }
  return Promise.resolve(mod.getStreams(
    testCase.tmdbId,
    testCase.mediaType,
    testCase.season,
    testCase.episode
  ));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Provider timed out after " + ms + "ms")), ms);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

async function testProviderInProcess(provider) {
  const testCase = pickCase(provider);
  const started = Date.now();

  try {
    const streams = await withTimeout(callProvider(provider, testCase), DEFAULT_TIMEOUT_MS + 5000);
    return {
      id: provider.id,
      name: provider.name,
      case: testCase.label,
      streams: streamCount(streams),
      ms: Date.now() - started,
      error: ""
    };
  } catch (error) {
    return {
      id: provider.id,
      name: provider.name,
      case: testCase.label,
      streams: 0,
      ms: Date.now() - started,
      error: formatError(error)
    };
  }
}

function runWorker(provider) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [__filename, "--worker=" + provider.id], {
      cwd: ROOT,
      env: { ...process.env, PROVIDER_TIMEOUT_MS: String(DEFAULT_TIMEOUT_MS) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGKILL");
      resolve({
        id: provider.id,
        name: provider.name,
        case: pickCase(provider).label,
        streams: 0,
        ms: Date.now() - started,
        error: "Provider timed out after " + DEFAULT_TIMEOUT_MS + "ms"
      });
    }, DEFAULT_TIMEOUT_MS + 5000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      const marker = stdout.trim().split(/\r?\n/).reverse().find((line) => line.startsWith("__RESULT__"));
      if (marker) {
        try {
          const result = JSON.parse(marker.slice("__RESULT__".length));
          if (VERBOSE && stdout) process.stdout.write(stdout.replace(marker, ""));
          if (VERBOSE && stderr) process.stderr.write(stderr);
          resolve(result);
          return;
        } catch (error) {
          // Fall through to generic error.
        }
      }

      resolve({
        id: provider.id,
        name: provider.name,
        case: pickCase(provider).label,
        streams: 0,
        ms: Date.now() - started,
        error: formatError(stderr || stdout || "Worker exited without result")
      });
    });
  });
}

function printTable(results) {
  console.log("| Status | Provider | Test | Streams | Time | Notes |");
  console.log("|---|---|---|---:|---:|---|");
  for (const result of results) {
    console.log([
      statusFromResult(result),
      result.id,
      result.case,
      String(result.streams),
      result.ms + "ms",
      result.error || ""
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
}

async function main() {
  if (WORKER) {
    const provider = manifest.scrapers.find((item) => item.id === WORKER);
    if (!provider) throw new Error("Unknown provider: " + WORKER);
    const result = await testProviderInProcess(provider);
    console.log("__RESULT__" + JSON.stringify(result));
    return;
  }

  let providers = manifest.scrapers.filter((provider) => provider.enabled !== false);
  if (ONLY) {
    const wanted = new Set(ONLY.split(",").map((item) => item.trim()).filter(Boolean));
    providers = providers.filter((provider) => wanted.has(provider.id));
  }
  if (LIMIT > 0) providers = providers.slice(0, LIMIT);

  console.log("Testing " + providers.length + " provider(s)");
  console.log("Timeout: " + DEFAULT_TIMEOUT_MS + "ms");
  console.log("");

  const results = [];
  for (const provider of providers) {
    process.stdout.write("Testing " + provider.id + "... ");
    const result = await runWorker(provider);
    results.push(result);
    console.log(statusFromResult(result) + " (" + result.streams + " stream(s), " + result.ms + "ms)");
  }

  console.log("");
  printTable(results);

  const ok = results.filter((result) => statusFromResult(result) === "OK").length;
  const zero = results.filter((result) => statusFromResult(result) === "ZERO").length;
  const errors = results.filter((result) => statusFromResult(result) === "ERROR").length;
  console.log("");
  console.log("Summary: OK=" + ok + " ZERO=" + zero + " ERROR=" + errors);

  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
