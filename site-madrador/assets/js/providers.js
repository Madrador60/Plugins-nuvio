(async function () {
  const grid = document.getElementById("providersGrid");
  const count = document.getElementById("providerCount");
  const filter = document.getElementById("providerFilter");
  let providers = [];
  let statuses = {};

  function statusClass(status) {
    if (status === "OK") return "ok";
    if (status === "LENT" || status === "ZERO_RESULT" || status === "INSTABLE") return "warn";
    if (status === "DISABLED" || status === "Desactive") return "info";
    return "bad";
  }

  function render() {
    const q = (filter && filter.value || "").toLowerCase();
    const visible = providers.filter((provider) => [provider.id, provider.name, provider.state].join(" ").toLowerCase().includes(q));
    count.textContent = `${visible.length} provider(s)`;
    grid.innerHTML = visible.map((provider) => {
      const status = statuses[provider.id] || {};
      const label = status.status || provider.state || "unknown";
      return `<article class="panel"><div class="section-head" style="margin-bottom:10px"><div><h2 style="font-size:20px;margin:0">${Madrador.esc(provider.name || provider.id)}</h2><p style="margin:4px 0 0">${Madrador.esc(provider.id)}</p></div><span class="badge ${statusClass(label)}">${Madrador.esc(label)}</span></div><div class="chips"><span class="badge">score ${Madrador.esc(status.score || "?")}</span><span class="badge">${Madrador.esc(status.responseTime || 0)}ms</span>${(provider.formats || []).map((f) => `<span class="badge info">${Madrador.esc(f)}</span>`).join("")}${(provider.languages || []).map((l) => `<span class="badge">${Madrador.esc(l)}</span>`).join("")}</div><p class="muted">Dernier test: ${Madrador.esc(status.lastTested || "jamais")}</p><button class="btn secondary" data-provider-test="${Madrador.esc(provider.id)}">Tester</button><div class="muted" id="result-${Madrador.esc(provider.id)}"></div></article>`;
    }).join("") || `<div class="empty">Aucun provider.</div>`;
    grid.querySelectorAll("[data-provider-test]").forEach((button) => button.addEventListener("click", () => testProvider(button.dataset.providerTest)));
  }

  async function load() {
    const data = await Madrador.getJson("/providers.json", { all: [] });
    const statusData = await Madrador.getJson("/providers/status.json", { statuses: {} });
    providers = data.all || [];
    statuses = statusData.statuses || {};
    render();
  }

  async function testProvider(id) {
    const resultBox = document.getElementById(`result-${id}`);
    if (resultBox) resultBox.textContent = "Test en cours...";
    const data = await Madrador.getJson(`/diagnostics.json?providers=${encodeURIComponent(id)}`, { results: [] });
    const item = data.results && data.results[0];
    if (resultBox) resultBox.textContent = item ? `${item.status} - ${item.streams} source(s) - ${item.timeMs}ms` : "Erreur test.";
    await load();
  }

  document.getElementById("testAllProviders").addEventListener("click", async () => {
    for (const provider of providers.filter((item) => item.state !== "Desactive")) await testProvider(provider.id);
  });
  if (filter) filter.addEventListener("input", render);
  load();
})();
