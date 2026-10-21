/* Child-Safer Spaces · core logic · version 4.0 (global edition)
 *
 * Pure functions shared by the workspace (app.js), the build script and the
 * automated tests. Nothing here touches the network. Browser storage is only
 * reached through the small storage object passed in by the caller, so the
 * same code can be tested with a fake storage.
 *
 * Sections
 *   1. Small helpers (escaping, hashing, cloning)
 *   2. Safe Markdown rendering for documents and drafts
 *   3. CSV export/import with spreadsheet-formula protection
 *   4. Non-sensitive data check (warns about personal/sensitive text)
 *   5. Planning state: blank state, validation, migration of v1/v2 data
 *   6. Storage loading with quarantine (never overwrite unreadable data)
 *   7. Tasks and decision gates (sequential, explicit reopening)
 *   8. Cost scenarios (NPV, withdrawal, uncertainty ranges)
 *   9. Evaluation planning (rare events, exposure needed)
 *  10. Document helpers (line diff, search snippets)
 *  11. Version 4 helpers: starting point, source freshness, whole-workspace
 *      personal-data check, display settings
 *
 * To extend: add a function in the relevant section and export it in `api`
 * at the bottom. Keep functions pure (no DOM, no globals) so they stay testable.
 */
(function (root) {
'use strict';

/* ---------- 1. Small helpers ---------- */
const APP_VERSION = '4.0';
const STATE_SCHEMA = 3;
const KEYS = { v3: 'child-safer-spaces-v3', v2: 'child-safer-spaces-v2', v1: 'child-safer-spaces-v1',
  undo: 'child-safer-spaces-v3-undo', recoveryPrefix: 'child-safer-spaces-v3-unreadable-' };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
const clone = x => JSON.parse(JSON.stringify(x));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isoNow = () => new Date().toISOString();

/* cyrb53: fast non-cryptographic 53-bit string hash. Used only to notice that
 * an original document changed after a draft was started (not for security). */
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/* ---------- 2. Safe Markdown ----------
 * Supports: # / ## / ### headings, paragraphs, "- " and "1. " lists, pipe
 * tables, **bold**, and [S12]-style source references. Every piece of text is
 * HTML-escaped BEFORE any markup is added, so drafts cannot inject HTML. */
function inline(s, sources) {
  return esc(s)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(S\d+)\]/g, (m, id) => {
      const src = (sources || []).find(x => x.id === id);
      return src ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(src.title) + '">' + m + '</a>' : m;
    });
}
function markdown(text, sources = [], opts = {}) {
  // opts.label (e.g. "Document 04") makes each scrollable table region's name unique on a page.
  const lines = String(text).split(/\r?\n/);
  let h = '', list = '', tables = 0;
  const close = () => { if (list) { h += '</' + list + '>'; list = ''; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('|')) {
      close();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
        if (cells.length && !cells.every(c => /^[- :]+$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      if (rows.length) h += '<div class="tablewrap" tabindex="0" role="region" aria-label="' + esc((opts.label ? opts.label + ', ' : '') + 'table ' + (++tables) + ': ' + rows[0].slice(0, 2).join(', ')) + '"><table><thead><tr>' + rows[0].map(c => '<th scope="col">' + inline(c, sources) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inline(c, sources) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    // "#" and "##" both render as <h2> because the page or handbook section
    // already provides the single <h1>; "###" -> <h3>, "####" -> <h4>.
    const heading = l.match(/^(#{1,4}) (.+)/);
    if (heading) { close(); const level = Math.max(2, Math.min(heading[1].length, 4)); h += '<h' + level + '>' + inline(heading[2], sources) + '</h' + level + '>'; continue; }
    const item = l.match(/^(- |\d+\. )(.+)/);
    if (item) {
      const kind = item[1] === '- ' ? 'ul' : 'ol';
      if (list !== kind) { close(); list = kind; h += '<' + kind + '>'; }
      h += '<li>' + inline(item[2], sources) + '</li>';
      continue;
    }
    close();
    if (l.trim()) h += '<p>' + inline(l, sources) + '</p>';
  }
  close();
  return h;
}

/* ---------- 3. CSV ----------
 * Export: every cell is quoted; text that a spreadsheet could run as a formula
 * gets a leading apostrophe (OWASP CSV-injection guidance: = + - @, tab, CR,
 * plus full-width look-alikes). Import: strict RFC 4180 parsing, exact header
 * match, comma/semicolon/tab detection, and removal of our own apostrophe so
 * repeated export/import cycles do not change the data. */
const FORMULA_START = /^[\t\r\n]|^[\s ]*[=+\-@＝＋－＠]/;
function csvCell(v) {
  let s = String(v ?? '');
  if (typeof v !== 'number' && FORMULA_START.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function csv(headers, rows) { return '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
function unneutralize(cell) { return /^'(?:[\t\r\n]|[\s ]*[=+\-@＝＋－＠])/.test(cell) ? cell.slice(1) : cell; }
function parseCSV(text, delimiter = ',', maxRows = 501) {
  if (typeof text !== 'string' || text.length > 5000000) throw Error('CSV must be text under 5 MB.');
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === '"') {
      if (field || closed) throw Error('Unexpected quote inside an unquoted cell (row ' + (rows.length + 1) + ').');
      quoted = true;
    } else if (c === delimiter) { row.push(field); field = ''; closed = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(x => x !== '')) rows.push(row);
      row = []; field = ''; closed = false;
    } else {
      if (closed) throw Error('Unexpected text after a quoted cell (row ' + (rows.length + 1) + ').');
      field += c;
    }
    if (rows.length > maxRows || field.length > 10000) throw Error('Maximum ' + (maxRows - 1) + ' records and 10,000 characters per cell.');
  }
  if (quoted) throw Error('A quoted cell is never closed.');
  if (field || row.length) { row.push(field); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}
function registerImport(text, headers) {
  // Try comma first, then semicolon (common from spreadsheets set to French
  // or other European locales), then tab. Accept only an exact header match.
  let commaError = null, empty = true;
  for (const d of [',', ';', '\t']) {
    let rows;
    try { rows = parseCSV(text, d); } catch (e) { if (d === ',') commaError = e; continue; }
    if (!rows.length) continue;
    empty = false;
    const head = rows[0].map(h => h.trim());
    if (JSON.stringify(head) !== JSON.stringify(headers)) continue;
    const data = rows.slice(1);
    if (data.length > 500) throw Error('A register holds at most 500 planning rows.');
    const bad = data.findIndex(r => r.length !== headers.length);
    if (bad >= 0) throw Error('Row ' + (bad + 2) + ' has ' + data[bad].length + ' cells; this register needs ' + headers.length + '.');
    let restored = 0;
    const clean = data.map(r => r.map(c => { const u = unneutralize(c); if (u !== c) restored++; return u; }));
    return { rows: clean, delimiter: d, restored };
  }
  if (commaError) throw commaError;
  if (empty) throw Error('The file is empty.');
  const first = String(text).replace(/^﻿/, '').split(/\r?\n/)[0] || '';
  const hint = first.includes(';') && !first.includes(',') ? ' The file looks semicolon-separated, but its column names still differ from this register.' : '';
  throw Error('Column names must exactly match this register (' + headers.length + ' columns, starting "' + headers.slice(0, 3).join(', ') + '"). Download the blank template to compare.' + hint);
}

/* ---------- 4. Non-sensitive data check ----------
 * A basic pattern check, NOT a privacy review. It flags text that looks like
 * contact details, identity numbers, ages, injury/health details, claims or
 * CCTV references so people can move them to protected systems. "record" mode
 * (registers, tasks, gates) is stricter than "document" mode, because the
 * original documents legitimately discuss words such as "medical" or "CCTV". */
const SENSITIVE = [
  { type: 'email', label: 'an email address', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, modes: ['record', 'document'] },
  { type: 'phone', label: 'a phone number', re: /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, modes: ['record', 'document'] },
  { type: 'idnumber', label: 'an identity-style number (SSN/SIN pattern)', re: /\b\d{3}-\d{2}-\d{4}\b|\b\d{3}[ -]\d{3}[ -]\d{3}\b/, modes: ['record', 'document'] },
  { type: 'birth', label: 'a date-of-birth cue', re: /\b(?:DOB|D\.O\.B\.|date of birth|birth ?date|born on)\b/i, modes: ['record', 'document'] },
  { type: 'age', label: "a person's age", re: /\b\d{1,2}[- ](?:year|yr|month|mo)s?[- ]old\b|\baged \d{1,2}\b(?![–-]\d)/i, modes: ['record'] },
  { type: 'name', label: 'a personal name with a title', re: /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.? [A-Z][a-z]+/, modes: ['record'] },
  { type: 'claim', label: 'a claim, policy or case number', re: /\b(?:claim|policy|case|file)\s*(?:no\.?|number|#)\s*[:#]?\s*[A-Z0-9][A-Z0-9-]{3,}/i, modes: ['record'] },
  { type: 'health', label: 'injury or health details', re: /\b(?:concussion|fracture[ds]?|laceration|stitches|diagnos\w*|hospitali[sz]ed|ambulance|medical record|x-ray|bleeding|unconscious)\b/i, modes: ['record'] },
  { type: 'cctv', label: 'a CCTV or footage reference', re: /\b(?:cctv|footage|video clip|camera recording)\b/i, modes: ['record'] },
  { type: 'address', label: 'a street address (fine for a business site, never a person’s home)', re: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Crescent|Cres|Court|Ct)\b/, modes: ['record'] }
];
function scanSensitive(text, mode = 'record') {
  const s = String(text || '');
  if (!s.trim()) return [];
  return SENSITIVE.filter(p => p.modes.includes(mode) && p.re.test(s)).map(p => ({ type: p.type, label: p.label }));
}

/* ---------- 5. Planning state ----------
 * Version 3 state. Everything is plain JSON so backups stay readable. */
const defaultCalc = { currency: 'units', initial: 15000, annual: 2000, loss: 20000, reduction: 0, other: 0, otherBasis: '',
  years: 5, discount: 5, escalation: 0, replacementCost: 0, replacementYear: 0, salvage: 0, withdrawYear: 0, removalCost: 0 };
const CALC_NUMERIC = ['initial', 'annual', 'loss', 'reduction', 'other', 'years', 'discount', 'escalation', 'replacementCost', 'replacementYear', 'salvage', 'withdrawYear', 'removalCost'];
const RANGE_KEYS = ['initial', 'annual', 'loss', 'reduction', 'discount'];
const defaultPlanning = { baselineRate: 2, rateRatio: 0.8, alpha: 0.05, power: 0.8, designEffect: 1, exposurePerArm: 100000, observedEvents: 0, observedExposure: 100000 };
const TASK_STATUS = ['open', 'in_progress', 'blocked', 'done', 'not_applicable'];
const LOG_TYPES = ['migration', 'gate-completed', 'gate-reopened', 'gate-amended', 'backup-imported', 'csv-imported', 'row-deleted', 'draft-restored', 'draft-reviewed', 'undo', 'recovery'];

function blankState() {
  return { schema: STATE_SCHEMA, site: '', profile: { country: '', region: '', municipality: '', business: '' }, edits: {}, editMeta: {},
    gates: {}, tasks: {}, records: {}, calc: { ...defaultCalc }, ranges: {}, planning: { ...defaultPlanning }, log: [] };
}
function addLog(x, type, detail) {
  x.log = Array.isArray(x.log) ? x.log : [];
  x.log.push({ at: isoNow(), type, detail: String(detail).slice(0, 500) });
  if (x.log.length > 200) x.log.splice(0, x.log.length - 200);
}
function taskComplete(t) { return !!t && ['done', 'not_applicable'].includes(t.status) && typeof t.evidence === 'string' && !!t.evidence.trim(); }

/* Structural check of cost inputs (types and ranges). The business rules
 * that need a reason (e.g. documented basis for "other savings") are checked
 * when a scenario is calculated, so an unfinished input never blocks loading. */
function checkCalc(c) {
  if (!plain(c) || !isStr(c.currency, 20) || !isStr(c.otherBasis ?? '', 1000)) throw Error('Invalid cost-scenario labels.');
  for (const k of CALC_NUMERIC) if (typeof c[k] !== 'number' || !Number.isFinite(c[k])) throw Error('Cost input "' + k + '" must be a finite number.');
  const extra = Object.keys(c).filter(k => !own(defaultCalc, k));
  if (extra.length) throw Error('Unknown cost inputs: ' + extra.join(', '));
}
function checkPlanning(p) {
  if (!plain(p)) throw Error('Invalid evaluation-planning inputs.');
  for (const k of Object.keys(defaultPlanning)) if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) throw Error('Planning input "' + k + '" must be a finite number.');
  const extra = Object.keys(p).filter(k => !own(defaultPlanning, k));
  if (extra.length) throw Error('Unknown planning inputs: ' + extra.join(', '));
}

/* Validate a version 3 state against the content definitions D. Throws a
 * readable Error on the first problem; returns a deep copy when valid. */
function validate(x, D) {
  if (!plain(x)) throw Error('The planning data is not an object.');
  const allowed = Object.keys(blankState());
  const extra = Object.keys(x).filter(k => !allowed.includes(k));
  if (extra.length) throw Error('Unrecognized fields (' + extra.join(', ') + '). The data may come from a newer version.');
  if (x.schema !== STATE_SCHEMA) throw Error('Unsupported planning-data schema.');
  if (!isStr(x.site, 200)) throw Error('Invalid site code.');
  if (!plain(x.profile) || ['country', 'region', 'municipality', 'business'].some(k => !isStr(x.profile[k], 200)) || Object.keys(x.profile).length !== 4) throw Error('Invalid site profile.');
  const docIds = new Set(D.docs.map(d => d.id)), taskIds = new Set(D.tasks.map(t => t.id)), gateIds = new Set(D.gates.map(g => g.id));
  if (!plain(x.edits) || Object.entries(x.edits).some(([k, v]) => !docIds.has(k) || !isStr(v, 200000))) throw Error('Invalid document drafts.');
  if (!plain(x.editMeta) || Object.entries(x.editMeta).some(([k, v]) => !own(x.edits, k) || !plain(v) || !isStr(v.base, 64) || !isStr(v.savedAt, 40))) throw Error('Invalid draft details.');
  if (!plain(x.tasks) || Object.entries(x.tasks).some(([k, v]) => !taskIds.has(k) || !plain(v) || !TASK_STATUS.includes(v.status) || ['owner', 'due', 'evidence'].some(f => !isStr(v[f], 10000)))) throw Error('Invalid task records.');
  if (!plain(x.records)) throw Error('Invalid registers.');
  for (const [key, rows] of Object.entries(x.records)) {
    if (!own(D.schemas, key) || !Array.isArray(rows) || rows.length > 500 || rows.some(r => !Array.isArray(r) || r.length !== D.schemas[key].length || r.some(v => !isStr(v, 10000)))) throw Error('Invalid register: ' + key);
  }
  if (!plain(x.gates) || Object.entries(x.gates).some(([k, v]) => !gateIds.has(k) || !plain(v) || typeof v.done !== 'boolean' || !isStr(v.note, 10000) || (v.decidedAt !== undefined && !isStr(v.decidedAt, 40)))) throw Error('Invalid gate records.');
  let prior = true;
  for (const g of D.gates) {
    const s = x.gates[g.id];
    if (s?.done && (!prior || !s.note.trim() || !D.tasks.filter(t => t.gate === g.id).every(t => taskComplete(x.tasks[t.id])))) throw Error('Gate ' + g.id + ' is marked complete without its earlier gates, task evidence or decision reference.');
    prior = prior && !!s?.done;
  }
  checkCalc(x.calc);
  if (!plain(x.ranges) || Object.entries(x.ranges).some(([k, v]) => !RANGE_KEYS.includes(k) || !Array.isArray(v) || v.length !== 2 || v.some(n => typeof n !== 'number' || !Number.isFinite(n)) || v[0] > v[1])) throw Error('Invalid uncertainty ranges.');
  checkPlanning(x.planning);
  if (!Array.isArray(x.log) || x.log.length > 200 || x.log.some(e => !plain(e) || !isStr(e.at, 40) || !LOG_TYPES.includes(e.type) || !isStr(e.detail, 500))) throw Error('Invalid planning log.');
  return clone(x);
}

/* Re-check every gate in order under the current task list and reopen any
 * that no longer qualify. Returns the IDs that were reopened. */
function recheckGates(x, D) {
  const reopened = [];
  let prior = true;
  for (const g of D.gates) {
    const s = x.gates[g.id];
    if (s?.done) {
      const ok = prior && s.note.trim() && D.tasks.filter(t => t.gate === g.id).every(t => taskComplete(x.tasks[t.id]));
      if (!ok) { s.done = false; reopened.push(g.id); }
    }
    prior = prior && !!x.gates[g.id]?.done;
  }
  return reopened;
}

/* Migration of earlier planning data. Rules (documented in README):
 *  - drafts identical to an earlier or current original are not carried forward
 *    (they contain no edits) and are listed in the report;
 *  - real drafts are kept and marked "based on an earlier original" so the
 *    workspace prompts a review against the corrected version 3 text;
 *  - gates stay complete only if they still meet version 3 requirements;
 *  - nothing is invented: new fields start empty or at documented defaults. */
function migrateEdits(edits, D, from) {
  const kept = {}, meta = {}, dropped = [];
  const legacy = (D.legacyHashes && D.legacyHashes[from]) || {};
  for (const [id, text] of Object.entries(edits)) {
    const doc = D.docs.find(d => d.id === id);
    if (!doc) throw Error('A draft refers to an unknown document (' + String(id).slice(0, 20) + ').');
    if (typeof text !== 'string' || text.length > 200000) throw Error('Invalid draft for document ' + id + '.');
    const h = hash(text);
    if (h === hash(doc.body) || (legacy[id] && legacy[id] === h)) { dropped.push(id); continue; }
    kept[id] = text;
    meta[id] = { base: from, savedAt: '' };
  }
  return { kept, meta, dropped };
}
function migrateV2(old, D) {
  if (!plain(old) || !isStr(old.site, 2000) || !plain(old.profile) || !plain(old.edits) || !plain(old.gates) || !plain(old.tasks) || !plain(old.records) || !plain(old.calc)) throw Error('This version 2 backup is incomplete or damaged.');
  const x = blankState(), report = [];
  x.site = old.site.slice(0, 200);
  if (old.site.length > 200) report.push('Site code shortened to 200 characters.');
  for (const k of ['country', 'region', 'municipality', 'business']) {
    if (typeof old.profile[k] !== 'string') throw Error('Invalid version 2 site profile.');
    if (old.profile[k].length > 200) report.push('Site profile field "' + k + '" shortened to 200 characters.');
    x.profile[k] = old.profile[k].slice(0, 200);
  }
  const ed = migrateEdits(old.edits, D, 'v2');
  x.edits = ed.kept; x.editMeta = ed.meta;
  if (ed.dropped.length) report.push(ed.dropped.length + ' draft(s) matched the original text and now show the corrected version 3 original (' + ed.dropped.join(', ') + ').');
  if (Object.keys(ed.kept).length) report.push(Object.keys(ed.kept).length + ' edited draft(s) kept; each is flagged for review against the corrected version 3 original.');
  for (const [k, v] of Object.entries(old.tasks)) {
    if (!D.tasks.some(t => t.id === k) || !plain(v) || !TASK_STATUS.includes(v.status) || ['owner', 'due', 'evidence'].some(f => typeof v[f] !== 'string')) throw Error('Invalid version 2 task record (' + String(k).slice(0, 10) + ').');
    x.tasks[k] = { owner: v.owner, due: v.due, status: v.status, evidence: v.evidence };
  }
  for (const [k, rows] of Object.entries(old.records)) {
    if (!own(D.schemas, k) || !Array.isArray(rows) || rows.some(r => !Array.isArray(r) || r.length !== D.schemas[k].length || r.some(c => typeof c !== 'string'))) throw Error('Invalid version 2 register: ' + String(k).slice(0, 30));
    x.records[k] = rows.map(r => r.slice());
  }
  for (const [k, v] of Object.entries(old.gates)) {
    if (!D.gates.some(g => g.id === k) || !plain(v) || typeof v.done !== 'boolean' || typeof v.note !== 'string') throw Error('Invalid version 2 gate record.');
    x.gates[k] = { done: v.done, note: v.note };
  }
  const c = old.calc;
  for (const k of Object.keys(c)) if (!own(defaultCalc, k)) throw Error('Unknown version 2 cost input: ' + String(k).slice(0, 30));
  x.calc = { ...defaultCalc, ...c, otherBasis: typeof c.otherBasis === 'string' ? c.otherBasis : '' };
  checkCalc(x.calc);
  if (x.calc.other > 0) report.push('Cost scenarios: "other savings" now needs a written basis (assumed premium reductions are excluded) before results are shown.');
  const reopened = recheckGates(x, D);
  if (reopened.length) report.push('Reopened for review under version 3 requirements: ' + reopened.join(', ') + '.');
  addLog(x, 'migration', 'Version 2 planning data migrated. ' + report.join(' '));
  return { state: validate(x, D), report };
}
function migrateV1(old, D) {
  if (!plain(old) || typeof old.site !== 'string' || !plain(old.edits) || !plain(old.gates)) throw Error('This version 1 backup is incomplete or damaged.');
  const x = blankState(), report = [];
  x.site = old.site.slice(0, 200);
  const ed = migrateEdits(old.edits, D, 'v1');
  x.edits = ed.kept; x.editMeta = ed.meta;
  if (ed.dropped.length) report.push(ed.dropped.length + ' draft(s) matched the current original and were not carried forward.');
  if (Object.keys(ed.kept).length) report.push(Object.keys(ed.kept).length + ' version 1 draft(s) kept and flagged for review against the version 3 original.');
  const notes = [];
  for (const [k, v] of Object.entries(old.gates)) {
    if (!plain(v) || typeof v.note !== 'string') throw Error('Invalid version 1 gate record.');
    if (D.gates.some(g => g.id === k)) x.gates[k] = { done: false, note: v.note.slice(0, 10000) };
    else notes.push(String(k).slice(0, 10) + ': ' + v.note.slice(0, 300));
  }
  report.push('Version 1 gate notes kept; every gate is reopened for review against the expanded tasks.');
  if (notes.length) report.push('Notes for gates that no longer exist were added to the planning log.');
  addLog(x, 'migration', 'Version 1 planning data migrated. ' + report.join(' ') + (notes.length ? ' Legacy gate notes: ' + notes.join(' | ') : ''));
  return { state: validate(x, D), report };
}
/* Accepts a parsed backup file (version 1, 2 or 3). */
function importBackup(obj, D) {
  if (!plain(obj) || obj.format !== 'child-safer-spaces') throw Error('This is not a Child-Safer Spaces planning backup.');
  if (obj.version === 3) return { state: validate(obj.state, D), migrated: false, report: [] };
  if (obj.version === 2) { const m = migrateV2(obj.state, D); return { state: m.state, migrated: 'v2', report: m.report }; }
  if (obj.version === 1) { const m = migrateV1(obj.state, D); return { state: m.state, migrated: 'v1', report: m.report }; }
  throw Error('Unsupported backup version (' + String(obj.version).slice(0, 10) + '). This workspace reads versions 1, 2 and 3.');
}
function backupEnvelope(state) { return { format: 'child-safer-spaces', version: 3, app: APP_VERSION, exportedAt: isoNow(), state: clone(state) }; }

/* ---------- 6. Storage loading with quarantine ----------
 * Order: version 3 key, then version 2 key, then version 1 key. Older keys
 * are only READ; they are never modified or deleted by version 3. If the
 * version 3 data cannot be read, a copy is placed under a recovery key and
 * `blocked` is set so the app does not overwrite it until the person decides. */
function loadState(storage, D) {
  let get;
  try { get = k => storage.getItem(k); get(KEYS.v3); } catch (e) {
    return { state: blankState(), origin: 'unavailable', blocked: false, report: ['Browser storage is unavailable here (' + (e && e.name || 'error') + '). Work is kept only while this page stays open; export a backup to keep it.'] };
  }
  const raw3 = get(KEYS.v3);
  if (raw3 !== null) {
    try { return { state: validate(JSON.parse(raw3), D), origin: 'v3', blocked: false, report: [] }; }
    catch (e) {
      const key = KEYS.recoveryPrefix + isoNow().replace(/[:.]/g, '-');
      let copied = false;
      try { storage.setItem(key, raw3); copied = true; } catch (_) { copied = false; }
      return { state: blankState(), origin: 'quarantined', blocked: true, recoveryKey: copied ? key : null, raw: raw3,
        report: ['Saved planning data in this browser could not be read: ' + e.message, copied ? 'An untouched copy was kept under a recovery key.' : 'A recovery copy could not be made (storage full). Download the unreadable data before starting again.'] };
    }
  }
  for (const [ver, key] of [[2, KEYS.v2], [1, KEYS.v1]]) {
    const raw = get(key);
    if (raw === null) continue;
    try {
      const m = importBackup({ format: 'child-safer-spaces', version: ver, state: JSON.parse(raw) }, D);
      return { state: m.state, origin: 'v' + ver + '-migrated', blocked: false, report: ['Version ' + ver + ' planning data was found in this browser and copied into version 3. The version ' + ver + ' copy was left unchanged.', ...m.report] };
    } catch (e) {
      return { state: blankState(), origin: 'legacy-unreadable', blocked: false, legacyKey: key, raw,
        report: ['Version ' + ver + ' planning data in this browser could not be migrated: ' + e.message + ' It was left unchanged; download it from Your data to inspect it.'] };
    }
  }
  return { state: blankState(), origin: 'new', blocked: false, report: [] };
}
function persist(storage, state) {
  try { storage.setItem(KEYS.v3, JSON.stringify(state)); return { ok: true }; }
  catch (e) { return { ok: false, error: (e && e.name) || 'Error' }; }
}

/* ---------- 7. Tasks and decision gates ---------- */
function gateIndex(D, id) { return D.gates.findIndex(g => g.id === id); }
/* Reopen `id` and every later gate that was complete. Returns reopened IDs. */
function invalidateFrom(x, D, id) {
  const i = Math.max(gateIndex(D, id), 0), reopened = [];
  D.gates.slice(i).forEach(g => { if (x.gates[g.id]?.done) { x.gates[g.id].done = false; reopened.push(g.id); } });
  return reopened;
}
function taskDefault(t) { return { owner: t.owner, due: '', status: 'open', evidence: '' }; }
/* Change one task field. Only a change to the task's disposition (status or
 * evidence) can affect a gate decision, so only those reopen gates. Owner and
 * due-date edits are recorded without reopening anything. */
function applyTaskChange(x, D, taskId, field, value) {
  const t = D.tasks.find(k => k.id === taskId);
  if (!t || !['owner', 'due', 'status', 'evidence'].includes(field)) throw Error('Unknown task field.');
  if (field === 'status' && !TASK_STATUS.includes(value)) throw Error('Unknown task status.');
  if (!isStr(value, 10000)) throw Error('Task text is too long.');
  const before = x.tasks[taskId] ? { ...x.tasks[taskId] } : taskDefault(t);
  if (before[field] === value) return { reopened: [] };
  x.tasks[taskId] = { ...before, [field]: value };
  let reopened = [];
  if (field === 'status' || field === 'evidence') {
    reopened = invalidateFrom(x, D, t.gate);
    if (reopened.length) addLog(x, 'gate-reopened', reopened.join(', ') + ' reopened: ' + taskId + ' ' + field + ' changed.');
  }
  return { reopened };
}
function gateStatus(x, D) {
  let prior = true;
  return D.gates.map(g => {
    const s = x.gates[g.id] || { done: false, note: '' };
    const tasks = D.tasks.filter(t => t.gate === g.id);
    const missing = tasks.filter(t => !taskComplete(x.tasks[t.id])).map(t => t.id);
    const row = { id: g.id, done: !!s.done, note: s.note, decidedAt: s.decidedAt || '', priorDone: prior, missing, ready: prior && !missing.length };
    prior = prior && !!s.done;
    return row;
  });
}
function completeGate(x, D, id, note) {
  const st = gateStatus(x, D).find(g => g.id === id);
  if (!st) throw Error('Unknown gate.');
  if (!st.priorDone) throw Error('Complete the earlier gates first.');
  if (st.missing.length) throw Error('These tasks still need a disposition with evidence: ' + st.missing.join(', ') + '.');
  if (!isStr(note, 10000) || !note.trim()) throw Error('Add the decision date, approving role and a reference to the signed record first.');
  x.gates[id] = { done: true, note, decidedAt: isoNow() };
  addLog(x, 'gate-completed', id + ' recorded complete.');
  return { ok: true };
}
/* Notes on a gate that is not complete can be edited freely. */
function setGateNote(x, D, id, note) {
  if (!D.gates.some(g => g.id === id)) throw Error('Unknown gate.');
  if (x.gates[id]?.done) throw Error('This gate is complete. Use "Amend decision record" so the change is reviewed.');
  if (!isStr(note, 10000)) throw Error('Decision text is too long.');
  x.gates[id] = { done: false, note };
}
/* Amending the decision record of a complete gate is a deliberate act: the
 * gate and every later gate reopen so the change is reviewed. */
function amendGate(x, D, id, note) {
  if (!isStr(note, 10000)) throw Error('Decision text is too long.');
  const reopened = invalidateFrom(x, D, id);
  x.gates[id] = { done: false, note, decidedAt: '' };
  addLog(x, 'gate-amended', id + ' decision record amended; reopened: ' + (reopened.join(', ') || 'none') + '.');
  return { reopened };
}
function reopenGate(x, D, id) {
  const reopened = invalidateFrom(x, D, id);
  if (reopened.length) addLog(x, 'gate-reopened', reopened.join(', ') + ' reopened by hand.');
  return { reopened };
}

/* ---------- 8. Cost scenarios ----------
 * Year-end cash flows, discounted at the stated rate. Initial cost is at year
 * 0. Escalation (from year 2) applies to retained loss, other savings and
 * operating cost. Replacement and salvage are nominal one-time year-end
 * amounts. An optional early withdrawal removes the system at the end of a
 * chosen year: costs and benefits stop, scheduled replacement/salvage after
 * that year are cancelled, and the removal cost (beyond any reserve already in
 * the initial cost) is charged in that year. No insurance saving, tax effect or
 * probability is modelled. */
function financial(x) {
  checkCalc({ ...defaultCalc, ...x });
  if (['initial', 'annual', 'loss', 'other', 'replacementCost', 'salvage', 'removalCost'].some(k => x[k] < 0 || x[k] > 1e12)) throw Error('Costs, losses and savings must be between 0 and 1 trillion.');
  if (!Number.isInteger(x.years) || x.years < 1 || x.years > 30) throw Error('Horizon must be 1–30 whole years.');
  if (x.discount < 0 || x.discount > 100 || x.escalation < -50 || x.escalation > 100 || x.reduction < -100 || x.reduction > 100) throw Error('Discount: 0–100%; escalation: −50–100%; reduction: −100–100%.');
  if (!Number.isInteger(x.replacementYear) || x.replacementYear < 0 || x.replacementYear > x.years || (x.replacementCost > 0 && x.replacementYear === 0)) throw Error('A positive replacement cost needs a year from 1 through the horizon.');
  if (!Number.isInteger(x.withdrawYear) || x.withdrawYear < 0 || x.withdrawYear > x.years) throw Error('Withdrawal year must be 0 (none) or a whole year within the horizon.');
  if (x.removalCost > 0 && x.withdrawYear === 0) throw Error('A removal cost needs a withdrawal year.');
  if (x.other > 0 && !String(x.otherBasis || '').trim()) throw Error('Describe the documented basis for "other savings" (for example a signed quote). Assumed premium reductions and insurer payments are excluded.');
  const stop = x.withdrawYear || x.years;
  let npv = -x.initial, cumulative = -x.initial, cumulativePV = -x.initial, pvLoss = 0, pvOther = 0, pvCosts = 0, pvSalvage = 0;
  let firstRecovery = null, firstPVRecovery = null;
  const rows = [];
  for (let year = 1; year <= x.years; year++) {
    const active = year <= stop;
    const e = (1 + x.escalation / 100) ** (year - 1), factor = (1 + x.discount / 100) ** year;
    const gross = active ? x.loss * x.reduction / 100 * e : 0;
    const other = active ? x.other * e : 0;
    const cost = active ? x.annual * e : 0;
    const replacement = active && year === x.replacementYear && year !== x.withdrawYear ? x.replacementCost : 0;
    const removal = x.withdrawYear && year === x.withdrawYear ? x.removalCost : 0;
    const salvage = !x.withdrawYear && year === x.years ? x.salvage : 0;
    const net = gross + other - cost - replacement - removal + salvage, pv = net / factor;
    cumulative += net; cumulativePV += pv; npv += pv;
    if (active) pvLoss += x.loss * e / factor;
    pvOther += other / factor; pvCosts += (cost + replacement + removal) / factor; pvSalvage += salvage / factor;
    if (x.initial > 0 && firstRecovery === null && cumulative >= -1e-8) firstRecovery = year;
    if (x.initial > 0 && firstPVRecovery === null && cumulativePV >= -1e-8) firstPVRecovery = year;
    rows.push({ year, gross, other, cost, replacement, removal, salvage, net, pv, cumulative, cumulativePV });
  }
  const breakEven = pvLoss > 0 ? (x.initial + pvCosts - pvOther - pvSalvage) / pvLoss * 100 : null;
  const finalCumulative = rows[rows.length - 1].cumulative;
  return { npv, rows, firstRecovery, firstPVRecovery, breakEven, noInitialCost: x.initial === 0, withdrawn: !!x.withdrawYear,
    endsNegative: finalCumulative < -1e-8, pvCosts: x.initial + pvCosts, pvBenefits: pvLoss * x.reduction / 100 + pvOther + pvSalvage };
}
/* One-at-a-time ranges ("tornado") plus all-pessimistic and all-optimistic
 * combinations. Ranges are the person's own low/high assumptions. */
function scenarioRange(x, ranges) {
  const base = financial(x).npv, rows = [];
  for (const k of RANGE_KEYS) {
    const r = ranges && ranges[k];
    if (!r) continue;
    if (!Array.isArray(r) || r.length !== 2 || r.some(n => typeof n !== 'number' || !Number.isFinite(n)) || r[0] > r[1]) throw Error('Each range needs low ≤ high numbers (' + k + ').');
    const lo = financial({ ...x, [k]: r[0] }).npv, hi = financial({ ...x, [k]: r[1] }).npv;
    rows.push({ key: k, low: r[0], high: r[1], npvAtLow: lo, npvAtHigh: hi, swing: Math.abs(hi - lo) });
  }
  rows.sort((a, b) => b.swing - a.swing);
  const pick = (k, worse) => { const r = ranges && ranges[k]; if (!r) return x[k]; const costLike = ['initial', 'annual', 'discount'].includes(k); return worse ? (costLike ? r[1] : r[0]) : (costLike ? r[0] : r[1]); };
  const combo = worse => { const y = { ...x }; for (const k of RANGE_KEYS) y[k] = pick(k, worse); return financial(y).npv; };
  return { base, rows, pessimistic: rows.length ? combo(true) : null, optimistic: rows.length ? combo(false) : null };
}

/* ---------- 9. Evaluation planning ----------
 * Planning arithmetic only, under a simple Poisson model with perfect
 * ascertainment and independent events. Clustering, reporting changes and
 * exposure error make real requirements larger. Not a substitute for an
 * independent statistician. */
function normInv(p) { // Acklam's rational approximation of the standard normal quantile
  if (!(p > 0 && p < 1)) throw Error('Probability must be between 0 and 1.');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239],
    b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1],
    c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
    d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function poissonCdf(k, lambda) { let term = Math.exp(-lambda), sum = term; for (let i = 1; i <= k; i++) { term *= lambda / i; sum += term; } return Math.min(sum, 1); }
/* One-sided upper confidence bound for a Poisson mean after observing k events. */
function poissonUpper(k, conf = 0.95) {
  if (!Number.isInteger(k) || k < 0 || k > 600) throw Error('Observed events must be a whole number from 0 to 600 (use statistical software above that).');
  if (k === 0) return -Math.log(1 - conf);
  let lo = k, hi = k + 10 * Math.sqrt(k + 1) + 10;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (poissonCdf(k, mid) > 1 - conf) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function evaluationPlan(p) {
  checkPlanning({ ...defaultPlanning, ...p });
  if (p.baselineRate <= 0 || p.baselineRate > 100000) throw Error('Baseline rate must be above 0 and at most 100,000 per 100,000 entries.');
  if (p.rateRatio <= 0 || p.rateRatio >= 1) throw Error('Target rate ratio must be between 0 and 1 (for example 0.8 = 20% lower).');
  if (p.alpha <= 0 || p.alpha >= 0.5) throw Error('Significance level must be between 0 and 0.5.');
  if (p.power <= 0.5 || p.power >= 1) throw Error('Power must be between 0.5 and 1.');
  if (p.designEffect < 1 || p.designEffect > 100) throw Error('Design effect must be from 1 to 100.');
  if (p.exposurePerArm <= 0 || p.exposurePerArm > 1e12 || p.observedExposure <= 0 || p.observedExposure > 1e12) throw Error('Exposure must be above 0.');
  const z = normInv(1 - p.alpha / 2) + normInv(p.power);
  const controlEvents = z * z * (1 + 1 / p.rateRatio) / Math.log(p.rateRatio) ** 2 * p.designEffect;
  const ratePerEntry = p.baselineRate / 100000;
  const exposureNeeded = controlEvents / ratePerEntry;
  const expectedControl = ratePerEntry * p.exposurePerArm, expectedIntervention = expectedControl * p.rateRatio;
  const upper = poissonUpper(p.observedEvents, 0.95) / p.observedExposure * 100000;
  return { controlEvents, interventionEvents: controlEvents * p.rateRatio, exposureNeeded, expectedControl, expectedIntervention,
    shortfall: exposureNeeded / p.exposurePerArm, observedRate: p.observedEvents / p.observedExposure * 100000, upperRate: upper, z };
}

/* ---------- 10. Document helpers ---------- */
function lineDiff(a, b) {
  const x = String(a).split(/\r?\n/), y = String(b).split(/\r?\n/);
  if (x.length * y.length > 400000) return [{ type: 'note', text: 'Documents are too long to compare line by line here.' }];
  const n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ type: 'same', text: x[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ type: 'del', text: x[i] }); i++; }
    else { out.push({ type: 'add', text: y[j] }); j++; }
  }
  while (i < n) out.push({ type: 'del', text: x[i++] });
  while (j < m) out.push({ type: 'add', text: y[j++] });
  return out;
}
function snippet(text, q, width = 160) {
  const s = String(text).replace(/\s+/g, ' ');
  const i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return s.slice(0, width) + (s.length > width ? '…' : '');
  const start = Math.max(0, i - Math.floor(width / 3));
  return (start > 0 ? '…' : '') + s.slice(start, start + width) + (start + width < s.length ? '…' : '');
}

/* ---------- 11. Version 4 helpers ---------- */

/* Starting point: deterministic, explainable suggestions.
 * answers = { who, where, goal, time } (any may be missing).
 * A rule applies when every dimension it lists contains the answer.
 * Steps are ordered by rule priority, then by their order in content.json;
 * duplicates (same target) are dropped; "time" caps how many are shown.
 * Each step carries `because`: the answers that made it apply. */
function startingPoint(answers, D) {
  const a = plain(answers) ? answers : {};
  const Q = D.startQuestions || [], R = D.startRules || [];
  const label = (dim, id) => { const q = Q.find(x => x.id === dim); const o = q && q.options.find(x => x[0] === id); return o ? o[1] : id; };
  const hits = [];
  R.forEach((r, order) => {
    const dims = Object.keys(r.when || {});
    if (dims.every(d => Array.isArray(r.when[d]) && r.when[d].includes(a[d]))) hits.push({ r, order, because: dims.map(d => label(d, a[d])) });
  });
  hits.sort((x, y) => x.r.priority - y.r.priority || x.order - y.order);
  const seen = new Set(), steps = [];
  for (const h of hits) {
    const key = h.r.target.kind + ':' + h.r.target.ref;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({ id: h.r.id, title: h.r.title, detail: h.r.detail, target: h.r.target, work: h.r.work, because: h.because });
  }
  const cap = { short: 2, hour: 3, more: 5 }[a.time] || 3;
  return { steps: steps.slice(0, cap), more: Math.max(0, steps.length - cap), skip: (D.startSkips || {})[a.goal] || '' };
}

/* Source freshness: a source should be re-checked a year after retrieval. */
function sourceDue(src, today) {
  const m = String(src && src.retrieved || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { due: '', overdue: true };
  const due = (Number(m[1]) + 1) + '-' + m[2] + '-' + m[3];
  return { due, overdue: String(today || isoNow()).slice(0, 10) > due };
}

/* Whole-workspace personal-data check, run before a backup is shared.
 * Drafts use the lenient "document" mode; records, tasks and gate notes use
 * each register's own mode or the strict "record" mode. Returns where each
 * finding is, never the matched text. */
function scanState(x, D) {
  const out = [], add = (where, text, mode) => { const f = scanSensitive(text, mode); if (f.length) out.push({ where, labels: f.map(y => y.label) }); };
  add('Site code and profile', [x.site, ...Object.values(x.profile || {})].join('\n'), 'record');
  for (const [id, text] of Object.entries(x.edits || {})) add('Draft of document ' + id, text, 'document');
  for (const [reg, rows] of Object.entries(x.records || {})) rows.forEach((r, i) => add('Register ' + reg + ', row ' + (i + 1), r.join('\n'), (D.registerMeta[reg] || {}).scan || 'record'));
  for (const [id, t] of Object.entries(x.tasks || {})) add('Task ' + id, [t.owner, t.evidence].join('\n'), 'record');
  for (const [id, g] of Object.entries(x.gates || {})) add('Gate ' + id + ' note', g.note || '', 'record');
  add('Cost-scenario savings basis', (x.calc || {}).otherBasis || '', 'record');
  return out;
}

/* Display settings live in localStorage (they are preferences, not planning
 * data). Unknown keys or values are dropped, so a damaged value can never
 * break the page. */
const SETTINGS_DEFAULTS = { theme: 'system', text: '100', motion: 'system', atmosphere: 'auto', surfaces: 'glass', contrast: 'standard', mode: '', context: 'open' };
const SETTINGS_ALLOWED = { theme: ['system', 'light', 'dark'], text: ['100', '112', '125', '150'], motion: ['system', 'reduce'], atmosphere: ['auto', 'still', 'off'],
  surfaces: ['glass', 'solid'], contrast: ['standard', 'more'], mode: ['', 'essentials', 'full'], context: ['open', 'closed'] };
function readSettings(raw) {
  let obj = {};
  try { obj = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { obj = {}; }
  const out = { ...SETTINGS_DEFAULTS };
  if (plain(obj)) for (const k of Object.keys(SETTINGS_ALLOWED)) if (SETTINGS_ALLOWED[k].includes(obj[k])) out[k] = obj[k];
  return out;
}

const api = { APP_VERSION, STATE_SCHEMA, KEYS, esc, hash, clone, markdown, csv, csvCell, parseCSV, registerImport, unneutralize,
  scanSensitive, blankState, defaultCalc, defaultPlanning, RANGE_KEYS, validate, checkCalc, importBackup, backupEnvelope, migrateV1, migrateV2,
  loadState, persist, taskComplete, invalidateFrom, applyTaskChange, gateStatus, completeGate, setGateNote, amendGate, reopenGate, recheckGates, addLog,
  financial, scenarioRange, normInv, poissonUpper, evaluationPlan, lineDiff, snippet,
  inline, startingPoint, sourceDue, scanState, SETTINGS_DEFAULTS, SETTINGS_ALLOWED, readSettings };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.CSSCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
