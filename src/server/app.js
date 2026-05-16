const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const logger = require("../utils/logger");
const { fail } = require("../utils/response");
const providerStatusService = require("../services/provider-status.service");
const domainService = require("../services/domain.service");

const ROOT = path.resolve(__dirname, "..", "..");
const SITE_MADRADOR_DIR = path.join(ROOT, "site-madrador");
const nuvioManifest = require(path.join(ROOT, "manifest.json"));
const domains = require(path.join(ROOT, "domains.json"));

const SITE_NAME = "Madrador Film";
const SITE_VERSION = "2.0.0";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 7000);
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ENABLE_ADMIN = /^(1|true|yes)$/i.test(process.env.ENABLE_ADMIN || "");
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45000);
const PROVIDER_FILTER = (process.env.PROVIDER_FILTER || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000);
const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 10 * 60 * 1000);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 3 * 60 * 1000);
const DIAGNOSTIC_CACHE_TTL_MS = Number(process.env.DIAGNOSTIC_CACHE_TTL_MS || 2 * 60 * 1000);
const CATALOG_CACHE_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS || 30 * 60 * 1000);
const CACHE_MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 300);
const memoryCache = new Map();

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

const unstableProviders = new Set(["animoflix", "animesite", "cinemacity", "sekai", "videasy"]);

function metahubPoster(imdbId) {
  return imdbId ? "https://images.metahub.space/poster/medium/" + imdbId + "/img" : null;
}

function metahubBackground(imdbId) {
  return imdbId ? "https://images.metahub.space/background/medium/" + imdbId + "/img" : null;
}

function fallbackItem(item) {
  return Object.assign({}, item, {
    poster: item.poster || metahubPoster(item.imdbId),
    backdrop: item.backdrop || metahubBackground(item.imdbId)
  });
}

const fallbackItems = [
  fallbackItem({ id: "157336", imdbId: "tt0816692", type: "movie", title: "Interstellar", year: "2014", rating: 8.4 }),
  fallbackItem({ id: "155", imdbId: "tt0468569", type: "movie", title: "The Dark Knight", year: "2008", rating: 8.5 }),
  fallbackItem({ id: "603", imdbId: "tt0133093", type: "movie", title: "Matrix", year: "1999", rating: 8.2 }),
  fallbackItem({ id: "550", imdbId: "tt0137523", type: "movie", title: "Fight Club", year: "1999", rating: 8.4 }),
  fallbackItem({ id: "27205", imdbId: "tt1375666", type: "movie", title: "Inception", year: "2010", rating: 8.4 }),
  fallbackItem({ id: "680", imdbId: "tt0110912", type: "movie", title: "Pulp Fiction", year: "1994", rating: 8.5 }),
  fallbackItem({ id: "13", imdbId: "tt0109830", type: "movie", title: "Forrest Gump", year: "1994", rating: 8.5 }),
  fallbackItem({ id: "238", imdbId: "tt0068646", type: "movie", title: "Le Parrain", year: "1972", rating: 8.7 }),
  fallbackItem({ id: "278", imdbId: "tt0111161", type: "movie", title: "Les Evades", year: "1994", rating: 8.7 }),
  fallbackItem({ id: "496243", imdbId: "tt6751668", type: "movie", title: "Parasite", year: "2019", rating: 8.5 }),
  fallbackItem({ id: "324857", imdbId: "tt4633694", type: "movie", title: "Spider-Man: New Generation", year: "2018", rating: 8.4 }),
  fallbackItem({ id: "429", imdbId: "tt0060196", type: "movie", title: "Le Bon, la Brute et le Truand", year: "1966", rating: 8.5 }),
  fallbackItem({ id: "1399", imdbId: "tt0944947", type: "series", title: "Game of Thrones", year: "2011", rating: 8.4 }),
  fallbackItem({ id: "1396", imdbId: "tt0903747", type: "series", title: "Breaking Bad", year: "2008", rating: 8.9 }),
  fallbackItem({ id: "66732", imdbId: "tt4574334", type: "series", title: "Stranger Things", year: "2016", rating: 8.6 }),
  fallbackItem({ id: "60574", imdbId: "tt2442560", type: "series", title: "Peaky Blinders", year: "2013", rating: 8.5 }),
  fallbackItem({ id: "37854", imdbId: "tt0388629", type: "series", title: "One Piece", year: "1999", rating: 8.7 }),
  fallbackItem({ id: "31911", imdbId: "tt1355642", type: "series", title: "Fullmetal Alchemist: Brotherhood", year: "2009", rating: 8.7 }),
  fallbackItem({ id: "46260", imdbId: "tt0409591", type: "series", title: "Naruto", year: "2002", rating: 8.4 }),
  fallbackItem({ id: "85937", imdbId: "tt9335498", type: "series", title: "Demon Slayer", year: "2019", rating: 8.7 }),
  fallbackItem({ id: "1429", imdbId: "tt2560140", type: "series", title: "L'Attaque des Titans", year: "2013", rating: 8.7 }),
  fallbackItem({ id: "95479", imdbId: "tt12343534", type: "series", title: "Jujutsu Kaisen", year: "2020", rating: 8.5 })
];

function corsHeaders(extra) {
  return Object.assign({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "Content-Length,Content-Range,Accept-Ranges,Content-Type",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer-when-downgrade",
    "permissions-policy": "camera=(), microphone=(), geolocation=()"
  }, extra || {});
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, corsHeaders({
    "content-type": "application/json; charset=utf-8",
  }));
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, corsHeaders({
    "content-type": "text/html; charset=utf-8"
  }));
  res.end(html);
}

function sendFile(res, status, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.writeHead(status, corsHeaders({
      "content-type": contentType,
      "cache-control": "public, max-age=86400"
    }));
    res.end(data);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
  }[ext] || "application/octet-stream";
}

function sendSiteFile(res, relativePath, status) {
  const safeRelative = String(relativePath || "").replace(/^\/+/, "");
  const filePath = path.resolve(SITE_MADRADOR_DIR, safeRelative);
  if (!filePath.startsWith(SITE_MADRADOR_DIR)) {
    sendJson(res, 403, fail("FORBIDDEN", "Chemin refuse."));
    return true;
  }
  sendFile(res, status || 200, filePath, contentTypeFor(filePath));
  return true;
}

function routeSitePage(res, pathname) {
  const pageMap = {
    "/": "index.html",
    "/catalog": "catalog.html",
    "/details": "details.html",
    "/player": "player.html",
    "/test-player": "player.html",
    "/providers": "providers.html",
    "/admin": "admin.html",
    "/legal": "legal.html",
    "/dmca": "dmca.html",
    "/security": "security.html"
  };
  if (!pageMap[pathname]) return false;
  return sendSiteFile(res, pageMap[pathname], 200);
}

function getPublicBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function getAddonBaseUrl(req) {
  const base = getPublicBaseUrl(req);
  return req.routePrefix ? base + req.routePrefix : base;
}

function getProxyExtension(sourceUrl) {
  const cleanUrl = String(sourceUrl || "").split("?")[0].toLowerCase();
  const match = cleanUrl.match(/\.([a-z0-9]{2,5})$/);
  if (match) return match[1];
  return "m3u8";
}

function getOriginHeaders(sourceUrl, currentHeaders) {
  const headers = Object.assign({}, currentHeaders || {});
  try {
    const parsed = new URL(sourceUrl);
    if (!headers.Referer && !headers.referer) headers.Referer = parsed.origin + "/";
    if (!headers.Origin && !headers.origin) headers.Origin = parsed.origin;
  } catch (_) {
    // Ignore invalid media URLs; fetch will surface the real error later.
  }
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
  }
  if (!headers.Accept && !headers.accept) headers.Accept = "*/*";
  return headers;
}

function getProxyUrl(req, stream) {
  const payload = {
    url: stream.url,
    headers: getOriginHeaders(stream.url, stream.headers || {})
  };
  const extension = getProxyExtension(stream.url);
  return getAddonBaseUrl(req) + "/proxy/" + base64UrlEncode(JSON.stringify(payload)) + "/stream." + extension;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFilename(value, extension) {
  const base = String(value || "stream")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80) || "stream";
  return base + "." + (extension || "mp4");
}

function getProviderDomains(providerId) {
  const entry = domains[providerId];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return Array.isArray(entry.domains) ? entry.domains : [];
}

function getProviderSummary(mediaType) {
  return getEnabledProviders(mediaType).map((provider) => ({
    id: provider.id,
    name: provider.name,
    languages: provider.contentLanguage || [],
    limited: Boolean(provider.limited),
    unstable: unstableProviders.has(provider.id),
    domains: getProviderDomains(provider.id),
    formats: provider.formats || []
  }));
}

function getProviderState(provider) {
  if (provider.enabled === false) return "Desactive";
  if (unstableProviders.has(provider.id)) return "Instable";
  if (provider.limited) return "Limite";
  return "Actif";
}

function getCached(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs) {
  if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [entryKey, entry] of memoryCache) {
      if (entry.expiresAt <= now || memoryCache.size >= CACHE_MAX_ENTRIES) {
        memoryCache.delete(entryKey);
      }
      if (memoryCache.size < CACHE_MAX_ENTRIES) break;
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlMs || CACHE_TTL_MS)
  });
  return value;
}

async function cachedJson(key, fetcher, ttlMs) {
  const cached = getCached(key);
  if (cached) return cached;
  return setCached(key, await fetcher(), ttlMs);
}

