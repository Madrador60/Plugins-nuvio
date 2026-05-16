(function () {
  const placeholder = "/site-madrador/assets/img/placeholder-poster.svg";
  const navItems = [
    ["/", "Accueil"],
    ["/catalog", "Catalogue"],
    ["/providers", "Providers"],
    ["/admin", "Admin"],
    ["/legal", "Legal"]
  ];

  function esc(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function typeForUrl(type) {
    return type === "tv" ? "series" : type || "movie";
  }

  function detailsUrl(item) {
    if ((item.kind || item.type) === "person") {
      return `/catalog?person=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.title || item.name || "Acteur")}`;
    }
    return `/details?type=${encodeURIComponent(typeForUrl(item.type))}&id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title || "")}`;
  }

  function keyFor(item) {
    return `${typeForUrl(item.type)}:${item.id}`;
  }

  function readStore(name) {
    try { return JSON.parse(localStorage.getItem(name) || "[]"); } catch { return []; }
  }

  function writeStore(name, value, max) {
    localStorage.setItem(name, JSON.stringify((value || []).slice(0, max || 30)));
  }

  function saveRecent(item) {
    if (!item || !item.id) return;
    const key = keyFor(item);
    const list = readStore("madrador:history").filter((row) => keyFor(row) !== key);
    writeStore("madrador:history", [item].concat(list), 30);
  }

  function toggleFavorite(item) {
    if (!item || !item.id) return false;
    const key = keyFor(item);
    const list = readStore("madrador:favorites");
    const exists = list.some((row) => keyFor(row) === key);
    writeStore("madrador:favorites", exists ? list.filter((row) => keyFor(row) !== key) : [item].concat(list), 40);
    return !exists;
  }

  function isFavorite(item) {
    if (!item || !item.id) return false;
    const key = keyFor(item);
    return readStore("madrador:favorites").some((row) => keyFor(row) === key);
  }

  function playerUrl(item) {
    return `/player?type=${encodeURIComponent(typeForUrl(item.type))}&id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title || "")}`;
  }

  function card(item) {
    const title = item.title || "Sans titre";
    const poster = item.poster || placeholder;
    if ((item.kind || item.type) === "person") {
      const known = Array.isArray(item.knownFor) && item.knownFor.length ? item.knownFor.join(", ") : "Filmographie";
      return `<a class="poster-card" href="${detailsUrl(item)}"><img src="${esc(poster)}" alt=""><span class="body"><strong>${esc(title)}</strong><small>${esc(known)}</small><span class="badge info" style="margin-top:10px">Voir acteur</span></span></a>`;
    }
    const meta = [item.year, typeForUrl(item.type) === "series" ? "Serie" : "Film"].filter(Boolean).join(" · ");
    return `<a class="poster-card" href="${detailsUrl(item)}"><img src="${esc(poster)}" alt=""><span class="body"><strong>${esc(title)}</strong><small>${esc(meta || "Madrador Film")}</small><span class="badge info" style="margin-top:10px">Voir les flux</span></span></a>`;
  }

  async function getJson(url, fallback) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      return fallback === undefined ? { error: error.message } : fallback;
    }
  }

  function mountNav() {
    const host = document.querySelector("[data-nav]");
    if (!host) return;
    const current = location.pathname;
    host.innerHTML = `<nav class="nav"><a class="brand" href="/"><img src="/site-madrador/assets/img/logo.svg" alt="Madrador Film"></a><button class="mobile-toggle" id="navToggle">Menu</button><div class="nav-links" id="navLinks">${navItems.map(([href, label]) => `<a class="${current === href || (href !== "/" && current.startsWith(href)) ? "active" : ""}" href="${href}">${label}</a>`).join("")}</div></nav><nav class="bottom-bar"><a href="/">Accueil</a><a href="/catalog">Recherche</a><a href="/catalog#favoris">Favoris</a><a href="/providers">Providers</a></nav>`;
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  function mountFooter() {
    const host = document.querySelector("[data-footer]");
    if (!host) return;
    host.innerHTML = `<div class="container"><span>Madrador Film ne stocke aucune video.</span><span><a href="/legal">Legal</a> · <a href="/dmca">DMCA</a> · <a href="/security">Securite</a></span></div>`;
  }

  function bindHomeSearch() {
    const go = document.getElementById("homeGo");
    const input = document.getElementById("homeSearch");
    const type = document.getElementById("homeType");
    if (!go || !input || !type) return;
    const run = () => {
      const q = input.value.trim();
      if (!q) return location.assign("/catalog");
      location.assign(`/catalog?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type.value)}`);
    };
    go.addEventListener("click", run);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") run(); });
  }

  window.Madrador = { esc, card, getJson, detailsUrl, playerUrl, placeholder, typeForUrl, keyFor, readStore, writeStore, saveRecent, toggleFavorite, isFavorite };
  mountNav();
  mountFooter();
  bindHomeSearch();
})();
