(async function () {
  const root = document.getElementById("detailsRoot");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = params.get("type") || "movie";
  if (!id) {
    root.innerHTML = `<div class="empty">Aucun identifiant fourni. <a href="/catalog">Retour catalogue</a></div>`;
    return;
  }
  const details = await Madrador.getJson(`/details.json?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, null);
  if (!details || details.error) {
    root.innerHTML = `<div class="empty">Impossible de charger le detail.</div>`;
    return;
  }
  const item = { id: details.id, type: details.type || type, title: details.title };
  const favKey = `madrador:fav:${item.type}:${item.id}`;
  const fav = localStorage.getItem(favKey) === "1";
  root.innerHTML = `<section class="panel" style="display:grid;grid-template-columns:minmax(190px,280px) 1fr;gap:22px;align-items:start"><img src="${Madrador.esc(details.poster || Madrador.placeholder)}" alt="" style="width:100%;border-radius:16px;border:1px solid var(--line)"><div><a class="badge info" href="/catalog">Retour catalogue</a><h1 class="page-title" style="margin-top:14px">${Madrador.esc(details.title)}</h1><div class="chips" style="margin:14px 0"><span class="badge">${Madrador.esc(details.year || "Annee inconnue")}</span><span class="badge ok">Note ${Number(details.rating || 0).toFixed(1)}</span>${(details.genres || []).map((g) => `<span class="badge">${Madrador.esc(g)}</span>`).join("")}</div><p style="line-height:1.8;color:var(--muted)">${Madrador.esc(details.overview || "Description indisponible.")}</p><div class="actions"><a class="btn" href="${Madrador.playerUrl(item)}">Regarder</a><button class="btn secondary" id="favBtn">${fav ? "Retirer favori" : "Ajouter favori"}</button></div><div id="quickSources" class="notice" style="margin-top:18px">Sources chargees depuis la page lecteur.</div></div></section>`;
  document.getElementById("favBtn").addEventListener("click", () => {
    const next = localStorage.getItem(favKey) !== "1";
    localStorage.setItem(favKey, next ? "1" : "0");
    document.getElementById("favBtn").textContent = next ? "Retirer favori" : "Ajouter favori";
  });
})();
