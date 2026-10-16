'use strict';
/*
 * Harnais Spike A - worker dédié (doc 08).
 * Mesure les primitives OPFS (FileSystemSyncAccessHandle) et IndexedDB
 * sur le même jeu de données : 10 000 documents de 1024 octets fixes.
 * Aucun import, worker classic : compatible Chrome / Firefox / Safari / WebView2.
 *
 * Protocole de messages :
 *   entrée  : { id, cmd: 'features'|'estimate'|'prepare'|'reset'|'run', args }
 *   sortie  : { id, ok, payload } | { id, ok: false, error } | { type: 'log', text }
 */

const RECORD_SIZE = 1024;           // octets par document (JSON paddé)
const BASE_DOCS = 10000;            // documents préparés
const INSERT_COUNT = 500;           // insertion par lots (doc 08)
const READ_COUNT = 1000;            // lectures par id
const UPDATE_COUNT = 500;           // mises à jour ciblées
const QUERY_COUNT = 20;             // requêtes simples (balayage + filtre, sans index)
const SEA_SEED = 42;                // graine commune : mêmes ids/requêtes sur les deux backends

const PALETTE = ['#2F6FEB', '#1F883D', '#D29922', '#CF222E', '#8250DF', '#0550AE', '#953800', '#6E7781'];
const TYPES = ['frame', 'text', 'input', 'button'];

/* ---------- utilitaires ---------- */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// PRNG déterministe (mulberry32) : rejouable entre backends et entre runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDoc(i) {
  return {
    docId: i,
    type: TYPES[i % TYPES.length],
    name: 'Noeud ' + i,
    fill: PALETTE[i % PALETTE.length],
    size: 8 + (i % 5) * 4,
    x: i % 1000,
    y: (i * 7) % 1000,
    text: 'Texte du noeud ' + i + ' ' + 'charge utile du formulaire '.repeat(14),
  };
}

// Sérialise un document en exactement RECORD_SIZE octets (padding espaces, JSON toujours valide).
function encodeRecord(doc) {
  let bytes = encoder.encode(JSON.stringify(doc));
  if (bytes.length > RECORD_SIZE) {
    // Réduire le texte jusqu'à tenir (JSON valide conservé).
    let copy = { ...doc };
    while (bytes.length > RECORD_SIZE) {
      copy.text = copy.text.slice(0, Math.max(0, copy.text.length - 32));
      bytes = encoder.encode(JSON.stringify(copy));
    }
    doc = copy;
  }
  const buf = new Uint8Array(RECORD_SIZE);
  buf.fill(0x20);
  buf.set(bytes);
  return buf;
}

function decodeRecord(u8, length) {
  return JSON.parse(decoder.decode(u8.subarray(0, Math.min(length || RECORD_SIZE, RECORD_SIZE))).trim());
}

function stats(durations) {
  const s = [...durations].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { min: s[0], p50: q(0.5), p95: q(0.95), max: s[s.length - 1], total: s.reduce((a, b) => a + b, 0) };
}

const log = (text) => self.postMessage({ type: 'log', text });

/* ---------- jeu de mesures commun ---------- */

function sharedPlan() {
  const rnd = mulberry32(SEA_SEED);
  const totalDocs = BASE_DOCS + INSERT_COUNT;
  const readIds = Array.from({ length: READ_COUNT }, () => Math.floor(rnd() * totalDocs));
  const updateIds = Array.from({ length: UPDATE_COUNT }, () => Math.floor(rnd() * totalDocs));
  const queryColors = Array.from({ length: QUERY_COUNT }, (_, i) => PALETTE[(i * 3) % PALETTE.length]);
  return { readIds, updateIds, queryColors };
}

/* ---------- backend OPFS ---------- */

