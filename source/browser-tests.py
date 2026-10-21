"""Child-Safer Spaces · browser tests · version 4.0

Runs the real workspace in Chromium through Playwright and checks behaviour
that the Node tests cannot: rendering, navigation and deep links, search,
settings, drawers, the browser database and its fallbacks, recovery,
migration, cross-tab conflicts, imports, downloads, the offline copy for
hosted use, the background scene controls, keyboard focus, accessibility
scans, phone widths and printing.

Requirements (maintainers only; the workspace itself needs none of this):
    pip install playwright        # and a Chromium build available to Playwright
    axe-core (optional) for accessibility scans: npm install axe-core@4.10.2

Usage:
    python3 source/browser-tests.py [--axe path/to/axe.min.js] [--json results.json] [--only name,name]

The bundle is served from a temporary web server bound to 127.0.0.1 and is
also opened from file:// URLs. No external site is contacted; any request
that leaves the machine is reported as a failure.
"""
import argparse, functools, http.server, json, pathlib, socketserver, sys, threading, time, traceback
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIX = ROOT / 'source' / 'fixtures'
KEY3, KEY2, KEY1, UNDO = 'child-safer-spaces-v3', 'child-safer-spaces-v2', 'child-safer-spaces-v1', 'child-safer-spaces-v3-undo'
SETTINGS, MARKER = 'child-safer-spaces-settings', 'child-safer-spaces-v4-db'
ap = argparse.ArgumentParser(); ap.add_argument('--axe'); ap.add_argument('--json'); ap.add_argument('--only'); args = ap.parse_args()
AXE = pathlib.Path(args.axe).read_text() if args.axe else None

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{httpd.server_address[1]}/'
HTTP_INDEX, FILE_INDEX, FILE_STANDALONE = BASE + 'index.html', (ROOT / 'index.html').as_uri(), (ROOT / 'standalone.html').as_uri()
DATA = json.loads((ROOT / 'source' / 'content.json').read_text())
VIEWS = [r['id'] for r in DATA['routes']]
ESSENTIALS = [r['id'] for r in DATA['routes'] if r['mode'] == 'essentials']
RESULTS, OFFSITE = [], []
TESTS = []
class SkipTest(Exception): pass
def check(fn): TESTS.append(fn); return fn

def wait_js(pg, expr, arg=None, timeout=10000):
    """Poll a page expression until it is truthy. (Playwright's wait_for_function
    evaluates strings inside the page, which the workspace's CSP forbids.)"""
    t0 = time.time()
    while True:
        try: ok = pg.evaluate(expr, arg) if arg is not None else pg.evaluate(expr)
        except Exception: ok = False
        if ok: return ok
        if (time.time() - t0) * 1000 > timeout: raise AssertionError('timed out waiting for: ' + expr[:140])
        pg.wait_for_timeout(50)
READY = "document.querySelector('#nav a') && document.querySelector('#view h1') && document.querySelector('#storage').dataset.state !== 'pending'"
def page(b, url=HTTP_INDEX, init=None, **ctx_opts):
    """New isolated context + page; collects console errors and off-machine requests."""
    ctx = b.new_context(accept_downloads=True, **ctx_opts)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); pg.errors = []
    pg.on('console', lambda m: pg.errors.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.errors.append('pageerror: ' + str(e)))
    pg.on('request', lambda r: OFFSITE.append(r.url) if not r.url.startswith((BASE, 'file://', 'blob:', 'data:', 'about:')) else None)
    if url: pg.goto(url); ready(pg)
    return ctx, pg
def ready(pg): wait_js(pg, READY, timeout=15000)
def reload(pg): pg.reload(); ready(pg)
def nav(pg, v):
    """Go to a view by its address (deep link) and wait until it is the current view."""
    pg.evaluate("v => { location.hash = '#/' + v; }", v)
    first = v.split('/')[0]
    if first == 'doc': wait_js(pg, "id => document.querySelector('#docbody') && document.title.startsWith(id + ' ')", v.split('/')[1])
    else: wait_js(pg, "v => { const a = document.querySelector('#nav [aria-current=page]'); return a && a.dataset.view === v && document.querySelector('#view h1'); }", first)
    pg.wait_for_timeout(40)
def click_nav(pg, v): pg.click(f"#nav a[data-view='{v}']"); wait_js(pg, "v => (document.querySelector('#nav [aria-current=page]') || {}).dataset?.view === v", v); pg.wait_for_timeout(40)
IDB = """([op, k, v]) => new Promise((res, rej) => {
  const r = indexedDB.open('child-safer-spaces', 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
  r.onsuccess = () => { const db = r.result, tx = db.transaction('kv', op === 'get' || op === 'keys' ? 'readonly' : 'readwrite'), os = tx.objectStore('kv');
    const q = op === 'get' ? os.get(k) : op === 'keys' ? os.getAllKeys() : op === 'put' ? os.put(v, k) : op === 'clear' ? os.clear() : os.delete(k);
    tx.oncomplete = () => { res(q.result === undefined ? null : q.result); db.close(); }; tx.onerror = () => rej(tx.error); };
  r.onerror = () => rej(r.error); })"""
def idb(pg, op, k=None, v=None): return pg.evaluate(IDB, [op, k, v])
def ls(pg, k): return pg.evaluate('k => localStorage.getItem(k)', k)
def set_ls(pg, k, v): pg.evaluate('([k, v]) => localStorage.setItem(k, v)', [k, v])
def settle(pg): wait_js(pg, "!['pending'].includes(document.querySelector('#storage').dataset.state)", timeout=5000); pg.wait_for_timeout(60)
def state(pg):
    settle(pg)
    raw = idb(pg, 'get', KEY3)
    return json.loads(raw) if raw else None
def status(pg): pg.wait_for_timeout(80); return pg.text_content('#status')
def upload(pg, sel, name, data, mime): pg.set_input_files(sel, files=[{'name': name, 'mimeType': mime, 'buffer': data if isinstance(data, bytes) else data.encode()}]); pg.wait_for_timeout(150)
def download(pg, sel):
    with pg.expect_download() as d: pg.click(sel)
    return pathlib.Path(d.value.path()).read_text(encoding='utf-8-sig')
def assert_(cond, msg):
    if not cond: raise AssertionError(msg)
def set_task(pg, tid, status_, evidence):
    pg.select_option(f'#{tid}-status', status_); pg.fill(f'#{tid}-evidence', evidence); pg.dispatch_event(f'#{tid}-evidence', 'change')
def overflow(pg): return pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
def axe_scan(pg, label, found):
    # Injected through the DevTools protocol: the page's own CSP (which blocks inline scripts) stays active.
    if not pg.evaluate('!!window.axe'): pg.evaluate(AXE + '\n;true')
    vs = pg.evaluate("async () => (await axe.run(document, {resultTypes: ['violations']})).violations.map(v => v.id + ' (' + v.impact + ') ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | '))")
    found.extend(label + ': ' + v for v in vs)

# ---------------------------------------------------------------- opening, navigation, keyboard
@check
def loads_every_view_in_three_opening_modes(b):
    for url in (HTTP_INDEX, FILE_INDEX, FILE_STANDALONE):
        ctx, pg = page(b, url)
        assert_(pg.query_selector('#noscript-notice') is None, url + ': scripts did not run')
        for v in VIEWS:
            nav(pg, v)
            assert_(pg.text_content('#view h1').strip(), url + ' ' + v + ' has no h1')
            assert_(pg.title().endswith(' · Child-Safer Spaces 4.0'), v + ' title: ' + pg.title())
            assert_(pg.text_content('#context').strip().startswith('About this view'), v + ' has its guide')
        nav(pg, 'doc/07'); assert_('Authority consultation' in pg.text_content('#view h1'), 'document deep link')
        assert_(not pg.errors, url + ' console errors: ' + '; '.join(pg.errors))
        ctx.close()

