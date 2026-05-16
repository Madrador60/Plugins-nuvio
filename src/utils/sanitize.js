function asText(value, maxLength = 250) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function asProviderId(value) {
  return asText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function asUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

module.exports = { asText, asProviderId, asUrl };
