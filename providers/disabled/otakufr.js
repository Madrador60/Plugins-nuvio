module.exports = {
  id: "otakufr",
  disabled: true,
  async getStreams() { return { streams: [], error: new Error('Provider disabled: port JavaScript a finaliser') }; }
};

