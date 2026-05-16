(async function () {
  const metrics = document.getElementById("adminMetrics");
  const output = document.getElementById("adminOutput");
  const token = document.getElementById("adminToken");

  function metric(label, value) {
    return `<div class="metric"><span class="muted">${Madrador.esc(label)}</span><strong>${Madrador.esc(value)}</strong></div>`;
  }

  async function load() {
    const health = await Madrador.getJson("/health", {});
    const providers = await Madrador.getJson("/providers.json", { all: [] });
    const statuses = await Madrador.getJson("/providers/status.json", { statuses: {} });
    const values = Object.values(statuses.statuses || {});
    metrics.innerHTML = [
      metric("Serveur", health.ok ? "OK" : "Erreur"),
      metric("Version", health.version || "?"),
      metric("Commit", health.deploy && health.deploy.commit || "local"),
      metric("Node", health.deploy && health.deploy.node || "?"),
      metric("TMDB", health.deploy && health.deploy.hasTmdb ? "Configure" : "Manquant"),
      metric("Cache", health.cacheEntries || 0),
      metric("Uptime", `${Math.round(health.uptime || 0)}s`),
      metric("Providers", providers.all.length),
      metric("OK", values.filter((item) => item.status === "OK").length),
      metric("Timeout/Erreur", values.filter((item) => ["TIMEOUT", "ERROR"].includes(item.status)).length)
    ].join("");
  }

  document.querySelectorAll("[data-admin-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      output.textContent = "Action en cours...";
      const response = await fetch(button.dataset.adminAction, { method: "POST", headers: { "x-admin-token": token.value } });
      const data = await response.json().catch(() => ({ error: "Reponse invalide" }));
      output.textContent = JSON.stringify(data, null, 2);
      load();
    });
  });
  load();
})();
