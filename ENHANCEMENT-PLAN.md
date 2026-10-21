# Enhancement plan — version 4.0 (global edition)

This plan records how the "Universal next-generation project enhancement directive" (Foster + Navi / Planetary Restoration Archive) was applied to Child-Safer Spaces 3.0. It follows the directive's process: audit, prioritize, architect, implement, verify, report. It separates what was **built and tested**, what was **written**, what is **deferred** pending an owner decision, and what was **rejected** and why.

## How the Feature Fusion Foundry method was used

The directive asks for the Feature Fusion Foundry's deterministic planning: intent classification, capability matching, dependency analysis and synergy detection. The repository (https://github.com/regenerative-architect/feature_fusion_foundry, commit `f36730493d1c8a8295082bdb731dce6e2e0068ed`, MIT License, © 2026 Foster + Navi / Planetary Restoration Archive) was inspected read-only.

- **What was used:** the planner's published rules in `js/modules/discovery.js` (18 intent families with weighted signals, capability lanes) and `js/modules/metaplanner.js` (11 dependency rules, 10 risk rules), the 27 curated synergies, and the 912-entry capability catalog in `js/features.js` (857 stable, 36 conditional, 19 emerging). The catalog was read as data; capability IDs below (for example f001) refer to it.
- **What was not done:** the planner's code was **not executed** in this build environment, whose safety policy blocks running code fetched from outside. The rules were applied by reading them. To reproduce the ranking with the tool itself, paste the brief below into Foundry Intelligence and run it once on "auto" and once per primary-focus lane.
- **No Foundry code is included** in this package; the method and catalog informed decisions only.

### The brief given to the method

> Offline, privacy-preserving planning workspace and handbook that helps businesses, municipal officials and national injury-prevention agencies worldwide reduce child slips, trips, falls and fixture-impact injuries in retail and public spaces. Needs progressive comprehension for non-experts, evidence and citation provenance, governance approval gates and decision records, accessibility (WCAG 2.2 AA, reduced motion, keyboard, screen reader), internationalization and country adaptation, local-first storage with IndexedDB, schema versioning and recoverable migration, static hosting with a service worker, calm cinematic visuals with particles and lighting that degrade on low-power phones, deterministic tools with no AI required, scenario and sensitivity analysis for costs, workflow tasks with owners, and zero tracking. Children are discussed but no child data is collected.

### Intent classification (signals applied by hand)

| Intent family | Score | Signals that matched |
| --- | --- | --- |
| Advanced visuals / motion / 3D | 18 | "visuals" 7, "cinematic" 6, "particles"/"lighting" 5 |
| Accessibility & inclusive UX | 12 | "accessibility"/"WCAG" 8, "keyboard" 4 |
| Simulation & scenario analysis | 11 | "sensitivity" 7, "scenario" 4 |
| Mobile / constrained hardware | 11 | "phones" 6, "low-power" 5 |
| Governance & deliberation | 10 | "governance" 7, "approval" 3 |
| Workflow automation | 10 | "workflow" 7, "tasks" 3 |
| Static-host compatibility | 8 | "static host" 8 |
| Offline / low-connectivity | 7 | "offline" 7 |
| Privacy / sensitive data | 7 | "privacy" 7 |
| AI / agent assistance | 7 | "AI" 7 — **false positive**: the brief says "no AI required" |
| Evidence & provenance | 6 | "evidence"/"citation" 6 |
| Cross-domain collaboration | 3 | "business", "expert" 3 |

With the planner's threshold (at least 62% of the top score), "auto" mode would make **visuals and accessibility** the primary lanes and drop offline, privacy and evidence out of the primary ranking. That would optimize the wrong thing for this mission. So, as the Foundry itself recommends for ambiguous briefs, each lane was considered with its primary-focus override, and **mission relevance was scored first and weighted highest** below.

### Dependency and risk rules that fired

| Rule | What it asked for | Outcome |
| --- | --- | --- |
| Offline / intermittent | Offline mutation queue, freshness indicators, incremental sync, conflict-resolution UI | Conflict refusal and freshness built; no sync exists, so no queue was needed |
| Static hosting | Transport abstraction, portable workspace bundles, progressive enhancement | Backups (portable bundles) and progressive enhancement already existed; no transport needed |
| Evidence / citation | Claim-evidence linking, data lineage, source freshness | Evidence ledger existed; source freshness added |
| Particles / render | Render-loop and frame pacing, responsive quality ladder | Both built into the background scene |
| Public | Report/block/mute, rate limiting, rollback, object ACLs | **False positive** ("public spaces" means physical places; the workspace has no shared content) |
| Risk: offline/sync | Convergence versus semantic validity | Migration validates every field; damaged data are quarantined |
| Risk: evidence | Stale or misapplied evidence | Re-check dates; every claim keeps its limits |
| Risk: public | Abuse and spam | Not applicable (no shared content) |