function renderTestPlayerPage() {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Madrador Film</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--panel2:#191d36;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--red:#7c3aed;--red2:#2563eb;--green:#38bdf8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}
body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 18% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 82% 12%,rgba(37,99,235,.28),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.2),#060714 62%);pointer-events:none}
main{position:relative;z-index:1;width:min(1280px,calc(100% - 32px));margin:0 auto;padding:22px 0 56px}
.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;letter-spacing:0;text-shadow:0 0 24px rgba(124,58,237,.6)}.navlinks{display:flex;gap:10px;flex-wrap:wrap}.navlinks a{color:#eef2ff;text-decoration:none;font-weight:700;font-size:14px;padding:8px 10px;border-radius:6px}.navlinks a:hover{background:#1b2144}
.hero{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(340px,.78fr);gap:22px;align-items:stretch;margin-top:14px}.player{position:relative;background:#000;border-radius:8px;overflow:hidden;box-shadow:0 24px 90px rgba(37,99,235,.18),0 18px 70px rgba(0,0,0,.58)}video{display:block;width:100%;height:100%;min-height:430px;max-height:68vh;background:#000;object-fit:contain}.shade{position:absolute;inset:auto 0 0 0;padding:22px 22px 52px;background:linear-gradient(0deg,rgba(8,10,25,.94),transparent);pointer-events:none}.shade h1{font-size:clamp(30px,5vw,58px);line-height:1;margin:0 0 8px}.shade p{margin:0;color:var(--muted);max-width:720px}
.side{display:flex;flex-direction:column;gap:14px}.searchBox,.now,.streamsPanel,.logPanel{background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;padding:14px}.searchGrid{display:grid;grid-template-columns:1fr 110px;gap:10px}input,select,button{font:inherit;min-height:42px;border-radius:6px;border:1px solid #303866}input,select{background:#080b1d;color:#fff;padding:0 12px}button{border:0;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;font-weight:800;padding:0 14px;cursor:pointer}button:hover{background:linear-gradient(135deg,#8b5cf6,#3b82f6)}button.secondary{background:#232a50}button.ghost{background:#080b1d;border:1px solid #303866}.searchBtn{width:100%;margin-top:10px}
.label{color:var(--muted);font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:.08em;margin-bottom:8px}.nowTitle{font-weight:900;font-size:18px}.nowUrl{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.filters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.rows{margin-top:26px}.rowHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}h2{margin:0;font-size:22px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:156px;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;padding:2px 0 14px;scrollbar-color:#555 transparent}.poster{height:232px;width:156px;text-align:left;background:#151515;border:1px solid #242424;border-radius:7px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#777}.poster img{width:100%;height:178px;object-fit:cover;background:#222}.poster strong{display:block;padding:8px 8px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 8px 8px;font-size:12px}
.streamGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stream{min-height:86px;text-align:left;background:#10142b;border:1px solid #29305c;border-radius:8px;color:#fff;padding:12px}.stream.active{border-color:var(--green);box-shadow:0 0 0 1px var(--green),0 0 24px rgba(56,189,248,.25)}.stream strong{display:block;font-size:15px}.stream small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:5px}.pill{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:#29305c;color:#fff;font-size:11px;font-weight:900;margin-top:7px}.pill.mp4{background:#2563eb}.pill.hls{background:#6d28d9}
pre{white-space:pre-wrap;background:#050505;border:1px solid #222;border-radius:8px;padding:12px;color:#cbd5e1;overflow:auto;max-height:170px;margin:0}.empty{color:var(--muted);background:#101010;border:1px dashed #333;border-radius:8px;padding:18px}
@media(max-width:980px){.hero{grid-template-columns:1fr}video{min-height:300px}.streamGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){main{width:min(100% - 20px,1280px);padding:14px 0 34px}.nav{height:auto;align-items:flex-start;display:grid;gap:8px}.brand{font-size:20px}.navlinks{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:6px}.navlinks a{background:#10142b;text-align:center;padding:10px 8px}.hero{gap:14px;margin-top:8px}.player{border-radius:6px}video{min-height:220px;max-height:42vh}.shade{padding:16px 14px 34px}.shade h1{font-size:28px}.shade p{font-size:13px}.searchBox,.now,.streamsPanel,.logPanel{padding:12px}.searchGrid,.tools,.filters,.streamGrid{grid-template-columns:1fr}.rail{grid-auto-columns:132px}.poster{width:132px;height:210px}.poster img{height:154px}pre{max-height:120px}.stream{min-height:76px}}
@media(max-width:520px){body{overflow-x:hidden}main{width:100%;padding:12px 10px calc(92px + env(safe-area-inset-bottom))}.brand{padding-left:2px}.hero{min-height:210px;padding:16px;border-radius:0;margin:8px -10px 18px;background-position:center top}.hero .chip{font-size:11px;min-height:26px}h1{font-size:34px;max-width:330px}.lead{font-size:14px;max-width:330px}.search{margin-top:14px}.search input,.search select,.search button{min-height:48px;border-radius:8px;font-size:15px}.row{margin:20px 0}.rowHead{padding:0 2px}.rowHead .chip{white-space:nowrap}.rail{grid-auto-columns:42vw;gap:10px;margin:0 -10px;padding:2px 10px 16px;scroll-padding-left:10px}.poster{width:42vw;height:calc(42vw * 1.55);border-radius:7px}.poster:hover{transform:none}.poster img{height:calc(42vw * 1.16)}.poster strong{font-size:12px;padding:7px 7px 0}.poster small{font-size:11px;padding:2px 7px}.modal{align-items:stretch;padding-top:env(safe-area-inset-top)}.sheet{height:100dvh;max-height:100dvh;border:0;border-radius:0;overflow:auto}.detailHero{min-height:100%;display:block;padding:56px 16px 24px;background-position:center top}.detailPoster{width:118px;float:left;margin:0 14px 8px 0}.detailText h2{font-size:30px;line-height:1.02}.meta{font-size:13px}.overview{clear:both;max-height:none;font-size:14px;line-height:1.5}.detailActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}.detailActions button{min-height:48px}.close{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:30;border-radius:999px}.bottomNav{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:7px;border-radius:12px}.bottomNav a{font-size:12px;min-height:42px;display:flex;align-items:center;justify-content:center}}@media(max-width:360px){.rail{grid-auto-columns:46vw}.poster{width:46vw;height:calc(46vw * 1.58)}.poster img{height:calc(46vw * 1.18)}h1{font-size:30px}.detailPoster{width:104px}}
.brand{display:flex;align-items:center;gap:10px}.brand img{width:24px;height:24px;border-radius:6px}.categoryBar{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 6px}.categoryBar button{min-height:36px;border:1px solid #303866;background:#10142b;border-radius:999px;padding:0 13px}.categoryBar button.active{background:linear-gradient(135deg,#7c3aed,#2563eb);border-color:transparent}.sourcePlayer{display:none;margin:0 0 14px;background:#020617;border:1px solid #303866;border-radius:8px;overflow:hidden}.sourcePlayer.open{display:block}.sourcePlayer video{display:block;width:100%;max-height:360px;background:#000}.sourcePlayerInfo{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;background:#0b1028;color:#dbeafe}.sourceStatus{color:#bfdbfe;font-size:13px}.sourceCard.best{border-color:#38bdf8;box-shadow:0 0 0 1px rgba(56,189,248,.55)}.sourceCard.best:before{content:"Meilleur choix";display:inline-flex;margin-bottom:8px;min-height:22px;align-items:center;border-radius:999px;padding:0 8px;background:#075985;color:#e0f2fe;font-size:11px;font-weight:900}.empty strong{color:#fff}.empty .hint{display:block;margin-top:6px;color:#b8c0e0}.skeleton{min-height:220px;background:linear-gradient(90deg,#111426,#1d2446,#111426);background-size:240% 100%;animation:pulse 1.2s linear infinite;border-radius:8px}@keyframes pulse{to{background-position:-240% 0}}@media(max-width:520px){.categoryBar{display:grid;grid-template-columns:1fr 1fr}.categoryBar button{min-height:42px}.sourcePlayer video{max-height:280px}.sourcePlayerInfo{display:grid}.brand img{width:22px;height:22px}}
</style>
<style>
.updatePanel{display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(17,20,38,.88);border:1px solid #303866;border-radius:8px;padding:12px 14px;margin:0 0 18px}.updatePanel strong{display:block}.updatePanel span{display:block;color:#b8c0e0;font-size:13px}.updatePanel button{min-height:36px;border-radius:999px}.rowCount{display:inline-flex;align-items:center;min-height:30px;border:1px solid #303866;border-radius:999px;padding:0 10px;color:#dbeafe;background:#10142b;font-weight:800;font-size:12px}body.modalLock{overflow:hidden}.modal{align-items:center;justify-content:center;padding:18px}.sheet{max-height:min(92dvh,920px);overflow:auto;overscroll-behavior:contain}.close{position:fixed;right:22px;top:22px;z-index:40;border-radius:8px}.detailHero{min-height:260px}.sourcePlayer video{aspect-ratio:16/9;height:auto;max-height:min(46vh,420px);object-fit:contain}.sourcePlayerInfo{position:sticky;bottom:0}.sourceList{max-height:340px;overflow:auto;overscroll-behavior:contain;padding-right:2px}@media(max-width:620px){.updatePanel{display:grid}.updatePanel button{width:100%}.modal{align-items:stretch;padding:0}.sheet{width:100%;height:100dvh;max-height:100dvh;border:0;border-radius:0}.close{right:12px;top:calc(12px + env(safe-area-inset-top));border-radius:999px}.sourcePlayer video{max-height:34vh}.sourceList{max-height:none;overflow:visible}}
</style>
</head>
<body>
<main>
  <header class="nav">
    <div class="brand">MADRADOR FILM</div>
    <nav class="navlinks"><a href="/">Accueil</a><a href="/catalog">Catalogue</a><a href="/providers">Providers</a></nav>
  </header>
  <section class="hero">
    <div class="player">
      <video id="video" controls playsinline></video>
      <div class="shade"><h1 id="heroTitle">Test lecture</h1><p id="heroMeta">Cherche un film ou une serie, puis lance une source MP4 ou HLS.</p></div>
    </div>
    <aside class="side">
      <div class="searchBox">
        <div class="label">Recherche</div>
        <div class="searchGrid"><input id="query" placeholder="Interstellar, Send Help, One Piece..." value="Interstellar"><select id="type"><option value="movie">Film</option><option value="series">Serie</option></select></div>
        <button id="search" class="searchBtn">Rechercher</button>
        <div class="tools"><button id="filterAll" class="secondary">Tout</button><button id="filterMp4" class="ghost">MP4</button><button id="filterHls" class="ghost">HLS</button></div>
        <div class="filters"><button id="filterVf" class="ghost">VF</button><button id="filterVostfr" class="ghost">VOSTFR</button><button id="filterMulti" class="ghost">MULTI</button></div>
      </div>
      <div class="now">
        <div class="label">Lecture actuelle</div>
        <div id="nowTitle" class="nowTitle">Aucun stream lance</div>
        <div id="nowUrl" class="nowUrl">Choisis une source pour commencer.</div>
        <div class="tools"><button id="copy" class="secondary">Copier l'URL</button><button id="open" class="ghost">Ouvrir</button></div>
      </div>
      <div class="logPanel"><div class="label">Journal</div><pre id="log">Pret.</pre></div>
    </aside>
  </section>
  <section class="rows">
    <div class="rowHead"><h2>Resultats</h2><span id="resultCount" class="muted"></span></div>
    <div id="results" class="empty">Aucune recherche lancee.</div>
  </section>
  <section class="rows">
    <div class="rowHead"><h2>Sources disponibles</h2><span id="streamCount" class="muted"></span></div>
    <div id="streams" class="empty">Choisis un resultat.</div>
  </section>
</main>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script>
const log=document.getElementById('log'),video=document.getElementById('video'),q=document.getElementById('query'),type=document.getElementById('type'),searchBtn=document.getElementById('search'),results=document.getElementById('results'),streamsBox=document.getElementById('streams'),nowTitle=document.getElementById('nowTitle'),nowUrl=document.getElementById('nowUrl'),copyBtn=document.getElementById('copy'),openBtn=document.getElementById('open'),heroTitle=document.getElementById('heroTitle'),heroMeta=document.getElementById('heroMeta'),resultCount=document.getElementById('resultCount'),streamCount=document.getElementById('streamCount'),filterAll=document.getElementById('filterAll'),filterMp4=document.getElementById('filterMp4'),filterHls=document.getElementById('filterHls'),filterVf=document.getElementById('filterVf'),filterVostfr=document.getElementById('filterVostfr'),filterMulti=document.getElementById('filterMulti');let hls=null,currentUrl='',currentMeta=null,allStreams=[],streamFilter='all',languageFilter='all';const params=new URLSearchParams(location.search);if(params.get('q'))q.value=params.get('q');if(params.get('type'))type.value=params.get('type');const noPoster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="312" height="464"><rect width="100%" height="100%" fill="#151515"/><text x="50%" y="47%" fill="#777" font-family="Arial" font-size="28" text-anchor="middle">MADRADOR</text><text x="50%" y="55%" fill="#555" font-family="Arial" font-size="22" text-anchor="middle">FILM</text></svg>');
function write(x){log.textContent+='\\n'+x;log.scrollTop=log.scrollHeight}function setLog(x){log.textContent=x}function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}function formatUrl(u){const s=String(u||'').replace(location.origin,'');const m=s.match(/^\\/proxy\\/[^/]+\\/(stream\\.[a-z0-9]+)$/i);return m?'/proxy/.../'+m[1]:s}
async function search(autoLoadFirst){const query=q.value.trim();if(!query)return;setLog('Recherche: '+query);results.className='empty';results.textContent='Recherche...';streamsBox.className='empty';streamsBox.textContent='Choisis un resultat.';streamCount.textContent='';const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(query)).then(r=>r.json());resultCount.textContent=data.results.length+' resultat(s)';results.className='rail';results.innerHTML=data.results.map(r=>'<button class="poster" data-id="'+r.id+'" data-type="'+r.type+'" data-title="'+esc(r.title)+'" data-year="'+esc(r.year||'')+'"><img src="'+esc(r.poster||noPoster)+'" alt=""><strong>'+esc(r.title)+'</strong><small>'+esc(r.year||'Annee inconnue')+' · TMDB '+r.id+'</small></button>').join('')||'<div class="empty">Aucun resultat</div>';results.querySelectorAll('button').forEach(b=>b.onclick=()=>loadStreams(b.dataset.type,b.dataset.id,b.dataset.title,b.dataset.year));write('Resultats: '+data.results.length);if(autoLoadFirst&&data.results[0]){const r=data.results[0];await loadStreams(r.type,r.id,r.title,r.year)}}
function streamText(s){return [s.name,s.title,s.description,s.url].join(' ').toLowerCase()}
function matchLanguage(s){const text=streamText(s);if(languageFilter==='all')return true;if(languageFilter==='vf')return /\\bvf\\b|french|francais|français/.test(text);if(languageFilter==='vostfr')return /vostfr|vost|subfrench/.test(text);if(languageFilter==='multi')return /multi|multilang|multiverse/.test(text);return true}
function renderStreams(){const visible=allStreams.filter(s=>(streamFilter==='all'||(streamFilter==='mp4'&&((s.format||'').toLowerCase()==='mp4'||s.url.includes('.mp4')))||(streamFilter==='hls'&&((s.format||'').toLowerCase()==='hls'||s.url.includes('.m3u8'))))&&matchLanguage(s));streamCount.textContent=visible.length+' source(s)';streamsBox.className='streamGrid';streamsBox.innerHTML=visible.map((s,i)=>{const originalIndex=allStreams.indexOf(s);const kind=s.format|| (s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'LINK');const cls=kind==='MP4'?'mp4':kind==='HLS'?'hls':'';return '<button class="stream" data-i="'+originalIndex+'"><strong>'+esc(s.name)+'</strong><small>'+esc(s.title||s.description||'')+'</small><span class="pill '+cls+'">'+esc(kind)+'</span><span class="pill">'+esc(s.language||'FR')+'</span><span class="pill">'+esc(s.quality||'HD')+'</span><small>'+esc(formatUrl(s.url))+'</small></button>'}).join('')||'<div class="empty">Aucune source pour ce filtre</div>';streamsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>play(allStreams[Number(b.dataset.i)],b))}
async function loadStreams(mediaType,id,title,year){currentMeta={mediaType,id,title,year};heroTitle.textContent=title;heroMeta.textContent=(year?year+' · ':'')+'Recherche des sources...';setLog('Streams pour '+title+'...');streamsBox.className='empty';streamsBox.textContent='Chargement des sources...';const endpoint='/stream/'+mediaType+'/'+id+'.json';const data=await fetch(endpoint).then(r=>r.json());allStreams=data.streams||[];renderStreams();write('Streams: '+allStreams.length);if(allStreams[0]) play(allStreams[0],streamsBox.querySelector('button'))}
async function play(s,button){if(!s)return;streamsBox.querySelectorAll('.active').forEach(x=>x.classList.remove('active'));if(button)button.classList.add('active');const kind=s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'Lien';currentUrl=s.url;nowTitle.textContent=s.name+' · '+kind;nowUrl.textContent=formatUrl(s.url);heroMeta.textContent=s.title||s.description||kind;write('Lecture: '+s.name+' - '+(s.title||s.description||''));write(s.url);if(hls){hls.destroy();hls=null}video.removeAttribute('src');video.load();if(s.url.includes('.m3u8')){if(window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,lowLatencyMode:false});hls.loadSource(s.url);hls.attachMedia(video);hls.on(Hls.Events.ERROR,(e,d)=>write('HLS error: '+JSON.stringify({type:d.type,details:d.details,fatal:d.fatal})));}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=s.url}else{write('HLS non supporte dans ce navigateur');return}}else{video.src=s.url}await video.play().catch(e=>write('Lecture bloquee: '+e.message))}
function setFilter(value){streamFilter=value;filterAll.className=value==='all'?'secondary':'ghost';filterMp4.className=value==='mp4'?'secondary':'ghost';filterHls.className=value==='hls'?'secondary':'ghost';renderStreams()}
function setLanguageFilter(value){languageFilter=value;filterVf.className=value==='vf'?'secondary':'ghost';filterVostfr.className=value==='vostfr'?'secondary':'ghost';filterMulti.className=value==='multi'?'secondary':'ghost';renderStreams()}
copyBtn.onclick=async()=>{if(!currentUrl)return;await navigator.clipboard.writeText(currentUrl).catch(()=>{});write('URL copiee')};openBtn.onclick=()=>{if(currentUrl)window.open(currentUrl,'_blank')};filterAll.onclick=()=>setFilter('all');filterMp4.onclick=()=>setFilter('mp4');filterHls.onclick=()=>setFilter('hls');filterVf.onclick=()=>setLanguageFilter(languageFilter==='vf'?'all':'vf');filterVostfr.onclick=()=>setLanguageFilter(languageFilter==='vostfr'?'all':'vostfr');filterMulti.onclick=()=>setLanguageFilter(languageFilter==='multi'?'all':'multi');video.addEventListener('error',()=>write('Video error code: '+(video.error&&video.error.code)));searchBtn.onclick=()=>search(false).catch(e=>setLog('Erreur: '+(e.stack||e.message||e)));q.addEventListener('keydown',e=>{if(e.key==='Enter')searchBtn.click()});if(params.get('id')){setTimeout(()=>loadStreams(type.value,params.get('id'),q.value||'Titre choisi',params.get('year')||''),250)}else if(params.get('q'))setTimeout(()=>search(params.get('autoload')==='1'),250);
</script>
</body>
</html>`;
}

function renderCatalogPage() {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Catalogue Madrador Film</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb;--cyan:#38bdf8}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 16% 0%,rgba(124,58,237,.32),transparent 34%),radial-gradient(circle at 80% 8%,rgba(37,99,235,.24),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.15),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1320px,calc(100% - 32px));margin:0 auto;padding:22px 0 72px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.nav a,.bottomNav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px}.nav a{margin-left:14px}.hero{min-height:350px;display:flex;align-items:flex-end;border-radius:10px;padding:30px;margin:18px 0 18px;background:linear-gradient(90deg,rgba(6,7,20,.95),rgba(6,7,20,.5)),url('https://image.tmdb.org/t/p/original/8eifdha9GQeZAkexgtD45546XKx.jpg') center/cover;box-shadow:0 22px 90px rgba(37,99,235,.18)}h1{font-size:clamp(42px,7vw,82px);line-height:.95;margin:0 0 12px}.lead{max-width:760px;color:#dbeafe;font-size:18px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 28px}.stat{background:rgba(17,20,38,.86);border:1px solid #303866;border-radius:8px;padding:13px}.stat strong{display:block;font-size:24px}.stat span{color:var(--muted);font-size:13px}.quick{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.quick button{min-height:34px;border:1px solid #303866;background:#10142b}.searchShell{position:relative;max-width:780px}.search{display:grid;grid-template-columns:1fr 130px auto;gap:10px;margin-top:18px}input,select,button{min-height:44px;border-radius:7px;border:1px solid #303866;font:inherit}input,select{background:#080b1d;color:#fff;padding:0 12px}button{border:0;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:900;padding:0 16px;cursor:pointer}.suggestions{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:12;display:none;background:rgba(8,11,29,.98);border:1px solid #303866;border-radius:8px;overflow:hidden;box-shadow:0 18px 70px rgba(0,0,0,.5)}.suggestions.open{display:block}.suggestion{width:100%;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;min-height:58px;text-align:left;background:transparent;border:0;border-bottom:1px solid #202647;border-radius:0;color:#fff}.suggestion:last-child{border-bottom:0}.suggestion img{width:34px;height:48px;object-fit:cover;border-radius:4px;background:#172033}.suggestion small{color:var(--muted)}.row{margin:24px 0}.row.hidden{display:none}.rowHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:23px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:164px;gap:12px;overflow-x:auto;padding:2px 0 16px;scrollbar-color:#4b5563 transparent}.poster{height:250px;width:164px;text-align:left;background:#111426;border:1px solid #29305c;border-radius:8px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#8b5cf6}.poster img{width:100%;height:188px;object-fit:cover;background:#172033}.poster strong{display:block;padding:8px 9px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 9px;font-size:12px}.empty{color:var(--muted);border:1px dashed #303866;border-radius:8px;padding:18px;background:#0a0d20}.loading{color:#c4b5fd}.tools{display:flex;gap:8px;flex-wrap:wrap}.chip{display:inline-flex;align-items:center;min-height:30px;border:1px solid #303866;border-radius:999px;padding:0 10px;color:#dbeafe;background:#10142b;font-weight:800;font-size:12px}.chip.good{border-color:rgba(56,189,248,.6);color:#bae6fd}.miniBtn{min-height:30px;border:1px solid #303866;background:#10142b;border-radius:999px;padding:0 10px;font-size:12px}.modal{position:fixed;inset:0;z-index:20;display:none;align-items:flex-end;background:rgba(0,0,0,.68);backdrop-filter:blur(8px)}.modal.open{display:flex}.sheet{width:min(1050px,calc(100% - 24px));margin:0 auto 18px;background:#0b1028;border:1px solid #303866;border-radius:10px;overflow:hidden;box-shadow:0 28px 120px rgba(0,0,0,.7)}.detailHero{min-height:390px;display:grid;grid-template-columns:210px 1fr;gap:20px;align-items:end;padding:22px;background:linear-gradient(90deg,rgba(8,10,25,.98),rgba(8,10,25,.68));background-size:cover;background-position:center}.detailPoster{width:210px;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.5)}.detailText h2{font-size:42px;line-height:1;margin:0 0 10px}.meta{color:#dbeafe;font-weight:800;margin-bottom:10px}.overview{max-width:720px;color:#dbeafe}.detailActions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.sourcePanel{background:rgba(8,11,29,.92);border-top:1px solid #303866;padding:16px 22px}.sourceHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.sourceList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sourceCard{background:#111426;border:1px solid #29305c;border-radius:8px;padding:11px;text-align:left;color:#fff}.sourceCard:hover{border-color:#8b5cf6}.sourceCard strong{display:block;font-size:14px}.sourceCard small{display:block;color:var(--muted);margin-top:4px}.badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sourceCard .chip{margin-top:0}.close{position:absolute;right:24px;top:18px;width:42px;padding:0;background:#111426;border:1px solid #303866}.bottomNav{display:none;position:fixed;left:10px;right:10px;bottom:10px;z-index:15;background:rgba(10,13,32,.94);border:1px solid #303866;border-radius:10px;padding:8px;backdrop-filter:blur(12px)}.bottomNav a{flex:1;text-align:center;padding:8px 6px;border-radius:7px}.bottomNav a:hover{background:#1d2446}@media(max-width:900px){.sourceList{grid-template-columns:1fr 1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){main{width:min(100% - 20px,1320px);padding:14px 0 82px}.nav{height:auto;display:grid;gap:8px}.nav nav{display:none}.bottomNav{display:flex}.brand{font-size:20px}.hero{padding:18px;min-height:245px;margin:12px 0 14px;border-radius:8px}h1{font-size:42px}.lead{font-size:15px}.search{grid-template-columns:1fr;gap:8px}.suggestions{position:static;margin-top:8px}.rail{grid-auto-columns:132px;gap:10px}.poster{width:132px;height:214px}.poster img{height:156px}.rowHead{align-items:flex-start;gap:8px}.rowHead h2{font-size:19px}.sheet{width:100%;margin:0;border-radius:12px 12px 0 0}.detailHero{min-height:unset;grid-template-columns:96px 1fr;gap:12px;padding:16px}.detailPoster{width:96px}.detailText h2{font-size:26px}.overview{font-size:13px;max-height:110px;overflow:auto}.detailActions{display:grid}.sourcePanel{padding:14px}.sourceList{grid-template-columns:1fr}.close{right:12px;top:12px}}@media(max-width:520px){body{overflow-x:hidden}main{width:100%;padding:12px 10px calc(92px + env(safe-area-inset-bottom))}.hero{min-height:236px;padding:16px;border-radius:0;margin:8px -10px 14px;background-position:center top}.hero .chip{font-size:11px;min-height:26px}h1{font-size:34px;max-width:330px}.lead{font-size:14px}.stats{grid-template-columns:1fr 1fr;margin:0 -2px 18px}.stat{padding:10px}.stat strong{font-size:20px}.quick{display:grid;grid-template-columns:1fr 1fr}.search input,.search select,.search button{min-height:48px;border-radius:8px;font-size:15px}.rail{grid-auto-columns:42vw;gap:10px;margin:0 -10px;padding:2px 10px 16px}.poster{width:42vw;height:calc(42vw * 1.55);border-radius:7px}.poster:hover{transform:none}.poster img{height:calc(42vw * 1.16)}.poster strong{font-size:12px;padding:7px 7px 0}.poster small{font-size:11px;padding:2px 7px}.modal{align-items:stretch;padding-top:env(safe-area-inset-top)}.sheet{height:100dvh;max-height:100dvh;border:0;border-radius:0;overflow:auto}.detailHero{min-height:auto;display:block;padding:56px 16px 18px;background-position:center top}.detailPoster{width:118px;float:left;margin:0 14px 8px 0}.detailText h2{font-size:30px;line-height:1.02}.meta{font-size:13px}.overview{clear:both;max-height:none;font-size:14px;line-height:1.5}.detailActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}.detailActions button{min-height:48px}.sourceHead{align-items:flex-start;display:grid}.close{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:30;border-radius:999px}.bottomNav{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:7px;border-radius:12px}.bottomNav a{font-size:12px;min-height:42px;display:flex;align-items:center;justify-content:center}}@media(max-width:360px){.rail{grid-auto-columns:46vw}.poster{width:46vw;height:calc(46vw * 1.58)}.poster img{height:calc(46vw * 1.18)}h1{font-size:30px}.detailPoster{width:104px}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand"><img src="/brand.svg" alt="">MADRADOR FILM</div><nav><a href="/test-player">Lecteur</a><a href="/providers">Providers</a></nav></header>
  <section class="hero"><div><span class="chip good">Madrador Film</span><h1>Films et series</h1><p class="lead">Un catalogue simple, rapide et pense pour lancer les sources FR sans passer par un addon externe.</p><div class="searchShell"><div class="search"><input id="query" placeholder="Rechercher un titre..." value="" autocomplete="off"><select id="type"><option value="movie">Film</option><option value="series">Serie</option></select><button id="go">Rechercher</button></div><div id="suggestions" class="suggestions"></div></div><div class="quick"><button data-q="Mario" data-type="movie">Mario</button><button data-q="Interstellar" data-type="movie">Interstellar</button><button data-q="One Piece" data-type="series">One Piece</button><button data-q="The Last of Us" data-type="series">The Last of Us</button></div></div></section>
  <section class="categoryBar" aria-label="Filtres catalogue"><button class="active" data-filter="all">Tout</button><button data-filter="movie">Films</button><button data-filter="series">Series</button><button data-filter="anime">Animes</button></section>
  <section class="stats"><div class="stat"><strong id="statTitles">...</strong><span>Titres affiches</span></div><div class="stat"><strong id="statRows">...</strong><span>Categories auto</span></div><div class="stat"><strong>FR</strong><span>Sources prioritaires</span></div><div class="stat"><strong id="statUpdate">Auto</strong><span>Mise a jour TMDB</span></div></section>
  <section class="updatePanel"><div><strong>Catalogue mis a jour automatiquement</strong><span id="updateInfo">Chargement des informations...</span></div><button id="refreshCatalog">Actualiser maintenant</button></section>
  <section id="favoritesRow" class="row hidden"></section>
  <section id="historyRow" class="row hidden"></section>
  <div id="searchResults"></div>
  <div id="rows" class="loading">Chargement du catalogue...</div>
</main>
<nav class="bottomNav"><a href="/">Accueil</a><a href="/test-player">Lecteur</a><a href="/providers">Sources</a></nav>
<div id="modal" class="modal"><button id="close" class="close">X</button><div id="sheet" class="sheet"></div></div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script>
const rows=document.getElementById('rows'),searchResults=document.getElementById('searchResults'),query=document.getElementById('query'),type=document.getElementById('type'),go=document.getElementById('go'),modal=document.getElementById('modal'),sheet=document.getElementById('sheet'),closeBtn=document.getElementById('close'),suggestions=document.getElementById('suggestions'),favoritesRow=document.getElementById('favoritesRow'),historyRow=document.getElementById('historyRow'),statTitles=document.getElementById('statTitles'),statRows=document.getElementById('statRows'),statUpdate=document.getElementById('statUpdate'),updateInfo=document.getElementById('updateInfo'),refreshCatalog=document.getElementById('refreshCatalog'),categoryBtns=[...document.querySelectorAll('.categoryBar button')];let detailHls=null,activeCatalogFilter='all';
const noPoster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="312" height="464"><rect width="100%" height="100%" fill="#111426"/><text x="50%" y="48%" fill="#8b5cf6" font-family="Arial" font-size="26" text-anchor="middle">MADRADOR</text><text x="50%" y="56%" fill="#60a5fa" font-family="Arial" font-size="20" text-anchor="middle">FILM</text></svg>');
function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function playerUrl(item){return '/test-player?q='+encodeURIComponent(item.title)+'&type='+encodeURIComponent(item.type)+'&id='+encodeURIComponent(item.id||'')+'&year='+encodeURIComponent(item.year||'')+'&autoload=1'}
function keyFor(item){return item.type+':'+item.id}
function readStore(name){try{return JSON.parse(localStorage.getItem(name)||'[]')}catch(e){return []}}
function writeStore(name,value){localStorage.setItem(name,JSON.stringify(value.slice(0,24)))}
function saveRecent(item){const key=keyFor(item);writeStore('madradorHistory',[item].concat(readStore('madradorHistory').filter(x=>keyFor(x)!==key)))}
function isFav(item){const key=keyFor(item);return readStore('madradorFavorites').some(x=>keyFor(x)===key)}
function toggleFav(item){const key=keyFor(item),list=readStore('madradorFavorites');writeStore('madradorFavorites',isFav(item)?list.filter(x=>keyFor(x)!==key):[item].concat(list));renderLocalRows();return isFav(item)}
function card(item){return '<button class="poster" data-title="'+esc(item.title)+'" data-type="'+item.type+'" data-id="'+esc(item.id)+'" data-year="'+esc(item.year||'')+'"><img src="'+esc(item.poster||noPoster)+'" alt=""><strong>'+esc(item.title)+'</strong><small>'+esc(item.year||'')+' · '+esc(item.type==='series'?'Serie':'Film')+'</small></button>'}
function bindPosters(root){root.querySelectorAll('.poster').forEach(b=>b.onclick=()=>openDetails({id:b.dataset.id,type:b.dataset.type,title:b.dataset.title,year:b.dataset.year}))}
function renderLocalRows(){const favs=readStore('madradorFavorites'),hist=readStore('madradorHistory');favoritesRow.className='row '+(favs.length?'':'hidden');favoritesRow.innerHTML=favs.length?'<div class="rowHead"><h2>Favoris</h2><button class="miniBtn" id="clearFavs">Vider</button></div><div class="rail">'+favs.map(card).join('')+'</div>':'';historyRow.className='row '+(hist.length?'':'hidden');historyRow.innerHTML=hist.length?'<div class="rowHead"><h2>Recemment ouverts</h2><button class="miniBtn" id="clearHistory">Vider</button></div><div class="rail">'+hist.map(card).join('')+'</div>':'';bindPosters(favoritesRow);bindPosters(historyRow);const cf=document.getElementById('clearFavs'),ch=document.getElementById('clearHistory');if(cf)cf.onclick=()=>{writeStore('madradorFavorites',[]);renderLocalRows()};if(ch)ch.onclick=()=>{writeStore('madradorHistory',[]);renderLocalRows()}}
function renderSources(streams){if(!streams.length)return '<div class="empty"><strong>Aucune source trouvee.</strong><span class="hint">Essaie un autre titre, ou relance la recherche si le provider vient de changer de domaine.</span></div>';return '<div class="sourceList">'+streams.slice(0,12).map((s,i)=>{const text=[s.title||s.description].filter(Boolean).join(' · ');const format=s.format||(/m3u8/i.test(s.url||'')?'HLS':/\\.mp4/i.test(s.url||'')?'MP4':'Direct');const language=s.language||'FR';const quality=s.quality||'HD';return '<button class="sourceCard '+(i===0?'best':'')+'" data-index="'+i+'"><strong>'+esc(s.name||('Source '+(i+1)))+'</strong><small>'+esc(text.slice(0,130)||'Source detectee automatiquement')+'</small><div class="badges"><span class="chip good">'+esc(format)+'</span><span class="chip">'+esc(language)+'</span><span class="chip">'+esc(quality)+'</span></div></button>'}).join('')+'</div>'}
async function openDetails(item){
  modal.className='modal open';
  document.body.classList.add('modalLock');
  if(detailHls){detailHls.destroy();detailHls=null}
  sheet.innerHTML='<div class="skeleton"></div>';
  try{
    const d=await fetch('/details.json?type='+encodeURIComponent(item.type)+'&id='+encodeURIComponent(item.id)).then(r=>r.json());
    saveRecent({id:d.id,type:d.type,title:d.title,year:d.year,poster:d.poster});
    const play=playerUrl(d);
    const favLabel=isFav(d)?'Retirer des favoris':'Ajouter aux favoris';
    sheet.innerHTML='<div class="detailHero" style="background-image:linear-gradient(90deg,rgba(8,10,25,.98),rgba(8,10,25,.68)),url('+esc(d.backdrop||'')+')"><img class="detailPoster" src="'+esc(d.poster||noPoster)+'" alt=""><div class="detailText"><span class="chip">'+esc(d.type==='series'?'Serie':'Film')+'</span><h2>'+esc(d.title)+'</h2><div class="meta">'+esc([d.year,d.rating?('TMDB '+Number(d.rating).toFixed(1)):'',d.genres&&d.genres.join(', ')].filter(Boolean).join(' · '))+'</div><p class="overview">'+esc(d.overview||'Aucun resume disponible.')+'</p><div class="detailActions"><button id="playNow">Ouvrir dans le lecteur</button><button id="favBtn" class="miniBtn">'+favLabel+'</button><button id="copyBtn" class="miniBtn">Copier le lien</button></div></div></div><div class="sourcePanel"><div class="sourcePlayer" id="sourcePlayer"><video id="detailVideo" controls playsinline></video><div class="sourcePlayerInfo"><strong id="detailNow">Lecture</strong><span class="sourceStatus" id="detailStatus">Pret</span></div></div><div class="sourceHead"><div><strong>Sources disponibles</strong><div class="meta" id="sourceMeta">Recherche automatique en cours...</div></div><button class="miniBtn" id="refreshSources">Relancer</button></div><div id="sourceList" class="empty">Chargement des sources...</div></div>';
    document.getElementById('playNow').onclick=()=>location.href=play;
    document.getElementById('copyBtn').onclick=()=>navigator.clipboard.writeText(location.origin+play);
    document.getElementById('favBtn').onclick=()=>{document.getElementById('favBtn').textContent=toggleFav({id:d.id,type:d.type,title:d.title,year:d.year,poster:d.poster})?'Retirer des favoris':'Ajouter aux favoris'};
    async function playSource(s,button){
      if(!s||!s.url)return;
      const playerBox=document.getElementById('sourcePlayer');
      document.querySelectorAll('.sourceCard.active').forEach(x=>x.classList.remove('active'));
      if(button)button.classList.add('active');
      const box=playerBox,video=document.getElementById('detailVideo'),now=document.getElementById('detailNow'),status=document.getElementById('detailStatus');
      box.className='sourcePlayer open';
      box.scrollIntoView({block:'nearest',behavior:'smooth'});
      now.textContent=(s.name||'Source')+' · '+(s.format||'Direct');
      status.textContent='Chargement...';
      if(detailHls){detailHls.destroy();detailHls=null}
      video.removeAttribute('src');video.load();
      if(String(s.url).includes('.m3u8')){
        if(window.Hls&&Hls.isSupported()){
          detailHls=new Hls({enableWorker:true,lowLatencyMode:false});
          detailHls.loadSource(s.url);
          detailHls.attachMedia(video);
          detailHls.on(Hls.Events.ERROR,(e,data)=>{status.textContent=data.fatal?'Erreur HLS':'Lecture HLS ajustee'});
        }else if(video.canPlayType('application/vnd.apple.mpegurl')){
          video.src=s.url;
        }else{
          status.textContent='HLS non supporte ici';
          return;
        }
      }else{
        video.src=s.url;
      }
      await video.play().then(()=>{status.textContent='Lecture en cours'}).catch(e=>{status.textContent='Clique sur lecture si le navigateur bloque';});
    }
    async function loadSources(){
      const list=document.getElementById('sourceList'),meta=document.getElementById('sourceMeta');
      list.className='empty';
      list.innerHTML='<strong>Recherche des sources...</strong><span class="hint">Les providers FR sont testes en parallele.</span>';
      try{
        const data=await fetch('/stream/'+encodeURIComponent(d.type)+'/'+encodeURIComponent(d.id)+'.json').then(r=>r.json());
        const streams=data.streams||[];
        meta.textContent=streams.length+' source'+(streams.length>1?'s':'')+' trouvee'+(streams.length>1?'s':'')+' · MP4/VF priorises';
        list.className='';
        list.innerHTML=renderSources(streams);
        list.querySelectorAll('.sourceCard').forEach(btn=>btn.onclick=()=>playSource(streams[Number(btn.dataset.index)],btn));
      }catch(e){
        meta.textContent='Erreur pendant la recherche';
        list.className='empty';
        list.innerHTML='<strong>Impossible de charger les sources.</strong><span class="hint">'+esc(e.message||e)+'</span>';
      }
    }
    document.getElementById('refreshSources').onclick=loadSources;
    renderLocalRows();
    loadSources();
  }catch(e){
    sheet.innerHTML='<div class="empty">Impossible de charger la fiche: '+esc(e.message||e)+'</div>';
  }
}
async function searchCatalog(){const q=query.value.trim();if(!q)return;searchResults.innerHTML='<section class="row"><div class="rowHead"><h2>Recherche</h2><span class="chip">Chargement</span></div><div class="empty">Recherche en cours...</div></section>';const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(q)).then(r=>r.json());searchResults.innerHTML='<section class="row"><div class="rowHead"><h2>Recherche</h2><span class="chip">'+data.results.length+' titres</span></div><div class="rail">'+data.results.map(card).join('')+'</div></section>';bindPosters(searchResults)}
let suggestTimer=0;async function loadSuggestions(){const q=query.value.trim();clearTimeout(suggestTimer);if(q.length<2){suggestions.className='suggestions';suggestions.innerHTML='';return}suggestTimer=setTimeout(async()=>{try{const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(q)).then(r=>r.json());const items=(data.results||[]).slice(0,5);suggestions.className='suggestions '+(items.length?'open':'');suggestions.innerHTML=items.map(item=>'<button class="suggestion" data-title="'+esc(item.title)+'" data-type="'+item.type+'" data-id="'+esc(item.id)+'" data-year="'+esc(item.year||'')+'"><img src="'+esc(item.poster||noPoster)+'" alt=""><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.year||'')+' · '+esc(item.type==='series'?'Serie':'Film')+'</small></span><span class="chip">Ouvrir</span></button>').join('');suggestions.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>{suggestions.className='suggestions';openDetails({id:b.dataset.id,type:b.dataset.type,title:b.dataset.title,year:b.dataset.year})})}catch(e){suggestions.className='suggestions'}},260)}
function applyCatalogFilter(){categoryBtns.forEach(btn=>btn.classList.toggle('active',btn.dataset.filter===activeCatalogFilter));let visible=0;rows.querySelectorAll('.row').forEach(row=>{const group=row.dataset.group||'movie';const show=activeCatalogFilter==='all'||group===activeCatalogFilter;row.style.display=show?'':'none';if(show)visible+=1});statRows.textContent=visible}
function formatDateTime(value){try{return new Date(value).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}catch(e){return '-'}}
async function load(force){try{rows.innerHTML='<div class="skeleton"></div>';const data=await fetch('/catalog.json'+(force?'?refresh=1':'')).then(r=>r.json());const total=(data.rows||[]).reduce((n,row)=>n+(row.items||[]).length,0);statTitles.textContent=total;statUpdate.textContent=Math.round((data.cacheTtlMs||0)/60000)+' min';updateInfo.textContent='Derniere generation: '+formatDateTime(data.generatedAt)+' · Prochaine verification: '+formatDateTime(data.nextRefreshAt);rows.innerHTML=data.rows.map(row=>'<section class="row" data-group="'+esc(row.group||'movie')+'"><div class="rowHead"><h2>'+esc(row.title)+'</h2><span class="rowCount">'+row.items.length+' titres</span></div><div class="rail">'+row.items.map(card).join('')+'</div></section>').join('');bindPosters(rows);applyCatalogFilter()}catch(e){rows.innerHTML='<div class="empty">Erreur catalogue: '+esc(e.message||e)+'</div>';statTitles.textContent='0';statRows.textContent='0';updateInfo.textContent='Impossible de lire la mise a jour auto.'}}
function closeModal(){if(detailHls){detailHls.destroy();detailHls=null}modal.className='modal';document.body.classList.remove('modalLock')}
go.onclick=()=>searchCatalog().catch(e=>{searchResults.innerHTML='<div class="empty">Erreur recherche: '+esc(e.message||e)+'</div>'});refreshCatalog.onclick=()=>load(true);document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{query.value=b.dataset.q;type.value=b.dataset.type;go.click()});categoryBtns.forEach(btn=>btn.onclick=()=>{activeCatalogFilter=btn.dataset.filter;applyCatalogFilter()});query.addEventListener('input',loadSuggestions);type.addEventListener('change',loadSuggestions);query.addEventListener('keydown',e=>{if(e.key==='Enter')go.click();if(e.key==='Escape')closeModal()});closeBtn.onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};renderLocalRows();load(false);
</script>
</body>
</html>`;
}

function renderProvidersPage() {
  const frenchProviders = nuvioManifest.scrapers
    .filter((provider) => (provider.contentLanguage || []).includes("fr"))
    .slice()
    .sort((a, b) => {
      const aEnabled = a.enabled !== false ? 0 : 1;
      const bEnabled = b.enabled !== false ? 0 : 1;
      if (aEnabled !== bEnabled) return aEnabled - bEnabled;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });

  const summary = frenchProviders.reduce((acc, provider) => {
    const state = getProviderState(provider);
    acc.total += 1;
    if (provider.enabled !== false) acc.testable += 1;
    if (animeProviders.has(provider.id)) acc.anime += 1;
    if (state === "Actif") acc.active += 1;
    else if (state === "Instable") acc.unstable += 1;
    else if (provider.enabled === false) acc.pending += 1;
    else acc.limited += 1;
    return acc;
  }, { total: 0, testable: 0, active: 0, unstable: 0, limited: 0, pending: 0, anime: 0 });

  const cards = frenchProviders.map((provider) => {
    const languages = (provider.contentLanguage || ["fr"]).join(", ").toUpperCase();
    const formats = (provider.formats || []).join(", ").toUpperCase() || "-";
    const domainList = getProviderDomains(provider.id);
    const state = getProviderState(provider);
    const enabled = provider.enabled !== false;
    const type = animeProviders.has(provider.id) ? "anime" : "movie";
    const cls = state === "Actif" ? "ok" : state === "Instable" ? "warn" : enabled ? "limited" : "pending";
    const searchText = [provider.name, provider.id, state, languages, formats, domainList.join(" "), type].join(" ").toLowerCase();
    const testLabel = enabled ? "Tester" : "A porter";
    return "<article class=\"providerCard " + cls + "\" data-id=\"" + escapeHtml(provider.id) + "\" data-state=\"" + escapeHtml(state.toLowerCase()) + "\" data-type=\"" + type + "\" data-testable=\"" + (enabled ? "1" : "0") + "\" data-row=\"" + escapeHtml(searchText) + "\">" +
      "<div class=\"providerTop\"><div><strong>" + escapeHtml(provider.name || provider.id) + "</strong><small>" + escapeHtml(provider.id) + "</small></div><span class=\"state " + cls + "\">" + escapeHtml(state) + "</span></div>" +
      "<div class=\"chips\"><span>" + escapeHtml(type === "anime" ? "Anime" : "Films/Series") + "</span><span>" + escapeHtml(languages) + "</span><span>" + escapeHtml(formats) + "</span></div>" +
      "<div class=\"domains\">" + escapeHtml(domainList.join(" · ") || (enabled ? "Domaine interne ou API" : "Source Kotlin conservee, port JavaScript a faire")) + "</div>" +
      "<div class=\"providerActions\"><button class=\"testBtn\" data-id=\"" + escapeHtml(provider.id) + "\"" + (enabled ? "" : " disabled") + ">" + testLabel + "</button><span class=\"testResult\">" + (enabled ? "Non teste" : "Non actif") + "</span></div>" +
    "</article>";
  }).join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fournisseurs Madrador Film</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb;--ok:#38bdf8;--warn:#f59e0b;--bad:#fb7185;--green:#22c55e}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 12% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 88% 8%,rgba(37,99,235,.26),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.16),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1220px,calc(100% - 32px));margin:0 auto;padding:22px 0 64px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:9px;font-weight:900;font-size:22px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.brand img{width:24px;height:24px;border-radius:6px}.nav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px;margin-left:14px}.hero{padding:32px 0 18px;border-bottom:1px solid var(--line)}h1{font-size:clamp(38px,6vw,72px);line-height:1;margin:0 0 10px}.lead{max-width:780px;color:#dbeafe;font-size:18px}.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:20px 0}.card{background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;padding:14px}.card strong{display:block;font-size:25px}.card span{color:var(--muted);font-size:12px}.toolbar{display:grid;grid-template-columns:1fr auto;gap:10px;margin:18px 0 10px}input{min-height:44px;border-radius:7px;border:1px solid #303866;background:#080b1d;color:#fff;padding:0 12px;font:inherit}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px}.filters button,.testAll,.testBtn{min-height:38px;border:1px solid #303866;border-radius:999px;background:#10142b;color:#fff;font:inherit;font-weight:900;padding:0 13px;cursor:pointer}.filters button.active,.testAll,.testBtn{background:linear-gradient(135deg,#7c3aed,#2563eb);border-color:transparent}.testBtn:disabled{opacity:.55;cursor:not-allowed;background:#1d2446}.resultLine{margin:10px 0 16px;color:#dbeafe;background:#10142b;border:1px solid #303866;border-radius:8px;padding:12px}.progress{height:8px;background:#10142b;border:1px solid #303866;border-radius:999px;overflow:hidden;margin-top:10px}.bar{height:100%;width:0;background:linear-gradient(90deg,#38bdf8,#8b5cf6);transition:width .2s}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.providerCard{background:rgba(17,20,38,.92);border:1px solid #29305c;border-radius:8px;padding:14px;min-height:188px;display:flex;flex-direction:column;gap:12px}.providerCard.ok{border-color:rgba(56,189,248,.45)}.providerCard.warn{border-color:rgba(245,158,11,.55)}.providerCard.pending,.providerCard.limited{opacity:.9}.providerTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.providerTop strong{display:block;font-size:18px}.providerTop small{display:block;color:var(--muted);margin-top:2px}.state{display:inline-flex;align-items:center;min-height:26px;border-radius:999px;padding:0 9px;background:#1d2446;font-size:12px;font-weight:900;white-space:nowrap}.state.ok{color:#bae6fd}.state.warn{color:#fde68a}.state.pending,.state.limited{color:#fecdd3}.chips{display:flex;gap:6px;flex-wrap:wrap}.chips span{display:inline-flex;align-items:center;min-height:24px;border-radius:999px;padding:0 8px;background:#1d2446;color:#dbeafe;font-size:11px;font-weight:900}.domains{color:#b8c0e0;font-size:13px;min-height:38px;overflow-wrap:anywhere}.providerActions{margin-top:auto;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}.testResult{color:#b8c0e0;font-size:13px}.testResult.ok{color:#86efac}.testResult.warn{color:#fde68a}.testResult.bad{color:#fda4af}.hidden{display:none}.note{color:#b8c0e0;font-size:13px;margin-top:18px}@media(max-width:980px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){main{width:min(100% - 20px,1220px);padding:14px 0 86px}.nav{height:auto;display:grid}.nav a{margin:0 10px 0 0}.brand{font-size:20px}.brand img{width:22px;height:22px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.providerActions{grid-template-columns:1fr}.testAll{width:100%}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand"><img src="/brand.svg" alt="">MADRADOR FILM</div><nav><a href="/">Accueil</a><a href="/test-player">Lecteur</a><a href="/catalog">Catalogue</a></nav></header>
  <section class="hero"><span class="state ok">Fournisseurs FR</span><h1>Sources francaises</h1><p class="lead">Tous les fournisseurs francais trouves dans le depot : actifs, instables, limites et sources Kotlin a porter. Les providers actifs peuvent etre testes automatiquement depuis cette page.</p></section>
  <section class="cards"><div class="card"><strong>${summary.total}</strong><span>FR repertories</span></div><div class="card"><strong>${summary.testable}</strong><span>Testables</span></div><div class="card"><strong>${summary.active}</strong><span>Actifs</span></div><div class="card"><strong>${summary.unstable}</strong><span>Instables</span></div><div class="card"><strong>${summary.pending}</strong><span>A porter</span></div><div class="card"><strong>${summary.anime}</strong><span>Animes</span></div></section>
  <div class="toolbar"><input id="filter" placeholder="Filtrer par nom, domaine, format, anime..."><button id="testAll" class="testAll">Tout tester automatiquement</button></div>
  <div class="filters"><button class="active" data-filter="all">Tout</button><button data-filter="actif">Actifs</button><button data-filter="instable">Instables</button><button data-filter="limite">Limites</button><button data-filter="desactive">A porter</button><button data-filter="anime">Anime</button><button data-filter="movie">Films/Series</button></div>
  <div id="providerResult" class="resultLine">Pret. Clique sur un provider, ou lance le test automatique de tous les providers actifs.</div>
  <div class="progress"><div id="bar" class="bar"></div></div>
  <section id="providersGrid" class="grid">${cards}</section>
  <p class="note">Les sources marquees "A porter" sont conservees en reference mais ne sont pas encore activees en JavaScript. Elles sont affichees pour suivre ce qui peut etre ajoute ensuite.</p>
</main>
<script>
const filter=document.getElementById('filter'),result=document.getElementById('providerResult'),bar=document.getElementById('bar'),testAll=document.getElementById('testAll'),cards=[...document.querySelectorAll('.providerCard')],filterBtns=[...document.querySelectorAll('.filters button')];let activeFilter='all';
function visibleCards(){return cards.filter(card=>card.style.display!=='none')}
function setResult(text){result.textContent=text}
function applyFilter(){const q=filter.value.trim().toLowerCase();filterBtns.forEach(btn=>btn.classList.toggle('active',btn.dataset.filter===activeFilter));cards.forEach(card=>{const state=card.dataset.state,type=card.dataset.type,row=card.dataset.row;let ok=!q||row.includes(q);if(activeFilter==='anime')ok=ok&&type==='anime';else if(activeFilter==='movie')ok=ok&&type==='movie';else if(activeFilter!=='all')ok=ok&&state===activeFilter;card.style.display=ok?'':'none'});setResult(visibleCards().length+' fournisseur(s) affiche(s).')}
async function testProvider(card){const id=card.dataset.id,btn=card.querySelector('.testBtn'),out=card.querySelector('.testResult');if(card.dataset.testable!=='1')return null;btn.classList.add('loading');btn.textContent='Test...';out.textContent='En cours...';out.className='testResult';try{const data=await fetch('/diagnostics.json?providers='+encodeURIComponent(id)).then(r=>r.json());const r=data.results&&data.results[0];const status=r?r.status:'ERROR';out.textContent=status+' · '+(r?r.streams:0)+' source(s) · '+(r?r.timeMs:0)+'ms · score '+(r&&r.score!==undefined?r.score:'?');out.className='testResult '+(status==='OK'?'ok':status==='ZERO_RESULT'?'warn':'bad');return r}catch(e){out.textContent='Erreur: '+(e.message||e);out.className='testResult bad';return null}finally{btn.classList.remove('loading');btn.textContent='Tester'}}
document.querySelectorAll('.testBtn').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('.providerCard');setResult('Test de '+card.dataset.id+'...');const r=await testProvider(card);setResult(card.dataset.id+' termine: '+(r?r.status:'erreur'));});
testAll.onclick=async()=>{const todo=cards.filter(card=>card.dataset.testable==='1'&&card.style.display!=='none');if(!todo.length){setResult('Aucun provider testable dans ce filtre.');return}testAll.disabled=true;let ok=0,zero=0,err=0;for(let i=0;i<todo.length;i++){const card=todo[i];bar.style.width=Math.round((i/todo.length)*100)+'%';setResult('Test '+(i+1)+'/'+todo.length+' : '+card.dataset.id);const r=await testProvider(card);if(r&&r.status==='OK')ok++;else if(r&&r.status==='ZERO_RESULT')zero++;else err++;}bar.style.width='100%';setResult('Tests termines : '+ok+' OK, '+zero+' sans source, '+err+' en erreur.');testAll.disabled=false;};
filter.addEventListener('input',applyFilter);filterBtns.forEach(btn=>btn.onclick=()=>{activeFilter=btn.dataset.filter;applyFilter()});applyFilter();
</script>
</body>
</html>`;
}

function isAdminAuthorized(req, url) {
  const token = req.headers["x-admin-token"] || url.searchParams.get("token") || "";
  if (!ADMIN_TOKEN) return false;
  return token === ADMIN_TOKEN;
}

function renderLegalPage(kind) {
  const title = kind === "security" ? "Securite" : kind === "dmca" ? "DMCA" : "Legal";
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - Madrador Film</title>
<style>body{margin:0;background:#070817;color:#f7f7ff;font-family:Inter,system-ui,Segoe UI,sans-serif}.wrap{max-width:900px;margin:auto;padding:42px 20px;line-height:1.7}a{color:#7dd3fc}.card{border:1px solid rgba(125,211,252,.22);background:rgba(16,20,48,.72);border-radius:18px;padding:24px}h1{margin-top:0}</style></head>
<body><main class="wrap"><a href="/">Retour</a><div class="card"><h1>${title}</h1>
<p>Madrador Film est une interface de catalogue et de test de providers. Le projet ne stocke aucune video, ne contourne pas de DRM, ne contourne pas de paywall et ne doit pas utiliser de cookies prives ou d'acces caches.</p>
<p>Si un lien ou provider pose probleme, il doit etre desactive ou corrige de maniere responsable.</p>
<p>Pour l'administration, configure <code>ADMIN_TOKEN</code> et garde-le prive.</p></div></main></body></html>`;
}

