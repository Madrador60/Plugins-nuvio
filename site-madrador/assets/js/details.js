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
    localStorage.setItem(`madrador:lastSource:${type}:${id}`, String(index));
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
    const streamId = item.type === "series" && item.season && item.episode
      ? `${item.id}:${item.season}:${item.episode}`
      : item.id;
    const data = await Madrador.getJson(`/stream/${encodeURIComponent(item.type)}/${encodeURIComponent(streamId)}.json`, { streams: [] });
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
    const preferred = Number(localStorage.getItem(`madrador:lastSource:${item.type}:${item.id}`) || 0);
    playSource(streams[preferred] || streams[0], streams[preferred] ? preferred : 0);
  }

  function seasonControls(details, item) {
    const seasons = details.seasons || [];
    if (item.type !== "series" || !seasons.length) return "";
    const first = seasons[0];
    return `<div class="panel" style="margin:18px 0"><h2 style="margin-top:0">Saisons et episodes</h2><div class="toolbar"><label class="badge">Saison <select class="select" id="seasonSelect" style="width:auto">${seasons.map((season) => `<option value="${season.seasonNumber}" data-episodes="${season.episodeCount}">${Madrador.esc(season.name || ("Saison " + season.seasonNumber))}</option>`).join("")}</select></label><label class="badge">Episode <select class="select" id="episodeSelect" style="width:auto">${Array.from({ length: first.episodeCount }, (_, i) => `<option value="${i + 1}">Episode ${i + 1}</option>`).join("")}</select></label><button class="btn secondary" id="loadEpisode">Charger cet episode</button></div></div>`;
  }

  function castSection(details) {
    const cast = details.cast || [];
    if (!cast.length) return "";
    return `<section class="section"><div class="section-head"><h2>Acteurs</h2><p>Ouvre tous les films et series lies a un acteur.</p></div><div class="grid">${cast.map((person) => `<a class="poster-card" href="/catalog?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}"><img src="${Madrador.esc(person.profile || Madrador.placeholder)}" alt=""><span class="body"><strong>${Madrador.esc(person.name)}</strong><small>${Madrador.esc(person.character || "Filmographie")}</small><span class="badge info" style="margin-top:10px">Voir ses films</span></span></a>`).join("")}</div></section>`;
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
  Madrador.saveRecent(Object.assign({}, item, { poster: details.poster, year: details.year }));
  const fav = Madrador.isFavorite(item);
  root.innerHTML = `<section class="panel" style="display:grid;grid-template-columns:minmax(190px,280px) 1fr;gap:22px;align-items:start"><img src="${Madrador.esc(details.poster || Madrador.placeholder)}" alt="" style="width:100%;border-radius:16px;border:1px solid var(--line)"><div><a class="badge info" href="/catalog">Retour catalogue</a><h1 class="page-title" style="margin-top:14px">${Madrador.esc(details.title)}</h1><div class="chips" style="margin:14px 0"><span class="badge">${Madrador.esc(details.year || "Annee inconnue")}</span><span class="badge ok">Note ${Number(details.rating || 0).toFixed(1)}</span>${(details.genres || []).map((g) => `<span class="badge">${Madrador.esc(g)}</span>`).join("")}</div><p style="line-height:1.8;color:var(--muted)">${Madrador.esc(details.overview || "Description indisponible.")}</p><div class="actions"><a class="btn" href="${Madrador.playerUrl(item)}">Ouvrir lecteur plein</a><button class="btn secondary" id="favBtn">${fav ? "Retirer favori" : "Ajouter favori"}</button></div>${seasonControls(details, item)}</div></section><section class="section"><div class="section-head"><div><h2>Lecture et sources</h2><p>Les flux se chargent automatiquement depuis les providers actifs.</p></div><button class="btn ghost" id="reloadDetailsSources">Relancer les flux</button></div><div class="player-layout"><div class="video-shell"><video id="detailVideo" controls playsinline></video></div><aside class="panel"><div id="sourceState" class="notice">Preparation...</div><div class="source-list" id="detailsSources" style="margin-top:12px"></div></aside></div></section>${castSection(details)}`;
  document.getElementById("favBtn").addEventListener("click", () => {
    const next = Madrador.toggleFavorite(Object.assign({}, item, { poster: details.poster, year: details.year }));
    document.getElementById("favBtn").textContent = next ? "Retirer favori" : "Ajouter favori";
  });
  const seasonSelect = document.getElementById("seasonSelect");
  const episodeSelect = document.getElementById("episodeSelect");
  const loadEpisode = document.getElementById("loadEpisode");
  function updateEpisodeOptions() {
    if (!seasonSelect || !episodeSelect) return;
    const selected = seasonSelect.options[seasonSelect.selectedIndex];
    const count = Number(selected && selected.dataset.episodes || 1);
    episodeSelect.innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i + 1}">Episode ${i + 1}</option>`).join("");
  }
  function selectedEpisodeItem() {
    const selected = Object.assign({}, item, {
      season: seasonSelect ? Number(seasonSelect.value || 1) : undefined,
      episode: episodeSelect ? Number(episodeSelect.value || 1) : undefined
    });
    if (selected.type === "series" && selected.season && selected.episode) {
      localStorage.setItem(`madrador:lastEpisode:${selected.type}:${selected.id}`, JSON.stringify({ season: selected.season, episode: selected.episode }));
    }
    return selected;
  }
  if (seasonSelect) seasonSelect.addEventListener("change", updateEpisodeOptions);
  try {
    const lastEpisode = JSON.parse(localStorage.getItem(`madrador:lastEpisode:${item.type}:${item.id}`) || "null");
    if (seasonSelect && lastEpisode && lastEpisode.season) {
      seasonSelect.value = String(lastEpisode.season);
      updateEpisodeOptions();
      if (episodeSelect && lastEpisode.episode) episodeSelect.value = String(lastEpisode.episode);
    }
  } catch {}
  if (loadEpisode) loadEpisode.addEventListener("click", () => loadSources(selectedEpisodeItem()));
  document.getElementById("reloadDetailsSources").addEventListener("click", () => loadSources(selectedEpisodeItem()));
  loadSources(selectedEpisodeItem());
})();
