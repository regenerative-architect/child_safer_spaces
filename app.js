/* Child-Safer Spaces · workspace application · version 4.0 (global edition)
 *
 * Plain browser JavaScript, no libraries, no network. Reads the content
 * (window.CSS_DATA from data.js), the pure logic (window.CSSCore from
 * core.js), the storage layer (window.CSSStore from store.js) and the
 * optional background scene (window.CSSAtmosphere from atmosphere.js).
 *
 * Sections
 *   1. Set-up and helpers
 *   2. Display settings (theme, text size, contrast, motion, scene, surfaces, mode)
 *   3. Saving, storage status, recovery banners, conflicts and undo
 *   4. Non-sensitive data check (confirm before saving risky text)
 *   5. Shell: route registry, router and deep links, navigation, drawers,
 *      search, "About this view" panel, status bar
 *   6. Views (Discover, Start here, brief, glossary, documents, evidence,
 *      sources, workflows, pathway, plan, gates, registers, cost scenarios,
 *      evaluation planning, adaptation kit, your data, about, not found)
 *   7. Backups, export check, printing and downloads
 *   8. Start-up (storage, settings, offline copy for hosted use, first route)
 *
 * To add a view: add its route to "routes" in source/content.json (id,
 * label, group, mode, keywords), add a guide to "viewGuides", then add a
 * render function to RENDER below. The tests check that all three exist.
 */
'use strict';

/* ---------- 1. Set-up and helpers ---------- */
const D = window.CSS_DATA, C = window.CSSCore;
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = C.esc;
// Kind of work: whether a task or workflow needs an outside decision. Gates still run in order.
const KIND = { now: ['now', 'No approval needed'], review: ['review', 'Needs local review'], signed: ['signed', 'Needs signed commitment'] };
const badge = k => k && KIND[k] ? '<span class="badge ' + KIND[k][0] + '">' + KIND[k][1] + '</span>' : '';
const catBadge = c => '<span class="badge cat-' + esc(String(c).split(' ')[0]) + '">' + esc(c) + '</span>';
const docById = id => D.docs.find(d => d.id === id);
const pretty = s => String(s).replace(/_/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const fileSafe = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const STAGES = Object.fromEntries(D.journey.map((j, i) => [j.id, { name: j.name, n: i + 1 }]));
const SETTINGS_KEY = 'child-safer-spaces-settings';
const BUILD = document.documentElement.dataset.build || 'folder'; // "standalone" for the single-file copy

/* The storage layer is created at start-up (section 8). Until then nothing is saved. */
let store = null;
const ui = { view: 'discover', path: 'discover', role: null, activeDoc: null, registerName: D.registers[0], pending: false, unsaved: false, lastSaved: null,
  storageState: 'pending', blocked: false, snap: null, banners: [], openWorkflow: null, taskFilter: { gate: 'all', kind: 'all', status: 'all' },
  answers: {}, atmo: null, offline: 'checking', ready: false };
let state = C.blankState();

/* Status messages are announced to screen readers and shown briefly above the status bar. */
let announceTimer = 0;
function announce(msg) {
  const s = $('#status'); s.textContent = ''; window.clearTimeout(announceTimer);
  window.setTimeout(() => { s.textContent = msg; }, 30);
  announceTimer = window.setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 9000);
}
function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function body(d) { return state.edits[d.id] ?? d.body; }
function draftStatus(id) {
  if (state.edits[id] === undefined) return 'original';
  const m = state.editMeta[id];
  return m && m.base === D.docHashes[id] ? 'draft' : 'review';
}
/* Page heading. The small line above the title names the journey stage the
 * view belongs to, so people always know where they are in the six stages. */
function heading(eyebrow, title, lede) {
  const r = routeById(ui.view), st = r && STAGES[r.group];
  const label = st ? 'Stage ' + st.n + ' of 6: ' + st.name : eyebrow;
  return '<p class="eyebrow">' + esc(label) + '</p><h1 tabindex="-1">' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '');
}
function hintFor(col) {
  const H = D.columnHints;
  if (H[col]) return H[col];
  for (const [k, v] of Object.entries(H)) {
    if (k.startsWith('*_') && col.endsWith(k.slice(1))) return v;
  }
  return '';
}

/* ---------- 2. Display settings ----------
 * Preferences only (never planning data), kept in localStorage under
 * "child-safer-spaces-settings". Applied as data-* attributes on <html>,
 * which style.css reads. "Reset settings" restores the defaults. */
let settings = C.readSettings(null);
function loadSettings() { try { settings = C.readSettings(window.localStorage.getItem(SETTINGS_KEY)); } catch (e) { settings = C.readSettings(null); } }
function saveSettings() { try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; } catch (e) { return false; } }
const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
function reducedMotion() { return settings.motion === 'reduce' || motionQuery.matches; }
/* Without an explicit choice: the full workspace for people who already have work here, essentials for
 * newcomers. Decided once at start-up so the navigation never changes under someone's hands. */
function effectiveMode() { return settings.mode || ui.defaultMode || 'essentials'; }
function hasWork() { return !!(state.site || Object.keys(state.edits).length || Object.keys(state.tasks).length || Object.keys(state.gates).length || Object.values(state.records).some(r => r.length)); }
function applySettings() {
  const h = document.documentElement;
  h.dataset.theme = settings.theme; h.dataset.text = settings.text; h.dataset.contrast = settings.contrast;
  h.dataset.surfaces = settings.surfaces; h.dataset.motion = reducedMotion() ? 'reduce' : 'full'; h.dataset.mode = effectiveMode();
  if (ui.atmo) ui.atmo.setMode(settings.atmosphere, reducedMotion());
  if (ui.ready) { buildNav(); renderStatusBar(); renderContext(); }
}
motionQuery.addEventListener && motionQuery.addEventListener('change', applySettings);

