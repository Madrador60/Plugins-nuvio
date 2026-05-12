const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const nuvioManifest = require(path.join(ROOT, "manifest.json"));
const stremioManifest = require("./manifest.json");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 7000);
const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45000);
const PROVIDER_FILTER = (process.env.STREMIO_PROVIDERS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*"
  });
  res.end(JSON.stringify(payload));
}

function parseStreamPath(pathname) {
  const match = pathname.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
  if (!match) return null;

  const stremioType = decodeURIComponent(match[1]);
  const rawId = decodeURIComponent(match[2]);
  const parts = rawId.split(":");

  return {
    imdbId: parts[0],
    mediaType: stremioType === "series" ? "tv" : "movie",
    season: parts[1] ? Number(parts[1]) : undefined,
    episode: parts[2] ? Number(parts[2]) : undefined
  };
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: new Error(label + " timed out after " + ms + "ms"), streams: [] });
    }, ms);

    Promise.resolve(promise)
      .then((streams) => resolve({ streams: Array.isArray(streams) ? streams : [] }))
      .catch((error) => resolve({ error, streams: [] }))
      .finally(() => clearTimeout(timer));
  });
}

function getEnabledProviders(mediaType) {
  let providers = nuvioManifest.scrapers.filter((provider) => provider.enabled !== false);

  if (PROVIDER_FILTER.length > 0) {
    const allowed = new Set(PROVIDER_FILTER);
    providers = providers.filter((provider) => allowed.has(provider.id));
  }

  if (mediaType === "movie") {
    providers = providers.filter((provider) => !animeProviders.has(provider.id));
  }

  return providers;
}

function loadProvider(provider) {
  const providerPath = path.join(ROOT, provider.filename);
  delete require.cache[require.resolve(providerPath)];
  return require(providerPath);
}

async function resolveTmdb(imdbId, mediaType) {
  if (!imdbId || !imdbId.startsWith("tt")) {
    return { tmdbId: imdbId, mediaType };
  }

  const url = "https://api.themoviedb.org/3/find/" +
    encodeURIComponent(imdbId) +
    "?api_key=" +
    encodeURIComponent(TMDB_API_KEY) +
    "&external_source=imdb_id";

  const response = await fetch(url);
  if (!response.ok) throw new Error("TMDB find failed: HTTP " + response.status);
  const data = await response.json();

  if (mediaType === "tv" && data.tv_results && data.tv_results[0]) {
    return { tmdbId: String(data.tv_results[0].id), mediaType: "tv" };
  }

  if (mediaType === "movie" && data.movie_results && data.movie_results[0]) {
    return { tmdbId: String(data.movie_results[0].id), mediaType: "movie" };
  }

  const movie = data.movie_results && data.movie_results[0];
  const tv = data.tv_results && data.tv_results[0];
  if (movie) return { tmdbId: String(movie.id), mediaType: "movie" };
  if (tv) return { tmdbId: String(tv.id), mediaType: "tv" };

  throw new Error("No TMDB match for " + imdbId);
}

function toStremioStream(stream, provider) {
  if (!stream || !stream.url || typeof stream.url !== "string") return null;

  const quality = stream.quality || "HD";
  const titleParts = [
    stream.title || provider.name,
    quality,
    stream.size && stream.size !== "Unknown" ? stream.size : ""
  ].filter(Boolean);

  const result = {
    name: provider.name || stream.name || provider.id,
    title: titleParts.join("\n"),
    url: stream.url,
    behaviorHints: {
      notWebReady: false
    }
  };

  if (stream.headers && Object.keys(stream.headers).length > 0) {
    result.headers = stream.headers;
    result.behaviorHints.proxyHeaders = {
      request: stream.headers
    };
  }

  return result;
}

async function getStreams(request) {
  const resolved = await resolveTmdb(request.imdbId, request.mediaType);
  const providers = getEnabledProviders(resolved.mediaType);
  const streams = [];
  const seen = new Set();

  for (const provider of providers) {
    try {
      const module = loadProvider(provider);
      if (!module || typeof module.getStreams !== "function") continue;

      const result = await withTimeout(
        module.getStreams(resolved.tmdbId, resolved.mediaType, request.season, request.episode),
        PROVIDER_TIMEOUT_MS,
        provider.id
      );

      if (result.error) {
        console.warn("[Stremio] " + provider.id + ": " + result.error.message);
      }

      for (const stream of result.streams) {
        const stremioStream = toStremioStream(stream, provider);
        if (!stremioStream || seen.has(stremioStream.url)) continue;
        seen.add(stremioStream.url);
        streams.push(stremioStream);
      }
    } catch (error) {
      console.warn("[Stremio] " + provider.id + ": " + (error && error.message ? error.message : error));
    }
  }

  return streams;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*"
      });
      res.end();
      return;
    }

    if (url.pathname === "/" || url.pathname === "/manifest.json") {
      sendJson(res, 200, stremioManifest);
      return;
    }

    const streamRequest = parseStreamPath(url.pathname);
    if (streamRequest) {
      const streams = await getStreams(streamRequest);
      sendJson(res, 200, { streams });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[Stremio] " + (error && error.stack ? error.stack : error));
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log("Stremio addon listening on http://" + HOST + ":" + PORT + "/manifest.json");
  console.log("Providers: " + getEnabledProviders("tv").map((provider) => provider.id).join(", "));
});