const Opfs = {
  name: 'opfs',
  FILE: 'spike-a.bin',
  handle: null,

  available() {
    try {
      return typeof FileSystemFileHandle !== 'undefined'
        && typeof FileSystemFileHandle.prototype.createSyncAccessHandle === 'function'
        && typeof navigator.storage !== 'undefined'
        && typeof navigator.storage.getDirectory === 'function';
    } catch { return false; }
  },

  // Élection du worker unique (doc 03) : verrou exclusif le temps d'une opération.
  // Sans Web Locks, on exécute quand même : la collision de handle sert d'observation.
  async withLock(fn) {
    if (navigator.locks && navigator.locks.request) {
      return navigator.locks.request('yidik-spike-a-opfs', { mode: 'exclusive' }, fn);
    }
    return fn();
  },

  async open() {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(this.FILE, { create: true });
    this.handle = await fileHandle.createSyncAccessHandle();
    return this.handle;
  },

  close() {
    if (this.handle) { try { this.handle.close(); } catch { /* déjà fermé */ } this.handle = null; }
  },

  async reset() {
    this.close();
    const root = await navigator.storage.getDirectory();
    try { await root.removeEntry(this.FILE); } catch { /* absent : rien à faire */ }
  },

  async prepare() {
    this.close();
    await this.open();
    const batchDocs = 1000;
    const buf = new Uint8Array(RECORD_SIZE * batchDocs);
    for (let start = 0; start < BASE_DOCS; start += batchDocs) {
      for (let j = 0; j < batchDocs; j++) {
        const rec = encodeRecord(makeDoc(start + j));
        buf.set(rec, j * RECORD_SIZE);
      }
      this.handle.write(buf, { at: start * RECORD_SIZE });
      await tick();
    }
    this.handle.truncate(BASE_DOCS * RECORD_SIZE);
    this.handle.flush();
    const sizeBytes = this.handle.getSize();
    this.close();
    return { docs: BASE_DOCS, sizeBytes };
  },

  // Démarrage à froid : ouverture complète + première lecture (doc 08).
  async coldStart() {
    this.close();
    const t0 = performance.now();
    await this.open();
    const sizeBytes = this.handle.getSize();
    const buf = new Uint8Array(RECORD_SIZE);
    this.handle.read(buf, { at: 0 });
    const ms = performance.now() - t0;
    return { ms, sizeBytes };
  },

  // Insertion par lots de 500 : une écriture contiguë de 512 Ko sur une zone réservée.
  async insertBatch() {
    const buf = new Uint8Array(RECORD_SIZE * INSERT_COUNT);
    for (let j = 0; j < INSERT_COUNT; j++) {
      buf.set(encodeRecord(makeDoc(BASE_DOCS + j)), j * RECORD_SIZE);
    }
    const t0 = performance.now();
    this.handle.write(buf, { at: BASE_DOCS * RECORD_SIZE });
    this.handle.flush();
    const ms = performance.now() - t0;
    return { count: INSERT_COUNT, ms, bytes: buf.length };
  },

  async pointReads(ids) {
    const durations = [];
    const buf = new Uint8Array(RECORD_SIZE);
    for (const id of ids) {
      const t0 = performance.now();
      const n = this.handle.read(buf, { at: id * RECORD_SIZE });
      decodeRecord(buf, n);
      durations.push(performance.now() - t0);
    }
    return { count: ids.length, ...stats(durations) };
  },

  async updates(ids) {
    const durations = [];
    const buf = new Uint8Array(RECORD_SIZE);
    for (const id of ids) {
      const t0 = performance.now();
      const n = this.handle.read(buf, { at: id * RECORD_SIZE });
      const doc = decodeRecord(buf, n);
      doc.size = (doc.size + 4) % 64;
      if (doc.size === 0) doc.size = 4;
      const rec = encodeRecord(doc);
      this.handle.write(rec, { at: id * RECORD_SIZE });
      durations.push(performance.now() - t0);
    }
    this.handle.flush();
    return { count: ids.length, ...stats(durations) };
  },

  // Requête simple sans index : balayage complet + filtre sur un attribut.
  async queries(colors) {
    const durations = [];
    const counts = [];
    const chunk = 256 * RECORD_SIZE;
    const buf = new Uint8Array(chunk);
    for (const color of colors) {
      const t0 = performance.now();
      let count = 0;
      let at = 0;
      const total = this.handle.getSize();
      while (at < total) {
        const n = this.handle.read(buf, { at });
        if (n <= 0) break;
        for (let off = 0; off + RECORD_SIZE <= n; off += RECORD_SIZE) {
          const doc = decodeRecord(buf.subarray(off, off + RECORD_SIZE), RECORD_SIZE);
          if (doc.fill === color) count++;
        }
        at += n;
      }
      durations.push(performance.now() - t0);
      counts.push(count);
    }
    return { count: colors.length, resultCounts: counts, ...stats(durations) };
  },

  async scan() {
    const chunk = 1024 * 1024;
    const buf = new Uint8Array(chunk);
    const t0 = performance.now();
    let at = 0, bytes = 0;
    const total = this.handle.getSize();
    while (at < total) {
      const n = this.handle.read(buf, { at });
      if (n <= 0) break;
      bytes += n;
      at += n;
    }
    const ms = performance.now() - t0;
    return { bytes, ms, mbPerSec: bytes / 1048576 / (ms / 1000), records: Math.floor(bytes / RECORD_SIZE) };
  },

  async size() {
    const fileSize = this.handle ? this.handle.getSize() : null;
    return { fileSize };
  },
};

/* ---------- backend IndexedDB ---------- */