@check
def keyboard_skip_link_navigation_focus_and_visible_focus_ring(b):
    ctx, pg = page(b)
    pg.keyboard.press('Tab')
    assert_(pg.evaluate('document.activeElement.className') == 'skip', 'first Tab reaches the skip link')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(50)
    assert_(pg.evaluate('document.activeElement.id') == 'main', 'skip link moves focus to main')
    pg.focus("#nav a[data-view='discover']")
    for _ in range(3): pg.keyboard.press('Tab')
    assert_(pg.evaluate('document.activeElement.dataset.view') == 'glossary', 'Tab moves through navigation')
    ring = pg.evaluate('getComputedStyle(document.activeElement).outlineColor')
    assert_(ring == 'rgb(255, 209, 102)', 'focus ring on dark sidebar is #ffd166, got ' + ring)
    pg.keyboard.press('Enter'); wait_js(pg, "document.activeElement && document.activeElement.tagName === 'H1'")
    assert_(pg.title().startswith('Glossary'), 'title updated')
    pg.keyboard.press('Tab')
    ring2 = pg.evaluate('getComputedStyle(document.activeElement).outlineColor')
    assert_(ring2 in ('rgb(154, 79, 0)', 'rgb(255, 209, 102)'), 'focus ring in main content, got ' + ring2)
    ctx.close()

@check
def deep_links_history_and_unknown_addresses(b):
    ctx, pg = page(b, BASE + 'index.html#/workflows/W03')
    assert_(pg.evaluate("document.getElementById('wf-W03').open"), 'workflow deep link opens its card')
    nav(pg, 'registers/consultation'); assert_(pg.input_value('#regselect') == 'consultation', 'register deep link')
    nav(pg, 'brief/es'); assert_(pg.get_attribute('#docbody', 'lang') == 'es', 'brief language deep link')
    pg.go_back(); wait_js(pg, "document.querySelector('#regselect')"); assert_(pg.input_value('#regselect') == 'consultation', 'back returns to the register')
    pg.go_forward(); wait_js(pg, "(document.querySelector('#docbody') || {}).lang === 'es'")
    pg.evaluate("location.hash = '#/<img src=x onerror=window.__bad=1>'"); wait_js(pg, "document.querySelector('#view h1').textContent.includes('not in the workspace')")
    assert_(pg.evaluate('window.__bad') is None and pg.query_selector('#view img') is None, 'unknown address shown as text')
    pg.click('#nfsearch'); assert_(pg.evaluate("document.getElementById('searchdlg').open"), 'search offered from the not-found page')
    pg.keyboard.press('Escape')
    pg.evaluate("location.hash = '#/doc/99'"); wait_js(pg, "document.querySelector('#view h1').textContent.includes('not in the workspace') && location.hash === '#/doc/99'")
    pg.evaluate("location.hash = '#/'"); wait_js(pg, "location.hash === '#/discover'"); assert_(pg.text_content('#view h1').startswith('Look again'), 'empty address goes to Discover for a new workspace')
    assert_(not pg.errors, '; '.join(pg.errors))
    ctx.close()

@check
def search_finds_views_documents_and_terms_and_is_keyboard_friendly(b):
    ctx, pg = page(b)
    pg.keyboard.press('Control+k'); wait_js(pg, "document.getElementById('searchdlg').open")
    assert_(pg.evaluate('document.activeElement.id') == 'searchq', 'focus in the search box')
    pg.fill('#searchq', 'spill'); pg.wait_for_timeout(60)
    assert_(pg.locator('#searchresults a').count() >= 3 and 'result' in pg.text_content('#searchcount'), 'results for spill')
    pg.fill('#searchq', 'pre-mortem'); pg.wait_for_timeout(60)
    types = pg.locator('#searchresults .rtype').all_text_contents()
    assert_('Glossary' in types and any(t.startswith('Document 53') for t in types), 'glossary term and adaptation kit found: ' + ', '.join(types[:6]))
    pg.keyboard.press('ArrowDown'); assert_(pg.evaluate("document.activeElement.classList.contains('result')"), 'arrow key moves into the results')
    pg.keyboard.press('Escape'); wait_js(pg, "!document.getElementById('searchdlg').open")
    pg.focus('#searchbtn'); pg.keyboard.press('/'); wait_js(pg, "document.getElementById('searchdlg').open")
    pg.fill('#searchq', 'evaluation planning'); pg.keyboard.press('Enter')
    wait_js(pg, "(document.querySelector('#nav [aria-current=page]') || {}).dataset?.view === 'evaluation'")
    assert_(not pg.evaluate("document.getElementById('searchdlg').open"), 'dialog closes after choosing')
    nav(pg, 'glossary/term-pilot'); assert_(pg.evaluate('document.activeElement.id') == 'term-pilot', 'glossary deep link focuses the term')
    ctx.close()

