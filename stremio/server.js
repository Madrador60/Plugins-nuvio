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

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(html);
}

function getPublicBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getProviderSummary(mediaType) {
  return getEnabledProviders(mediaType).map((provider) => ({
    id: provider.id,
    name: provider.name,
    languages: provider.contentLanguage || [],
    limited: Boolean(provider.limited)
  }));
}

function renderHomePage(req) {
  const baseUrl = getPublicBaseUrl(req);
  const manifestUrl = baseUrl + "/manifest.json";
  const stremioInstallUrl = "stremio://" + manifestUrl.replace(/^https?:\/\//, "");
  const movieProviders = getProviderSummary("movie");
  const seriesProviders = getProviderSummary("tv");
  const providerRows = seriesProviders
    .map((provider) => {
      const state = provider.limited ? "Limite" : "Actif";
      const languages = provider.languages.length > 0 ? provider.languages.join(", ").toUpperCase() : "FR";
      return "<tr><td>" + escapeHtml(provider.name) + "</td><td>" + escapeHtml(languages) + "</td><td>" + escapeHtml(state) + "</td></tr>";
    })
    .join("");

  return "<!doctype html>" +
    "<html lang=\"fr\">" +
    "<head>" +
    "<meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Madrador60 Stremio Addon</title>" +
    "<style>" +
    ":root{color-scheme:dark;--bg:#111315;--panel:#1a1d20;--text:#f5f7fa;--muted:#aab2bd;--line:#30353b;--accent:#8b5cf6;--ok:#2dd4bf}" +
    "*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}" +
    "main{width:min(980px,calc(100% - 32px));margin:0 auto;padding:42px 0 56px}" +
    ".hero{display:grid;gap:18px;padding:34px 0 26px;border-bottom:1px solid var(--line)}" +
    "h1{font-size:clamp(34px,6vw,58px);line-height:1;margin:0;letter-spacing:0}.lead{max-width:700px;color:var(--muted);font-size:18px;margin:0}" +
    ".actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--line);color:var(--text);text-decoration:none;background:var(--panel);font-weight:700}.btn.primary{background:var(--accent);border-color:var(--accent)}" +
    ".grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:24px 0}.box{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.box strong{display:block;font-size:24px}.box span{color:var(--muted)}" +
    "section{padding:22px 0}h2{font-size:24px;margin:0 0 12px}code{display:block;overflow:auto;background:#080a0c;border:1px solid var(--line);border-radius:8px;padding:14px;color:#e6edf3}" +
    "table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:700}tr:last-child td{border-bottom:0}.note{color:var(--muted);font-size:14px}" +
    "@media(max-width:720px){main{width:min(100% - 24px,980px);padding-top:24px}.grid{grid-template-columns:1fr}.actions{display:grid}.btn{width:100%}}" +
    "</style>" +
    "</head>" +
    "<body><main>" +
    "<div class=\"hero\"><h1>Madrador60 FR Providers</h1><p class=\"lead\">Addon Stremio heberge pour films, series et animes francais. Ajoute l'URL du manifest dans Stremio et lance ton contenu.</p>" +
    "<div class=\"actions\"><a class=\"btn primary\" href=\"" + escapeHtml(stremioInstallUrl) + "\">Installer dans Stremio</a><a class=\"btn\" href=\"/manifest.json\">Voir le manifest</a><a class=\"btn\" href=\"https://github.com/Madrador60/Plugins-nuvio\">GitHub</a></div></div>" +
    "<div class=\"grid\"><div class=\"box\"><strong>" + movieProviders.length + "</strong><span>providers films/series</span></div><div class=\"box\"><strong>" + seriesProviders.length + "</strong><span>providers series/animes</span></div><div class=\"box\"><strong>FR</strong><span>sources francaises en priorite</span></div></div>" +
    "<section><h2>URL a mettre dans Stremio</h2><code>" + escapeHtml(manifestUrl) + "</code><p class=\"note\">Sur Render gratuit, le premier chargement peut etre lent si le service etait en veille.</p></section>" +
    "<section><h2>Providers actifs</h2><table><thead><tr><th>Provider</th><th>Langues</th><th>Etat</th></tr></thead><tbody>" + providerRows + "</tbody></table></section>" +
    "<section><h2>Pour Nuvio</h2><code>https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/</code></section>" +
    "</main></body></html>";
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

    if (url.pathname === "/") {
      sendHtml(res, 200, renderHomePage(req));
      return;
    }

    if (url.pathname === "/manifest.json") {
      sendJson(res, 200, stremioManifest);
      return;
    }

    if (url.pathname === "/health.json") {
      sendJson(res, 200, {
        ok: true,
        name: stremioManifest.name,
        version: stremioManifest.version,
        providers: getEnabledProviders("tv").length
      });
      return;
    }

    if (url.pathname === "/providers.json") {
      sendJson(res, 200, {
        movie: getProviderSummary("movie"),
        series: getProviderSummary("tv")
      });
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
