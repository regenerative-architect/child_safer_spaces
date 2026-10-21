'use strict';
/* Child-Safer Spaces · build script · version 4.0
 *
 * Node.js 18+ and its standard library only. Run from any folder:
 *   node source/build.cjs              regenerate every generated file and SHA256SUMS.txt
 *   node source/build.cjs --check      report generated files that are out of date (exit 1 if any)
 *   node source/build.cjs --checksums  refresh SHA256SUMS.txt only (after adding test results)
 *
 * Editable sources: documents/01.md–48.md and 50.md–54.md (front matter + Markdown),
 * source/content.json (sources, evidence, tasks, gates, registers, workflows,
 * decision rights, roles, local decisions, routes, view guides, glossary,
 * starting-point rules, journey, attributions), core.js, store.js,
 * atmosphere.js, app.js, index.html, style.css, icon.svg.
 * Generated: documents/49.md (workflow cards), documents/55.md (glossary),
 * data.js, standalone.html, handbook.html, role-packs/*.html, registers/*.csv
 * and README, examples/*, SOURCES.md, LOCAL-DECISIONS.md, manifest.json,
 * app.webmanifest and sw.js (used only when served from a secure web address),
 * SHA256SUMS.txt.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const C = require(path.join(root, 'core.js'));
const args = process.argv.slice(2), CHECK = args.includes('--check'), SUMS_ONLY = args.includes('--checksums');
const rel = p => path.join(root, p);
const read = p => fs.readFileSync(rel(p), 'utf8');
const outputs = new Map();
function emit(p, text) { outputs.set(p, text); }

/* ---------- Checksums ---------- */
function allFiles(dir = root, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const r = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) return allFiles(path.join(dir, e.name), r);
    return [r];
  });
}
function writeChecksums() {
  // Every file except this manifest and the test run logs in source/test-results/ (they change on every run).
  const files = allFiles().filter(f => f !== 'SHA256SUMS.txt' && !f.startsWith('source/test-results/')).sort();
  const lines = files.map(f => crypto.createHash('sha256').update(fs.readFileSync(rel(f))).digest('hex') + '  ' + f);
  fs.writeFileSync(rel('SHA256SUMS.txt'), lines.join('\n') + '\n');
  return files.length;
}
if (SUMS_ONLY) { console.log('SHA256SUMS.txt lists ' + writeChecksums() + ' files.'); process.exit(0); }

/* ---------- Read and check the sources ---------- */
const content = JSON.parse(read('source/content.json'));
function parseDoc(text, file) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw Error(file + ': missing front matter (--- id/title/role ---).');
  const meta = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  if (!/^\d\d$/.test(meta.id || '') || !meta.title || !meta.role) throw Error(file + ': front matter needs id (two digits), title and role.');
  if (meta.lang && !/^[a-z]{2}(-[A-Z]{2})?$/.test(meta.lang)) throw Error(file + ': lang must be a language tag such as fr or es-MX.');
  const d = { id: meta.id, title: meta.title, role: meta.role, generated: meta.generated === 'true', body: m[2].replace(/\s+$/, '') };
  if (meta.lang) d.lang = meta.lang;
  return d;
}
const docs = fs.readdirSync(rel('documents')).filter(f => /^\d\d\.md$/.test(f)).sort()
  .map(f => parseDoc(read('documents/' + f), 'documents/' + f)).filter(d => !d.generated);
