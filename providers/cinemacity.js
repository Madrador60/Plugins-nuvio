// CinemaCity scraper for Nuvio Local Scrapers
// React Native compatible version - Promise-based only, no async/await.

var MAIN_URL = "https://cinemacity.cc";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

// Leave empty for public use. If CinemaCity requires auth for your account,
// set your cookie locally before loading the scraper, but do not publish it.
var CINEMACITY_COOKIE = "";

function getHeaders(extra) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": MAIN_URL + "/"
  };

  if (CINEMACITY_COOKIE) {
    headers.Cookie = CINEMACITY_COOKIE;
  }

  extra = extra || {};
  Object.keys(extra).forEach(function (key) {
    headers[key] = extra[key];
  });

  return headers;
}

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    headers: getHeaders(options.headers || {})
  }).then(function (response) {
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    return response.text();
  });
}

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    headers: getHeaders(options.headers || {})
  }).then(function (response) {
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    return response.json();
  });
}

function atobPolyfill(str) {
  try {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    str = String(str).replace(/[=]+$/, "");
    if (str.length % 4 === 1) return "";

    for (var bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++);) {
      buffer = chars.indexOf(buffer);
      if (~buffer) {
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) {
          output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
        }
      }
    }

    return output;
  } catch (e) {
    return "";
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return stripTags(value).split("(")[0].trim().toLowerCase();
}

function extractQuality(url) {
  var low = String(url || "").toLowerCase();
  if (low.indexOf("2160p") !== -1 || low.indexOf("4k") !== -1) return "4K";
  if (low.indexOf("1080p") !== -1) return "1080p";
  if (low.indexOf("720p") !== -1) return "720p";
  if (low.indexOf("480p") !== -1) return "480p";
  if (low.indexOf("360p") !== -1) return "360p";
  return "HD";
}

function extractCards(html) {
  var cards = [];
  var cardRegex = /<div[^>]+class=["'][^"']*dar-short_item[^"']*["'][\s\S]*?<\/div>/gi;
  var cardMatch;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    var card = cardMatch[0];
    var anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    var anchorMatch;

    while ((anchorMatch = anchorRegex.exec(card)) !== null) {
      var hrefMatch = anchorMatch[1].match(/\bhref=["']([^"']+\.html)["']/i);
      if (!hrefMatch) continue;

      cards.push({
        href: decodeHtml(hrefMatch[1]),
        title: stripTags(anchorMatch[2])
      });
      break;
    }
  }

  return cards;
}

function findBestMatch(cards, title) {
  var wanted = normalizeTitle(title);
  if (!wanted) return null;

  for (var i = 0; i < cards.length; i++) {
    var found = normalizeTitle(cards[i].title);
    if (found === wanted || found.indexOf(wanted) !== -1 || wanted.indexOf(found) !== -1) {
      return cards[i].href;
    }
  }

  return null;
}

