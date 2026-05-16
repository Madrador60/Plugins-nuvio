module.exports = {
  id: "afterdark",
  disabled: true,
  async getStreams() { return { streams: [], error: new Error('Provider disabled: port JavaScript a finaliser') }; }
};

