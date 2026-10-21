/* Child-Safer Spaces · browser storage · version 4.0
 *
 * Planning work is kept in the browser's own database (IndexedDB). If a
 * browser does not allow that (some private windows, some browsers opening
 * local files), it falls back to localStorage, and if that is blocked too,
 * the workspace keeps work in memory and asks you to export a backup.
 *
 *   Fallback ladder:  IndexedDB  →  localStorage  →  memory only (export to keep)
 *
 * core.js expects a small synchronous store (getItem, setItem, removeItem,
 * keys). This file provides exactly that: everything is read into memory once
 * at start-up, and each change is written to the database in the background.
 * The workspace shows "Saved" only after the database confirms the write
 * (durability "strict" where the browser supports it).
 *
 * Safety rules
 *   - Keys written by versions 1 to 3 in localStorage are read (for migration)
 *     and never changed, unless you delete them yourself under "Your data".
 *   - Before a guarded key (the workspace itself) is overwritten, the stored
 *     value is compared with the value this tab last read or wrote. If another
 *     tab or window changed it, the write is refused and onConflict is called,
 *     so one tab can never silently overwrite another tab's work.
 *   - Nothing here touches the network.
 *
 * To extend: add a new key with the "child-safer-spaces" prefix and use
 * store.setItem; it is then listed, exported and erased like the others.
 */
(function (root) {
'use strict';
const DB_NAME = 'child-safer-spaces', DB_VERSION = 1, OS = 'kv', PREFIX = 'child-safer-spaces';
const MARKER = 'child-safer-spaces-v4-db'; // localStorage: date this browser first saved to the database

function conflictError(key) { const e = new Error('Another tab or window changed "' + key + '".'); e.name = 'ConflictError'; return e; }
function withTimeout(p, ms, what) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(what + ' did not respond.'), { name: 'TimeoutError' })), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
function openDB(idb) {
  return withTimeout(new Promise((resolve, reject) => {
    let req;
    try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(OS)) db.createObjectStore(OS); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('The browser database could not be opened.'));
    req.onblocked = () => reject(Object.assign(new Error('The browser database is blocked by another open copy of an older version.'), { name: 'BlockedError' }));
  }), 4000, 'The browser database');
}
function readAll(db) {
  return new Promise((resolve, reject) => {
    const out = new Map(), tx = db.transaction(OS, 'readonly'), cur = tx.objectStore(OS).openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { if (typeof c.key === 'string' && typeof c.value === 'string') out.set(c.key, c.value); c.continue(); } };
    tx.oncomplete = () => resolve(out);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Reading the browser database failed.'));
  });
}
function safeLS(ls) {
  // Returns a localStorage-like object or null if access throws (blocked by policy).
  try { if (!ls) return null; ls.getItem('__probe__'); return ls; } catch (e) { return null; }
}
function lsKeys(ls) { try { const k = []; for (let i = 0; i < ls.length; i++) k.push(ls.key(i)); return k.filter(x => x && x.startsWith(PREFIX)); } catch (e) { return []; } }

/* Create the store. opts:
 *   guard: keys that need the cross-tab check (normally the workspace key)
 *   legacy: localStorage keys from earlier versions that may be read
 *   onConflict(key), onWriteError(error), onWriteOk()
 *   env: { indexedDB, localStorage } for tests (defaults to the browser's) */
