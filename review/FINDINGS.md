# Findings register — Child-Safer Spaces version 2 review

Review of the version 2 package (19 October 2026) by inspection, primary-source checks on 19–20 October 2026, automated tests and browser tests in Chromium. Ranked by severity. "Resolved" means corrected and verified in this package; "Partially resolved" means the package is corrected but a local professional, organization or further testing must finish it; "Unresolved" items cannot be decided here. The same register is in `findings.csv`.

| Status | Count |
| --- | --- |
| Resolved | 15 |
| Partially resolved | 9 |
| Unresolved — local decision | 5 |
| Unresolved — evidence needed | 2 |
| Unresolved — not verified here | 1 |

## Register

### F01 · Critical · Software reliability

- **Where:** app.js start-up (v2)
- **Issue:** Saved planning data that failed validation was silently replaced by a blank state on the first edit.
- **Practical consequence:** Loss of all drafts, tasks and registers without warning (for example after a partial write or a version mismatch).
- **Evidence or rationale:** Reproduced in Chromium: a stored draft was destroyed after one keystroke.
- **Correction:** Quarantine: untouched recovery copy, saving paused, download offered, explicit "start new workspace"; v3 writes a new key and never modifies v1/v2 keys.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: storage quarantine tests. Browser: unreadable_saved_data_is_quarantined_not_overwritten.

### F02 · High · Software reliability

- **Where:** app.js imports and removals
- **Issue:** Backup import, CSV replacement, row removal and draft restore replaced data with no snapshot or undo.
- **Practical consequence:** One mistaken click erased work unless a backup had been exported.
- **Evidence or rationale:** Code review of v2.
- **Correction:** Preview before every replacement plus a single-level undo copy that survives reload.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: backup_import_validates_previews_applies_and_undoes; csv_import_…_and_undo; gates amend undo.

### F03 · High · Software / content

- **Where:** Drafts vs corrected originals
- **Issue:** Local drafts always overrode the original text, so users with v2 drafts would never see v3 corrections.
- **Practical consequence:** Safety-relevant corrections (access limits, cart routing, fire routing) invisible to existing users.
- **Evidence or rationale:** Code review; all 48 original documents were revised in v3.
- **Correction:** Base-version tracking; unedited v2 drafts dropped; real drafts flagged "original updated — review" with line comparison, keep or replace.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: version 2 migration. Browser: version2_browser_data_migrates_…_flagged.

### F04 · High · Software / governance

- **Where:** Decision gates
- **Issue:** Editing a task owner or date, or typing in a decision note, silently reopened that gate and every later gate.
- **Practical consequence:** Gate records lost without notice; alert fatigue; users stop trusting the tracker.
- **Evidence or rationale:** Reproduced: an owner edit reopened G0.
- **Correction:** Only status/evidence changes reopen; completed decisions are amended explicitly with the affected gates listed; reopen events logged and announced; undo.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: gate tests. Browser: gates_reopen_only_for_disposition_changes_…

### F05 · High · Evidence / scope

- **Where:** Documents 02, 04, 27
- **Issue:** Shopping-cart falls, fixture tip-over and falling merchandise were excluded as "separate controls" with no owner or controls.
- **Practical consequence:** The best-documented child injury mechanism in U.S. stores would go unmanaged; floor work could be mistaken for addressing it.
- **Evidence or rationale:** S32: 82% of cart injuries to children under five were falls from carts, 84% head/face; S31: ~24,000 ED visits a year (children under 15).
- **Correction:** Mechanism routing table, cart and stability controls, task T35, survey and job-aid steps, cart events in the data dictionary.
- **Who resolves it:** Framework resolved; each site must assign owners (T35)
- **Status:** Partially resolved
- **Verification:** Content review; Node inventory test checks T35 in G1.

### F06 · High · Accessibility

- **Where:** Documents 06, 08, 11, 12, 30
- **Issue:** Access limits that padding, mats and guards commonly breach (carpet/cushion, changes in level, protrusions, clear width, upkeep during closures) were not stated; guidance was cited instead of the standards.
- **Practical consequence:** A product could pass procurement yet create access barriers or narrow routes.
- **Evidence or rationale:** S28 (§§302, 303, 307, 403.5.1), S29 (28 CFR 36.211), S14, S43 read on 2026-10-20.
- **Correction:** Requirements added with citations; checked in the specification, mock-up and commissioning; isolation includes assistance and notices.
- **Who resolves it:** Documents resolved; applicability per site needs an accessibility professional
- **Status:** Partially resolved
- **Verification:** Content review; source register entries.

