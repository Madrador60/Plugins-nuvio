(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const type = params.get("type") || "movie";
  const title = params.get("title") || "Lecture";
  const video = document.getElementById("video");
  const list = document.getElementById("sourceList");
  const message = document.getElementById("playerMessage");
  const playerTitle = document.getElementById("playerTitle");
  const meta = document.getElementById("playerMeta");
  let hls = null;
  let streams = [];

  function kind(stream) {
    const url = stream.url || "";
    if (/m3u8/i.test(url) || stream.format === "HLS") return "HLS";
    if (/\.mp4/i.test(url) || stream.format === "MP4") return "MP4";
    if (/\.mkv/i.test(url)) return "MKV";
    return stream.format || "Direct";
  }

  async function play(stream, index) {
    if (!stream || !video) return;
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
      hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function (_, data) {
        if (data.fatal) message.textContent = "Source HLS indisponible ou interrompue.";
      });
    } else {
      video.src = url;
    }
    await video.play().catch(() => { message.textContent = "Le navigateur a bloque la lecture automatique. Appuie sur Play."; });
  }

  function renderSources() {
    if (!streams.length) {
      list.innerHTML = "";
      message.className = "empty";
      message.innerHTML = "Aucune source trouvee. Le provider peut etre lent, mort, ou ne pas avoir ce titre.";
      return;
    }
    message.className = "notice";
    message.textContent = `${streams.length} source(s) trouvee(s). MP4/VF sont priorisees quand disponibles.`;
    list.innerHTML = streams.map((stream, index) => `<button class="source-card" data-source-index="${index}"><strong>${Madrador.esc(stream.name || stream.providerId || "Source")}</strong><small>${Madrador.esc(stream.title || stream.description || "Source externe")}</small><div class="chips" style="margin-top:10px"><span class="badge info">${Madrador.esc(kind(stream))}</span><span class="badge">${Madrador.esc(stream.language || "FR")}</span><span class="badge">${Madrador.esc(stream.quality || "HD")}</span><span class="badge ok">score ${Madrador.esc(stream.score || "?")}</span></div></button>`).join("");
    list.querySelectorAll(".source-card").forEach((button) => button.addEventListener("click", () => play(streams[Number(button.dataset.sourceIndex)], button.dataset.sourceIndex)));
    play(streams[0], 0);
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
    streams = data.streams || [];
    meta.textContent = streams.length ? `${streams.length} source(s) disponible(s)` : "Aucune source disponible";
    renderSources();
  }

  document.getElementById("reloadSources").addEventListener("click", load);
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    const target = document.querySelector(".video-shell");
    if (target && target.requestFullscreen) target.requestFullscreen();
  });
  load();
})();
