(function () {
  async function runSearch(query, type) {
    const data = await Madrador.getJson(`/search.json?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}`, { results: [] });
    return data.results || [];
  }

  window.MadradorSearch = { runSearch };
})();
