# Maintainer guide

The workspace is plain HTML, CSS and JavaScript with no runtime dependencies, network requests, analytics or tracking. You only need Node.js 18+ to rebuild; Python with Playwright is optional for the browser tests and the PDF.

## Layout

| Path | Role | Edit? |
| --- | --- | --- |
| `documents/01.md`–`48.md`, `50.md`–`54.md` | Documents: a short header (`id`, `title`, `role`, optional `lang` such as `fr`) then Markdown | Yes |
| `documents/49.md`, `55.md` | Workflow cards and the glossary, generated from `content.json` | No |
| `source/content.json` | Sources, evidence, gates, tasks, registers, column hints, examples, workflows, decision rights, roles, local decisions, role packs, and the version 4 structures: `routes`, `viewGuides`, `journey`, `glossary`, `startQuestions`, `startRules`, `startSkips`, `discover`, `attributions` | Yes |
| `core.js` | Pure logic shared by the app, build and tests (no DOM, no storage of its own) | Yes |
| `store.js` | Browser storage: database first, then localStorage, then memory; cross-tab protection | Yes |
| `atmosphere.js` | The optional Discover background scene | Yes |
| `app.js`, `index.html`, `style.css`, `icon.svg` | The workspace shell and views | Yes |
| `data.js`, `standalone.html`, `handbook.html`, `role-packs/`, `registers/`, `examples/`, `SOURCES.md`, `LOCAL-DECISIONS.md`, `manifest.json`, `sw.js`, `app.webmanifest`, `SHA256SUMS.txt` | Generated | No |
| `handbook.pdf` | Printed from `handbook.html` by `source/make-pdf.py` | No |
| `docs/history/v2/` | Version 2 documentation and content; the build uses it to recognise unedited v2 drafts | No |

## Commands

```sh
node source/build.cjs                 # regenerate everything and SHA256SUMS.txt
node source/build.cjs --check         # exit 1 if any generated file is out of date
node --test source/tests.cjs          # 45 content and logic checks
node source/check-contrast.cjs        # contrast of every colour pair in every theme
python3 source/browser-tests.py --axe path/to/axe.min.js   # 39 Chromium tests (optional; --only name,name runs some)
python3 source/make-pdf.py            # re-render handbook.pdf (optional)
node source/build.cjs --checksums     # refresh checksums after adding files (test logs in source/test-results/ are excluded)
```

The build stops with a list of problems if a citation, workflow, task, register example, role pack, route, view guide, glossary link or starting-point rule refers to something that does not exist.

## How the workspace is put together

- **Routes.** `content.json → routes` lists every view (id, label, journey stage, `essentials` or `full`, search keywords). `app.js` has one render function per route in `RENDER`. Addresses are `#/<route>[/<argument>]`, for example `#/doc/07`, `#/workflows/W03`, `#/registers/hazards`, `#/brief/fr`, `#/start/roles` (scrolls to the element with that id). Anchors that do not start with `#/` (such as the skip link) are ignored by the router.
- **Guides.** `viewGuides` holds seven layers for every route plus `doc` and `notfound`: what, why, how, life, outcome, technical, uncertain.
- **Starting point.** `core.startingPoint(answers, D)` applies `startRules` in priority order; a rule applies when every dimension it lists matches. The time answer caps the number of steps (2, 3 or 5). Tests check that every rule is reachable and every target exists.
- **Storage.** `store.js` reads everything into memory at start-up and writes changes to IndexedDB in the background (`durability: 'strict'`); "Saved" appears only after the browser confirms. Keys keep the version 3 names (`child-safer-spaces-v3`, `-v3-undo`, `-v3-unreadable-*`). Older localStorage keys are read for migration and never written. The workspace key is guarded: before overwriting it, the stored value is compared with the value this tab last saw.
- **Settings.** `child-safer-spaces-settings` in localStorage, read through `core.readSettings` (unknown keys and values are dropped).
- **Offline copy.** `sw.js` and `app.webmanifest` are generated; `app.js` registers the service worker only over a secure `http(s)` address and never in `standalone.html`. The cache name includes a hash of the cached files.
- **Background scene.** `atmosphere.js` exposes `CSSAtmosphere.mount(hero, canvas, options)`. Colours come from the `--atmo-*` tokens in `style.css`.

## Markdown supported in documents

`##` and `###` headings (a lone `#` also renders as a section heading), paragraphs, `- ` and `1. ` lists, pipe tables, `**bold**`, and `[S12]`-style citations that link to the source register (one ID per bracket). Everything is HTML-escaped first, so drafts cannot inject markup.

## Adding things

- **A document:** add `documents/56.md` with the header, add its ID to the relevant `rolePacks` in `content.json`, rebuild. Add `lang:` for a translation and say in its first section that it is a draft until reviewed.
- **A view:** add a route to `routes`, a guide to `viewGuides`, and a render function to `RENDER` in `app.js`. The tests fail until all three exist.
- **A starting-point rule:** add it to `startRules` with a unique id, `when`, `priority`, `title`, `detail`, `target` (`view`, `doc`, `wf` or `reg`) and `work` (`now`, `review`, `signed`).
- **A glossary term:** add it to `glossary` with `see` pointing to a route id or a two-digit document id.
- **A source:** append a new ID (never renumber existing IDs — drafts cite them) with every field filled; cite it as `[S57]`.
- **A register:** add its name to `registers`, its columns to `schemas`, and `registerMeta` (purpose, documents, workflows, `scan` mode, a fictional example row with one value per column).
- **A task:** give it a gate, kind (`now`, `review` or `signed`) and workflow. Adding a task to a gate makes existing completed gates reopen on migration — say so in the change log.
- **A workflow:** fill every field; tests reject missing ones.

## Planning-data format and migration rules

Database `child-safer-spaces`, object store `kv`, workspace key `child-safer-spaces-v3`. Backups are `{ "format": "child-safer-spaces", "version": 3, "app": "4.0", "state": … }`. The workspace reads backups and browser data from versions 1, 2 and 3. Older keys are read, never written or deleted unless the person deletes them under Your data. Migration keeps real drafts (marked for review against corrected originals), drops drafts identical to an old or current original, re-checks every gate against current tasks, and rejects damaged data instead of guessing. Unknown top-level fields are rejected, so a newer format bumps the version number.

## Do not

Commit production planning backups, personal records or organizational secrets to a shared repository. Add analytics, accounts, remote fonts or scripts, or network calls. Publishing these files on a website does not create access controls.
