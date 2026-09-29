// ==========================================
// AUDIT LOG HASH CHAIN
// ==========================================
//
// Each entry stores a SHA-256 hash of its own content together with the
// previous entry's hash. Changing, removing or reordering any stored entry
// changes that hash, which no longer matches the next entry's link, so the
// alteration is detectable by recomputing the chain.
//
// Hashing is synchronous so entries are chained inside the state updater that
// appends them, in the order they happen. Web Crypto's digest is async only.

export const GENESIS_HASH = '0'.repeat(64);

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a string (UTF-8), as lowercase hex. */
export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 9) + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, x => x.toString(16).padStart(8, '0')).join('');
}

/** The exact content an entry's hash covers, including the link backwards. */
function entryContent(entry) {
  return JSON.stringify([entry.seq, entry.ts, entry.actor, entry.action, entry.target || '', entry.prevHash]);
}

/** Returns a new log with the entry appended and chained to the last one. */
export function chainEntry(log, { ts, actor, action, target }) {
  const last = log[log.length - 1];
  const entry = {
    seq: log.length + 1,
    ts,
    actor,
    action,
    target: target || '',
    prevHash: last?.hash || GENESIS_HASH,
  };
  entry.hash = sha256Hex(entryContent(entry));
  return [...log, entry];
}

/**
 * Recomputes the chain. Returns { intact: true } or the 1-based number of the
 * first entry whose content or link does not match.
 */
export function verifyChain(log) {
  let prev = GENESIS_HASH;
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry.seq !== i + 1 || entry.prevHash !== prev || entry.hash !== sha256Hex(entryContent(entry))) {
      return { intact: false, brokenAt: i + 1 };
    }
    prev = entry.hash;
  }
  return { intact: true, head: prev };
}

/**
 * Chains a log saved before hashing existed. The earlier entries could have
 * been changed before this point, so a marker entry records that the chain
 * starts here rather than implying they were protected all along.
 */
export function chainLegacyLog(log) {
  if (log.length === 0 || log.every(e => e.hash)) return log;
  let chained = [];
  log.forEach(e => {
    chained = chainEntry(chained, { ts: e.ts, actor: e.actor, action: e.action, target: e.target });
  });
  return chainEntry(chained, {
    ts: new Date().toISOString(),
    actor: 'System',
    action: 'Hash chain applied to entries recorded before chaining',
    target: `${log.length} earlier entr${log.length === 1 ? 'y' : 'ies'}`,
  });
}
