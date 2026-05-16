(function () {
  const rowsHost = document.getElementById("catalogRows");
  const searchHost = document.getElementById("searchResults");
  const homeRows = document.querySelectorAll("[data-row]");
  const searchInput = document.getElementById("catalogSearch");
  const searchType = document.getElementById("catalogType");
  const searchButton = document.getElementById("catalogGo");
  const refreshButton = document.getElementById("refreshCatalog");
  let catalogRows = [];
  let activeFilter = "all";

  function renderRow(row, mode) {
    const items = row.items || [];
    const body = items.length ? `<div class="${mode === "grid" ? "grid" : "rail"}">${items.map(Madrador.card).join("")}</div>` : `<div class="empty">Aucun titre dans cette section.</div>`;
    return `<section class="section" data-group="${Madrador.esc(row.group || "movie")}" data-title="${Madrador.esc(row.title || "")}"><div class="section-head"><h2>${Madrador.esc(row.title)}</h2><span class="badge info">${items.length} titres</span></div>${body}</section>`;
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

  async function loadCatalog(force) {
    const data = await Madrador.getJson(`/catalog.json${force ? "?refresh=1" : ""}`, { rows: [] });
    catalogRows = data.rows || [];
    if (rowsHost) {
      rowsHost.innerHTML = catalogRows.map((row) => renderRow(row, "rail")).join("") || `<div class="empty">Catalogue indisponible.</div>`;
      applyFilter();
    }
    if (homeRows.length) {
      homeRows.forEach((target) => {
        const row = catalogRows.find((item) => item.id === target.dataset.row) || catalogRows.find((item) => (item.title || "").toLowerCase().includes(target.dataset.row.replace("-", " ")));
        target.innerHTML = row ? (row.items || []).slice(0, 12).map(Madrador.card).join("") : `<div class="empty">Section indisponible.</div>`;
      });
    }
  }

  async function doSearch() {
    if (!searchInput || !searchHost) return;
    const q = searchInput.value.trim();
    if (!q) return;
    searchHost.classList.remove("hidden");
    searchHost.innerHTML = `<div class="skeleton"></div>`;
    const results = await window.MadradorSearch.runSearch(q, searchType ? searchType.value : "movie");
    searchHost.innerHTML = `<div class="section-head"><h2>Recherche</h2><span class="badge info">${results.length} resultats</span></div>${results.length ? `<div class="grid">${results.map(Madrador.card).join("")}</div>` : `<div class="empty">Aucun resultat pour cette recherche.</div>`}`;
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.className = item === button ? "btn secondary" : "btn ghost");
      applyFilter();
    });
  });

  if (searchButton) searchButton.addEventListener("click", doSearch);
  if (searchInput) searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") doSearch(); });
  if (refreshButton) refreshButton.addEventListener("click", () => loadCatalog(true));
  const params = new URLSearchParams(location.search);
  if (searchInput && params.get("q")) {
    searchInput.value = params.get("q");
    if (searchType && params.get("type")) searchType.value = params.get("type");
    doSearch();
  }
  for (let year = new Date().getFullYear(); year >= 1980; year -= 1) {
    const select = document.getElementById("yearFilter");
    if (select) select.insertAdjacentHTML("beforeend", `<option>${year}</option>`);
  }
  loadCatalog(false);
})();
