(async function () {
  const root = document.getElementById("detailsRoot");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = Madrador.typeForUrl(params.get("type") || "movie");
  let details = null;
  let hls = null;
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

  function activeEpisodeId() {
    return type === "series" ? `${id}:${selectedEpisode.season}:${selectedEpisode.episode}` : id;
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

  function sourceEndpoint() {
    return `/stream/${encodeURIComponent(type)}/${encodeURIComponent(activeEpisodeId())}.json`;
  }

  function providerLabel(stream) {
    return stream.providerId || stream.name || "Source";
  }

  function uniqueProviders() {
    const seen = new Set();
    return streams.filter((stream) => {
      const key = providerLabel(stream).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }

  async function playSource(stream, index) {
    const video = document.getElementById("detailVideo");
    const state = document.getElementById("sourceState");
    if (!video || !stream) return;
    activeStream = stream;
    activeSourceIndex = Number(index || 0);
    localStorage.setItem(storeKey("lastSource", activeEpisodeId()), String(activeSourceIndex));
    document.querySelectorAll("[data-detail-source], [data-provider-tab]").forEach((node) => node.classList.remove("active"));
    document.querySelectorAll(`[data-detail-source="${index}"]`).forEach((node) => node.classList.add("active"));
    document.querySelectorAll(`[data-provider-tab="${Madrador.esc(providerLabel(stream))}"]`).forEach((node) => node.classList.add("active"));
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute("src");
    video.load();
    const kind = streamKind(stream);
    state.className = "cinema-state";
    state.textContent = `Lecture en cours : ${providerLabel(stream)} - ${kind} - ${stream.language || "FR"} - ${stream.quality || "HD"}`;
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
      state.textContent = "Source prete. Appuie sur Play si ton navigateur bloque la lecture automatique.";
    });
  }

  function renderProviderTabs() {
    const host = document.getElementById("providerTabs");
    if (!host) return;
    const providers = uniqueProviders();
    host.innerHTML = providers.length
      ? providers.map((stream) => {
        const index = streams.indexOf(stream);
        return `<button data-provider-tab="${Madrador.esc(providerLabel(stream))}" data-source-index="${index}"><span class="play-dot"></span>${Madrador.esc(providerLabel(stream))}</button>`;
      }).join("")
      : `<span>Aucune source</span>`;
    host.querySelectorAll("[data-source-index]").forEach((button) => {
      button.addEventListener("click", () => playSource(streams[Number(button.dataset.sourceIndex)], button.dataset.sourceIndex));
    });
  }

  function renderSources() {
    const list = document.getElementById("detailsSources");
    const state = document.getElementById("sourceState");
    const visible = filteredStreams();
    renderProviderTabs();
    if (!visible.length) {
      list.innerHTML = "";
      state.className = "cinema-state empty-state";
      state.textContent = streams.length ? "Aucune source pour ce filtre." : "Aucune source trouvee pour ce titre ou cet episode.";
      return;
    }
    state.className = "cinema-state";
    state.textContent = `${visible.length} source(s) affichee(s) sur ${streams.length}.`;
    list.innerHTML = visible.map((stream) => {
      const index = streams.indexOf(stream);
      return `<button class="cinema-source-card" data-detail-source="${index}">
        <strong>${Madrador.esc(providerLabel(stream))}</strong>
        <small>${Madrador.esc(stream.title || stream.description || "Source externe")}</small>
        <span>${Madrador.esc(streamKind(stream))}</span>
        <span>${Madrador.esc(stream.language || "FR")}</span>
        <span>${Madrador.esc(stream.quality || "HD")}</span>
      </button>`;
    }).join("");
    list.querySelectorAll("[data-detail-source]").forEach((button) => {
      button.addEventListener("click", () => playSource(streams[Number(button.dataset.detailSource)], button.dataset.detailSource));
    });
  }

  async function loadSources() {
    const state = document.getElementById("sourceState");
    const list = document.getElementById("detailsSources");
    if (!state || !list) return;
    state.className = "cinema-state";
    state.textContent = type === "series" ? `Recherche S${selectedEpisode.season} E${selectedEpisode.episode}...` : "Recherche des sources...";
    list.innerHTML = `<div class="cinema-loader"></div>`;
    const data = await Madrador.getJson(sourceEndpoint(), { streams: [] });
    streams = sortStreams(data.streams || []);
    renderSources();
    if (!streams.length) return;
    const preferred = Number(localStorage.getItem(storeKey("lastSource", activeEpisodeId())) || 0);
    playSource(streams[preferred] || streams[0], streams[preferred] ? preferred : 0);
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

  async function reportSource() {
    const state = document.getElementById("sourceState");
    if (!activeStream) {
      state.textContent = "Aucune source active a signaler.";
      return;
    }
    const response = await fetch("/report/source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: activeStream.providerId || activeStream.name,
        sourceName: activeStream.name || activeStream.title,
        mediaType: type,
        mediaId: activeEpisodeId(),
        reason: "source_morte"
      })
    });
    state.textContent = response.ok ? "Merci, la source morte est signalee." : "Impossible de signaler cette source.";
  }

  function infoBlock(trailerUrl) {
    const castNames = (details.cast || []).slice(0, 8).map((person) => person.name).join(", ");
    return `<section class="cinema-info" style="background-image:linear-gradient(90deg,rgba(18,18,18,.98),rgba(18,18,18,.82),rgba(18,18,18,.94)),url('${Madrador.esc(details.backdrop || details.poster || Madrador.placeholder)}')">
      <aside class="cinema-poster">
        <img src="${Madrador.esc(details.poster || Madrador.placeholder)}" alt="">
        ${trailerUrl ? `<a class="orange-outline" target="_blank" rel="noreferrer" href="${trailerUrl}"><span class="play-dot"></span>Bande annonce</a>` : ""}
        <button class="problem-btn" id="reportProblem">Signaler un probleme</button>
      </aside>
      <div class="cinema-copy">
        <div class="cinema-title-line"><h1>${Madrador.esc(details.title)}</h1><span>${Madrador.esc(details.year || "")}</span></div>
        <div class="cinema-meta"><span>${Madrador.esc((details.genres || []).join(", ") || "Genre inconnu")}</span><span>${type === "series" ? "Serie" : "Film"}</span><span>${Madrador.esc(details.rating ? Number(details.rating).toFixed(1) : "0.0")} / 10</span></div>
        <p class="cinema-overview">${Madrador.esc(details.overview || "Description indisponible.")}</p>
        <div class="cinema-facts">
          <p><strong>Titre Original:</strong> ${Madrador.esc(details.title)}</p>
          <p><strong>Version:</strong> VF / MULTI selon sources</p>
          <p><strong>Qualite:</strong> HD selon sources</p>
          <p><strong>Date de sortie:</strong> ${Madrador.esc(details.year || "inconnue")}</p>
          <p><strong>Acteurs:</strong> ${Madrador.esc(castNames || "Indisponible")}</p>
          <p><strong>Langue d'origine:</strong> Voir TMDB</p>
        </div>
      </div>
      <div class="cinema-rating"><div class="like-ring">👍</div><strong>${Madrador.esc(details.rating ? Number(details.rating).toFixed(1) : "0.0")}</strong><span>Moyenne</span></div>
    </section>`;
  }

  function sourcePanel() {
    return `<section class="cinema-player-panel">
      <div class="cinema-video-wrap">
        <video id="detailVideo" controls playsinline></video>
        <button class="cinema-play-overlay" id="overlayPlay" aria-label="Lecture"></button>
      </div>
      <div class="cinema-controls">
        <button id="prevSource">↺ Source</button>
        <button id="nextSource">Source ↻</button>
        <button id="muteHint">Audio</button>
        <span id="sourceState" class="cinema-state">Preparation...</span>
        <button id="fullscreenBtn">Plein ecran</button>
      </div>
      <nav class="provider-tabs" id="providerTabs"><span>Sources...</span></nav>
      <div class="source-toolbar cinema-filters">
        <select class="select" id="sourceFilter"><option value="all">Tous formats</option><option value="mp4">MP4 seulement</option><option value="hls">HLS seulement</option><option value="mkv">MKV seulement</option></select>
        <select class="select" id="langFilter"><option value="all">Toutes langues</option><option value="vf">VF</option><option value="multi">MULTI</option><option value="vostfr">VOSTFR</option></select>
        <button class="btn secondary" id="reportSource">Signaler source morte</button>
      </div>
      <div class="cinema-source-list" id="detailsSources"></div>
    </section>`;
  }

  function seriesMarkup() {
    if (type !== "series" || !(details.seasons || []).length) return "";
    return `<section class="series-board">
      <div class="series-top">
        <button class="episode-nav" id="prevEpisode">‹</button>
        <label>Saison <select class="select" id="seasonSelect">${details.seasons.map((season) => `<option value="${season.seasonNumber}">${Madrador.esc(season.name || ("Saison " + season.seasonNumber))}</option>`).join("")}</select></label>
        <button class="episode-nav" id="nextEpisodeBtn">›</button>
        <span id="episodeCount">Chargement...</span>
      </div>
      <div class="episode-lanes">
        <div class="episode-lane"><h2>VF</h2><div id="episodeGridVf"></div></div>
        <div class="episode-lane"><h2>VOSTFR</h2><div id="episodeGridVostfr"></div></div>
      </div>
    </section>`;
  }

  function episodeButton(episode, lang) {
    const ep = { season: Number(episode.seasonNumber || 1), episode: Number(episode.episodeNumber || 1) };
    const key = `${ep.season}:${ep.episode}`;
    return `<button class="episode-row ${isWatched(ep) ? "watched" : ""}" data-lang="${lang}" data-season="${ep.season}" data-episode="${ep.episode}" data-episode-key="${key}">
      <span class="episode-download">⇣</span>
      <strong><span class="play-dot"></span>Episode ${ep.episode}</strong>
      <small>${Madrador.esc(episode.title || "")}</small>
      <span class="episode-info">i</span>
    </button>`;
  }

  async function loadEpisodes(seasonNumber) {
    const vf = document.getElementById("episodeGridVf");
    const vostfr = document.getElementById("episodeGridVostfr");
    const count = document.getElementById("episodeCount");
    if (!vf || !vostfr) return;
    vf.innerHTML = `<div class="cinema-loader"></div>`;
    vostfr.innerHTML = `<div class="cinema-loader"></div>`;
    const data = await Madrador.getJson(`/episodes.json?id=${encodeURIComponent(id)}&season=${encodeURIComponent(seasonNumber)}`, { episodes: [] });
    const episodes = data.episodes || [];
    if (count) count.textContent = `${episodes.length} episode(s)`;
    vf.innerHTML = episodes.map((episode) => episodeButton(episode, "vf")).join("") || `<div class="empty">Aucun episode</div>`;
    vostfr.innerHTML = episodes.map((episode) => episodeButton(episode, "vostfr")).join("") || `<div class="empty">Aucun episode</div>`;
    document.querySelectorAll(".episode-row").forEach((button) => {
      button.addEventListener("click", () => {
        selectedEpisode = { season: Number(button.dataset.season), episode: Number(button.dataset.episode) };
        langFilter = button.dataset.lang || "all";
        const langSelect = document.getElementById("langFilter");
        if (langSelect) langSelect.value = langFilter;
        localStorage.setItem(storeKey("lastEpisode"), JSON.stringify(selectedEpisode));
        document.querySelectorAll(".episode-row").forEach((row) => row.classList.remove("active"));
        document.querySelectorAll(`[data-episode-key="${selectedEpisode.season}:${selectedEpisode.episode}"]`).forEach((row) => row.classList.add("active"));
        loadSources();
      });
    });
    const last = JSON.parse(localStorage.getItem(storeKey("lastEpisode")) || "null");
    const target = last && Number(last.season) === Number(seasonNumber)
      ? document.querySelector(`[data-lang="vf"][data-episode="${last.episode}"]`)
      : document.querySelector('[data-lang="vf"][data-episode="1"]');
    if (target) target.click();
  }

  function stepEpisode(delta) {
    const rows = Array.from(document.querySelectorAll('[data-lang="vf"].episode-row'));
    const current = rows.findIndex((row) => Number(row.dataset.season) === selectedEpisode.season && Number(row.dataset.episode) === selectedEpisode.episode);
    const next = rows[current + delta];
    if (next) next.click();
  }

  function castSection() {
    const cast = details.cast || [];
    if (!cast.length) return "";
    return `<section class="section"><div class="section-head"><h2>Casting</h2><p>Clique un acteur pour voir sa filmographie.</p></div><div class="cast-rail">${cast.map((person) => `<a class="cast-card orange-cast" href="/catalog?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}"><img src="${Madrador.esc(person.profile || Madrador.placeholder)}" alt=""><strong>${Madrador.esc(person.name)}</strong><small>${Madrador.esc(person.character || "Filmographie")}</small></a>`).join("")}</div></section>`;
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
  const trailerUrl = details.trailer && details.trailer.key ? `https://www.youtube.com/watch?v=${encodeURIComponent(details.trailer.key)}` : "";
  root.innerHTML = `<div class="cinema-detail-shell ${type === "series" ? "series-mode" : "movie-mode"}">
    ${sourcePanel()}
    ${type === "series" ? seriesMarkup() : ""}
    ${infoBlock(trailerUrl)}
    ${castSection()}
    <section class="section" id="recommendations"><div class="skeleton"></div></section>
  </div>`;

  document.getElementById("reportProblem").addEventListener("click", reportSource);
  document.getElementById("reportSource").addEventListener("click", reportSource);
  document.getElementById("nextSource").addEventListener("click", () => { if (streams.length) playSource(streams[(activeSourceIndex + 1) % streams.length], (activeSourceIndex + 1) % streams.length); });
  document.getElementById("prevSource").addEventListener("click", () => { if (streams.length) playSource(streams[(activeSourceIndex - 1 + streams.length) % streams.length], (activeSourceIndex - 1 + streams.length) % streams.length); });
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    const target = document.querySelector(".cinema-video-wrap");
    if (target && target.requestFullscreen) target.requestFullscreen();
  });
  document.getElementById("overlayPlay").addEventListener("click", () => {
    const video = document.getElementById("detailVideo");
    if (video) video.play().catch(() => {});
  });
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
