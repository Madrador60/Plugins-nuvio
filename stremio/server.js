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
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000);
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

function getPublicBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function getProxyExtension(sourceUrl) {
  const cleanUrl = String(sourceUrl || "").split("?")[0].toLowerCase();
  const match = cleanUrl.match(/\.([a-z0-9]{2,5})$/);
  if (match) return match[1];
  return "m3u8";
}

function getProxyUrl(req, stream) {
  const payload = {
    url: stream.url,
    headers: stream.headers || {}
  };
  const extension = getProxyExtension(stream.url);
  return getPublicBaseUrl(req) + "/proxy/" + base64UrlEncode(JSON.stringify(payload)) + "/stream." + extension;
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
    limited: Boolean(provider.limited)
  }));
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
    "<div class=\"actions\"><a class=\"btn primary\" href=\"" + escapeHtml(stremioInstallUrl) + "\">Installer dans Stremio</a><a class=\"btn\" href=\"/catalog\">Catalogue</a><a class=\"btn\" href=\"/manifest.json\">Voir le manifest</a><a class=\"btn\" href=\"/test-player\">Tester la lecture</a><a class=\"btn\" href=\"/status\">Statut</a><a class=\"btn\" href=\"https://github.com/Madrador60/Plugins-nuvio\">GitHub</a></div></div>" +
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Madrador Film</title>
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--panel2:#191d36;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--red:#7c3aed;--red2:#2563eb;--green:#38bdf8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}
body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 18% 0%,rgba(124,58,237,.34),transparent 34%),radial-gradient(circle at 82% 12%,rgba(37,99,235,.28),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.2),#060714 62%);pointer-events:none}
main{position:relative;z-index:1;width:min(1280px,calc(100% - 32px));margin:0 auto;padding:22px 0 56px}
.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;letter-spacing:0;text-shadow:0 0 24px rgba(124,58,237,.6)}.navlinks{display:flex;gap:10px;flex-wrap:wrap}.navlinks a{color:#eef2ff;text-decoration:none;font-weight:700;font-size:14px;padding:8px 10px;border-radius:6px}.navlinks a:hover{background:#1b2144}
.hero{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(340px,.78fr);gap:22px;align-items:stretch;margin-top:14px}.player{position:relative;background:#000;border-radius:8px;overflow:hidden;box-shadow:0 24px 90px rgba(37,99,235,.18),0 18px 70px rgba(0,0,0,.58)}video{display:block;width:100%;height:100%;min-height:430px;max-height:68vh;background:#000;object-fit:contain}.shade{position:absolute;inset:auto 0 0 0;padding:22px 22px 52px;background:linear-gradient(0deg,rgba(8,10,25,.94),transparent);pointer-events:none}.shade h1{font-size:clamp(30px,5vw,58px);line-height:1;margin:0 0 8px}.shade p{margin:0;color:var(--muted);max-width:720px}
.side{display:flex;flex-direction:column;gap:14px}.searchBox,.now,.streamsPanel,.logPanel{background:rgba(17,20,38,.92);border:1px solid var(--line);border-radius:8px;padding:14px}.searchGrid{display:grid;grid-template-columns:1fr 110px;gap:10px}input,select,button{font:inherit;min-height:42px;border-radius:6px;border:1px solid #303866}input,select{background:#080b1d;color:#fff;padding:0 12px}button{border:0;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;font-weight:800;padding:0 14px;cursor:pointer}button:hover{background:linear-gradient(135deg,#8b5cf6,#3b82f6)}button.secondary{background:#232a50}button.ghost{background:#080b1d;border:1px solid #303866}.searchBtn{width:100%;margin-top:10px}
.label{color:var(--muted);font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:.08em;margin-bottom:8px}.nowTitle{font-weight:900;font-size:18px}.nowUrl{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.rows{margin-top:26px}.rowHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}h2{margin:0;font-size:22px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:156px;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;padding:2px 0 14px;scrollbar-color:#555 transparent}.poster{height:232px;width:156px;text-align:left;background:#151515;border:1px solid #242424;border-radius:7px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#777}.poster img{width:100%;height:178px;object-fit:cover;background:#222}.poster strong{display:block;padding:8px 8px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 8px 8px;font-size:12px}
.streamGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stream{min-height:86px;text-align:left;background:#10142b;border:1px solid #29305c;border-radius:8px;color:#fff;padding:12px}.stream.active{border-color:var(--green);box-shadow:0 0 0 1px var(--green),0 0 24px rgba(56,189,248,.25)}.stream strong{display:block;font-size:15px}.stream small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:5px}.pill{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:#29305c;color:#fff;font-size:11px;font-weight:900;margin-top:7px}.pill.mp4{background:#2563eb}.pill.hls{background:#6d28d9}
pre{white-space:pre-wrap;background:#050505;border:1px solid #222;border-radius:8px;padding:12px;color:#cbd5e1;overflow:auto;max-height:170px;margin:0}.empty{color:var(--muted);background:#101010;border:1px dashed #333;border-radius:8px;padding:18px}
@media(max-width:980px){.hero{grid-template-columns:1fr}video{min-height:300px}.streamGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){main{width:min(100% - 20px,1280px)}.nav{height:auto;align-items:flex-start;display:grid}.navlinks{display:grid;grid-template-columns:1fr 1fr 1fr}.hero{gap:14px}.searchGrid,.tools,.streamGrid{grid-template-columns:1fr}.rail{grid-auto-columns:132px}.poster{width:132px;height:210px}.poster img{height:154px}}
</style>
</head>
<body>
<main>
  <header class="nav">
    <div class="brand">MADRADOR FILM</div>
    <nav class="navlinks"><a href="/">Accueil</a><a href="/catalog">Catalogue</a><a href="/status">Statut</a><a href="/manifest.json">Manifest</a></nav>
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
const log=document.getElementById('log'),video=document.getElementById('video'),q=document.getElementById('query'),type=document.getElementById('type'),searchBtn=document.getElementById('search'),results=document.getElementById('results'),streamsBox=document.getElementById('streams'),nowTitle=document.getElementById('nowTitle'),nowUrl=document.getElementById('nowUrl'),copyBtn=document.getElementById('copy'),openBtn=document.getElementById('open'),heroTitle=document.getElementById('heroTitle'),heroMeta=document.getElementById('heroMeta'),resultCount=document.getElementById('resultCount'),streamCount=document.getElementById('streamCount'),filterAll=document.getElementById('filterAll'),filterMp4=document.getElementById('filterMp4'),filterHls=document.getElementById('filterHls');let hls=null,currentUrl='',allStreams=[],streamFilter='all';const params=new URLSearchParams(location.search);if(params.get('q'))q.value=params.get('q');if(params.get('type'))type.value=params.get('type');const noPoster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="312" height="464"><rect width="100%" height="100%" fill="#151515"/><text x="50%" y="47%" fill="#777" font-family="Arial" font-size="28" text-anchor="middle">MADRADOR</text><text x="50%" y="55%" fill="#555" font-family="Arial" font-size="22" text-anchor="middle">FILM</text></svg>');
function write(x){log.textContent+='\\n'+x;log.scrollTop=log.scrollHeight}function setLog(x){log.textContent=x}function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}function formatUrl(u){const s=String(u||'').replace(location.origin,'');const m=s.match(/^\\/proxy\\/[^/]+\\/(stream\\.[a-z0-9]+)$/i);return m?'/proxy/.../'+m[1]:s}
async function search(){const query=q.value.trim();if(!query)return;setLog('Recherche: '+query);results.className='empty';results.textContent='Recherche...';streamsBox.className='empty';streamsBox.textContent='Choisis un resultat.';streamCount.textContent='';const data=await fetch('/search.json?type='+encodeURIComponent(type.value)+'&q='+encodeURIComponent(query)).then(r=>r.json());resultCount.textContent=data.results.length+' resultat(s)';results.className='rail';results.innerHTML=data.results.map(r=>'<button class="poster" data-id="'+r.id+'" data-type="'+r.type+'" data-title="'+esc(r.title)+'" data-year="'+esc(r.year||'')+'"><img src="'+esc(r.poster||noPoster)+'" alt=""><strong>'+esc(r.title)+'</strong><small>'+esc(r.year||'Annee inconnue')+' · TMDB '+r.id+'</small></button>').join('')||'<div class="empty">Aucun resultat</div>';results.querySelectorAll('button').forEach(b=>b.onclick=()=>loadStreams(b.dataset.type,b.dataset.id,b.dataset.title,b.dataset.year));write('Resultats: '+data.results.length)}
function renderStreams(){const visible=allStreams.filter(s=>streamFilter==='all'||(streamFilter==='mp4'&&s.url.includes('.mp4'))||(streamFilter==='hls'&&s.url.includes('.m3u8')));streamCount.textContent=visible.length+' source(s)';streamsBox.className='streamGrid';streamsBox.innerHTML=visible.map((s,i)=>{const originalIndex=allStreams.indexOf(s);const kind=s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'LINK';const cls=kind==='MP4'?'mp4':kind==='HLS'?'hls':'';return '<button class="stream" data-i="'+originalIndex+'"><strong>'+esc(s.name)+'</strong><small>'+esc(s.title||s.description||'')+'</small><span class="pill '+cls+'">'+kind+'</span><small>'+esc(formatUrl(s.url))+'</small></button>'}).join('')||'<div class="empty">Aucune source pour ce filtre</div>';streamsBox.querySelectorAll('button').forEach(b=>b.onclick=()=>play(allStreams[Number(b.dataset.i)],b))}
async function loadStreams(mediaType,id,title,year){heroTitle.textContent=title;heroMeta.textContent=(year?year+' · ':'')+'Recherche des sources...';setLog('Streams pour '+title+'...');streamsBox.className='empty';streamsBox.textContent='Chargement des sources...';const endpoint='/stream/'+mediaType+'/'+id+'.json';const data=await fetch(endpoint).then(r=>r.json());allStreams=data.streams||[];renderStreams();write('Streams: '+allStreams.length);if(allStreams[0]) play(allStreams[0],streamsBox.querySelector('button'))}
async function play(s,button){if(!s)return;streamsBox.querySelectorAll('.active').forEach(x=>x.classList.remove('active'));if(button)button.classList.add('active');const kind=s.url.includes('.mp4')?'MP4':s.url.includes('.m3u8')?'HLS':'Lien';currentUrl=s.url;nowTitle.textContent=s.name+' · '+kind;nowUrl.textContent=formatUrl(s.url);heroMeta.textContent=s.title||s.description||kind;write('Lecture: '+s.name+' - '+(s.title||s.description||''));write(s.url);if(hls){hls.destroy();hls=null}video.removeAttribute('src');video.load();if(s.url.includes('.m3u8')){if(window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,lowLatencyMode:false});hls.loadSource(s.url);hls.attachMedia(video);hls.on(Hls.Events.ERROR,(e,d)=>write('HLS error: '+JSON.stringify({type:d.type,details:d.details,fatal:d.fatal})));}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=s.url}else{write('HLS non supporte dans ce navigateur');return}}else{video.src=s.url}await video.play().catch(e=>write('Lecture bloquee: '+e.message))}
function setFilter(value){streamFilter=value;filterAll.className=value==='all'?'secondary':'ghost';filterMp4.className=value==='mp4'?'secondary':'ghost';filterHls.className=value==='hls'?'secondary':'ghost';renderStreams()}copyBtn.onclick=async()=>{if(!currentUrl)return;await navigator.clipboard.writeText(currentUrl).catch(()=>{});write('URL copiee')};openBtn.onclick=()=>{if(currentUrl)window.open(currentUrl,'_blank')};filterAll.onclick=()=>setFilter('all');filterMp4.onclick=()=>setFilter('mp4');filterHls.onclick=()=>setFilter('hls');video.addEventListener('error',()=>write('Video error code: '+(video.error&&video.error.code)));searchBtn.onclick=()=>search().catch(e=>setLog('Erreur: '+(e.stack||e.message||e)));q.addEventListener('keydown',e=>{if(e.key==='Enter')searchBtn.click()});if(params.get('q'))setTimeout(()=>searchBtn.click(),250);
</script>
</body>
</html>`;
}

function renderStatusPage() {
  return "<!doctype html>" +
    "<html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Statut providers</title><style>:root{color-scheme:dark;--bg:#111315;--panel:#1a1d20;--line:#30353b;--text:#f5f7fa;--muted:#aab2bd;--accent:#8b5cf6;--ok:#22c55e;--bad:#ef4444}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Segoe UI,Arial,sans-serif;line-height:1.5}main{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:34px 0}button{min-height:42px;padding:0 14px;border-radius:8px;border:1px solid var(--line);background:var(--accent);color:white;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:16px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line)}th{color:var(--muted)}tr:last-child td{border-bottom:0}.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}.muted{color:var(--muted)}pre{white-space:pre-wrap;background:#080a0c;border:1px solid var(--line);border-radius:8px;padding:12px;color:#cbd5e1;overflow:auto}</style></head>" +
    "<body><main><h1>Statut providers</h1><p class=\"muted\">Teste les providers films principaux avec Interstellar. Le test peut prendre jusqu'a une minute.</p><p><button id=\"run\">Lancer le diagnostic</button> <a style=\"color:#c4b5fd\" href=\"/test-player\">Test player</a></p><div id=\"out\" class=\"muted\">Pret.</div></main>" +
    "<script>const out=document.getElementById('out');document.getElementById('run').onclick=async()=>{out.textContent='Diagnostic en cours...';try{const data=await fetch('/diagnostics.json').then(r=>r.json());out.innerHTML='<table><thead><tr><th>Provider</th><th>Statut</th><th>Streams</th><th>Temps</th><th>Note</th></tr></thead><tbody>'+data.results.map(r=>'<tr><td>'+r.provider+'</td><td class=\"'+(r.status==='OK'?'ok':'bad')+'\">'+r.status+'</td><td>'+r.streams+'</td><td>'+r.timeMs+'ms</td><td>'+((r.error||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])))+'</td></tr>').join('')+'</tbody></table><pre>'+JSON.stringify(data,null,2)+'</pre>'}catch(e){out.textContent='Erreur: '+(e.message||e)}};</script></body></html>";
}

function renderCatalogPage() {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catalogue Madrador Film</title>
<style>
:root{color-scheme:dark;--bg:#060714;--panel:#111426;--line:#2d335c;--text:#fff;--muted:#b8c0e0;--violet:#7c3aed;--blue:#2563eb}
*{box-sizing:border-box}body{margin:0;background:#060714;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45}body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 16% 0%,rgba(124,58,237,.32),transparent 34%),radial-gradient(circle at 80% 8%,rgba(37,99,235,.24),transparent 30%),linear-gradient(180deg,rgba(0,0,0,.15),#060714 64%);pointer-events:none}main{position:relative;z-index:1;width:min(1320px,calc(100% - 32px));margin:0 auto;padding:22px 0 56px}.nav{height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:24px;color:#a78bfa;text-shadow:0 0 24px rgba(124,58,237,.6)}.nav a{color:#eef2ff;text-decoration:none;font-weight:800;font-size:14px;margin-left:14px}.hero{min-height:310px;display:flex;align-items:flex-end;border-radius:10px;padding:28px;margin:18px 0 28px;background:linear-gradient(90deg,rgba(6,7,20,.94),rgba(6,7,20,.55)),url('https://image.tmdb.org/t/p/original/8eifdha9GQeZAkexgtD45546XKx.jpg') center/cover;box-shadow:0 22px 90px rgba(37,99,235,.18)}h1{font-size:clamp(42px,7vw,80px);line-height:.95;margin:0 0 12px}.lead{max-width:720px;color:#dbeafe;font-size:18px}.search{display:grid;grid-template-columns:1fr 130px auto;gap:10px;max-width:760px;margin-top:18px}input,select,button{min-height:44px;border-radius:7px;border:1px solid #303866;font:inherit}input,select{background:#080b1d;color:#fff;padding:0 12px}button{border:0;background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;font-weight:900;padding:0 16px;cursor:pointer}.row{margin:24px 0}.rowHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:23px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:164px;gap:12px;overflow-x:auto;padding:2px 0 16px;scrollbar-color:#4b5563 transparent}.poster{height:250px;width:164px;text-align:left;background:#111426;border:1px solid #29305c;border-radius:8px;color:#fff;padding:0;overflow:hidden;transition:transform .16s,border-color .16s}.poster:hover{transform:scale(1.04);border-color:#8b5cf6}.poster img{width:100%;height:188px;object-fit:cover;background:#172033}.poster strong{display:block;padding:8px 9px 0;font-size:13px;line-height:1.2}.poster small{display:block;color:var(--muted);padding:3px 9px;font-size:12px}.empty{color:var(--muted);border:1px dashed #303866;border-radius:8px;padding:18px;background:#0a0d20}.loading{color:#c4b5fd}.tools{display:flex;gap:8px;flex-wrap:wrap}.chip{display:inline-flex;align-items:center;min-height:30px;border:1px solid #303866;border-radius:999px;padding:0 10px;color:#dbeafe;background:#10142b;font-weight:800;font-size:12px}@media(max-width:760px){main{width:min(100% - 20px,1320px)}.nav{height:auto;display:grid}.nav a{margin:0 10px 0 0}.hero{padding:18px;min-height:270px}.search{grid-template-columns:1fr}.rail{grid-auto-columns:136px}.poster{width:136px;height:220px}.poster img{height:158px}}
</style>
</head>
<body>
<main>
  <header class="nav"><div class="brand">MADRADOR FILM</div><nav><a href="/test-player">Lecteur</a><a href="/status">Statut</a><a href="/manifest.json">Manifest</a></nav></header>
  <section class="hero"><div><span class="chip">Catalogue beta</span><h1>Films et series</h1><p class="lead">Parcours des rangees inspirees des plateformes de streaming, puis lance une recherche directement dans le lecteur Madrador Film.</p><div class="search"><input id="query" placeholder="Rechercher un titre..." value="Send Help"><select id="type"><option value="movie">Film</option><option value="series">Serie</option></select><button id="go">Rechercher</button></div></div></section>
  <div id="rows" class="loading">Chargement du catalogue...</div>
</main>
<script>
const rows=document.getElementById('rows'),query=document.getElementById('query'),type=document.getElementById('type'),go=document.getElementById('go');
const noPoster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="312" height="464"><rect width="100%" height="100%" fill="#111426"/><text x="50%" y="48%" fill="#8b5cf6" font-family="Arial" font-size="26" text-anchor="middle">MADRADOR</text><text x="50%" y="56%" fill="#60a5fa" font-family="Arial" font-size="20" text-anchor="middle">FILM</text></svg>');
function esc(x){return String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function openSearch(t,kind){location.href='/test-player?q='+encodeURIComponent(t)+'&type='+encodeURIComponent(kind)}
function card(item){return '<button class="poster" data-title="'+esc(item.title)+'" data-type="'+item.type+'"><img src="'+esc(item.poster||noPoster)+'" alt=""><strong>'+esc(item.title)+'</strong><small>'+esc(item.year||'')+' · '+esc(item.type==='series'?'Serie':'Film')+'</small></button>'}
async function load(){try{const data=await fetch('/catalog.json').then(r=>r.json());rows.innerHTML=data.rows.map(row=>'<section class="row"><div class="rowHead"><h2>'+esc(row.title)+'</h2><span class="chip">'+row.items.length+' titres</span></div><div class="rail">'+row.items.map(card).join('')+'</div></section>').join('');rows.querySelectorAll('.poster').forEach(b=>b.onclick=()=>openSearch(b.dataset.title,b.dataset.type))}catch(e){rows.innerHTML='<div class="empty">Erreur catalogue: '+esc(e.message||e)+'</div>'}}
go.onclick=()=>openSearch(query.value.trim(),type.value);query.addEventListener('keydown',e=>{if(e.key==='Enter')go.click()});load();
</script>
</body>
</html>`;
}

async function searchTmdb(query, mediaType) {
  const type = mediaType === "series" || mediaType === "tv" ? "tv" : "movie";
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
  return cachedJson("catalog:v1", async () => {
    const rows = await Promise.all([
      tmdbList("/movie/popular", { page: "1" }, "movie").then((items) => ({ id: "popular-movies", title: "Populaire en films", items })),
      tmdbList("/movie/now_playing", { page: "1" }, "movie").then((items) => ({ id: "new-movies", title: "Films recents", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "27", page: "1" }, "movie").then((items) => ({ id: "horror", title: "Horreur et thriller", items })),
      tmdbList("/discover/movie", { sort_by: "popularity.desc", with_genres: "10749", page: "1" }, "movie").then((items) => ({ id: "romance", title: "Romance", items })),
      tmdbList("/tv/popular", { page: "1" }, "tv").then((items) => ({ id: "popular-series", title: "Series populaires", items })),
      tmdbList("/discover/tv", { sort_by: "popularity.desc", with_genres: "16", page: "1" }, "tv").then((items) => ({ id: "anime", title: "Animation et anime", items }))
    ]);

    return {
      generatedAt: new Date().toISOString(),
      rows
    };
  }, 30 * 60 * 1000);
}

async function runDiagnostics(req) {
  const ids = (req.url && new URL(req.url, "http://localhost").searchParams.get("providers") || "movix,frenchstream,nakios,toflix")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
        error: result.error ? result.error.message : ""
      });
    } catch (error) {
      results.push({
        provider: id,
        status: "ERROR",
        streams: 0,
        timeMs: Date.now() - started,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  return {
    ok: results.every((item) => item.status === "OK"),
    test: "Interstellar",
    tmdbId: "157336",
    generatedAt: new Date().toISOString(),
    results
  };
}

function getConfig(req) {
  return {
    name: stremioManifest.name,
    version: stremioManifest.version,
    providers: getEnabledProviders("tv").map((provider) => provider.id),
    movieProviders: getEnabledProviders("movie").map((provider) => provider.id),
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    providerFilter: PROVIDER_FILTER
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
  if (stream.headers && Object.keys(stream.headers).length > 0) return true;
  return isPlaylistUrl(stream.url);
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
    "accept-ranges": upstream.headers.get("accept-ranges") || "bytes"
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
  const requestHeaders = Object.assign({}, proxyRequest.headers);
  if (req.headers.range) requestHeaders.Range = req.headers.range;

  const upstream = await fetch(proxyRequest.url, {
    headers: requestHeaders,
    redirect: "follow"
  });

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
      "cache-control": "no-store"
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
      notWebReady: extension !== "mp4",
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
        const stremioStream = toStremioStream(stream, provider, req);
        if (!stremioStream || seen.has(stremioStream.url)) continue;
        seen.add(stremioStream.url);
        stremioStream._rank = getStreamRank(stream);
        streams.push(stremioStream);
      }
    } catch (error) {
      console.warn("[Stremio] " + provider.id + ": " + (error && error.message ? error.message : error));
    }
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

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (url.pathname === "/") {
      sendHtml(res, 200, renderHomePage(req));
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

    if (url.pathname === "/diagnostics.json") {
      sendJson(res, 200, await runDiagnostics(req));
      return;
    }

    if (url.pathname === "/providers.json") {
      sendJson(res, 200, {
        movie: getProviderSummary("movie"),
        series: getProviderSummary("tv")
      });
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
