const storage = {};

export default {
  getItem: async (key) => {
    try { return localStorage.getItem(key); } catch { return storage[key] || null; }
  },
  setItem: async (key, value) => {
    try { localStorage.setItem(key, value); } catch { storage[key] = value; }
  },
  removeItem: async (key) => {
    try { localStorage.removeItem(key); } catch { delete storage[key]; }
  },
  multiGet: async (keys) => keys.map(k => [k, localStorage.getItem(k)]),
  multiSet: async (pairs) => pairs.forEach(([k, v]) => localStorage.setItem(k, v)),
};