Synergies used: "Accessible progressive complexity" (live regions + adaptive explanations + guided/expert modes), "Adaptive animation performance" (frame pacing + quality ladder + visibility-triggered effects), "Expandable suites with safe progressive rollout" (adapted as a route registry and user settings), and "Structured harm and failure-mode review" (stakeholder map + consequence mapper + pre-mortem, as content).

## Scoring rubric

Each candidate is scored 0–3 on the directive's eight criteria (3 is best; for complexity, performance cost and maintenance, 3 means *low* cost). Weights: mission relevance ×3, user benefit ×2, accessibility ×2, safety ×2, visual impact ×1, complexity ×1, performance ×1, maintenance ×1. Maximum 39. A safety score of 0 rejects a candidate whatever its total. As a guide, 28 or more means adopt, 20–27 adopt with limits or defer, below 20 reject; a candidate that needs an owner decision is deferred even with a high score.

Columns: M mission, B benefit, V visual, C complexity, P performance, A accessibility, S safety, Mt maintenance.

| Candidate | Foundry capability | M | B | V | C | P | A | S | Mt | Total | Decision | Status | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Browser database for planning data | f001 IndexedDB; f005 Schema migrations | 3 | 3 | 0 | 1 | 3 | 2 | 3 | 2 | 31 | Adopt | Built; tested in Chromium | Directive §7. Version 3 data are copied in and never changed; state schema 3 and backup format 3 are kept, so nothing breaks. |
| Storage fallback ladder | f136 Capability fallback ladder; f135 Progressive enhancement | 3 | 3 | 0 | 2 | 3 | 2 | 3 | 2 | 32 | Adopt | Built; tested in Chromium | Database, then localStorage, then memory with export. Each step is announced. |
| Cross-tab conflict refusal | Dependency rule "Conflict-resolution UI" (offline lane) | 3 | 3 | 0 | 2 | 3 | 2 | 3 | 2 | 32 | Adopt | Built; tested in Chromium | Found by the method's dependency rules: two open tabs could silently overwrite each other in version 3. |
| Offline copy for hosted use | f216 Versioned service worker | 2 | 2 | 0 | 2 | 3 | 2 | 2 | 2 | 25 | Adopt with limits | Built; tested in Chromium over http://127.0.0.1 | Only from a secure web address; caches files, never planning data. Not used from a folder or the single file. |
| Storage use and keep-my-data request | f439 Storage quota monitoring; f440 Persistent storage requests | 2 | 2 | 0 | 3 | 3 | 2 | 3 | 3 | 29 | Adopt | Built; shown under Your data | Explicit button; the browser's answer is shown as given. |
| Route registry and deep links | f125 Route registry; f269 Deep links | 3 | 3 | 0 | 2 | 3 | 3 | 3 | 2 | 34 | Adopt | Built; tested | One registry in content.json drives navigation, search, titles and guides; back and forward work; unknown addresses recover. |
| Search everything | f264 Universal search (f263 Command palette rejected as a command runner) | 3 | 3 | 0 | 2 | 3 | 3 | 3 | 2 | 34 | Adopt | Built; tested | Results are links only; nothing can be executed from the search box. |
| Essentials and full workspace | f267 Guided/expert modes | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | 35 | Adopt | Built; tested | Newcomers see 10 views; returning work opens the full 17. Nothing is removed, only folded away. |
| Layered "About this view" panel | f383 Adaptive explanations; synergy "Accessible progressive complexity" | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | 35 | Adopt | Built; tested | Directive §3: what, why, how, real life, outcome, technical depth and uncertainty for every view. |
| Plain-language glossary | f276 Glossary/ontology; f377 Just-in-time primers | 3 | 3 | 0 | 3 | 3 | 3 | 3 | 2 | 35 | Adopt | Built (view and document 55) | Terms appear in the panel of the view where they matter. |
| Find your starting point | f782 Interactive onboarding; f314 Explainable recommendations | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | 35 | Adopt | Built; tested (rules in Node, form in Chromium) | Fixed rules; each step says why it was suggested and what can be skipped. |
| Phone drawers | f270 Responsive drawer/navigation | 2 | 3 | 1 | 2 | 3 | 3 | 3 | 2 | 32 | Adopt | Built; tested at 320–390 px | Focus moves in, the page behind is inert, Escape closes, focus returns. |
| Status bar | f119 Capability registry; f214 Freshness indicators; f085 Local-only mode | 2 | 2 | 0 | 3 | 3 | 2 | 3 | 3 | 29 | Adopt | Built | Shows where work is kept, that there is no network, and offline state. |
| Status announcements | f161 Live regions | 2 | 2 | 0 | 3 | 3 | 3 | 3 | 3 | 31 | Adopt | Extended from version 3 | Shown briefly above the status bar and announced to screen readers. |
| Motion and contrast settings | f162 Reduced motion; f163 High contrast; f126 Feature flags (as user settings) | 2 | 3 | 0 | 3 | 3 | 3 | 3 | 3 | 33 | Adopt | Built; tested | Theme, text size, contrast, motion, scene, surfaces and navigation; resettable; no planning data. |
| Source freshness | f113 Source freshness | 3 | 2 | 0 | 3 | 3 | 2 | 3 | 3 | 32 | Adopt | Built | Each source shows a re-check date one year after retrieval. |
| Check before sharing | f560 PII detection before export | 3 | 3 | 0 | 3 | 3 | 2 | 3 | 3 | 34 | Adopt | Built; tested | Lists where personal-looking text is, never the text, before a backup leaves the device. |
| Reset selected parts | f435 Selective export/import | 2 | 3 | 0 | 2 | 3 | 2 | 3 | 2 | 29 | Adopt | Built; tested | With an undo copy; resetting tasks reopens dependent gates. |
| Technical details for IT | f626 User-exportable diagnostic report | 2 | 2 | 0 | 3 | 3 | 2 | 2 | 3 | 27 | Adopt with limits | Built | Shown in full before download; contains no planning data. |
| Pre-mortem and stakeholder review in the adaptation kit | f369 Stakeholder map; f370 Consequence mapper; f372 Pre-mortem | 3 | 3 | 0 | 3 | 3 | 2 | 3 | 3 | 34 | Adopt (as content) | Written (document 53) | Synergy "Structured harm and failure-mode review"; kept as a worksheet, not software. |
| Draft translations with language tags | f174 Incomplete translation indicators | 3 | 3 | 0 | 3 | 3 | 3 | 3 | 2 | 35 | Adopt | Written (documents 51 and 52); tested | Clearly labelled as unreviewed drafts; editable as local drafts by reviewers. |
| Background scene on Discover | f900 Render-loop and frame pacing; f908 Responsive visual quality ladder; f902 IntersectionObserver effects; f176 Canvas rendering | 1 | 1 | 3 | 1 | 2 | 2 | 3 | 2 | 23 | Adopt with limits | Built; controls tested | 2D canvas only, on one page, with pause, settle after 90 s, still image and off settings. An illustration, not data. |
| Battery-aware scene | f601 Battery-conscious mode | 1 | 2 | 0 | 3 | 3 | 2 | 3 | 3 | 26 | Adopt with limits | Built (where the browser offers battery status) | Still image when the battery is low and not charging. |
| Frosted glass surfaces | f877 Glass and backdrop-filter surfaces | 1 | 1 | 2 | 3 | 2 | 1 | 3 | 3 | 23 | Adopt with limits | Built | Near-opaque values keep text contrast; solid in more-contrast mode, in forced colours and on request. |
| Cross-fade between views | f678 View Transitions; synergy "Coherent DOM and route motion" | 1 | 1 | 2 | 3 | 3 | 2 | 3 | 3 | 26 | Adopt with limits | Built where supported | 160 ms, skipped with reduced motion; helps orientation. |
| Interface translation packs | f669 Community translation packs; f670 User-importable translation packs | 3 | 3 | 0 | 1 | 3 | 3 | 2 | 1 | 30 | Deferred | Blocked: owner decision | Needs decisions on languages, reviewers and who maintains them. Documents were translated first. |
| Signed release manifest | f071 Signed manifests; f116 Hash verification | 2 | 1 | 0 | 1 | 3 | 2 | 2 | 1 | 21 | Deferred | Blocked: owner decision | Needs the owner's signing key and process. SHA256SUMS.txt already lets anyone check file integrity. |
| Browser translation of text | f507 Browser Translator API (emerging) | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 1 | 21 | Deferred | Not built; revisit when the API is stable | Emerging, browser-specific, may download models; quality unverified for official text. |
| Uncertainty by random sampling | f233 Monte Carlo simulation | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 16 | Rejected | Not built | Would suggest precision the evidence cannot support; explicit ranges stay clearer. |
| Cinematic splash screen | f905 Cinematic splash orchestration | 0 | 0 | 3 | 1 | 1 | 1 | 2 | 2 | 13 | Rejected | Not built | Stands between an official and the content; the hero scene gives the mood without delay. |
| Map layers | f183 GeoJSON layers | 0 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 13 | Rejected | Not built | No geospatial need; site locations are sensitive planning context. |
| Off-thread canvas | f030 OffscreenCanvas | 0 | 0 | 1 | 1 | 3 | 2 | 3 | 1 | 16 | Rejected | Not built | Workers are unreliable from local files; the 2D scene is light enough on the main thread. |
| GPU rendering | f881 WebGPU render pipeline (conditional); f895 GPU particle fields (conditional) | 0 | 0 | 3 | 0 | 1 | 1 | 2 | 0 | 10 | Rejected | Not built | No demonstrated benefit over 2D canvas; device-loss and support risks. |
| In-browser AI | f032 WebLLM | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 8 | Rejected | Not built | Model downloads break the no-network promise; generated text in official materials is a safety risk. The deterministic starting point covers the need. |
| Peer-to-peer rooms | f042 WebRTC DataChannels | 1 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | 11 | Rejected | Not built | Opens network connections and exposes addresses; collaboration happens through exported files and an organization's own systems. |

