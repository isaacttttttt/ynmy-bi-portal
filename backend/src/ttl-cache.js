export function createTtlCache({ ttlMs = 60000, maxEntries = 0 } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 0 || ttlMs > 2147483647 || !Number.isSafeInteger(maxEntries) || maxEntries < 0) {
    throw new Error('Invalid cache limits');
  }
  const store = new Map();
  const pending = new Map();

  function remove(key) {
    const entry = store.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    store.delete(key);
  }

  function peek(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      remove(key);
      return undefined;
    }
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  function set(key, value) {
    remove(key);
    if (!ttlMs) return value;
    while (maxEntries > 0 && store.size >= maxEntries) {
      remove(store.keys().next().value);
    }
    const timer = setTimeout(remove, ttlMs, key);
    timer.unref();
    store.set(key, { value, expiresAt: Date.now() + ttlMs, timer });
    return value;
  }

  async function getOrLoad(key, loader, { onEvent, shouldStore } = {}) {
    const cached = peek(key);
    if (cached !== undefined) {
      onEvent?.('hit', store.size);
      return cached;
    }
    if (pending.has(key)) {
      onEvent?.('shared', store.size);
      return pending.get(key);
    }
    onEvent?.('miss', store.size);
    const promise = (async () => {
      const value = await loader();
      if (ttlMs && (!shouldStore || shouldStore(value))) {
        set(key, value);
        onEvent?.('stored', store.size);
      }
      return value;
    })().finally(() => {
      pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  }

  return {
    peek,
    set,
    getOrLoad,
    delete: remove,
    clear() {
      for (const key of [...store.keys()]) remove(key);
      pending.clear();
    },
    get size() {
      return store.size;
    },
  };
}
