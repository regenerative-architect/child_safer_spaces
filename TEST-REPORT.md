# Test report — version 4.0 (global edition)

Executed on 20 October 2026 in an isolated Linux build environment. This report separates checks that were **executed** from checks that were **not verified** here. Software testing is not a safety certification, a legal review or an accessibility conformance claim.

## Environment

| Item | Version |
| --- | --- |
| Node.js | 22.22.0 (built-in test runner; no packages) |
| Browser | Chromium 141.0.7390.37, headless, driven by Playwright 1.56.0 (Python 3.13) |
| Accessibility engine | axe-core 4.10.2 (supplied to the test script; not bundled) |
| PDF | Chromium print engine (`source/make-pdf.py`) |

## Executed — all passing

### Automated content and logic checks: 45/45 (`node --test source/tests.cjs`)

| Group | What is checked |
| --- | --- |
| Content integrity (9) | Inventory counts (55 documents, 56 sources, 39 evidence claims, 17 routes, 6 stages); every [S#] citation resolves and every source has jurisdiction, edition, retrieval date, access and limits; version 2 identifiers preserved; workflows complete; tasks valid; fictional examples; role packs; prohibited claims only quoted or negated; no text implying foam, playground tests or zero incidents prove safety; any document naming a law, standard, treaty or study (now including WHO, ISO, CRPD, ILO, SDG, WCAG, UNICEF and their French and Spanish forms) cites a source |
| Rendering safety (1) | Markdown escapes HTML, links only known source IDs, never `javascript:` links |
| CSV (3), personal-data check (1), state and migration (5), storage loading (3), gates (2), finance (3), evaluation planning (1), helpers (1) | As in version 3, unchanged and passing |
| Version 4 structures (6) | Every route has a navigation group, all seven guide layers and a render function; the journey points to real routes; the starting point is deterministic, explained, capped by time, starts other countries with the adaptation kit, and every rule is reachable; glossary terms are unique and link to real places; every source has a re-check date and none is overdue at issue; translations are language-tagged, labelled as drafts, mirror the English sections and cite the same sources; the whole-workspace check reports locations and never the matched text; settings keep only known values and ignore damaged ones |
| Storage layer (2) | With a fake localStorage: earlier-version keys read and never changed; a write after another tab changed the workspace is refused (ConflictError) and stays paused; quota errors reported; with no storage at all the workspace runs from memory; a database that never answers falls back after a timeout |
| Offline files and quality (3) | The service worker caches only the listed local files and answers only same-origin GET requests, with a versioned cache name; the web manifest is valid; the folder copy's CSP allows the manifest but no connections; the background scene has its stop conditions; the contrast of 108 colour pairs meets WCAG AA in light, dark and both more-contrast themes |
| Package hygiene (5) | Generated files up to date; standalone self-contained with CSP hashes for its five inline scripts and no offline-copy registration; network lock, Zero Harm note and only local assets on every page (including the three brief pages); no network APIs, secrets or personal email addresses; SHA256SUMS lists every file with matching checksums |

### Browser tests in Chromium: 39/39 (`python3 source/browser-tests.py --axe …`)

| Test | Behaviour verified |
| --- | --- |
| Loads every view in three opening modes | All 17 views and a document deep link, over a local web server, from file:// and as the single file: an h1, page title and guide for each; no console errors or CSP violations |
| Keyboard | Skip link first and it moves focus to main (without being treated as a page address); Tab moves through navigation; focus ring #ffd166 in the sidebar and 3:1+ in content; Enter opens the view and focuses its heading |
| Deep links and history | Workflow, register and brief-language addresses; back and forward; an unknown address is shown as text (no markup runs) and offers search; unknown documents; the empty address goes to Discover |
| Search | Ctrl K and / open it; results for views, documents and glossary terms; arrow keys; Escape closes; Enter opens the first result; glossary deep link focuses the term |
| Settings | Theme, text size (20 px root at 125%), contrast, motion, surfaces and scene apply at once, persist, and reset; no planning data in settings |
| Essentials and full | Newcomers see 10 views; a full-only view joins the navigation while open; the full workspace shows 17 and is remembered; a workspace with saved work opens in full at Start here |
| Drawers | At 390 px the menu opens a drawer, focus moves in, the page behind is inert, Escape closes and returns focus, choosing a view closes it; the explanation panel opens as a drawer from the menu; at 1440 px it sits beside the content and closing is remembered |
| Starting point | Four answers give three explained steps for an hour; other countries start with the adaptation kit and say why; links work; answers kept only while the page is open, never stored |
| Brief translations | French brief tagged fr on heading and text, labelled draft, prints and downloads with its language tag and the Zero Harm note; the English brief links its WHO source |
| Background scene | Pause and play; stops when the page is hidden; canvas hidden from assistive technology; still under reduced motion; off in settings |
| Persistence in the browser database | Site code and drafts survive reload over http and file://; nothing written to localStorage |
| Version 3 data copied in | A version 3 workspace in localStorage is copied into the database and left byte-for-byte unchanged, listed under Your data; if the database is later emptied, the older copy is flagged as possibly out of date |
| Database unavailable | Falls back to localStorage with an explanation, and persists |
| Blocked storage | Works from memory, explains, exports; settings apply but say they are not saved |
| Full storage | A database write failure shows "not saved" with the error and guards page close |
| Quarantine | Unreadable data kept byte-for-byte under a recovery key in the database; typing does not overwrite it; download works; a new workspace keeps the recovery copy |
| Another tab | Two pages: the second tab's save is refused, it is told why, can download its own copy, and loads the saved version |
| v2 and v1 browser data | Migrated with report; older copies unchanged; drafts flagged; G1 needs T35 |
| Backups | Malformed, foreign, future and oversized files rejected with work unchanged; v2 backup preview, apply and undo; export and re-import restore exactly; envelope keeps format version 3 |
| Check before export | A phone number in a draft is reported by location (not text) before export; cancel downloads nothing; export anyway works; the same check runs from Your data |
| CSV, personal-data check, injection | As in version 3, plus escaped search snippets |
| Gates, cost scenarios, evaluation planning | As in version 3 |
| Printing | Current document; shell hidden in print; clean-up after printing; handbook print button under its CSP; 58 handbook sections with language tags on the translations; eight role packs |
| Working handbook | Download includes local drafts, the Zero Harm note and a CSP |
| Selective reset | Only ticked parts reset, logged, undoable; technical details contain no planning data |
| Erase | Workspace erase keeps older copies and settings; "erase everything" removes every item in the database and localStorage and resets settings |
| Network | CSP blocks fetch; no request left the machine during the whole run |
| Hosted offline copy | Over http://127.0.0.1 the service worker installs, the manifest is linked, the page reloads and works offline, one versioned cache, no planning data cached; from file:// and as the single file nothing is registered |
| Phone widths | No horizontal scrolling at 320, 375 and 390 px in any view, a long document, the French brief, the not-found page or the open menu |
| axe-core: views | Every view (with the starting-point results, a role panel, an open workflow card, a register example and confirmation), a document with its editor, the French brief, the search and settings dialogs and the phone menu, in light and dark at 1280 and 375 px; more contrast at 150% text; the handbook and a role pack: no violations |
| axe-core: transient states | Migration banner, draft comparison, import preview, gate amendment, calculator error, export check, data check with reset confirmation, quarantine banner, light and dark: no violations |
| Restore and undo; navigation and filters | As in version 3, plus source re-check dates and the legacy-copy preview from Your data |

Results files: `source/test-results/node.txt`, `source/test-results/browser.json` and `source/test-results/contrast.txt`.

### Other executed checks

- Rebuild reproducibility: `node source/build.cjs --check` reports all generated files up to date.
- Checksums: `SHA256SUMS.txt` verified by the Node suite and by `sha256sum -c`, in the working copy and in a freshly extracted copy of the ZIP.
- PDFs: `handbook.pdf` (Letter) and the three briefs (A4) rendered by Chromium; pages inspected visually. Each brief's text fits on two pages; its source list continues on a third.
- Backward compatibility: a version 4 backup was imported by the version 3 code (accepted); a backup containing a draft of document 50 was rejected by version 3, as documented in README.md.
- Screenshots reviewed at 1440 and 390 px in light and dark themes, including dialogs and drawers; three layout defects found this way were fixed (see `review/FINDINGS-v4.md`).

### Defects found by these tests and fixed before release

The skip link was treated as an unknown page; navigation expanded by itself once work was saved; erasing in the database raised a false cross-tab conflict; Escape in a search box with text did not close search; the status bar sat outside the page landmarks; blocked storage left the engine indicator at "Checking…"; "erase everything" left a marker behind; the child-band labels were hidden behind the hero panel. Each fix was re-tested.

## Not executed here

- **The Feature Fusion Foundry's planner code** was not run: the build environment's safety policy blocks running code fetched from outside. Its rules were applied by reading them (`ENHANCEMENT-PLAN.md` gives steps to reproduce the run in the hosted Foundry).

## Not verified here — exact manual steps

Record each result in the software-acceptance register (Planning registers → software acceptance). `source/MANUAL-CHECKS.md` has the full checklist.

1. **Firefox and Safari (desktop).** Open `index.html` from a local folder. Note whether the status bar says "Browser database", "Fallback storage" or "Not stored" — these browsers may not allow the database for local files. If the "scripts have not loaded" notice stays, open `standalone.html`. Then run steps 3–12 of `source/MANUAL-CHECKS.md`.
2. **Edge and other Chromium browsers.** Repeat step 1; behaviour should match Chrome.
3. **Phones and tablets.** Serve the folder from an approved HTTPS address or use `standalone.html`. Check the menu drawer, a register edit, an export and the starting point at 320–390 px.
4. **Hosted offline copy in other browsers.** On an HTTPS server, open once, go offline, reload. Check that only workspace files are cached.
5. **Screen readers.** NVDA with Firefox or Chrome, JAWS with Chrome, VoiceOver with Safari (macOS and iOS), TalkBack with Chrome (Android). Navigate by headings and landmarks; change view and confirm the new heading is announced; use search; open and close the menu and the "About this view" panel; hear status messages; complete the confirm-before-save and check-before-export steps.
6. **Zoom and reflow.** At 1280 px width, zoom to 200% and 400%, and try the Largest text setting. Confirm no content is cut off and navigation still works.
7. **Forced colours.** Windows High Contrast (or another forced-colours mode): badges, the current navigation item, focus rings and the choice buttons must stay visible; the background scene is hidden.
8. **Real low-power devices.** On an older phone, watch the Discover scene for a minute: it should stay smooth or drop to a still image, and pause after 90 seconds. Battery status is not offered by every browser.
9. **Printing.** Print a document, the brief and the working handbook to paper and to PDF in each browser you use. Page footers and numbers appear only in Chromium-based browsers.
10. **Spreadsheets.** Export a register CSV, edit it in Excel (English and French locales), LibreOffice, Numbers and Google Sheets, save as CSV UTF-8, and import it. Confirm formula-like text stays text and semicolon files are read.
11. **Your browser policies.** Managed browsers may clear site data on exit or block storage for local files. Check the status bar and export behaviour.
12. **Translations.** Have qualified native speakers review documents 51 and 52 before official use.
13. **Accessibility conformance.** A qualified reviewer should audit the workspace against WCAG 2.2 AA before your organization makes any conformance statement. Automated scans find only some issues.
