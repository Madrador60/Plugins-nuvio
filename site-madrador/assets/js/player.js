(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = Madrador.typeForUrl(params.get("type") || "movie");
  const title = params.get("title") || "Lecture";
  const video = document.getElementById("video");
  const list = document.getElementById("sourceList");
  const message = document.getElementById("playerMessage");
  const playerTitle = document.getElementById("playerTitle");
  const meta = document.getElementById("playerMeta");
  const formatFilter = document.getElementById("formatFilter");
  const languageFilter = document.getElementById("languageFilter");
  let hls = null;
  let streams = [];
  let currentIndex = 0;
  let activeStream = null;

  function storageKey(name) {
    return `madrador:${name}:${type}:${id}`;
  }

  function kind(stream) {
    const url = stream.url || "";
    if (/m3u8/i.test(url) || stream.format === "HLS") return "HLS";
    if (/\.mp4/i.test(url) || stream.format === "MP4") return "MP4";
    if (/\.mkv/i.test(url) || stream.format === "MKV") return "MKV";
    return stream.format || "Direct";
  }

  function text(stream) {
    return [stream.name, stream.title, stream.description, stream.language, stream.quality, stream.providerId].join(" ").toLowerCase();
  }

  function sortStreams(list) {
    const langRank = { VF: 0, MULTI: 1, FR: 2, VOSTFR: 3 };
    const formatRank = { MP4: 0, HLS: 1, MKV: 2, Direct: 3 };
    return list.slice().sort((a, b) => {
      const af = formatRank[kind(a)] ?? 4;
      const bf = formatRank[kind(b)] ?? 4;
      if (af !== bf) return af - bf;
      const al = langRank[a.language] ?? 5;
      const bl = langRank[b.language] ?? 5;
      if (al !== bl) return al - bl;
      return Number(b.score || 0) - Number(a.score || 0);
    });
  }

  function visibleStreams() {
    const format = formatFilter ? formatFilter.value : "all";
    const lang = languageFilter ? languageFilter.value : "all";
    return streams.filter((stream) => {
      if (format !== "all" && kind(stream).toLowerCase() !== format) return false;
      const haystack = text(stream);
      if (lang === "vf") return /\bvf\b|french|francais|français/.test(haystack);
      if (lang === "multi") return /\bmulti\b/.test(haystack);
      if (lang === "vostfr") return /vostfr|vost/.test(haystack);
      return true;
    });
  }

  async function play(stream, index) {
    if (!stream || !video) return;
    currentIndex = Number(index || 0);
    activeStream = stream;
    localStorage.setItem(storageKey("lastSource"), String(currentIndex));
    document.querySelectorAll(".source-card").forEach((card) => card.classList.remove("active"));
    const active = document.querySelector(`[data-source-index="${index}"]`);
    if (active) active.classList.add("active");
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute("src");
    video.load();
    const url = stream.url;
    const typeLabel = kind(stream);
    message.className = "notice";
    message.textContent = `Lecture: ${stream.name || stream.providerId || "Source"} - ${typeLabel}`;
    if (typeLabel === "HLS" && window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function (_, data) {
        if (data.fatal) message.textContent = "Source HLS indisponible. Essaie une autre source ou le filtre MP4.";
      });
    } else {
      video.src = url;
    }
    await video.play().catch(() => { message.textContent = "Le navigateur a bloque la lecture automatique. Appuie sur Play."; });
  }

  function renderSources() {
    const visible = visibleStreams();
    if (!visible.length) {
      list.innerHTML = "";
      message.className = "empty";
      message.innerHTML = streams.length ? "Aucune source pour ce filtre." : "Aucune source trouvee. Le provider peut etre lent, mort, ou ne pas avoir ce titre.";
      return;
    }
    message.className = "notice";
    message.textContent = `${visible.length} source(s) affichee(s) sur ${streams.length}. Source recommandee en premier.`;
    list.innerHTML = visible.map((stream) => {
      const index = streams.indexOf(stream);
      return `<button class="source-card" data-source-index="${index}"><strong>${Madrador.esc(stream.name || stream.providerId || "Source")}</strong><small>${Madrador.esc(stream.title || stream.description || "Source externe")}</small><div class="chips" style="margin-top:10px"><span class="badge info">${Madrador.esc(kind(stream))}</span><span class="badge">${Madrador.esc(stream.language || "FR")}</span><span class="badge">${Madrador.esc(stream.quality || "HD")}</span><span class="badge ok">score ${Madrador.esc(stream.score || "?")}</span></div></button>`;
    }).join("");
    list.querySelectorAll(".source-card").forEach((button) => button.addEventListener("click", () => play(streams[Number(button.dataset.sourceIndex)], button.dataset.sourceIndex)));
    const preferred = Number(localStorage.getItem(storageKey("lastSource")) || 0);
    play(streams[preferred] || visible[0], streams[preferred] ? preferred : streams.indexOf(visible[0]));
  }

  async function load() {
    if (!id) {
      message.className = "empty";
      message.textContent = "Aucun titre selectionne.";
      return;
    }
    playerTitle.textContent = title;
    meta.textContent = "Recherche des sources...";
    message.className = "notice";
    message.textContent = "Chargement des providers...";
    const data = await Madrador.getJson(`/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`, { streams: [] });
    streams = sortStreams(data.streams || []);
    meta.textContent = streams.length ? `${streams.length} source(s) disponible(s)` : "Aucune source disponible";
    renderSources();
  }

  async function reportSource() {
    if (!activeStream) {
      message.textContent = "Aucune source active a signaler.";
      return;
    }
    const response = await fetch("/report/source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: activeStream.providerId || activeStream.name,
        sourceName: activeStream.name || activeStream.title,
        mediaType: type,
        mediaId: id,
        reason: "source_morte"
      })
    });
    message.textContent = response.ok ? "Merci, la source morte est signalee." : "Impossible de signaler cette source.";
  }

  document.getElementById("reloadSources").addEventListener("click", load);
  document.getElementById("nextSource").addEventListener("click", () => {
    if (!streams.length) return;
    const next = (currentIndex + 1) % streams.length;
    play(streams[next], next);
  });
  document.getElementById("prevSource").addEventListener("click", () => {
    if (!streams.length) return;
    const prev = (currentIndex - 1 + streams.length) % streams.length;
    play(streams[prev], prev);
  });
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    const target = document.querySelector(".video-shell");
    if (target && target.requestFullscreen) target.requestFullscreen();
  });
  document.getElementById("reportSource").addEventListener("click", reportSource);
  if (formatFilter) formatFilter.addEventListener("change", renderSources);
  if (languageFilter) languageFilter.addEventListener("change", renderSources);
  video.addEventListener("timeupdate", () => {
    if (video.currentTime > 5) localStorage.setItem(storageKey("progress"), JSON.stringify({ time: video.currentTime, duration: video.duration || 0, updatedAt: Date.now() }));
  });
  video.addEventListener("loadedmetadata", () => {
    try {
      const progress = JSON.parse(localStorage.getItem(storageKey("progress")) || "null");
      if (progress && progress.time > 10 && progress.time < video.duration - 10) video.currentTime = progress.time;
    } catch {}
  });
  load();
})();
