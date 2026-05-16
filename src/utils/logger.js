function sanitize(value) {
  return String(value || "").replace(/(token|key|secret)=([^&\s]+)/gi, "$1=***");
}

function log(level, message, meta) {
  const suffix = meta ? ` ${sanitize(JSON.stringify(meta))}` : "";
  process.stdout.write(`[${level}] ${sanitize(message)}${suffix}\n`);
}

module.exports = {
  info: (message, meta) => log("INFO", message, meta),
  warn: (message, meta) => log("WARN", message, meta),
  error: (message, meta) => log("ERROR", message, meta),
  debug: (message, meta) => {
    if (process.env.DEBUG) log("DEBUG", message, meta);
  }
};
