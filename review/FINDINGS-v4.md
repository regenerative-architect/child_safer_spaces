# Findings register — version 4 review (global edition)

Review of version 3.0 against the "Universal next-generation project enhancement directive" and the needs of officials and partners outside the United States and Canada, 20 October 2026, by inspection, the Feature Fusion Foundry's published rules, automated tests and browser tests in Chromium. Ranked by severity. "Resolved" means corrected and verified in this package; "Partially resolved" means the package is corrected but people outside it must finish it; "Unresolved" items cannot be decided or verified here. The same register is in `findings-v4.csv`. The version 3 review is unchanged in `FINDINGS.md`.

| Status | Count |
| --- | --- |
| Resolved | 10 |
| Partially resolved | 2 |
| Unresolved — local decision | 2 |
| Unresolved — not verified here | 2 |

## Register

### V01 · High · Data safety

- **Where:** Saving (app.js, core.persist)
- **Issue:** Two open tabs or windows saved over each other: the last one to save won.
- **Practical consequence:** An official or site lead with the workspace open twice could lose a day's work without any warning.
- **Evidence or rationale:** Code review of v3 against the Foundry's offline dependency rule ("conflict-resolution UI").
- **Correction:** Before the workspace is overwritten, the stored copy is compared with the one this tab loaded; on a difference saving pauses, the tab's copy can be downloaded and the latest version loaded.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: another_tab_is_never_overwritten. Node: storage layer conflict test.

### V02 · High · Usability for officials

- **Where:** Start view, navigation, documents
- **Issue:** The package opened on 49 documents, 24 registers and 35 tasks, with no short front door for officials and no sense of where to begin.
- **Practical consequence:** Officials and partners outside the pilot team could not judge the program in the time they have, so adoption stalls.
- **Evidence or rationale:** Inspection against directive §3 and §12; the Start view listed everything at once.
- **Correction:** Discover page with the six stages; Start here asks up to four questions and gives two to five explained steps; a two-page brief (document 50) with sources; Essentials mode shows 10 of 17 views.
- **Who resolves it:** Program owner, then officials testing it
- **Status:** Partially resolved
- **Verification:** Node: starting-point and route tests. Browser: starting_point_…, essentials_and_full_…. Not tested with real officials.

### V03 · High · Global applicability

- **Where:** Documents 06, 33, 34 and the source register
- **Issue:** Every law and standard was a U.S. or Canadian example, with no method for other countries.
- **Practical consequence:** Copying U.S. or Canadian rules abroad would be legally wrong and could reduce access or worker safety.
- **Evidence or rationale:** Inspection; the source register held no international references.
- **Correction:** Adaptation kit (document 53): eight steps, what stays the same, international reference points with limits (S45–S56), method equivalence, consultation including disabled children's organizations, a pre-mortem and a translation process; other-country answers start there.
- **Who resolves it:** National and local authorities; program owner
- **Status:** Partially resolved
- **Verification:** Content tests (citations, cross-references). Which laws apply remains a local decision.

### V04 · Medium · Storage

- **Where:** Browser storage (v3: localStorage only)
- **Issue:** All planning data lived in localStorage (about 5 MB, synchronous, easily cleared). The directive asks for IndexedDB for structured state.
- **Practical consequence:** Large registers could stop saving; browsers may evict data under storage pressure.
- **Evidence or rationale:** Directive §7; v3 code.
- **Correction:** IndexedDB as the main store with a fallback ladder (localStorage, then memory with export), copy-in of v1–v3 data without changing it, quarantine kept, a keep-my-data request and storage use shown.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: persistence, fallback, blocked, full, quarantine, migration tests. Firefox and Safari from local files not tested.

### V05 · Medium · Offline use

- **Where:** Hosted copies
- **Issue:** A copy published on an intranet or website did not work without a connection.
- **Practical consequence:** Field staff with poor connections lose access when they need it.
- **Evidence or rationale:** Directive §7.
- **Correction:** A generated service worker caches the workspace files (never planning data), only when served from a secure address; the status bar says what applies.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: hosted_copy_works_offline_and_local_copies_register_nothing (Chromium).

### V06 · Medium · Privacy

- **Where:** Export backup
- **Issue:** The personal-data check ran only when a register row or field was saved; a backup with personal details in drafts or task notes could be exported without any warning.
- **Practical consequence:** Personal information could leave the device in a shared backup.
- **Evidence or rationale:** Code review against directive §8.
- **Correction:** Check before sharing: before export, the whole workspace is scanned and the places with personal-looking text are listed (never the text); also available under Your data.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: whole-workspace check. Browser: export_check_warns_before_personal_details_leave.

### V07 · Medium · Comprehension

- **Where:** All views
- **Issue:** No explanation of what each view is for, and technical terms (DCOF, design effect, net present value) without definitions.
- **Practical consequence:** Non-specialists misread tools or give up.
- **Evidence or rationale:** Directive §3.
- **Correction:** "About this view" panel with seven layers for every view, a 32-term glossary (view and document 55), and terms shown where they matter.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: every route has every layer; glossary links resolve. Browser: drawers and panel tests.

### V08 · Medium · Navigation