@check
def settings_apply_at_once_persist_and_reset(b):
    ctx, pg = page(b)
    pg.click('#settingsbtn'); wait_js(pg, "document.getElementById('settingsdlg').open")
    for name, val in [('theme', 'dark'), ('text', '125'), ('contrast', 'more'), ('motion', 'reduce'), ('surfaces', 'solid'), ('atmosphere', 'still')]:
        pg.check(f"input[name='set-{name}'][value='{val}']")
    h = pg.evaluate("(() => { const d = document.documentElement.dataset; return [d.theme, d.text, d.contrast, d.motion, d.surfaces].join(','); })()")
    assert_(h == 'dark,125,more,reduce,solid', 'applied immediately: ' + h)
    assert_(pg.evaluate("getComputedStyle(document.documentElement).fontSize") == '20px', 'text size 125%')
    assert_(pg.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(15, 31, 28)', 'dark theme colours')
    assert_('Saved in this browser' in pg.text_content('#settingsnote'), 'saved note')
    pg.keyboard.press('Escape'); reload(pg)
    assert_(pg.evaluate("document.documentElement.dataset.theme") == 'dark' and json.loads(ls(pg, SETTINGS))['text'] == '125', 'settings kept after reload')
    pg.click('#settingsbtn'); pg.click('#settingsreset')
    assert_(ls(pg, SETTINGS) is None and pg.evaluate("document.documentElement.dataset.theme") == 'system', 'reset removes the stored preference')
    assert_(ls(pg, KEY3) is None, 'settings never hold planning data')
    ctx.close()

@check
def essentials_and_full_workspace_navigation(b):
    ctx, pg = page(b)
    assert_(pg.locator('#nav a').count() == len(ESSENTIALS), 'new workspaces start with the essentials')
    nav(pg, 'gates')
    assert_(pg.locator("#nav a[data-view='gates']").count() == 1 and '(full workspace)' in pg.text_content("#nav a[data-view='gates']"), 'a full-only view joins the navigation while open')
    pg.click('#modebtn'); assert_(pg.locator('#nav a').count() == len(VIEWS), 'full workspace shows every view')
    assert_(pg.get_attribute('#modebtn', 'aria-pressed') == 'true', 'toggle state exposed')
    reload(pg); assert_(pg.locator('#nav a').count() == len(VIEWS), 'choice kept')
    ctx.close()
    ctx, pg = page(b)   # a returning workspace with work defaults to full
    nav(pg, 'plan'); pg.fill('#site', 'S-RETURN'); settle(pg); pg.goto(HTTP_INDEX); ready(pg)
    assert_(pg.locator('#nav a').count() == len(VIEWS) and 'start' in pg.evaluate('location.hash'), 'returning work opens the full workspace at Start here')
    ctx.close()

@check
def phone_menu_and_explanation_drawers_trap_focus_and_close_with_escape(b):
    ctx, pg = page(b, viewport={'width': 390, 'height': 844})
    assert_(not pg.is_visible('#nav'), 'navigation is in a drawer on phones')
    pg.click('#menubtn'); assert_(pg.is_visible("#nav a[data-view='plan']"), 'menu opens the drawer')
    assert_(pg.get_attribute('#menubtn', 'aria-expanded') == 'true', 'menu state exposed')
    assert_(pg.evaluate("document.querySelector('.page').inert"), 'page behind the drawer is inert')
    assert_(pg.evaluate("document.getElementById('sidebar').contains(document.activeElement)"), 'focus moved into the drawer')
    pg.keyboard.press('Escape'); assert_(not pg.is_visible('#nav') and pg.evaluate('document.activeElement.id') == 'menubtn', 'Escape closes and returns focus')
    pg.click('#menubtn'); pg.click("#nav a[data-view='plan']"); wait_js(pg, "(document.querySelector('#nav [aria-current=page]') || {}).dataset?.view === 'plan'")
    assert_(not pg.is_visible('#sidebar') and not pg.evaluate("document.querySelector('.page').inert"), 'choosing a view closes the drawer')
    pg.click('#menubtn'); pg.click('#ctxbtn2'); assert_(pg.is_visible('#context') and 'owners' in pg.text_content('#context'), 'explanation panel for the plan opens as a drawer')
    pg.keyboard.press('Escape'); assert_(not pg.is_visible('#context') and pg.evaluate('document.activeElement.id') == 'menubtn', 'Escape closes the panel')
    ctx.close()
    ctx, pg = page(b, viewport={'width': 1440, 'height': 900})
    assert_(pg.is_visible('#context'), 'panel open beside wide layouts')
    pg.click('#ctxclose'); assert_(not pg.is_visible('#context') and json.loads(ls(pg, SETTINGS))['context'] == 'closed', 'closing is remembered')
    pg.click('#ctxbtn'); assert_(pg.is_visible('#context'), 'reopens')
    ctx.close()

# ---------------------------------------------------------------- starting point, brief, glossary, Discover
@check
def starting_point_gives_explained_steps_and_links_that_work(b):
    ctx, pg = page(b); nav(pg, 'start')
    pg.click("label:has(input[name='sp-who'][value='official'])"); pg.click("label:has(input[name='sp-where'][value='other'])")
    pg.click("label:has(input[name='sp-goal'][value='decide'])"); pg.click("label:has(input[name='sp-time'][value='hour'])")
    pg.click('#spgo'); wait_js(pg, "document.activeElement && document.activeElement.id === 'sp-title'")
    items = pg.locator('.nextsteps li')
    assert_(items.count() == 3, 'three steps for an hour')
    assert_('adaptation kit' in items.nth(0).text_content() and 'Another country' in items.nth(0).text_content(), 'other countries start with the adaptation kit, with the reason')
    assert_('skip for now' in pg.text_content('#spresult'), 'says what can wait')
    pg.click('.nextsteps li:first-child a'); wait_js(pg, "(document.querySelector('#nav [aria-current=page]') || {}).dataset?.view === 'adapt'")
    nav(pg, 'start'); assert_(pg.locator('.nextsteps li').count() == 3, 'answers kept while the page stays open')
    pg.click('#spreset'); assert_(pg.text_content('#spresult') == '', 'start again clears')
    reload(pg); assert_(ls(pg, KEY3) is None and pg.evaluate("JSON.parse(localStorage.getItem('child-safer-spaces-settings') || '{}').who") is None, 'answers are never stored')
    ctx.close()

@check
def brief_translations_are_tagged_and_printable(b):
    ctx, pg = page(b, init='window.print = () => { window.__printed = (window.__printed || 0) + 1; };'); nav(pg, 'brief/fr')
    assert_(pg.get_attribute('#view h1', 'lang') == 'fr' and pg.get_attribute('#docbody', 'lang') == 'fr', 'French brief tagged fr')
    assert_('Draft translation' in pg.text_content('#view') and 'traduction provisoire' in pg.text_content('#view h1'), 'labelled as draft')
    assert_(pg.get_attribute(".langswitch a[aria-current='page']", 'lang') == 'fr', 'current language marked')
    pg.click('#briefprint'); assert_(pg.evaluate('window.__printed') == 1 and 'Note de deux pages' in pg.text_content('#printarea'), 'print the French brief')
    pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
    html = download(pg, '#briefdl'); assert_('lang="fr"' in html and 'Zero Harm' in html, 'download keeps the language tag and the Zero Harm note')
    nav(pg, 'brief'); assert_('[S45]' in pg.text_content('#docbody') and pg.locator('#docbody a[href^="https://www.who.int"]').count() >= 1, 'English brief links its WHO source')
    ctx.close()

@check
def discover_background_scene_can_be_paused_and_respects_reduced_motion(b):
    ctx, pg = page(b)
    wait_js(pg, "!document.getElementById('atmo-toggle').hidden")
    assert_(pg.text_content('#atmo-toggle') == 'Pause the moving background', 'pause control offered while moving')
    pg.click('#atmo-toggle'); assert_(pg.text_content('#atmo-toggle') == 'Play the moving background' and pg.get_attribute('#atmo-toggle', 'aria-pressed') == 'true', 'paused')
    pg.click('#atmo-toggle'); assert_(pg.text_content('#atmo-toggle') == 'Pause the moving background', 'playing again')
    pg.evaluate("Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); document.dispatchEvent(new Event('visibilitychange'))")
    assert_('not visible' in pg.text_content('#atmo-state'), 'stops while the page is hidden')
    assert_(pg.get_attribute('#atmo', 'aria-hidden') == 'true', 'canvas hidden from assistive technology')
    nav(pg, 'plan'); nav(pg, 'discover'); assert_(not pg.errors, '; '.join(pg.errors))
    ctx.close()
    ctx, pg = page(b, reduced_motion='reduce')
    wait_js(pg, "document.getElementById('atmo-state').textContent.includes('reduced motion')")
    assert_(pg.is_hidden('#atmo-toggle') and pg.evaluate("document.documentElement.dataset.motion") == 'reduce', 'still image with reduced motion')
    ctx.close()
    ctx, pg = page(b, init="localStorage.setItem('child-safer-spaces-settings', JSON.stringify({atmosphere: 'off'}))")
    assert_(pg.is_hidden('#atmo') and 'switched off' in pg.text_content('#atmo-state'), 'switched off in settings; CSS background remains')
    ctx.close()

# ---------------------------------------------------------------- storage: database, fallbacks, recovery, conflicts
@check
def drafts_and_fields_persist_across_reload_in_the_browser_database(b):
    ctx, pg = page(b)
    nav(pg, 'plan'); pg.fill('#site', 'S-100'); settle(pg)
    assert_(state(pg)['site'] == 'S-100' and ls(pg, KEY3) is None, 'saved in the database, not in localStorage')
    reload(pg); nav(pg, 'plan')
    assert_(pg.input_value('#site') == 'S-100', 'site code persisted')
    assert_('Saved' in pg.text_content('#storage') and pg.text_content('#engine') == 'Browser database', 'indicator and engine')
    nav(pg, 'library'); pg.click("[data-open-doc='12']"); pg.click('#editpanel summary')
    pg.fill('#editor', 'Local SOP text.'); settle(pg); reload(pg)
    nav(pg, 'library'); assert_('local draft' in pg.text_content("[data-open-doc='12']"), 'draft persisted and labelled')
    ctx.close()
    ctx, pg = page(b, FILE_INDEX)   # the same when opened straight from a folder
    nav(pg, 'plan'); pg.fill('#site', 'S-FILE'); settle(pg); reload(pg); nav(pg, 'plan')
    assert_(pg.input_value('#site') == 'S-FILE', 'site code persisted for a file:// page')
    ctx.close()

@check
def version3_browser_data_is_copied_into_the_database_and_left_unchanged(b):
    ctx, pg = page(b)
    raw = json.dumps({**json.loads(pg.evaluate("JSON.stringify(CSSCore.blankState())")), 'site': 'S-FROM-V3'})
    idb(pg, 'delete', KEY3); pg.evaluate("k => localStorage.removeItem(k)", MARKER); set_ls(pg, KEY3, raw); reload(pg)
    assert_('copied into this browser' in pg.text_content('#banner'), 'banner explains the move')
    assert_(state(pg)['site'] == 'S-FROM-V3' and ls(pg, KEY3) == raw, 'copied; version 3 copy untouched')
    nav(pg, 'data'); assert_('Version 3 copy (left unchanged)' in pg.text_content('#view'), 'listed under Your data')
    # Database emptied later while the old copy remains: warn instead of silently loading old work.
    idb(pg, 'delete', KEY3); reload(pg)
    assert_('may be out of date' in pg.text_content('#banner'), 'older copy flagged')
    ctx.close()

@check
def database_unavailable_falls_back_to_browser_storage(b):
    ctx, pg = page(b, init="Object.defineProperty(window, 'indexedDB', {configurable: true, get() { return undefined; }});")
    assert_('simpler browser storage' in pg.text_content('#banner') and pg.text_content('#engine') == 'Fallback storage', 'fallback explained')
    nav(pg, 'plan'); pg.fill('#site', 'S-LS'); settle(pg)
    assert_(json.loads(ls(pg, KEY3))['site'] == 'S-LS', 'saved in localStorage')
    reload(pg); nav(pg, 'plan'); assert_(pg.input_value('#site') == 'S-LS', 'persists across reload')
    assert_(not pg.errors, '; '.join(pg.errors))
    ctx.close()

@check
def blocked_storage_still_works_and_exports(b):
    ctx, pg = page(b, init="Object.defineProperty(window, 'indexedDB', {configurable: true, get() { return undefined; }}); Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError')}});")
    assert_('unavailable' in pg.text_content('#banner').lower(), 'banner explains storage is unavailable')
    assert_('unavailable' in pg.text_content('#storage').lower() and pg.text_content('#engine') == 'Not stored', 'indicator shows unavailable')
    nav(pg, 'plan'); pg.fill('#site', 'S-MEMORY'); pg.wait_for_timeout(600)
    data = json.loads(download(pg, '#export'))
    assert_(data['state']['site'] == 'S-MEMORY' and data['version'] == 3, 'export works from memory')
    pg.click('#settingsbtn'); pg.check("input[name='set-theme'][value='dark']")
    assert_('does not allow saving settings' in pg.text_content('#settingsnote'), 'settings still apply, and say they are not saved')
    assert_(not pg.errors, 'no console errors: ' + '; '.join(pg.errors))
    ctx.close()

@check
def full_storage_warns_and_guards_page_close(b):
    ctx, pg = page(b)
    pg.evaluate("IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); }; true")
    nav(pg, 'plan'); pg.fill('#site', 'S-FULL'); wait_js(pg, "document.querySelector('#storage').dataset.state === 'failed'")
    assert_('not saved' in pg.text_content('#storage').lower(), 'indicator shows not saved')
    assert_('not saved in this browser' in pg.text_content('#banner') and 'QuotaExceededError' in pg.text_content('#banner'), 'banner explains and offers export')
    prevented = pg.evaluate("(() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; })()")
    assert_(prevented, 'closing the page with unsaved work asks first')
    ctx.close()

@check
def unreadable_saved_data_is_quarantined_not_overwritten(b):
    ctx, pg = page(b)
    raw = '{"schema":3,"site":"PRECIOUS","edits":{"01":"months of careful edits"},"records":{"hazards":[["broken"]]}}'
    idb(pg, 'put', KEY3, raw); reload(pg)
    assert_('could not be read' in pg.text_content('#banner'), 'quarantine banner shown')
    pg.wait_for_timeout(200); keys = [k for k in idb(pg, 'keys') if k.startswith('child-safer-spaces-v3-unreadable-')]
    assert_(len(keys) == 1 and idb(pg, 'get', keys[0]) == raw, 'untouched recovery copy kept')
    nav(pg, 'plan'); pg.fill('#site', 'typing must not overwrite'); pg.wait_for_timeout(700)
    assert_(idb(pg, 'get', KEY3) == raw, 'original data not overwritten while saving is paused')
    with pg.expect_download() as d: pg.click("#banner button:has-text('Download unreadable data')")
    assert_(pathlib.Path(d.value.path()).read_text() == raw, 'unreadable data can be downloaded intact')
    pg.click("#banner button:has-text('Start a new workspace')"); settle(pg)
    assert_(json.loads(idb(pg, 'get', KEY3))['schema'] == 3 and idb(pg, 'get', keys[0]) == raw, 'new workspace saved; recovery copy kept')
    ctx.close()

@check
def another_tab_is_never_overwritten(b):
    ctx = b.new_context(); p1 = ctx.new_page(); p1.goto(HTTP_INDEX); ready(p1)
    p2 = ctx.new_page(); p2.goto(HTTP_INDEX); ready(p2)
    nav(p1, 'plan'); p1.fill('#site', 'TAB-ONE'); settle(p1)
    nav(p2, 'plan'); p2.fill('#site', 'TAB-TWO'); wait_js(p2, "document.querySelector('#storage').dataset.state === 'blocked'")
    assert_('changed in another tab' in p2.text_content('#banner'), 'second tab is told')
    assert_(json.loads(idb(p2, 'get', KEY3))['site'] == 'TAB-ONE', 'first tab\'s work kept')
    with p2.expect_download() as d: p2.click("#banner button:has-text('Download this tab')")
    assert_(json.loads(pathlib.Path(d.value.path()).read_text())['state']['site'] == 'TAB-TWO', 'second tab can keep its copy')
    p2.click("#banner button:has-text('Load the latest saved version')"); ready(p2); nav(p2, 'plan')
    assert_(p2.input_value('#site') == 'TAB-ONE', 'reloaded with the saved version')
    ctx.close()

@check
def version2_browser_data_migrates_without_modification_and_drafts_are_flagged(b):
    ctx, pg = page(b)
    raw = (FIX / 'v2-state.json').read_text()
    idb(pg, 'delete', KEY3); set_ls(pg, KEY2, raw); reload(pg)
    banner = pg.text_content('#banner')
    assert_('copied into this workspace' in banner and 'G1' in banner, 'migration report shown')
    assert_(ls(pg, KEY2) == raw, 'version 2 data left byte-for-byte unchanged')
    s = state(pg)
    assert_(s['site'] == 'EX-FIXTURE-02' and s['gates']['G0']['done'] and not s['gates']['G1']['done'], 'gates re-checked')
    assert_('05' not in s['edits'] and '12' in s['edits'], 'unedited draft dropped, real draft kept')
    nav(pg, 'library')
    assert_('original updated' in pg.text_content("[data-open-doc='12']"), 'draft flagged for review')
    pg.click("[data-open-doc='12']"); pg.click('#cmp'); pg.wait_for_timeout(80)
    assert_('Night crew' in pg.text_content('#diffbox'), 'line comparison shows the local addition')
    pg.click('#keep'); pg.wait_for_timeout(100)
    assert_(pg.query_selector('#reviewbox') is None, 'draft marked reviewed')
    nav(pg, 'gates'); assert_('Recorded complete' in pg.text_content('#gate-G0') and 'T35' in pg.text_content('#gate-G1'), 'G1 needs the new task T35')
    ctx.close()

@check
def version1_browser_data_migrates(b):
    ctx, pg = page(b)
    raw = (FIX / 'v1-state.json').read_text()
    idb(pg, 'delete', KEY3); set_ls(pg, KEY1, raw); reload(pg)
    s = state(pg)
    assert_(s['site'] == 'EX-FIXTURE-01' and s['gates']['G0']['note'] == 'v1 sponsor note' and not s['gates']['G0']['done'], 'v1 notes kept, gates reopened')
    assert_(any('G9' in e['detail'] for e in s['log']), 'retired gate note kept in the log')
    assert_(ls(pg, KEY1) == raw, 'version 1 data unchanged')
    ctx.close()

# ---------------------------------------------------------------- backups, CSV, personal data, injection
@check
def backup_import_validates_previews_applies_and_undoes(b):
    ctx, pg = page(b)
    nav(pg, 'plan'); pg.fill('#site', 'S-BEFORE'); settle(pg)
    upload(pg, '#import', 'bad.json', '{not json', 'application/json')
    assert_('not valid JSON' in status(pg), 'malformed JSON rejected')
    upload(pg, '#import', 'other.json', json.dumps({'format': 'something-else', 'version': 3, 'state': {}}), 'application/json')
    assert_('not a Child-Safer Spaces planning backup' in status(pg), 'foreign file rejected')
    upload(pg, '#import', 'future.json', json.dumps({'format': 'child-safer-spaces', 'version': 9, 'state': {}}), 'application/json')
    assert_('Unsupported backup version' in status(pg), 'future version rejected')
    upload(pg, '#import', 'huge.json', b' ' * 15000001, 'application/json')
    assert_('larger than 15 MB' in status(pg), 'oversized file rejected')
    assert_(state(pg)['site'] == 'S-BEFORE', 'current work unchanged after rejections')
    upload(pg, '#import', 'v2-backup.json', (FIX / 'v2-backup.json').read_bytes(), 'application/json')
    panel = pg.text_content('#importpanel')
    assert_('Migrated from v2' in panel and 'EX-FIXTURE-02' in panel and 'G1' in panel, 'preview shows migration report')
    pg.click('#applyimport'); pg.wait_for_timeout(150)
    assert_(state(pg)['site'] == 'EX-FIXTURE-02', 'import applied')
    pg.click('#undo'); pg.wait_for_timeout(150)
    assert_(state(pg)['site'] == 'S-BEFORE', 'undo restores the previous state')
    ctx.close()

@check
def backup_export_reimport_round_trip(b):
    ctx, pg = page(b)
    nav(pg, 'plan'); pg.fill('#site', 'S-ROUND'); settle(pg)
    text = download(pg, '#export'); data = json.loads(text)
    assert_(data['format'] == 'child-safer-spaces' and data['version'] == 3 and data['app'] == '4.0', 'export envelope keeps format version 3')
    pg.fill('#site', 'S-CHANGED'); settle(pg)
    upload(pg, '#import', 'roundtrip.json', text, 'application/json'); pg.click('#applyimport'); pg.wait_for_timeout(150)
    assert_(state(pg)['site'] == 'S-ROUND', 'reimport restores exported state')
    ctx.close()

@check
def export_check_warns_before_personal_details_leave(b):
    ctx, pg = page(b)
    nav(pg, 'library'); pg.click("[data-open-doc='12']"); pg.click('#editpanel summary'); pg.fill('#editor', 'Keys with the night lead, 613-555-0123'); settle(pg)
    pg.click('#export'); wait_js(pg, "document.activeElement && document.activeElement.id === 'expcheck'")
    assert_('Draft of document 12' in pg.text_content('#importpanel') and '613-555' not in pg.text_content('#importpanel'), 'says where, not what')
    pg.click('#expcancel'); assert_(pg.is_hidden('#importpanel') and 'Nothing was downloaded' in status(pg), 'cancel downloads nothing')
    pg.click('#export'); data = json.loads(download(pg, '#expanyway'))
    assert_(data['state']['edits']['12'].startswith('Keys with'), 'export anyway works')
    nav(pg, 'data'); pg.click('#runcheck'); assert_('Draft of document 12' in pg.text_content('#checkresult'), 'check available under Your data')
    ctx.close()

@check
def csv_import_export_formula_safety_semicolons_and_undo(b):
    ctx, pg = page(b); nav(pg, 'registers')
    heads = pg.evaluate("window.CSS_DATA.schemas.hazards")
    upload(pg, '#importreg', 'wrong.csv', 'a,b\n1,2\n', 'text/csv')
    assert_('Column names must exactly match' in status(pg), 'wrong headers rejected')
    row = ['H-1', 'S-1', 'Entrance', '2026-11-03', 'Mat lifts', 'All', '3', '3', 'est', 'Removed', 'Facilities lead', '2026-11-04', 'open', 'LOG-1']
    upload(pg, '#importreg', 'semi.csv', ';'.join(heads) + '\r\n' + ';'.join(row) + '\r\n', 'text/csv')
    assert_('semicolon' in pg.text_content('#csvpreview'), 'semicolon file recognised')
    pg.click('#applycsv'); pg.wait_for_timeout(120)
    assert_(len(state(pg)['records']['hazards']) == 1, 'CSV applied')
    pg.click('#undo'); pg.wait_for_timeout(120)
    assert_(len(state(pg)['records'].get('hazards', [])) == 0, 'undo removes the import')
    pg.click('#addrow'); pg.fill('#cell-0', 'H-2'); pg.fill('#cell-4', '=HYPERLINK("http://example.invalid","x")'); pg.click('#saverow'); pg.wait_for_timeout(120)
    csv = download(pg, '#exportreg')
    assert_('"\'=HYPERLINK(""http://example.invalid"",""x"")"' in csv, 'formula neutralized in export')
    upload(pg, '#importreg', 'again.csv', csv, 'text/csv')
    assert_('apostrophe' in pg.text_content('#csvpreview'), 'neutralizing apostrophe recognised')
    pg.click('#applycsv'); pg.wait_for_timeout(120)
    assert_(state(pg)['records']['hazards'][0][4] == '=HYPERLINK("http://example.invalid","x")', 'round trip is lossless')
    ctx.close()

@check
def personal_data_check_asks_before_saving(b):
    ctx, pg = page(b); nav(pg, 'registers')
    pg.click('#addrow'); pg.fill('#cell-0', 'H-9'); pg.fill('#cell-4', 'Child aged 3 fell; mother on 613-555-0123'); pg.click('#saverow'); pg.wait_for_timeout(80)
    text = pg.text_content('#rowconfirm')
    assert_('phone number' in text and "person's age" in text, 'findings listed')
    pg.click('#sens-edit'); pg.wait_for_timeout(50)
    assert_(len(state(pg)['records'].get('hazards', [])) == 0, 'nothing saved when choosing to edit')
    pg.fill('#cell-4', 'Mat lifts at entrance'); pg.click('#saverow'); pg.wait_for_timeout(80)
    assert_(len(state(pg)['records']['hazards']) == 1, 'clean row saves without a prompt')
    ctx.close()

@check
def html_and_script_injection_is_rendered_as_text(b):
    ctx, pg = page(b); nav(pg, 'library'); pg.click("[data-open-doc='01']"); pg.click('#editpanel summary')
    pg.fill('#editor', '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>\n## Safe heading')
    pg.click('#saveedit'); pg.wait_for_timeout(100)
    assert_(pg.query_selector('#docbody img') is None and pg.query_selector('#docbody script') is None, 'no elements injected')
    assert_(pg.evaluate('window.__pwned') is None, 'no script executed')
    assert_('<img src=x' in pg.text_content('#docbody'), 'payload shown as text')
    nav(pg, 'registers'); pg.click('#addrow'); pg.fill('#cell-0', '<img src=x onerror="window.__pwned=3">'); pg.click('#saverow'); pg.wait_for_timeout(100)
    assert_(pg.query_selector('#regtable img') is None and pg.evaluate('window.__pwned') is None, 'register cells escaped')
    pg.click('#searchbtn'); pg.fill('#searchq', 'img src'); pg.wait_for_timeout(80)
    assert_(pg.query_selector('#searchresults img') is None and pg.evaluate('window.__pwned') is None, 'search snippets escaped')
    ctx.close()

# ---------------------------------------------------------------- gates, finance, evaluation, printing
@check
def gates_reopen_only_for_disposition_changes_and_amendments_are_undoable(b):
    ctx, pg = page(b); nav(pg, 'plan')
    pg.select_option('#f-gate', 'G0'); pg.wait_for_timeout(50)
    for d in pg.query_selector_all('details.taskcard'): d.evaluate('e => e.open = true')
    for t in ['T01', 'T02', 'T03', 'T04', 'T05']: set_task(pg, t, 'done', 'REF-' + t)
    nav(pg, 'gates')
    assert_('Ready to record' in pg.text_content('#gate-G0'), 'G0 ready')
    pg.fill('#note-G0', '2026-10-20 Sponsor; CHARTER-1'); pg.click("[data-complete='G0']"); pg.wait_for_timeout(100)
    assert_(state(pg)['gates']['G0']['done'], 'G0 recorded')
    nav(pg, 'plan'); pg.select_option('#f-gate', 'G0')
    for d in pg.query_selector_all('details.taskcard'): d.evaluate('e => e.open = true')
    pg.fill('#T01-owner', 'Sponsor (deputy: operations)'); pg.dispatch_event('#T01-owner', 'change'); pg.wait_for_timeout(60)
    assert_(state(pg)['gates']['G0']['done'], 'owner change does not reopen')
    pg.fill('#T01-evidence', 'REF-T01-v2'); pg.dispatch_event('#T01-evidence', 'change')
    assert_('Reopened G0' in status(pg) and not state(pg)['gates']['G0']['done'], 'evidence change reopens with explanation')
    nav(pg, 'gates'); pg.click("[data-complete='G0']"); pg.wait_for_timeout(80)
    pg.click("[data-amend='G0']"); pg.fill('#amend-G0', '2026-10-21 Sponsor; CHARTER-2'); pg.click('#gc-yes'); pg.wait_for_timeout(80)
    s = state(pg); assert_(not s['gates']['G0']['done'] and s['gates']['G0']['note'].endswith('CHARTER-2'), 'amendment reopens')
    pg.click('#undo'); pg.wait_for_timeout(100)
    assert_(state(pg)['gates']['G0']['done'], 'undo restores the recorded gate')
    ctx.close()

@check
def cost_scenarios_match_fixtures_and_reject_bad_input(b):
    ctx, pg = page(b); nav(pg, 'calculator')
    assert_('-23,658.95' in pg.text_content('#calcresult'), 'default NPV')
    pg.fill('#c-reduction', '25'); pg.click('#calculate'); pg.wait_for_timeout(60)
    assert_('-2,011.57' in pg.text_content('#calcresult'), '25% NPV')
    pg.fill('#c-other', '100'); pg.click('#calculate'); pg.wait_for_timeout(60)
    assert_('basis' in pg.text_content('#calcresult'), 'other savings need a basis')
    pg.fill('#c-other', '0'); pg.fill('#c-withdrawYear', '2'); pg.fill('#c-removalCost', '3000'); pg.click('#calculate'); pg.wait_for_timeout(60)
    assert_('-12,142.86' in pg.text_content('#calcresult'), 'withdrawal NPV')
    pg.fill('#c-withdrawYear', '0'); pg.fill('#c-removalCost', '0'); pg.fill('#c-reduction', '10')
    for k, lo, hi in [('initial', '12000', '20000'), ('reduction', '0', '25'), ('loss', '10000', '30000')]: pg.fill('#rl-' + k, lo); pg.fill('#rh-' + k, hi)
    pg.click('#calculate'); pg.wait_for_timeout(60)
    t = pg.text_content('#calcresult')
    assert_('-28,658.95' in t and '11,812.12' in t, 'range combinations')
    rows = download(pg, '#exportcash').strip().split('\n')
    assert_(len(rows) == 6, 'cash-flow CSV has a header and five years')
    pg.fill('#c-years', '0'); pg.click('#calculate'); pg.wait_for_timeout(60)
    assert_('Horizon must be' in pg.text_content('#calcresult'), 'invalid horizon rejected')
    assert_(state(pg)['calc']['years'] == 5, 'invalid input not saved')
    ctx.close()

@check
def evaluation_planning_shows_exposure_needed_and_upper_bound(b):
    ctx, pg = page(b); nav(pg, 'evaluation')
    t = pg.text_content('#presult')
    assert_('17,733,380' in t and '177' in t and '3 per 100,000' in t, 'default planning values: ' + t[:200])
    pg.fill('#p-rateRatio', '1.2'); pg.click('#pcalc'); pg.wait_for_timeout(60)
    assert_('between 0 and 1' in pg.text_content('#presult'), 'invalid ratio rejected')
    ctx.close()

@check
def print_current_document_and_static_handbook(b):
    ctx, pg = page(b, init='window.print = () => { window.__printed = (window.__printed || 0) + 1; };')
    nav(pg, 'library'); pg.click("[data-open-doc='14']"); pg.click('#docprint'); pg.wait_for_timeout(60)
    assert_(pg.evaluate('window.__printed') == 1 and 'printingpack' in pg.evaluate('document.body.className'), 'print prepared')
    assert_('Incident, stop, removal and restart protocol' in pg.text_content('#printarea'), 'print area holds the document')
    pg.emulate_media(media='print')
    assert_(pg.evaluate("getComputedStyle(document.querySelector('#sidebar')).display") == 'none' and pg.evaluate("getComputedStyle(document.querySelector('#printarea')).display") == 'block', 'print layout')
    assert_(pg.evaluate("getComputedStyle(document.querySelector('#statusbar')).display") == 'none' and pg.evaluate("getComputedStyle(document.querySelector('#context')).display") == 'none', 'shell hidden in print')
    pg.evaluate("window.dispatchEvent(new Event('afterprint'))"); pg.wait_for_timeout(50)
    assert_('printingpack' not in pg.evaluate('document.body.className') and pg.text_content('#printarea') == '', 'cleaned up after printing')
    ctx.close()
    c2 = b.new_context(); c2.add_init_script('window.print = () => { window.__printed = 1; };'); p2 = c2.new_page(); errs = []
    p2.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); p2.goto(BASE + 'handbook.html')
    p2.click('#printbtn'); assert_(p2.evaluate('window.__printed') == 1, 'handbook print button works under its CSP')
    assert_(p2.locator('section.handbook-section').count() >= 58, 'handbook has every document and appendix')
    assert_(p2.get_attribute('#doc-51', 'lang') == 'fr' and p2.get_attribute('#doc-52', 'lang') == 'es', 'translations tagged in the handbook')
    p2.emulate_media(media='print'); assert_(p2.evaluate("getComputedStyle(document.querySelector('.toolbar')).display") == 'none', 'toolbar hidden in print')
    for r in ['business', 'operations', 'property', 'supplier', 'government', 'insurance', 'research', 'public']:
        p2.goto(BASE + 'role-packs/' + r + '.html'); assert_(p2.locator('section.handbook-section').count() >= 10, r + ' pack')
    assert_(not errs, 'static pages: ' + '; '.join(errs)); c2.close()

