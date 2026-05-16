class MemoryCache {
  constructor(maxEntries = 300) {
    this.maxEntries = maxEntries;
    this.items = new Map();
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.items.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs) {
    if (this.items.size >= this.maxEntries) {
      const firstKey = this.items.keys().next().value;
      this.items.delete(firstKey);
    }
    this.items.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  clear() {
    this.items.clear();
  }
}

module.exports = { MemoryCache };