### F07 · High · Fire / standards accuracy

- **Where:** S11; documents 21, 29, 31
- **Issue:** S11 cited an ASTM work-item page that does not identify E648; fixture padding had no fire routing beyond a floor-covering test.
- **Practical consequence:** Wrong citation; fire review could rely on a floor report for padding fixed to fixtures.
- **Evidence or rationale:** Retrieval of WK95872 shows no designation; E648-25a scope: corridors and exitways, not a fire-hazard assessment by itself.
- **Correction:** S11 corrected to E648-25a; separate questions for floor, fixture and freestanding elements; carpet/rug tests scoped.
- **Who resolves it:** Citation resolved; classification needs the code official
- **Status:** Partially resolved
- **Verification:** Source register; content review.

### F08 · High · Operations / governance

- **Where:** Documents 03, 07, 11–15, 22, 25, 28, 36, 48
- **Issue:** Workflows lacked consistent trigger, prerequisites, decision authority, acceptance and escalation; who may stop, withdraw, restart or scale was split across four documents.
- **Practical consequence:** Ambiguity at the moments of highest risk.
- **Evidence or rationale:** Inspection.
- **Correction:** 16 workflow cards and a 12-row decision-rights matrix (document 49 and Workflows view); tasks labelled can-begin-now / needs review / needs signature; role entry points.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: workflows-specify-all-fields test.

### F09 · Medium · Evidence quality

