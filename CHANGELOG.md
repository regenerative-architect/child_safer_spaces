# Change log

## Version 4.0, global edition — 20 October 2026

A review of version 3 against the "Universal next-generation project enhancement directive" (see `review/FINDINGS-v4.md`), planned with the Feature Fusion Foundry's method (see `ENHANCEMENT-PLAN.md`). The aim: make the package quicker to understand, useful to officials and partners outside the United States and Canada, and safer to run day to day. Everything in version 3 is kept — documents 01–49, task and gate IDs, register columns, source IDs S1–S44, workflows, the backup format (version 3) and the state schema (3) — so drafts, citations, CSV files and backups still work. No tasks were added, so no gate reopens on upgrade.

### Before → after

| Area | Version 3 | Version 4 |
| --- | --- | --- |
| First contact | Start view listing 49 documents, 24 registers and 35 tasks | **Discover** (the idea in two minutes, six stages, what it is and is not, a read-aloud version for children) and **Start here** (up to four questions → two to five explained next steps and what can wait) |
| Officials | U.S./Canada government proposal (document 20) | **Two-page brief** for officials anywhere (document 50) with sources; **draft French and Spanish versions** (51, 52), labelled and language-tagged |
| Other countries | No method | **Adaptation kit** (53): what stays the same, rule mapping, international references with limits, method equivalence, consultation, pre-mortem, translation process |
| Spreading the program | Single-site playbooks | **From one site to many** (54): six stages with the evidence needed before each, and ways to help for 14 kinds of organization, with what to avoid |
| Understanding each view | None | **About this view** panel: what, why, how, real life, outcome, technical depth, uncertainty; a 32-term **glossary** (view and document 55) |
| Navigation | One flat list; no addresses | Six stage groups; **Essentials** (10 views) or **full workspace** (17); **deep links** (`#/doc/07`, `#/workflows/W03`, `#/brief/fr`), back and forward, recovery for unknown addresses; **search** everything (Ctrl K or /); phone drawers |
| Settings | Device theme only | Theme, text size (to 150%), more contrast, reduced motion, background scene, glass or solid surfaces, navigation mode; resettable; stored apart from planning data |
| Storage | localStorage only; two tabs could overwrite each other | **Browser database (IndexedDB)** with a fallback ladder; version 3 data copied in, never changed; **cross-tab conflict refusal**; keep-my-data request; storage use shown |
| Sharing data | Personal-data check when saving rows | Also a **check before sharing** a backup, listing where (never what); **reset selected parts** with undo; technical details for IT without planning data |
| Offline | Works from a folder or single file | Plus an **offline copy for hosted use** (service worker and manifest, secure addresses only; never planning data) |
| Look and feel | Plain tokens and type | Cool daylight palette, serif headings, the **0–120 cm child survey band** as the signature, a **daylight scene** in 2D canvas with a quality ladder, pause control, 90-second settle, still image under reduced motion or low battery; frosted glass with solid fallbacks |
| Sources and evidence | 44 sources, 33 claims | **56 sources** (WHO, UNICEF, UN CRPD, SDG 11, ILO, ISO 21542, ISO/IEC Guides 50 and 71, ISO 7010, WHO surveillance guidelines, WCAG 2.2), **39 claims**, and a re-check date for every source |
| Credits | — | **About, credits & licences** view and `ATTRIBUTIONS.md` (Foster + Navi / Planetary Restoration Archive; Feature Fusion Foundry) |
| Tests | 34 Node, 25 browser | **45 Node** (adds routes, guides, starting point, glossary, translations, storage layer, offline files, contrast), a **108-pair contrast check**, **39 browser** tests (adds history, search, settings, drawers, starting point, scene controls, database fallbacks, conflicts, export check, selective reset, hosted offline use) |

### Not changed

The program content of documents 01–48 and its U.S./Canada worked examples. No product approval, efficacy, insurer discount, funding award, endorsement, partner, signature or local legal determination is invented. The package licence is still to be chosen by the owner.

## Version 3.0 — 20 October 2026

A critical review of version 2 (see `review/FINDINGS.md`) followed by direct corrections. Version 2 identifiers — document numbers, task IDs, gate IDs, register columns and source IDs S1–S27 — are unchanged, so existing drafts, citations and CSV files still work.

