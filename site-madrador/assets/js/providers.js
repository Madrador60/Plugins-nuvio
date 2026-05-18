(async function () {
  const grid = document.getElementById("providersGrid");
  const count = document.getElementById("providerCount");
  const filter = document.getElementById("providerFilter");
  const stateFilter = document.getElementById("providerStateFilter");
  const statsHost = document.getElementById("providersStats");
  const domainsButton = document.getElementById("testDomains");
  const domainsNotice = document.getElementById("domainsNotice");
  let providers = [];
  let statuses = {};
  let domainStatuses = {};

  function statusClass(status) {
    if (status === "OK") return "ok";
    if (status === "LENT" || status === "ZERO_RESULT" || status === "INSTABLE") return "warn";
    if (status === "DISABLED" || status === "Desactive") return "info";
    return "bad";
  }

  function stateBucket(provider, label) {
    if (provider.enabled === false || provider.state === "Desactive") return "disabled";
    if (label === "OK") return "ok";
    if (["LENT", "ZERO_RESULT", "INSTABLE"].includes(label)) return "slow";
    if (["TIMEOUT", "ERROR"].includes(label)) return "error";
    return "active";
  }

  function updateStats() {
    if (!statsHost) return;
    const rows = providers.map((provider) => {
      const status = provider.status || statuses[provider.id] || {};
      const label = status.status || provider.state || "unknown";
      return { provider, label, bucket: stateBucket(provider, label) };
    });
    const total = rows.length;
    const active = rows.filter((row) => row.provider.enabled !== false).length;
    const ok = rows.filter((row) => row.label === "OK").length;
    const unstable = rows.filter((row) => ["slow", "error"].includes(row.bucket)).length;
    statsHost.innerHTML = [
      ["Total", total],
      ["Actifs", active],
      ["OK", ok],
      ["A surveiller", unstable]
    ].map(([label, value]) => `<div><strong>${Madrador.esc(value)}</strong><span>${Madrador.esc(label)}</span></div>`).join("");
  }

  function render() {
    const q = (filter && filter.value || "").toLowerCase();
    const selectedState = stateFilter ? stateFilter.value : "all";
    const visible = providers.filter((provider) => {
      const status = provider.status || statuses[provider.id] || {};
      const domainStatus = provider.domainStatus || domainStatuses[provider.id] || {};
      const label = status.status || provider.state || "unknown";
      const bucket = stateBucket(provider, label);
      const matchesText = [provider.id, provider.name, provider.state, provider.activeDomain, domainStatus.activeDomain, (provider.domains || []).join(" "), (provider.formats || []).join(" "), (provider.languages || []).join(" ")].join(" ").toLowerCase().includes(q);
      const matchesState = selectedState === "all" || bucket === selectedState || (selectedState === "active" && provider.enabled !== false);
      return matchesText && matchesState;
    });
    count.textContent = `${visible.length} provider(s)`;
    updateStats();
    grid.innerHTML = visible.map((provider) => {
      const status = provider.status || statuses[provider.id] || {};
      const domainStatus = provider.domainStatus || domainStatuses[provider.id] || {};
      const label = status.status || provider.state || "unknown";
      const cls = statusClass(label);
      const score = status.score === undefined ? "?" : status.score;
      const domains = provider.domains && provider.domains.length ? provider.domains : [provider.activeDomain || "Domaine interne ou non configure"];
      const activeDomain = domainStatus.activeDomain || provider.activeDomain || domains[0] || "";
      const domainBadge = domainStatus.status
        ? `<span class="badge ${domainStatus.status === "working" ? "ok" : "bad"}">Domaine ${Madrador.esc(domainStatus.status)}</span>`
        : `<span class="badge info">Domaine non teste</span>`;
      const dnsBadge = domainStatus.domains
        ? `<span class="badge ${Number(domainStatus.dnsWorking || 0) ? "ok" : "warn"}">DNS ${Madrador.esc(domainStatus.dnsWorking || 0)}/${Madrador.esc(domainStatus.domains.length)}</span>`
        : "";
      const httpBadge = domainStatus.domains
        ? `<span class="badge ${Number(domainStatus.httpWorking || 0) ? "ok" : "warn"}">HTTP ${Madrador.esc(domainStatus.httpWorking || 0)}/${Madrador.esc(domainStatus.domains.length)}</span>`
        : "";
      return `<article class="provider-card ${cls}">
        <div class="provider-card-head">
          <div><span class="provider-kind">${Madrador.esc(provider.type || "movie")}</span><h2>${Madrador.esc(provider.name || provider.id)}</h2><p>${Madrador.esc(provider.id)}</p></div>
          <span class="badge ${cls}">${Madrador.esc(label)}</span>
        </div>
        <div class="provider-score">
          <div><strong>${Madrador.esc(score)}</strong><span>Score</span></div>
          <div><strong>${Madrador.esc(status.responseTime || 0)}ms</strong><span>Reponse</span></div>
          <div><strong>${Madrador.esc(status.successCount || 0)}</strong><span>Succes</span></div>
        </div>
        <div class="chips provider-chips">${(provider.formats || []).map((f) => `<span class="badge info">${Madrador.esc(f)}</span>`).join("")}${(provider.languages || []).map((l) => `<span class="badge">${Madrador.esc(l).toUpperCase()}</span>`).join("")}</div>
        <div class="chips provider-chips">${domainBadge}${dnsBadge}${httpBadge}</div>
        <div class="provider-active-domain">${activeDomain ? `Actif: ${Madrador.esc(activeDomain)}` : "Aucun domaine actif detecte"}</div>
        <div class="provider-domains">${domains.slice(0, 4).map((domain) => `<span>${Madrador.esc(domain)}</span>`).join("")}</div>
        <p class="muted provider-meta">Dernier test: ${Madrador.esc(status.lastTested ? new Date(status.lastTested).toLocaleString("fr-FR") : "jamais")} · erreurs ${Madrador.esc(status.failCount || 0)}</p>
        <button class="btn secondary" data-provider-test="${Madrador.esc(provider.id)}" ${provider.enabled === false ? "disabled" : ""}>Tester ce provider</button>
        <div class="muted provider-result" id="result-${Madrador.esc(provider.id)}"></div>
      </article>`;
    }).join("") || `<div class="empty">Aucun provider.</div>`;
    grid.querySelectorAll("[data-provider-test]").forEach((button) => button.addEventListener("click", () => testProvider(button.dataset.providerTest)));
  }

  async function load() {
    const data = await Madrador.getJson("/providers.json", { all: [] });
    const statusData = await Madrador.getJson("/providers/status.json", { statuses: {} });
    const domainData = await Madrador.getJson("/domains/status.json", { statuses: {} });
    providers = data.all || [];
    statuses = statusData.statuses || {};
    domainStatuses = domainData.statuses || {};
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
    for (const provider of providers.filter((item) => item.enabled !== false && item.state !== "Desactive")) await testProvider(provider.id);
  });
  if (domainsButton) domainsButton.addEventListener("click", async () => {
    domainsButton.disabled = true;
    domainsButton.textContent = "Test DNS...";
    if (domainsNotice) domainsNotice.textContent = "Verification des domaines en cours avec DNS Cloudflare et test HTTP. Ca peut prendre quelques secondes.";
    const data = await Madrador.getJson("/domains/check.json", { success: false }, { method: "POST" });
    if (data && data.results) domainStatuses = data.results;
    if (domainsNotice) {
      const rows = Object.values(domainStatuses || {});
      const working = rows.filter((row) => row.status === "working").length;
      domainsNotice.textContent = `${working}/${rows.length} providers ont un domaine actif. Les domaines OK sont remis en premier dans domains.json.`;
    }
    domainsButton.disabled = false;
    domainsButton.textContent = "Tester domaines";
    await load();
  });
  if (filter) filter.addEventListener("input", render);
  if (stateFilter) stateFilter.addEventListener("change", render);
  load();
})();