25 of 35 candidates were adopted (some with limits), 3 are deferred and 7 were rejected, each with its reason.

## Implementation order (as carried out)

1. **Content for officials and catalysts:** 12 international sources verified (S45–S56); six evidence claims (E34–E39); the two-page brief (document 50) with draft French and Spanish versions (51, 52); the adaptation kit (53); the pathway and ways to help (54); the glossary (55); guides for every view; starting-point rules.
2. **Shell:** route registry, deep links and history, unknown-address recovery, grouped navigation by the six journey stages, essentials and full modes, search, the "About this view" panel, the status bar, drawers on phones, settings.
3. **Storage:** browser database with fallback ladder, copy-in of version 1–3 data without modifying it, quarantine, cross-tab conflict refusal, keep-my-data request, selective reset, check before sharing.
4. **Hosted offline copy:** generated service worker and web app manifest, used only from a secure web address.
5. **Visual layer:** new type scale and tokens, the child survey band hero, the daylight scene with its quality ladder and controls, glass with solid fallbacks.
6. **Verification:** Node and Chromium suites extended (45 and 39 tests), axe-core scans of every view and state, a contrast check of 108 colour pairs, screenshots at desktop and phone widths.

## Directive coverage

| Directive section | What was done | Where | How it was checked | Still open |
| --- | --- | --- | --- | --- |
| §1 Feature Fusion Foundry | Method applied by reading; scored plan; attribution kept | This file; About view; ATTRIBUTIONS.md | Review of rules and catalog | Planner code not run here (environment policy) |
| §2 Visuals | Child survey band hero, daylight scene, glass, serif display type, quality ladder, pause and settle, reduced motion, battery, still and off settings | style.css, atmosphere.js, Discover | Browser tests of controls and reduced motion; screenshots | Frame-time behaviour on real low-end phones not measured |
| §3 Progressive comprehension | Six stages in navigation and on Discover; seven-layer guide per view; essentials mode; glossary | content.json (journey, viewGuides, glossary) | Node tests: every route has every layer | Usability with real officials not tested |
| §4 Regenerative, peace-aligned | "How to read what this kit says" (source fact, projection, program position, illustration); no pressure mechanics; read-aloud version | Discover; About | Content review; prohibited-claims test | — |
| §5 Architecture | Top bar, left tree, right panel, bottom status, drawers, deep links, history, unknown routes, search | index.html, app.js | Browser tests (keyboard, drawers, history, search) | Screen-reader walk-through pending |
| §6 Tools | Deterministic starting point, cost and evaluation tools unchanged, no AI | core.js | Node tests | — |
| §7 Local-first | IndexedDB, fallback ladder, migration, quarantine, conflicts, selective reset, hosted-only service worker, indicators | store.js, app.js, sw.js | Node and browser tests, including offline reload | Firefox and Safari database behaviour from local files not tested |
| §8 Zero Harm | Footer note; no network, telemetry or accounts; check before sharing; settings separate from data; no endorsements | All pages | Network-lock test; package hygiene test | — |
| §9 Quality | axe-core scans, contrast check, phone widths, readable handbook without scripts | source/ | 0 axe violations in tested states; 108 contrast pairs pass | Not a WCAG 2.2 conformance claim; manual checks listed in TEST-REPORT.md |
| §10 Process | Audit, plan, build, verify, report | review/FINDINGS.md, this file | — | — |
| §11 Non-regression | All version 3 data, documents, IDs, registers, backups and workflows kept; v3 tests carried forward | tests | Node 45/45, browser 39/39 | — |
| §12 Experience and attribution | Discover for everyone, read-aloud for children with an adult, evidence for researchers, developer notes, adoption pathway for institutions; Attributions & Licences section | Discover, About | Review | Package licence not chosen (owner decision) |

## Proposals not built, and owner decisions

- **Choose a licence** for the package (for example MIT for code and CC BY 4.0 for documents). Until then, reuse needs the owner's permission.
- **Approve or replace the draft translations** after native-speaker review, and decide which languages come next.
- **Decide on a public home** for the package (if any) and who answers questions. No contact address has been invented.
- **Signed releases:** if wanted, choose a signing key and process.
- **Interface translation packs:** after the documents, translate the interface labels with reviewed language packs.
