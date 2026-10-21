# Version 4.0 verification

Checked 19–20 October 2026. Software verification is not safety certification, legal review, site approval or accessibility conformance.

## Software

- 45 automated checks of content and logic, a contrast check of 108 colour pairs, and 39 browser tests in Chromium 141 passed, including axe-core scans of every view, dialog, drawer and transient state in light and dark themes at desktop and phone widths, offline use of a hosted copy, the storage fallback ladder and cross-tab protection. Details and the checks **not** performed are in `TEST-REPORT.md`.
- The workspace was exercised from a local web server, from file:// URLs and as a single file. Firefox, Safari, mobile browsers and assistive technologies were not available here and remain unverified; in particular, whether those browsers allow the browser database for local files is unverified (the workspace falls back and says so).
- Generated files are reproducible from the editable sources (`node source/build.cjs --check`), and `SHA256SUMS.txt` covers every file except itself and the test run logs in `source/test-results/`.

## Content

- Twelve international sources were added and read on 20 October 2026 (S45–S56): WHO falls fact sheet, the WHO/UNICEF World report on child injury prevention (chapter 1, through the NCBI Bookshelf copy; the falls chapter could not be opened), the WHO 2008 news release, the UN Convention on the Rights of Persons with Disabilities (articles 4 and 9), SDG 11, ISO 21542, ISO/IEC Guides 50 and 71 and ISO 7010 (public scope pages only), an ILO statement on the 2022 fundamental principle, the WHO injury surveillance guidelines and WCAG 2.2. Each states its access level and limits; none is used as an approval.
- Every new statement in documents 50–54 that names a treaty, standard, organization's finding or statistic cites its source, and an automated check enforces this. The figures used (684 000 fall deaths a year; nearly 40% of fall DALYs in children; about 24 000 U.S. child shopping-cart injuries a year, 1990–2011) are quoted with their settings and dates.
- The French and Spanish briefs are draft translations that no native speaker has reviewed; they are labelled and tagged as such everywhere.
- No site, product, approval, partner, endorsement, funding award, insurer concession, signature, ethics decision, threshold or effectiveness result has been invented. No contact details, organizations or partnerships were invented or contacted.

## Method

The Feature Fusion Foundry was inspected read-only at commit `f36730493d1c8a8295082bdb731dce6e2e0068ed` (MIT License). Its planning rules and catalog informed `ENHANCEMENT-PLAN.md`; its code was not run and none of it is included.

## Boundaries

Full licensed standards, national laws outside the worked examples, and all state, provincial and local laws were not audited. `LOCAL-DECISIONS.md` lists who must decide what remains. `review/FINDINGS-v4.md` lists every version 4 finding and its status; `review/FINDINGS.md` keeps the version 3 review.
