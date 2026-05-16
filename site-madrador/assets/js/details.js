(async function () {
  const root = document.getElementById("detailsRoot");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = Madrador.typeForUrl(params.get("type") || "movie");
  let hls = null;
  let details = null;
  let streams = [];
  let activeStream = null;
  let activeSourceIndex = 0;
  let selectedEpisode = { season: 1, episode: 1 };
  let sourceFilter = "all";
  let langFilter = "all";

  function storeKey(name, extra) {
    return `madrador:${name}:${type}:${id}${extra ? ":" + extra : ""}`;
  }

  function streamKind(stream) {
    const url = stream.url || "";
    if (/m3u8/i.test(url) || stream.format === "HLS") return "HLS";
    if (/\.mp4/i.test(url) || stream.format === "MP4") return "MP4";
    if (/\.mkv/i.test(url) || stream.format === "MKV") return "MKV";
    return stream.format || "Direct";
  }

  function streamText(stream) {
    return [stream.name, stream.title, stream.description, stream.language, stream.quality, stream.providerId].join(" ").toLowerCase();
  }

  function sortStreams(list) {
    const langRank = { VF: 0, MULTI: 1, FR: 2, VOSTFR: 3 };
    const formatRank = { MP4: 0, HLS: 1, MKV: 2, Direct: 3 };
    return list.slice().sort((a, b) => {
      const af = formatRank[streamKind(a)] ?? 4;
      const bf = formatRank[streamKind(b)] ?? 4;
      if (af !== bf) return af - bf;
      const al = langRank[a.language] ?? 5;
      const bl = langRank[b.language] ?? 5;
      if (al !== bl) return al - bl;
      return Number(b.score || 0) - Number(a.score || 0);
    });
  }

  function filteredStreams() {
    return streams.filter((stream) => {
      const kind = streamKind(stream).toLowerCase();
      if (sourceFilter !== "all" && kind !== sourceFilter) return false;
      const text = streamText(stream);
      if (langFilter === "vf") return /\bvf\b|francais|français|french/.test(text);
      if (langFilter === "multi") return /\bmulti\b/.test(text);
      if (langFilter === "vostfr") return /vostfr|vost/.test(text);
      return true;
    });
  }

  function activeEpisodeId() {
    return type === "series" ? `${id}:${selectedEpisode.season}:${selectedEpisode.episode}` : id;
  }

  function sourceEndpoint() {
    return `/stream/${encodeURIComponent(type)}/${encodeURIComponent(activeEpisodeId())}.json`;
  }

  function markWatched(episode) {
    const key = storeKey("watchedEpisodes");
    const list = Madrador.readStore(key);
    const episodeKey = `${episode.season}:${episode.episode}`;
    if (!list.includes(episodeKey)) Madrador.writeStore(key, [episodeKey].concat(list), 300);
    document.querySelectorAll(`[data-episode-key="${episodeKey}"]`).forEach((node) => node.classList.add("watched"));
  }

  function isWatched(episode) {
    return Madrador.readStore(storeKey("watchedEpisodes")).includes(`${episode.season}:${episode.episode}`);
  }

  async function playSource(stream, index) {
    const video = document.getElementById("detailVideo");
    const state = document.getElementById("sourceState");
    if (!video || !stream) return;
    activeStream = stream;
    activeSourceIndex = Number(index || 0);
    localStorage.setItem(storeKey("lastSource", activeEpisodeId()), String(activeSourceIndex));
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
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function (_, data) {
        if (data.fatal) state.textContent = "Source HLS indisponible. Essaie Source suivante ou filtre MP4.";
      });
    } else {
      video.src = stream.url;
    }
    await video.play().catch(() => {
      state.textContent = "La source est prete. Appuie sur Play si le navigateur bloque la lecture automatique.";
    });
  }

  function renderSources() {
    const list = document.getElementById("detailsSources");
    const state = document.getElementById("sourceState");
    const visible = filteredStreams();
    if (!visible.length) {
      list.innerHTML = "";
      state.className = "empty";
      state.textContent = streams.length ? "Aucune source pour ce filtre." : "Aucune source trouvee pour ce titre ou cet episode.";
      return;
    }
    state.className = "notice";
    state.textContent = `${visible.length} source(s) affichee(s) sur ${streams.length}. MP4 puis VF/MULTI sont priorises.`;
    list.innerHTML = visible.map((stream) => {
      const originalIndex = streams.indexOf(stream);
      const recommended = originalIndex === 0 ? `<span class="badge ok">Recommandee</span>` : "";
      return `<button class="source-card" data-detail-source="${originalIndex}">
        <strong>${Madrador.esc(stream.name || stream.providerId || "Source")}</strong>
        <small>${Madrador.esc(stream.title || stream.description || "Source externe")}</small>
        <div class="chips" style="margin-top:10px">
          ${recommended}
          <span class="badge info">${Madrador.esc(streamKind(stream))}</span>
          <span class="badge">${Madrador.esc(stream.language || "FR")}</span>
          <span class="badge">${Madrador.esc(stream.quality || "HD")}</span>
          <span class="badge">score ${Madrador.esc(stream.score || "?")}</span>
        </div>
      </button>`;
    }).join("");
    list.querySelectorAll("[data-detail-source]").forEach((button) => {
      button.addEventListener("click", () => playSource(streams[Number(button.dataset.detailSource)], button.dataset.detailSource));
    });
  }

  async function loadSources() {
    const state = document.getElementById("sourceState");
    const list = document.getElementById("detailsSources");
    state.className = "notice";
    state.textContent = type === "series"
      ? `Recherche des flux pour S${selectedEpisode.season} E${selectedEpisode.episode}...`
      : "Recherche automatique des flux video...";
    list.innerHTML = `<div class="skeleton" style="min-height:120px"></div>`;
    const data = await Madrador.getJson(sourceEndpoint(), { streams: [] });
    streams = sortStreams(data.streams || []);
    renderSources();
    if (!streams.length) return;
    const preferred = Number(localStorage.getItem(storeKey("lastSource", activeEpisodeId())) || 0);
    playSource(streams[preferred] || streams[0], streams[preferred] ? preferred : 0);
  }

  async function reportSource() {
    const state = document.getElementById("sourceState");
    if (!activeStream) {
      state.textContent = "Aucune source active a signaler.";
      return;
    }
    const payload = {
      provider: activeStream.providerId || activeStream.name,
      sourceName: activeStream.name || activeStream.title,
      mediaType: type,
      mediaId: activeEpisodeId(),
      reason: "source_morte"
    };
    const response = await fetch("/report/source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.textContent = response.ok ? "Merci, la source morte est signalee dans le rapport." : "Impossible de signaler la source pour le moment.";
  }

  function seasonMarkup() {
    if (type !== "series" || !(details.seasons || []).length) return "";
    return `<section class="section panel episode-panel">
      <div class="section-head">
        <div><h2>Saisons et episodes</h2><p>Selectionne un episode, les flux se chargent automatiquement.</p></div>
        <div class="toolbar"><button class="btn ghost" id="prevEpisode">Episode precedent</button><button class="btn ghost" id="nextEpisodeBtn">Episode suivant</button></div>
      </div>
      <div class="toolbar">
        <label class="badge">Saison <select class="select" id="seasonSelect">${details.seasons.map((season) => `<option value="${season.seasonNumber}" data-episodes="${season.episodeCount}">${Madrador.esc(season.name || ("Saison " + season.seasonNumber))}</option>`).join("")}</select></label>
        <span class="badge info" id="episodeCount">Chargement</span>
      </div>
      <div id="episodeGrid" class="episode-grid"><div class="skeleton"></div></div>
    </section>`;
  }

  async function loadEpisodes(seasonNumber) {
    const grid = document.getElementById("episodeGrid");
    const count = document.getElementById("episodeCount");
    if (!grid) return;
    grid.innerHTML = `<div class="skeleton"></div>`;
    const data = await Madrador.getJson(`/episodes.json?id=${encodeURIComponent(id)}&season=${encodeURIComponent(seasonNumber)}`, { episodes: [] });
    const episodes = data.episodes || [];
    if (count) count.textContent = `${episodes.length} episode(s)`;
    grid.innerHTML = episodes.map((episode) => {
      const ep = { season: Number(episode.seasonNumber || seasonNumber), episode: Number(episode.episodeNumber || 1) };
      const key = `${ep.season}:${ep.episode}`;
      return `<button class="episode-card ${isWatched(ep) ? "watched" : ""}" data-season="${ep.season}" data-episode="${ep.episode}" data-episode-key="${key}">
        <img src="${Madrador.esc(episode.still || details.backdrop || details.poster || Madrador.placeholder)}" alt="">
        <span><strong>S${ep.season} E${ep.episode} - ${Madrador.esc(episode.title || "Episode")}</strong>
        <small>${[episode.runtime ? episode.runtime + " min" : "", episode.airDate || ""].filter(Boolean).join(" · ")}</small>
        <em>${Madrador.esc(episode.overview || "Resume indisponible.")}</em></span>
      </button>`;
    }).join("") || `<div class="empty">Aucun episode trouve.</div>`;
    grid.querySelectorAll(".episode-card").forEach((button) => {
      button.addEventListener("click", () => {
        selectedEpisode = { season: Number(button.dataset.season), episode: Number(button.dataset.episode) };
        localStorage.setItem(storeKey("lastEpisode"), JSON.stringify(selectedEpisode));
        document.querySelectorAll(".episode-card").forEach((card) => card.classList.remove("active"));
        button.classList.add("active");
        loadSources();
      });
    });
    const last = JSON.parse(localStorage.getItem(storeKey("lastEpisode")) || "null");
    const target = last && Number(last.season) === Number(seasonNumber)
      ? grid.querySelector(`[data-episode="${last.episode}"]`)
      : grid.querySelector(".episode-card");
    if (target) target.click();
  }

  function stepEpisode(delta) {
    const grid = document.getElementById("episodeGrid");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(".episode-card"));
    const current = cards.findIndex((card) => Number(card.dataset.season) === selectedEpisode.season && Number(card.dataset.episode) === selectedEpisode.episode);
    const next = cards[current + delta];
    if (next) next.click();
  }

  function castSection() {
    const cast = details.cast || [];
    if (!cast.length) return "";
    return `<section class="section"><div class="section-head"><h2>Casting</h2><p>Clique un acteur pour voir sa filmographie.</p></div><div class="cast-rail">${cast.map((person) => `<a class="cast-card" href="/catalog?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}"><img src="${Madrador.esc(person.profile || Madrador.placeholder)}" alt=""><strong>${Madrador.esc(person.name)}</strong><small>${Madrador.esc(person.character || "Filmographie")}</small></a>`).join("")}</div></section>`;
  }

  async function recommendationsSection() {
    const host = document.getElementById("recommendations");
    if (!host) return;
    const data = await Madrador.getJson(`/recommendations.json?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, { results: [] });
    const results = data.results || [];
    host.innerHTML = results.length
      ? `<div class="section-head"><h2>Similaires</h2><span class="badge info">${results.length} titres</span></div><div class="rail">${results.map(Madrador.card).join("")}</div>`
      : "";
  }

  if (!id) {
    root.innerHTML = `<div class="empty">Aucun identifiant fourni. <a href="/catalog">Retour catalogue</a></div>`;
    return;
  }

  details = await Madrador.getJson(`/details.json?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, null);
  if (!details || details.error) {
    root.innerHTML = `<div class="empty">Impossible de charger le detail.</div>`;
    return;
  }

  const item = { id: details.id, type: details.type || type, title: details.title, poster: details.poster, year: details.year };
  Madrador.saveRecent(item);
  const fav = Madrador.isFavorite(item);
  const trailerUrl = details.trailer && details.trailer.key ? `https://www.youtube.com/watch?v=${encodeURIComponent(details.trailer.key)}` : "";
  root.innerHTML = `<section class="detail-page-hero" style="background-image:linear-gradient(90deg,rgba(5,7,20,.98),rgba(5,7,20,.62),rgba(5,7,20,.98)),url('${Madrador.esc(details.backdrop || details.poster || Madrador.placeholder)}')">
    <div class="detail-poster-wrap"><img src="${Madrador.esc(details.poster || Madrador.placeholder)}" alt=""></div>
    <div class="detail-copy">
      <a class="badge info" href="/catalog">Retour catalogue</a>
      <h1>${Madrador.esc(details.title)}</h1>
      <div class="chips"><span class="badge">${Madrador.esc(details.year || "Annee inconnue")}</span><span class="badge ok">Note ${Number(details.rating || 0).toFixed(1)}</span>${(details.genres || []).map((g) => `<span class="badge">${Madrador.esc(g)}</span>`).join("")}</div>
      <p>${Madrador.esc(details.overview || "Description indisponible.")}</p>
      <div class="actions"><a class="btn" href="${Madrador.playerUrl(item)}">Lecteur plein ecran</a>${trailerUrl ? `<a class="btn secondary" target="_blank" rel="noreferrer" href="${trailerUrl}">Bande-annonce</a>` : ""}<button class="btn secondary" id="favBtn">${fav ? "Retirer favori" : "Ajouter favori"}</button></div>
    </div>
  </section>
  ${seasonMarkup()}
  <section class="section"><div class="section-head"><div><h2>Lecture et sources</h2><p>Tri auto : MP4, VF/MULTI, score provider, puis qualite.</p></div><div class="toolbar"><button class="btn ghost" id="reloadDetailsSources">Relancer</button><button class="btn ghost" id="prevSource">Source precedente</button><button class="btn ghost" id="nextSource">Source suivante</button></div></div>
    <div class="source-toolbar"><select class="select" id="sourceFilter"><option value="all">Tous formats</option><option value="mp4">MP4 seulement</option><option value="hls">HLS seulement</option><option value="mkv">MKV seulement</option></select><select class="select" id="langFilter"><option value="all">Toutes langues</option><option value="vf">VF</option><option value="multi">MULTI</option><option value="vostfr">VOSTFR</option></select><button class="btn secondary" id="reportSource">Signaler source morte</button></div>
    <div class="player-layout"><div class="video-shell"><video id="detailVideo" controls playsinline></video></div><aside class="panel"><div id="sourceState" class="notice">Preparation...</div><div class="source-list" id="detailsSources" style="margin-top:12px"></div></aside></div>
  </section>
  ${castSection()}
  <section class="section" id="recommendations"><div class="skeleton"></div></section>`;

  document.getElementById("favBtn").addEventListener("click", () => {
    const next = Madrador.toggleFavorite(item);
    document.getElementById("favBtn").textContent = next ? "Retirer favori" : "Ajouter favori";
  });
  document.getElementById("reloadDetailsSources").addEventListener("click", loadSources);
  document.getElementById("nextSource").addEventListener("click", () => { if (streams.length) playSource(streams[(activeSourceIndex + 1) % streams.length], (activeSourceIndex + 1) % streams.length); });
  document.getElementById("prevSource").addEventListener("click", () => { if (streams.length) playSource(streams[(activeSourceIndex - 1 + streams.length) % streams.length], (activeSourceIndex - 1 + streams.length) % streams.length); });
  document.getElementById("reportSource").addEventListener("click", reportSource);
  document.getElementById("sourceFilter").addEventListener("change", (event) => { sourceFilter = event.target.value; renderSources(); });
  document.getElementById("langFilter").addEventListener("change", (event) => { langFilter = event.target.value; renderSources(); });
  const video = document.getElementById("detailVideo");
  video.addEventListener("timeupdate", () => {
    if (video.currentTime > 5) localStorage.setItem(storeKey("progress", activeEpisodeId()), JSON.stringify({ time: video.currentTime, duration: video.duration || 0, updatedAt: Date.now() }));
    if (type === "series" && video.duration && video.currentTime / video.duration > 0.86) markWatched(selectedEpisode);
  });
  video.addEventListener("loadedmetadata", () => {
    try {
      const progress = JSON.parse(localStorage.getItem(storeKey("progress", activeEpisodeId())) || "null");
      if (progress && progress.time > 10 && progress.time < video.duration - 10) video.currentTime = progress.time;
    } catch {}
  });
  const seasonSelect = document.getElementById("seasonSelect");
  if (seasonSelect) {
    try {
      const last = JSON.parse(localStorage.getItem(storeKey("lastEpisode")) || "null");
      if (last && last.season) seasonSelect.value = String(last.season);
    } catch {}
    seasonSelect.addEventListener("change", () => loadEpisodes(seasonSelect.value));
    document.getElementById("prevEpisode").addEventListener("click", () => stepEpisode(-1));
    document.getElementById("nextEpisodeBtn").addEventListener("click", () => stepEpisode(1));
    loadEpisodes(seasonSelect.value || "1");
  } else {
    loadSources();
  }
  recommendationsSection();
})();