const Idb = {
  name: 'idb',
  DB: 'spike-a-idb',
  STORE: 'docs',
  db: null,

  available() {
    return typeof indexedDB !== 'undefined';
  },

  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: 'docId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },

  close() {
    if (this.db) { this.db.close(); this.db = null; }
  },

  async reset() {
    this.close();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(this.DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  },

  txn(mode) {
    return this.db.transaction(this.STORE, mode).objectStore(this.STORE);
  },

  reqAsPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async prepare() {
    await this.open();
    const chunk = 1000;
    for (let start = 0; start < BASE_DOCS; start += chunk) {
      const store = this.txn('readwrite');
      for (let j = 0; j < chunk; j++) store.put(makeDoc(start + j));
      await new Promise((resolve, reject) => {
        store.transaction.oncomplete = resolve;
        store.transaction.onerror = () => reject(store.transaction.error);
      });
      await tick();
    }
    return { docs: BASE_DOCS, sizeBytes: null };
  },

  async coldStart() {
    this.close();
    const t0 = performance.now();
    await this.open();
    const store = this.txn('readonly');
    await this.reqAsPromise(store.get(0));
    const ms = performance.now() - t0;
    return { ms, sizeBytes: null };
  },

  async insertBatch() {
    const t0 = performance.now();
    const store = this.txn('readwrite');
    for (let j = 0; j < INSERT_COUNT; j++) store.put(makeDoc(BASE_DOCS + j));
    await new Promise((resolve, reject) => {
      store.transaction.oncomplete = resolve;
      store.transaction.onerror = () => reject(store.transaction.error);
    });
    return { count: INSERT_COUNT, ms: performance.now() - t0, bytes: RECORD_SIZE * INSERT_COUNT };
  },

  async pointReads(ids) {
    const durations = [];
    for (const id of ids) {
      const t0 = performance.now();
      const store = this.txn('readonly');
      await this.reqAsPromise(store.get(id));
      durations.push(performance.now() - t0);
    }
    return { count: ids.length, ...stats(durations) };
  },

  async updates(ids) {
    const durations = [];
    for (const id of ids) {
      const t0 = performance.now();
      const store = this.txn('readwrite');
      const doc = await this.reqAsPromise(store.get(id));
      if (doc) {
        doc.size = (doc.size + 4) % 64;
        if (doc.size === 0) doc.size = 4;
        store.put(doc);
      }
      await new Promise((resolve, reject) => {
        store.transaction.oncomplete = resolve;
        store.transaction.onerror = () => reject(store.transaction.error);
      });
      durations.push(performance.now() - t0);
    }
    return { count: ids.length, ...stats(durations) };
  },

  async queries(colors) {
    const durations = [];
    const counts = [];
    for (const color of colors) {
      const t0 = performance.now();
      let count = 0;
      const store = this.txn('readonly');
      const cursorReq = store.openCursor();
      await new Promise((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) { resolve(); return; }
          if (cursor.value && cursor.value.fill === color) count++;
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      durations.push(performance.now() - t0);
      counts.push(count);
    }
    return { count: colors.length, resultCounts: counts, ...stats(durations) };
  },

  async scan() {
    const t0 = performance.now();
    let records = 0;
    const store = this.txn('readonly');
    const cursorReq = store.openCursor();
    await new Promise((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(); return; }
        records++;
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    const ms = performance.now() - t0;
    return { bytes: null, ms, mbPerSec: null, records };
  },

  async size() {
    return { fileSize: null };
  },
};

/* ---------- orchestration ---------- */

const BACKENDS = { opfs: Opfs, idb: Idb };

const tick = () => new Promise((r) => setTimeout(r, 0));

async function estimate() {
  if (!(navigator.storage && navigator.storage.estimate)) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage, quota: e.quota };
}

async function runBackend(name) {
  const backend = BACKENDS[name];
  if (!backend || !backend.available()) throw new Error('Backend indisponible sur ce navigateur : ' + name);
  const plan = sharedPlan();
  const result = { backend: name, ops: {} };

  const runOp = async (label, fn) => {
    log(`[${name}] ${label}…`);
    const payload = await fn();
    result.ops[label] = payload;
    log(`[${name}] ${label} : terminé`);
    return payload;
  };

  await runOp('coldStart', () => backend.coldStart());
  await runOp('insertBatch500', () => backend.insertBatch());
  await runOp('pointReads1000', () => backend.pointReads(plan.readIds));
  await runOp('updates500', () => backend.updates(plan.updateIds));
  await runOp('queries20', () => backend.queries(plan.queryColors));
  await runOp('scan', () => backend.scan());
  await runOp('size', () => backend.size());

  backend.close && backend.close();
  result.estimate = await estimate();
  return result;
}

self.onmessage = async (ev) => {
  const { id, cmd, args } = ev.data || {};
  try {
    let payload;
    switch (cmd) {
      case 'features': {
        payload = {
          opfs: Opfs.available(),
          indexedDB: Idb.available(),
          webLocks: !!(navigator.locks && navigator.locks.request),
          storageEstimate: !!(navigator.storage && navigator.storage.estimate),
          origin: self.location.origin,
        };
        break;
      }
      case 'estimate':
        payload = await estimate();
        break;
      case 'prepare': {
        const before = await estimate();
        payload = await Opfs.withLock(() => BACKENDS[args.backend].prepare());
        payload.estimateBefore = before;
        payload.estimateAfter = await estimate();
        break;
      }
      case 'reset':
        await BACKENDS[args.backend].reset();
        payload = { done: true };
        break;
      case 'run': {
        const run = () => runBackend(args.backend);
        payload = args.backend === 'opfs' ? await Opfs.withLock(run) : await run();
        break;
      }
      default:
        throw new Error('Commande inconnue : ' + cmd);
    }
    self.postMessage({ id, ok: true, payload });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