async function createStore(opts = {}) {
  const env = opts.env || root, guard = new Set(opts.guard || []), legacy = new Set(opts.legacy || []);
  const noop = () => {}, onConflict = opts.onConflict || noop, onWriteError = opts.onWriteError || noop, onWriteOk = opts.onWriteOk || noop;
  let lsRaw = null;
  try { lsRaw = env.localStorage; } catch (e) { lsRaw = null; } // the property itself can throw when storage is blocked
  const ls = safeLS(lsRaw);
  let db = null, engine = 'memory', reason = '';
  if (env.indexedDB) {
    try { db = await openDB(env.indexedDB); engine = 'indexeddb'; }
    catch (e) { reason = (e && e.name ? e.name + ': ' : '') + (e && e.message || 'unavailable'); }
  } else reason = 'This browser offers no database here.';
  if (!db && ls) engine = 'localstorage';
  const mem = db ? await readAll(db).catch(e => { reason = e.message; db = null; engine = ls ? 'localstorage' : 'memory'; return new Map(); }) : new Map();
  const known = new Map(); // guarded key -> value as last read or written by this tab (undefined = absent)
  const pending = new Map(); // key -> value string, or null for delete
  let writing = false, conflicted = false, idleWaiters = [];
  if (db) db.onversionchange = () => db.close(); // a newer version elsewhere needs the database; writes then report an error

  const settle = err => { const w = idleWaiters; idleWaiters = []; w.forEach(f => f(err)); };
  function lsGet(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }

  /* Write everything queued in one transaction. Guarded keys are read first
   * and compared with what this tab last saw; a difference aborts the whole
   * transaction and reports a conflict instead of overwriting. */
  function pump() {
    if (writing) return;
    if (!pending.size) { settle(null); return; }
    const batch = new Map(pending); pending.clear(); writing = true;
    let tx, conflictKey = null, writeErr = null, done = false;
    const finish = (err, isConflict) => {
      if (done) return; done = true; writing = false;
      if (isConflict) { conflicted = true; onConflict(conflictKey); settle(conflictError(conflictKey)); return; }
      if (err) { for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v); onWriteError(err); settle(err); return; }
      for (const [k, v] of batch) if (guard.has(k)) known.set(k, v === null ? undefined : v);
      if ([...batch.values()].some(v => v !== null)) markUsed(); // deletes alone (erasing) never leave a marker behind
      onWriteOk(); pump();
    };
    try { tx = db.transaction(OS, 'readwrite', { durability: 'strict' }); }
    catch (e) { try { tx = db.transaction(OS, 'readwrite'); } catch (e2) { finish(e2); return; } }
    const os = tx.objectStore(OS);
    tx.oncomplete = () => finish(null);
    tx.onabort = () => finish(conflictKey ? null : (writeErr || tx.error || new Error('The browser did not save the change.')), !!conflictKey);
    for (const [k, v] of batch) {
      const write = () => { try { if (v === null) os.delete(k); else os.put(v, k); } catch (e) { writeErr = e; try { tx.abort(); } catch (_) { /* aborting */ } } };
      if (guard.has(k)) {
        const r = os.get(k);
        r.onsuccess = () => {
          if (conflictKey || writeErr) return;
          if (r.result !== known.get(k)) { conflictKey = k; try { tx.abort(); } catch (_) { /* aborting */ } return; }
          write();
        };
      } else write();
    }
  }
  function markUsed() { if (!lsGet(MARKER) && ls) { try { ls.setItem(MARKER, new Date().toISOString()); } catch (e) { /* preference only */ } } }

  const store = {
    engine, reason,
    /* Synchronous reads. In database mode, a key that is not in the database
     * falls back to a localStorage copy written by an earlier version. */
    getItem(k) {
      if (engine === 'memory') throw Object.assign(new Error('Browser storage is unavailable.'), { name: 'SecurityError' });
      let v;
      if (engine === 'indexeddb') v = mem.has(k) ? mem.get(k) : (legacy.has(k) || k.startsWith(PREFIX) ? lsGet(k) : null);
      else v = lsGet(k);
      if (guard.has(k) && !known.has(k)) known.set(k, engine === 'indexeddb' ? (mem.has(k) ? mem.get(k) : undefined) : (v === null ? undefined : v));
      return v === undefined ? null : v;
    },
    setItem(k, v) {
      v = String(v);
      if (conflicted && guard.has(k)) throw conflictError(k);
      if (engine === 'memory') throw Object.assign(new Error('Browser storage is unavailable.'), { name: 'SecurityError' });
      if (engine === 'localstorage') {
        if (guard.has(k)) { const cur = lsGet(k); const was = known.has(k) ? known.get(k) : (cur === null ? undefined : cur); if ((cur === null ? undefined : cur) !== was) { conflicted = true; onConflict(k); throw conflictError(k); } }
        ls.setItem(k, v); // may throw QuotaExceededError; core.persist reports it
        if (guard.has(k)) known.set(k, v);
        return;
      }
      mem.set(k, v); pending.set(k, v); pump();
    },
    removeItem(k) {
      // In the database, "known" changes only when the delete commits (see pump), so the cross-tab check stays exact.
      if (engine === 'indexeddb') { if (mem.has(k)) { mem.delete(k); pending.set(k, null); pump(); } }
      if (ls) { try { ls.removeItem(k); } catch (e) { /* ignore */ } }
      if (guard.has(k) && engine === 'localstorage') known.set(k, undefined);
    },
    keys() { return [...new Set([...mem.keys(), ...(ls ? lsKeys(ls) : [])])]; },
    /* Where each item lives, for the "Your data" view. */
    list() {
      const rows = [];
      if (engine === 'indexeddb') for (const [k, v] of mem) rows.push({ key: k, where: 'database', size: v.length });
      if (ls) for (const k of lsKeys(ls)) { const v = lsGet(k) || ''; rows.push({ key: k, where: 'browser storage', size: v.length }); }
      return rows.sort((a, b) => a.key.localeCompare(b.key) || a.where.localeCompare(b.where));
    },
    /* Read the copy kept in one particular place (database or browser storage). */
    readFrom(k, where) { return where === 'database' ? (mem.has(k) ? mem.get(k) : null) : lsGet(k); },
    removeFrom(k, where) {
      if (where === 'database') { if (mem.has(k)) { mem.delete(k); pending.set(k, null); pump(); } }
      else if (ls) { try { ls.removeItem(k); } catch (e) { /* ignore */ } if (guard.has(k) && engine === 'localstorage') known.set(k, undefined); }
    },
    busy() { return writing || pending.size > 0; },
    /* Resolves when every queued write is confirmed; rejects with the error otherwise. */
    flush() { if (engine !== 'indexeddb' || !store.busy()) return Promise.resolve(); return new Promise((res, rej) => { idleWaiters.push(err => err ? rej(err) : res()); pump(); }); },
    conflicted() { return conflicted; },
    usedBefore() { return lsGet(MARKER); },
    hasInDatabase(k) { return engine === 'indexeddb' && mem.has(k); }
  };
  return store;
}

const api = { createStore, DB_NAME, OS, MARKER };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CSSStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