@check
def working_handbook_download_includes_local_drafts(b):
    ctx, pg = page(b); nav(pg, 'library'); pg.click("[data-open-doc='02']"); pg.click('#editpanel summary')
    pg.fill('#editor', 'LOCAL DRAFT MARKER\n## Section'); settle(pg); nav(pg, 'start')
    html = download(pg, '#handbook')
    assert_('LOCAL DRAFT MARKER' in html and 'Zero Harm &amp; Anti-Coercion' in html and 'Content-Security-Policy' in html, 'working copy contents')
    ctx.close()

# ---------------------------------------------------------------- your data: reset, erase, details
@check
def selective_reset_clears_only_what_is_ticked_and_can_be_undone(b):
    ctx, pg = page(b)
    nav(pg, 'plan'); pg.fill('#site', 'S-RESET'); settle(pg)
    nav(pg, 'library'); pg.click("[data-open-doc='03']"); pg.click('#editpanel summary'); pg.fill('#editor', 'My plan draft'); settle(pg)
    nav(pg, 'data'); pg.check(".resetparts input[value='edits']"); pg.click('#resetsel'); pg.click('#rs2-yes'); settle(pg)
    s = state(pg); assert_(s['edits'] == {} and s['site'] == 'S-RESET', 'drafts reset, site kept')
    assert_('Reset: document drafts' in json.dumps(s['log']), 'logged')
    pg.click('#undo'); assert_(state(pg)['edits'].get('03') == 'My plan draft', 'undo brings the drafts back')
    info = pg.text_content('#techinfo')
    assert_('Child-Safer Spaces workspace 4.0' in info and 'S-RESET' not in info and 'My plan' not in info, 'technical details hold no planning data')
    ctx.close()

