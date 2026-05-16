(async function () {
  const root = document.getElementById("detailsRoot");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = params.get("type") || "movie";
  let hls = null;

  function streamKind(stream) {
    const url = stream.url || "";
    if (/m3u8/i.test(url) || stream.format === "HLS") return "HLS";
    if (/\.mp4/i.test(url) || stream.format === "MP4") return "MP4";
    if (/\.mkv/i.test(url)) return "MKV";
    return stream.format || "Direct";
  }

  async function playSource(stream, index) {
    const video = document.getElementById("detailVideo");
    const state = document.getElementById("sourceState");
    if (!video || !stream) return;
    document.querySelectorAll(".source-card").forEach((card) => card.classList.remove("active"));
    const active = document.querySelector(`[data-detail-source="${index}"]`);
    if (active) active.classList.add("active");
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute("src");
    video.load();
    const kind = streamKind(stream);
    state.className = "notice";
    state.textContent = `Lecture: ${stream.name || stream.providerId || "Source"} - ${kind}`;
    if (kind === "HLS" && window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function (_, data) {
        if (data.fatal) state.textContent = "Source HLS indisponible ou interrompue.";
      });
    } else {
      video.src = stream.url;
    }
    await video.play().catch(() => {
      state.textContent = "La source est prete. Appuie sur Play si le navigateur bloque la lecture automatique.";
    });
  }

  async function loadSources(item) {
    const state = document.getElementById("sourceState");
    const list = document.getElementById("detailsSources");
    if (!state || !list) return;
    state.className = "notice";
    state.textContent = "Recherche automatique des flux video...";
    list.innerHTML = "";
    const data = await Madrador.getJson(`/stream/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}.json`, { streams: [] });
    const streams = data.streams || [];
    if (!streams.length) {
      state.className = "empty";
      state.textContent = "Aucune source trouvee pour ce titre. Essaie un autre film ou relance plus tard si un provider est lent.";
      return;
    }
    state.className = "notice";
    state.textContent = `${streams.length} source(s) trouvee(s). Clique une source ou utilise le lecteur ci-dessous.`;
    list.innerHTML = streams.map((stream, index) => `<button class="source-card" data-detail-source="${index}"><strong>${Madrador.esc(stream.name || stream.providerId || "Source")}</strong><small>${Madrador.esc(stream.title || stream.description || "Source externe")}</small><div class="chips" style="margin-top:10px"><span class="badge info">${Madrador.esc(streamKind(stream))}</span><span class="badge">${Madrador.esc(stream.language || "FR")}</span><span class="badge">${Madrador.esc(stream.quality || "HD")}</span></div></button>`).join("");
    list.querySelectorAll("[data-detail-source]").forEach((button) => {
      button.addEventListener("click", () => playSource(streams[Number(button.dataset.detailSource)], button.dataset.detailSource));
    });
    playSource(streams[0], 0);
  }

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
  root.innerHTML = `<section class="panel" style="display:grid;grid-template-columns:minmax(190px,280px) 1fr;gap:22px;align-items:start"><img src="${Madrador.esc(details.poster || Madrador.placeholder)}" alt="" style="width:100%;border-radius:16px;border:1px solid var(--line)"><div><a class="badge info" href="/catalog">Retour catalogue</a><h1 class="page-title" style="margin-top:14px">${Madrador.esc(details.title)}</h1><div class="chips" style="margin:14px 0"><span class="badge">${Madrador.esc(details.year || "Annee inconnue")}</span><span class="badge ok">Note ${Number(details.rating || 0).toFixed(1)}</span>${(details.genres || []).map((g) => `<span class="badge">${Madrador.esc(g)}</span>`).join("")}</div><p style="line-height:1.8;color:var(--muted)">${Madrador.esc(details.overview || "Description indisponible.")}</p><div class="actions"><a class="btn" href="${Madrador.playerUrl(item)}">Ouvrir lecteur plein</a><button class="btn secondary" id="favBtn">${fav ? "Retirer favori" : "Ajouter favori"}</button></div></div></section><section class="section"><div class="section-head"><div><h2>Lecture et sources</h2><p>Les flux se chargent automatiquement depuis les providers actifs.</p></div><button class="btn ghost" id="reloadDetailsSources">Relancer les flux</button></div><div class="player-layout"><div class="video-shell"><video id="detailVideo" controls playsinline></video></div><aside class="panel"><div id="sourceState" class="notice">Preparation...</div><div class="source-list" id="detailsSources" style="margin-top:12px"></div></aside></div></section>`;
  document.getElementById("favBtn").addEventListener("click", () => {
    const next = localStorage.getItem(favKey) !== "1";
    localStorage.setItem(favKey, next ? "1" : "0");
    document.getElementById("favBtn").textContent = next ? "Retirer favori" : "Ajouter favori";
  });
  document.getElementById("reloadDetailsSources").addEventListener("click", () => loadSources(item));
  loadSources(item);
})();