/* ---------- 3. Saving, storage status, banners and undo ---------- */
let saveTimer = null;
const ENGINE_LABEL = { indexeddb: 'this browser\'s database', localstorage: 'this browser\'s simpler storage (fallback)', memory: 'memory only' };
function setStorage(st, detail) {
  ui.storageState = st;
  const el = $('#storage');
  const t = ui.lastSaved ? ui.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  el.dataset.state = st;
  el.textContent = ({ saved: 'Saved in this browser' + (t ? ', ' + t : ''), pending: 'Saving…', failed: 'Not saved — export a backup',
    unavailable: 'Storage unavailable — export to keep work', blocked: 'Saving paused — see notice' })[st] || st;
  el.title = (store ? 'Kept in ' + ENGINE_LABEL[store.engine] + '. ' : '') + (detail || '');
}
function save(opts = {}) {
  if (!store) return;
  if (opts.debounce) { window.clearTimeout(saveTimer); ui.pending = true; setStorage('pending'); saveTimer = window.setTimeout(() => save(), 500); return; }
  window.clearTimeout(saveTimer); ui.pending = false;
  if (ui.blocked) { ui.unsaved = true; setStorage('blocked'); return; }
  if (ui.storageMissing) { ui.unsaved = true; setStorage('unavailable'); return; }
  const r = C.persist(store, state);
  if (!r.ok) { if (r.error === 'ConflictError') return; writeFailed(r.error); return; }
  // Database writes finish in the background; "Saved" appears only when the browser confirms.
  ui.unsaved = true; setStorage('pending');
  store.flush().then(() => {
    if (store.busy()) return;
    ui.unsaved = false; ui.erased = false; ui.lastSaved = new Date(); setStorage('saved'); dropBanner('write-failed'); renderStatusBar();
  }, e => { if (e && e.name === 'ConflictError') return; writeFailed((e && e.name) || 'Error'); });
  renderWorkspaceName();
}
function writeFailed(name) {
  ui.unsaved = true; setStorage('failed', name);
  addBanner('write-failed', 'danger', '<p><strong>Your latest changes are not saved in this browser</strong> (' + esc(name) + '). Export a backup now; the browser may be full or blocking storage.</p>', [['Export backup now', exportBackup]]);
}
/* Another tab or window saved this workspace after this tab loaded it. */
function onConflict() {
  ui.blocked = true; ui.unsaved = true; setStorage('blocked', 'Changed in another tab or window');
  addBanner('conflict', 'danger', '<p><strong>This workspace was changed in another tab or window.</strong> To avoid overwriting that work, saving is paused here. Download this tab\'s copy if it has changes you need, then load the latest saved version.</p>',
    [['Download this tab\'s copy', exportBackup], ['Load the latest saved version', () => { ui.unsaved = false; ui.erased = true; window.location.reload(); }]]);
}
function flush() { if (ui.pending) save(); }
window.addEventListener('beforeunload', e => { flush(); if ((ui.unsaved || (store && store.busy())) && !ui.erased) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

function addBanner(id, kind, html, actions = [], dismissible = false) {
  ui.banners = ui.banners.filter(b => b.id !== id).concat([{ id, kind, html, actions, dismissible }]);
  renderBanners();
}
function dropBanner(id) { if (ui.banners.some(b => b.id === id)) { ui.banners = ui.banners.filter(b => b.id !== id); renderBanners(); } }
function renderBanners() {
  const el = $('#banner');
  el.hidden = !ui.banners.length;
  el.innerHTML = ui.banners.map((b, i) => '<div class="notice ' + b.kind + '" data-banner="' + i + '">' + b.html + '<div class="toolbar">' +
    b.actions.map((a, j) => '<button type="button" data-bact="' + i + '-' + j + '">' + esc(a[0]) + '</button>').join('') +
    (b.dismissible ? '<button type="button" data-bdismiss="' + i + '">Dismiss</button>' : '') + '</div></div>').join('');
  $$('[data-bact]').forEach(btn => btn.onclick = () => { const [i, j] = btn.dataset.bact.split('-').map(Number); ui.banners[i].actions[j][1](); });
  $$('[data-bdismiss]').forEach(btn => btn.onclick = () => { ui.banners.splice(Number(btn.dataset.bdismiss), 1); renderBanners(); });
}
function renderWorkspaceName() {
  $('#workspace-name').textContent = state.site ? 'Workspace: ' + state.site : 'Workspace: no site code yet';
}
/* Single-level undo for replacements and removals. The copy is kept in
 * memory and, when possible, in browser storage so a reload keeps it. */
function snapshot(label) {
  ui.snap = { label, at: new Date().toISOString(), state: C.clone(state) };
  try { if (store && !ui.storageMissing && !ui.blocked) store.setItem(C.KEYS.undo, JSON.stringify(ui.snap)); } catch (e) { /* memory copy still works */ }
  updateUndo();
}
function updateUndo() {
  const b = $('#undo');
  b.disabled = !ui.snap;
  b.textContent = ui.snap ? 'Undo: ' + ui.snap.label : 'Undo last change';
}
function undo() {
  if (!ui.snap) return;
  const s = ui.snap;
  try { state = C.validate(s.state, D); } catch (e) { announce('The undo copy could not be used: ' + e.message); return; }
  ui.snap = null;
  try { store.removeItem(C.KEYS.undo); } catch (e) { /* ignore */ }
  C.addLog(state, 'undo', 'Undid: ' + s.label);
  save(); updateUndo(); render();
  announce('Undone: ' + s.label + '.');
}

/* ---------- 4. Non-sensitive data check ----------
 * Shows what the pattern check found and lets the person edit or confirm.
 * The check is a reminder, not a privacy review. */
function sensitiveList(findings) { return '<ul>' + findings.map(f => '<li>' + esc(f.label) + '</li>').join('') + '</ul>'; }
function confirmSensitive(box, findings, onSave) {
  box.innerHTML = '<div class="confirm" role="group" aria-labelledby="sens-title"><p id="sens-title"><strong>This entry may contain personal or sensitive information:</strong></p>' + sensitiveList(findings) +
    '<p>This workspace is for non-sensitive planning only. Replace details with a coded reference to the record in your protected system.</p>' +
    '<div class="toolbar"><button type="button" id="sens-edit">Edit the entry</button><button type="button" id="sens-save">Save anyway — it contains no personal or sensitive information</button></div></div>';
  $('#sens-edit').onclick = () => { box.innerHTML = ''; };
  $('#sens-save').onclick = () => { box.innerHTML = ''; onSave(); };
  $('#sens-edit').focus();
}
function inlineWarning(el, text, mode) {
  let w = el.parentElement.querySelector('.inline-warning');
  const f = C.scanSensitive(text, mode);
  if (!f.length) { if (w) w.remove(); return; }
  if (!w) { w = document.createElement('div'); w.className = 'inline-warning'; w.setAttribute('role', 'note'); el.insertAdjacentElement('afterend', w); }
  w.textContent = 'This may contain ' + f.map(x => x.label).join(', ') + '. Use a coded reference to the protected record instead.';
}

/* ---------- 5. Shell ----------
 * Routes come from D.routes (source/content.json). Each has a render
 * function in RENDER (filled in after the views are defined). Deep links use
 * the address fragment: #/plan, #/doc/07, #/workflows/W03, #/registers/hazards,
 * #/brief/fr, #/start/roles. Back and forward work through browser history. */
const ROUTES = D.routes;
const RENDER = {};
const routeById = id => ROUTES.find(r => r.id === id);
const GROUPS = D.journey.map(j => j.id);

function parsePath(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [id, ...rest] = raw.split('/');
  let arg = rest.join('/');
  try { arg = decodeURIComponent(arg); } catch (e) { /* keep raw */ }
  return { id: id || '', arg };
}
/* Navigate inside the workspace. Adds a history entry unless opts.replace. */
function go(path, opts = {}) {
  const target = '#/' + path;
  if (window.location.hash !== target) {
    try { window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', target); } catch (e) { window.location.hash = target; return; }
  }
  route(opts);
}
function route(opts = {}) {
  // In-page anchors such as the skip link (#main) are not routes: leave the current view alone.
  const h = window.location.hash;
  if (h && h !== '#' && !h.startsWith('#/')) { if (ui.renderedHash !== undefined) return; try { window.history.replaceState(null, '', '#/'); } catch (e) { /* ignore */ } }
  // Back/forward can fire both popstate and hashchange; render each address once.
  if (ui.ready && window.location.hash === ui.renderedHash && !opts.force) return;
  ui.renderedHash = window.location.hash;
  const { id, arg } = parsePath(window.location.hash);
  const startId = hasWork() ? 'start' : 'discover';
  const known = id === '' || id === 'home' || id === 'doc' || !!RENDER[id];
  const doRender = () => {
    closeDrawers();
    if (ui.ready) { $('#status').textContent = ''; } // an old message should not follow you to another view
    if (id === '' || id === 'home') { try { window.history.replaceState(null, '', '#/' + startId); } catch (e) { /* ignore */ } ui.renderedHash = window.location.hash; show(startId, opts); return; }
    if (id === 'doc') { if (docById(arg)) openDoc(arg, opts); else show('notfound', { ...opts, bad: '#/doc/' + arg }); return; }
    if (!known) { show('notfound', { ...opts, bad: window.location.hash }); return; }
    show(id, { ...opts, arg });
  };
  // A short cross-fade between views helps orientation; skipped when motion is reduced.
  if (ui.ready && document.startViewTransition && !reducedMotion() && opts.transition) document.startViewTransition(doRender);
  else doRender();
}
window.addEventListener('popstate', () => route({ transition: true }));
window.addEventListener('hashchange', () => route({ transition: true }));

function markNav(id) {
  $$('#nav [data-view]').forEach(b => { if (b.dataset.view === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
function setTitle(text) { document.title = text + ' · Child-Safer Spaces 4.0'; }
function show(view, opts = {}) {
  flush();
  if (ui.atmo && view !== 'discover') { ui.atmo.destroy(); ui.atmo = null; }
  const r = routeById(view) || { id: 'notfound', label: 'Page not found', group: '' };
  ui.view = r.id; ui.activeDoc = null; ui.path = (window.location.hash || '').replace(/^#\//, '');
  // In "Essentials" the current view joins the navigation while it is open, so you always see where you are.
  if (effectiveMode() !== 'full' || !document.querySelector('#nav [data-view="' + r.id + '"]')) buildNav(); else markNav(r.id);
  $('#crumb').textContent = (STAGES[r.group] && STAGES[r.group].name !== r.label ? STAGES[r.group].name + ' / ' : '') + r.label;
  setTitle(r.label);
  (RENDER[r.id] || RENDER.notfound)(opts);
  renderContext();
  focusTarget(opts);
}
/* After rendering: focus a named section (#/start/roles) or the page heading. */
function focusTarget(opts) {
  const el = opts.arg && /^[a-z][a-z0-9-]*$/i.test(opts.arg) ? document.getElementById(opts.arg) : null;
  if (el && !opts.noFocus) {
    if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1'); // keep links in the tab order
    el.scrollIntoView({ block: 'start' }); el.focus(); return;
  }
  if (!opts.keepScroll) window.scrollTo(0, 0);
  if (!opts.noFocus) { const h = $('#view h1'); if (h) h.focus(); }
}
function render() { if (ui.activeDoc) openDoc(ui.activeDoc, { keepScroll: true, noFocus: true }); else show(ui.view, { keepScroll: true, noFocus: true, arg: parsePath(window.location.hash).arg }); }
function linkDocs(ids) { return ids.map(id => '<a class="linkbtn" href="#/doc/' + id + '">' + id + ' · ' + esc(docById(id)?.title || id) + '</a>').join(' '); }
/* Buttons with data-open-* attributes navigate through the router. */
function wireLinks(root = document) {
  root.querySelectorAll('[data-open-doc]').forEach(b => b.onclick = () => go('doc/' + b.dataset.openDoc));
  root.querySelectorAll('[data-open-wf]').forEach(b => b.onclick = () => go('workflows/' + b.dataset.openWf));
  root.querySelectorAll('[data-open-reg]').forEach(b => b.onclick = () => { ui.registerName = b.dataset.openReg; go('registers/' + b.dataset.openReg); });
}
function hrefFor(target) {
  const t = target || {};
  if (t.kind === 'doc') return '#/doc/' + t.ref;
  if (t.kind === 'wf') return '#/workflows/' + t.ref;
  if (t.kind === 'reg') return '#/registers/' + t.ref;
  return '#/' + String(t.ref || 'discover').replace('#', '/');
}

/* Navigation tree: grouped by the six journey stages. In "Essentials" mode
 * only the routes marked essentials appear; everything stays reachable by
 * search and deep links. */
function buildNav() {
  const mode = effectiveMode();
  $('#nav').innerHTML = GROUPS.map(g => {
    const items = ROUTES.filter(r => r.group === g && (mode === 'full' || r.mode === 'essentials' || r.id === ui.view));
    if (!items.length) return '';
    return '<div class="navgroup"><p class="navstage" id="ng-' + g + '"><span class="navnum" aria-hidden="true">' + STAGES[g].n + '</span>' + esc(STAGES[g].name) + '</p><ul aria-labelledby="ng-' + g + '">' +
      items.map(r => '<li><a href="#/' + r.id + '" data-view="' + r.id + '">' + esc(r.label) + (r.mode === 'full' && mode !== 'full' ? ' <span class="navnote">(full workspace)</span>' : '') + '</a></li>').join('') + '</ul></div>';
  }).join('') + '<p class="navmode">' + (mode === 'full' ? 'Showing the full workspace.' : 'Showing essentials. Search finds everything.') + '</p>';
  markNav(ui.view);
  for (const mb of [$('#modebtn'), $('#modebtn2')]) {
    mb.setAttribute('aria-pressed', String(mode === 'full'));
    mb.textContent = mode === 'full' ? 'Show essentials only' : 'Show full workspace';
  }
}
function toggleMode() {
  settings.mode = effectiveMode() === 'full' ? 'essentials' : 'full';
  saveSettings(); applySettings();
  announce(settings.mode === 'full' ? 'Full workspace shown in the navigation.' : 'Essentials only. Everything else stays reachable by search.');
}

/* Drawers (navigation on small screens, "About this view" below 1280 px).
 * While a drawer is open, the rest of the page is inert, Escape closes it
 * and focus returns to the button that opened it. */
let drawer = null;
const narrow = () => window.matchMedia('(max-width: 899px)').matches;
const ctxOverlay = () => window.matchMedia('(max-width: 1279px)').matches;
function openDrawer(el, opener) {
  closeDrawers();
  drawer = { el, opener };
  el.classList.add('open'); document.body.classList.add('drawer-open');
  ['#sidebar', '.page', '#context'].map(s => $(s)).forEach(x => { if (x && x !== el) x.inert = true; });
  opener.setAttribute('aria-expanded', 'true');
  const f = el.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (f) f.focus();
}
function closeDrawers(keepFocus) {
  if (!drawer) return;
  const { el, opener } = drawer; drawer = null;
  el.classList.remove('open'); document.body.classList.remove('drawer-open');
  ['#sidebar', '.page', '#context'].map(s => $(s)).forEach(x => { if (x) x.inert = false; });
  opener.setAttribute('aria-expanded', 'false');
  if (!keepFocus) opener.focus();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawer) { e.preventDefault(); closeDrawers(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
  if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
  else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openSearch(); }
});
document.addEventListener('click', e => {
  if (drawer && e.target === $('#scrim')) closeDrawers();
  const a = e.target.closest && e.target.closest('#nav a');
  if (a && drawer && drawer.el.id === 'sidebar') closeDrawers(true);
});

/* Search: one box for views, documents, workflows, registers, glossary,
 * sources and tasks. Results are links; nothing runs from the search box. */
function searchIndex() {
  if (ui.index) return ui.index;
  const idx = [];
  ROUTES.forEach(r => { const what = (D.viewGuides[r.id] || {}).what || ''; idx.push({ type: 'View', title: r.label, text: r.keywords + ' ' + what, show: what, href: '#/' + r.id }); });
  D.docs.forEach(d => idx.push({ type: 'Document ' + d.id, title: d.title, text: d.body, href: '#/doc/' + d.id, doc: d }));
  D.workflows.forEach(w => idx.push({ type: 'Workflow ' + w.id, title: w.title, text: [w.trigger, w.owner, ...w.steps].join(' '), href: '#/workflows/' + w.id }));
  D.registers.forEach(n => idx.push({ type: 'Register', title: pretty(n), text: D.registerMeta[n].purpose + ' ' + D.schemas[n].join(' '), href: '#/registers/' + n }));
  D.glossary.forEach(g => idx.push({ type: 'Glossary', title: g.term, text: g.plain + ' ' + g.more, href: '#/glossary/' + 'term-' + fileSafe(g.term) }));
  D.sources.forEach(s => idx.push({ type: 'Source ' + s.id, title: s.title, text: [s.publisher, s.jurisdiction, s.scope].join(' '), href: '#/sources/' + 'src-' + s.id }));
  D.tasks.forEach(t => idx.push({ type: 'Task ' + t.id, title: t.title, text: t.gate + ' ' + t.owner, href: '#/plan' }));
  return (ui.index = idx);
}
function runSearch(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const it of searchIndex()) {
    const title = it.title.toLowerCase(), text = (it.doc ? body(it.doc) : it.text).toLowerCase();
    if (!words.every(w => title.includes(w) || text.includes(w))) continue;
    const score = words.reduce((a, w) => a + (title.includes(w) ? 5 : 0) + (title.startsWith(w) ? 3 : 0), 0) + (it.type === 'View' ? 2 : 0);
    scored.push({ it, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 30).map(x => x.it);
}
function openSearch() {
  const dlg = $('#searchdlg');
  if (!dlg || dlg.open) return;
  closeDrawers(true);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  const inp = $('#searchq'); inp.value = ''; drawResults(''); inp.focus();
}
function closeSearch() { const dlg = $('#searchdlg'); if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } }
function drawResults(q) {
  const res = runSearch(q);
  $('#searchcount').textContent = q.trim() ? res.length + (res.length === 30 ? '+' : '') + ' result' + (res.length === 1 ? '' : 's') : 'Type to search the whole workspace.';
  $('#searchresults').innerHTML = res.map(it => '<li><a href="' + esc(it.href) + '" class="result"><span class="rtype">' + esc(it.type) + '</span><span class="rtitle">' + esc(it.title) + '</span>' +
    (q.trim() ? '<span class="snippet">' + esc(it.show || C.snippet(it.doc ? body(it.doc) : it.text, q.trim().split(/\s+/)[0], 120)) + '</span>' : '') + '</a></li>').join('');
}

/* "About this view": layered explanations for the current view, from
 * D.viewGuides. The first layer is always visible; the rest open on request. */
function renderContext() {
  const box = $('#context'); if (!box) return;
  const r = ui.activeDoc ? { id: 'doc' } : routeById(ui.view) || { id: 'notfound' };
  const g = D.viewGuides[r.id] || D.viewGuides.notfound;
  const terms = D.glossary.filter(t => t.see === r.id || (ui.activeDoc && t.see === ui.activeDoc));
  const open = !ctxOverlay() && settings.context === 'open';
  document.body.classList.toggle('ctx-open', open);
  $('#ctxbtn').setAttribute('aria-expanded', String(open || (drawer && drawer.el === box)));
  box.innerHTML = '<div class="ctxhead"><h2 id="ctx-title">About this view</h2><button type="button" id="ctxclose" class="iconbtn">Close<span class="visually-hidden"> the About this view panel</span></button></div>' +
    '<dl class="guide"><dt>What it is</dt><dd>' + esc(g.what) + '</dd><dt>Why it matters</dt><dd>' + esc(g.why) + '</dd><dt>How it works</dt><dd>' + esc(g.how) + '</dd></dl>' +
    '<details><summary>Use it in real life, and what you get</summary><dl class="guide"><dt>In real life</dt><dd>' + esc(g.life) + '</dd><dt>What you get</dt><dd>' + esc(g.outcome) + '</dd></dl></details>' +
    '<details><summary>Technical depth</summary><p>' + esc(g.technical) + '</p></details>' +
    '<details><summary>What is uncertain</summary><p>' + esc(g.uncertain) + '</p></details>' +
    (terms.length ? '<h3>Terms used here</h3><dl class="guide terms">' + terms.map(t => '<dt>' + esc(t.term) + '</dt><dd>' + esc(t.plain) + '</dd>').join('') + '</dl>' : '') +
    '<p class="muted"><a href="#/glossary">All terms in the glossary</a></p>';
  $('#ctxclose').onclick = () => {
    if (drawer && drawer.el === box) closeDrawers();
    else { settings.context = 'closed'; saveSettings(); renderContext(); $('#ctxbtn').focus(); }
  };
}
function toggleContext() {
  const box = $('#context'), btn = $('#ctxbtn');
  if (ctxOverlay()) { if (drawer && drawer.el === box) closeDrawers(); else { renderContext(); openDrawer(box, btn); } return; }
  settings.context = settings.context === 'open' ? 'closed' : 'open'; saveSettings(); renderContext();
  if (settings.context === 'open') { const t = $('#ctx-title'); t.setAttribute('tabindex', '-1'); t.focus(); }
}

/* Status bar: where work is kept, network and offline state, and mode. */
function renderStatusBar() {
  const eng = store ? store.engine : 'pending';
  $('#engine').textContent = eng === 'indexeddb' ? 'Browser database' : eng === 'localstorage' ? 'Fallback storage' : eng === 'memory' ? 'Not stored' : 'Checking…';
  $('#engine').title = store ? 'Planning data is kept in ' + ENGINE_LABEL[store.engine] + (store.reason && store.engine !== 'indexeddb' ? '. Reason: ' + store.reason : '') + '.' : '';
  const off = { file: 'Works offline (local copy)', cached: 'Offline copy saved', installing: 'Saving an offline copy…', failed: 'Offline copy unavailable', none: 'Keep a downloaded copy for offline use', checking: 'Checking offline use…' };
  $('#offline').textContent = off[ui.offline] || off.checking;
}

/* ---------- 6a. Workflows and decision rights ---------- */
function workflowsView(opts = {}) {
  const ORDER = ['Start', 'Operate every day', 'Plan', 'Specify', 'Install', 'Evaluate', 'Decide', 'Communicate'];
  const phases = [...new Set(D.workflows.map(w => w.phase))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  $('#view').innerHTML = heading('Trigger · owner · authority · acceptance · escalation', 'Workflows & decision rights',
    'Sixteen workflows take a site from opening this bundle to a scale decision. Each names its trigger, prerequisites, owner and decision authority, inputs, steps, record, acceptance criteria and escalation route.') +
    '<h2 id="rights">Who may stop, restart, scale or publish</h2><p>Program rules to adopt in the charter (document 10). Timing entries are program defaults to agree locally; no authority can waive an applicable legal requirement.</p>' +
    '<div class="tablewrap" tabindex="0" role="region" aria-labelledby="rights"><table><thead><tr><th scope="col">Decision</th><th scope="col">Who may start it</th><th scope="col">Who decides</th><th scope="col">Minimum evidence</th><th scope="col">Timing</th><th scope="col">Record</th><th scope="col">Escalation</th></tr></thead><tbody>' +
    D.decisionRights.map(r => '<tr><td><strong>' + esc(r.decision) + '</strong></td><td>' + esc(r.initiate) + '</td><td>' + esc(r.decide) + '</td><td>' + esc(r.evidence) + '</td><td>' + esc(r.timing) + '</td><td>' + esc(r.record) + '</td><td>' + esc(r.escalate) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    phases.map(p => '<h2>' + esc(p) + '</h2>' + D.workflows.filter(w => w.phase === p).map(workflowCard).join('')).join('');
  wireLinks();
  const target = opts.focusWorkflow || ui.openWorkflow;
  ui.openWorkflow = null;
  if (target) {
    const el = document.getElementById('wf-' + target);
    if (el) { el.open = true; window.setTimeout(() => { el.scrollIntoView({ block: 'start' }); el.querySelector('summary').focus(); }, 0); opts.noFocus = true; }
  }
}
function workflowCard(w) {
  const row = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
  return '<details class="wfcard" id="wf-' + w.id + '"><summary>' + w.id + ' · ' + esc(w.title) + ' ' + badge(w.kind) + (w.gate ? ' <span class="tag">' + w.gate + '</span>' : '') + '</summary><dl>' +
    row('Trigger', esc(w.trigger)) + row('Prerequisites', esc(w.prerequisites)) + row('Owner', esc(w.owner)) + row('Decision authority', esc(w.authority)) +
    row('Inputs', esc(w.inputs)) + row('Steps', '<ol>' + w.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>') + row('Output or record', esc(w.outputs)) +
    row('Acceptance / completion', esc(w.acceptance)) + row('Exceptions and escalation', esc(w.escalation)) +
    row('Documents', linkDocs(w.docs)) + row('Registers', w.registers.map(r => '<button type="button" class="linkbtn" data-open-reg="' + r + '">' + esc(pretty(r)) + '</button>').join(' ')) + '</dl></details>';
}

/* ---------- 6b. Implementation plan (tasks and site profile) ---------- */
function planView() {
  const p = state.profile, f = ui.taskFilter;
  const opt = (v, l, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + l + '</option>';
  $('#view').innerHTML = heading('Owners · dates · evidence', 'Implementation plan', 'Task completion never substitutes for professional or authority approval. Changing a task\'s status or evidence reopens its gate and later gates; changing an owner or date does not.') +
    '<details open><summary>Non-sensitive site profile</summary><div class="formgrid">' +
    '<label for="site">Site or project code<input id="site" maxlength="200" value="' + esc(state.site) + '" aria-describedby="site-hint"><span class="hint" id="site-hint">A code such as S-014 — not an address or a person\'s name.</span></label>' +
    [['country', 'Country'], ['region', 'State / province / territory'], ['municipality', 'Municipality'], ['business', 'Business type']].map(([k, l]) => '<label for="pf-' + k + '">' + l + '<input id="pf-' + k + '" data-profile="' + k + '" maxlength="200" value="' + esc(p[k]) + '"></label>').join('') +
    '</div></details>' +
    '<div class="toolbar"><label for="f-gate">Gate<select id="f-gate">' + opt('all', 'All gates', f.gate) + D.gates.map(g => opt(g.id, g.id + ' · ' + esc(g.title), f.gate)).join('') + '</select></label>' +
    '<label for="f-kind">Kind of work<select id="f-kind">' + opt('all', 'All kinds', f.kind) + Object.entries(KIND).map(([k, v]) => opt(k, v[1], f.kind)).join('') + '</select></label>' +
    '<label for="f-status">Status<select id="f-status">' + opt('all', 'Any status', f.status) + ['open', 'in_progress', 'blocked', 'done', 'not_applicable'].map(s => opt(s, pretty(s), f.status)).join('') + '</select></label>' +
    '<button type="button" id="taskcsv">Download task board CSV</button></div><p id="taskcount" class="muted"></p><div id="tasks"></div>';
  $('#site').oninput = e => { state.site = e.target.value; inlineWarning(e.target, e.target.value, 'record'); save({ debounce: true }); };
  $$('[data-profile]').forEach(el => el.oninput = () => { state.profile[el.dataset.profile] = el.value; inlineWarning(el, el.value, 'record'); save({ debounce: true }); });
  ['gate', 'kind', 'status'].forEach(k => $('#f-' + k).onchange = e => { ui.taskFilter[k] = e.target.value; renderTasks(); });
  $('#taskcsv').onclick = () => download('child-safer-tasks-' + today() + '.csv', C.csv(['id', 'gate', 'kind', 'workflow', 'task', 'owner', 'due', 'status', 'evidence'],
    D.tasks.map(t => { const s = taskState(t); return [t.id, t.gate, KIND[t.kind][1], t.workflow, t.title, s.owner, s.due, s.status, s.evidence]; })), 'text/csv');
  renderTasks();
}
function taskState(t) { return state.tasks[t.id] || { owner: t.owner, due: '', status: 'open', evidence: '' }; }
function renderTasks() {
  const f = ui.taskFilter;
  const list = D.tasks.filter(t => (f.gate === 'all' || t.gate === f.gate) && (f.kind === 'all' || t.kind === f.kind) && (f.status === 'all' || taskState(t).status === f.status));
  $('#taskcount').textContent = list.length + ' of ' + D.tasks.length + ' tasks shown.';
  $('#tasks').innerHTML = list.map(t => {
    const s = taskState(t), id = t.id;
    return '<details class="taskcard"><summary><span class="tag">' + t.gate + '</span> ' + badge(t.kind) + ' ' + esc(t.id + ' · ' + t.title) + ' <small>— ' + esc(pretty(s.status)) + (C.taskComplete(s) ? ' · evidence recorded' : '') + '</small></summary>' +
      '<p class="muted">Workflow: <button type="button" data-open-wf="' + t.workflow + '">' + t.workflow + '</button></p><div class="formgrid">' +
      '<label for="' + id + '-owner">Owner role<input id="' + id + '-owner" data-task="' + id + '" data-field="owner" maxlength="1000" value="' + esc(s.owner) + '"></label>' +
      '<label for="' + id + '-due">Due date<input id="' + id + '-due" type="date" data-task="' + id + '" data-field="due" value="' + esc(s.due) + '"></label>' +
      '<label for="' + id + '-status">Status<select id="' + id + '-status" data-task="' + id + '" data-field="status">' + ['open', 'in_progress', 'blocked', 'done', 'not_applicable'].map(v => '<option value="' + v + '"' + (s.status === v ? ' selected' : '') + '>' + pretty(v) + '</option>').join('') + '</select></label>' +
      '<label for="' + id + '-evidence">Evidence reference or not-applicable rationale<input id="' + id + '-evidence" data-task="' + id + '" data-field="evidence" maxlength="10000" value="' + esc(s.evidence) + '" aria-describedby="' + id + '-ehint"><span class="hint" id="' + id + '-ehint">A pointer to the controlled record (e.g. DOC-123), not the record itself.</span></label>' +
      '</div></details>';
  }).join('') || '<p>No tasks match these filters.</p>';
  wireLinks($('#tasks'));
  $$('[data-task]').forEach(el => el.onchange = () => {
    const t = D.tasks.find(x => x.id === el.dataset.task);
    let r;
    try { r = C.applyTaskChange(state, D, t.id, el.dataset.field, el.value); } catch (e) { announce(e.message); return; }
    save();
    if (['owner', 'evidence'].includes(el.dataset.field)) inlineWarning(el, el.value, 'record');
    const s = taskState(t);
    el.closest('details').querySelector('summary small').textContent = '— ' + pretty(s.status) + (C.taskComplete(s) ? ' · evidence recorded' : '');
    if (r.reopened.length) announce('Reopened ' + r.reopened.join(', ') + ' because ' + t.id + ' ' + el.dataset.field + ' changed. Record those gates again when ready.');
    else if (['done', 'not_applicable'].includes(s.status) && !s.evidence.trim()) announce('Saved. This task cannot satisfy its gate until it has an evidence reference or rationale.');
    else announce('Saved ' + t.id + '.');
  });
}

/* ---------- 6c. Decision gates ---------- */
function gatesView() {
  $('#view').innerHTML = heading('Evidence before advancement', 'Decision gates', 'Record the decision date, approving role and a reference to the signed record. The tracker is a planning record, not an approval.') +
    '<div class="notice" id="progress"></div><div id="gatelist"></div><h2>Recent gate events</h2><div id="gatelog"></div>';
  renderGates();
}
function renderGates() {
  const st = C.gateStatus(state, D), n = st.filter(g => g.done).length;
  $('#progress').innerHTML = '<strong>' + n + ' of ' + D.gates.length + ' gates recorded complete</strong><div class="meter" role="img" aria-label="' + n + ' of ' + D.gates.length + ' gates complete"><span style="width:' + (n / D.gates.length * 100) + '%"></span></div>' +
    '<p>Gates are sequential. Amending a recorded decision, or changing a task\'s status or evidence, reopens that gate and every later gate.</p>';
  $('#gatelist').innerHTML = st.map(g => {
    const def = D.gates.find(x => x.id === g.id), chip = g.done ? '<span class="chip done">Recorded complete</span>' : g.ready ? '<span class="chip ready">Ready to record</span>' : '<span class="chip blocked">Not ready</span>';
    const why = !g.priorDone ? 'Earlier gates must be recorded complete first.' : g.missing.length ? 'Tasks still needing a disposition with evidence: ' + g.missing.join(', ') + '.' : '';
    return '<div class="card gate" id="gate-' + g.id + '"><div class="gatehead"><h2>' + g.id + ' · ' + esc(def.title) + '</h2>' + chip + '</div><p>Accountable: ' + esc(def.owner) + '. Evidence to advance: ' + esc(def.evidence) + '.</p>' +
      (why ? '<p class="muted">' + esc(why) + (g.missing.length ? ' <button type="button" data-gate-tasks="' + g.id + '">Show these tasks</button>' : '') + '</p>' : '') +
      (g.done
        ? '<p><strong>Decision record:</strong> ' + esc(g.note) + (g.decidedAt ? ' <span class="muted">(recorded ' + esc(g.decidedAt.slice(0, 10)) + ')</span>' : '') + '</p><div class="toolbar"><button type="button" data-amend="' + g.id + '">Amend decision record…</button><button type="button" data-reopen="' + g.id + '">Reopen gate…</button></div><div data-gatebox="' + g.id + '"></div>'
        : '<label for="note-' + g.id + '">Decision date, approving role and signed-record reference<input id="note-' + g.id + '" data-note="' + g.id + '" maxlength="10000" value="' + esc(g.note) + '"></label><div class="toolbar"><button type="button" data-complete="' + g.id + '"' + (g.ready ? '' : ' disabled') + '>Record ' + g.id + ' complete</button></div>') +
      '</div>';
  }).join('');
  const log = (state.log || []).filter(e => e.type.startsWith('gate')).slice(-12).reverse();
  $('#gatelog').innerHTML = log.length ? '<ul>' + log.map(e => '<li><span class="muted">' + esc(e.at.slice(0, 16).replace('T', ' ')) + '</span> ' + esc(e.detail) + '</li>').join('') + '</ul>' : '<p class="muted">No gate events yet.</p>';
  $$('[data-note]').forEach(el => el.oninput = () => { try { C.setGateNote(state, D, el.dataset.note, el.value); } catch (e) { announce(e.message); return; } inlineWarning(el, el.value, 'record'); save({ debounce: true }); });
  $$('[data-complete]').forEach(b => b.onclick = () => {
    const id = b.dataset.complete;
    try { C.completeGate(state, D, id, $('#note-' + id).value); } catch (e) { announce(e.message); return; }
    save(); renderGates(); announce(id + ' recorded complete. This is a planning record; the signed decision stays in your controlled system.');
    const nb = $('#gate-' + id + ' h2'); if (nb) { nb.setAttribute('tabindex', '-1'); nb.focus(); }
  });
  $$('[data-gate-tasks]').forEach(b => b.onclick = () => { ui.taskFilter = { gate: b.dataset.gateTasks, kind: 'all', status: 'all' }; go('plan'); });
  $$('[data-amend]').forEach(b => b.onclick = () => gateConfirm(b.dataset.amend, 'amend'));
  $$('[data-reopen]').forEach(b => b.onclick = () => gateConfirm(b.dataset.reopen, 'reopen'));
}
function gateConfirm(id, mode) {
  const st = C.gateStatus(state, D), i = st.findIndex(g => g.id === id), affected = st.slice(i).filter(g => g.done).map(g => g.id);
  const box = document.querySelector('[data-gatebox="' + id + '"]');
  box.innerHTML = '<div class="confirm" role="group" aria-label="Confirm change to ' + id + '"><p><strong>This reopens ' + affected.join(', ') + '.</strong> Each will need to be recorded again after review. An undo copy is kept.</p>' +
    (mode === 'amend' ? '<label for="amend-' + id + '">Amended decision record<input id="amend-' + id + '" maxlength="10000" value="' + esc(state.gates[id].note) + '"></label>' : '') +
    '<div class="toolbar"><button type="button" id="gc-yes">' + (mode === 'amend' ? 'Save amendment and reopen' : 'Reopen') + '</button><button type="button" id="gc-no">Cancel</button></div></div>';
  (mode === 'amend' ? $('#amend-' + id) : $('#gc-yes')).focus();
  $('#gc-no').onclick = () => { box.innerHTML = ''; };
  $('#gc-yes').onclick = () => {
    snapshot((mode === 'amend' ? 'amend ' : 'reopen ') + id);
    const r = mode === 'amend' ? C.amendGate(state, D, id, $('#amend-' + id).value) : C.reopenGate(state, D, id);
    save(); renderGates(); announce('Reopened ' + (r.reopened.join(', ') || id) + '.');
  };
}

/* ---------- 6d. Documents & templates ---------- */
function libraryView() {
  $('#view').innerHTML = heading('Read · adapt · use', 'Documents & templates', D.docs.length + ' connected documents. Drafts save in this browser as you type; the original issue text is always recoverable.') +
    '<div class="toolbar"><label for="search" class="grow">Search full text<input type="search" id="search" placeholder="e.g. cart, bevel, withdrawal"></label>' +
    '<label for="role">Role pack<select id="role">' + ['All roles', ...Object.keys(D.rolePacks)].map(r => '<option>' + r + '</option>').join('') + '</select></label>' +
    '<button type="button" id="pack">Download selected pack</button><button type="button" id="packprint">Print selected pack</button></div><p id="count" class="muted" role="status"></p><div class="doclist" id="doclist"></div>';
  $('#search').oninput = filterDocs; $('#role').onchange = filterDocs;
  $('#pack').onclick = () => downloadHandbook(roleDocs($('#role').value), $('#role').value + ' working pack');
  $('#packprint').onclick = () => printDocs(roleDocs($('#role').value), $('#role').value + ' working pack');
  filterDocs();
}
function filterDocs() {
  const q = $('#search').value.trim().toLowerCase();
  const found = roleDocs($('#role').value).filter(d => !q || (d.title + ' ' + body(d)).toLowerCase().includes(q));
  $('#count').textContent = found.length + ' document' + (found.length === 1 ? '' : 's') + (q ? ' match "' + q + '"' : '');
  $('#doclist').innerHTML = found.map(d => {
    const ds = draftStatus(d.id);
    return '<button type="button" class="docitem" data-open-doc="' + d.id + '"><span class="docid">' + d.id + '</span><span>' + esc(d.title) + '<small>' + esc(d.role) +
      (ds === 'draft' ? ' · local draft' : ds === 'review' ? ' · local draft · original updated — review' : '') + '</small>' + (q ? '<span class="snippet">' + esc(C.snippet(body(d), q)) + '</span>' : '') + '</span></button>';
  }).join('') || '<p>No matches. Try a broader term.</p>';
  wireLinks($('#doclist'));
}
function openDoc(id, opts = {}) {
  flush();
  const d = docById(id); if (!d) return;
  if (ui.atmo) { ui.atmo.destroy(); ui.atmo = null; }
  ui.activeDoc = id; ui.view = 'library';
  markNav('library');
  $('#crumb').textContent = 'Explore / Document ' + id;
  setTitle(id + ' ' + d.title);
  const lang = d.lang ? ' lang="' + esc(d.lang) + '"' : '';
  const ds = draftStatus(id);
  $('#view').innerHTML = '<div class="toolbar no-print"><button type="button" id="back">← Document library</button><button type="button" id="docdownload">Download current text</button><button type="button" id="docprint">Print current document</button></div>' +
    '<p class="eyebrow">Document ' + id + ', ' + esc(d.role) + '</p><h1 tabindex="-1"' + lang + '>' + esc(d.title) + '</h1>' +
    '<p class="muted">Draft for organizational adoption. Sources checked ' + esc(D.sourcesChecked) + '.' + (ds !== 'original' ? ' <strong>Showing your local draft.</strong>' : '') + '</p>' +
    (d.lang ? '<div class="notice warning"><p><strong>Draft translation.</strong> No native speaker has reviewed this document yet. Have it reviewed before official use.</p></div>' : '') +
    (ds === 'review' ? '<div class="notice warning" id="reviewbox"><p><strong>The original of this document was corrected after your draft was started.</strong> Your draft still shows your text. Compare it with the current original before relying on it.</p><div class="toolbar"><button type="button" id="cmp">Compare with current original</button><button type="button" id="keep">Keep my draft (mark reviewed)</button><button type="button" id="replace">Replace with current original…</button></div><div id="diffbox"></div></div>' : '') +
    '<details class="editpanel" id="editpanel"><summary>Edit this document</summary><p>Non-sensitive planning only. Text saves in this browser as you type.</p>' +
    '<label for="editor">Document text (Markdown)<textarea id="editor" class="editor" maxlength="200000">' + esc(body(d)) + '</textarea></label><div id="docwarn"></div>' +
    '<div class="toolbar"><button type="button" id="saveedit">Save and refresh preview</button>' + (ds !== 'original' ? '<button type="button" id="restore">Restore original…</button>' : '') + '<button type="button" id="cmp2">Compare with original</button></div><div id="restorebox"></div><div id="diffbox2"></div></details>' +
    '<article class="doc" id="docbody"' + lang + '>' + C.markdown(body(d), D.sources, { label: 'Document ' + id }) + '</article>' + citedSources(d);
  $('#back').onclick = () => go('library');
  $('#editor').oninput = () => {
    const v = $('#editor').value;
    if (v === d.body) { delete state.edits[id]; delete state.editMeta[id]; }
    else {
      state.edits[id] = v;
      if (!state.editMeta[id]) state.editMeta[id] = { base: D.docHashes[id], savedAt: '' };
      state.editMeta[id].savedAt = new Date().toISOString();
    }
    const f = C.scanSensitive(v, 'document');
    $('#docwarn').innerHTML = f.length ? '<div class="inline-warning" role="note">This text may contain ' + esc(f.map(x => x.label).join(', ')) + '. Remove personal details from planning documents.</div>' : '';
    save({ debounce: true });
  };
  $('#saveedit').onclick = () => { save(); $('#docbody').innerHTML = C.markdown(body(d), D.sources, { label: 'Document ' + id }); announce('Saved and preview refreshed.'); };
  $('#editpanel').ontoggle = () => { if (!$('#editpanel').open) { flush(); $('#docbody').innerHTML = C.markdown(body(d), D.sources, { label: 'Document ' + id }); } };
  $('#docdownload').onclick = () => download(id + '-' + fileSafe(d.title) + '.md', '# ' + d.title + '\n\n' + body(d));
  $('#docprint').onclick = () => printDocs([d], d.id + ' ' + d.title);
  const showDiff = box => {
    const parts = C.lineDiff(d.body, body(d));
    box.innerHTML = '<p class="muted">Lines marked "−" are only in the current original; lines marked "+" are only in your draft.</p><div class="diff" tabindex="0" role="region" aria-label="Differences">' + compactDiff(parts) + '</div>';
  };
  if ($('#cmp')) $('#cmp').onclick = () => showDiff($('#diffbox'));
  $('#cmp2').onclick = () => showDiff($('#diffbox2'));
  if ($('#keep')) $('#keep').onclick = () => { state.editMeta[id] = { base: D.docHashes[id], savedAt: new Date().toISOString() }; C.addLog(state, 'draft-reviewed', 'Draft ' + id + ' marked reviewed against the current original.'); save(); openDoc(id, { noFocus: true }); announce('Draft kept and marked reviewed.'); };
  const restore = (box, label) => {
    box.innerHTML = '<div class="confirm" role="group" aria-label="Confirm restore"><p>Replace your draft of document ' + id + ' with the current original? An undo copy is kept.</p><div class="toolbar"><button type="button" id="rs-yes">' + label + '</button><button type="button" id="rs-no">Keep my draft</button></div></div>';
    $('#rs-yes').focus();
    $('#rs-no').onclick = () => { box.innerHTML = ''; };
    $('#rs-yes').onclick = () => { snapshot('restore document ' + id); delete state.edits[id]; delete state.editMeta[id]; C.addLog(state, 'draft-restored', 'Document ' + id + ' restored to the current original.'); save(); openDoc(id, { noFocus: true }); announce('Original restored. Use Undo to bring your draft back.'); };
  };
  if ($('#replace')) $('#replace').onclick = () => restore($('#diffbox'), 'Replace with current original');
  if ($('#restore')) $('#restore').onclick = () => restore($('#restorebox'), 'Restore original now');
  renderContext();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  if (!opts.noFocus) $('#view h1').focus();
}
function compactDiff(parts) {
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === 'same') {
      let j = i; while (j < parts.length && parts[j].type === 'same') j++;
      const run = j - i;
      if (run > 4) { out.push(line(parts[i]), line(parts[i + 1]), '<div class="note">… ' + (run - 4) + ' unchanged lines …</div>', line(parts[j - 2]), line(parts[j - 1])); i = j - 1; continue; }
    }
    out.push(line(p));
  }
  function line(p) {
    if (p.type === 'note') return '<div class="note">' + esc(p.text) + '</div>';
    const pre = p.type === 'add' ? '+ ' : p.type === 'del' ? '− ' : '  ';
    const sr = p.type === 'add' ? '<span class="visually-hidden">Only in your draft: </span>' : p.type === 'del' ? '<span class="visually-hidden">Only in the current original: </span>' : '';
    return '<div class="' + p.type + '">' + sr + esc(pre + p.text) + '</div>';
  }
  return out.join('') || '<div class="note">No differences.</div>';
}

/* ---------- 6e. Planning registers ---------- */
function registersView() {
  const name = ui.registerName, meta = D.registerMeta[name];
  $('#view').innerHTML = heading('Non-sensitive draft records', 'Planning registers', 'Edit planning rows locally, download CSVs, or import a matching CSV after preview. Official and personal records stay in your approved systems.') +
    '<div class="notice warning">No children\'s identities, health or claims details, CCTV, witness data or confidential contracts. Each register holds up to 500 planning rows. Saving runs a basic personal-data check.</div>' +
    '<div class="toolbar"><label for="regselect">Register<select id="regselect">' + D.registers.map(n => '<option value="' + n + '"' + (n === name ? ' selected' : '') + '>' + esc(pretty(n)) + '</option>').join('') + '</select></label></div>' +
    '<p><strong>' + esc(pretty(name)) + ':</strong> ' + esc(meta.purpose) + '</p><p class="muted">Related documents: ' + linkDocs(meta.docs) + ' · Workflows: ' + meta.workflows.map(w => '<button type="button" data-open-wf="' + w + '">' + w + '</button>').join(' ') + '</p>' +
    '<div class="toolbar"><button type="button" id="addrow">Add row</button><button type="button" id="exportreg">Download current CSV</button><button type="button" id="blankreg">Download blank template</button><button type="button" id="importregbutton">Import CSV…</button><input type="file" id="importreg" accept=".csv,text/csv" aria-label="Choose a CSV file for this register" hidden><button type="button" id="example" aria-expanded="false" aria-controls="examplebox">Show fictional example</button></div>' +
    '<div id="examplebox" hidden></div><div id="csvpreview"></div><div id="rowform"></div><div id="regtable"></div>';
  wireLinks();
  $('#regselect').onchange = () => {
    ui.registerName = $('#regselect').value; registersView(); $('#regselect').focus();
    try { window.history.replaceState(null, '', '#/registers/' + ui.registerName); ui.renderedHash = window.location.hash; } catch (e) { /* address bar unchanged */ }
  };
  $('#addrow').onclick = () => editRow(-1);
  $('#exportreg').onclick = () => download('child-safer-' + name + '-' + today() + '.csv', C.csv(D.schemas[name], state.records[name] || []), 'text/csv');
  $('#blankreg').onclick = () => download(name + '-blank.csv', C.csv(D.schemas[name], []), 'text/csv');
  $('#example').onclick = () => {
    const box = $('#examplebox'), open = box.hidden;
    box.hidden = !open; $('#example').setAttribute('aria-expanded', String(open)); $('#example').textContent = open ? 'Hide fictional example' : 'Show fictional example';
    box.innerHTML = open ? '<div class="card"><p><span class="badge cat-ILLUSTRATION">Fictional example — not saved</span> Use it to see how each column is filled in.</p><div class="tablewrap" tabindex="0" role="region" aria-label="Fictional example row"><table><tbody>' +
      D.schemas[name].map((h, i) => '<tr><th scope="row">' + esc(pretty(h)) + '</th><td>' + esc(meta.example[i] || '') + '</td></tr>').join('') + '</tbody></table></div></div>' : '';
  };
  $('#importregbutton').onclick = () => $('#importreg').click();
  $('#importreg').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5000000) throw Error('The CSV is larger than 5 MB.');
      const res = C.registerImport(await file.text(), D.schemas[name]);
      const flagged = res.rows.map((r, i) => C.scanSensitive(r.join('\n'), meta.scan).length ? i + 2 : 0).filter(Boolean);
      const cur = (state.records[name] || []).length;
      $('#csvpreview').innerHTML = '<div class="notice" role="group" aria-label="CSV import preview"><p><strong>' + res.rows.length + ' matching rows ready to import.</strong> Applying replaces the current ' + cur + ' row' + (cur === 1 ? '' : 's') + ' in this register; an undo copy is kept.</p>' +
        (res.delimiter !== ',' ? '<p>The file is ' + (res.delimiter === ';' ? 'semicolon' : 'tab') + '-separated; it was read correctly.</p>' : '') +
        (res.restored ? '<p>' + res.restored + ' cell(s) had the apostrophe this workspace adds to formula-like text on export; it was removed again.</p>' : '') +
        (flagged.length ? '<p class="inline-warning">Rows ' + flagged.slice(0, 12).join(', ') + (flagged.length > 12 ? '…' : '') + ' may contain personal or sensitive details. Review them after import.</p>' : '') +
        '<div class="toolbar"><button type="button" id="applycsv">Apply CSV replacement</button><button type="button" id="cancelcsv">Cancel</button></div></div>';
      $('#applycsv').focus();
      $('#applycsv').onclick = () => { snapshot('CSV import into ' + pretty(name)); state.records[name] = res.rows; C.addLog(state, 'csv-imported', res.rows.length + ' rows imported into ' + name + '.'); save(); registersView(); announce(res.rows.length + ' rows imported. Use Undo to restore the previous rows.'); };
      $('#cancelcsv').onclick = () => { $('#csvpreview').innerHTML = ''; announce('CSV import cancelled; nothing changed.'); };
    } catch (err) { announce('CSV import rejected: ' + err.message + ' Current rows were not changed.'); }
  };
  renderRegister();
}
function renderRegister() {
  const name = ui.registerName, rows = state.records[name] || [], headers = D.schemas[name];
  $('#regtable').innerHTML = '<p>' + rows.length + ' draft row' + (rows.length === 1 ? '' : 's') + '. CSV exports add an apostrophe before formula-like text so spreadsheets do not run it.</p>' +
    (rows.length ? '<div class="tablewrap" tabindex="0" role="region" aria-label="' + esc(pretty(name)) + ' rows"><table><thead><tr><th scope="col">Action</th>' + headers.map(h => '<th scope="col">' + esc(pretty(h)) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r, i) => '<tr><td><button type="button" data-editrow="' + i + '">Edit row ' + (i + 1) + '</button></td>' + r.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'
      : '<div class="card">No rows yet. Add a draft row or import a matching CSV. Fictional examples are never copied into these rows.</div>');
  $$('[data-editrow]').forEach(b => b.onclick = () => editRow(Number(b.dataset.editrow)));
}
function editRow(index) {
  const name = ui.registerName, rows = state.records[name] || [], headers = D.schemas[name], meta = D.registerMeta[name];
  if (index < 0 && rows.length >= 500) { announce('This register is limited to 500 planning rows.'); return; }
  const values = index < 0 ? headers.map(() => '') : rows[index];
  $('#rowform').innerHTML = '<div class="card"><h2 tabindex="-1" id="rowtitle">' + (index < 0 ? 'Add a draft row' : 'Edit row ' + (index + 1)) + '</h2><div class="formgrid">' +
    headers.map((h, i) => { const hint = hintFor(h); return '<label for="cell-' + i + '">' + esc(pretty(h)) + '<input id="cell-' + i + '" data-cell="' + i + '" maxlength="10000" value="' + esc(values[i]) + '"' + (hint ? ' aria-describedby="cellhint-' + i + '"' : '') + '>' + (hint ? '<span class="hint" id="cellhint-' + i + '">' + esc(hint) + '</span>' : '') + '</label>'; }).join('') +
    '</div><div id="rowconfirm"></div><div class="toolbar"><button type="button" id="saverow" class="primary">Save row</button><button type="button" id="cancelrow">Cancel</button>' + (index >= 0 ? '<button type="button" id="deleterow" class="danger">Remove row…</button>' : '') + '</div><div id="deletebox"></div></div>';
  const commit = row => {
    if (!state.records[name]) state.records[name] = [];
    if (index < 0) state.records[name].push(row); else state.records[name][index] = row;
    save(); $('#rowform').innerHTML = ''; renderRegister(); announce('Row saved in ' + pretty(name) + '.');
  };
  $('#saverow').onclick = () => {
    const row = $$('[data-cell]').map(x => x.value);
    if (!row.some(v => v.trim())) { announce('Enter at least one value.'); return; }
    const f = C.scanSensitive(row.join('\n'), meta.scan);
    if (f.length) confirmSensitive($('#rowconfirm'), f, () => commit(row)); else commit(row);
  };
  $('#cancelrow').onclick = () => { $('#rowform').innerHTML = ''; };
  if (index >= 0) $('#deleterow').onclick = () => {
    $('#deletebox').innerHTML = '<div class="confirm" role="group" aria-label="Confirm removal"><p>Remove row ' + (index + 1) + '? An undo copy is kept.</p><div class="toolbar"><button type="button" id="confirmdelete" class="danger">Remove this row</button><button type="button" id="keeprow">Keep it</button></div></div>';
    $('#confirmdelete').focus();
    $('#keeprow').onclick = () => { $('#deletebox').innerHTML = ''; };
    $('#confirmdelete').onclick = () => { snapshot('remove row ' + (index + 1) + ' from ' + pretty(name)); state.records[name].splice(index, 1); C.addLog(state, 'row-deleted', 'Row ' + (index + 1) + ' removed from ' + name + '.'); save(); $('#rowform').innerHTML = ''; renderRegister(); announce('Row removed. Use Undo to restore it.'); };
  };
  $('#rowform').scrollIntoView({ block: 'start' });
  $('#rowtitle').focus();
}

/* ---------- 6f. Cost scenarios ---------- */
const FIELDS = [['initial', 'Initial cost, including removal reserve'], ['annual', 'Year-1 added operating cost'], ['loss', 'Year-1 retained addressable loss'], ['reduction', 'Assumed loss reduction (%)'],
  ['other', 'Year-1 documented other savings'], ['years', 'Horizon (1–30 whole years)'], ['discount', 'Annual discount rate (%)'], ['escalation', 'Annual escalation (%)'],
  ['replacementCost', 'One-time replacement cost'], ['replacementYear', 'Replacement year (0 = none)'], ['salvage', 'Terminal salvage'], ['withdrawYear', 'Early withdrawal at end of year (0 = none)'], ['removalCost', 'Removal cost beyond the reserve']];
const RANGE_LABELS = { initial: 'Initial cost', annual: 'Year-1 added operating cost', loss: 'Year-1 retained loss', reduction: 'Assumed reduction (%)', discount: 'Discount rate (%)' };
function calcView() {
  const c = state.calc, r = state.ranges;
  $('#view').innerHTML = heading('Assumptions · not a forecast', 'Cost scenarios', 'Replace the illustrative inputs with quotes and validated retained-loss data. No injury benefit, insurance saving or tax effect is assumed.') +
    '<div class="formgrid three"><label for="currency">Currency label<input id="currency" maxlength="20" value="' + esc(c.currency) + '"></label>' +
    FIELDS.map(([k, l]) => '<label for="c-' + k + '">' + l + '<input id="c-' + k + '" type="number" step="any" inputmode="decimal" value="' + esc(String(c[k])) + '"></label>').join('') + '</div>' +
    '<label for="c-otherBasis">Basis for other savings (required if above zero)<textarea id="c-otherBasis" rows="2" maxlength="1000" aria-describedby="basis-hint">' + esc(c.otherBasis || '') + '</textarea><span class="hint" id="basis-hint">For example a signed quote or contract. Assumed premium reductions and insurer payments are excluded.</span></label>' +
    '<h2>Uncertainty ranges (optional)</h2><p>Enter your own low and high values. Leave both blank to skip a row. Ranges are assumptions, not probabilities.</p><div class="tablewrap"><table><thead><tr><th scope="col">Assumption</th><th scope="col">Low</th><th scope="col">High</th></tr></thead><tbody>' +
    C.RANGE_KEYS.map(k => '<tr><th scope="row">' + RANGE_LABELS[k] + '</th><td><input aria-label="' + RANGE_LABELS[k] + ' low" id="rl-' + k + '" type="number" step="any" value="' + (r[k] ? r[k][0] : '') + '"></td><td><input aria-label="' + RANGE_LABELS[k] + ' high" id="rh-' + k + '" type="number" step="any" value="' + (r[k] ? r[k][1] : '') + '"></td></tr>').join('') + '</tbody></table></div>' +
    '<div class="toolbar"><button type="button" id="calculate" class="primary">Calculate and save inputs</button><button type="button" id="exportcalc">Download scenario JSON</button><button type="button" id="exportcash">Download cash-flow CSV</button></div>' +
    '<div id="calcresult" aria-live="polite"></div><div class="notice">Escalation starts in year 2; replacement, salvage and removal are year-end amounts. A withdrawal stops costs and benefits after that year. No tax, actuarial loss development or probability model is included. See documents 17 and 44.</div>';
  $('#calculate').onclick = () => compute(true);
  $('#exportcalc').onclick = () => { const res = compute(false); if (res) download('child-safer-cost-scenario-' + today() + '.json', JSON.stringify({ type: 'illustrative-scenario', version: D.version, inputs: res.x, ranges: res.ranges, results: res.y, range: res.range, limitations: 'User assumptions; no tax, actuarial, probability or insurance-saving model.' }, null, 2), 'application/json'); };
  $('#exportcash').onclick = () => { const res = compute(false); if (res) { const h = Object.keys(res.y.rows[0]); download('child-safer-cash-flows-' + today() + '.csv', C.csv(h, res.y.rows.map(row => h.map(k => row[k]))), 'text/csv'); } };
  compute(false);
}
function readCalc() {
  const x = { currency: $('#currency').value, otherBasis: $('#c-otherBasis').value };
  for (const [k, l] of FIELDS) { const v = $('#c-' + k).value; if (!String(v).trim()) throw Error('Fill in "' + l + '".'); x[k] = Number(v); }
  const ranges = {};
  for (const k of C.RANGE_KEYS) {
    const lo = $('#rl-' + k).value, hi = $('#rh-' + k).value;
    if (!lo.trim() && !hi.trim()) continue;
    if (!lo.trim() || !hi.trim()) throw Error('Give both a low and a high value for "' + RANGE_LABELS[k] + '", or leave both blank.');
    ranges[k] = [Number(lo), Number(hi)];
  }
  return { x, ranges };
}
function compute(persist) {
  const box = $('#calcresult');
  try {
    const { x, ranges } = readCalc();
    const y = C.financial(x), range = Object.keys(ranges).length ? C.scenarioRange(x, ranges) : null;
    if (persist) { state.calc = x; state.ranges = ranges; save(); announce('Inputs saved.'); }
    const f = n => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }), cur = ' ' + esc(x.currency);
    const be = y.breakEven === null ? 'Undefined — no addressable loss while the system is in place.' : y.breakEven <= 0 ? 'Not needed: documented other savings and salvage already cover the costs (≤ 0%).' : f(y.breakEven) + '%' + (y.breakEven > 100 ? ' — above 100%, so modelled loss reduction alone cannot pay for it.' : '');
    const rec = n => y.noInitialCost ? 'Not applicable — no initial cost entered' : n === null ? 'Not reached within the horizon' : 'Year ' + n;
    box.innerHTML = '<div class="calcresult"><div>Net present value · ' + x.years + ' years' + (y.withdrawn ? ' · withdrawn after year ' + x.withdrawYear : '') + '</div><strong>' + f(y.npv) + cur + '</strong>' +
      '<p>First undiscounted recovery: ' + rec(y.firstRecovery) + '<br>First discounted recovery: ' + rec(y.firstPVRecovery) + '<br>Discounted break-even loss reduction: ' + be + (y.endsNegative ? '<br>Cumulative cash is negative at the horizon.' : '') + '</p></div>' +
      '<h2>Effect sensitivity</h2><p>Hypothetical scenarios, not estimates of effectiveness. Negative values model new hazards or access problems.</p><div class="tablewrap" tabindex="0" role="region" aria-label="Effect sensitivity"><table><thead><tr><th scope="col">Assumed reduction</th><th scope="col">NPV</th></tr></thead><tbody>' +
      [-10, 0, 10, 25, 50].map(r => '<tr><td>' + r + '%</td><td>' + f(C.financial({ ...x, reduction: r }).npv) + cur + '</td></tr>').join('') + '</tbody></table></div>' +
      (range ? '<h2>Uncertainty ranges</h2><p>Each row moves one assumption between your low and high values with the others at their entered values, largest swing first.</p><div class="tablewrap" tabindex="0" role="region" aria-label="Uncertainty ranges"><table><thead><tr><th scope="col">Assumption</th><th scope="col">Low → NPV</th><th scope="col">High → NPV</th><th scope="col">Swing</th></tr></thead><tbody>' +
        range.rows.map(r => '<tr><td>' + RANGE_LABELS[r.key] + '</td><td>' + f(r.low) + ' → ' + f(r.npvAtLow) + cur + '</td><td>' + f(r.high) + ' → ' + f(r.npvAtHigh) + cur + '</td><td>' + f(r.swing) + cur + '</td></tr>').join('') +
        '</tbody></table></div><p><strong>All pessimistic together:</strong> ' + f(range.pessimistic) + cur + ' · <strong>All optimistic together:</strong> ' + f(range.optimistic) + cur + '</p>' : '') +
      '<h2>Annual cash flows</h2><div class="tablewrap" tabindex="0" role="region" aria-label="Annual cash flows"><table><thead><tr><th scope="col">Year</th><th scope="col">Loss saving</th><th scope="col">Other saving</th><th scope="col">Operating cost</th><th scope="col">Replacement</th><th scope="col">Removal</th><th scope="col">Salvage</th><th scope="col">Net</th><th scope="col">Present value</th><th scope="col">Cumulative discounted</th></tr></thead><tbody>' +
      y.rows.map(r => '<tr>' + ['year', 'gross', 'other', 'cost', 'replacement', 'removal', 'salvage', 'net', 'pv', 'cumulativePV'].map(k => '<td>' + f(r[k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    return { x, y, ranges, range };
  } catch (e) {
    box.innerHTML = '<div class="notice warning">' + esc(e.message) + ' Saved inputs were not changed.</div>';
    if (persist) announce(e.message);
    return null;
  }
}

/* ---------- 6g. Evaluation planning ---------- */
const PFIELDS = [['baselineRate', 'Baseline rate (events per 100,000 entries)'], ['rateRatio', 'Target rate ratio (0.8 = 20% lower)'], ['alpha', 'Two-sided significance level'], ['power', 'Power'],
  ['designEffect', 'Design effect for clustering (1 = none)'], ['exposurePerArm', 'Planned entries per group'], ['observedEvents', 'Observed events (for the upper bound)'], ['observedExposure', 'Observed entries']];
function evaluationView() {
  const p = state.planning;
  $('#view').innerHTML = heading('Planning arithmetic · not a study design', 'Evaluation planning', 'See what a pilot of a given size can and cannot show before anyone claims an injury reduction. An independent statistician must design any effectiveness study.') +
    '<div class="formgrid">' + PFIELDS.map(([k, l]) => '<label for="p-' + k + '">' + l + '<input id="p-' + k + '" type="number" step="any" value="' + esc(String(p[k])) + '"></label>').join('') + '</div>' +
    '<div class="toolbar"><button type="button" id="pcalc" class="primary">Calculate and save inputs</button></div><div id="presult" aria-live="polite"></div>' +
    '<div class="notice">Simple Poisson model with independent events and perfect reporting; the "events needed" figure uses the normal approximation for a log rate ratio with equal exposure. Real requirements are larger when stores differ, reporting changes or exposure is uncertain. See document 35.</div>';
  $('#pcalc').onclick = () => pcompute(true);
  pcompute(false);
}
function pcompute(persist) {
  const box = $('#presult');
  try {
    const x = {};
    for (const [k, l] of PFIELDS) { const v = $('#p-' + k).value; if (!String(v).trim()) throw Error('Fill in "' + l + '".'); x[k] = Number(v); }
    if (!Number.isInteger(x.observedEvents)) throw Error('Observed events must be a whole number.');
    const r = C.evaluationPlan(x);
    if (persist) { state.planning = x; save(); announce('Planning inputs saved.'); }
    const n = v => v >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 100) / 100).toLocaleString();
    box.innerHTML = '<div class="calcresult"><div>Exposure needed per group to detect this effect</div><strong>' + n(r.exposureNeeded) + ' entries</strong>' +
      '<p>That is about ' + n(r.shortfall) + ' times the planned ' + n(x.exposurePerArm) + ' entries per group. It needs about ' + n(r.controlEvents) + ' events in the comparison group and ' + n(r.interventionEvents) + ' in the intervention group.</p></div>' +
      '<h2>What the planned pilot would see</h2><p>At the baseline rate, ' + n(x.exposurePerArm) + ' entries would produce about <strong>' + n(r.expectedControl) + '</strong> events without the change and <strong>' + n(r.expectedIntervention) + '</strong> if the target effect were real. ' +
      (r.shortfall > 1 ? 'Counts this small cannot distinguish the effect from chance; report the pilot as a feasibility study.' : 'This exposure meets the simple calculation; ask a statistician to account for clustering and reporting changes.') + '</p>' +
      '<h2>Upper bound for what you observed</h2><p>' + x.observedEvents + ' event(s) in ' + n(x.observedExposure) + ' entries is ' + n(r.observedRate) + ' per 100,000. The one-sided 95% upper bound is <strong>' + n(r.upperRate) + ' per 100,000</strong>. ' +
      (x.observedEvents === 0 ? 'Zero events do not show zero risk.' : 'A lower observed rate is not evidence of benefit on its own.') + '</p>';
    return r;
  } catch (e) { box.innerHTML = '<div class="notice warning">' + esc(e.message) + '</div>'; if (persist) announce(e.message); return null; }
}

/* ---------- 6h. Evidence ledger and source register ---------- */
function evidenceView() {
  const cats = ['All categories', 'VERIFIED SOURCE FACT', 'PROGRAM RECOMMENDATION', 'ILLUSTRATION', 'UNRESOLVED'];
  $('#view').innerHTML = heading('Claims with boundaries', 'Evidence ledger', 'Source facts constrain decisions; recommendations, illustrations and unresolved questions stay visibly separate. "Transfer" says how far the evidence applies to children in retail.') +
    '<div class="toolbar"><label for="evcat">Category<select id="evcat">' + cats.map(c => '<option>' + c + '</option>').join('') + '</select></label><button type="button" id="evidencecsv">Download evidence ledger CSV</button><button type="button" data-open-doc="32">Read the research protocol (32)</button></div><div id="evtable"></div>' +
    '<div class="notice">No quantitative child-retail injury reduction from any environmental control has been established in this review. A targeted review is not a systematic review, and public standards scopes do not replace licensed methods.</div>';
  const draw = () => {
    const c = $('#evcat').value, rows = D.evidence.filter(e => c === 'All categories' || e.category === c);
    $('#evtable').innerHTML = '<div class="tablewrap" tabindex="0" role="region" aria-label="Evidence ledger"><table><thead><tr><th scope="col">ID / category</th><th scope="col">Claim</th><th scope="col">Sources</th><th scope="col">Setting</th><th scope="col">Transfer to children in retail</th><th scope="col">Basis and limits</th><th scope="col">Implication</th></tr></thead><tbody>' +
      rows.map(e => '<tr><td>' + esc(e.id) + '<br>' + catBadge(e.category) + '</td><td>' + esc(e.claim) + '</td><td>' + (e.sources.map(s => { const x = D.sources.find(y => y.id === s); return x ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(x.title) + '">' + s + '</a>' : s; }).join(', ') || '—') + '</td><td>' + esc(e.setting) + '</td><td>' + esc(e.transfer) + '</td><td>' + esc(e.basis) + '. ' + esc(e.limits) + '</td><td>' + esc(e.implication) + '</td></tr>').join('') + '</tbody></table></div>';
  };
  $('#evcat').onchange = draw; draw();
  $('#evidencecsv').onclick = () => download('child-safer-evidence-ledger.csv', C.csv(['id', 'claim', 'category', 'sources', 'setting', 'transfer', 'basis', 'limits', 'implication'], D.evidence.map(e => [e.id, e.claim, e.category, e.sources.join(','), e.setting, e.transfer, e.basis, e.limits, e.implication])), 'text/csv');
  wireLinks();
}
/* Sources should be re-checked a year after retrieval (core.sourceDue). */
const fresh = s => { const f = C.sourceDue(s, today()); return f.due + (f.overdue ? ' (re-check due now)' : ''); };
function sourcesView() {
  $('#view').innerHTML = heading('Primary sources · applicability', 'Source register', D.sources.length + ' references with jurisdiction, edition or date, retrieval date, access level and limits. Confirm current local law and the actual installed system before relying on any requirement.') +
    '<div class="toolbar"><label for="srcq" class="grow">Filter<input type="search" id="srcq" placeholder="e.g. Ontario, ASTM, regulation"></label><button type="button" id="srccsv">Download source register CSV</button></div><p id="srccount" class="muted" role="status"></p><div id="srclist"></div>';
  const draw = () => {
    const q = $('#srcq').value.trim().toLowerCase();
    const list = D.sources.filter(s => !q || Object.values(s).join(' ').toLowerCase().includes(q));
    $('#srccount').textContent = list.length + ' of ' + D.sources.length + ' sources';
    $('#srclist').innerHTML = list.map(s => {
      const docs = D.docs.filter(d => (d.cites || []).includes(s.id)).map(d => d.id), evs = D.evidence.filter(e => e.sources.includes(s.id)).map(e => e.id);
      return '<section class="source" aria-labelledby="src-' + s.id + '"><span class="tag">' + s.id + '</span> <a id="src-' + s.id + '" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + ' ↗</a><dl>' +
        [['Publisher', s.publisher], ['Jurisdiction', s.jurisdiction], ['Type', s.type], ['Edition / date', s.edition], ['Retrieved', s.retrieved], ['Re-check by', fresh(s)], ['Access', s.access], ['What it supports', s.scope], ['Limits', s.limits]].map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') +
        '<dt>Cited in</dt><dd>' + (docs.length ? linkDocs(docs) : '—') + (evs.length ? ' · evidence ' + evs.join(', ') : '') + '</dd></dl></section>';
    }).join('') || '<p>No sources match.</p>';
    wireLinks($('#srclist'));
  };
  $('#srcq').oninput = draw; draw();
  $('#srccsv').onclick = () => download('child-safer-source-register.csv', C.csv(['id', 'title', 'publisher', 'url', 'jurisdiction', 'type', 'edition', 'retrieved', 'access', 'scope', 'limits'], D.sources.map(s => [s.id, s.title, s.publisher, s.url, s.jurisdiction, s.type, s.edition, s.retrieved, s.access, s.scope, s.limits])), 'text/csv');
}


/* ---------- 6k. Discover ----------
 * The hero shows the child survey band (0–120 cm) beside the headline, the
 * six stages along the "floor", and the optional background scene. */
function bandScale() {
  const ticks = [0, 30, 60, 90, 120].map(cm => '<span class="tick" style="--cm:' + cm + '">' + cm + (cm === 120 ? ' cm' : '') + '</span>').join('');
  const marks = [[92.9, 'tall 2-year-old'], [118.7, 'tall 5-year-old']].map(([cm, l]) => '<span class="mark" style="--cm:' + cm + '">' + Math.round(cm) + ' cm, ' + l + '</span>').join('');
  return '<div class="band" aria-hidden="true"><span class="bandbar"></span>' + ticks + marks + '</div>';
}
function discoverView() {
  const X = D.discover, cite = s => C.inline(s, D.sources);
  const who = [['Officials and agencies', 'A two-page brief, what stays your decision, and how to adapt the kit.', '#/brief'],
    ['Business owners and site managers', 'What a pilot asks of you, what it costs and how to stop it.', '#/start'],
    ['Floor, cleaning and facilities staff', 'Daily checks, spill response and shift hand-offs.', '#/doc/12'],
    ['Disabled people\'s and workers\' organizations', 'What must not get worse, and how to be involved early.', '#/doc/30'],
    ['Families and carers', 'What changes in shops, and a version to read with children.', '#/discover/readaloud'],
    ['Researchers and evaluators', 'Every claim with its limits, and honest study sizes.', '#/evidence'],
    ['Developers and IT teams', 'How the workspace is built, stored and extended.', '#/about'],
    ['Translators and partners', 'Ways to help the kit reach other places responsibly.', '#/pathway']];
  $('#view').innerHTML =
    '<section class="hero" id="hero" aria-labelledby="hero-title"><canvas id="atmo" aria-hidden="true"></canvas>' + bandScale() +
      '<div class="herocopy surface"><p class="eyebrow">Stage 1 of 6: Discover</p><h1 id="hero-title" tabindex="-1">' + esc(X.headline) + '</h1><p class="lede">' + esc(X.lede) + '</p>' +
      '<div class="toolbar"><a class="button primary" href="#/start">Find your starting point</a><a class="button" href="#/brief">Read the brief for officials</a></div></div>' +
      '<ol class="journey" aria-label="The six stages of the journey">' + D.journey.map((j, i) => '<li' + (i === 0 ? ' data-here' : '') + '><a href="#/' + j.route + '"' + (i === 0 ? ' aria-current="step"' : '') + '><span class="jn">' + (i + 1) + '</span><span class="jname">' + esc(j.name) + '</span><span class="jline">' + esc(j.line) + '</span></a></li>').join('') + '</ol>' +
      '<div class="atmoctl"><button type="button" id="atmo-toggle" class="quiet" hidden>Pause the moving background</button><span id="atmo-state"></span></div>' +
    '</section>' +
    '<p class="bandnote">' + cite(X.band) + ' The light in the background is an illustration, not data.</p>' +
    '<section aria-labelledby="isnot-h"><h2 id="isnot-h">What it is, and what it is not</h2><div class="twocol"><div><h3>It is</h3><ul class="checks">' + X.kitIs.map(x => '<li>' + esc(x) + '</li>').join('') +
      '</ul></div><div><h3>It is not</h3><ul class="crosses">' + X.kitIsNot.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div></section>' +
    '<section aria-labelledby="who-h"><h2 id="who-h">Who it helps first</h2><ul class="audiences">' + who.map(([t, l, h]) => '<li><a href="' + h + '"><strong>' + esc(t) + '</strong><span>' + esc(l) + '</span></a></li>').join('') + '</ul></section>' +
    '<section aria-labelledby="stages-h"><h2 id="stages-h">Six stages, at your own pace</h2><p>Nobody needs the whole package at once. Each stage has a door in the navigation, and each serves someone first:</p><ol class="stagelist">' +
      D.journey.map(j => '<li><a href="#/' + j.route + '"><strong>' + esc(j.name) + '.</strong></a> ' + esc(j.line) + ' <span class="muted">' + esc(j.who) + '</span></li>').join('') + '</ol></section>' +
    '<section aria-labelledby="claims-h"><h2 id="claims-h">How to read what this kit says</h2><dl class="claims">' + X.claims.map(([t, d]) => '<div><dt>' + esc(t) + '</dt><dd>' + cite(d) + '</dd></div>').join('') + '</dl></section>' +
    '<section aria-labelledby="ev-h"><h2 id="ev-h">The evidence, in one paragraph</h2><p>No outcome evaluation of this program has been completed. Falls are a leading cause of non-fatal child injury worldwide ' + cite('[S46]') +
      ', but there is little evidence about shops, and in 2008 there was not enough trial evidence that changing the environment of homes reduces child injuries ' + cite('[S46]') +
      '. So the kit treats every site change as a reasonable precaution to be evaluated, never as a proven fix. <a href="#/evidence">Read the evidence ledger</a>.</p></section>' +
    '<section id="readaloud" class="readaloud" aria-labelledby="ra-h"><h2 id="ra-h">Read it with a child</h2><p class="muted">Five short sentences for an adult to read aloud. Nothing is recorded.</p><div class="ra">' +
      X.readaloud.map(s => '<p>' + esc(s) + '</p>').join('') + '</div></section>';
  // Optional background scene. Never required: the CSS background stays if it is off or fails.
  const canvas = $('#atmo');
  if (window.CSSAtmosphere && settings.atmosphere !== 'off') ui.atmo = window.CSSAtmosphere.mount($('#hero'), canvas, { mode: settings.atmosphere, reduced: reducedMotion(), onState: atmoState });
  else { canvas.hidden = true; atmoState('off', settings.atmosphere === 'off' ? 'The background scene is switched off in settings.' : ''); }
  $('#atmo-toggle').onclick = () => { if (!ui.atmo) return; const st = ui.atmo.toggle(); announce(st === 'playing' ? 'Background moving.' : 'Background paused.'); };
}
function atmoState(st, reason) {
  const b = $('#atmo-toggle'), s = $('#atmo-state'); if (!b || !s) return;
  b.hidden = !(st === 'playing' || (st === 'paused' && settings.atmosphere === 'auto' && !reducedMotion()));
  b.textContent = st === 'playing' ? 'Pause the moving background' : 'Play the moving background';
  b.setAttribute('aria-pressed', String(st !== 'playing'));
  s.textContent = st === 'playing' ? '' : reason;
}

/* ---------- 6l. Start here: starting point and roles ---------- */
function startView() {
  const done = D.tasks.filter(t => C.taskComplete(state.tasks[t.id])).length;
  const gatesDone = C.gateStatus(state, D).filter(g => g.done).length;
  const role = D.roles.find(r => r.key === ui.role);
  $('#view').innerHTML = heading('', 'Start here', 'Answer up to four questions to see the steps that fit you, then open your role for today\'s tasks. Your answers are not saved.') +
    '<section class="startpoint" aria-labelledby="sp-h"><h2 id="sp-h">Find your starting point</h2><form id="spform" class="spform" novalidate>' +
      D.startQuestions.map((q, i) => '<fieldset><legend><span class="qn" aria-hidden="true">' + (i + 1) + '</span>' + esc(q.text) + (q.id === 'time' ? ' <span class="muted">(optional)</span>' : '') + '</legend><div class="choices">' +
        q.options.map(([v, l]) => '<label class="choice"><input type="radio" name="sp-' + q.id + '" value="' + v + '"' + (ui.answers[q.id] === v ? ' checked' : '') + '><span>' + esc(l) + '</span></label>').join('') + '</div></fieldset>').join('') +
      '<div class="toolbar"><button type="submit" class="primary" id="spgo">Show my next steps</button><button type="button" id="spreset">Start again</button></div></form>' +
      '<div id="spresult"></div></section>' +
    '<p class="progressline">' + done + ' of ' + D.tasks.length + ' tasks have evidence recorded, and ' + gatesDone + ' of ' + D.gates.length + ' decision gates are recorded complete. <a href="#/plan">Open the plan</a></p>' +
    '<div class="toolbar"><button type="button" data-open-wf="W01">Set up the workspace (W01)</button><button type="button" id="handbook">Download the working handbook</button><button type="button" id="printall">Print the working handbook</button></div>' +
    '<h2 id="roles">Your role today</h2><p>See what you can do today, what needs local review, what needs a signed commitment, and who you hand off to.</p>' +
    '<div class="rolepicker" role="group" aria-label="Roles">' + D.roles.map(r => '<button type="button" data-role="' + r.key + '" aria-pressed="' + (r.key === ui.role) + '">' + esc(r.name) + '</button>').join('') + '</div>' +
    '<div id="rolepanel" class="rolepanel">' + (role ? rolePanel(role) : '') + '</div>' +
    '<h2>Three kinds of work</h2><div class="legend">' + badge('now') + ' ' + badge('review') + ' ' + badge('signed') + '</div>' +
    '<p>Every task and workflow carries one of these labels. Gates still run in order: work marked "No approval needed" in G0 and G1 can begin today, and later work of that kind starts when its gate is reached. Anything that changes regulated elements, collects research data or commits money waits for its review or signature. A checkbox in this workspace is never a signature.</p>' +
    '<h2>Begin today</h2><ol class="steps">' +
    [['Set up and back up the workspace', 'Check the storage indicator in the status bar, enter a non-identifying site code, export a first backup.', 'W01'],
     ['Name owners and deputies', 'Sponsor, site lead, facilities owner, evaluation lead — and who may stop use.', 'W02'],
     ['Walk the site and fix what you can', 'Include carts and fixture edges from the floor to 120 cm; isolate critical hazards with an accessible alternative.', 'W03'],
     ['Set up daily response and handoffs', 'Shift responders, spill response with four timestamps, acknowledged handoffs.', 'W04'],
     ['Ask for the reviews you will need', 'Authorities, landlord, insurer, privacy and ethics offices — silence is never approval.', 'W07']]
      .map(s => '<li class="step"><div><h3>' + s[0] + '</h3><p>' + s[1] + ' <button type="button" data-open-wf="' + s[2] + '">Open ' + s[2] + '</button></p></div></li>').join('') + '</ol>' +
    '<h2>Decisions that still need local professionals, authorities, evidence or signatures</h2><div class="tablewrap" tabindex="0" role="region" aria-label="Local decisions"><table><thead><tr><th scope="col">Decision</th><th scope="col">Who decides</th><th scope="col">Gate</th><th scope="col">Why it cannot be decided here</th></tr></thead><tbody>' +
    D.localDecisions.map(l => '<tr><td>' + esc(l.item) + '</td><td>' + esc(l.who) + '</td><td>' + esc(l.gate) + '</td><td>' + esc(l.why) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<div class="notice warning"><strong>Non-sensitive planning only.</strong> Do not enter children\'s identities, injury or health details, CCTV, witness information, claim numbers or confidential contracts. Keep official approvals and personal records in protected organizational systems.</div>';
  $('#handbook').onclick = () => downloadHandbook(D.docs, 'Child-Safer Spaces working handbook');
  $('#printall').onclick = () => printDocs(D.docs, 'Child-Safer Spaces working handbook');
  $$('[data-role]').forEach(b => b.onclick = () => {
    ui.role = ui.role === b.dataset.role ? null : b.dataset.role;
    $$('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.role === ui.role)));
    const r = D.roles.find(x => x.key === ui.role);
    $('#rolepanel').innerHTML = r ? rolePanel(r) : '';
    wireLinks($('#rolepanel'));
    const h = $('#rolepanel h2'); if (h) h.focus();
  });
  const form = $('#spform');
  form.onsubmit = e => { e.preventDefault(); ui.answers = Object.fromEntries(D.startQuestions.map(q => [q.id, (form.querySelector('input[name="sp-' + q.id + '"]:checked') || {}).value]).filter(x => x[1])); drawStart(true); };
  $('#spreset').onclick = () => { ui.answers = {}; form.reset(); $('#spresult').innerHTML = ''; form.querySelector('input').focus(); announce('Answers cleared.'); };
  if (Object.keys(ui.answers).length) drawStart(false);
  wireLinks();
}
function drawStart(focus) {
  const a = ui.answers, res = C.startingPoint(a, D);
  const missing = ['who', 'where', 'goal'].filter(k => !a[k]).map(k => D.startQuestions.find(q => q.id === k).text.replace(/\?$/, '').toLowerCase());
  $('#spresult').innerHTML = '<h3 id="sp-title" tabindex="-1">Your next steps</h3>' +
    (missing.length ? '<p class="muted">For better suggestions, also answer: ' + esc(missing.join('; ')) + '.</p>' : '') +
    '<ol class="nextsteps">' + res.steps.map(s => '<li><a href="' + esc(hrefFor(s.target)) + '"><strong>' + esc(s.title) + '</strong></a> ' + badge(s.work) + '<p>' + esc(s.detail) + '</p>' +
      '<p class="why">' + (s.because.length ? 'Suggested because you chose: ' + esc(s.because.map(b => '"' + b + '"').join(' and ')) + '.' : 'Suggested for everyone.') + '</p></li>').join('') + '</ol>' +
    (res.more ? '<p class="muted">' + res.more + ' more suggestion' + (res.more === 1 ? ' is' : 's are') + ' available if you choose more time.</p>' : '') +
    (res.skip ? '<p><strong>You can skip for now:</strong> ' + esc(res.skip) + '</p>' : '');
  if (focus) { $('#sp-title').focus(); announce(res.steps.length + ' next steps shown.'); }
}
function rolePanel(r) {
  const list = a => '<ul>' + a.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  return '<div class="card"><h2 tabindex="-1">' + esc(r.name) + '</h2><div class="grid">' +
    '<div><h3><span class="badge now">Can begin today</span></h3>' + list(r.today) + '</div><div><h3>' + badge('review') + '</h3>' + list(r.review) + '</div><div><h3>' + badge('signed') + '</h3>' + list(r.signed) + '</div></div>' +
    '<p><strong>First deliverable:</strong> ' + esc(r.first) + '. <strong>Hand off to:</strong> ' + esc(r.handoff) + '.</p>' +
    '<p><strong>Start with:</strong> ' + linkDocs(r.start) + '</p><p><strong>Your workflows:</strong> ' + r.workflows.map(w => '<button type="button" data-open-wf="' + w + '">' + w + ' · ' + esc(D.workflows.find(x => x.id === w).title) + '</button>').join(' ') + '</p>' +
    '<div class="toolbar"><button type="button" data-open-pack="' + r.key + '">Download this role\'s working pack</button></div></div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-open-pack]');
  if (b) { const key = b.dataset.openPack; downloadHandbook(roleDocs(key), key + ' working pack'); }
});
function roleDocs(key) { return D.docs.filter(d => key === 'All roles' || (D.rolePacks[key] || []).includes(d.id)); }

/* ---------- 6m. Brief, adaptation kit and pathway (documents 50–54) ---------- */
function citedSources(d) {
  const cites = (d.cites || []).map(s => D.sources.find(x => x.id === s)).filter(Boolean);
  return '<h2>Sources cited in this document</h2>' + (cites.length ? '<ul>' + cites.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.id + ' · ' + s.title) + '</a> <span class="muted">(' + esc(s.edition) + '; retrieved ' + esc(s.retrieved) + ')</span></li>').join('') + '</ul>' : '<p class="muted">No external source cited; this document is program guidance.</p>');
}
function briefView(opts = {}) {
  const lang = ['fr', 'es'].includes(opts.arg) ? opts.arg : 'en', id = { en: '50', fr: '51', es: '52' }[lang], d = docById(id);
  $('#view').innerHTML = '<p class="eyebrow">Stage 2 of 6: Understand</p><h1 tabindex="-1" lang="' + lang + '">' + esc(d.title) + '</h1>' +
    '<p class="lede">Two pages for officials anywhere: the problem, the offer, the limits, and what stays your decision.</p>' +
    '<nav class="langswitch" aria-label="Language of the brief">' + [['en', 'English', '#/brief'], ['fr', 'Français (traduction provisoire)', '#/brief/fr'], ['es', 'Español (traducción provisional)', '#/brief/es']]
      .map(([k, l, h]) => '<a href="' + h + '" lang="' + k + '" hreflang="' + k + '"' + (k === lang ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') + '</nav>' +
    (lang !== 'en' ? '<div class="notice warning"><p><strong>Draft translation.</strong> No native speaker has reviewed this version yet. Have it reviewed before official use; the English original is document 50.</p></div>' : '') +
    (draftStatus(id) !== 'original' ? '<p class="muted"><strong>Showing your local draft of document ' + id + '.</strong></p>' : '') +
    '<div class="toolbar no-print"><button type="button" id="briefprint">Print this brief</button><button type="button" id="briefdl">Download this brief</button><a class="button" href="#/doc/' + id + '">Edit or translate a local draft</a></div>' +
    '<article class="doc brief" id="docbody" lang="' + lang + '">' + C.markdown(body(d), D.sources, { label: 'Brief' }) + '</article>' + citedSources(d);
  $('#briefprint').onclick = () => printDocs([d], d.title);
  $('#briefdl').onclick = () => downloadHandbook([d], d.title);
}
function docPage(id, lede, extra) {
  const d = docById(id);
  $('#view').innerHTML = heading('', esc(d.title), lede) + (extra || '') +
    (draftStatus(id) !== 'original' ? '<p class="muted"><strong>Showing your local draft of document ' + id + '.</strong></p>' : '') +
    '<div class="toolbar no-print"><button type="button" id="dpprint">Print</button><button type="button" id="dpdl">Download</button><a class="button" href="#/doc/' + id + '">Edit a local draft (document ' + id + ')</a></div>' +
    '<article class="doc" id="docbody">' + C.markdown(body(d), D.sources, { label: 'Document ' + id }) + '</article>' + citedSources(d);
  $('#dpprint').onclick = () => printDocs([d], d.id + ' ' + d.title);
  $('#dpdl').onclick = () => downloadHandbook([d], d.title);
  wireLinks();
}
function adaptView() {
  docPage('53', 'Replace the U.S. and Canadian worked examples with your own rules, consultations and languages, without losing the safeguards.',
    '<div class="notice"><p><strong>Record as you go:</strong> <button type="button" class="linkbtn" data-open-reg="jurisdiction">jurisdiction register</button>, <button type="button" class="linkbtn" data-open-reg="standards">standards register</button>, <button type="button" class="linkbtn" data-open-reg="consultation">consultation register</button> and <button type="button" class="linkbtn" data-open-reg="decisions">decisions register</button>. Worked examples: ' + linkDocs(['33', '34']) + '.</p></div>');
}
function pathwayView() {
  docPage('54', 'How the kit can grow from one site to many places, what must be true before each step, and how different organizations can help.',
    '<p>Messages for outreach: ' + linkDocs(['42']) + '. Playbooks for each organization at a single site: ' + linkDocs(['46']) + '.</p>');
}

/* ---------- 6n. Glossary ---------- */
const seeHref = s => /^\d\d$/.test(s) ? '#/doc/' + s : '#/' + s;
const seeLabel = s => /^\d\d$/.test(s) ? 'Document ' + s + ': ' + (docById(s) || {}).title : (routeById(s) || {}).label || s;
function glossaryView() {
  $('#view').innerHTML = heading('', 'Glossary', D.glossary.length + ' terms in plain language. Each one links to where it matters.') +
    '<div class="toolbar"><label for="gq" class="grow">Find a term<input type="search" id="gq" placeholder="e.g. baseline, slip, gate"></label></div><p id="gcount" class="muted" role="status"></p><dl class="glossary" id="glist"></dl>';
  const draw = () => {
    const q = $('#gq').value.trim().toLowerCase();
    const list = D.glossary.filter(g => !q || (g.term + ' ' + g.plain + ' ' + g.more).toLowerCase().includes(q));
    $('#gcount').textContent = list.length + ' of ' + D.glossary.length + ' terms';
    $('#glist').innerHTML = list.map(g => '<div class="gterm"><dt id="term-' + fileSafe(g.term) + '" tabindex="-1">' + esc(g.term) + '</dt><dd><p>' + esc(g.plain) + '</p><p class="muted">' + C.inline(g.more, D.sources) + ' <a href="' + seeHref(g.see) + '">' + esc(seeLabel(g.see)) + '</a></p></dd></div>').join('') || '<p>No matching term. Try a shorter word.</p>';
  };
  $('#gq').oninput = draw; draw();
}

/* ---------- 6o. About, credits and licences ---------- */
function aboutView() {
  const n = D.docs.length;
  $('#view').innerHTML = heading('', 'About, credits & licences', 'Who made this, what it relies on, what it promises not to do, and how to extend it.') +
    '<h2 id="credits">Attributions</h2><dl class="credits">' + D.attributions.map(a => '<div><dt>' + esc(a.what) + '</dt><dd><strong>' + esc(a.who) + '</strong>. ' + esc(a.note) + (a.url ? ' <a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">Repository</a>' : '') + '</dd></div>').join('') + '</dl>' +
    '<h2 id="licences">Licences</h2><ul><li><strong>This package:</strong> no licence has been chosen yet. Until the owner chooses one, ask the owner before copying or republishing beyond reading and internal evaluation. Options to consider: an open-source licence such as MIT for the code and Creative Commons Attribution 4.0 for the documents. Choosing is the owner\'s decision.</li>' +
      '<li><strong>Feature Fusion Foundry:</strong> MIT License, © 2026 Foster + Navi / Planetary Restoration Archive. Its method informed this edition; none of its code is included.</li>' +
      '<li><strong>Sources:</strong> each publisher keeps its copyright. Standards behind paywalls were read only at their public scope pages. See the <a href="#/sources">source register</a>.</li>' +
      '<li><strong>Third-party code in the workspace:</strong> none. No fonts, images or scripts are downloaded.</li></ul>' +
    '<h2 id="promises">What this workspace will not do</h2><ul><li>Connect to any network. A content-security policy in the page blocks connections, and the workspace contains no analytics, tracking, advertising or accounts.</li>' +
      '<li>Send, share or upload your planning data. It stays in this browser until you export a file yourself.</li><li>Record anything about children, carers, workers or visitors. It warns when text looks personal.</li>' +
      '<li>Approve, certify or endorse anything. Checkboxes are planning records, never signatures.</li><li>Use pressure, streaks, scores or rewards to keep you using it.</li></ul>' +
    '<h2 id="build">How it is built (for developers)</h2><p>Plain HTML, CSS and JavaScript with no runtime dependencies. Files: <code>index.html</code>, <code>style.css</code>, <code>data.js</code> (generated content), <code>core.js</code> (pure logic, tested in Node), <code>store.js</code> (browser storage), <code>atmosphere.js</code> (optional background), <code>app.js</code> (views and navigation). <code>standalone.html</code> is the same workspace in one file.</p>' +
      '<ul><li><strong>Routes:</strong> listed in <code>source/content.json</code> under "routes", with a guide for each view under "viewGuides" and a render function in <code>app.js</code> (RENDER).</li>' +
      '<li><strong>Storage ladder:</strong> browser database (IndexedDB), then localStorage, then memory with export. Earlier versions\' data are read and never changed. Another tab\'s changes are never overwritten.</li>' +
      '<li><strong>Offline copy:</strong> when served from a secure web address, a service worker keeps the workspace files (not your data) so it opens without a connection. Opened from a folder or as a single file, it already works offline.</li>' +
      '<li><strong>Background scene:</strong> 2D canvas with a quality ladder; it pauses when hidden, on low battery, with reduced motion or after 90 seconds.</li>' +
      '<li><strong>Build and tests:</strong> <code>node source/build.cjs</code>, <code>node --test source/tests.cjs</code>, and optional browser tests in <code>source/browser-tests.py</code>. See <code>source/README.md</code>.</li></ul>' +
    '<h2 id="limits">Known limits</h2><p>Automated tests ran in one browser engine (Chromium). Other browsers, screen readers and real devices still need the manual checks listed in <code>TEST-REPORT.md</code>. Accessibility conformance has not been audited.</p>' +
    '<h2 id="version">Version</h2><p>Version ' + esc(D.version) + ', ' + esc(D.edition) + ', issued ' + esc(D.issued) + '. Sources checked ' + esc(D.sourcesChecked) + '. ' + n + ' documents, ' + D.registers.length + ' registers, ' + D.sources.length + ' sources, ' + D.evidence.length + ' evidence claims, ' + D.workflows.length + ' workflows.</p>';
}

/* ---------- 6p. Not found ---------- */
function notFoundView(opts = {}) {
  $('#view').innerHTML = '<p class="eyebrow">Not found</p><h1 tabindex="-1">This page is not in the workspace</h1><p>The address <code>' + esc(opts.bad || window.location.hash) + '</code> does not match any view or document. It may come from another version of the workspace.</p>' +
    '<div class="toolbar"><button type="button" class="primary" id="nfsearch">Search the workspace</button><a class="button" href="#/discover">Go to Discover</a><button type="button" id="nfback">Go back</button></div>';
  $('#nfsearch').onclick = openSearch;
  $('#nfback').onclick = () => window.history.back();
}

/* ---------- 6q. Your data ---------- */
const LABEL_SETTINGS = 'Display settings (no planning data)';
function keyLabel(k, where) {
  if (k === C.KEYS.v3) return store && store.engine === 'indexeddb' && where === 'browser storage' ? 'Version 3 copy (left unchanged)' : 'Current workspace';
  if (k === C.KEYS.undo) return where === 'browser storage' && store && store.engine === 'indexeddb' ? 'Version 3 undo copy (left unchanged)' : 'Undo copy';
  if (k === C.KEYS.v2) return 'Version 2 data (left unchanged)';
  if (k === C.KEYS.v1) return 'Version 1 data (left unchanged)';
  if (k.startsWith(C.KEYS.recoveryPrefix)) return 'Recovery copy of unreadable data';
  if (k === SETTINGS_KEY) return LABEL_SETTINGS;
  if (window.CSSStore && k === window.CSSStore.MARKER) return 'Date this browser first used the database';
  return 'Other';
}
function dataView() {
  const rows = store && store.engine !== 'memory' ? store.list() : null;
  const engineText = !store || store.engine === 'memory' ? 'Nothing can be stored in this browser here, so your work exists only while this page is open. Export a backup before closing it.'
    : store.engine === 'indexeddb' ? 'Your planning work is kept in this browser\'s database (IndexedDB) on this device.'
    : 'This browser does not allow its database here' + (store.reason ? ' (' + esc(store.reason) + ')' : '') + ', so your work is kept in its simpler storage (localStorage), which holds about 5 MB.';
  const log = (state.log || []).slice(-40).reverse();
  const counts = { edits: Object.keys(state.edits).length, records: Object.values(state.records).reduce((a, r) => a + r.length, 0), tasks: Object.keys(state.tasks).length, gates: Object.keys(state.gates).length, log: (state.log || []).length };
  const parts = [['edits', 'Document drafts', counts.edits + ' draft(s)'], ['records', 'Register rows', counts.records + ' row(s)'], ['tasks', 'Task records (owners, dates, status, evidence)', counts.tasks + ' record(s)'],
    ['gates', 'Gate decision records', counts.gates + ' gate(s)'], ['calc', 'Cost-scenario inputs and ranges', ''], ['planning', 'Evaluation-planning inputs', ''], ['profile', 'Site code and profile', state.site ? 'site ' + state.site : ''], ['log', 'Planning log', counts.log + ' event(s)']];
  $('#view').innerHTML = heading('', 'Your data', 'Everything this workspace keeps is listed here. Nothing is sent anywhere. Export backups to an approved location; anyone with a backup file can read it.') +
    '<div class="card"><h2>Where your work is kept</h2><p>' + engineText + '</p><p>' + esc($('#storage').textContent) + '.' + (ui.lastSaved ? ' Last saved ' + esc(ui.lastSaved.toLocaleString()) + '.' : '') + '</p><p id="quota" class="muted"></p>' +
      '<div class="toolbar"><button type="button" id="dexport" class="primary">Export backup</button><button type="button" id="dimport">Import backup…</button><button type="button" id="dpersist" hidden>Ask the browser to keep this data</button></div><p id="persiststate" class="muted"></p></div>' +
    '<h2>What is stored in this browser</h2>' + (rows === null ? '<p>Browser storage cannot be read here.</p>' : rows.length ? '<div class="tablewrap" tabindex="0" role="region" aria-label="Stored items"><table class="keylist"><thead><tr><th scope="col">Item</th><th scope="col">Kept in</th><th scope="col">Storage key</th><th scope="col">Size</th><th scope="col">Actions</th></tr></thead><tbody>' +
      rows.map((r, i) => {
        const k = r.key, legacyCopy = k === C.KEYS.v2 || k === C.KEYS.v1 || (k === C.KEYS.v3 && r.where === 'browser storage' && store.engine === 'indexeddb');
        const deletable = legacyCopy || k.startsWith(C.KEYS.recoveryPrefix) || k === SETTINGS_KEY || (window.CSSStore && k === window.CSSStore.MARKER) || (k === C.KEYS.undo && r.where === 'browser storage' && store.engine === 'indexeddb');
        return '<tr><td>' + esc(keyLabel(k, r.where)) + '</td><td>' + esc(r.where) + '</td><td><code>' + esc(k) + '</code></td><td>' + Math.max(1, Math.ceil(r.size / 1024)) + ' KB</td><td><button type="button" data-dl-row="' + i + '">Download</button>' +
          (legacyCopy ? ' <button type="button" data-import-row="' + i + '">Preview and import</button>' : '') + (deletable ? ' <button type="button" class="danger" data-del-row="' + i + '">Delete…</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p>Nothing is stored yet.</p>') + '<div id="keybox"></div>' +
    '<h2 id="checkshare">Check before sharing</h2><p>Looks through drafts, registers, tasks, gate notes and the site profile for patterns that often mean personal information (emails, phone numbers, ages, injury details, footage). It shows where, never the text itself.</p><div class="toolbar"><button type="button" id="runcheck">Run the check</button></div><div id="checkresult" role="status"></div>' +
    '<h2 id="reset">Reset selected parts</h2><p>Clears only what you tick. An undo copy is kept, so you can bring it back once.</p><fieldset class="resetparts"><legend>Parts to reset</legend>' +
      parts.map(([k, l, c]) => '<label class="choice"><input type="checkbox" value="' + k + '"><span>' + esc(l) + (c ? ' <span class="muted">(' + esc(c) + ')</span>' : '') + '</span></label>').join('') + '</fieldset>' +
      '<div class="toolbar"><button type="button" id="resetsel" class="danger">Reset selected…</button></div><div id="resetbox"></div>' +
    '<h2>Erase</h2><p>Erasing removes the current workspace and its undo copy from this browser. Exported backup files are not affected. This cannot be undone.</p><div class="toolbar"><button type="button" id="erase" class="danger">Erase this workspace…</button><button type="button" id="eraseall" class="danger">Erase everything Child-Safer Spaces stored here…</button></div><div id="erasebox"></div>' +
    '<h2>Planning log</h2><p class="muted">A local list of gate, import, undo and migration events (no document text). It is not a tamper-proof audit trail.</p>' + (log.length ? '<ul>' + log.map(e => '<li><span class="muted">' + esc(e.at.slice(0, 16).replace('T', ' ')) + ', ' + esc(e.type) + ':</span> ' + esc(e.detail) + '</li>').join('') + '</ul>' : '<p class="muted">No events yet.</p>') +
    '<h2>Technical details for your IT team</h2><p>A plain-text summary of this browser\'s capabilities and the workspace version, without any planning data. Read it before passing it on.</p><div class="toolbar"><button type="button" id="techdl">Download technical details</button></div><pre class="techinfo" id="techinfo" tabindex="0"></pre>' +
    '<h2>Privacy notes</h2><ul><li>No accounts, cookies, analytics or network connections. The page carries a content-security policy that blocks connections.</li><li>The personal-data check looks for patterns. It cannot recognise every name.</li><li>Moving the HTML file, changing browser or clearing site data can separate or erase stored work. Different file locations do not share storage in every browser.</li><li>Display settings are kept separately in this browser\'s local storage and contain no planning data.</li></ul>';
  $('#dexport').onclick = exportBackup;
  $('#dimport').onclick = () => $('#import').click();
  const nav = window.navigator;
  if (nav.storage && nav.storage.estimate) nav.storage.estimate().then(e => { if (e && e.quota) $('#quota').textContent = 'This page\'s storage is using about ' + (Math.round((e.usage || 0) / 1024 / 102.4) / 10) + ' MB of roughly ' + Math.round(e.quota / 1048576).toLocaleString() + ' MB the browser allows.'; }).catch(() => {});
  if (nav.storage && nav.storage.persist && store && store.engine === 'indexeddb') {
    const ps = $('#persiststate'), pb = $('#dpersist');
    nav.storage.persisted().then(p => { ps.textContent = p ? 'The browser has agreed to keep this data unless you clear it.' : 'The browser may clear this data if the device runs low on space.'; pb.hidden = !!p; }).catch(() => {});
    pb.onclick = () => nav.storage.persist().then(p => { ps.textContent = p ? 'The browser has agreed to keep this data unless you clear it.' : 'The browser did not agree. Keep exporting backups.'; pb.hidden = !!p; announce(ps.textContent); }).catch(() => { ps.textContent = 'The browser could not answer.'; });
  }
  $$('[data-dl-row]').forEach(b => b.onclick = () => { const r = rows[Number(b.dataset.dlRow)]; download(fileSafe(r.key) + '-' + today() + '.json', store.readFrom(r.key, r.where) || '', 'application/json'); });
  $$('[data-import-row]').forEach(b => b.onclick = () => {
    const r = rows[Number(b.dataset.importRow)], ver = r.key === C.KEYS.v2 ? 2 : r.key === C.KEYS.v1 ? 1 : 3;
    try { previewImport({ format: 'child-safer-spaces', version: ver, state: JSON.parse(store.readFrom(r.key, r.where)) }, 'browser copy of ' + keyLabel(r.key, r.where).toLowerCase()); }
    catch (e) { announce('That copy could not be read: ' + e.message); }
  });
  $$('[data-del-row]').forEach(b => b.onclick = () => {
    const r = rows[Number(b.dataset.delRow)];
    $('#keybox').innerHTML = '<div class="confirm" role="group" aria-label="Confirm delete"><p>Delete <code>' + esc(r.key) + '</code> from ' + esc(r.where) + '? Download it first if you might need it. This cannot be undone.</p><div class="toolbar"><button type="button" id="kd-yes" class="danger">Delete it</button><button type="button" id="kd-no">Cancel</button></div></div>';
    $('#kd-no').focus();
    $('#kd-no').onclick = () => { $('#keybox').innerHTML = ''; };
    $('#kd-yes').onclick = () => { store.removeFrom(r.key, r.where); if (r.key === SETTINGS_KEY) { settings = C.readSettings(null); applySettings(); } announce('Deleted ' + r.key + '.'); dataView(); };
  });
  $('#runcheck').onclick = () => {
    const f = C.scanState(state, D);
    $('#checkresult').innerHTML = f.length ? '<div class="notice warning"><p><strong>' + f.length + ' place' + (f.length === 1 ? '' : 's') + ' may contain personal or sensitive information:</strong></p><ul>' + f.slice(0, 40).map(x => '<li>' + esc(x.where) + ': ' + esc(x.labels.join(', ')) + '</li>').join('') + '</ul><p>Replace those details with coded references before you share a backup.</p></div>' : '<p>No common personal-data patterns found. The check cannot recognise every name, so read before you share.</p>';
  };
  $('#resetsel').onclick = () => {
    const pick = $$('.resetparts input:checked').map(x => x.value);
    if (!pick.length) { announce('Tick at least one part to reset.'); return; }
    const names = pick.map(k => parts.find(p => p[0] === k)[1].toLowerCase());
    $('#resetbox').innerHTML = '<div class="confirm" role="group" aria-label="Confirm reset"><p><strong>Reset ' + esc(names.join(', ')) + '?</strong> An undo copy is kept.' + (pick.includes('tasks') ? ' Resetting tasks reopens any gate that depended on them.' : '') + '</p><div class="toolbar"><button type="button" id="rs2-yes" class="danger">Reset now</button><button type="button" id="rs2-no">Cancel</button></div></div>';
    $('#rs2-no').focus();
    $('#rs2-no').onclick = () => { $('#resetbox').innerHTML = ''; };
    $('#rs2-yes').onclick = () => {
      snapshot('reset ' + names.join(', '));
      const blank = C.blankState();
      for (const k of pick) {
        if (k === 'edits') { state.edits = {}; state.editMeta = {}; }
        else if (k === 'calc') { state.calc = blank.calc; state.ranges = {}; }
        else if (k === 'profile') { state.site = ''; state.profile = blank.profile; }
        else state[k] = blank[k];
      }
      if (pick.includes('tasks') || pick.includes('gates')) C.recheckGates(state, D);
      C.addLog(state, 'recovery', 'Reset: ' + names.join(', ') + '.');
      save(); renderWorkspaceName(); dataView(); announce('Reset ' + names.join(', ') + '. Use Undo to bring them back.');
    };
  };
  const erase = all => {
    $('#erasebox').innerHTML = '<div class="confirm" role="group" aria-label="Confirm erase"><p><strong>' + (all ? 'Erase every Child-Safer Spaces item in this browser, including older versions, recovery copies and display settings?' : 'Erase the current workspace and its undo copy?') + '</strong> Export a backup first if you might need the work. This cannot be undone.</p><div class="toolbar"><button type="button" id="er-yes" class="danger">Erase now</button><button type="button" id="er-no">Cancel</button></div></div>';
    $('#er-no').focus();
    $('#er-no').onclick = () => { $('#erasebox').innerHTML = ''; };
    $('#er-yes').onclick = () => {
      try { (all ? store.keys() : [C.KEYS.v3, C.KEYS.undo]).forEach(k => all ? store.removeItem(k) : store.removeFrom(k, store.engine === 'indexeddb' ? 'database' : 'browser storage')); } catch (e) { /* ignore */ }
      state = C.blankState(); ui.snap = null; ui.blocked = false; ui.erased = true; ui.unsaved = false; ui.banners = []; renderBanners(); updateUndo();
      if (all) { settings = C.readSettings(null); applySettings(); }
      if (!all) save();
      setStorage(all ? 'pending' : ui.storageState, 'Erased');
      if (all) $('#storage').textContent = 'Erased — nothing stored';
      renderWorkspaceName(); dataView(); announce(all ? 'Everything erased from this browser.' : 'Workspace erased.');
    };
  };
  $('#erase').onclick = () => erase(false);
  $('#eraseall').onclick = () => erase(true);
  const info = techInfo();
  $('#techinfo').textContent = info;
  $('#techdl').onclick = () => download('child-safer-technical-details-' + today() + '.txt', info);
}
function techInfo() {
  const n = window.navigator, lines = [
    'Child-Safer Spaces workspace ' + D.version + ' (' + D.edition + '), issued ' + D.issued,
    'Copy: ' + (BUILD === 'standalone' ? 'single file (standalone.html)' : 'folder (index.html)'),
    'Opened via: ' + window.location.protocol.replace(':', ''), 'Secure context: ' + (window.isSecureContext ? 'yes' : 'no'),
    'Planning data kept in: ' + (store ? ENGINE_LABEL[store.engine] : 'not available') + (store && store.reason ? ' (database note: ' + store.reason + ')' : ''),
    'Offline copy: ' + ui.offline, 'Reduced motion: ' + (reducedMotion() ? 'yes' : 'no'), 'Display settings: ' + JSON.stringify(settings),
    'Browser: ' + n.userAgent, 'Generated: ' + new Date().toISOString(),
    'This file contains no planning data.'];
  return lines.join('\n');
}

/* ---------- 7. Backups, export check, printing and downloads ---------- */
function exportBackup() {
  flush();
  const findings = C.scanState(state, D);
  if (findings.length && !ui.exportConfirmed) { showExportCheck(findings); return; }
  ui.exportConfirmed = false;
  download('child-safer-planning-v4-' + (fileSafe(state.site) || 'workspace') + '-' + today() + '.json', JSON.stringify(C.backupEnvelope(state), null, 2), 'application/json');
  announce('Backup downloaded. Store it in an approved location; anyone with the file can read it.');
}
function showExportCheck(findings) {
  const panel = $('#importpanel');
  panel.hidden = false;
  panel.innerHTML = '<div class="notice warning"><h2 tabindex="-1" id="expcheck">Check before you export</h2><p>' + findings.length + ' place' + (findings.length === 1 ? '' : 's') + ' in this workspace may contain personal or sensitive information:</p><ul>' +
    findings.slice(0, 20).map(f => '<li>' + esc(f.where) + ': ' + esc(f.labels.join(', ')) + '</li>').join('') + (findings.length > 20 ? '<li>and ' + (findings.length - 20) + ' more</li>' : '') + '</ul>' +
    '<p>Anyone who has the backup file can read it. Replace personal details with coded references before you share it.</p><div class="toolbar"><button type="button" id="expcancel" class="primary">Cancel and review</button><button type="button" id="expanyway">Export anyway</button></div></div>';
  $('#expcheck').focus();
  $('#expcancel').onclick = () => { panel.hidden = true; panel.innerHTML = ''; announce('Export cancelled. Nothing was downloaded.'); };
  $('#expanyway').onclick = () => { panel.hidden = true; panel.innerHTML = ''; ui.exportConfirmed = true; exportBackup(); };
}

function previewImport(obj, from) {
  let res;
  try { res = C.importBackup(obj, D); } catch (e) { announce('Import rejected: ' + e.message + ' Current work was not changed.'); return; }
  const x = res.state, rows = Object.values(x.records).reduce((a, r) => a + r.length, 0), gatesDone = Object.values(x.gates).filter(g => g.done).length;
  const flagged = Object.entries(x.records).reduce((a, [k, rs]) => a + rs.filter(r => C.scanSensitive(r.join('\n'), D.registerMeta[k].scan).length).length, 0);
  const panel = $('#importpanel');
  panel.hidden = false;
  panel.innerHTML = '<div class="notice"><h2 tabindex="-1" id="imptitle">Review this import</h2><p>From: ' + esc(from) + '. Site code: ' + esc(x.site || '(none)') + '. ' + Object.keys(x.edits).length + ' document draft(s), ' + Object.keys(x.tasks).length + ' task record(s), ' + rows + ' register row(s), ' + gatesDone + ' gate(s) recorded complete.</p>' +
    (res.migrated ? '<p><strong>Migrated from ' + esc(res.migrated) + ':</strong></p><ul>' + res.report.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' : '') +
    (flagged ? '<p class="inline-warning">' + flagged + ' register row(s) may contain personal or sensitive details. Review them after import.</p>' : '') +
    '<p>Applying replaces this browser\'s current planning state. An undo copy of the current state is kept.</p><div class="toolbar"><button type="button" id="applyimport" class="primary">Apply import</button><button type="button" id="cancelimport">Cancel</button></div></div>';
  $('#imptitle').focus();
  $('#applyimport').onclick = () => {
    snapshot('import from ' + from);
    state = x; C.addLog(state, 'backup-imported', 'Imported from ' + from + (res.migrated ? ' (migrated from ' + res.migrated + ')' : '') + '.');
    panel.hidden = true; panel.innerHTML = '';
    save(); render(); announce('Import applied. Use Undo to return to the previous state.');
  };
  $('#cancelimport').onclick = () => { panel.hidden = true; panel.innerHTML = ''; announce('Import cancelled; nothing changed.'); };
}
function packContent(docs, title) {
  return '<header class="packhead"><p>Child-Safer Spaces · Version ' + esc(D.version) + ' · Working copy exported ' + esc(new Date().toLocaleDateString()) + '</p><h1>' + esc(title) + '</h1><p>Draft materials; local edits included. No approval, certification or efficacy is implied.</p>' +
    '<nav aria-label="Contents"><h2>Contents</h2><ol>' + docs.map(d => '<li><a href="#p-' + d.id + '">' + d.id + ' · ' + esc(d.title) + (draftStatus(d.id) !== 'original' ? ' (local draft)' : '') + '</a></li>').join('') + '<li><a href="#p-sources">Sources</a></li></ol></nav></header>' +
    docs.map(d => '<section class="print-section" id="p-' + d.id + '"' + (d.lang ? ' lang="' + esc(d.lang) + '"' : '') + '><h1>' + d.id + ' · ' + esc(d.title) + '</h1>' + (draftStatus(d.id) !== 'original' ? '<p><em>Local draft — differs from the original issue.</em></p>' : '') + C.markdown(body(d), D.sources, { label: 'Document ' + d.id }) + '</section>').join('') +
    '<section class="print-section" id="p-sources"><h1>Sources</h1>' + D.sources.map(s => '<p>' + esc(s.id) + ' · <a href="' + esc(s.url) + '">' + esc(s.title) + '</a><br>' + esc(s.publisher + ' · ' + s.edition + ' · retrieved ' + s.retrieved + ' · ' + s.limits) + '</p>').join('') + '</section>' +
    '<p class="zh"><strong>Zero Harm &amp; Anti-Coercion.</strong> These materials exist to prevent injury and widen access. Do not use them to blame or surveil caregivers, children, workers or disabled visitors, to pressure anyone into taking part, or to hide unfavourable findings.</p>';
}
const PRINT_CSS = 'body{font:14px/1.6 system-ui,sans-serif;color:#183b37;max-width:1000px;margin:30px auto;padding:20px}h1{font-size:28px;line-height:1.2}h2{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccd5c9;padding:7px;text-align:left;vertical-align:top}th{background:#edf2e5}a{color:#236653}.print-section{break-before:page;margin-top:48px}h1,h2{break-after:avoid}tr{break-inside:avoid}.zh{border:1px solid #ccd5c9;padding:10px;margin-top:40px}@media print{body{margin:0;max-width:none}}';
function downloadHandbook(docs, title) {
  download(fileSafe(title) + '-' + today() + '.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '</style></head><body>' + packContent(docs, title) + '</body></html>', 'text/html');
  announce('Working copy downloaded with your local drafts.');
}
function printDocs(docs, title) {
  flush();
  const area = $('#printarea');
  area.innerHTML = packContent(docs, title);
  document.body.classList.add('printingpack');
  const done = () => { document.body.classList.remove('printingpack'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}


/* ---------- 8. Start-up ---------- */
function bootLoad() {
  let res;
  try { res = C.loadState(store, D); } catch (e) { res = { state: C.blankState(), origin: 'unavailable', blocked: false, report: ['Browser storage is unavailable here.'] }; }
  state = res.state;
  if (res.origin === 'unavailable') { ui.storageMissing = true; setStorage('unavailable'); addBanner('storage', 'warning', '<p><strong>Browser storage is unavailable.</strong> ' + esc(res.report[0] || '') + ' Export a backup before closing this page.</p>', [['Export backup', exportBackup]]); }
  else if (res.origin === 'quarantined') {
    ui.blocked = true; ui.quarantineRaw = res.raw; setStorage('blocked');
    addBanner('quarantine', 'danger', '<p><strong>Saved planning data could not be read, so saving is paused to protect it.</strong></p><ul>' + res.report.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul><p>Download the unreadable data (it may be repairable or importable elsewhere), then start a new workspace or import a backup.</p>',
      [['Download unreadable data', () => download('child-safer-unreadable-data-' + today() + '.json', ui.quarantineRaw || '', 'application/json')],
       ['Start a new workspace' + (res.recoveryKey ? ' (recovery copy is kept)' : ''), () => {
         if (!res.recoveryKey && !ui.quarantineConfirmed) { ui.quarantineConfirmed = true; announce('No recovery copy could be kept. Download the unreadable data first; press "Start a new workspace" again to continue without it.'); return; }
         ui.blocked = false; dropBanner('quarantine'); C.addLog(state, 'recovery', 'Started a new workspace after unreadable data' + (res.recoveryKey ? ' (recovery copy ' + res.recoveryKey + ')' : '') + '.'); save(); render(); announce('New workspace started.');
       }]]);
  } else if (res.origin === 'legacy-unreadable') {
    addBanner('legacy', 'warning', '<p><strong>Older planning data in this browser could not be migrated.</strong> ' + esc(res.report[0]) + '</p>', [['Open Your data', () => go('data')]], true);
    save();
  } else if (res.origin.endsWith('migrated')) {
    addBanner('migration', 'notice', '<p><strong>Earlier planning data was copied into this workspace.</strong></p><ul>' + res.report.map(r => '<li>' + esc(r.replace('copied into version 3', 'copied into this workspace')) + '</li>').join('') + '</ul>', [['Review drafts in the library', () => go('library')]], true);
    save();
  } else if (res.origin === 'v3' && store.engine === 'indexeddb' && !store.hasInDatabase(C.KEYS.v3)) {
    // Version 3 kept work in localStorage. Copy it into the database; leave the original untouched.
    const before = store.usedBefore();
    if (before) addBanner('older-copy', 'warning', '<p><strong>The browser database is empty, although this browser started using it on ' + esc(before.slice(0, 10)) + '.</strong> The workspace shown now is the older copy kept in browser storage, which may be out of date. Check your latest backup before you continue.</p>', [['Import a backup', () => $('#import').click()], ['Open Your data', () => go('data')]], true);
    else addBanner('moved', 'notice', '<p><strong>Your version 3 workspace was copied into this browser\'s database.</strong> The earlier copy in browser storage was left unchanged; you can delete it under Your data once you are happy.</p>', [['Open Your data', () => go('data')]], true);
    save();
  } else if (res.origin === 'v3') { ui.lastSaved = null; setStorage('saved', 'Loaded from this browser'); $('#storage').textContent = 'Saved in this browser'; }
  else { save(); }
  if (store && store.engine === 'localstorage') addBanner('fallback', 'notice', '<p><strong>Saved in simpler browser storage.</strong> This browser does not allow its database here' + (store.reason ? ' (' + esc(store.reason) + ')' : '') + ', so work is kept in localStorage, which holds about 5 MB. Export backups regularly.</p>', [], true);
  try { const u = store.getItem(C.KEYS.undo); if (u && !ui.blocked) { const s = JSON.parse(u); C.validate(s.state, D); ui.snap = s; } } catch (e) { ui.snap = null; }
  updateUndo(); renderWorkspaceName();
}
/* Offline copy for hosted use only. From a folder or as a single file the
 * workspace already works offline, so no service worker is registered. */
function registerOffline() {
  const hosted = /^https?:$/.test(window.location.protocol) && window.isSecureContext && 'serviceWorker' in navigator && BUILD !== 'standalone';
  if (!hosted) { ui.offline = window.location.protocol === 'file:' ? 'file' : 'none'; renderStatusBar(); return; }
  const link = document.createElement('link'); link.rel = 'manifest'; link.href = 'app.webmanifest'; document.head.append(link);
  ui.offline = 'installing'; renderStatusBar();
  navigator.serviceWorker.register('sw.js').then(reg => {
    navigator.serviceWorker.ready.then(() => { ui.offline = 'cached'; renderStatusBar(); });
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) announce('A newer version of the workspace was downloaded. It will be used the next time you open it.'); });
    });
  }).catch(() => { ui.offline = 'failed'; renderStatusBar(); });
}
RENDER.discover = discoverView;
RENDER.start = startView;
RENDER.brief = briefView;
RENDER.glossary = glossaryView;
RENDER.library = libraryView;
RENDER.evidence = evidenceView;
RENDER.sources = sourcesView;
RENDER.workflows = opts => { if (/^W\d\d$/.test(opts.arg || '')) opts.focusWorkflow = opts.arg; workflowsView(opts); };
RENDER.pathway = pathwayView;
RENDER.plan = planView;
RENDER.gates = gatesView;
RENDER.registers = opts => { if (opts.arg && D.registers.includes(opts.arg)) ui.registerName = opts.arg; registersView(); };
RENDER.calculator = calcView;
RENDER.evaluation = evaluationView;
RENDER.adapt = adaptView;
RENDER.data = dataView;
RENDER.about = aboutView;
RENDER.notfound = notFoundView;

/* Settings dialog: every change applies at once and is saved as a preference. */
function wireSettings() {
  const dlg = $('#settingsdlg'), form = $('#settingsform');
  const sync = () => { for (const [k, v] of Object.entries(settings)) { const el = form.querySelector('input[name="set-' + k + '"][value="' + (k === 'mode' ? effectiveMode() : v) + '"]'); if (el) el.checked = true; } };
  $('#settingsbtn').onclick = () => { sync(); $('#settingsnote').textContent = ''; if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); };
  form.onchange = e => {
    const m = e.target.name && e.target.name.match(/^set-(\w+)$/); if (!m) return;
    settings[m[1]] = e.target.value;
    const ok = saveSettings(); applySettings();
    $('#settingsnote').textContent = ok ? 'Saved in this browser.' : 'Applied for now; this browser does not allow saving settings.';
  };
  $('#settingsreset').onclick = () => { settings = C.readSettings(null); try { window.localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* ignore */ } applySettings(); sync(); $('#settingsnote').textContent = 'Settings reset to the defaults.'; };
  $('#settingsclose').onclick = () => dlg.close();
}
function wireSearch() {
  $('#searchbtn').onclick = openSearch;
  $('#searchq').oninput = e => drawResults(e.target.value);
  $('#searchq').onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; } // close at once, even with text typed
    if (e.key === 'Enter') { const a = $('#searchresults a'); if (a) { e.preventDefault(); closeSearch(); window.location.hash = a.getAttribute('href'); } }
    if (e.key === 'ArrowDown') { const a = $('#searchresults a'); if (a) { e.preventDefault(); a.focus(); } }
  };
  $('#searchresults').onkeydown = e => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const links = $$('#searchresults a'), i = links.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault(); const n = e.key === 'ArrowDown' ? Math.min(links.length - 1, i + 1) : i - 1;
    if (n < 0) $('#searchq').focus(); else links[n].focus();
  };
  $('#searchresults').onclick = e => { if (e.target.closest('a')) closeSearch(); };
  $('#searchclose').onclick = closeSearch;
}
async function boot() {
  $('#view').innerHTML = '<p class="loading">Opening your workspace…</p>';
  loadSettings(); applySettings();
  try {
    store = await window.CSSStore.createStore({ guard: [C.KEYS.v3], legacy: [C.KEYS.v3, C.KEYS.v2, C.KEYS.v1, C.KEYS.undo], onConflict,
      onWriteError: e => writeFailed((e && e.name) || 'Error') });
  } catch (e) { store = null; }
  bootLoad();
  ui.defaultMode = hasWork() ? 'full' : 'essentials';
  ui.ready = true;
  applySettings(); renderBanners(); wireSettings(); wireSearch();
  $('#undo').onclick = undo;
  $('#export').onclick = exportBackup;
  $('#importbutton').onclick = () => $('#import').click();
  $('#modebtn').onclick = toggleMode;
  $('#modebtn2').onclick = toggleMode;
  $('#ctxbtn').onclick = toggleContext;
  // From the phone menu: close the menu, then open the explanation panel; focus returns to the menu button.
  $('#ctxbtn2').onclick = () => { closeDrawers(true); renderContext(); openDrawer($('#context'), $('#menubtn')); };
  $('#menubtn').onclick = () => { const sb = $('#sidebar'); if (drawer && drawer.el === sb) closeDrawers(); else openDrawer(sb, $('#menubtn')); };
  // The status toast sits just above the status bar, whatever its height.
  const sb = $('#statusbar'), setSb = () => document.documentElement.style.setProperty('--sb-h', sb.offsetHeight + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(setSb).observe(sb); setSb();
  window.addEventListener('resize', () => { if (drawer && ((drawer.el.id === 'sidebar' && !narrow()) || (drawer.el.id === 'context' && !ctxOverlay()))) closeDrawers(true); renderContext(); });
  registerOffline();
  route({ force: true, noFocus: true });
}
$('#import').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 15000000) throw Error('The backup is larger than 15 MB.');
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (err) { throw Error('The file is not valid JSON.'); }
    previewImport(obj, 'file ' + file.name);
  } catch (err) { announce('Import rejected: ' + err.message + ' Current work was not changed.'); }
};
boot();