@check
def erase_workspace_and_everything(b):
    ctx, pg = page(b); nav(pg, 'plan'); pg.fill('#site', 'S-ERASE'); settle(pg)
    set_ls(pg, KEY2, '{}'); set_ls(pg, SETTINGS, '{"theme":"dark"}')
    nav(pg, 'data'); pg.click('#erase'); pg.click('#er-yes'); settle(pg)
    assert_(state(pg)['site'] == '' and ls(pg, KEY2) == '{}' and ls(pg, SETTINGS) is not None, 'workspace erased; older copy and settings untouched')
    pg.click('#eraseall'); pg.click('#er-yes'); pg.wait_for_timeout(400)
    left_ls = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('child-safer-spaces'))")
    assert_(left_ls == [] and [k for k in idb(pg, 'keys') if k.startswith('child-safer-spaces')] == [], 'everything erased: ' + ', '.join(left_ls))
    assert_(pg.evaluate("document.documentElement.dataset.theme") == 'system', 'settings back to defaults')
    ctx.close()

# ---------------------------------------------------------------- network and offline copy
@check
def network_is_locked(b):
    ctx, pg = page(b)
    res = pg.evaluate("fetch('https://example.com/').then(() => 'reached').catch(() => 'blocked')")
    assert_(res == 'blocked', 'content-security policy blocks connections')
    ctx.close()
    assert_(not OFFSITE, 'requests left the machine: ' + ', '.join(OFFSITE[:5]))