- **Where:** app.js
- **Issue:** No addresses for views, no back button, no search across documents, workflows, registers and sources.
- **Practical consequence:** People could not share a link to the exact page or find things quickly.
- **Evidence or rationale:** Directive §5.
- **Correction:** Route registry with deep links (for example #/doc/07, #/workflows/W03), browser history, recovery for unknown addresses, and search of the whole workspace (Ctrl K or /).
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: deep_links_history_and_unknown_addresses; search_finds_…

### V09 · Medium · Accessibility (motion)

- **Where:** Discover background scene (new in v4)
- **Issue:** A moving background that starts by itself must be pausable (WCAG 2.2.2) and must respect reduced motion.
- **Practical consequence:** Motion can distract or make some people unwell.
- **Evidence or rationale:** WCAG 2.2 [S56]; directive §2.
- **Correction:** Pause control, a 90-second settle, still image with reduced motion, low battery, hidden page or off-screen, and still/off settings.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: discover_background_scene_can_be_paused_and_respects_reduced_motion.

### V10 · Medium · Licensing

- **Where:** Whole package
- **Issue:** No licence has been chosen for the package.
- **Practical consequence:** Agencies, translators and partners cannot legally reuse, translate or republish it, which blocks spread.
- **Evidence or rationale:** Inspection; no licence file.
- **Correction:** The About view and README state the status and options (for example MIT for code, CC BY 4.0 for documents).
- **Who resolves it:** Program owner
- **Status:** Unresolved — local decision
- **Verification:** —

### V11 · Medium · Translation quality

- **Where:** Documents 51 and 52
- **Issue:** The French and Spanish briefs are draft translations that no native speaker has reviewed.
- **Practical consequence:** Errors in an official brief could mislead decision-makers.
- **Evidence or rationale:** Drafted in this build.
- **Correction:** Labelled as drafts everywhere they appear, tagged with their language, and listed as a local decision.
- **Who resolves it:** Program owner; qualified native-speaker reviewers
- **Status:** Unresolved — local decision
- **Verification:** Node: translation labelling test.

### V12 · Medium · Browser coverage

- **Where:** Whole workspace
- **Issue:** Automated tests ran in Chromium only.
- **Practical consequence:** Firefox, Safari and mobile browsers may treat the database, local files or the service worker differently.
- **Evidence or rationale:** Test environment.
- **Correction:** Fallbacks for every storage step; exact manual checks in TEST-REPORT.md and source/MANUAL-CHECKS.md.
- **Who resolves it:** Adopting organization's IT and accessibility staff
- **Status:** Unresolved — not verified here
- **Verification:** Manual checks listed.

### V13 · Low · Source currency

- **Where:** Source register
- **Issue:** Sources had retrieval dates but no prompt to re-check them.
- **Practical consequence:** Stale citations could stay in proposals unnoticed.
- **Evidence or rationale:** Foundry risk rule "stale or misapplied evidence".
- **Correction:** Each source shows a re-check date one year after retrieval, flagged when due.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: source freshness test. Browser: source view check.

### V14 · Low · Data control

- **Where:** Your data
- **Issue:** Only whole-workspace erase was available.
- **Practical consequence:** Clearing one part (for example drafts) meant losing everything or editing by hand.
- **Evidence or rationale:** Directive §7 (selective reset).
- **Correction:** Reset selected parts, with an undo copy; resetting tasks reopens gates that depended on them.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: selective_reset_clears_only_what_is_ticked_and_can_be_undone.

### V15 · Low · Support

- **Where:** Your data
- **Issue:** IT teams had no summary of browser capabilities or the version in use.
- **Practical consequence:** Support requests were slower and might include screenshots of real data.
- **Evidence or rationale:** Directive §7 (feature indicators).
- **Correction:** Technical details shown in full and downloadable as text, with no planning data.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: technical details exclude site code and drafts.

### V16 · Low · Method

- **Where:** ENHANCEMENT-PLAN.md
- **Issue:** The Feature Fusion Foundry's planner code could not be run in this build environment.
- **Practical consequence:** The ranking was applied by reading the rules, not produced by the tool itself.
- **Evidence or rationale:** The environment's safety policy blocks running code fetched from outside.
- **Correction:** Rules and catalog applied by hand and documented, with steps to reproduce the run in the hosted Foundry.
- **Who resolves it:** Program owner (optional)
- **Status:** Unresolved — not verified here
- **Verification:** Rules reviewed; brief recorded verbatim.

## Defects found while building version 4, and fixed

These were introduced and caught during this build, before release. Each fix was re-tested.

- The skip link (#main) was treated as an unknown page. Found by the keyboard test; in-page anchors are now ignored by the router.
- Navigation switched from Essentials to the full workspace by itself as soon as work was first saved. Found by the injection and gates tests; the default is now chosen once at start-up.
- Erasing the workspace in the database raised a false "changed in another tab" conflict. Found by the erase test; deletes now update the cross-tab record only after the database confirms them.
- Escape in the search box with text typed only cleared the text. Found during the accessibility run; Escape now closes search at once.
- The status bar sat outside the page landmarks (axe "region"). It is now a labelled region.
- With all storage blocked, the status bar kept saying "Checking…" because reading localStorage itself threw. Found by the blocked-storage test; fixed.
- "Erase everything" left the database-in-use marker behind. Found by the erase test; deletes alone no longer write the marker.
- The child-band labels were hidden behind the hero panel at 1440 px. Found in screenshot review; the band now sits clear of the panel.
