# Child-Safer Spaces — implementation bundle

**Version 4.0, global edition · 20 October 2026**

A free, offline planning kit for shops and public buildings that children visit. It helps the people who run them find and fix what makes children slip, trip, fall or hit their heads, without making the space harder for anyone else to use — wheelchair users, people with low vision, older adults and workers included. The program is performance-based (it says what a fix must achieve and how it will be checked) and material-neutral (it recommends no product). Large retailers are mentioned only as examples; no partnership is implied.

Version 4 keeps everything in version 3 and adds a short front door for officials and partners anywhere: a two-page brief with draft French and Spanish versions, a country adaptation kit, a pathway from one site to many, a starting point that tells each person what to do first, plain-language explanations for every view, and a browser database with an offline copy for hosted use.

## Start here

1. Extract the **whole** ZIP to a folder you control and open `index.html` in a current browser. No installation or internet connection is needed. (Or open `standalone.html`, a single file containing everything.)
2. **Discover** explains the idea in two minutes. **Start here** asks up to four questions and gives you two to five next steps, each with the reason it was suggested and what you can skip for now.
3. Officials: read the **Brief for officials** (document 50), then **Adapt to your country** (document 53).
4. Site teams: follow workflow **W01** (set-up), then **W02–W04**. Ordinary hazard correction begins immediately; anything that changes regulated elements, collects research data or commits money waits for its review or signature.
5. Check the status bar at the bottom: "Saved in this browser" means your work is kept here. Export a planning backup at the end of every session to an approved location.

| If you are… | Start with |
| --- | --- |
| An official or policy adviser, anywhere | Documents 50, 53, 54 (and 20 for the U.S. and Canada) |
| A public-health or injury-prevention agency | Documents 50, 15, 35, 53 · the evidence ledger |
| A business sponsor | Documents 02, 03, 10, 17, 49 · workflows W02, W14 |
| A store manager or worker | Documents 12, 13, 14, 28, 47 · workflows W03, W04, W11, W16 |
| Facilities, accessibility or fire/code reviewer | Documents 06, 07, 08, 29, 30, 31 · W07, W08 |
| An insurer, broker or risk team | Documents 15, 16, 17, 19, 44 · W07 |
| A disabled people's, workers' or families' organization | Documents 30, 24, 23, 54 |
| A supplier, laboratory or installer | Documents 08, 09, 21, 29, 39 · W08–W10 |
| An evaluator or researcher | Documents 15, 24, 32, 35, 43 · W05, W06, W13 |
| A translator or partner | Documents 51, 52, 53, 54 |
| A developer or IT team | About, credits & licences · `source/README.md` |

## What is inside

| Part | What it is |
| --- | --- |
| `index.html` with `app.js`, `core.js`, `store.js`, `atmosphere.js`, `data.js`, `style.css`, `icon.svg` | The workspace: 17 views in six stages (Discover, Understand, Explore, Participate, Apply, Steward), search, settings, an "About this view" panel, 16 workflow cards, 35 tasks across 7 gates, 55 documents, 24 registers, cost scenarios, evaluation planning, evidence ledger, source register, adaptation kit and "Your data". |
| `standalone.html` | Everything above in one portable file. |
| `documents/` | The 55 documents as Markdown (49 and 55 are generated; 51 and 52 are draft translations). |
| `handbook.html`, `handbook.pdf` | The complete original issue, print-ready, readable without scripts. |
| `briefs/` | The brief for officials as print pages and PDFs (A4): English, and the draft French and Spanish versions. Ready to attach to an email. |
| `role-packs/` | Eight printable role packs. |
| `registers/`, `examples/` | 24 blank CSV templates with rules, and one clearly fictional example row per register. |
| `SOURCES.md` | 56 sources with jurisdiction, edition, retrieval date, access level, limits and where each is cited. |
| `LOCAL-DECISIONS.md` | What still requires local professionals, authorities, evidence or signed commitments. |
| `ENHANCEMENT-PLAN.md` | How version 4 was planned with the Feature Fusion Foundry method, with every candidate scored and its decision. |
| `ATTRIBUTIONS.md` | Credits, licences and what the package does and does not include. |
| `review/` | Findings registers: `FINDINGS-v4.md` (this version) and `FINDINGS.md` (the version 3 review), each with a CSV. |
| `CHANGELOG.md`, `TEST-REPORT.md`, `VERIFICATION.md` | What changed, what was tested (and what was not), and the limits. |
| `sw.js`, `app.webmanifest` | The offline copy for hosted use. Used only when the folder is served from a secure web address. |
| `source/` | `content.json`, the build script, Node and browser tests, the contrast check, fixtures, maintainer guide and acceptance checklist. |
| `docs/history/v2/` | The version 2 documentation and content, kept for comparison. |

