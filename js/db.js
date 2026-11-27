// Storage layer. Everything the app saves goes through here.
//
// Built so that syncing to the NAS can be added later without changing the
// data format:
//  - every record has a random `id`, so two devices never collide
//  - every write stamps `updatedAt`, so "newest wins" can merge copies
//  - deletes are soft (`deleted: true`), so a delete can be synced too
//  - `changesSince()` and `merge()` are exactly what a sync needs
// The JSON backup/restore already uses merge(), so it is exercised today.

const DB_NAME = 'ibs-diary';
const DB_VERSION = 1;
export const STORES = ['foods', 'recipes', 'entries'];

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        const s = db.createObjectStore(name, { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
        if (name === 'entries') s.createIndex('time', 'time');
      }
      db.createObjectStore('meta'); // simple key/value settings
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result;
        Promise.resolve(fn(t.objectStore(store), t)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const req2p = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

/** All live (not deleted) records in a store. */
export async function all(store) {
  const rows = await tx(store, 'readonly', (s) => req2p(s.getAll()));
  return rows.filter((r) => !r.deleted);
}

/** Every record, deleted ones included. */
export async function rawAll(store) {
  return tx(store, 'readonly', (s) => req2p(s.getAll()));
}

export async function get(store, id) {
  const r = await tx(store, 'readonly', (s) => req2p(s.get(id)));
  return r && !r.deleted ? r : undefined;
}

/** Create or update. Returns the saved record. */
export async function put(store, record) {
  const now = Date.now();
  const rec = {
    ...record,
    id: record.id || newId(),
    createdAt: record.createdAt || now,
    updatedAt: now,
    deleted: false,
  };
  await tx(store, 'readwrite', (s) => s.put(rec));
  return rec;
}

/** Soft delete: keeps a tombstone so the delete can sync later. */
export async function remove(store, id) {
  await tx(store, 'readwrite', async (s) => {
    const r = await req2p(s.get(id));
    if (r) s.put({ ...r, deleted: true, updatedAt: Date.now() });
  });
}

/** Entries in a time range [from, to), newest first. */
export async function entriesBetween(from, to) {
  const rows = await tx('entries', 'readonly', (s) =>
    req2p(s.index('time').getAll(IDBKeyRange.bound(from, to, false, true)))
  );
  return rows.filter((r) => !r.deleted).sort((a, b) => b.time - a.time);
}

/** Every record (deleted ones included) changed after `since`. For sync. */
export async function changesSince(since = 0) {
  const out = {};
  for (const store of STORES) {
    out[store] = await tx(store, 'readonly', (s) =>
      req2p(s.index('updatedAt').getAll(IDBKeyRange.lowerBound(since, true)))
    );
  }
  return out;
}

/**
 * Merge records from elsewhere (a backup file now, the NAS later).
 * Newest `updatedAt` wins per id. Returns how many records changed.
 */
export async function merge(data) {
  let changed = 0;
  for (const store of STORES) {
    const incoming = Array.isArray(data[store]) ? data[store] : [];
    await tx(store, 'readwrite', async (s) => {
      for (const rec of incoming) {
        if (!rec || !rec.id || typeof rec.updatedAt !== 'number') continue;
        const existing = await req2p(s.get(rec.id));
        if (!existing || existing.updatedAt < rec.updatedAt) {
          s.put(rec);
          changed++;
        }
      }
    });
  }
  return changed;
}

export async function getMeta(key) {
  return tx('meta', 'readonly', (s) => req2p(s.get(key)));
}

export async function setMeta(key, value) {
  return tx('meta', 'readwrite', (s) => s.put(value, key));
}

/** Writes records as-is (keeps their ids/timestamps). Used for seeding. */
export async function putRaw(store, records) {
  await tx(store, 'readwrite', (s) => records.forEach((r) => s.put(r)));
}