- **Where:** All documents; SOURCES.md
- **Issue:** Citations were document-level; sources lacked jurisdiction, edition, retrieval date and access level; two were read only through search extracts.
- **Practical consequence:** Readers could not verify specific legal or technical claims.
- **Evidence or rationale:** Inspection.
- **Correction:** 44 structured sources; claim-level [S#] citations; S17 and S18 retrieved directly; per-document cited-source lists.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node: citations resolve; documents naming a law or standard must cite.

### F10 · Medium · Economics

- **Where:** Documents 17, 44; calculator
- **Issue:** Zero initial cost reported "recovered in year 0" while cash was negative; no input ranges; no early-withdrawal case; other savings could absorb assumed premium cuts.
- **Practical consequence:** Misleading recovery claims and overconfident economics.
- **Evidence or rationale:** Reproduced in v2 core.
- **Correction:** Corrected recovery semantics; low/high ranges with combinations; withdrawal and removal cost; documented basis required for other savings; premium changes excluded.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node finance tests; browser cost_scenarios test.

### F11 · Medium · Pilot design

- **Where:** Documents 15, 35
- **Issue:** The 90-day pilot was labelled feasibility-only, but users had no way to see the exposure an effectiveness claim needs.
- **Practical consequence:** Over-claiming from small counts.
- **Evidence or rationale:** Planning arithmetic: ~355 comparison events (~17.7 million entries per group) to detect a 20% reduction at 2 per 100,000.
- **Correction:** Evaluation planning view and worked text; zero-event and observed-event upper bounds.
- **Who resolves it:** Package resolved; an independent statistician must design any study
- **Status:** Partially resolved
- **Verification:** Node evaluation tests; browser evaluation test.

### F12 · Medium · Privacy

- **Where:** Registers, tasks, gates, documents
- **Issue:** The "non-sensitive only" boundary was advisory; nothing caught contact details, ages, injuries or claim numbers typed into registers.
- **Practical consequence:** Identifiable child and incident data could accumulate in an unprotected browser store and in exports.
- **Evidence or rationale:** Inspection.
- **Correction:** Pattern check with confirm-before-save in registers; inline warnings elsewhere; import scan; job-aid scenario F.
- **Who resolves it:** Resolved here; cannot detect every name
- **Status:** Partially resolved
- **Verification:** Node personal-data tests; browser personal_data_check_asks_before_saving.

### F13 · Medium · Accessibility (software)

- **Where:** app.js, style.css
- **Issue:** No focus move on view change, no aria-current, static page title, 2.56:1 focus ring on the sidebar, unreadable hover states on the active item and primary buttons, duplicate table landmarks, result tables not keyboard-scrollable.
- **Practical consequence:** Keyboard and screen-reader users lose context; contrast failures.
- **Evidence or rationale:** Contrast computation, screenshots and axe-core scans.
- **Correction:** All fixed; axe reports no violations in the tested states.
- **Who resolves it:** Resolved for tested states; assistive-technology testing remains
- **Status:** Partially resolved
- **Verification:** Browser: keyboard test; two axe scans.

### F14 · Medium · Software security

- **Where:** CSV export/import
- **Issue:** Leading tab/CR and full-width formula characters were not neutralized; apostrophes accumulated on re-import; semicolon files (common from French-locale spreadsheets) were rejected unclearly.
- **Practical consequence:** Spreadsheet formula injection risk; silent data drift; Canadian users blocked.
- **Evidence or rationale:** Reproduced.
- **Correction:** Expanded neutralization, lossless round trip, delimiter detection, row-numbered errors.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node CSV tests; browser CSV test.

### F15 · Medium · Software reliability

- **Where:** Storage status
- **Issue:** Storage failures appeared only in a transient status line; no page-close warning; status announced on every keystroke.
- **Practical consequence:** People close the page believing their work is saved.
- **Evidence or rationale:** Reproduced (no unload guard).
- **Correction:** Persistent indicator and banner, page-close warning while unsaved, debounced saving.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Browser: full_storage_warns_and_guards_page_close; blocked_storage_still_works_and_exports.

### F16 · Medium · Printing

- **Where:** app.js print
- **Issue:** Print clean-up ran straight after window.print(), which fails where printing is asynchronous.
- **Practical consequence:** Blank or wrong printouts on some browsers.
- **Evidence or rationale:** Code review.
- **Correction:** Clean-up on afterprint.
- **Who resolves it:** Resolved; verified in Chromium only
- **Status:** Partially resolved
- **Verification:** Browser print test.

### F17 · Medium · Evidence transferability

- **Where:** Document 04; evidence ledger
- **Issue:** Transfer to children in retail was not assessed per claim; the FLIP falls estimate (rate ratio 1.21) and "harms not assessed" were omitted; worker-effort evidence for soft floors was missing.
- **Practical consequence:** Cushioning could look neutral-to-helpful when evidence is indirect and includes a harm signal.
- **Evidence or rationale:** S8, S35.
- **Correction:** Transferability table; ledger fields for setting, transfer, basis and limits.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Content review.

### F18 · Low · Operations

- **Where:** Document 28
- **Issue:** "Inspect lower fixture contact zones" gave no survey height.
- **Practical consequence:** Inconsistent hazard walks.
- **Evidence or rationale:** S37 (WHO height-for-age).
- **Correction:** 0–120 cm program band for ages two to five, labelled as a program default, raised for older children.
- **Who resolves it:** Resolved here; adjust locally
- **Status:** Resolved
- **Verification:** Content review.

### F19 · Low · Evaluation

- **Where:** Document 15
- **Issue:** Proposed 95% operational targets could be read as standard-derived.
- **Practical consequence:** Misplaced authority.
- **Evidence or rationale:** Inspection.
- **Correction:** Labelled as program proposals not drawn from any standard.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Content review.

### F20 · Low · Migration

- **Where:** Version 1 import
- **Issue:** A v1 backup containing a retired gate was rejected entirely.
- **Practical consequence:** Users locked out of their v1 drafts.
- **Evidence or rationale:** Reproduced with the v2 importer.
- **Correction:** Notes for retired gates kept in the planning log.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node and browser v1 migration tests.

### F21 · Low · Security / privacy

- **Where:** All pages
- **Issue:** No content-security policy; offline behaviour only asserted.
- **Practical consequence:** Defence-in-depth gap.
- **Evidence or rationale:** Inspection.
- **Correction:** CSP on every page (hash-based for inline scripts); network test.
- **Who resolves it:** Resolved; verified in Chromium only
- **Status:** Partially resolved
- **Verification:** Browser: network_is_locked; Node CSP hash tests.

### F22 · Low · Usability

- **Where:** Registers
- **Issue:** No column guidance or examples; procedures required a handoff log and an acceptance log that did not exist.
- **Practical consequence:** Inconsistent records.
- **Evidence or rationale:** Inspection.
- **Correction:** Purpose and column hints, a fictional example per register, new handoffs and software-acceptance registers.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node example tests.

### F23 · Low · Requirements

- **Where:** Footer
- **Issue:** The Zero Harm & Anti-Coercion note was missing.
- **Practical consequence:** Owner requirement unmet.
- **Evidence or rationale:** Inspection.
- **Correction:** Added to every page and export.
- **Who resolves it:** Resolved in this package
- **Status:** Resolved
- **Verification:** Node page test.

### F24 · Info · Verification

- **Where:** VERIFICATION.md (v2)
- **Issue:** The v2 interface was never browser-tested.
- **Practical consequence:** Unknown defects (several found above).
- **Evidence or rationale:** v2 VERIFICATION.md.
- **Correction:** 25 browser tests in Chromium 141.
- **Who resolves it:** Chromium resolved; other browsers remain
- **Status:** Partially resolved
- **Verification:** TEST-REPORT.md.

### U01 · High · Jurisdiction

- **Where:** G2
- **Issue:** Adopted building, fire and accessibility codes, amendments and permit pathway for an actual site.
- **Practical consequence:** Work could be unlawful or need removal.
- **Evidence or rationale:** S6, S17, S18.
- **Correction:** Kept as an explicit gate.
- **Who resolves it:** Code professional; authority having jurisdiction
- **Status:** Unresolved — local decision
- **Verification:** Gate G2 blocks procurement.

### U02 · High · Fire

- **Where:** G2/G3
- **Issue:** Fire classification of padding fixed to walls or fixtures and of freestanding padded items.
- **Practical consequence:** Combustible additions in circulation routes.
- **Evidence or rationale:** S11.
- **Correction:** Question set in documents 06 and 31.
- **Who resolves it:** Code professional; fire official
- **Status:** Unresolved — local decision
- **Verification:** G3 mandatory criterion.

### U03 · High · Product acceptance

- **Where:** G3
- **Issue:** Thresholds and methods for traction, rolling load, attachment and cleaning of the actual installed system.
- **Practical consequence:** No universal pass values exist.
- **Evidence or rationale:** S10, S25, S39, S40.
- **Correction:** Must be set before testing.
- **Who resolves it:** Competent specialists; independent laboratory
- **Status:** Unresolved — local decision
- **Verification:** G3.

### U04 · High · Evidence

- **Where:** Program
- **Issue:** Effectiveness of edge guards, fixture redesign and cushioning for children in retail.
- **Practical consequence:** No injury-reduction claim is possible.
- **Evidence or rationale:** E22: no controlled retail study found (targeted search).
- **Correction:** Commissioned review protocol (document 32); evaluation planning.
- **Who resolves it:** Independent evaluator; systematic review team
- **Status:** Unresolved — evidence needed
- **Verification:** Document 32.

### U05 · Medium · Privacy and ethics

- **Where:** G1
- **Issue:** Privacy determination and research-ethics determination for any study, participant testing or secondary data use.
- **Practical consequence:** Unlawful collection or unreviewed research.
- **Evidence or rationale:** S13, S21, S22, S41, S42.
- **Correction:** Gate tasks T07; document 43.
- **Who resolves it:** Privacy officer; REB/IRB
- **Status:** Unresolved — local decision
- **Verification:** G1.

### U06 · Medium · Software

- **Where:** Workspace
- **Issue:** Behaviour in Firefox, Safari, Edge, mobile browsers and with screen readers; Windows High Contrast; 200–400% zoom; real printers.
- **Practical consequence:** Undetected defects in your environment.
- **Evidence or rationale:** Only Chromium 141 was available here.
- **Correction:** Manual steps in TEST-REPORT.md and source/MANUAL-CHECKS.md; software-acceptance register.
- **Who resolves it:** Your IT and accessibility staff
- **Status:** Unresolved — not verified here
- **Verification:** TEST-REPORT.md.

### U07 · Low · Sources not fully audited

- **Where:** S4, S43, S34, licensed standards
- **Issue:** Food Code Chapter 6 text, the Ontario regulation text, the primary 2006 cart-restraint article and full licensed standards were not read.
- **Practical consequence:** Detail could differ from summaries.
- **Evidence or rationale:** Retrieval limits recorded per source.
- **Correction:** Access level stated in SOURCES.md.
- **Who resolves it:** Health authority; local counsel; evaluation lead; licensed copies
- **Status:** Unresolved — evidence needed
- **Verification:** SOURCES.md access fields.

### U08 · Low · Insurance and tax

- **Where:** G2/G6; budget
- **Issue:** Policy-specific notice, conditions, any premium recognition; eligibility for any accessibility tax benefit.
- **Practical consequence:** Assumed savings would be unsupported.
- **Evidence or rationale:** S9, S23.
- **Correction:** Excluded from models until confirmed in writing.
- **Who resolves it:** Insurer; tax adviser
- **Status:** Unresolved — local decision
- **Verification:** Calculator rule; document 37.

