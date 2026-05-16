function hasAdminToken(req, expectedToken) {
  return Boolean(expectedToken) && req.headers["x-admin-token"] === expectedToken;
}

module.exports = { hasAdminToken };