## Privacy, storage and recovery

This is single-user, offline planning. There are no accounts, no network connections (each page carries a content-security policy that blocks them), no analytics and no tracking. **Do not enter** children's identities, injury or health details, CCTV, witness details, claim numbers or confidential contracts — the workspace checks for common patterns and asks before saving, and checks again before a backup is exported, but it cannot catch everything. Keep official and personal records in your protected organizational systems and record only a reference here.

- **Where work is kept:** in the browser's own database (IndexedDB). If a browser does not allow that, the workspace uses its simpler storage (localStorage, about 5 MB) and says so; if neither is allowed, work stays in memory and you are asked to export. Display settings are kept separately and contain no planning data.
- **Two tabs:** if the workspace is changed in another tab or window, this tab stops saving rather than overwrite it, and offers to download its copy.
- **Unreadable data:** an untouched recovery copy is kept and saving pauses until you decide; nothing is silently overwritten.
- **Undo:** backup imports, CSV replacements, row removals, draft restores, gate amendments and selective resets keep an undo copy.
- **Your data** lists everything stored and where, downloads any item, checks for personal-looking text, resets selected parts, asks the browser to keep the data, and erases on request.
- Anyone with a backup file can read it. Moving the HTML file, changing browser or clearing site data can separate or erase stored work.

## Hosting on an intranet or website (optional)

Copy the whole folder to a web server that uses HTTPS. The browser then keeps an offline copy of the workspace files (never your planning data) so it opens without a connection after the first visit. Opened from a folder or as a single file, the workspace already works offline and registers nothing. Publishing these files does not create access controls, and each person's planning data still stays in their own browser.

## Upgrading from earlier versions

Open version 4 in the same browser you used before. Version 3 work kept in browser storage is **copied** into the browser database; the earlier copy is left unchanged, and you can delete it under Your data once you are happy. Version 1 or 2 planning data is migrated as in version 3: unedited drafts are dropped, real drafts are kept and marked for review, and gates stay complete only if they still qualify. Backups keep format version 3, so files exported from version 3 import into version 4. A version 4 backup also imports into version 3 unless it contains drafts of the new documents 50–55. No tasks were added in version 4, so no gate reopens because of the upgrade.

## Real-world decisions still required

No pilot site, local legal opinion, approved product, test threshold, signed permission, funding award, insurer concession, ethics approval, endorsement, partner or effectiveness finding is invented here. `LOCAL-DECISIONS.md` lists who decides each item and which gate it blocks. The French and Spanish briefs are unreviewed drafts. **No licence has been chosen yet**: until the owner chooses one, ask the owner before copying or republishing the package beyond reading and internal evaluation.

## Tested

45 automated checks of content and logic (`node --test source/tests.cjs`), a contrast check of 108 colour pairs, and 39 browser tests in Chromium 141 — including axe-core accessibility scans of every view, dialog and drawer in light and dark themes at desktop and phone widths, offline use of a hosted copy, storage fallbacks and cross-tab protection (`python3 source/browser-tests.py --axe <axe.min.js>`). Firefox, Safari, mobile browsers and screen readers were **not** tested; `TEST-REPORT.md` gives exact manual steps. No conformance or certification claim is made.

## For maintainers

Edit `documents/01.md`–`48.md`, `50.md`–`54.md` and `source/content.json`, then run `node source/build.cjs` (Node 18+, no packages). See `source/README.md`.

---

**Zero Harm & Anti-Coercion.** These materials exist to prevent injury and widen access. Do not use them to blame or surveil caregivers, children, workers or disabled visitors, to pressure anyone into taking part, or to hide unfavourable findings.
