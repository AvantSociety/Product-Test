// ==========================================
// MATTER PERSISTENCE (IndexedDB)
// ==========================================
//
// Document contents are far too large for localStorage, so the working matter
// is held in IndexedDB and restored on load. Without this, a page refresh
// destroys an afternoon of ingest and annotation.

const DB_NAME = 'discovery-framework';
const STORE = 'matter';
const KEY = 'current';
// Search vectors for the matter's passages, one record per document keyed by
// its content hash. Kept out of the matter record, which is rewritten on every
// edit, and cleared with it.
export const EMBEDDINGS_STORE = 'embeddings';
const VERSION = 2;

export function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(EMBEDDINGS_STORE)) db.createObjectStore(EMBEDDINGS_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading the database must not be blocked by this one.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Could not open matter storage'));
  });
}

export async function saveMatter(state) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    // Private browsing and blocked site data both land here. The app keeps
    // working in memory; only persistence is lost.
    return false;
  }
}

export async function loadMatter() {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value || null;
  } catch {
    return null;
  }
}

/** Erases the matter and every search vector derived from it. */
export async function clearMatter() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE, EMBEDDINGS_STORE], 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.objectStore(EMBEDDINGS_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Stored search vectors for the given document hashes, as a Map. */
export async function loadEmbeddings(hashes) {
  const db = await openDb();
  const found = new Map();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(EMBEDDINGS_STORE, 'readonly');
    const store = tx.objectStore(EMBEDDINGS_STORE);
    hashes.forEach(hash => {
      const req = store.get(hash);
      req.onsuccess = () => { if (req.result) found.set(hash, req.result); };
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return found;
}

export async function saveEmbeddings(records) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(EMBEDDINGS_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_STORE);
    records.forEach(r => store.put(r, r.hash));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Deletes stored vectors for documents no longer in the production set, so a
 * document withheld after indexing does not stay searchable in storage.
 */
export async function pruneEmbeddings(keepHashes) {
  const keep = new Set(keepHashes);
  const db = await openDb();
  let removed = 0;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(EMBEDDINGS_STORE, 'readwrite');
    const req = tx.objectStore(EMBEDDINGS_STORE).openKeyCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (!keep.has(cursor.key)) { cursor.source.delete(cursor.key); removed += 1; }
      cursor.continue();
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return removed;
}
