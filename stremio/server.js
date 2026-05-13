const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const nuvioManifest = require(path.join(ROOT, "manifest.json"));
const stremioManifest = require("./manifest.json");
const domains = require(path.join(ROOT, "domains.json"));

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 7000);
const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45000);
const PROVIDER_FILTER = (process.env.STREMIO_PROVIDERS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000);
const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 10 * 60 * 1000);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 3 * 60 * 1000);
const DIAGNOSTIC_CACHE_TTL_MS = Number(process.env.DIAGNOSTIC_CACHE_TTL_MS || 2 * 60 * 1000);
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

function corsHeaders(extra) {
  return Object.assign({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "Content-Length,Content-Range,Accept-Ranges,Content-Type",
    "cross-origin-resource-policy": "cross-origin"
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

function getPublicBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function getAddonBaseUrl(req) {
  const base = getPublicBaseUrl(req);
  return req.addonPrefix ? base + req.addonPrefix : base;
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

function getProviderSummary(mediaType) {
  return getEnabledProviders(mediaType).map((provider) => ({
    id: provider.id,
    name: provider.name,
    languages: provider.contentLanguage || [],
    limited: Boolean(provider.limited),
    unstable: unstableProviders.has(provider.id),
    domains: domains[provider.id] || [],
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

function renderHomePage(req) {
  const baseUrl = getPublicBaseUrl(req);
  const manifestUrl = baseUrl + "/manifest.json";
  const stremioInstallUrl = "stremio://" + manifestUrl.replace(/^https?:\/\//, "");
  const movieProviders = getProviderSummary("movie");
  const seriesProviders = getProviderSummary("tv");
  const providerRows = seriesProviders
    .map((provider) => {
      const state = provider.unstable ? "Instable" : provider.limited ? "Limite" : "Actif";
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
    "<link rel=\"icon\" href=\"/logo.png\">" +
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
    "<div class=\"actions\"><a class=\"btn primary\" href=\"" + escapeHtml(stremioInstallUrl) + "\">Installer dans Stremio</a><a class=\"btn\" href=\"/catalog\">Catalogue</a><a class=\"btn\" href=\"/providers\">Providers</a><a class=\"btn\" href=\"/test-player\">Tester la lecture</a><a class=\"btn\" href=\"https://github.com/Madrador60/Plugins-nuvio\">GitHub</a></div></div>" +
    "<div class=\"grid\"><div class=\"box\"><strong>" + movieProviders.length + "</strong><span>providers films/series</span></div><div class=\"box\"><strong>" + seriesProviders.length + "</strong><span>providers series/animes</span></div><div class=\"box\"><strong>FR</strong><span>sources francaises en priorite</span></div></div>" +
    "<section><h2>URL a mettre dans Stremio</h2><code>" + escapeHtml(manifestUrl) + "</code><p class=\"note\">Sur Render gratuit, le premier chargement peut etre lent si le service etait en veille.</p></section>" +
    "<section><h2>Providers actifs</h2><table><thead><tr><th>Provider</th><th>Langues</th><th>Etat</th></tr></thead><tbody>" + providerRows + "</tbody></table></section>" +
    "<section><h2>Pour Nuvio</h2><code>https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/</code></section>" +
    "</main></body></html>";
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
.label{color:var(--muted);font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:.08em;margin-bottom:8px}.nowTitle{font-weight:900;font-size:18px}.nowUrl{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.filters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}.stremioBtn{width:100%;margin-top:8px;background:linear-gradient(135deg,#2563eb,#7c3aed)}
.rows{margin-top:26px}.rowHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}h2{margin:0;font-size:22px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:156px;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;padding:2px 0 14px;scrollbar-color:#555 transparent}.poster{height:232px;width:156px;text-align:left;background:#151515;border:1px solid #242424;border-radius:7px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#777}.poster img{width:100%;height:178px;object-fit:cover;background:#222}.poster strong{display:block;padding:8px 8px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 8px 8px;font-size:12px}
.streamGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stream{min-height:86px;text-align:left;background:#10142b;border:1px solid #29305c;border-radius:8px;color:#fff;padding:12px}.stream.active{border-color:var(--green);box-shadow:0 0 0 1px var(--green),0 0 24px rgba(56,189,248,.25)}.stream strong{display:block;font-size:15px}.stream small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:5px}.pill{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:#29305c;color:#fff;font-size:11px;font-weight:900;margin-top:7px}.pill.mp4{background:#2563eb}.pill.hls{background:#6d28d9}
pre{white-space:pre-wrap;background:#050505;border:1px solid #222;border-radius:8px;padding:12px;color:#cbd5e1;overflow:auto;max-height:170px;margin:0}.empty{color:var(--muted);background:#101010;border:1px dashed #333;border-radius:8px;padding:18px}
@media(max-width:980px){.hero{grid-template-columns:1fr}video{min-height:300px}.streamGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){main{width:min(100% - 20px,1280px);padding:14px 0 34px}.nav{height:auto;align-items:flex-start;display:grid;gap:8px}.brand{font-size:20px}.navlinks{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:6px}.navlinks a{background:#10142b;text-align:center;padding:10px 8px}.hero{gap:14px;margin-top:8px}.player{border-radius:6px}video{min-height:220px;max-height:42vh}.shade{padding:16px 14px 34px}.shade h1{font-size:28px}.shade p{font-size:13px}.searchBox,.now,.streamsPanel,.logPanel{padding:12px}.searchGrid,.tools,.filters,.streamGrid{grid-template-columns:1fr}.rail{grid-auto-columns:132px}.poster{width:132px;height:210px}.poster img{height:154px}pre{max-height:120px}.stream{min-height:76px}}
@media(max-width:520px){body{overflow-x:hidden}main{width:100%;padding:12px 10px calc(92px + env(safe-area-inset-bottom))}.brand{padding-left:2px}.hero{min-height:210px;padding:16px;border-radius:0;margin:8px -10px 18px;background-position:center top}.hero .chip{font-size:11px;min-height:26px}h1{font-size:34px;max-width:330px}.lead{font-size:14px;max-width:330px}.search{margin-top:14px}.search input,.search select,.search button{min-height:48px;border-radius:8px;font-size:15px}.row{margin:20px 0}.rowHead{padding:0 2px}.rowHead .chip{white-space:nowrap}.rail{grid-auto-columns:42vw;gap:10px;margin:0 -10px;padding:2px 10px 16px;scroll-padding-left:10px}.poster{width:42vw;height:calc(42vw * 1.55);border-radius:7px}.poster:hover{transform:none}.poster img{height:calc(42vw * 1.16)}.poster strong{font-size:12px;padding:7px 7px 0}.poster small{font-size:11px;padding:2px 7px}.modal{align-items:stretch;padding-top:env(safe-area-inset-top)}.sheet{height:100dvh;max-height:100dvh;border:0;border-radius:0;overflow:auto}.detailHero{min-height:100%;display:block;padding:56px 16px 24px;background-position:center top}.detailPoster{width:118px;float:left;margin:0 14px 8px 0}.detailText h2{font-size:30px;line-height:1.02}.meta{font-size:13px}.overview{clear:both;max-height:none;font-size:14px;line-height:1.5}.detailActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}.detailActions button{min-height:48px}.close{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:30;border-radius:999px}.bottomNav{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:7px;border-radius:12px}.bottomNav a{font-size:12px;min-height:42px;display:flex;align-items:center;justify-content:center}}@media(max-width:360px){.rail{grid-auto-columns:46vw}.poster{width:46vw;height:calc(46vw * 1.58)}.poster img{height:calc(46vw * 1.18)}h1{font-size:30px}.detailPoster{width:104px}}
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
        <button id="stremio" class="stremioBtn">Tester ce film dans Stremio</button>
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
const log=document.getElementById('log'),video=document.getElementById('video'),q=document.getElementById('query'),type=document.getElementById('type'),searchBtn=document.getElementById('search'),results=document.getElementById('results'),streamsBox=document.getElementById('streams'),nowTitle=document.getElementById('nowTitle'),nowUrl=document.getElementById('nowUrl'),copyBtn=document.getElementById('copy'),openBtn=document.getElementById('open'),stremioBtn=document.getElementById('stremio'),heroTitle=document.getElementById('heroTitle'),heroMeta=document.getElementById('heroMeta'),resultCount=document.getElementById('resultCount'),streamCount=document.getElementById('streamCount'),filterAll=document.getElementById('filterAll'),filterMp4=document.getElementById('filterMp4'),filterHls=document.getElementById('filterHls'),filterVf=document.getElementById('filterVf'),filterVostfr=document.getElementById('filterVostfr'),filterMulti=document.getElementById('filterMulti');let hls=null,currentUrl='',currentMeta=null,allStreams=[],streamFilter='all',languageFilter='all';const params=new URLSearchParams(location.search);if(params.get('q'))q.value=params.get('q');if(params.get('type'))type.value=params.get('type');const noPoster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="312" height="464"><rect width="100%" height="100%" fill="#151515"/><text x="50%" y="47%" fill="#777" font-family="Arial" font-size="28" text-anchor="middle">MADRADOR</text><text x="50%" y="55%" fill="#555" font-family="Arial" font-size="22" text-anchor="middle">FILM</text></svg>');
function write(x){log.textContent+='\\n'+x;log.scrollTop=log.scrollHeight}function setLog(x){log.textContent=x}function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}function formatUrl(u){const s=String(u||'').replace(location.origin,'');const m=s.match(/^\\/proxy\\/[^/]+\\/(stream\\.[a-z0-9]+)$/i);return m?'/proxy/.../'+m[1]:s}
async function search(autoLoadFirst){const query=q.value.trim();if(!query)return;setLog('Recherche: '+query);results.className='empty';results.textContent='Recherche...';streamsBox.className='empty';streamsBox.textContent='Choisis un resultat.';streamCount.textContent='';const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(query)).then(r=>r.json());resultCount.textContent=data.results.length+' resultat(s)';results.className='rail';results.innerHTML=data.results.map(r=>'<button class="poster" data-id="'+r.id+'" data-type="'+r.type+'" data-title="'+esc(r.title)+'" data-year="'+esc(r.year||'')+'"><img src="'+esc(r.poster||noPoster)+'" alt=""><strong>'+esc(r.title)+'</strong><small>'+esc(r.year||'Annee inconnue')+' · TMDB '+r.id+'</small></button>').join('')||'<div class="empty">Aucun resultat</div>';results.querySelectorAll('button').forEach(b=>b.onclick=()=>loadStreams(b.dataset.type,b.dataset.id,b.dataset.title,b.dataset.year));write('Resultats: '+data.results.length);if(autoLoadFirst&&data.results[0]){const r=data.results[0];await loadStreams(r.type,r.id,r.title,r.year)}}
function streamText(s){return [s.name,s.title,s.description,s.url].join(' ').toLowerCase()}
function matchLanguage(s){const text=streamText(s);if(languageFilter==='all')return true;if(languageFilter==='vf')return /\\bvf\\b|french|francais|français/.test(text);if(languageFilter==='vostfr')return /vostfr|vost|subfrench/.test(text);if(languageFilter==='multi')return /multi|multilang|multiverse/.test(text);return true}
function renderStreams(){const visible=allStreams.filter(s=>(streamFilter==='all'||(streamFilter==='mp4'&&s.url.includes('.mp4'))||(streamFilter==='hls'&&s.url.includes('.m3u8')))&&matchLanguage(s));streamCount.textContent=visible.length+' source(s)';streamsBox.className='streamGrid';streamsBox.innerHTML=visible.map((s,i)=>{const originalIndex=allStreams.indexOf(s);const kind=s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'LINK';const cls=kind==='MP4'?'mp4':kind==='HLS'?'hls':'';return '<button class="stream" data-i="'+originalIndex+'"><strong>'+esc(s.name)+'</strong><small>'+esc(s.title||s.description||'')+'</small><span class="pill '+cls+'">'+kind+'</span><small>'+esc(formatUrl(s.url))+'</small></button>'}).join('')||'<div class="empty">Aucune source pour ce filtre</div>';streamsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>play(allStreams[Number(b.dataset.i)],b))}
async function loadStreams(mediaType,id,title,year){currentMeta={mediaType,id,title,year};heroTitle.textContent=title;heroMeta.textContent=(year?year+' · ':'')+'Recherche des sources...';setLog('Streams pour '+title+'...');streamsBox.className='empty';streamsBox.textContent='Chargement des sources...';const endpoint='/stream/'+mediaType+'/'+id+'.json';const data=await fetch(endpoint).then(r=>r.json());allStreams=data.streams||[];renderStreams();write('Streams: '+allStreams.length);if(allStreams[0]) play(allStreams[0],streamsBox.querySelector('button'))}
async function play(s,button){if(!s)return;streamsBox.querySelectorAll('.active').forEach(x=>x.classList.remove('active'));if(button)button.classList.add('active');const kind=s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'Lien';currentUrl=s.url;nowTitle.textContent=s.name+' · '+kind;nowUrl.textContent=formatUrl(s.url);heroMeta.textContent=s.title||s.description||kind;write('Lecture: '+s.name+' - '+(s.title||s.description||''));write(s.url);if(hls){hls.destroy();hls=null}video.removeAttribute('src');video.load();if(s.url.includes('.m3u8')){if(window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,lowLatencyMode:false});hls.loadSource(s.url);hls.attachMedia(video);hls.on(Hls.Events.ERROR,(e,d)=>write('HLS error: '+JSON.stringify({type:d.type,details:d.details,fatal:d.fatal})));}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=s.url}else{write('HLS non supporte dans ce navigateur');return}}else{video.src=s.url}await video.play().catch(e=>write('Lecture bloquee: '+e.message))}
function setFilter(value){streamFilter=value;filterAll.className=value==='all'?'secondary':'ghost';filterMp4.className=value==='mp4'?'secondary':'ghost';filterHls.className=value==='hls'?'secondary':'ghost';renderStreams()}
function setLanguageFilter(value){languageFilter=value;filterVf.className=value==='vf'?'secondary':'ghost';filterVostfr.className=value==='vostfr'?'secondary':'ghost';filterMulti.className=value==='multi'?'secondary':'ghost';renderStreams()}
copyBtn.onclick=async()=>{if(!currentUrl)return;await navigator.clipboard.writeText(currentUrl).catch(()=>{});write('URL copiee')};openBtn.onclick=()=>{if(currentUrl)window.open(currentUrl,'_blank')};stremioBtn.onclick=async()=>{if(!currentMeta){write('Choisis d abord un resultat.');return}const data=await fetch('/stremio-open.json?type='+encodeURIComponent(currentMeta.mediaType)+'&id='+encodeURIComponent(currentMeta.id)).then(r=>r.json());if(data.desktopUrl){write('Ouverture Stremio: '+data.webUrl);location.href=data.desktopUrl;setTimeout(()=>window.open(data.webUrl,'_blank'),700)}else{write('Impossible de generer le lien Stremio: '+(data.error||''))}};filterAll.onclick=()=>setFilter('all');filterMp4.onclick=()=>setFilter('mp4');filterHls.onclick=()=>setFilter('hls');filterVf.onclick=()=>setLanguageFilter(languageFilter==='vf'?'all':'vf');filterVostfr.onclick=()=>setLanguageFilter(languageFilter==='vostfr'?'all':'vostfr');filterMulti.onclick=()=>setLanguageFilter(languageFilter==='multi'?'all':'multi');video.addEventListener('error',()=>write('Video error code: '+(video.error&&video.error.code)));searchBtn.onclick=()=>search(false).catch(e=>setLog('Erreur: '+(e.stack||e.message||e)));q.addEventListener('keydown',e=>{if(e.key==='Enter')searchBtn.click()});if(params.get('id')){setTimeout(()=>loadStreams(type.value,params.get('id'),q.value||'Titre choisi',params.get('year')||''),250)}else if(params.get('q'))setTimeout(()=>search(params.get('autoload')==='1'),250);
</script>
</body>
</html>`;
}

function renderStatusPage() {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Statut Madrador Film</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb;--ok:#38bdf8;--warn:#f59e0b;--bad:#fb7185}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 12% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 88% 8%,rgba(37,99,235,.26),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.16),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1180px,calc(100% - 32px));margin:0 auto;padding:22px 0 56px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.nav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px;margin-left:14px}.hero{padding:30px 0 22px;border-bottom:1px solid var(--line)}h1{font-size:clamp(38px,6vw,72px);line-height:1;margin:0 0 10px}.lead{max-width:720px;color:#dbeafe;font-size:18px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button,.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:7px;border:1px solid #303866;font:inherit;text-decoration:none;color:#fff;font-weight:900;padding:0 14px;cursor:pointer;background:linear-gradient(135deg,var(--violet),var(--blue))}.btn.secondary,button.secondary{background:#10142b}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.card{background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;padding:16px}.card strong{display:block;font-size:28px}.card span{color:var(--muted)}table{width:100%;border-collapse:collapse;background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:16px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted)}tr:last-child td{border-bottom:0}.ok{color:var(--ok);font-weight:900}.warn{color:var(--warn);font-weight:900}.bad{color:var(--bad);font-weight:900}.muted{color:var(--muted)}pre{white-space:pre-wrap;background:#050714;border:1px solid var(--line);border-radius:8px;padding:12px;color:#cbd5e1;overflow:auto}.pill{display:inline-flex;align-items:center;min-height:24px;border-radius:999px;padding:0 9px;background:#1d2446;color:#dbeafe;font-weight:900;font-size:12px}@media(max-width:780px){main{width:min(100% - 20px,1180px)}.nav{height:auto;display:grid}.nav a{margin:0 10px 0 0}.cards{grid-template-columns:1fr 1fr}table{font-size:13px}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand">MADRADOR FILM</div><nav><a href="/">Accueil</a><a href="/test-player">Lecteur</a><a href="/providers">Providers</a><a href="/catalog">Catalogue</a></nav></header>
  <section class="hero"><span class="pill">Diagnostic live</span><h1>Statut providers</h1><p class="lead">Controle rapide des sources principales avec cache court, temps de reponse et etat lisible.</p><div class="actions"><button id="run">Lancer le diagnostic</button><a class="btn secondary" href="/diagnostics.json">JSON</a></div></section>
  <div id="cards" class="cards"><div class="card"><strong>-</strong><span>OK</span></div><div class="card"><strong>-</strong><span>Instables</span></div><div class="card"><strong>-</strong><span>Streams</span></div><div class="card"><strong>-</strong><span>Generation</span></div></div>
  <div id="out" class="muted">Pret.</div>
</main>
<script>
const out=document.getElementById('out'),cards=document.getElementById('cards'),run=document.getElementById('run');
function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(data){const ok=data.results.filter(r=>r.status==='OK').length,unstable=data.results.filter(r=>r.status!=='OK').length,streams=data.results.reduce((n,r)=>n+r.streams,0);cards.innerHTML='<div class="card"><strong>'+ok+'</strong><span>OK</span></div><div class="card"><strong>'+unstable+'</strong><span>A surveiller</span></div><div class="card"><strong>'+streams+'</strong><span>Streams trouves</span></div><div class="card"><strong>'+new Date(data.generatedAt).toLocaleTimeString('fr-FR')+'</strong><span>Generation</span></div>';out.innerHTML='<table><thead><tr><th>Provider</th><th>Statut</th><th>Streams</th><th>Temps</th><th>Note</th></tr></thead><tbody>'+data.results.map(r=>{const cls=r.status==='OK'?'ok':r.status==='ZERO'?'warn':'bad';return '<tr><td>'+esc(r.provider)+'</td><td class="'+cls+'">'+esc(r.status)+'</td><td>'+r.streams+'</td><td>'+r.timeMs+'ms</td><td>'+esc(r.error||'')+'</td></tr>'}).join('')+'</tbody></table><pre>'+esc(JSON.stringify(data,null,2))+'</pre>'}
run.onclick=async()=>{out.textContent='Diagnostic en cours...';try{render(await fetch('/diagnostics.json').then(r=>r.json()))}catch(e){out.textContent='Erreur: '+(e.message||e)}};run.click();
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
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 16% 0%,rgba(124,58,237,.32),transparent 34%),radial-gradient(circle at 80% 8%,rgba(37,99,235,.24),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.15),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1320px,calc(100% - 32px));margin:0 auto;padding:22px 0 72px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.nav a,.bottomNav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px}.nav a{margin-left:14px}.hero{min-height:310px;display:flex;align-items:flex-end;border-radius:10px;padding:28px;margin:18px 0 28px;background:linear-gradient(90deg,rgba(6,7,20,.94),rgba(6,7,20,.55)),url('https://image.tmdb.org/t/p/original/8eifdha9GQeZAkexgtD45546XKx.jpg') center/cover;box-shadow:0 22px 90px rgba(37,99,235,.18)}h1{font-size:clamp(42px,7vw,80px);line-height:.95;margin:0 0 12px}.lead{max-width:720px;color:#dbeafe;font-size:18px}.searchShell{position:relative;max-width:780px}.search{display:grid;grid-template-columns:1fr 130px auto;gap:10px;margin-top:18px}input,select,button{min-height:44px;border-radius:7px;border:1px solid #303866;font:inherit}input,select{background:#080b1d;color:#fff;padding:0 12px}button{border:0;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:900;padding:0 16px;cursor:pointer}.suggestions{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:12;display:none;background:rgba(8,11,29,.98);border:1px solid #303866;border-radius:8px;overflow:hidden;box-shadow:0 18px 70px rgba(0,0,0,.5)}.suggestions.open{display:block}.suggestion{width:100%;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;min-height:58px;text-align:left;background:transparent;border:0;border-bottom:1px solid #202647;border-radius:0;color:#fff}.suggestion:last-child{border-bottom:0}.suggestion img{width:34px;height:48px;object-fit:cover;border-radius:4px;background:#172033}.suggestion small{color:var(--muted)}.row{margin:24px 0}.row.hidden{display:none}.rowHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:23px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:164px;gap:12px;overflow-x:auto;padding:2px 0 16px;scrollbar-color:#4b5563 transparent}.poster{height:250px;width:164px;text-align:left;background:#111426;border:1px solid #29305c;border-radius:8px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#8b5cf6}.poster img{width:100%;height:188px;object-fit:cover;background:#172033}.poster strong{display:block;padding:8px 9px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 9px;font-size:12px}.empty{color:var(--muted);border:1px dashed #303866;border-radius:8px;padding:18px;background:#0a0d20}.loading{color:#c4b5fd}.tools{display:flex;gap:8px;flex-wrap:wrap}.chip{display:inline-flex;align-items:center;min-height:30px;border:1px solid #303866;border-radius:999px;padding:0 10px;color:#dbeafe;background:#10142b;font-weight:800;font-size:12px}.miniBtn{min-height:30px;border:1px solid #303866;background:#10142b;border-radius:999px;padding:0 10px;font-size:12px}.modal{position:fixed;inset:0;z-index:20;display:none;align-items:flex-end;background:rgba(0,0,0,.68);backdrop-filter:blur(8px)}.modal.open{display:flex}.sheet{width:min(1050px,calc(100% - 24px));margin:0 auto 18px;background:#0b1028;border:1px solid #303866;border-radius:10px;overflow:hidden;box-shadow:0 28px 120px rgba(0,0,0,.7)}.detailHero{min-height:390px;display:grid;grid-template-columns:210px 1fr;gap:20px;align-items:end;padding:22px;background:linear-gradient(90deg,rgba(8,10,25,.98),rgba(8,10,25,.68));background-size:cover;background-position:center}.detailPoster{width:210px;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.5)}.detailText h2{font-size:42px;line-height:1;margin:0 0 10px}.meta{color:#dbeafe;font-weight:800;margin-bottom:10px}.overview{max-width:720px;color:#dbeafe}.detailActions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.sourcePanel{background:rgba(8,11,29,.92);border-top:1px solid #303866;padding:16px 22px}.sourceHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.sourceList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sourceCard{background:#111426;border:1px solid #29305c;border-radius:8px;padding:11px;text-align:left;color:#fff}.sourceCard strong{display:block;font-size:14px}.sourceCard small{display:block;color:var(--muted);margin-top:4px}.sourceCard .chip{margin-top:8px}.close{position:absolute;right:24px;top:18px;width:42px;padding:0;background:#111426;border:1px solid #303866}.bottomNav{display:none;position:fixed;left:10px;right:10px;bottom:10px;z-index:15;background:rgba(10,13,32,.94);border:1px solid #303866;border-radius:10px;padding:8px;backdrop-filter:blur(12px)}.bottomNav a{flex:1;text-align:center;padding:8px 6px;border-radius:7px}.bottomNav a:hover{background:#1d2446}@media(max-width:900px){.sourceList{grid-template-columns:1fr 1fr}}@media(max-width:760px){main{width:min(100% - 20px,1320px);padding:14px 0 82px}.nav{height:auto;display:grid;gap:8px}.nav nav{display:none}.bottomNav{display:flex}.brand{font-size:20px}.hero{padding:18px;min-height:245px;margin:12px 0 22px;border-radius:8px}h1{font-size:42px}.lead{font-size:15px}.search{grid-template-columns:1fr;gap:8px}.suggestions{position:static;margin-top:8px}.rail{grid-auto-columns:132px;gap:10px}.poster{width:132px;height:214px}.poster img{height:156px}.rowHead{align-items:flex-start;gap:8px}.rowHead h2{font-size:19px}.sheet{width:100%;margin:0;border-radius:12px 12px 0 0}.detailHero{min-height:unset;grid-template-columns:96px 1fr;gap:12px;padding:16px}.detailPoster{width:96px}.detailText h2{font-size:26px}.overview{font-size:13px;max-height:110px;overflow:auto}.detailActions{display:grid}.sourcePanel{padding:14px}.sourceList{grid-template-columns:1fr}.close{right:12px;top:12px}}@media(max-width:520px){body{overflow-x:hidden}main{width:100%;padding:12px 10px calc(92px + env(safe-area-inset-bottom))}.hero{min-height:210px;padding:16px;border-radius:0;margin:8px -10px 18px;background-position:center top}.hero .chip{font-size:11px;min-height:26px}h1{font-size:34px;max-width:330px}.lead{font-size:14px}.search input,.search select,.search button{min-height:48px;border-radius:8px;font-size:15px}.rail{grid-auto-columns:42vw;gap:10px;margin:0 -10px;padding:2px 10px 16px}.poster{width:42vw;height:calc(42vw * 1.55);border-radius:7px}.poster:hover{transform:none}.poster img{height:calc(42vw * 1.16)}.poster strong{font-size:12px;padding:7px 7px 0}.poster small{font-size:11px;padding:2px 7px}.modal{align-items:stretch;padding-top:env(safe-area-inset-top)}.sheet{height:100dvh;max-height:100dvh;border:0;border-radius:0;overflow:auto}.detailHero{min-height:auto;display:block;padding:56px 16px 18px;background-position:center top}.detailPoster{width:118px;float:left;margin:0 14px 8px 0}.detailText h2{font-size:30px;line-height:1.02}.meta{font-size:13px}.overview{clear:both;max-height:none;font-size:14px;line-height:1.5}.detailActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}.detailActions button{min-height:48px}.sourceHead{align-items:flex-start;display:grid}.close{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:30;border-radius:999px}.bottomNav{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:7px;border-radius:12px}.bottomNav a{font-size:12px;min-height:42px;display:flex;align-items:center;justify-content:center}}@media(max-width:360px){.rail{grid-auto-columns:46vw}.poster{width:46vw;height:calc(46vw * 1.58)}.poster img{height:calc(46vw * 1.18)}h1{font-size:30px}.detailPoster{width:104px}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand">MADRADOR FILM</div><nav><a href="/test-player">Lecteur</a><a href="/providers">Providers</a></nav></header>
  <section class="hero"><div><span class="chip">Catalogue beta</span><h1>Films et series</h1><p class="lead">Cherche un titre, ouvre sa fiche, puis lance directement la lecture ou Stremio.</p><div class="searchShell"><div class="search"><input id="query" placeholder="Rechercher un titre..." value="" autocomplete="off"><select id="type"><option value="movie">Film</option><option value="series">Serie</option></select><button id="go">Rechercher</button></div><div id="suggestions" class="suggestions"></div></div></div></section>
  <section id="favoritesRow" class="row hidden"></section>
  <section id="historyRow" class="row hidden"></section>
  <div id="searchResults"></div>
  <div id="rows" class="loading">Chargement du catalogue...</div>
</main>
<nav class="bottomNav"><a href="/">Accueil</a><a href="/test-player">Lecteur</a><a href="/providers">Sources</a></nav>
<div id="modal" class="modal"><button id="close" class="close">X</button><div id="sheet" class="sheet"></div></div>
<script>
const rows=document.getElementById('rows'),searchResults=document.getElementById('searchResults'),query=document.getElementById('query'),type=document.getElementById('type'),go=document.getElementById('go'),modal=document.getElementById('modal'),sheet=document.getElementById('sheet'),closeBtn=document.getElementById('close'),suggestions=document.getElementById('suggestions'),favoritesRow=document.getElementById('favoritesRow'),historyRow=document.getElementById('historyRow');
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
function renderSources(streams){if(!streams.length)return '<div class="empty">Aucune source trouvee pour le moment.</div>';return '<div class="sourceList">'+streams.slice(0,9).map((s,i)=>{const text=[s.name,s.title||s.description].filter(Boolean).join(' · ');const isHls=/m3u8/i.test(s.url||''),isMp4=/\\.mp4/i.test(s.url||'');return '<button class="sourceCard" data-index="'+i+'"><strong>'+esc(s.name||('Source '+(i+1)))+'</strong><small>'+esc(text.slice(0,120))+'</small><span class="chip">'+(isMp4?'MP4':isHls?'HLS':'Direct')+'</span></button>'}).join('')+'</div>'}
async function openDetails(item){modal.className='modal open';sheet.innerHTML='<div class="empty">Chargement de la fiche...</div>';try{const d=await fetch('/details.json?type='+encodeURIComponent(item.type)+'&id='+encodeURIComponent(item.id)).then(r=>r.json());saveRecent({id:d.id,type:d.type,title:d.title,year:d.year,poster:d.poster});const play=playerUrl(d);const favLabel=isFav(d)?'Retirer des favoris':'Ajouter aux favoris';const stremio=await fetch('/stremio-open.json?type='+encodeURIComponent(d.type)+'&id='+encodeURIComponent(d.id)).then(r=>r.json()).catch(()=>({}));sheet.innerHTML='<div class="detailHero" style="background-image:linear-gradient(90deg,rgba(8,10,25,.98),rgba(8,10,25,.68)),url('+esc(d.backdrop||'')+')"><img class="detailPoster" src="'+esc(d.poster||noPoster)+'" alt=""><div class="detailText"><span class="chip">'+esc(d.type==='series'?'Serie':'Film')+'</span><h2>'+esc(d.title)+'</h2><div class="meta">'+esc([d.year,d.rating?('TMDB '+Number(d.rating).toFixed(1)):'',d.genres&&d.genres.join(', ')].filter(Boolean).join(' · '))+'</div><p class="overview">'+esc(d.overview||'Aucun resume disponible.')+'</p><div class="detailActions"><button id="playNow">Lire maintenant</button>'+(stremio.desktopUrl?'<button id="openStremio">Ouvrir dans Stremio</button>':'')+'<button id="favBtn" class="miniBtn">'+favLabel+'</button><button id="copyBtn" class="miniBtn">Copier le lien</button></div></div></div><div class="sourcePanel"><div class="sourceHead"><div><strong>Sources disponibles</strong><div class="meta" id="sourceMeta">Recherche automatique en cours...</div></div><button class="miniBtn" id="refreshSources">Relancer</button></div><div id="sourceList" class="empty">Chargement des sources...</div></div>';document.getElementById('playNow').onclick=()=>location.href=play;if(document.getElementById('openStremio'))document.getElementById('openStremio').onclick=()=>{location.href=stremio.desktopUrl;setTimeout(()=>window.open(stremio.webUrl,'_blank'),700)};document.getElementById('copyBtn').onclick=()=>navigator.clipboard.writeText(location.origin+play);document.getElementById('favBtn').onclick=()=>{document.getElementById('favBtn').textContent=toggleFav({id:d.id,type:d.type,title:d.title,year:d.year,poster:d.poster})?'Retirer des favoris':'Ajouter aux favoris'};async function loadSources(){const list=document.getElementById('sourceList'),meta=document.getElementById('sourceMeta');list.className='empty';list.textContent='Chargement des sources...';try{const data=await fetch('/stream/'+encodeURIComponent(d.type)+'/'+encodeURIComponent(d.id)+'.json').then(r=>r.json());const streams=data.streams||[];meta.textContent=streams.length+' source'+(streams.length>1?'s':'')+' trouvee'+(streams.length>1?'s':'');list.className='';list.innerHTML=renderSources(streams);list.querySelectorAll('.sourceCard').forEach(btn=>btn.onclick=()=>{const s=streams[Number(btn.dataset.index)];if(s&&s.url)location.href=s.url})}catch(e){meta.textContent='Erreur pendant la recherche';list.className='empty';list.textContent='Impossible de charger les sources: '+(e.message||e)}}document.getElementById('refreshSources').onclick=loadSources;renderLocalRows();loadSources()}catch(e){sheet.innerHTML='<div class="empty">Impossible de charger la fiche: '+esc(e.message||e)+'</div>'}}
async function searchCatalog(){const q=query.value.trim();if(!q)return;searchResults.innerHTML='<section class="row"><div class="rowHead"><h2>Recherche</h2><span class="chip">Chargement</span></div><div class="empty">Recherche en cours...</div></section>';const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(q)).then(r=>r.json());searchResults.innerHTML='<section class="row"><div class="rowHead"><h2>Recherche</h2><span class="chip">'+data.results.length+' titres</span></div><div class="rail">'+data.results.map(card).join('')+'</div></section>';bindPosters(searchResults)}
let suggestTimer=0;async function loadSuggestions(){const q=query.value.trim();clearTimeout(suggestTimer);if(q.length<2){suggestions.className='suggestions';suggestions.innerHTML='';return}suggestTimer=setTimeout(async()=>{try{const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(q)).then(r=>r.json());const items=(data.results||[]).slice(0,5);suggestions.className='suggestions '+(items.length?'open':'');suggestions.innerHTML=items.map(item=>'<button class="suggestion" data-title="'+esc(item.title)+'" data-type="'+item.type+'" data-id="'+esc(item.id)+'" data-year="'+esc(item.year||'')+'"><img src="'+esc(item.poster||noPoster)+'" alt=""><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.year||'')+' · '+esc(item.type==='series'?'Serie':'Film')+'</small></span><span class="chip">Ouvrir</span></button>').join('');suggestions.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>{suggestions.className='suggestions';openDetails({id:b.dataset.id,type:b.dataset.type,title:b.dataset.title,year:b.dataset.year})})}catch(e){suggestions.className='suggestions'}},260)}
async function load(){try{const data=await fetch('/catalog.json').then(r=>r.json());rows.innerHTML=data.rows.map(row=>'<section class="row"><div class="rowHead"><h2>'+esc(row.title)+'</h2><span class="chip">'+row.items.length+' titres</span></div><div class="rail">'+row.items.map(card).join('')+'</div></section>').join('');bindPosters(rows)}catch(e){rows.innerHTML='<div class="empty">Erreur catalogue: '+esc(e.message||e)+'</div>'}}
go.onclick=()=>searchCatalog().catch(e=>{searchResults.innerHTML='<div class="empty">Erreur recherche: '+esc(e.message||e)+'</div>'});query.addEventListener('input',loadSuggestions);type.addEventListener('change',loadSuggestions);query.addEventListener('keydown',e=>{if(e.key==='Enter')go.click()});closeBtn.onclick=()=>modal.className='modal';modal.onclick=e=>{if(e.target===modal)modal.className='modal'};renderLocalRows();load();
</script>
</body>
</html>`;
}

function renderProvidersPage() {
  const providers = nuvioManifest.scrapers
    .slice()
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
    .map((provider) => {
      const languages = (provider.contentLanguage || ["fr"]).join(", ").toUpperCase();
      const formats = (provider.formats || []).join(", ").toUpperCase() || "-";
      const domainList = domains[provider.id] || [];
      const state = getProviderState(provider);
      const cls = state === "Actif" ? "ok" : state === "Instable" ? "warn" : "bad";
      return "<tr><td><strong>" + escapeHtml(provider.name || provider.id) + "</strong><small>" + escapeHtml(provider.id) + "</small></td><td class=\"" + cls + "\">" + escapeHtml(state) + "</td><td>" + escapeHtml(languages) + "</td><td>" + escapeHtml(formats) + "</td><td>" + escapeHtml(domainList.join(", ") || "-") + "</td></tr>";
    })
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Providers Madrador Film</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb;--ok:#38bdf8;--warn:#f59e0b;--bad:#fb7185}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 12% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 88% 8%,rgba(37,99,235,.26),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.16),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1180px,calc(100% - 32px));margin:0 auto;padding:22px 0 56px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.nav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px;margin-left:14px}.hero{padding:30px 0 22px;border-bottom:1px solid var(--line)}h1{font-size:clamp(38px,6vw,72px);line-height:1;margin:0 0 10px}.lead{max-width:740px;color:#dbeafe;font-size:18px}table{width:100%;border-collapse:collapse;background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:22px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted)}tr:last-child td{border-bottom:0}td small{display:block;color:var(--muted);margin-top:3px}.ok{color:var(--ok);font-weight:900}.warn{color:var(--warn);font-weight:900}.bad{color:var(--bad);font-weight:900}.pill{display:inline-flex;align-items:center;min-height:24px;border-radius:999px;padding:0 9px;background:#1d2446;color:#dbeafe;font-weight:900;font-size:12px}@media(max-width:780px){main{width:min(100% - 20px,1180px)}.nav{height:auto;display:grid}.nav a{margin:0 10px 0 0}table{font-size:13px}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand">MADRADOR FILM</div><nav><a href="/">Accueil</a><a href="/test-player">Lecteur</a><a href="/catalog">Catalogue</a></nav></header>
  <section class="hero"><span class="pill">Providers</span><h1>Sources FR</h1><p class="lead">Vue claire des providers actifs, limites ou instables, avec langues, formats et domaines centralises quand ils existent.</p></section>
  <table><thead><tr><th>Provider</th><th>Etat</th><th>Langue</th><th>Formats</th><th>Domaines</th></tr></thead><tbody>${providers}</tbody></table>
</main>
</body>
</html>`;
}

function renderInstallPage(req) {
  const baseUrl = getPublicBaseUrl(req);
  const manifestUrl = baseUrl + "/v3/manifest.json";
  const stremioUrl = "stremio://" + manifestUrl.replace(/^https?:\/\//, "");
  const webAddonsUrl = "https://web.stremio.com/#/addons";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Installer Madrador Film FR</title>
<link rel="icon" href="/logo.png">
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#303866;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb;--ok:#38bdf8}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.5}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 16% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 82% 8%,rgba(37,99,235,.26),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.12),#060714 62%);pointer-events:none}main{position:relative;z-index:1;width:min(920px,calc(100% - 28px));margin:0 auto;padding:34px 0 56px}.brand{font-weight:900;color:#a78bfa;font-size:24px;margin-bottom:24px}h1{font-size:clamp(38px,7vw,74px);line-height:.98;margin:0 0 12px}.lead{color:#dbeafe;font-size:18px;max-width:760px}.card{background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;padding:18px;margin:16px 0}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}a,button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:7px;border:1px solid var(--line);color:#fff;text-decoration:none;font-weight:900;background:#10142b}a.primary,button.primary{border:0;background:linear-gradient(135deg,var(--violet),var(--blue))}code{display:block;background:#050817;border:1px solid var(--line);border-radius:7px;padding:13px;overflow:auto;color:#dbeafe}.steps{counter-reset:item;display:grid;gap:10px;margin-top:12px}.step{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:start}.step:before{counter-increment:item;content:counter(item);display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:linear-gradient(135deg,var(--violet),var(--blue));font-weight:900}.muted{color:var(--muted)}.ok{color:var(--ok);font-weight:900}@media(max-width:620px){main{width:100%;padding:22px 12px 42px}.actions{display:grid}a,button{width:100%}.card{padding:14px}h1{font-size:38px}}
</style>
</head>
<body>
<main>
  <div class="brand">MADRADOR FILM</div>
  <h1>Installation Stremio propre</h1>
  <p class="lead">Cette page utilise l'URL versionnee qui evite le vieux cache de Stremio Web.</p>
  <div class="actions"><a class="primary" href="${escapeHtml(stremioUrl)}">Installer dans Stremio Desktop</a><a href="${escapeHtml(webAddonsUrl)}" target="_blank">Ouvrir Stremio Web Addons</a><a href="/v3/manifest.json" target="_blank">Voir le manifest</a></div>
  <div class="card"><strong>URL a copier dans Add addon</strong><code id="manifest">${escapeHtml(manifestUrl)}</code><div class="actions"><button class="primary" id="copy">Copier l'URL</button><button id="test">Tester Mario</button></div><p id="out" class="muted">Pret.</p></div>
  <div class="card"><strong>Etapes exactes</strong><div class="steps"><div class="step">Dans Stremio, supprime tous les anciens addons Madrador.</div><div class="step">Va dans Addons puis clique Add addon.</div><div class="step">Colle exactement l'URL ci-dessus et installe Madrador Film FR.</div><div class="step">Retourne sur ton film et fais Ctrl+F5 si tu es sur Stremio Web.</div></div></div>
</main>
<script>
const manifest=document.getElementById('manifest').textContent,out=document.getElementById('out');
document.getElementById('copy').onclick=async()=>{await navigator.clipboard.writeText(manifest).catch(()=>{});out.innerHTML='<span class="ok">URL copiee.</span>'};
document.getElementById('test').onclick=async()=>{out.textContent='Test en cours...';try{const data=await fetch('/v3/stream/movie/tt28650488.json').then(r=>r.json());out.innerHTML='<span class="ok">'+(data.streams||[]).length+' streams trouves pour Mario.</span>'}catch(e){out.textContent='Erreur test: '+(e.message||e)}};
</script>
</body>
</html>`;
}

async function searchTmdb(query, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
  const normalizedQuery = query.trim().toLowerCase();
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

async function getTmdbExternalId(tmdbId, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
  return cachedJson("external:" + type + ":" + tmdbId, async () => {
    const endpoint = "https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(tmdbId) +
      "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
      "&append_to_response=external_ids";
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("TMDB details failed: HTTP " + response.status);
    const data = await response.json();
    return {
      imdbId: data.imdb_id || data.external_ids && data.external_ids.imdb_id || "",
      title: data.title || data.name || "",
      type: type === "tv" ? "series" : "movie"
    };
  }, 24 * 60 * 60 * 1000);
}

async function getTmdbDetails(tmdbId, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
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

async function getCatalogRows() {
  return cachedJson("catalog:v2", async () => {
    const rows = await Promise.all([
      tmdbList("/movie/popular", { page: "1" }, "movie").then((items) => ({ id: "popular-movies", title: "Populaire en films", items })),
      tmdbList("/movie/now_playing", { page: "1" }, "movie").then((items) => ({ id: "new-movies", title: "Films recents", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "27", page: "1" }, "movie").then((items) => ({ id: "horror", title: "Horreur et thriller", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "10749", page: "1" }, "movie").then((items) => ({ id: "romance", title: "Romance", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "28", page: "1" }, "movie").then((items) => ({ id: "action", title: "Action", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "878", page: "1" }, "movie").then((items) => ({ id: "science-fiction", title: "Science-fiction", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "35", page: "1" }, "movie").then((items) => ({ id: "comedies", title: "Comedies", items })),
      tmdbList("/tv/popular", { page: "1" }, "tv").then((items) => ({ id: "popular-series", title: "Series populaires", items })),
      tmdbList("/tv/top_rated", { page: "1" }, "tv").then((items) => ({ id: "top-series", title: "Series les mieux notees", items })),
      tmdbList("/discover/tv", { sort_by: "popularity.desc", with_genres: "16", page: "1" }, "tv").then((items) => ({ id: "anime", title: "Animation et anime", items }))
    ]);

    return {
      generatedAt: new Date().toISOString(),
      rows
    };
  }, 30 * 60 * 1000);
}

async function toStremioMetaPreview(item) {
  try {
    const external = await getTmdbExternalId(item.id, item.type);
    if (!external.imdbId) return null;
    return {
      id: external.imdbId,
      type: item.type === "series" ? "series" : "movie",
      name: item.title,
      poster: item.poster || undefined,
      background: item.backdrop || undefined,
      description: item.overview || undefined,
      releaseInfo: item.year || undefined,
      imdbRating: item.rating ? String(Number(item.rating).toFixed(1)) : undefined
    };
  } catch (_) {
    return null;
  }
}

async function getStremioCatalog(type, catalogId, extra) {
  const stremioType = type === "series" ? "series" : "movie";
  const expectedId = stremioType === "series" ? "madrador-series" : "madrador-movies";
  if (catalogId !== expectedId) return { metas: [] };

  const search = String(extra.search || "").trim();
  const skip = Math.max(0, Number(extra.skip || 0) || 0);
  const page = String(Math.floor(skip / 18) + 1);
  const cacheKey = ["stremio-catalog", stremioType, catalogId, search.toLowerCase(), page].join(":");

  return cachedJson(cacheKey, async () => {
    const items = search
      ? await searchTmdb(search, stremioType)
      : stremioType === "series"
        ? await tmdbList("/tv/popular", { page }, "tv")
        : await tmdbList("/movie/popular", { page }, "movie");

    const metas = (await Promise.all(items.slice(0, 18).map(toStremioMetaPreview))).filter(Boolean);
    return { metas };
  }, SEARCH_CACHE_TTL_MS);
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
        results.push({ provider: id, status: "ERROR", streams: 0, timeMs: 0, error: "Unknown provider" });
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
        results.push({
          provider: id,
          status: streams.length > 0 ? "OK" : result.error ? "ERROR" : "ZERO",
          streams: streams.length,
          timeMs: Date.now() - started,
          unstable: unstableProviders.has(id),
          error: result.error ? result.error.message : ""
        });
      } catch (error) {
        results.push({
          provider: id,
          status: "ERROR",
          streams: 0,
          timeMs: Date.now() - started,
          unstable: unstableProviders.has(id),
          error: error && error.message ? error.message : String(error)
        });
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
    name: stremioManifest.name,
    version: stremioManifest.version,
    providers: getEnabledProviders("tv").map((provider) => provider.id),
    movieProviders: getEnabledProviders("movie").map((provider) => provider.id),
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    providerFilter: PROVIDER_FILTER,
    cache: {
      defaultMs: CACHE_TTL_MS,
      searchMs: SEARCH_CACHE_TTL_MS,
      streamsMs: STREAM_CACHE_TTL_MS,
      diagnosticsMs: DIAGNOSTIC_CACHE_TTL_MS,
      entries: memoryCache.size
    }
  };
}

async function getStremioOpenInfo(tmdbId, mediaType) {
  const external = await getTmdbExternalId(tmdbId, mediaType);
  if (!external.imdbId) throw new Error("Aucun ID IMDb trouve pour ce titre.");
  const type = external.type === "series" ? "series" : "movie";
  return {
    title: external.title,
    type,
    tmdbId: String(tmdbId),
    imdbId: external.imdbId,
    desktopUrl: "stremio:///detail/" + type + "/" + external.imdbId + "/" + external.imdbId,
    webUrl: "https://web.stremio.com/#/detail/" + type + "/" + external.imdbId + "/" + external.imdbId
  };
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

function parseCatalogPath(pathname) {
  const match = pathname.match(/^\/catalog\/([^/]+)\/([^/]+)(?:\/(.+))?\.json$/);
  if (!match) return null;

  const extra = {};
  if (match[3]) {
    const params = new URLSearchParams(decodeURIComponent(match[3]));
    for (const [key, value] of params.entries()) {
      extra[key] = value;
    }
  }

  return {
    type: decodeURIComponent(match[1]),
    id: decodeURIComponent(match[2]),
    extra
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

function getStreamRank(stream) {
  if (!stream || !stream.originalUrl && !stream.url) return 50;
  const url = stream.url || "";
  if (isMp4Url(url)) return 0;
  if (isPlaylistUrl(url)) return 10;
  if (stream.isDirect) return 20;
  return 40;
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

function toStremioStream(stream, provider, req) {
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
          console.warn("[Stremio] " + provider.id + ": " + result.error.message);
        }

        for (const stream of result.streams) {
          rows.push({ providerId: provider.id, stream });
        }
      } catch (error) {
        console.warn("[Stremio] " + provider.id + ": " + (error && error.message ? error.message : error));
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
    const stremioStream = toStremioStream(row.stream, provider, req);
    if (!stremioStream || seen.has(stremioStream.url)) continue;
    seen.add(stremioStream.url);
    stremioStream._rank = getStreamRank(row.stream);
    streams.push(stremioStream);
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
      req.addonPrefix = prefixMatch[0];
      url.pathname = url.pathname.slice(prefixMatch[0].length) || "/";
    } else {
      req.addonPrefix = "";
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (url.pathname === "/") {
      sendHtml(res, 200, renderCatalogPage());
      return;
    }

    if (url.pathname === "/favicon.ico" || url.pathname === "/logo.png") {
      sendFile(res, 200, path.join(ROOT, "assets", "Logo-2.png"), "image/png");
      return;
    }

    if (url.pathname === "/test-player") {
      sendHtml(res, 200, renderTestPlayerPage());
      return;
    }

    if (url.pathname === "/catalog") {
      sendHtml(res, 200, renderCatalogPage());
      return;
    }

    if (url.pathname === "/providers") {
      sendHtml(res, 200, renderProvidersPage());
      return;
    }

    if (url.pathname === "/install") {
      sendHtml(res, 200, renderInstallPage(req));
      return;
    }

    if (url.pathname === "/status") {
      sendHtml(res, 200, renderStatusPage());
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

    if (url.pathname === "/config.json") {
      sendJson(res, 200, getConfig(req));
      return;
    }

    if (url.pathname === "/catalog.json") {
      sendJson(res, 200, await getCatalogRows());
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

    if (url.pathname === "/providers.json") {
      sendJson(res, 200, {
        movie: getProviderSummary("movie"),
        series: getProviderSummary("tv"),
        all: nuvioManifest.scrapers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          state: getProviderState(provider),
          languages: provider.contentLanguage || [],
          formats: provider.formats || [],
          domains: domains[provider.id] || []
        }))
      });
      return;
    }

    if (url.pathname === "/stremio-open.json") {
      const tmdbId = url.searchParams.get("id") || "";
      const mediaType = url.searchParams.get("type") || "movie";
      if (!tmdbId.trim()) {
        sendJson(res, 400, { error: "Missing id" });
        return;
      }
      sendJson(res, 200, await getStremioOpenInfo(tmdbId, mediaType));
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

    const catalogRequest = parseCatalogPath(url.pathname);
    if (catalogRequest) {
      sendJson(res, 200, await getStremioCatalog(catalogRequest.type, catalogRequest.id, catalogRequest.extra));
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
