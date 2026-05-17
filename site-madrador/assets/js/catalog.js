(function () {
  const rowsHost = document.getElementById("catalogRows");
  const searchHost = document.getElementById("searchResults");
  const homeRows = document.querySelectorAll("[data-row]");
  const searchInput = document.getElementById("catalogSearch");
  const searchType = document.getElementById("catalogType");
  const searchButton = document.getElementById("catalogGo");
  const refreshButton = document.getElementById("refreshCatalog");
  const suggestions = document.getElementById("suggestions");
  const localRows = document.getElementById("localRows");
  const yearFilter = document.getElementById("yearFilter");
  const genreFilter = document.getElementById("genreFilter");
  const sortFilter = document.getElementById("sortFilter");
  const featuredHero = document.getElementById("featuredHero");
  const catalogStatus = document.getElementById("catalogStatus");
  const heroMovieCount = document.getElementById("heroMovieCount");
  const heroProviderCount = document.getElementById("heroProviderCount");
  const heroGenreCount = document.getElementById("heroGenreCount");
  const genreStrip = document.getElementById("genreStrip");
  let catalogRows = [];
  let activeFilter = "all";
  let suggestionTimer = 0;
  const visibleCounts = {};
  const PAGE_SIZE = 36;

  async function runSearch(query, type) {
    if (window.MadradorSearch && typeof window.MadradorSearch.runSearch === "function") {
      return window.MadradorSearch.runSearch(query, type);
    }
    const data = await Madrador.getJson(`/search.json?type=${encodeURIComponent(type || "all")}&q=${encodeURIComponent(query)}`, { results: [] });
    return data.results || [];
  }

  function renderRow(row, mode) {
    const items = sortItems(filterItems(row.items || [], row));
    const rowId = row.id || row.title || "row";
    const visible = Math.min(visibleCounts[rowId] || PAGE_SIZE, items.length);
    const shown = items.slice(0, visible);
    const body = items.length ? `<div class="${mode === "grid" ? "grid" : "rail"}">${shown.map(Madrador.card).join("")}</div>` : `<div class="empty">Aucun titre dans cette section.</div>`;
    const more = items.length > visible ? `<button class="btn ghost load-more-row" data-row-id="${Madrador.esc(rowId)}">Charger plus (${items.length - visible})</button>` : "";
    return `<section class="section" data-group="${Madrador.esc(row.group || "movie")}" data-title="${Madrador.esc(row.title || "")}"><div class="section-head"><h2>${Madrador.esc(row.title)}</h2><span class="badge info">${visible}/${items.length} titres</span></div>${body}${more}</section>`;
  }

  function applyFilter() {
    if (!rowsHost) return;
    rowsHost.querySelectorAll("section[data-group]").forEach((section) => {
      const title = (section.dataset.title || "").toLowerCase();
      const group = section.dataset.group || "movie";
      const isAnime = title.includes("anime");
      const show = activeFilter === "all" || group === activeFilter || (activeFilter === "anime" && isAnime);
      section.classList.toggle("hidden", !show);
    });
  }

  function filterItems(items, row) {
    const year = yearFilter && yearFilter.value;
    const genre = genreFilter && genreFilter.value ? genreFilter.value.toLowerCase() : "";
    return items.filter((item) => {
      if (year && String(item.year || "") !== String(year)) return false;
      if (genre) {
        const haystack = [row.title, item.title, item.genres && item.genres.join(" ")].join(" ").toLowerCase();
        if (!haystack.includes(genre)) return false;
      }
      return true;
    });
  }

  function sortItems(items) {
    const sort = sortFilter && sortFilter.value || "popular";
    const list = items.slice();
    if (sort === "recent") return list.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    if (sort === "rating") return list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    if (sort === "az") return list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "fr"));
    return list;
  }

  function rerenderCatalog() {
    if (!rowsHost) return;
    rowsHost.innerHTML = catalogRows.map((row) => renderRow(row, "rail")).join("") || `<div class="empty">Catalogue indisponible.</div>`;
    applyFilter();
  }

  function renderFeatured(item) {
    if (!featuredHero || !item) return;
    const title = item.title || "Madrador Film";
    const backdrop = item.backdrop || item.poster || "/site-madrador/assets/img/banner.svg";
    const rating = Number(item.rating || 0);
    const meta = [item.year, Madrador.typeForUrl(item.type) === "series" ? "Serie" : "Film", rating ? `★ ${rating.toFixed(1)}` : ""].filter(Boolean).join(" · ");
    featuredHero.style.backgroundImage = `linear-gradient(90deg, rgba(5,7,20,.98), rgba(5,7,20,.48), rgba(5,7,20,.94)), url("${Madrador.esc(backdrop)}")`;
    featuredHero.innerHTML = `<div class="spotlight-copy">
      <span class="eyebrow">Selection du moment</span>
      <h1>${Madrador.esc(title)}</h1>
      <p>${Madrador.esc(meta || "Catalogue Madrador Film")}</p>
      <div class="actions"><a class="btn" href="${Madrador.detailsUrl(item)}">Voir la fiche</a><a class="btn secondary" href="/catalog">Explorer le catalogue</a></div>
    </div>`;
  }

  async function loadCatalog(force) {
    const data = await Madrador.getJson(`/catalog.json${force ? "?refresh=1" : ""}`, { rows: [] });
    catalogRows = data.rows || [];
    const total = catalogRows.reduce((sum, row) => sum + ((row.items || []).length), 0);
    const groups = catalogRows.reduce((set, row) => set.add(row.group || "movie"), new Set());
    if (heroMovieCount) heroMovieCount.textContent = total ? total.toLocaleString("fr-FR") : "...";
    if (heroProviderCount) heroProviderCount.textContent = groups.size ? String(Math.max(groups.size, 3)) : "...";
    if (heroGenreCount) heroGenreCount.textContent = genreStrip ? String(Math.max(genreStrip.querySelectorAll("[data-genre-chip]").length - 1, 19)) : "19";
    if (catalogStatus) {
      const tmdbActive = data.fallback !== true;
      catalogStatus.innerHTML = `<span class="badge ${tmdbActive ? "ok" : "warn"}">${tmdbActive ? "TMDB actif" : "TMDB absent"}</span><span class="muted">${total} titres charges · ${Madrador.esc(data.autoUpdate || data.warning || "Cache catalogue actif")}</span>`;
    }
    if (rowsHost) {
      rerenderCatalog();
    }
    if (homeRows.length) {
      homeRows.forEach((target) => {
        const row = catalogRows.find((item) => item.id === target.dataset.row) || catalogRows.find((item) => (item.title || "").toLowerCase().includes(target.dataset.row.replace("-", " ")));
        target.innerHTML = row ? (row.items || []).slice(0, 12).map(Madrador.card).join("") : `<div class="empty">Section indisponible.</div>`;
      });
      const firstRow = catalogRows.find((row) => row.items && row.items.length);
      if (firstRow) renderFeatured(firstRow.items[0]);
    }
  }

  async function doSearch() {
    if (!searchInput || !searchHost) return;
    const q = searchInput.value.trim();
    if (!q) return;
    if (window.MadradorSearchUI && typeof window.MadradorSearchUI.renderCatalogSearch === "function") {
      window.MadradorSearchUI.renderCatalogSearch(q, searchType ? searchType.value : "all");
      if (suggestions) suggestions.classList.add("hidden");
      return;
    }
    searchHost.classList.remove("hidden");
    searchHost.innerHTML = `<div class="skeleton"></div>`;
    try {
      const results = await runSearch(q, searchType ? searchType.value : "all");
      searchHost.innerHTML = `<div class="section-head"><h2>Recherche</h2><span class="badge info">${results.length} resultats</span></div>${results.length ? `<div class="grid">${results.map(Madrador.card).join("")}</div>` : `<div class="empty">Aucun resultat pour cette recherche.</div>`}`;
    } catch (error) {
      searchHost.innerHTML = `<div class="empty">Recherche indisponible pour le moment. Recharge la page et reessaie.</div>`;
    }
    if (suggestions) suggestions.classList.add("hidden");
  }

  async function updateSuggestions() {
    if (!searchInput || !suggestions) return;
    const q = searchInput.value.trim();
    clearTimeout(suggestionTimer);
    if (q.length < 2) {
      suggestions.classList.add("hidden");
      suggestions.innerHTML = "";
      return;
    }
    suggestionTimer = setTimeout(async () => {
      const results = await runSearch(q, searchType ? searchType.value : "all");
      const items = results.slice(0, 6);
      suggestions.classList.toggle("hidden", !items.length);
      suggestions.innerHTML = items.map((item) => `<a class="badge info" style="margin:4px" href="${Madrador.detailsUrl(item)}">${Madrador.esc(item.title)} ${item.year ? "(" + Madrador.esc(item.year) + ")" : ""}</a>`).join("");
    }, 240);
  }

  function renderLocalRows() {
    if (!localRows) return;
    const favs = Madrador.readStore("madrador:favorites");
    const history = Madrador.readStore("madrador:history");
    localRows.innerHTML = [
      favs.length ? `<section class="section"><div class="section-head"><h2>Favoris</h2><button class="btn ghost" id="clearFavs">Vider</button></div><div class="rail">${favs.map(Madrador.card).join("")}</div></section>` : "",
      history.length ? `<section class="section"><div class="section-head"><h2>Reprendre / historique</h2><button class="btn ghost" id="clearHistory">Vider</button></div><div class="rail">${history.map(Madrador.card).join("")}</div></section>` : ""
    ].join("");
    const clearFavs = document.getElementById("clearFavs");
    const clearHistory = document.getElementById("clearHistory");
    if (clearFavs) clearFavs.onclick = () => { Madrador.writeStore("madrador:favorites", []); renderLocalRows(); };
    if (clearHistory) clearHistory.onclick = () => { Madrador.writeStore("madrador:history", []); renderLocalRows(); };
  }

  async function loadPersonCredits(personId, name) {
    if (!searchHost || !personId) return;
    searchHost.classList.remove("hidden");
    searchHost.innerHTML = `<div class="skeleton"></div>`;
    const data = await Madrador.getJson(`/person.json?id=${encodeURIComponent(personId)}`, { results: [] });
    const results = data.results || [];
    searchHost.innerHTML = `<div class="section-head"><h2>${Madrador.esc(name || "Filmographie")}</h2><span class="badge info">${results.length} titre(s)</span></div>${results.length ? `<div class="grid">${results.map(Madrador.card).join("")}</div>` : `<div class="empty">Aucun film relie pour cet acteur.</div>`}`;
    if (rowsHost) rowsHost.classList.add("hidden");
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.className = item === button ? "btn secondary" : "btn ghost");
      applyFilter();
    });
  });

  if (searchButton) searchButton.addEventListener("click", (event) => { event.preventDefault(); doSearch(); });
  if (searchInput) searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); doSearch(); } });
  if (searchInput) searchInput.addEventListener("input", updateSuggestions);
  if (searchType) searchType.addEventListener("change", updateSuggestions);
  if (refreshButton) refreshButton.addEventListener("click", () => loadCatalog(true));
  if (genreStrip) genreStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-genre-chip]");
    if (!button) return;
    genreStrip.querySelectorAll("[data-genre-chip]").forEach((item) => item.classList.toggle("active", item === button));
    if (genreFilter) genreFilter.value = button.dataset.genreChip || "";
    rerenderCatalog();
  });
  if (rowsHost) rowsHost.addEventListener("click", (event) => {
    const button = event.target.closest(".load-more-row");
    if (!button) return;
    const rowId = button.dataset.rowId;
    visibleCounts[rowId] = (visibleCounts[rowId] || PAGE_SIZE) + PAGE_SIZE;
    rerenderCatalog();
  });
  if (yearFilter) yearFilter.addEventListener("change", rerenderCatalog);
  if (genreFilter) genreFilter.addEventListener("change", rerenderCatalog);
  if (sortFilter) sortFilter.addEventListener("change", rerenderCatalog);
  const params = new URLSearchParams(location.search);
  if (params.get("person")) {
    loadPersonCredits(params.get("person"), params.get("name"));
  } else if (searchInput && params.get("q")) {
    searchInput.value = params.get("q");
    if (searchType && params.get("type")) searchType.value = params.get("type");
    if (!document.querySelector('script[src*="search-ui.js"]')) doSearch();
  }
  for (let year = new Date().getFullYear(); year >= 1980; year -= 1) {
    if (yearFilter) yearFilter.insertAdjacentHTML("beforeend", `<option>${year}</option>`);
  }
  renderLocalRows();
  loadCatalog(false);
})();
