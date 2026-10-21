'use strict';
/* Child-Safer Spaces · automated checks · version 4.0
 * Node's built-in test runner, no packages:  node --test source/tests.cjs
 * Covers content integrity, safe rendering, CSV safety, the personal-data
 * check, state validation, v1/v2 migration, storage quarantine, gates,
 * finance, evaluation planning, the version 4 structures (routes, guides,
 * starting point, glossary, translations), the storage fallback layer,
 * offline files, colour contrast, build reproducibility and package hygiene.
 * Browser behaviour is covered separately by source/browser-tests.py. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const C = require(path.join(root, 'core.js'));
const S = require(path.join(root, 'store.js'));
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
// data.js is "window.CSS_DATA=<JSON>;" — parse the JSON directly so objects belong to this realm.
const D = JSON.parse(fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^[\s\S]*?window\.CSS_DATA=/, '').replace(/;\s*$/, ''));
const V2 = JSON.parse(fs.readFileSync(path.join(root, 'docs/history/v2/content-v2.json'), 'utf8'));
const fx = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, a + ' ≉ ' + b);
const fakeStore = (init = {}, opts = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: k => { if (opts.readThrows) throw Object.assign(new Error('denied'), { name: 'SecurityError' }); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (opts.writeThrows) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); m.set(k, String(v)); }, removeItem: k => m.delete(k), keys: () => [...m.keys()] };
};
const completeG0 = x => { for (const t of D.tasks.filter(t => t.gate === 'G0')) x.tasks[t.id] = { owner: t.owner, due: '', status: 'done', evidence: 'REF-' + t.id }; };

/* ---------- Content integrity ---------- */
test('inventory: documents, sources, evidence, tasks, gates, registers, workflows, roles', () => {
  assert.equal(D.version, '4.0');
  assert.equal(D.docs.length, 55);
  assert.equal(D.sources.length, 56);
  assert.equal(D.tasks.length, 35);
  assert.equal(D.gates.length, 7);
  assert.equal(D.registers.length, 24);
  assert.equal(D.workflows.length, 16);
  assert.equal(D.roles.length, 8);
  assert.ok(D.evidence.length >= 39 && D.decisionRights.length >= 10 && D.localDecisions.length >= 19);
  assert.equal(D.routes.length, 17); assert.equal(D.journey.length, 6); assert.ok(D.glossary.length >= 30 && D.startRules.length >= 20);
  for (const d of D.docs) assert.ok(fs.existsSync(path.join(root, 'documents', d.id + '.md')), d.id);
  for (const n of D.registers) { assert.ok(fs.existsSync(path.join(root, 'registers', n + '.csv')), n); assert.ok(fs.existsSync(path.join(root, 'examples', 'fictional-' + n + '.csv')), n); }
});
test('every claim-level citation and evidence source resolves; every source states edition, retrieval date, access and limits', () => {
  const ids = new Set(D.sources.map(s => s.id));
  for (const d of D.docs) for (const m of d.body.matchAll(/\[(S\d+)\]/g)) assert.ok(ids.has(m[1]), d.id + ' cites ' + m[1]);
  for (const e of D.evidence) for (const s of e.sources) assert.ok(ids.has(s), e.id + ' cites ' + s);
  for (const s of D.sources) {
    for (const f of ['title', 'publisher', 'url', 'jurisdiction', 'type', 'edition', 'retrieved', 'access', 'scope', 'limits']) assert.ok(String(s[f]).trim(), s.id + ' ' + f);
    assert.match(s.retrieved, /^2026-10-(19|20)/, s.id + ' retrieval date');
    assert.match(s.url, /^https:\/\//, s.id + ' url');
  }
  // Where needed: any document that names a law, regulation, standard, surveillance system or study must cite the source register.
  const named = /\b(ADA|OSHA|CFR|ASTM|ANSI|CSA\/ASC|CAN\/ULC|Food Code|TCPS|PIPEDA|NEISS|CHIRPP|FLIP|WHO|OMS|IRS|HSE|CCOHS|Title 8|Building Code|ISO|CRPD|CDPH|CDPD|ILO|OIT|SDG|ODS|WCAG|UNICEF)\b/;
  for (const d of D.docs) if (named.test(d.body)) assert.ok(d.cites.length > 0, d.id + ' names a law, standard or study but cites no source');
});
test('version 2 identifiers are preserved so existing drafts, tasks and CSVs stay compatible', () => {
  const ids = new Set(D.sources.map(s => s.id));
  for (const s of V2.sources) assert.ok(ids.has(s[0]), 'source ' + s[0]);
  for (const d of V2.docs) assert.ok(D.docs.some(x => x.id === d.id), 'doc ' + d.id);
  for (const t of V2.tasks) assert.equal(D.tasks.find(x => x.id === t.id)?.gate, t.gate, 'task ' + t.id);
  for (const g of V2.gates) assert.ok(D.gates.some(x => x.id === g[0]), 'gate ' + g[0]);
  for (const [k, cols] of Object.entries(V2.schemas)) assert.deepEqual(D.schemas[k], cols, 'register ' + k + ' columns unchanged');
});
test('workflows specify trigger, prerequisites, owner, authority, inputs, steps, record, acceptance and escalation', () => {
  for (const w of D.workflows) {
    for (const f of ['title', 'phase', 'owner', 'authority', 'trigger', 'prerequisites', 'inputs', 'outputs', 'acceptance', 'escalation']) assert.ok(String(w[f]).trim().length > 3, w.id + ' ' + f);
    assert.ok(['now', 'review', 'signed'].includes(w.kind), w.id + ' kind');
    assert.ok(w.steps.length >= 3, w.id + ' steps');
    for (const id of w.docs) assert.ok(D.docs.some(d => d.id === id), w.id + ' doc ' + id);
    for (const r of w.registers) assert.ok(D.schemas[r], w.id + ' register ' + r);
  }
  for (const r of D.decisionRights) for (const f of ['decision', 'initiate', 'decide', 'evidence', 'timing', 'record', 'escalate']) assert.ok(r[f], r.decision + ' ' + f);
  for (const k of ['Isolate', 'Suspend', 'Withdraw', 'Restart', 'Scale', 'Publish']) assert.ok(D.decisionRights.some(r => r.decision.startsWith(k)), 'decision right ' + k);
});
test('tasks: unique IDs, valid gates and workflows, a kind label, and every gate has tasks', () => {
  assert.equal(new Set(D.tasks.map(t => t.id)).size, D.tasks.length);
  for (const t of D.tasks) { assert.ok(D.gates.some(g => g.id === t.gate)); assert.ok(['now', 'review', 'signed'].includes(t.kind), t.id); assert.ok(D.workflows.some(w => w.id === t.workflow), t.id); }
  for (const g of D.gates) assert.ok(D.tasks.some(t => t.gate === g.id), g.id);
  assert.equal(D.tasks.find(t => t.id === 'T35').gate, 'G1', 'adjacent mechanisms are routed in G1');
});
test('fictional examples match their register columns and are labelled fictional', () => {
  for (const n of D.registers) {
    assert.equal(D.registerMeta[n].example.length, D.schemas[n].length, n);
    const text = fs.readFileSync(path.join(root, 'examples', 'fictional-' + n + '.csv'), 'utf8');
    assert.ok(/EX-/.test(text), n + ' example uses EX- codes');
  }
  assert.ok(/fictional/i.test(fs.readFileSync(path.join(root, 'examples', 'README.md'), 'utf8')));
});
test('role packs include their entry documents and the coverage, playbook, launch and workflow documents', () => {
  for (const r of D.roles) {
    const ids = D.rolePacks[r.key];
    for (const id of [...r.start, '45', '46', '48', '49']) assert.ok(ids.includes(id), r.key + ' pack has ' + id);
    for (const w of r.workflows) assert.ok(D.workflows.some(x => x.id === w), r.key + ' workflow ' + w);
  }
});
test('prohibited claims appear only quoted or negated, never as program claims', () => {
  const bad = /\b(child-?proof|certified safe|zero risk|injury-proof)\b/gi;
  for (const d of D.docs) {
    for (const m of d.body.matchAll(bad)) {
      const ctxText = d.body.slice(Math.max(0, m.index - 80), m.index + 40).toLowerCase();
      assert.ok(/["“'‘]/.test(d.body[m.index - 1] || '') || /\b(not|never|no|don't|do not|without|instead of)\b/.test(ctxText), d.id + ': "' + m[0] + '" needs quotes or negation');
    }
  }
});
test('documents do not imply that foam, playground testing or zero incidents establishes retail safety', () => {
  const all = D.docs.map(d => d.body).join('\n');
  assert.ok(/Zero events (are|do) not (proof|show)/i.test(all));
  assert.ok(/playground/i.test(all) && /never as retail certification|cannot certify retail safety|no retail inference|never cite playground certification/i.test(all + JSON.stringify(D.evidence) + JSON.stringify(D.sources)));
  assert.ok(!/foam (is|proves|makes).{0,20}safe/i.test(all));
});

/* ---------- Rendering safety ---------- */
test('Markdown escapes injected HTML and only links known source IDs', () => {
  const html = C.markdown('<img src=x onerror=alert(1)>\n## Heading\n# Top\n1. First\n2. Second\n**bold** [S1] [S999] [x](javascript:alert(1))', D.sources);
  assert.ok(!html.includes('<img') && !html.includes('<script'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('<h2>Heading</h2>') && html.includes('<h2>Top</h2>'), 'single h1 per page: # and ## both render as h2');
  assert.ok(html.includes('<ol>') && html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('href="https://www.access-board.gov/'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('[S999]'));
  assert.doesNotThrow(() => C.markdown('| --- | --- |'));
});

/* ---------- CSV ---------- */
test('CSV round trip: BOM, quotes, commas, line breaks and Unicode', () => {
  const h = ['first', 'second'], r = [['a,b', 'a"b'], ['line1\nline2', 'café ✓']];
  assert.deepEqual(C.parseCSV(C.csv(h, r)), [h, ...r]);
  assert.throws(() => C.parseCSV('"open'));
  assert.throws(() => C.parseCSV('a,"b"x'));
  assert.throws(() => C.parseCSV('a,b"c'));
});
test('CSV export neutralizes formula-like text (=, +, -, @, tab, CR, full-width) but leaves numbers numeric', () => {
  const cells = ['=HYPERLINK("x")', '  @SUM(1)', '+1', '-1', '\t=1', '\rX', '\tplain', '＝1+1', '＋1', 'plain text'];
  const out = C.csv(['x'], cells.map(c => [c]).concat([[-10]]));
  for (const c of cells.slice(0, 9)) assert.ok(out.includes('"\'' + c.replace(/"/g, '""')), 'neutralized: ' + JSON.stringify(c));
  assert.ok(out.includes('"plain text"') && out.includes('"-10"'));
});
test('register import: exact headers, semicolon and tab files, and lossless re-import of neutralized cells', () => {
  const H = ['a', 'b'];
  assert.deepEqual(C.registerImport('a,b\n1,2\n', H).rows, [['1', '2']]);
  const semi = C.registerImport('a;b\r\n"x;y";2\r\n', H);
  assert.equal(semi.delimiter, ';'); assert.deepEqual(semi.rows, [['x;y', '2']]);
  assert.equal(C.registerImport('a\tb\n1\t2\n', H).delimiter, '\t');
  const original = [['=1+1', '@x'], ['-3', 'normal']];
  const back = C.registerImport(C.csv(H, original), H);
  assert.deepEqual(back.rows, original); assert.equal(back.restored, 3);
  assert.throws(() => C.registerImport('a,c\n1,2', H), /Column names/);
  assert.throws(() => C.registerImport('a,b\n1,2,3', H), /Row 2 has 3 cells/);
  assert.throws(() => C.registerImport('', H), /empty/);
  assert.throws(() => C.registerImport('a,b\n' + '1,2\n'.repeat(501), H));
});

/* ---------- Personal-data check ---------- */
test('personal-data check flags contact details, ages, injuries, claims and footage but not ordinary planning text', () => {
  const flags = t => C.scanSensitive(t, 'record').map(f => f.type);
  assert.ok(flags('call 613-555-0123').includes('phone'));
  assert.ok(flags('mum@example.org').includes('email'));
  assert.ok(flags('SSN 123-45-6789').includes('idnumber'));
  assert.ok(flags('DOB 2022-01-01').includes('birth'));
  assert.ok(flags('a 3-year-old slipped').includes('age'));
  assert.ok(flags('child aged 4 fell').includes('age'));
  assert.ok(flags('Mrs Lopez reported it').includes('name'));
  assert.ok(flags('claim no. AB-12345').includes('claim'));
  assert.ok(flags('possible concussion').includes('health'));
  assert.ok(flags('see CCTV footage').includes('cctv'));
  assert.ok(flags('12 Main Street').includes('address'));
  for (const ok of ['Facilities lead to replace mat by 2026-11-04', 'Age band 5–11 counts only', 'G1 review; REF-T06', '36 in clear width per S28', 'children aged 5–11', '']) assert.deepEqual(flags(ok), [], ok);
  assert.deepEqual(C.scanSensitive('possible concussion; medical record', 'document'), [], 'document mode ignores topic words');
  assert.ok(C.scanSensitive('write to a@b.co', 'document').length === 1);
});

/* ---------- State validation ---------- */
test('state validation accepts a blank state and rejects malformed or unexpected data', () => {
  const x = C.blankState();
  assert.deepEqual(C.validate(x, D), x);
  const bad = patch => assert.throws(() => C.validate({ ...C.blankState(), ...patch }, D));
  bad({ extra: 1 }); bad({ schema: 2 }); bad({ site: 'x'.repeat(201) });
  bad({ edits: { '99': 'x' } }); bad({ editMeta: { '01': { base: 'v2', savedAt: '' } } });
  bad({ records: { evil: [] } }); bad({ records: { hazards: [['too short']] } });
  bad({ tasks: { T01: { owner: 'x', due: '', status: 'finished', evidence: '' } } });
  bad({ gates: { G2: { done: true, note: 'skip' } } });
  bad({ ranges: { initial: [5, 1] } }); bad({ ranges: { nonsense: [1, 2] } });
  bad({ calc: { ...C.defaultCalc, initial: 'x' } }); bad({ calc: { ...C.defaultCalc, injected: 1 } });
  bad({ log: [{ at: 'now', type: 'unknown', detail: '' }] });
  const proto = JSON.parse('{"__proto__":{"polluted":true},"schema":3}');
  assert.throws(() => C.validate(proto, D));
  assert.equal({}.polluted, undefined);
});

/* ---------- Migration ---------- */
test('version 2 migration keeps real drafts, drops unedited ones, preserves records and reopens gates that no longer qualify', () => {
  const v2 = fx('v2-backup.json');
  const r = C.importBackup(v2, D);
  const x = r.state;
  assert.equal(r.migrated, 'v2');
  assert.equal(x.site, 'EX-FIXTURE-02');
  assert.equal(x.edits['05'], undefined, 'draft identical to the v2 original is not carried forward');
  assert.ok(x.edits['12'].includes('Night crew'), 'real draft kept');
  assert.equal(x.editMeta['12'].base, 'v2', 'draft flagged for review against the corrected original');
  assert.notEqual(x.editMeta['12'].base, D.docHashes['12']);
  assert.equal(x.gates.G0.done, true, 'G0 still qualifies');
  assert.equal(x.gates.G1.done, false, 'G1 reopened: version 3 added task T35');
  assert.ok(r.report.some(t => /G1/.test(t)) && r.report.some(t => /other savings/.test(t)));
  assert.deepEqual(x.records.hazards, v2.state.records.hazards);
  assert.equal(x.records.publication_claims[0][1], '=HYPERLINK("http://example.invalid")', 'formula-like text preserved as text');
  assert.equal(x.calc.otherBasis, '');
  assert.ok(x.log.some(e => e.type === 'migration'));
  assert.doesNotThrow(() => C.validate(x, D));
  assert.deepEqual(fx('v2-backup.json'), v2, 'input object not mutated');
});
test('version 2 migration rejects damaged data instead of guessing', () => {
  const v2 = fx('v2-backup.json');
  for (const mutate of [s => { s.records.hazards = [['short']]; }, s => { s.calc.mystery = 1; }, s => { s.tasks.T99 = s.tasks.T01; }, s => { delete s.profile; }, s => { s.edits.zz = 'x'; }]) {
    const copy = JSON.parse(JSON.stringify(v2)); mutate(copy.state);
    assert.throws(() => C.importBackup(copy, D));
  }
});
test('version 1 migration keeps drafts and gate notes, reopens every gate and logs notes for retired gates', () => {
  const r = C.importBackup(fx('v1-backup.json'), D);
  assert.equal(r.migrated, 'v1');
  assert.equal(r.state.edits['03'], 'Version 1 local plan text (fictional).');
  assert.equal(r.state.editMeta['03'].base, 'v1');
  assert.equal(r.state.gates.G0.done, false);
  assert.equal(r.state.gates.G0.note, 'v1 sponsor note');
  assert.ok(r.state.log.some(e => /G9: note for a gate that no longer exists/.test(e.detail)));
});
test('backups: version 3 round trip is lossless; unknown formats and versions are rejected', () => {
  const x = C.blankState();
  x.site = 'S-1'; x.edits['01'] = 'Draft'; x.editMeta['01'] = { base: D.docHashes['01'], savedAt: '2026-10-20T00:00:00Z' };
  x.tasks.T01 = { owner: 'Sponsor', due: '2026-11-01', status: 'in_progress', evidence: '' };
  x.records.handoffs = [D.schemas.handoffs.map(() => 'v')]; x.ranges = { initial: [1, 2] }; x.planning.baselineRate = 3;
  const env = JSON.parse(JSON.stringify(C.backupEnvelope(x)));
  assert.deepEqual(C.importBackup(env, D).state, x);
  assert.throws(() => C.importBackup({ format: 'other', version: 3, state: x }, D));
  assert.throws(() => C.importBackup({ format: 'child-safer-spaces', version: 4, state: x }, D), /Unsupported backup version/);
  assert.throws(() => C.importBackup(null, D)); assert.throws(() => C.importBackup([], D));
});

/* ---------- Storage loading and quarantine ---------- */
test('storage: new, valid, unavailable and write-failure cases', () => {
  assert.equal(C.loadState(fakeStore(), D).origin, 'new');
  const good = C.blankState(); good.site = 'S-2';
  assert.equal(C.loadState(fakeStore({ [C.KEYS.v3]: JSON.stringify(good) }), D).state.site, 'S-2');
  assert.equal(C.loadState(fakeStore({}, { readThrows: true }), D).origin, 'unavailable');
  assert.deepEqual(C.persist(fakeStore({}, { writeThrows: true }), good), { ok: false, error: 'QuotaExceededError' });
  assert.equal(C.persist(fakeStore(), good).ok, true);
});
test('storage: unreadable version 3 data is quarantined, copied untouched and never silently replaced', () => {
  const raw = '{"site":"PRECIOUS","edits":{"01":"months of work"},"schema":3,"records":{"hazards":[["broken"]]}}';
  const s = fakeStore({ [C.KEYS.v3]: raw });
  const r = C.loadState(s, D);
  assert.equal(r.origin, 'quarantined'); assert.equal(r.blocked, true); assert.equal(r.raw, raw);
  assert.ok(r.recoveryKey.startsWith(C.KEYS.recoveryPrefix));
  assert.equal(s.m.get(r.recoveryKey), raw); assert.equal(s.m.get(C.KEYS.v3), raw, 'original key untouched by loading');
  const s2 = fakeStore({ [C.KEYS.v3]: raw }, { writeThrows: true });
  const r2 = C.loadState(s2, D);
  assert.equal(r2.recoveryKey, null); assert.equal(r2.raw, raw); assert.ok(r2.report.some(t => /Download/.test(t)));
  assert.equal(C.loadState(fakeStore({ [C.KEYS.v3]: 'not json' }), D).origin, 'quarantined');
});
test('storage: version 2 and version 1 browser data migrate without being modified', () => {
  const raw2 = JSON.stringify(fx('v2-state.json'));
  const s = fakeStore({ [C.KEYS.v2]: raw2 });
  const r = C.loadState(s, D);
  assert.equal(r.origin, 'v2-migrated'); assert.equal(s.m.get(C.KEYS.v2), raw2); assert.equal(s.m.has(C.KEYS.v3), false, 'loading alone writes nothing');
  assert.ok(r.report[0].includes('left unchanged'));
  const raw1 = JSON.stringify(fx('v1-state.json'));
  assert.equal(C.loadState(fakeStore({ [C.KEYS.v1]: raw1 }), D).origin, 'v1-migrated');
  const bad = fakeStore({ [C.KEYS.v2]: '{"site":1}' });
  const rb = C.loadState(bad, D);
  assert.equal(rb.origin, 'legacy-unreadable'); assert.equal(rb.blocked, false); assert.equal(bad.m.get(C.KEYS.v2), '{"site":1}');
});

/* ---------- Tasks and gates ---------- */
test('gates: only status or evidence changes reopen gates; owner and date edits do not', () => {
  const x = C.blankState(); completeG0(x);
  C.completeGate(x, D, 'G0', '2026-10-20 Sponsor; CHARTER-1');
  assert.equal(x.gates.G0.done, true); assert.ok(x.gates.G0.decidedAt);
  assert.deepEqual(C.applyTaskChange(x, D, 'T01', 'owner', 'Sponsor (deputy)').reopened, []);
  assert.deepEqual(C.applyTaskChange(x, D, 'T01', 'due', '2026-12-01').reopened, []);
  assert.equal(x.gates.G0.done, true);
  assert.deepEqual(C.applyTaskChange(x, D, 'T01', 'evidence', 'REF-NEW').reopened, ['G0']);
  assert.ok(x.log.some(e => e.type === 'gate-reopened'));
  assert.throws(() => C.applyTaskChange(x, D, 'T01', 'status', 'finished'));
  assert.throws(() => C.applyTaskChange(x, D, 'T99', 'owner', 'x'));
});
test('gates: completion requires earlier gates, evidence and a decision reference; amending reopens downstream', () => {
  const x = C.blankState();
  assert.throws(() => C.completeGate(x, D, 'G0', 'ref'), /T01/);
  completeG0(x);
  assert.throws(() => C.completeGate(x, D, 'G0', '  '), /decision/);
  assert.throws(() => C.completeGate(x, D, 'G1', 'ref'), /earlier gates/);
  C.completeGate(x, D, 'G0', 'ref');
  for (const t of D.tasks.filter(t => t.gate === 'G1')) x.tasks[t.id] = { owner: t.owner, due: '', status: 'not_applicable', evidence: 'rationale' };
  C.completeGate(x, D, 'G1', 'ref-1');
  assert.throws(() => C.setGateNote(x, D, 'G0', 'typo fix'), /Amend/);
  assert.deepEqual(C.amendGate(x, D, 'G0', 'amended ref').reopened, ['G0', 'G1']);
  assert.equal(x.gates.G0.note, 'amended ref');
  assert.doesNotThrow(() => C.validate(x, D));
  C.completeGate(x, D, 'G0', 'amended ref');
  assert.deepEqual(C.reopenGate(x, D, 'G0').reopened, ['G0']);
});

/* ---------- Cost scenarios ---------- */
test('finance: version 2 fixtures still hold', () => {
  const base = C.financial(C.defaultCalc);
  near(base.npv, -23658.953); near(base.breakEven, 27.32311);
  const good = C.financial({ ...C.defaultCalc, reduction: 25 });
  near(good.npv, -2011.5699881, 1e-6); assert.equal(good.firstRecovery, 5); assert.equal(good.firstPVRecovery, null);
  const y = C.financial({ ...C.defaultCalc, initial: 100, annual: 10, loss: 100, reduction: 20, years: 2, discount: 0, escalation: 10, replacementCost: 50, replacementYear: 2, salvage: 5 });
  assert.equal(y.rows[0].net, 10); near(y.rows[1].net, -34, 1e-8); near(y.npv, -124, 1e-8);
  assert.ok(C.financial({ ...C.defaultCalc, reduction: -10 }).npv < base.npv);
  assert.equal(C.financial({ ...C.defaultCalc, loss: 0 }).breakEven, null);
});
test('finance: withdrawal, zero initial cost, documented other savings and break-even at or below zero', () => {
  const w = C.financial({ ...C.defaultCalc, reduction: 25, withdrawYear: 2, removalCost: 3000 });
  near(w.npv, -12142.857); assert.deepEqual(w.rows.map(r => r.net), [3000, 0, 0, 0, 0]); assert.equal(w.withdrawn, true);
  const z = C.financial({ ...C.defaultCalc, initial: 0 });
  assert.equal(z.firstRecovery, null); assert.equal(z.noInitialCost, true); assert.equal(z.endsNegative, true);
  assert.throws(() => C.financial({ ...C.defaultCalc, other: 100 }), /basis/);
  const o = C.financial({ ...C.defaultCalc, initial: 1000, other: 5000, otherBasis: 'Signed quote Q-1' });
  assert.ok(o.breakEven <= 0);
  assert.throws(() => C.financial({ ...C.defaultCalc, removalCost: 10 }), /withdrawal year/);
  for (const patch of [{ years: 0 }, { years: 1.5 }, { years: 31 }, { discount: -1 }, { initial: NaN }, { initial: Infinity }, { replacementCost: 100, replacementYear: 0 }, { reduction: 101 }, { withdrawYear: 6 }, { annual: -1 }, { loss: 2e12 }])
    assert.throws(() => C.financial({ ...C.defaultCalc, ...patch }), JSON.stringify(patch));
});
test('finance: uncertainty ranges sort by swing and combine pessimistic and optimistic cases', () => {
  const r = C.scenarioRange({ ...C.defaultCalc, reduction: 10 }, { initial: [12000, 20000], reduction: [0, 25], loss: [10000, 30000] });
  near(r.base, -15000); assert.deepEqual(r.rows.map(x => x.key), ['reduction', 'loss', 'initial']);
  near(r.pessimistic, -28658.9533413, 1e-6); near(r.optimistic, 11812.1216885, 1e-6);
  assert.throws(() => C.scenarioRange(C.defaultCalc, { initial: [5, 1] }));
});

/* ---------- Evaluation planning ---------- */
test('evaluation planning matches known statistical values', () => {
  near(C.normInv(0.975), 1.959964, 1e-6); near(C.normInv(0.8), 0.841621, 1e-6); near(C.normInv(0.001), -3.090232, 1e-5);
  near(C.poissonUpper(0), 2.995732, 1e-5); near(C.poissonUpper(1), 4.743865, 1e-4); near(C.poissonUpper(2), 6.295794, 1e-4); near(C.poissonUpper(5), 10.513035, 1e-4);
  const e = C.evaluationPlan(C.defaultPlanning);
  near(e.controlEvents, 354.668, 0.01); near(e.exposureNeeded, 17733400, 500); near(e.expectedControl, 2); near(e.upperRate, 2.995732, 1e-5);
  for (const patch of [{ rateRatio: 1 }, { rateRatio: 0 }, { alpha: 0.6 }, { power: 0.4 }, { designEffect: 0.5 }, { baselineRate: 0 }, { observedEvents: 1.5 }, { observedEvents: 601 }])
    assert.throws(() => C.evaluationPlan({ ...C.defaultPlanning, ...patch }), JSON.stringify(patch));
});

/* ---------- Document helpers ---------- */
test('line diff and search snippets', () => {
  assert.deepEqual(C.lineDiff('a\nb\nc', 'a\nB\nc').map(p => p.type), ['same', 'del', 'add', 'same']);
  assert.ok(C.snippet('x '.repeat(200) + 'needle here', 'needle').includes('needle'));
  assert.equal(C.hash('abc'), C.hash('abc')); assert.notEqual(C.hash('abc'), C.hash('abd'));
});

/* ---------- Build and package hygiene ---------- */
test('generated files are up to date with the editable sources', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('standalone file is self-contained and its CSP hashes match its inline scripts', () => {
  const s = fs.readFileSync(path.join(root, 'standalone.html'), 'utf8');
  assert.ok(!/<script src=/.test(s) && !/href="style\.css"/.test(s));
  const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(scripts.length, 5, 'data, core, store, atmosphere and app');
  assert.ok(s.includes('data-build="standalone"') && !/rel="manifest"/.test(s) && !/href="icon\.svg"/.test(s), 'single file never registers an offline copy');
  const csp = s.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const js of scripts) { new vm.Script(js); assert.ok(csp.includes("'sha256-" + crypto.createHash('sha256').update(js, 'utf8').digest('base64') + "'")); }
  assert.ok(/connect-src 'none'/.test(csp));
});
test('every page has the network lock, the Zero Harm note and only local assets', () => {
  const pages = ['index.html', 'standalone.html', 'handbook.html', ...fs.readdirSync(path.join(root, 'role-packs')).map(f => 'role-packs/' + f), ...['en', 'fr', 'es'].map(l => 'briefs/brief-' + l + '.html')];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    assert.ok(/Content-Security-Policy/.test(html), p + ' CSP');
    assert.ok(/Zero Harm &amp; Anti-Coercion/.test(html) || /Zero Harm & Anti-Coercion/.test(html), p + ' Zero Harm note');
    assert.ok(!/<(script|link)[^>]+(src|href)="https?:/.test(html), p + ' no remote assets');
    for (const m of html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/(?:href|src)="([^"#]+)"/g)) if (!/^(https?:|data:|mailto:)/.test(m[1])) assert.ok(fs.existsSync(path.resolve(root, path.dirname(p), m[1])), p + ' → ' + m[1]);
  }
  const hb = fs.readFileSync(path.join(root, 'handbook.html'), 'utf8');
  const inline = hb.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(hb.includes("'sha256-" + crypto.createHash('sha256').update(inline, 'utf8').digest('base64') + "'"), 'handbook print-button hash');
});
test('no network APIs, telemetry, secrets or personal email addresses in the package', () => {
  for (const f of ['app.js', 'core.js', 'store.js', 'atmosphere.js']) assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.geolocation|RTCPeerConnection|import\s*\(|getUserMedia|localStorage\.setItem\(['"]child-safer-spaces-v3/.test(fs.readFileSync(path.join(root, f), 'utf8')), f);
  const text = ['app.js', 'core.js', 'store.js', 'atmosphere.js', 'sw.js', 'data.js', 'index.html', 'style.css', 'README.md', 'SOURCES.md'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  assert.ok(!/(api[_-]?key|secret[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/i.test(text));
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]).filter(e => !/^(mum@example\.org|a@b\.co)$/i.test(e));
  assert.deepEqual(emails, []);
});
test('SHA256SUMS.txt lists every file (except test run logs) with a matching checksum', () => {
  const lines = fs.readFileSync(path.join(root, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
  const listed = new Map(lines.map(l => { const i = l.indexOf('  '); return [l.slice(i + 2), l.slice(0, i)]; }));
  const walk = (d, b = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), b + e.name + '/') : [b + e.name]);
  const files = walk(root).filter(f => f !== 'SHA256SUMS.txt' && !f.startsWith('source/test-results/'));
  assert.deepEqual([...listed.keys()].sort(), files.sort(), 'listed files match the package');
  for (const f of files) assert.equal(listed.get(f), crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex'), f);
});

/* ---------- Version 4: routes, guides, starting point, glossary, translations ---------- */
test('every route has a navigation group, a seven-part guide and a render function; the journey points to real routes', () => {
  const rendered = new Set([...APP.matchAll(/^RENDER\.([a-z]+) = /gm)].map(m => m[1]));
  for (const r of D.routes) {
    assert.ok(D.journey.some(j => j.id === r.group), r.id + ' group');
    assert.ok(['essentials', 'full'].includes(r.mode), r.id + ' mode');
    assert.ok(rendered.has(r.id), r.id + ' has a render function in app.js');
  }
  assert.ok(rendered.has('notfound'), 'unknown addresses have a view');
  for (const id of [...D.routes.map(r => r.id), 'doc', 'notfound']) for (const f of ['what', 'why', 'how', 'life', 'outcome', 'technical', 'uncertain']) assert.ok(String((D.viewGuides[id] || {})[f] || '').trim().length > 3, id + ' guide ' + f);
  for (const j of D.journey) assert.ok(D.routes.some(r => r.id === j.route), j.id);
  assert.ok(D.routes.filter(r => r.mode === 'essentials').length <= 11, 'essentials stay short');
});
test('starting point: same answers give the same explained steps; time caps them; other countries start with adaptation', () => {
  const a = { who: 'official', where: 'other', goal: 'decide', time: 'hour' };
  const r1 = C.startingPoint(a, D), r2 = C.startingPoint({ ...a }, D);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1.steps.map(s => s.id), ['R12', 'R07', 'R03']);
  assert.ok(r1.steps.every(s => s.because.length > 0 && s.title && s.detail && ['now', 'review', 'signed'].includes(s.work)));
  assert.ok(r1.skip.length > 0);
  assert.equal(C.startingPoint({ who: 'curious', goal: 'understand', time: 'short' }, D).steps.length, 2);
  assert.equal(C.startingPoint({ who: 'business', goal: 'pilot', time: 'more' }, D).steps.length, 5);
  assert.deepEqual(C.startingPoint({}, D).steps.map(s => s.id), ['R25'], 'no answers: only the universal step');
  assert.deepEqual(C.startingPoint(null, D).steps.map(s => s.id), ['R25']);
  const ids = new Set(); for (const r of D.startRules) { assert.ok(!ids.has(r.id), 'unique ' + r.id); ids.add(r.id); }
  // Every rule can be reached by some combination of answers.
  const Q = Object.fromEntries(D.startQuestions.map(q => [q.id, q.options.map(o => o[0])]));
  for (const r of D.startRules) {
    const ans = { time: 'more' }; for (const [k, v] of Object.entries(r.when)) ans[k] = v[0];
    assert.ok(C.startingPoint(ans, D).steps.some(s => s.id === r.id) || C.startingPoint(ans, D).more > 0, r.id + ' reachable');
    for (const [k, v] of Object.entries(r.when)) for (const x of v) assert.ok(Q[k].includes(x), r.id + ' ' + k + '=' + x);
  }
});
test('glossary terms are unique and link somewhere real; sources carry a re-check date', () => {
  const terms = D.glossary.map(g => g.term.toLowerCase());
  assert.equal(new Set(terms).size, terms.length);
  for (const g of D.glossary) {
    assert.ok(g.plain.length > 10 && g.more.length > 10, g.term);
    assert.ok(/^\d\d$/.test(g.see) ? D.docs.some(d => d.id === g.see) : D.routes.some(r => r.id === g.see), g.term + ' → ' + g.see);
  }
  const due = C.sourceDue({ retrieved: '2026-10-20' }, '2026-10-20');
  assert.deepEqual(due, { due: '2027-10-20', overdue: false });
  assert.equal(C.sourceDue({ retrieved: '2026-10-20' }, '2027-10-21').overdue, true);
  assert.equal(C.sourceDue({ retrieved: '' }, '2026-10-20').overdue, true);
  for (const s of D.sources) assert.equal(C.sourceDue(s, D.issued).overdue, false, s.id);
});
test('translations are tagged with their language and labelled as unreviewed drafts; the brief cites its sources', () => {
  const byId = id => D.docs.find(d => d.id === id);
  assert.equal(byId('50').lang, undefined);
  assert.equal(byId('51').lang, 'fr'); assert.equal(byId('52').lang, 'es');
  assert.match(byId('51').body, /^## Avertissement sur la traduction\nTraduction provisoire/);
  assert.match(byId('52').body, /^## Aviso sobre la traducción\nTraducción provisional/);
  for (const id of ['50', '51', '52']) for (const s of ['S45', 'S46', 'S48', 'S49', 'S54', 'S8', 'S31']) assert.ok(byId(id).cites.includes(s), id + ' cites ' + s);
  for (const id of ['50', '51', '52']) assert.equal(byId(id).body.split('\n## ').length, byId('50').body.split('\n## ').length + (id === '50' ? 0 : 1), id + ' has the same sections as the English brief plus the translation notice');
  assert.ok(D.localDecisions.some(l => /translated versions/.test(l.item)));
  assert.ok(D.rolePacks.Government.includes('51') && D.rolePacks.Government.includes('52'));
});
test('whole-workspace personal-data check reports where, never the matched text', () => {
  const x = C.blankState();
  x.edits['12'] = 'Call 613-555-0123 for keys'; x.records.hazards = [D.schemas.hazards.map((h, i) => i === 3 ? 'possible concussion' : 'x')];
  x.tasks.T01 = { owner: 'mum@example.org', due: '', status: 'open', evidence: '' }; x.gates.G0 = { done: false, note: 'see CCTV footage' };
  const f = C.scanState(x, D);
  assert.deepEqual(f.map(y => y.where), ['Draft of document 12', 'Register hazards, row 1', 'Task T01', 'Gate G0 note']);
  assert.ok(!JSON.stringify(f).includes('613-555') && !JSON.stringify(f).includes('mum@'), 'no matched text in the report');
  assert.deepEqual(C.scanState(C.blankState(), D), []);
});
test('display settings: defaults, only known values kept, damaged values ignored', () => {
  assert.deepEqual(C.readSettings(null), C.SETTINGS_DEFAULTS);
  assert.deepEqual(C.readSettings('not json'), C.SETTINGS_DEFAULTS);
  const s = C.readSettings('{"theme":"dark","text":"125","motion":"reduce","atmosphere":"rocket","evil":"x","__proto__":{"p":1}}');
  assert.equal(s.theme, 'dark'); assert.equal(s.text, '125'); assert.equal(s.motion, 'reduce'); assert.equal(s.atmosphere, 'auto');
  assert.equal(s.evil, undefined); assert.equal({}.p, undefined);
  for (const [k, vals] of Object.entries(C.SETTINGS_ALLOWED)) assert.ok(vals.includes(C.SETTINGS_DEFAULTS[k]), k + ' default allowed');
});

/* ---------- Version 4: storage layer (localStorage and memory engines; the database engine is tested in Chromium) ---------- */
const fakeLS = (init = {}, opts = {}) => {
  const m = new Map(Object.entries(init));
  return { m, get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => { if (opts.blocked) throw Object.assign(new Error('denied'), { name: 'SecurityError' }); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (opts.full) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); m.set(k, String(v)); }, removeItem: k => m.delete(k) };
};
test('storage layer: falls back to localStorage, reads earlier versions without changing them, and refuses to overwrite another tab', async () => {
  const good = C.blankState(); good.site = 'S-LS';
  const ls = fakeLS({ [C.KEYS.v3]: JSON.stringify(good), [C.KEYS.v2]: '{"old":1}' });
  let conflicts = 0;
  const st = await S.createStore({ env: { localStorage: ls }, guard: [C.KEYS.v3], onConflict: () => conflicts++ });
  assert.equal(st.engine, 'localstorage');
  const r = C.loadState(st, D); assert.equal(r.origin, 'v3'); assert.equal(r.state.site, 'S-LS');
  r.state.site = 'S-LS-2'; assert.equal(C.persist(st, r.state).ok, true);
  assert.equal(JSON.parse(ls.m.get(C.KEYS.v3)).site, 'S-LS-2'); assert.equal(ls.m.get(C.KEYS.v2), '{"old":1}', 'older key untouched');
  // Another tab writes; this tab's next save must be refused, not overwrite.
  const other = C.blankState(); other.site = 'OTHER-TAB'; ls.m.set(C.KEYS.v3, JSON.stringify(other));
  r.state.site = 'S-LS-3';
  assert.deepEqual(C.persist(st, r.state), { ok: false, error: 'ConflictError' });
  assert.equal(conflicts, 1); assert.equal(JSON.parse(ls.m.get(C.KEYS.v3)).site, 'OTHER-TAB', 'other tab\'s work kept');
  assert.equal(C.persist(st, r.state).error, 'ConflictError', 'stays paused until reloaded');
  assert.ok(st.list().some(x => x.key === C.KEYS.v2 && x.where === 'browser storage'));
});
test('storage layer: quota errors are reported, and with no storage at all the workspace runs from memory', async () => {
  const st = await S.createStore({ env: { localStorage: fakeLS({}, { full: true }) }, guard: [C.KEYS.v3] });
  assert.equal(C.loadState(st, D).origin, 'new');
  assert.deepEqual(C.persist(st, C.blankState()), { ok: false, error: 'QuotaExceededError' });
  const none = await S.createStore({ env: { localStorage: fakeLS({}, { blocked: true }) } });
  assert.equal(none.engine, 'memory');
  assert.equal(C.loadState(none, D).origin, 'unavailable');
  const timeout = await S.createStore({ env: { indexedDB: { open() { return {}; } }, localStorage: fakeLS() } });
  assert.equal(timeout.engine, 'localstorage', 'a database that never answers falls back after a timeout');
  assert.match(timeout.reason, /did not respond/);
});

/* ---------- Version 4: offline files, security policy and contrast ---------- */
test('offline copy: the service worker caches only listed local files and answers only same-origin GET requests', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const files = JSON.parse(sw.match(/const FILES = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(files, ['./', 'index.html', 'style.css', 'data.js', 'core.js', 'store.js', 'atmosphere.js', 'app.js', 'icon.svg', 'app.webmanifest', 'handbook.html']);
  for (const f of files.slice(1)) assert.ok(fs.existsSync(path.join(root, f)), f);
  assert.match(sw, /const CACHE = 'child-safer-spaces-4\.0-[0-9a-f]{12}'/);
  assert.ok(/req\.method !== 'GET'/.test(sw) && /origin !== self\.location\.origin/.test(sw));
  assert.ok(!/https?:\/\//.test(sw.replace(/^\/\*[\s\S]*?\*\//, '')), 'no external addresses');
  const m = JSON.parse(fs.readFileSync(path.join(root, 'app.webmanifest'), 'utf8'));
  assert.equal(m.start_url, './index.html#/discover'); assert.equal(m.scope, './'); assert.ok(fs.existsSync(path.join(root, m.icons[0].src)));
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), csp = idx.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(/manifest-src 'self'/.test(csp) && /connect-src 'none'/.test(csp) && /default-src 'none'/.test(csp));
  assert.ok(!/rel="manifest"/.test(idx), 'the manifest is linked only when served from a secure web address');
  assert.ok(/isSecureContext/.test(APP) && /BUILD !== 'standalone'/.test(APP), 'service worker only for hosted, folder copies');
});
test('colour contrast of every text pair meets WCAG AA in light, dark and more-contrast themes', () => {
  const rows = require('./check-contrast.cjs').check();
  assert.ok(rows.length >= 100);
  const bad = rows.filter(r => !r.ok).map(r => r.theme + ': ' + r.fg + ' on ' + r.bg + ' = ' + r.ratio);
  assert.deepEqual(bad, []);
});
test('the background scene is optional, stoppable and bounded', () => {
  const A = fs.readFileSync(path.join(root, 'atmosphere.js'), 'utf8');
  assert.match(A, /MAX_RUN_MS = 90000/);
  for (const k of ['visibilitychange', 'IntersectionObserver', 'getBattery', 'cancelAnimationFrame', "tell('off'"]) assert.ok(A.includes(k), k);
  assert.ok(/aria-hidden="true"><\/canvas>/.test(APP) && /atmo-toggle/.test(APP), 'canvas hidden from assistive technology; pause control present');
  assert.ok(/reducedMotion\(\)/.test(APP) && /prefers-reduced-motion/.test(APP));
});