@check
def hosted_copy_works_offline_and_local_copies_register_nothing(b):
    ctx, pg = page(b)
    wait_js(pg, "document.getElementById('offline').textContent === 'Offline copy saved'", timeout=15000)
    assert_(pg.evaluate("!!document.querySelector('link[rel=manifest]')"), 'web app manifest linked when hosted')
    pg.reload(); ready(pg); wait_js(pg, "navigator.serviceWorker.controller !== null", timeout=10000)
    ctx.set_offline(True); pg.reload(); ready(pg)
    assert_(pg.text_content('#view h1').strip() and not pg.errors, 'opens without a connection: ' + '; '.join(pg.errors))
    nav(pg, 'brief'); assert_('Two-page brief' in pg.text_content('#view h1'), 'views work offline')
    caches = pg.evaluate("caches.keys()")
    assert_(len(caches) == 1 and caches[0].startswith('child-safer-spaces-4.0-'), 'one versioned cache: ' + ', '.join(caches))
    cached = pg.evaluate("caches.keys().then(k => caches.open(k[0])).then(c => c.keys()).then(rs => rs.map(r => new URL(r.url).pathname))")
    assert_(not any('child-safer-spaces-v3' in u for u in cached), 'no planning data in the cache')
    ctx.close()
    for url in (FILE_INDEX, FILE_STANDALONE, BASE + 'standalone.html'):
        ctx, pg = page(b, url)
        assert_(pg.evaluate("!document.querySelector('link[rel=manifest]')"), url + ': no manifest')
        regs = pg.evaluate("(async () => { try { return navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0; } catch (e) { return 0; } })()")
        assert_(regs == 0, url + ': no service worker')
        assert_(not pg.errors, url + ': ' + '; '.join(pg.errors))
        ctx.close()