function renderAdminPage() {
  const statuses = providerStatusService.getProviderStatuses();
  const values = Object.values(statuses);
  const counts = values.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const activeProviders = nuvioManifest.scrapers.filter((provider) => provider.enabled !== false);
  const disabledProviders = nuvioManifest.scrapers.filter((provider) => provider.enabled === false);
  const cacheSize = Array.from(memoryCache.values()).reduce((sum, entry) => sum + JSON.stringify(entry.value || {}).length, 0);
  const actionsEnabled = ENABLE_ADMIN && Boolean(ADMIN_TOKEN);
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin - Madrador Film</title>
<style>
:root{color-scheme:dark;--bg:#070817;--panel:#101430;--line:#2d3a73;--cyan:#44c7ff;--violet:#8b5cf6;--muted:#aeb8da}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#20105a,transparent 36%),var(--bg);color:#fff;font-family:Inter,system-ui,Segoe UI,sans-serif}.wrap{max-width:1180px;margin:auto;padding:28px 18px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.brand{font-size:26px;font-weight:900}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:20px 0}.card{background:rgba(16,20,48,.86);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.num{font-size:30px;font-weight:900;color:var(--cyan)}.muted{color:var(--muted)}button,input{border:1px solid var(--line);border-radius:12px;background:#0b1028;color:#fff;padding:12px 14px}button{cursor:pointer;font-weight:800;background:linear-gradient(135deg,var(--cyan),var(--violet))}.actions{display:flex;flex-wrap:wrap;gap:10px}pre{white-space:pre-wrap;max-height:340px;overflow:auto;background:#050711;border-radius:12px;padding:14px}
</style></head>
<body><main class="wrap"><div class="top"><div><a style="color:#7dd3fc" href="/">Catalogue</a><div class="brand">Admin Madrador Film</div><p class="muted">Actions protegees par ADMIN_TOKEN. Aucun secret n'est affiche.</p></div><span class="muted">v${SITE_VERSION}</span></div>
<section class="grid">
<div class="card"><div class="muted">Uptime</div><div class="num">${Math.round(process.uptime())}s</div></div>
<div class="card"><div class="muted">Node</div><div class="num">${process.version}</div></div>
<div class="card"><div class="muted">Providers actifs</div><div class="num">${activeProviders.length}</div></div>
<div class="card"><div class="muted">Providers desactives</div><div class="num">${disabledProviders.length}</div></div>
<div class="card"><div class="muted">OK</div><div class="num">${counts.OK || 0}</div></div>
<div class="card"><div class="muted">Lents</div><div class="num">${counts.LENT || 0}</div></div>
<div class="card"><div class="muted">Timeout</div><div class="num">${counts.TIMEOUT || 0}</div></div>
<div class="card"><div class="muted">Cache memoire</div><div class="num">${memoryCache.size}</div><div class="muted">${Math.round(cacheSize / 1024)} Ko approx.</div></div>
</section>
<section class="card"><h2>Actions</h2><p class="muted">${actionsEnabled ? "Entre ton token pour lancer une action." : "Actions desactivees tant que ENABLE_ADMIN=true et ADMIN_TOKEN ne sont pas configures."}</p><input id="token" type="password" placeholder="ADMIN_TOKEN"><div class="actions"><button data-action="/admin/cache/clear">Vider cache</button><button data-action="/admin/catalog/refresh">Refresh catalogue</button><button data-action="/admin/providers/test">Tester providers</button><button data-action="/admin/domains/check">Tester domaines</button></div><pre id="out">Pret.</pre></section>
<script>
const out=document.getElementById('out');document.querySelectorAll('button[data-action]').forEach(btn=>btn.onclick=async()=>{out.textContent='En cours...';try{const r=await fetch(btn.dataset.action,{method:'POST',headers:{'x-admin-token':document.getElementById('token').value}});out.textContent=JSON.stringify(await r.json(),null,2)}catch(e){out.textContent=e.message}});
</script></main></body></html>`;
}
async function searchTmdb(query, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
  const normalizedQuery = query.trim().toLowerCase();
  if (!TMDB_API_KEY) {
    const matches = fallbackItems
      .filter((item) => item.type === (type === "tv" ? "series" : "movie"))
      .filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      .slice(0, 10);
    return matches.length ? matches : fallbackItems
      .filter((item) => item.type === (type === "tv" ? "series" : "movie"))
      .slice(0, 10);
  }
  return cachedJson("search:" + type + ":" + normalizedQuery, async () => {
    const endpoint = "https://api.themoviedb.org/3/search/" + type +
      "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
      "&language=fr-FR&query=" + encodeURIComponent(query);
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("TMDB search failed: HTTP " + response.status);
    const data = await response.json();
    return (data.results || []).slice(0, 10).map((item) => ({
      id: String(item.id),
      type: type === "tv" ? "series" : "movie",
      title: item.title || item.name || "Sans titre",
      year: String(item.release_date || item.first_air_date || "").slice(0, 4),
      poster: item.poster_path ? "https://image.tmdb.org/t/p/w185" + item.poster_path : null
    }));
  }, SEARCH_CACHE_TTL_MS);
}

async function getTmdbDetails(tmdbId, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
  if (!TMDB_API_KEY) {
    return fallbackItems.find((item) => item.id === String(tmdbId)) || {
      id: String(tmdbId),
      type: type === "tv" ? "series" : "movie",
      title: "Titre indisponible",
      year: "",
      overview: "Configure TMDB_API_KEY pour charger les details complets.",
      poster: null,
      backdrop: null,
      rating: 0,
      genres: []
    };
  }
  return cachedJson("details:" + type + ":" + tmdbId, async () => {
    const endpoint = "https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(tmdbId) +
      "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
      "&language=fr-FR";
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("TMDB details failed: HTTP " + response.status);
    const data = await response.json();
    return {
      id: String(data.id),
      type: type === "tv" ? "series" : "movie",
      title: data.title || data.name || "Sans titre",
      year: String(data.release_date || data.first_air_date || "").slice(0, 4),
      overview: data.overview || "",
      poster: data.poster_path ? "https://image.tmdb.org/t/p/w342" + data.poster_path : null,
      backdrop: data.backdrop_path ? "https://image.tmdb.org/t/p/original" + data.backdrop_path : null,
      rating: data.vote_average || 0,
      genres: Array.isArray(data.genres) ? data.genres.map((genre) => genre.name).filter(Boolean) : []
    };
  }, 24 * 60 * 60 * 1000);
}

function normalizeTmdbItem(item, type) {
  return {
    id: String(item.id),
    type: type === "tv" ? "series" : "movie",
    title: item.title || item.name || "Sans titre",
    year: String(item.release_date || item.first_air_date || "").slice(0, 4),
    poster: item.poster_path ? "https://image.tmdb.org/t/p/w342" + item.poster_path : null,
    backdrop: item.backdrop_path ? "https://image.tmdb.org/t/p/w780" + item.backdrop_path : null,
    rating: item.vote_average || 0
  };
}

async function tmdbList(pathname, params, type) {
  if (!TMDB_API_KEY) {
    return fallbackItems.filter((item) => item.type === (type === "tv" ? "series" : "movie"));
  }
  const search = new URLSearchParams(Object.assign({
    api_key: TMDB_API_KEY,
    language: "fr-FR",
    region: "FR"
  }, params || {}));
  const url = "https://api.themoviedb.org/3" + pathname + "?" + search.toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error("TMDB list failed: HTTP " + response.status);
  const data = await response.json();
  return (data.results || [])
    .filter((item) => item.poster_path)
    .slice(0, 18)
    .map((item) => normalizeTmdbItem(item, type));
}

async function catalogRow(id, group, title, pathname, params, type) {
  const pages = params && params.pages ? Number(params.pages) : 1;
  const cleanParams = Object.assign({}, params || {});
  delete cleanParams.pages;
  const lists = [];
  for (let page = 1; page <= pages; page += 1) {
    lists.push(tmdbList(pathname, Object.assign({}, cleanParams, { page: String(page) }), type));
  }
  const seen = new Set();
  const items = (await Promise.all(lists))
    .flat()
    .filter((item) => {
      const key = item.type + ":" + item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 36);
  return { id, group, title, items };
}

async function getCatalogRows(forceRefresh) {
  const cacheKey = "catalog:v4";
  if (forceRefresh) memoryCache.delete(cacheKey);
  return cachedJson(cacheKey, async () => {
    if (!TMDB_API_KEY) {
      const movies = fallbackItems.filter((item) => item.type === "movie");
      const series = fallbackItems.filter((item) => item.type === "series");
      const anime = series.filter((item) => /one piece|naruto|demon|attack|attaque|jujutsu|fullmetal/i.test(item.title));
      const rows = [
        { id: "trending-day", group: "movie", title: "Tendances du jour", items: movies.slice(0, 12) },
        { id: "popular-movies", group: "movie", title: "Films populaires", items: movies },
        { id: "popular-series", group: "series", title: "Series populaires", items: series },
        { id: "anime", group: "series", title: "Animes", items: anime.length ? anime : series },
        { id: "french-movies", group: "movie", title: "Films francais", items: movies.slice().reverse() },
        { id: "new-movies", group: "movie", title: "Nouveautes", items: movies.slice(0, 8) }
      ];
      return {
        rows,
        generatedAt: new Date().toISOString(),
        nextRefreshAt: new Date(Date.now() + CATALOG_CACHE_TTL_MS).toISOString(),
        cacheTtlMs: CATALOG_CACHE_TTL_MS,
        fallback: true,
        warning: "TMDB_API_KEY absent: catalogue local de secours."
      };
    }
    const rows = await Promise.all([
      catalogRow("trending-day", "movie", "Tendances du jour", "/trending/movie/day", { pages: 2 }, "movie"),
      catalogRow("trending-week", "movie", "Tendances de la semaine", "/trending/movie/week", { pages: 2 }, "movie"),
      catalogRow("new-movies", "movie", "Sorties cinema France", "/movie/now_playing", { pages: 2 }, "movie"),
      catalogRow("upcoming-movies", "movie", "Bientot au cinema", "/movie/upcoming", { pages: 2 }, "movie"),
      catalogRow("popular-movies", "movie", "Films populaires", "/movie/popular", { pages: 2 }, "movie"),
      catalogRow("top-movies", "movie", "Films les mieux notes", "/movie/top_rated", { pages: 2 }, "movie"),
      catalogRow("action", "movie", "Action", "/discover/movie", { sort_by: "popularity.desc", with_genres: "28", pages: 2 }, "movie"),
      catalogRow("thriller", "movie", "Thriller", "/discover/movie", { sort_by: "popularity.desc", with_genres: "53", pages: 2 }, "movie"),
      catalogRow("horror", "movie", "Horreur", "/discover/movie", { sort_by: "popularity.desc", with_genres: "27", pages: 2 }, "movie"),
      catalogRow("comedy", "movie", "Comedies", "/discover/movie", { sort_by: "popularity.desc", with_genres: "35", pages: 2 }, "movie"),
      catalogRow("romance", "movie", "Romance", "/discover/movie", { sort_by: "popularity.desc", with_genres: "10749", pages: 2 }, "movie"),
      catalogRow("sci-fi", "movie", "Science-fiction", "/discover/movie", { sort_by: "popularity.desc", with_genres: "878", pages: 2 }, "movie"),
      catalogRow("family", "movie", "Famille", "/discover/movie", { sort_by: "popularity.desc", with_genres: "10751", pages: 2 }, "movie"),
      catalogRow("french-movies", "movie", "Films francais", "/discover/movie", { sort_by: "popularity.desc", with_original_language: "fr", pages: 2 }, "movie"),
      catalogRow("popular-series", "series", "Series populaires", "/tv/popular", { pages: 2 }, "tv"),
      catalogRow("airing-series", "series", "Episodes en diffusion", "/tv/on_the_air", { pages: 2 }, "tv"),
      catalogRow("top-series", "series", "Series les mieux notees", "/tv/top_rated", { pages: 2 }, "tv"),
      catalogRow("drama-series", "series", "Series drama", "/discover/tv", { sort_by: "popularity.desc", with_genres: "18", pages: 2 }, "tv"),
      catalogRow("crime-series", "series", "Crime et enquete", "/discover/tv", { sort_by: "popularity.desc", with_genres: "80", pages: 2 }, "tv"),
      catalogRow("comedy-series", "series", "Series comedie", "/discover/tv", { sort_by: "popularity.desc", with_genres: "35", pages: 2 }, "tv"),
      catalogRow("french-series", "series", "Series francaises", "/discover/tv", { sort_by: "popularity.desc", with_original_language: "fr", pages: 2 }, "tv"),
      catalogRow("anime", "anime", "Animation et anime", "/discover/tv", { sort_by: "popularity.desc", with_genres: "16", pages: 2 }, "tv"),
      catalogRow("anime-jp", "anime", "Animes japonais", "/discover/tv", { sort_by: "popularity.desc", with_original_language: "ja", pages: 2 }, "tv"),
      catalogRow("animated-movies", "anime", "Films animation", "/discover/movie", { sort_by: "popularity.desc", with_genres: "16", pages: 2 }, "movie")
    ]);
    const generatedAt = new Date();
    return {
      generatedAt: generatedAt.toISOString(),
      nextRefreshAt: new Date(generatedAt.getTime() + CATALOG_CACHE_TTL_MS).toISOString(),
      cacheTtlMs: CATALOG_CACHE_TTL_MS,
      autoUpdate: "Le catalogue est reconstruit automatiquement depuis TMDB quand le cache expire.",
      rows
    };
  }, CATALOG_CACHE_TTL_MS);
}

async function runDiagnostics(req) {
  const ids = (req.url && new URL(req.url, "http://localhost").searchParams.get("providers") || "movix,frenchstream,nakios,toflix")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const cacheKey = "diagnostics:" + ids.join(",");

  return cachedJson(cacheKey, async () => {
    const results = [];

    for (const id of ids) {
      const provider = nuvioManifest.scrapers.find((item) => item.id === id);
      if (!provider) {
        const record = { provider: id, status: "ERROR", streams: 0, timeMs: 0, error: "Unknown provider" };
        results.push(record);
        continue;
      }

      const started = Date.now();
      try {
        const module = loadProvider(provider);
        if (!module || typeof module.getStreams !== "function") {
          throw new Error("Missing getStreams");
        }

        const result = await withTimeout(
          module.getStreams("157336", "movie"),
          Math.min(PROVIDER_TIMEOUT_MS, 60000),
          provider.id
        );
        const streams = Array.isArray(result.streams) ? result.streams : [];
        const record = {
          provider: id,
          status: streams.length > 0 ? "OK" : result.error ? "ERROR" : "ZERO_RESULT",
          streams: streams.length,
          timeMs: Date.now() - started,
          unstable: unstableProviders.has(id),
          error: result.error ? result.error.message : ""
        };
        record.score = providerStatusService.updateProviderStatus(id, record).score;
        results.push(record);
      } catch (error) {
        const record = {
          provider: id,
          status: "ERROR",
          streams: 0,
          timeMs: Date.now() - started,
          unstable: unstableProviders.has(id),
          error: error && error.message ? error.message : String(error)
        };
        record.score = providerStatusService.updateProviderStatus(id, record).score;
        results.push(record);
      }
    }

    return {
      ok: results.every((item) => item.status === "OK"),
      cachedForMs: DIAGNOSTIC_CACHE_TTL_MS,
      test: "Interstellar",
      tmdbId: "157336",
      generatedAt: new Date().toISOString(),
      results
    };
  }, DIAGNOSTIC_CACHE_TTL_MS);
}

function getConfig(req) {
  return {
    name: SITE_NAME,
    version: SITE_VERSION,
    providers: getEnabledProviders("tv").map((provider) => provider.id),
    movieProviders: getEnabledProviders("movie").map((provider) => provider.id),
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    providerFilter: PROVIDER_FILTER,
    cache: {
      defaultMs: CACHE_TTL_MS,
      searchMs: SEARCH_CACHE_TTL_MS,
      streamsMs: STREAM_CACHE_TTL_MS,
      diagnosticsMs: DIAGNOSTIC_CACHE_TTL_MS,
      catalogMs: CATALOG_CACHE_TTL_MS,
      entries: memoryCache.size
    }
  };
}

function parseStreamPath(pathname) {
  const match = pathname.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
  if (!match) return null;

  const routeType = decodeURIComponent(match[1]);
  const rawId = decodeURIComponent(match[2]);
  const parts = rawId.split(":");

  return {
    imdbId: parts[0],
    mediaType: routeType === "series" ? "tv" : "movie",
    season: parts[1] ? Number(parts[1]) : undefined,
    episode: parts[2] ? Number(parts[2]) : undefined
  };
}

function parseProxyPath(pathname) {
  const match = pathname.match(/^\/proxy\/([^/]+)(?:\/[^/]+)?$/);
  if (!match) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(match[1]));
    if (!payload || typeof payload.url !== "string") return null;
    return {
      url: payload.url,
      headers: payload.headers && typeof payload.headers === "object" ? payload.headers : {}
    };
  } catch (_) {
    return null;
  }
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

function isPlaylistUrl(url) {
  return /\.m3u8(?:[?#]|$)/i.test(url);
}

function isMp4Url(url) {
  return /\.mp4(?:[?#]|$)/i.test(url);
}

function streamText(stream) {
  return [
    stream && stream.name,
    stream && stream.title,
    stream && stream.description,
    stream && stream.quality,
    stream && stream.url
  ].filter(Boolean).join(" ").toLowerCase();
}

function getStreamFormat(stream) {
  const url = stream && stream.url || "";
  if (isMp4Url(url)) return "MP4";
  if (isPlaylistUrl(url)) return "HLS";
  return "Direct";
}

function getStreamLanguage(stream) {
  const text = streamText(stream);
  if (/\bvostfr\b|\bvost\b|subfrench|sous[- ]?titre/.test(text)) return "VOSTFR";
  if (/\bmulti\b|multilang|multi[- ]?audio/.test(text)) return "MULTI";
  if (/\bvf\b|french|francais|français|\bfr\b/.test(text)) return "VF";
  return "FR";
}

function getQualityRank(stream) {
  const text = streamText(stream);
  if (/2160|4k|uhd/.test(text)) return 0;
  if (/1080|fhd|full hd/.test(text)) return 1;
  if (/720|hd/.test(text)) return 2;
  if (/480|sd/.test(text)) return 4;
  return 3;
}

function getStreamRank(stream) {
  if (!stream || !stream.originalUrl && !stream.url) return 50;
  const url = stream.url || "";
  let rank = 0;
  if (isMp4Url(url)) rank += 0;
  else if (isPlaylistUrl(url)) rank += 20;
  else if (stream.isDirect) rank += 30;
  else rank += 40;
  const language = getStreamLanguage(stream);
  if (language === "VF" || language === "MULTI") rank += 0;
  else if (language === "VOSTFR") rank += 4;
  else rank += 8;
  rank += getQualityRank(stream);
  return rank;
}

function shouldProxyStream(stream) {
  if (!stream || !stream.url) return false;
  return /^https?:\/\//i.test(stream.url);
}

function getBingeGroup(provider, stream) {
  const quality = String(stream.quality || "hd").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const format = isMp4Url(stream.url) ? "mp4" : isPlaylistUrl(stream.url) ? "hls" : "direct";
  return [provider.id || provider.name || "provider", quality, format].join("-");
}

function rewritePlaylist(content, sourceUrl, req, headers) {
  return content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (match, value) => {
        try {
          const absoluteUrl = new URL(value, sourceUrl).toString();
          return "URI=\"" + getProxyUrl(req, { url: absoluteUrl, headers }) + "\"";
        } catch (_) {
          return match;
        }
      });
    }

    try {
      const absoluteUrl = new URL(trimmed, sourceUrl).toString();
      return getProxyUrl(req, { url: absoluteUrl, headers });
    } catch (_) {
      return line;
    }
  }).join("\n");
}

function copyProxyHeaders(upstream, res, contentLengthOverride) {
  const headers = corsHeaders({
    "accept-ranges": upstream.headers.get("accept-ranges") || "bytes",
    "cache-control": "public, max-age=60",
    "content-disposition": "inline"
  });

  const contentType = upstream.headers.get("content-type");
  const contentLength = typeof contentLengthOverride === "number" ? String(contentLengthOverride) : upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");

  if (contentType) headers["content-type"] = contentType;
  if (contentLength) headers["content-length"] = contentLength;
  if (contentRange) headers["content-range"] = contentRange;

  return headers;
}

async function proxyMedia(req, res, proxyRequest) {
  const requestHeaders = getOriginHeaders(proxyRequest.url, proxyRequest.headers);
  if (req.headers.range) requestHeaders.Range = req.headers.range;
  if (req.headers["if-range"]) requestHeaders["If-Range"] = req.headers["if-range"];

  let upstream;
  try {
    upstream = await fetch(proxyRequest.url, {
      headers: requestHeaders,
      redirect: "follow"
    });
  } catch (error) {
    sendJson(res, 502, { error: "Proxy fetch failed", detail: error && error.message ? error.message : String(error) });
    return;
  }

  if (!upstream.ok && upstream.status !== 206) {
    sendJson(res, upstream.status, { error: "Upstream HTTP " + upstream.status });
    return;
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (isPlaylistUrl(proxyRequest.url) || contentType.includes("mpegurl") || contentType.includes("m3u8")) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, proxyRequest.url, req, proxyRequest.headers);
    res.writeHead(upstream.status, corsHeaders({
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": "public, max-age=30",
      "content-disposition": "inline"
    }));
    res.end(req.method === "HEAD" ? undefined : rewritten);
    return;
  }

  res.writeHead(upstream.status, copyProxyHeaders(upstream, res));
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      res.write(Buffer.from(chunk.value));
    }
    res.end();
  } catch (error) {
    res.destroy(error);
  }
}

async function resolveTmdb(imdbId, mediaType) {
  if (!imdbId || !imdbId.startsWith("tt")) {
    return { tmdbId: imdbId, mediaType };
  }
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is required to resolve IMDb ids");
  }

  return cachedJson("find:" + mediaType + ":" + imdbId, async () => {
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
  }, 24 * 60 * 60 * 1000);
}

function toSiteStream(stream, provider, req) {
  if (!stream || !stream.url || typeof stream.url !== "string") return null;

  const proxied = shouldProxyStream(stream);
  const extension = getProxyExtension(stream.url);
  const quality = stream.quality || "HD";
  const titleParts = [
    stream.title || provider.name,
    quality,
    stream.size && stream.size !== "Unknown" ? stream.size : ""
  ].filter(Boolean);

  const result = {
    name: provider.name || stream.name || provider.id,
    title: titleParts.join("\n"),
    url: proxied ? getProxyUrl(req, stream) : stream.url,
    originalUrl: stream.url,
    providerId: provider.id,
    format: getStreamFormat(stream),
    language: getStreamLanguage(stream),
    quality: quality,
    proxied: proxied,
    description: titleParts.join("\n"),
    behaviorHints: {
      notWebReady: proxied ? false : extension !== "mp4",
      bingeGroup: getBingeGroup(provider, stream),
      filename: safeFilename(stream.title || provider.name || provider.id, extension)
    }
  };

  if (!proxied && stream.headers && Object.keys(stream.headers).length > 0) {
    result.headers = stream.headers;
    result.behaviorHints.proxyHeaders = {
      request: stream.headers
    };
  }

  return result;
}

async function getStreams(request, req) {
  const resolved = await resolveTmdb(request.imdbId, request.mediaType);
  const providers = getEnabledProviders(resolved.mediaType);
  const cacheKey = [
    "streams",
    resolved.mediaType,
    resolved.tmdbId,
    request.season || "",
    request.episode || "",
    providers.map((provider) => provider.id).join(",")
  ].join(":");

  const rawStreams = await cachedJson(cacheKey, async () => {
    const providerRuns = providers.map(async (provider) => {
      const rows = [];
      try {
        const module = loadProvider(provider);
        if (!module || typeof module.getStreams !== "function") return rows;

        const result = await withTimeout(
          module.getStreams(resolved.tmdbId, resolved.mediaType, request.season, request.episode),
          PROVIDER_TIMEOUT_MS,
          provider.id
        );

        if (result.error) {
          console.warn("[Madrador Film] " + provider.id + ": " + result.error.message);
        }

        for (const stream of result.streams) {
          rows.push({ providerId: provider.id, stream });
        }
      } catch (error) {
        console.warn("[Madrador Film] " + provider.id + ": " + (error && error.message ? error.message : error));
      }
      return rows;
    });

    return (await Promise.all(providerRuns)).flat();
  }, STREAM_CACHE_TTL_MS);

  const streams = [];
  const seen = new Set();
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));

  for (const row of rawStreams) {
    const provider = providerById.get(row.providerId);
    if (!provider) continue;
    const siteStream = toSiteStream(row.stream, provider, req);
    if (!siteStream || seen.has(siteStream.url)) continue;
    seen.add(siteStream.url);
    siteStream._rank = getStreamRank(row.stream);
    streams.push(siteStream);
  }

  return streams
    .sort((a, b) => (a._rank || 0) - (b._rank || 0))
    .map((stream) => {
      delete stream._rank;
      return stream;
    });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const prefixMatch = url.pathname.match(/^\/v[0-9]+(?=\/|$)/);
    if (prefixMatch) {
      req.routePrefix = prefixMatch[0];
      url.pathname = url.pathname.slice(prefixMatch[0].length) || "/";
    } else {
      req.routePrefix = "";
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (url.pathname === "/site-madrador" || url.pathname === "/site-madrador/") {
      sendSiteFile(res, "index.html", 200);
      return;
    }

    if (url.pathname.startsWith("/site-madrador/")) {
      const relativeSitePath = url.pathname.slice("/site-madrador/".length) || "index.html";
      sendSiteFile(res, relativeSitePath, 200);
      return;
    }

    if (url.pathname === "/favicon.ico" || url.pathname === "/logo.png") {
      sendFile(res, 200, path.join(SITE_MADRADOR_DIR, "assets", "img", "favicon.svg"), "image/svg+xml");
      return;
    }

    if (url.pathname === "/brand.svg") {
      sendFile(res, 200, path.join(ROOT, "assets", "brand.svg"), "image/svg+xml; charset=utf-8");
      return;
    }

    if (url.pathname === "/banner.svg") {
      sendFile(res, 200, path.join(ROOT, "assets", "banner.svg"), "image/svg+xml; charset=utf-8");
      return;
    }

    if (routeSitePage(res, url.pathname)) {
      return;
    }

    if (url.pathname === "/health") {
      sendJson(res, 200, {
        success: true,
        ok: true,
        name: SITE_NAME,
        version: SITE_VERSION,
        uptime: process.uptime(),
        providers: getEnabledProviders("tv").length
      });
      return;
    }

    if (url.pathname === "/health.json") {
      sendJson(res, 200, {
        success: true,
        ok: true,
        name: SITE_NAME,
        version: SITE_VERSION,
        providers: getEnabledProviders("tv").length
      });
      return;
    }

    if (url.pathname === "/config.json") {
      sendJson(res, 200, getConfig(req));
      return;
    }

    if (url.pathname === "/catalog.json") {
      sendJson(res, 200, await getCatalogRows(url.searchParams.get("refresh") === "1"));
      return;
    }

    if (url.pathname === "/details.json") {
      const tmdbId = url.searchParams.get("id") || "";
      const mediaType = url.searchParams.get("type") || "movie";
      if (!tmdbId.trim()) {
        sendJson(res, 400, { error: "Missing id" });
        return;
      }
      sendJson(res, 200, await getTmdbDetails(tmdbId, mediaType));
      return;
    }

    if (url.pathname === "/diagnostics.json") {
      sendJson(res, 200, await runDiagnostics(req));
      return;
    }

    if (url.pathname === "/providers/status.json") {
      sendJson(res, 200, {
        success: true,
        statuses: providerStatusService.getProviderStatuses()
      });
      return;
    }

    if (url.pathname === "/providers.json") {
      sendJson(res, 200, {
        success: true,
        movie: getProviderSummary("movie"),
        series: getProviderSummary("tv"),
        all: nuvioManifest.scrapers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          state: getProviderState(provider),
          languages: provider.contentLanguage || [],
          formats: provider.formats || [],
          domains: getProviderDomains(provider.id)
        }))
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/admin/cache/clear") {
      if (!isAdminAuthorized(req, url)) return sendJson(res, 401, fail("ADMIN_UNAUTHORIZED", "Action admin non autorisee."));
      memoryCache.clear();
      sendJson(res, 200, { success: true, cleared: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/admin/catalog/refresh") {
      if (!isAdminAuthorized(req, url)) return sendJson(res, 401, fail("ADMIN_UNAUTHORIZED", "Action admin non autorisee."));
      const catalog = await getCatalogRows(true);
      sendJson(res, 200, { success: true, rows: catalog.rows ? catalog.rows.length : 0, generatedAt: catalog.generatedAt });
      return;
    }

    if (req.method === "POST" && url.pathname === "/admin/providers/test") {
      if (!isAdminAuthorized(req, url)) return sendJson(res, 401, fail("ADMIN_UNAUTHORIZED", "Action admin non autorisee."));
      sendJson(res, 200, await runDiagnostics(req));
      return;
    }

    if (req.method === "POST" && url.pathname === "/admin/domains/check") {
      if (!isAdminAuthorized(req, url)) return sendJson(res, 401, fail("ADMIN_UNAUTHORIZED", "Action admin non autorisee."));
      const results = await domainService.checkDomains();
      sendJson(res, 200, { success: true, results });
      return;
    }

    if (url.pathname === "/search.json") {
      const query = url.searchParams.get("q") || "";
      const mediaType = url.searchParams.get("type") || "movie";
      if (!query.trim()) {
        sendJson(res, 400, { error: "Missing q" });
        return;
      }
      sendJson(res, 200, { results: await searchTmdb(query, mediaType) });
      return;
    }

    const proxyRequest = parseProxyPath(url.pathname);
    if (proxyRequest) {
      await proxyMedia(req, res, proxyRequest);
      return;
    }

    const streamRequest = parseStreamPath(url.pathname);
    if (streamRequest) {
      const streams = await getStreams(streamRequest, req);
      sendJson(res, 200, { streams });
      return;
    }

    if ((req.headers.accept || "").includes("text/html")) {
      sendSiteFile(res, "404.html", 404);
      return;
    }
    sendJson(res, 404, fail("NOT_FOUND", "Route introuvable."));
  } catch (error) {
    logger.error(error && error.stack ? error.stack : error);
    if ((req.headers.accept || "").includes("text/html")) {
      sendSiteFile(res, "500.html", 500);
      return;
    }
    sendJson(res, 500, fail("INTERNAL_ERROR", "Erreur interne du serveur."));
  }
});

server.listen(PORT, HOST, () => {
  logger.info("Server started on http://" + HOST + ":" + PORT + "/");
  logger.info("Providers: " + getEnabledProviders("tv").map((provider) => provider.id).join(", "));
});