### Before → after

| Area | Version 2 | Version 3 |
| --- | --- | --- |
| Saved data that fails validation | Silently replaced by the first keystroke (data loss reproduced) | Quarantined: untouched recovery copy, saving paused, download offered |
| Whole replacements (import, CSV, remove row, restore draft) | Confirmation only; recovery depended on a prior export | Preview plus an undo copy that survives reload |
| Upgrading | v2 drafts would hide corrected originals | Unedited drafts dropped; real drafts flagged "original updated — review" with line comparison; v1/v2 browser data copied, never modified |
| Gates | Any task edit or keystroke in a note silently reopened all later gates | Only status/evidence changes reopen; completed decisions need an explicit "Amend" with the affected gates listed; events logged and announced; undo |
| Storage problems | One transient status line | Persistent indicator and banner; page-close warning while unsaved |
| Child-retail mechanisms | Shopping-cart falls, tip-over and falling merchandise excluded with no owner | Routed with controls (document 27), task T35, survey and job-aid steps; cart injury evidence added |
| Accessibility constraints on padding and guards | Summarized from guidance; carpet, protrusion and route-width limits absent | Verified 2010 ADA Standards requirements (§§302, 303, 307, 403.5.1), 28 CFR 36.211, DOJ guidance, Ontario disruption notices; checked at procurement and commissioning |
| Fire routing | Floor-covering test only; S11 cited an ASTM work item that does not name the standard | S11 corrected to E648-25a with its corridor/exitway scope; separate questions for floor, fixture and freestanding padding |
| Workflows and authority | Steps scattered; stop/restart/scale authority split across four documents | 16 workflow cards (trigger, prerequisites, owner, authority, inputs, steps, record, acceptance, escalation) and a 12-row decision-rights matrix (document 49, Workflows view) |
| Role entry points | Document lists | Per-role "today / needs review / needs signature / hand off to" on the Start view; every task labelled by kind |
| Sources | 27 references, document-level citation, two read only via search extracts | 44 references with jurisdiction, edition, retrieval date, access level and limits; claim-level citations; all but one (S5, archived) re-checked or directly retrieved on 20 Oct 2026 |
| Evidence | 8 ledger rows | 33 rows with setting, transfer to children in retail, basis and limits; FLIP falls estimate and "harms not assessed" added; compliant-flooring worker-effort evidence added |
| Economics | Fixed four-point sensitivity; "recovered in year 0" with negative cash; other savings unguarded | Low/high ranges with pessimistic/optimistic combinations, early withdrawal and removal cost, documented basis required for other savings, corrected recovery semantics |
| Pilot design | Limits stated in words | Evaluation planning view: exposure needed, expected counts and upper bounds (e.g. ~17.7 million entries per group to detect a 20% reduction at 2 per 100,000) |
| Privacy boundary | Advisory text only | Pattern check (contact details, ages, injuries, claim numbers, footage) with confirm-before-save; import scan; job-aid scenario |
| CSV | Tab, CR and full-width formula characters not neutralized; apostrophes accumulated; semicolon files rejected | OWASP-style neutralization, lossless round trip, comma/semicolon/tab detection, row-numbered errors |
| Accessibility of the app | Not browser-tested; focus ring 2.56:1 on the sidebar; no focus management | Focus moves to each view heading, aria-current, page titles, 3:1+ focus rings, hover-contrast fixes, unique table regions; axe-clean in all tested states |
| Registers | 22, headers only | 24 (adds handoffs and software acceptance), purpose and column hints, a fictional example for each |
| Network | No policy | Content-security policy on every page (hash-based in the standalone file and handbook) |
| Footer | — | Zero Harm & Anti-Coercion note on every page and export |
| Tests | 17 Node checks; no browser run | 34 Node checks and 25 Chromium browser tests (with axe-core) |
| Source layout | Documents inside content.json | `documents/NN.md` are the editable sources; build checks cross-references and up-to-date outputs |

### Not changed

General U.S./Canada scope; California and Ontario remain labelled illustrations. No product approval, efficacy, insurer discount, funding award, signature or local legal determination is invented.

## Version 2.0 — 19 October 2026

See `docs/history/v2/CHANGELOG.md`.
