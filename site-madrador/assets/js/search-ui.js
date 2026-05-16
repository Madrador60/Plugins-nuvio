(function () {
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
    const meta = (item.kind || item.type) === "person"
      ? (Array.isArray(item.knownFor) && item.knownFor.length ? item.knownFor.join(", ") : "Acteur")
      : [item.year, typeForUrl(item.type) === "series" ? "Serie" : "Film"].filter(Boolean).join(" · ");
    return `<a class="poster-card" href="${detailsUrl(item)}"><img src="${esc(poster)}" alt=""><span class="body"><strong>${esc(title)}</strong><small>${esc(meta || "Madrador Film")}</small><span class="badge info" style="margin-top:10px">${(item.kind || item.type) === "person" ? "Voir acteur" : "Voir les flux"}</span></span></a>`;
  }

  async function fetchResults(query, type) {
    const response = await fetch(`/search.json?type=${encodeURIComponent(type || "all")}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    return data.results || [];
  }

  async function renderCatalogSearch(query, type) {
    const host = document.getElementById("searchResults");
    const input = document.getElementById("catalogSearch");
    if (input && input.value.trim() !== query) input.value = query;
    if (!host) {
      location.assign(`/catalog?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type || "all")}`);
      return;
    }
    host.classList.remove("hidden");
    host.innerHTML = `<div class="skeleton"></div>`;
    try {
      const results = await fetchResults(query, type || "all");
      host.innerHTML = `<div class="section-head"><h2>Recherche</h2><span class="badge info">${results.length} resultats</span></div>${results.length ? `<div class="grid">${results.map(card).join("")}</div>` : `<div class="empty">Aucun resultat pour "${esc(query)}". Essaie un autre titre.</div>`}`;
    } catch (error) {
      host.innerHTML = `<div class="empty">La recherche n'a pas repondu. Recharge la page ou reessaie dans quelques secondes.</div>`;
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

  const params = new URLSearchParams(location.search);
  if (document.getElementById("searchResults") && params.get("q")) {
    renderCatalogSearch(params.get("q"), params.get("type") || "all");
  }

  window.MadradorSearchUI = { renderCatalogSearch };
})();
