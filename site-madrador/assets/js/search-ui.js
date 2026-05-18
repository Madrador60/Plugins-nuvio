(function () {
  const quickSearches = [
    { label: "Interstellar", q: "interstellar", type: "all" },
    { label: "Naruto VF", q: "naruto vf", type: "all" },
    { label: "One Piece", q: "one piece", type: "all" },
    { label: "Horreur 2024", q: "film horreur 2024", type: "movie" },
    { label: "Action 2024", q: "action 2024", type: "movie" },
    { label: "Black Panther", q: "black panther", type: "movie" },
    { label: "Keanu Reeves", q: "keanu reeves", type: "person" }
  ];
  let lastQuery = "";
  let lastType = "all";
  let lastResults = [];
  let lastSort = "relevance";

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

  function card(item) {
    const poster = item.poster || "/site-madrador/assets/img/placeholder-poster.svg";
    const title = item.title || "Sans titre";
    const isPerson = (item.kind || item.type) === "person";
    const meta = isPerson
      ? (Array.isArray(item.knownFor) && item.knownFor.length ? item.knownFor.join(", ") : "Acteur")
      : [item.year, typeForUrl(item.type) === "series" ? "Serie" : "Film"].filter(Boolean).join(" · ");
    const badge = isPerson ? "Acteur" : typeForUrl(item.type) === "series" ? "Serie" : "Film";
    return `<a class="poster-card search-card" href="${detailsUrl(item)}"><span class="poster-wrap"><img src="${esc(poster)}" alt=""></span><span class="body"><span class="badge info">${esc(badge)}</span><strong>${esc(title)}</strong><small>${esc(meta || "Madrador Film")}</small><span class="search-card-cta">${isPerson ? "Voir sa filmographie" : "Ouvrir la fiche et charger les flux"}</span></span></a>`;
  }

  async function fetchResults(query, type) {
    const response = await fetch(`/search.json?type=${encodeURIComponent(type || "all")}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    return data.results || [];
  }

  function normalizedType(type) {
    return type || "all";
  }

  function sortedResults(results) {
    const list = results.slice();
    if (lastSort === "recent") return list.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    if (lastSort === "az") return list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "fr"));
    if (lastSort === "people") return list.sort((a, b) => Number((b.kind || b.type) === "person") - Number((a.kind || a.type) === "person"));
    return list;
  }

  function countByType(results, type) {
    if (type === "all") return results.length;
    if (type === "person") return results.filter((item) => (item.kind || item.type) === "person").length;
    if (type === "series") return results.filter((item) => typeForUrl(item.type) === "series").length;
    return results.filter((item) => typeForUrl(item.type) === "movie").length;
  }

  function searchUrl(query, type) {
    return `/catalog?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type || "all")}`;
  }

  function renderQuickSearches() {
    const quickHost = document.getElementById("searchQuick");
    if (!quickHost) return;
    quickHost.innerHTML = quickSearches.map((item) => `<button class="quick-chip" type="button" data-q="${esc(item.q)}" data-type="${esc(item.type)}">${esc(item.label)}</button>`).join("");
    quickHost.querySelectorAll("[data-q]").forEach((button) => {
      button.addEventListener("click", () => renderCatalogSearch(button.dataset.q || "", button.dataset.type || "all"));
    });
  }

  function renderResults() {
    const host = document.getElementById("searchResults");
    if (!host) return;
    const results = sortedResults(lastResults);
    const type = normalizedType(lastType);
    const title = lastQuery ? `Resultats pour "${esc(lastQuery)}"` : "Recherche";
    const typeLabel = type === "all" ? "Tout" : type === "movie" ? "Films" : type === "series" ? "Series" : "Acteurs";
    const typeTabs = [
      ["all", "Tout"],
      ["movie", "Films"],
      ["series", "Series"],
      ["person", "Acteurs"]
    ].map(([value, label]) => `<button class="result-tab ${type === value ? "active" : ""}" type="button" data-search-type="${value}">${label}<span>${countByType(lastResults, value)}</span></button>`).join("");
    const sortTabs = [
      ["relevance", "Pertinence"],
      ["recent", "Recent"],
      ["az", "A-Z"],
      ["people", "Acteurs d'abord"]
    ].map(([value, label]) => `<button class="sort-pill ${lastSort === value ? "active" : ""}" type="button" data-search-sort="${value}">${label}</button>`).join("");

    host.classList.remove("hidden");
    host.innerHTML = `<div class="search-results-shell">
      <div class="search-results-head">
        <div>
          <span class="eyebrow">Recherche Madrador</span>
          <h2>${title}</h2>
          <p>${results.length ? "Clique sur une affiche pour ouvrir la fiche, charger les details TMDB et lancer la recherche de sources." : "Aucun titre trouve pour cette recherche. Essaie un titre plus court, une annee ou un acteur."}</p>
        </div>
        <div class="result-stat"><strong>${results.length}</strong><span>${typeLabel}</span></div>
      </div>
      <div class="result-tabs">${typeTabs}</div>
      <div class="result-tools">
        <span>Tri</span>
        ${sortTabs}
      </div>
      ${results.length ? `<div class="grid search-results-grid">${results.map(card).join("")}</div>` : `<div class="search-empty"><strong>Aucun resultat</strong><span>Essaie Interstellar, Naruto, One Piece, le nom d'un acteur ou une annee comme 2024.</span></div>`}
    </div>`;

    host.querySelectorAll("[data-search-type]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById("catalogSearch");
        const select = document.getElementById("catalogType");
        if (select) select.value = button.dataset.searchType || "all";
        if (input && lastQuery) input.value = lastQuery;
        renderCatalogSearch(lastQuery, button.dataset.searchType || "all");
      });
    });
    host.querySelectorAll("[data-search-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        lastSort = button.dataset.searchSort || "relevance";
        renderResults();
      });
    });
  }

  async function renderCatalogSearch(query, type) {
    const host = document.getElementById("searchResults");
    const input = document.getElementById("catalogSearch");
    const select = document.getElementById("catalogType");
    query = String(query || "").trim();
    type = normalizedType(type);
    if (input && input.value.trim() !== query) input.value = query;
    if (select && select.value !== type) select.value = type;
    if (!host) {
      location.assign(searchUrl(query, type));
      return;
    }
    if (!query) {
      host.classList.add("hidden");
      lastResults = [];
      lastQuery = "";
      return;
    }
    lastQuery = query;
    lastType = type;
    history.replaceState(null, "", searchUrl(query, type));
    host.classList.remove("hidden");
    host.innerHTML = `<div class="search-results-shell"><div class="skeleton"></div></div>`;
    try {
      lastResults = await fetchResults(query, type);
      lastSort = "relevance";
      renderResults();
    } catch (error) {
      host.innerHTML = `<div class="search-empty"><strong>Recherche indisponible</strong><span>Le serveur n'a pas repondu. Recharge la page ou reessaie dans quelques secondes.</span></div>`;
    }
  }

  function bindSearch(inputId, typeId, buttonId) {
    const input = document.getElementById(inputId);
    const type = document.getElementById(typeId);
    const button = document.getElementById(buttonId);
    if (!input || !button) return;
    const run = (event) => {
      if (event) event.preventDefault();
      const query = input.value.trim();
      const mediaType = type ? type.value : "all";
      if (!query) {
        location.assign("/catalog");
        return;
      }
      if (document.getElementById("searchResults")) {
        renderCatalogSearch(query, mediaType);
      } else {
        location.assign(`/catalog?q=${encodeURIComponent(query)}&type=${encodeURIComponent(mediaType)}`);
      }
    };
    button.addEventListener("click", run);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") run(event);
    });
  }

  bindSearch("homeSearch", "homeType", "homeGo");
  bindSearch("catalogSearch", "catalogType", "catalogGo");
  renderQuickSearches();

  const params = new URLSearchParams(location.search);
  if (document.getElementById("searchResults") && params.get("q")) {
    renderCatalogSearch(params.get("q"), params.get("type") || "all");
  }

  window.MadradorSearchUI = { renderCatalogSearch, renderQuickSearches };
})();