const cell = s => String(s).replace(/\|/g, '/');
const KINDS = { now: 'No approval needed', review: 'Needs local review', signed: 'Needs signed commitment' };
function workflowDoc() {
  const lines = ['## How to use these cards',
    'Each workflow names its trigger, prerequisites, owner, decision authority, inputs, steps, record, acceptance criteria and escalation route. The label says whether the work needs no new approval, needs local review, or needs a signed commitment; gates still run in order. The Workflows view in the workspace shows the same cards with links to documents and registers. This document is generated from source/content.json; edit the workflows there, or keep a local draft here.',
    '## Decision rights and evidence',
    '| Decision | Who may start it | Who decides | Minimum evidence | Timing (program default) | Record | Escalation |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...content.decisionRights.map(r => '| ' + [r.decision, r.initiate, r.decide, r.evidence, r.timing, r.record, r.escalate].map(cell).join(' | ') + ' |'),
    'No decision right here can waive an applicable legal requirement or an authority\'s determination.'];
  for (const w of content.workflows) {
    lines.push('## ' + w.id + ' · ' + w.title,
      '**' + KINDS[w.kind] + '** · Gate: ' + (w.gate || 'any') + ' · Owner: ' + w.owner + ' · Decision authority: ' + w.authority,
      '| Part | Detail |', '| --- | --- |',
      ...[['Trigger', w.trigger], ['Prerequisites', w.prerequisites], ['Inputs', w.inputs], ['Output or record', w.outputs], ['Acceptance or completion', w.acceptance], ['Exceptions and escalation', w.escalation], ['Documents', w.docs.join(', ')], ['Registers', w.registers.join(', ')]].map(([k, v]) => '| ' + k + ' | ' + cell(v) + ' |'),
      '**Steps**', ...w.steps.map((s, i) => (i + 1) + '. ' + s));
  }
  return lines.join('\n');
}
docs.push({ id: '49', title: 'Workflow cards and decision rights', role: 'All', generated: true, body: workflowDoc() });
/* Document 55: the glossary, generated from content.json so the workspace and the handbook agree. */
const routeLabel = id => (content.routes.find(r => r.id === id) || {}).label;
function glossaryDoc() {
  const see = s => /^\d\d$/.test(s) ? 'Document ' + s : 'Workspace: ' + (routeLabel(s) || s);
  return ['## How to use this glossary', 'Plain-language definitions of the words used in this package. The workspace has a searchable version (Glossary). This document is generated from source/content.json; edit the glossary there, or keep a local draft here.',
    '| Term | In plain words | More detail | Where it matters |', '| --- | --- | --- | --- |',
    ...content.glossary.map(g => '| ' + [g.term, g.plain, g.more, see(g.see)].map(cell).join(' | ') + ' |')].join('\n');
}
docs.push({ id: '55', title: 'Glossary', role: 'All', generated: true, body: glossaryDoc() });
docs.sort((a, b) => Number(a.id) - Number(b.id));
const cites = b => [...new Set([...b.matchAll(/\[(S\d+)\]/g)].map(m => m[1]))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
docs.forEach(d => { d.cites = cites(d.body); });

const problems = [];
const srcIds = new Set(content.sources.map(s => s.id));
const docIds = docs.map(d => d.id);
if (new Set(docIds).size !== docIds.length) problems.push('duplicate document ids');
docs.forEach(d => d.cites.forEach(s => { if (!srcIds.has(s)) problems.push(d.id + ' cites unknown ' + s); }));
content.evidence.forEach(e => e.sources.forEach(s => { if (!srcIds.has(s)) problems.push(e.id + ' cites unknown ' + s); }));
for (const [k, ids] of Object.entries(content.rolePacks)) ids.forEach(id => { if (!docIds.includes(id)) problems.push('role pack ' + k + ' lists missing document ' + id); });
for (const w of content.workflows) { w.docs.forEach(id => { if (!docIds.includes(id)) problems.push(w.id + ' lists missing document ' + id); }); w.registers.forEach(r => { if (!content.schemas[r]) problems.push(w.id + ' lists missing register ' + r); }); }
for (const t of content.tasks) { if (!content.gates.some(g => g.id === t.gate)) problems.push(t.id + ' has unknown gate'); if (!content.workflows.some(w => w.id === t.workflow)) problems.push(t.id + ' has unknown workflow'); }
for (const n of content.registers) { const m = content.registerMeta[n]; if (!m || !content.schemas[n] || m.example.length !== content.schemas[n].length) problems.push('register ' + n + ' metadata or example does not match its schema'); }
for (const s of content.sources) for (const f of ['id', 'title', 'publisher', 'url', 'jurisdiction', 'type', 'edition', 'retrieved', 'access', 'scope', 'limits']) if (!s[f]) problems.push(s.id + ' missing ' + f);
// Version 4 structures: routes, view guides, glossary links, starting-point rules and the journey must all resolve.
const routeIds = new Set(content.routes.map(r => r.id)), stageIds = new Set(content.journey.map(j => j.id));
const GUIDE = ['what', 'why', 'how', 'life', 'outcome', 'technical', 'uncertain'];
for (const r of content.routes) { if (!stageIds.has(r.group)) problems.push('route ' + r.id + ' has unknown group ' + r.group); if (!['essentials', 'full'].includes(r.mode)) problems.push('route ' + r.id + ' mode'); }
for (const id of [...routeIds, 'doc', 'notfound']) { const g = content.viewGuides[id]; if (!g) problems.push('no view guide for ' + id); else GUIDE.forEach(f => { if (!String(g[f] || '').trim()) problems.push('view guide ' + id + ' missing ' + f); }); }
for (const j of content.journey) if (!routeIds.has(j.route)) problems.push('journey stage ' + j.id + ' points to unknown route ' + j.route);
const targetOk = t => t.kind === 'doc' ? docIds.includes(t.ref) : t.kind === 'wf' ? content.workflows.some(w => w.id === t.ref) : t.kind === 'reg' ? !!content.schemas[t.ref] : t.kind === 'view' ? routeIds.has(String(t.ref).split('#')[0]) : false;
for (const r of content.startRules) {
  if (!targetOk(r.target)) problems.push('start rule ' + r.id + ' has unknown target ' + JSON.stringify(r.target));
  if (!['now', 'review', 'signed'].includes(r.work)) problems.push('start rule ' + r.id + ' work kind');
  for (const [dim, vals] of Object.entries(r.when)) { const q = content.startQuestions.find(x => x.id === dim); if (!q) problems.push('start rule ' + r.id + ' unknown question ' + dim); else vals.forEach(v => { if (!q.options.some(o => o[0] === v)) problems.push('start rule ' + r.id + ' unknown answer ' + dim + '=' + v); }); }
}
for (const g of content.glossary) if (!(/^\d\d$/.test(g.see) ? docIds.includes(g.see) : routeIds.has(g.see))) problems.push('glossary "' + g.term + '" points to unknown ' + g.see);
if (problems.length) { console.error('Content problems:\n - ' + problems.join('\n - ')); process.exit(2); }

/* ---------- Data for the workspace ---------- */
const v2 = JSON.parse(read('docs/history/v2/content-v2.json'));
const legacyHashes = { v2: Object.fromEntries(v2.docs.map(d => [d.id, C.hash(d.body)])) };
const docHashes = Object.fromEntries(docs.map(d => [d.id, C.hash(d.body)]));
const D = { ...content, docs: docs.map(({ generated, ...d }) => d), docHashes, legacyHashes };
emit('data.js', '/* Generated by source/build.cjs — edit documents/*.md and source/content.json instead. */\nwindow.CSS_DATA=' + JSON.stringify(D).replace(/</g, '\\u003c') + ';\n');
emit('documents/49.md', '---\nid: 49\ntitle: Workflow cards and decision rights\nrole: All\ngenerated: true\n---\n' + docs.find(d => d.id === '49').body + '\n');
emit('documents/55.md', '---\nid: 55\ntitle: Glossary\nrole: All\ngenerated: true\n---\n' + docs.find(d => d.id === '55').body + '\n');

/* ---------- Registers and examples ---------- */
for (const n of content.registers) emit('registers/' + n + '.csv', C.csv(content.schemas[n], []));
emit('registers/README.md', '# Register templates\n\nThese ' + content.registers.length + ' CSV files contain headers only. The workspace creates, edits, imports and exports non-sensitive planning rows with the same columns. Fictional example rows are in ../examples and in the workspace ("Show fictional example"); they are never copied into live registers.\n\n' +
  '## Rules\n\n- Use stable IDs to link hazards, actions and assets. Never reuse an ID.\n- Dates: YYYY-MM-DD; date-times with offset, e.g. 2026-11-03T08:40-05:00.\n- Blank means unknown, not zero. Keep currency explicit.\n- Roles, not names. Internal codes only for workers.\n- No personal or sensitive records: children\'s identities, injury or health details, CCTV, witness details, claim numbers, confidential contracts. Point to the protected record with a reference instead.\n- Product thresholds and inspection frequencies need approval before use.\n- Import: the header row must match exactly (comma-, semicolon- or tab-separated, UTF-8). At most 500 rows. The workspace previews before replacing and keeps an undo copy.\n- Export: every cell is quoted and formula-like text gets a leading apostrophe; the workspace removes that apostrophe again on import.\n\n' +
  '## Registers\n\n| Register | Columns | Purpose | Related documents |\n| --- | --- | --- | --- |\n' + content.registers.map(n => '| ' + n + ' | ' + content.schemas[n].length + ' | ' + content.registerMeta[n].purpose + ' | ' + content.registerMeta[n].docs.join(', ') + ' |').join('\n') + '\n');
for (const n of content.registers) emit('examples/fictional-' + n + '.csv', C.csv(content.schemas[n], [content.registerMeta[n].example]));
emit('examples/evidence-ledger.csv', C.csv(['id', 'claim', 'category', 'sources', 'setting', 'transfer', 'basis', 'limits', 'implication'], content.evidence.map(e => [e.id, e.claim, e.category, e.sources.join(','), e.setting, e.transfer, e.basis, e.limits, e.implication])));
emit('examples/README.md', '# Fictional examples\n\nEvery `fictional-*.csv` file holds one invented example row for the matching register, for site "EX-001", a fictional retailer. No real company, person, product, price, incident or approval is represented. Never merge these rows into live records or analysis.\n\n`evidence-ledger.csv` is the program\'s evidence ledger (claims, categories, sources and limits). It is reference material, not pilot outcomes.\n');

/* ---------- Handbook and role packs ---------- */
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const PRINT_SCRIPT = "document.getElementById('printbtn').addEventListener('click',function(){window.print();});";
const ZH = '<p><strong>Zero Harm &amp; Anti-Coercion.</strong> These materials exist to prevent injury and widen access. Do not use them to blame or surveil caregivers, children, workers or disabled visitors, to pressure anyone into taking part, or to hide unfavourable findings. This page makes no network connections and contains no tracking.</p>';
const sourceBlock = list => list.map(s => '<section class="source" id="src-' + s.id + '"><h3>' + C.esc(s.id + ' · ' + s.title) + '</h3><dl>' +
  [['Publisher', s.publisher], ['Link', '<a href="' + C.esc(s.url) + '">' + C.esc(s.url) + '</a>'], ['Jurisdiction', s.jurisdiction], ['Type', s.type], ['Edition / date', s.edition], ['Retrieved', s.retrieved], ['Access', s.access], ['What it supports', s.scope], ['Limits', s.limits]]
    .map(([k, v]) => '<dt>' + k + '</dt><dd>' + (k === 'Link' ? v : C.esc(v)) + '</dd>').join('') + '</dl></section>').join('');
function handbook(list, title, base, kind) {
  const usedSources = kind === 'pack' ? content.sources.filter(s => list.some(d => d.cites.includes(s.id))) : content.sources;
  const appendix = [['evidence', 'Evidence ledger'], ['sources', kind === 'pack' ? 'Sources cited in this pack' : 'Source register'], ['local', 'Decisions that still need local professionals, authorities, evidence or signatures']];
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src ' + sha(PRINT_SCRIPT) + '; style-src \'self\' file: \'unsafe-inline\'; img-src \'self\' file: data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'">' +
    '<meta name="referrer" content="no-referrer"><title>' + C.esc(title) + '</title><link rel="stylesheet" href="' + base + 'style.css">' +
    '<style>main.hb{margin:0 auto;max-width:1060px;padding:0 24px}.hb .handbook-section{margin:56px 0}.hb .contents{columns:2}.hb .titlepage{padding:30px 0 10px}.hb .source dl{grid-template-columns:150px 1fr}' +
    '@media(max-width:700px){.hb .contents{columns:1}}@media print{@page{margin:16mm 14mm;@bottom-right{content:counter(page) " / " counter(pages);font-size:9pt}@bottom-left{content:"Child-Safer Spaces v' + content.version + ' · planning draft, not an approval";font-size:9pt}}.hb .handbook-section{break-before:page;margin:0}.hb .toolbar{display:none}.hb .contents{columns:2}main.hb{max-width:none;padding:0}}</style></head>' +
    '<body><main class="hb" id="main"><div class="toolbar"><a class="button" href="' + base + 'index.html">Open the workspace</a><button type="button" id="printbtn">Print / save as PDF</button></div>' +
    '<div class="titlepage"><p class="eyebrow">Version ' + content.version + ' · ' + content.issued + ' · original issue copy</p><h1>' + C.esc(title) + '</h1>' +
    '<div class="notice"><p>General framework with U.S. and Canadian worked examples and a global adaptation layer (documents 50 to 55). No site, product, approval, partner, funding, insurer concession, endorsement or efficacy is assumed. Sources checked ' + C.esc(content.sourcesChecked) + '. Local drafts made in the workspace are not included in this static copy; use "Download working handbook" in the workspace for those.</p></div>' +
    '<p>Labels used in the text: <strong>Source fact</strong> (narrow statement supported by the cited source), <strong>Program rule / recommendation</strong> (our proposal), <strong>Illustration</strong> (invented inputs to explain a method), <strong>Unresolved</strong> (the site must obtain it). Bracketed codes such as [S28] point to the source register.</p></div>' +
    '<nav aria-label="Contents"><h2>Contents</h2><div class="contents">' + list.map(d => '<p><a href="#doc-' + d.id + '">' + d.id + ' · ' + C.esc(d.title) + '</a></p>').join('') + appendix.map(([id, t]) => '<p><a href="#' + id + '">' + C.esc(t) + '</a></p>').join('') + '</div></nav>' +
    list.map(d => '<section class="handbook-section" id="doc-' + d.id + '"' + (d.lang ? ' lang="' + d.lang + '"' : '') + '><p class="eyebrow">Document ' + d.id + ', ' + C.esc(d.role) + '</p><h2 class="doctitle">' + C.esc(d.title) + '</h2>' + (d.lang ? '<p class="notice" lang="en">Draft translation that no native speaker has reviewed yet.</p>' : '') + C.markdown(d.body.replace(/^## /gm, '### ').replace(/^# /gm, '### '), content.sources, { label: 'Document ' + d.id }) +
      (d.cites.length ? '<p class="muted">Sources cited: ' + d.cites.map(s => '<a href="#src-' + s + '">' + s + '</a>').join(', ') + '</p>' : '<p class="muted">No external source cited; program guidance.</p>') + '</section>').join('') +
    '<section class="handbook-section" id="evidence"><h2>Evidence ledger</h2><div class="tablewrap" tabindex="0" role="region" aria-label="Evidence ledger"><table><thead><tr><th scope="col">ID</th><th scope="col">Claim</th><th scope="col">Category</th><th scope="col">Sources</th><th scope="col">Transfer to children in retail</th><th scope="col">Limits</th><th scope="col">Implication</th></tr></thead><tbody>' +
    content.evidence.map(e => '<tr><td>' + e.id + '</td><td>' + C.esc(e.claim) + '</td><td>' + C.esc(e.category) + '</td><td>' + (e.sources.join(', ') || '—') + '</td><td>' + C.esc(e.transfer) + '</td><td>' + C.esc(e.basis + '. ' + e.limits) + '</td><td>' + C.esc(e.implication) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="handbook-section" id="sources"><h2>' + (kind === 'pack' ? 'Sources cited in this pack' : 'Source register') + '</h2><p>Full licensed standards and all state, provincial and local laws were not audited. Access levels are stated per source.</p>' + sourceBlock(usedSources) + '</section>' +
    '<section class="handbook-section" id="local"><h2>Decisions that still need local professionals, authorities, evidence or signatures</h2><div class="tablewrap" tabindex="0" role="region" aria-label="Local decisions"><table><thead><tr><th scope="col">Decision</th><th scope="col">Who decides</th><th scope="col">Gate</th><th scope="col">Why</th></tr></thead><tbody>' +
    content.localDecisions.map(l => '<tr><td>' + C.esc(l.item) + '</td><td>' + C.esc(l.who) + '</td><td>' + C.esc(l.gate) + '</td><td>' + C.esc(l.why) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<footer>' + ZH + '<p>Child-Safer Spaces · version ' + content.version + ' · ' + content.issued + '.</p></footer></main><script>' + PRINT_SCRIPT + '</script></body></html>\n';
}
emit('handbook.html', handbook(docs, 'Child-Safer Spaces · Complete implementation handbook', '', 'full'));
for (const r of content.roles) emit('role-packs/' + r.key.toLowerCase() + '.html', handbook(docs.filter(d => content.rolePacks[r.key].includes(d.id)), r.name + ' working pack', '../', 'pack'));

/* ---------- Briefs for officials (documents 50–52) as print pages ----------
 * Short, script-free pages that print as a two-page brief plus its sources;
 * source/make-pdf.py turns them into PDFs to attach to an email. */
function briefPage(d) {
  const used = content.sources.filter(s => d.cites.includes(s.id)), lang = d.lang || 'en';
  const note = { fr: 'Traduction provisoire, non relue par une personne de langue maternelle française.', es: 'Traducción provisional, no revisada por una persona de lengua materna española.' }[lang];
  return '<!doctype html>\n<html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src ' + sha(PRINT_SCRIPT) + '; style-src \'self\' file: \'unsafe-inline\'; img-src \'self\' file: data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'">' +
    '<meta name="referrer" content="no-referrer"><title>' + C.esc(d.title) + '</title><link rel="stylesheet" href="../style.css">' +
    '<style>main.hb{margin:0 auto;max-width:820px;padding:0 24px}.brief h1{font-size:2rem;max-width:none}.brief .refs li{font-size:.82rem;margin:.2rem 0;max-width:none;word-break:break-word}' +
    '@media print{@page{margin:14mm 14mm;@bottom-right{content:counter(page) " / " counter(pages);font-size:8pt}@bottom-left{content:"Child-Safer Spaces ' + content.version + ' · document ' + d.id + ' · planning draft, not an approval";font-size:8pt}}body{font-size:9.6pt}.brief h1{font-size:17pt}.brief h2{font-size:12pt;margin:12pt 0 4pt}.brief p,.brief li{margin:3pt 0}.brief table{font-size:8.2pt}.brief .refs li{font-size:7.6pt}.hb .toolbar{display:none}main.hb{max-width:none;padding:0}}</style></head>' +
    '<body><main class="hb brief" id="main"><div class="toolbar"><a class="button" href="../index.html#/brief">Open the workspace</a><button type="button" id="printbtn">Print / save as PDF</button></div>' +
    '<p class="eyebrow">Child-Safer Spaces ' + content.version + ', document ' + d.id + ', ' + content.issued + '</p><h1>' + C.esc(d.title) + '</h1>' +
    (note ? '<p class="notice">' + C.esc(note) + '</p>' : '') + C.markdown(d.body, content.sources, { label: 'Brief' }) +
    '<section class="refs"><h2>' + ({ fr: 'Sources', es: 'Fuentes' }[lang] || 'Sources') + '</h2><ol>' + used.map(s => '<li id="src-' + s.id + '"><strong>' + s.id + '</strong> ' + C.esc(s.title) + '. ' + C.esc(s.publisher) + ', ' + C.esc(s.edition) + '. ' + C.esc(s.url) + '</li>').join('') + '</ol></section>' +
    '<footer>' + ZH + '</footer></main><script>' + PRINT_SCRIPT + '</script></body></html>\n';
}
for (const id of ['50', '51', '52']) { const d = docs.find(x => x.id === id); emit('briefs/brief-' + (d.lang || 'en') + '.html', briefPage(d)); }

/* ---------- Markdown references ---------- */
emit('SOURCES.md', '# Source register\n\nVersion ' + content.version + '. Sources checked ' + content.sourcesChecked + '. Each entry states jurisdiction, edition or date, retrieval date, access level and limits. Full licensed standards and all local laws were not audited; "public scope" means only the publisher\'s scope page was read. Bracketed IDs in the documents (for example [S28]) are claim-level citations.\n\n' +
  content.sources.map(s => {
    const inDocs = docs.filter(d => d.cites.includes(s.id)).map(d => d.id), inEv = content.evidence.filter(e => e.sources.includes(s.id)).map(e => e.id);
    return '## ' + s.id + ' — ' + s.title + '\n\n- Publisher: ' + s.publisher + '\n- Link: ' + s.url + '\n- Jurisdiction: ' + s.jurisdiction + '\n- Type: ' + s.type + '\n- Edition / date: ' + s.edition + '\n- Retrieved: ' + s.retrieved + '\n- Access: ' + s.access + '\n- What it supports: ' + s.scope + '\n- Limits: ' + s.limits + '\n- Cited in documents: ' + (inDocs.join(', ') || '—') + '\n- Evidence claims: ' + (inEv.join(', ') || '—');
  }).join('\n\n') + '\n');
emit('LOCAL-DECISIONS.md', '# What still requires local professionals, authorities, evidence or signed commitments\n\nVersion ' + content.version + '. This bundle cannot decide these items. Each blocks the gate shown until the named party decides in writing. Workspace checkboxes are never signatures.\n\n| Decision | Who decides | Gate | Why it cannot be decided here |\n| --- | --- | --- | --- |\n' +
  content.localDecisions.map(l => '| ' + [l.item, l.who, l.gate, l.why].map(cell).join(' | ') + ' |').join('\n') +
  '\n\n## Can begin today — no new approval needed (G0–G1)\n\n' + content.tasks.filter(t => t.kind === 'now' && ['G0', 'G1'].includes(t.gate)).map(t => '- ' + t.id + ' (' + t.gate + '): ' + t.title).join('\n') +
  '\n\n## No new approval needed once their gate is reached\n\n' + content.tasks.filter(t => t.kind === 'now' && !['G0', 'G1'].includes(t.gate)).map(t => '- ' + t.id + ' (' + t.gate + '): ' + t.title).join('\n') +
  '\n\n## Needs a signed commitment\n\n' + content.tasks.filter(t => t.kind === 'signed').map(t => '- ' + t.id + ' (' + t.gate + '): ' + t.title).join('\n') + '\n');
emit('manifest.json', JSON.stringify({ name: 'Child-Safer Spaces', version: content.version, issued: content.issued, sourcesChecked: content.sourcesChecked, stateSchema: C.STATE_SCHEMA,
  backupFormat: { format: 'child-safer-spaces', version: 3, reads: [1, 2, 3] }, documents: docs.map(d => ({ id: d.id, title: d.title, role: d.role, file: 'documents/' + d.id + '.md', generated: !!d.generated, hash: docHashes[d.id] })),
  registers: content.registers, routes: content.routes.map(r => r.id),
  counts: { documents: docs.length, registers: content.registers.length, sources: content.sources.length, evidence: content.evidence.length, tasks: content.tasks.length, gates: content.gates.length, workflows: content.workflows.length, rolePacks: content.roles.length, glossary: content.glossary.length, routes: content.routes.length, startRules: content.startRules.length } }, null, 2) + '\n');

/* ---------- Offline copy for hosted use (service worker and web app manifest) ----------
 * Used only when the folder is served from a secure web address; the
 * workspace never registers it from a local file or the standalone copy.
 * The cache name carries a hash of the cached files, so any change makes a
 * new cache and old ones are removed. Planning data is never cached here. */
const SW_FILES = ['index.html', 'style.css', 'data.js', 'core.js', 'store.js', 'atmosphere.js', 'app.js', 'icon.svg', 'app.webmanifest', 'handbook.html'];
const webManifest = JSON.stringify({ name: 'Child-Safer Spaces', short_name: 'Child-Safer', description: 'Offline planning kit for safer floors, carts and fixtures in places children visit.', lang: 'en',
  start_url: './index.html#/discover', scope: './', display: 'standalone', background_color: '#edf1ee', theme_color: '#183b37', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }, null, 2) + '\n';
emit('app.webmanifest', webManifest);
const swHash = crypto.createHash('sha256').update(SW_FILES.map(f => f === 'data.js' ? outputs.get('data.js') : f === 'app.webmanifest' ? webManifest : f === 'handbook.html' ? outputs.get('handbook.html') : read(f)).join('\u0000')).digest('hex').slice(0, 12);
emit('sw.js', '/* Child-Safer Spaces · offline copy for hosted use · generated by source/build.cjs.\n' +
  ' * Caches the workspace files (never planning data) so a hosted copy opens without a connection.\n' +
  ' * Only same-origin GET requests are answered; nothing is sent anywhere. */\n' +
  "'use strict';\nconst CACHE = 'child-safer-spaces-" + content.version + '-' + swHash + "';\nconst FILES = " + JSON.stringify(['./', ...SW_FILES]) + ';\n' +
  "self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });\n" +
  "self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('child-safer-spaces-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });\n" +
  "self.addEventListener('fetch', e => {\n  const req = e.request;\n  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;\n" +
  "  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? c.match('index.html') : undefined)).then(hit => hit || fetch(req))));\n});\n");

/* ---------- Standalone single file ---------- */
const SCRIPTS = ['data.js', 'core.js', 'store.js', 'atmosphere.js', 'app.js'];
const scripts = SCRIPTS.map(f => (f === 'data.js' ? outputs.get('data.js') : read(f)).replace(/<\/script/gi, '<\\/script'));
const iconData = 'data:image/svg+xml;base64,' + Buffer.from(read('icon.svg')).toString('base64');
let standalone = read('index.html')
  .replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src ' + scripts.map(sha).join(' ') + '; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'; frame-src \'none\'">')
  .replace('<html lang="en">', '<html lang="en" data-build="standalone">')
  .replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', '<link rel="icon" href="' + iconData + '" type="image/svg+xml">')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css') + '</style>')
  .replace('<title>Child-Safer Spaces 4.0</title>', '<title>Child-Safer Spaces 4.0 (single file)</title>')
  .replace(/<p><strong>The workspace scripts have not loaded\.<\/strong>[\s\S]*?<\/p>/, '<p><strong>The workspace scripts have not loaded.</strong> Your browser may be blocking scripts in local files. Allow scripts for this file, or open index.html from the full bundle.</p>');
SCRIPTS.forEach((f, i) => { standalone = standalone.replace('<script src="' + f + '"></script>', () => '<script>' + scripts[i] + '</script>'); });
if (/<script src=/.test(standalone) || /href="style\.css"/.test(standalone) || /href="icon\.svg"/.test(standalone) || !standalone.includes('data-build="standalone"')) { console.error('Standalone still references external files.'); process.exit(2); }
emit('standalone.html', standalone);

/* ---------- Write or check ---------- */
if (CHECK) {
  const stale = [...outputs].filter(([p, t]) => !fs.existsSync(rel(p)) || fs.readFileSync(rel(p), 'utf8') !== t).map(([p]) => p);
  const expected = new Set([...outputs.keys()].filter(p => p.startsWith('registers/') || p.startsWith('examples/') || p.startsWith('role-packs/')));
  const extra = ['registers', 'examples', 'role-packs'].flatMap(d => fs.readdirSync(rel(d)).map(f => d + '/' + f)).filter(p => !expected.has(p));
  if (stale.length || extra.length) { console.log('Out of date: ' + stale.join(', ') + (extra.length ? '\nUnexpected files: ' + extra.join(', ') : '')); process.exit(1); }
  console.log('All ' + outputs.size + ' generated files are up to date.');
  process.exit(0);
}
for (const d of ['registers', 'examples', 'role-packs']) { fs.mkdirSync(rel(d), { recursive: true }); for (const f of fs.readdirSync(rel(d))) fs.unlinkSync(rel(d + '/' + f)); }
for (const [p, t] of outputs) { fs.mkdirSync(path.dirname(rel(p)), { recursive: true }); fs.writeFileSync(rel(p), t); }
const n = writeChecksums();
console.log('Built ' + docs.length + ' documents, ' + content.registers.length + ' registers, ' + content.roles.length + ' role packs, handbook, standalone and ' + outputs.size + ' generated files; SHA256SUMS.txt lists ' + n + ' files.');