function extractFileDataFromScript(script) {
  var atobRegex = /atob\s*\(\s*(['"])(.*?)\1\s*\)/g;
  var match;

  while ((match = atobRegex.exec(script)) !== null) {
    var decoded = atobPolyfill(match[2]);
    var stringFile = decoded.match(/file\s*:\s*(['"])(.*?)\1/s);
    var arrayFile = decoded.match(/file\s*:\s*(\[[\s\S]*?\])/s);
    var rawFile = stringFile ? stringFile[2] : arrayFile ? arrayFile[1] : null;

    if (!rawFile || rawFile.length < 5) continue;

    if (rawFile.charAt(0) === "[" || rawFile.charAt(0) === "{") {
      try {
        return JSON.parse(rawFile.replace(/\\(.)/g, "$1"));
      } catch (e) {
        try {
          return JSON.parse(rawFile);
        } catch (e2) {
          return rawFile;
        }
      }
    }

    return rawFile;
  }

  return null;
}

function extractFileData(html) {
  var scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  var match;

  while ((match = scriptRegex.exec(html)) !== null) {
    if (match[1].indexOf("atob") === -1) continue;
    var fileData = extractFileDataFromScript(match[1]);
    if (fileData) return fileData;
  }

  return null;
}

function addStream(streams, url, title, quality) {
  if (!url || String(url).indexOf("http") !== 0 || String(url).length < 15) return;

  streams.push({
    name: "CinemaCity - " + (quality || extractQuality(url)),
    title: title,
    url: String(url).trim(),
    quality: quality || extractQuality(url),
    size: "Unknown",
    headers: getHeaders({ "Accept": "*/*" }),
    provider: "cinemacity",
    type: "direct"
  });
}

function processFileString(streams, value, title) {
  value = String(value || "");

  if (value.indexOf(".urlset/master.m3u8") !== -1) {
    addStream(streams, value, title, "Auto");
    return;
  }

  var urls = value.indexOf("[") !== -1 ? value.split(",") : [value];
  urls.forEach(function (candidate) {
    var match = String(candidate).match(/\[(.*?)\](.*)/);
    if (match) {
      addStream(streams, match[2].trim(), title, match[1].trim());
    } else {
      addStream(streams, String(candidate).trim(), title, extractQuality(candidate));
    }
  });
}

function getMediaInfo(tmdbId, mediaType) {
  var endpoint = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + endpoint + "/" + encodeURIComponent(tmdbId) + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url);
}

function findMediaUrl(title) {
  var searchUrl = MAIN_URL + "/?do=search&subaction=search&search_start=0&full_search=0&story=" + encodeURIComponent(title);

  return fetchText(searchUrl).then(function (searchHtml) {
    var mediaUrl = findBestMatch(extractCards(searchHtml), title);
    if (mediaUrl) return mediaUrl;

    return fetchText(MAIN_URL).then(function (homeHtml) {
      return findBestMatch(extractCards(homeHtml), title);
    });
  });
}

function collectMovieStreams(fileData, title) {
  var streams = [];

  if (Array.isArray(fileData)) {
    var item = null;
    for (var i = 0; i < fileData.length; i++) {
      if (!fileData[i].folder && fileData[i].file) {
        item = fileData[i];
        break;
      }
    }
    item = item || fileData[0];
    if (item && item.file) processFileString(streams, item.file, title);
  } else if (typeof fileData === "string") {
    processFileString(streams, fileData, title);
  }

  return streams;
}

function collectTvStreams(fileData, title, seasonNum, episodeNum) {
  var streams = [];
  if (!Array.isArray(fileData)) return streams;

  var seasonLabel = "Season " + seasonNum;
  var seasonObject = null;

  for (var i = 0; i < fileData.length; i++) {
    var seasonTitle = fileData[i].title || "";
    if (seasonTitle.indexOf(seasonLabel) !== -1 || seasonTitle.indexOf("S" + seasonNum) !== -1) {
      seasonObject = fileData[i];
      break;
    }
  }

  if (!seasonObject || !Array.isArray(seasonObject.folder)) return streams;

  var episodeLabel = "Episode " + episodeNum;
  var episodeObject = null;

  for (var j = 0; j < seasonObject.folder.length; j++) {
    var episodeTitle = seasonObject.folder[j].title || "";
    if (episodeTitle.indexOf(episodeLabel) !== -1 || episodeTitle.indexOf("E" + episodeNum) !== -1) {
      episodeObject = seasonObject.folder[j];
      break;
    }
  }

  if (episodeObject && episodeObject.file) {
    processFileString(streams, episodeObject.file, title + " S" + seasonNum + "E" + episodeNum);
  }

  return streams;
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  console.log("[CinemaCity] Fetching streams for TMDB ID: " + tmdbId + ", Type: " + mediaType);

  return getMediaInfo(tmdbId, mediaType)
    .then(function (mediaInfo) {
      var title = mediaInfo.title || mediaInfo.name;
      if (!title) return [];

      return findMediaUrl(title).then(function (mediaUrl) {
        if (!mediaUrl) return [];

        return fetchText(mediaUrl).then(function (pageHtml) {
          var fileData = extractFileData(pageHtml);
          if (!fileData) return [];

          if (mediaType === "movie") {
            return collectMovieStreams(fileData, title);
          }

          return collectTvStreams(fileData, title, seasonNum, episodeNum);
        });
      });
    })
    .catch(function (error) {
      console.error("[CinemaCity] Error in getStreams:", error && error.message ? error.message : error);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.CinemaCityScraperModule = { getStreams: getStreams };
}
