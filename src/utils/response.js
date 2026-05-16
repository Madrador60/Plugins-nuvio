function ok(data) {
  return Object.assign({ success: true }, data || {});
}

function fail(code, message, extra) {
  return {
    success: false,
    error: Object.assign({ code, message }, extra || {})
  };
}

module.exports = { ok, fail };