# ---------------------------------------------------------------- layout and accessibility
@check
def no_horizontal_scroll_at_phone_widths(b):
    bad = []
    for w in (320, 375, 390):
        ctx, pg = page(b, viewport={'width': w, 'height': 800})
        for v in VIEWS + ['doc/30', 'brief/fr', 'notfound-check']:
            if v == 'notfound-check': pg.evaluate("location.hash = '#/nowhere'"); pg.wait_for_timeout(150)
            else: nav(pg, v)
            if overflow(pg) > 0: bad.append(f'{w}px {v}: {overflow(pg)}px')
        pg.click('#menubtn')
        if overflow(pg) > 0: bad.append(f'{w}px menu drawer')
        ctx.close()
    assert_(not bad, 'overflow: ' + ', '.join(bad))

@check
def accessibility_scan_axe(b):
    if not AXE: raise SkipTest('axe-core not supplied (--axe)')
    found = []
    for scheme in ('light', 'dark'):
        for vp in ({'width': 1280, 'height': 900}, {'width': 375, 'height': 800}):
            ctx, pg = page(b, viewport=vp, color_scheme=scheme)
            tag = f'{scheme} {vp["width"]}'
            for v in VIEWS:
                nav(pg, v)
                if v == 'start':
                    pg.click("label:has(input[name='sp-who'][value='business'])"); pg.click("label:has(input[name='sp-goal'][value='pilot'])"); pg.click('#spgo')
                    pg.click("[data-role='Operations']")
                if v == 'workflows': pg.click('#wf-W03 summary')
                if v == 'registers': pg.click('#example'); pg.click('#addrow'); pg.fill('#cell-4', 'call 613-555-0123'); pg.click('#saverow')
                axe_scan(pg, f'{tag} {v}', found)
            nav(pg, 'library'); pg.click("[data-open-doc='04']"); pg.click('#editpanel summary'); axe_scan(pg, tag + ' doc04', found)
            nav(pg, 'brief/fr'); axe_scan(pg, tag + ' brief fr', found)
            pg.click('#searchbtn'); pg.fill('#searchq', 'gate'); axe_scan(pg, tag + ' search dialog', found); pg.keyboard.press('Escape')
            pg.click('#settingsbtn'); axe_scan(pg, tag + ' settings dialog', found); pg.keyboard.press('Escape')
            if vp['width'] < 900: pg.click('#menubtn'); axe_scan(pg, tag + ' menu drawer', found); pg.keyboard.press('Escape')
            ctx.close()
    for name, init in [('more contrast', "localStorage.setItem('child-safer-spaces-settings', JSON.stringify({contrast: 'more', text: '150'}))")]:
        ctx, pg = page(b, init=init)
        for v in ('discover', 'start', 'data'): nav(pg, v); axe_scan(pg, name + ' ' + v, found)
        ctx.close()
    for p in ['handbook.html', 'role-packs/operations.html']:
        c = b.new_context(); pg = c.new_page(); pg.goto(BASE + p); axe_scan(pg, p, found); c.close()
    assert_(not found, 'axe violations:\n  ' + '\n  '.join(found))

@check
def accessibility_scan_axe_transient_states(b):
    if not AXE: raise SkipTest('axe-core not supplied (--axe)')
    found = []
    for scheme in ('light', 'dark'):
        ctx, pg = page(b, color_scheme=scheme)
        idb(pg, 'delete', KEY3); set_ls(pg, KEY2, (FIX / 'v2-state.json').read_text()); reload(pg)
        axe_scan(pg, scheme + ' migration banner', found)
        nav(pg, 'library'); pg.click("[data-open-doc='12']"); pg.click('#cmp'); axe_scan(pg, scheme + ' draft comparison', found)
        upload(pg, '#import', 'v2-backup.json', (FIX / 'v2-backup.json').read_bytes(), 'application/json'); axe_scan(pg, scheme + ' import preview', found)
        pg.click('#cancelimport')
        nav(pg, 'gates'); pg.click("[data-amend='G0']"); axe_scan(pg, scheme + ' gate amend confirmation', found)
        nav(pg, 'calculator'); pg.fill('#c-years', '0'); pg.click('#calculate'); axe_scan(pg, scheme + ' calculator error', found)
        nav(pg, 'library'); pg.click("[data-open-doc='12']"); pg.click('#editpanel summary'); pg.fill('#editor', 'call 613-555-0123'); settle(pg)
        pg.click('#export'); axe_scan(pg, scheme + ' export check', found); pg.click('#expcancel')
        nav(pg, 'data'); pg.click('#runcheck'); pg.check(".resetparts input[value='log']"); pg.click('#resetsel'); axe_scan(pg, scheme + ' data check and reset confirmation', found)
        idb(pg, 'put', KEY3, '{"broken": true}'); reload(pg); axe_scan(pg, scheme + ' quarantine banner', found)
        ctx.close()
    assert_(not found, 'axe violations:\n  ' + '\n  '.join(found))

@check
def restore_original_then_undo_brings_the_draft_back(b):
    ctx, pg = page(b); nav(pg, 'library'); pg.click("[data-open-doc='13']"); pg.click('#editpanel summary')
    pg.fill('#editor', 'MY LOCAL TRAINING NOTES'); settle(pg)
    nav(pg, 'library'); pg.click("[data-open-doc='13']"); pg.click('#editpanel summary'); pg.click('#restore'); pg.click('#rs-yes'); pg.wait_for_timeout(100)
    assert_('MY LOCAL TRAINING NOTES' not in pg.text_content('#docbody') and '13' not in state(pg)['edits'], 'original restored')
    pg.click('#undo'); pg.wait_for_timeout(120)
    assert_(state(pg)['edits'].get('13') == 'MY LOCAL TRAINING NOTES', 'undo brings the draft back')
    ctx.close()

@check
def search_roles_workflow_links_filters_and_legacy_preview(b):
    ctx, pg = page(b); nav(pg, 'start')
    pg.click("[data-role='Business']"); pg.wait_for_timeout(60)
    assert_('Business sponsor' in pg.text_content('#rolepanel') and 'Needs signed commitment' in pg.text_content('#rolepanel'), 'role entry point')
    html = download(pg, "#rolepanel [data-open-pack='Business']")
    assert_('Business working pack' in html, 'role pack download')
    nav(pg, 'library'); pg.fill('#search', 'restraint'); pg.wait_for_timeout(80)
    assert_('match "restraint"' in pg.text_content('#count') and pg.locator('.snippet').count() >= 2, 'search with snippets')
    nav(pg, 'plan'); pg.select_option('#f-kind', 'signed'); pg.wait_for_timeout(50)
    assert_('of 35 tasks shown' in pg.text_content('#taskcount') and pg.locator('details.taskcard').count() >= 8, 'kind filter')
    pg.locator('details.taskcard').first.evaluate('e => e.open = true'); pg.locator("details.taskcard [data-open-wf]").first.click(); pg.wait_for_timeout(150)
    assert_(pg.evaluate("[...document.querySelectorAll('details.wfcard')].filter(d => d.open).length") == 1, 'workflow deep link opens the card')
    nav(pg, 'evidence'); pg.select_option('#evcat', 'UNRESOLVED'); pg.wait_for_timeout(50)
    assert_(pg.locator('#evtable tbody tr').count() >= 2, 'evidence filter')
    assert_('E01' in download(pg, '#evidencecsv'), 'evidence CSV')
    nav(pg, 'sources'); pg.fill('#srcq', 'Ontario'); pg.wait_for_timeout(50)
    assert_('S18' in pg.text_content('#srclist') and 'S43' in pg.text_content('#srclist'), 'source filter')
    assert_('Re-check by' in pg.text_content('#srclist') and '2027-10' in pg.text_content('#srclist'), 'sources show when to re-check')
    assert_('S56' in download(pg, '#srccsv'), 'source CSV')
    set_ls(pg, KEY2, (FIX / 'v2-state.json').read_text()); nav(pg, 'data'); pg.reload(); ready(pg)
    pg.click(f"tr:has(code:text-is('{KEY2}')) [data-import-row]"); pg.wait_for_timeout(100)
    assert_('Migrated from v2' in pg.text_content('#importpanel'), 'legacy copy preview from Your data')
    pg.click('#cancelimport')
    ctx.close()

# ---------------------------------------------------------------- runner
only = set(args.only.split(',')) if args.only else None
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    version = browser.version
    for t in TESTS:
        if only and t.__name__ not in only: continue
        t0 = time.time()
        try:
            t(browser); RESULTS.append({'test': t.__name__, 'result': 'pass', 'seconds': round(time.time() - t0, 2)})
        except SkipTest as e:
            RESULTS.append({'test': t.__name__, 'result': 'skipped', 'detail': str(e)})
        except Exception as e:
            RESULTS.append({'test': t.__name__, 'result': 'fail', 'detail': (str(e) or traceback.format_exc())[:3000]})
        r = RESULTS[-1]; print(('ok   ' if r['result'] == 'pass' else r['result'].upper().ljust(5)) + t.__name__ + ('' if r['result'] == 'pass' else '\n      ' + r.get('detail', '').replace('\n', '\n      ')), flush=True)
    browser.close()
httpd.shutdown()
summary = {'browser': 'Chromium ' + version, 'tests': len(RESULTS), 'passed': sum(r['result'] == 'pass' for r in RESULTS), 'failed': sum(r['result'] == 'fail' for r in RESULTS), 'skipped': sum(r['result'] == 'skipped' for r in RESULTS), 'results': RESULTS}
print(f"\n{summary['passed']} passed, {summary['failed']} failed, {summary['skipped']} skipped · {summary['browser']}")
if args.json: pathlib.Path(args.json).write_text(json.dumps(summary, indent=1))
sys.exit(1 if summary['failed'] else 0)
