# Register templates

These 24 CSV files contain headers only. The workspace creates, edits, imports and exports non-sensitive planning rows with the same columns. Fictional example rows are in ../examples and in the workspace ("Show fictional example"); they are never copied into live registers.

## Rules

- Use stable IDs to link hazards, actions and assets. Never reuse an ID.
- Dates: YYYY-MM-DD; date-times with offset, e.g. 2026-11-03T08:40-05:00.
- Blank means unknown, not zero. Keep currency explicit.
- Roles, not names. Internal codes only for workers.
- No personal or sensitive records: children's identities, injury or health details, CCTV, witness details, claim numbers, confidential contracts. Point to the protected record with a reference instead.
- Product thresholds and inspection frequencies need approval before use.
- Import: the header row must match exactly (comma-, semicolon- or tab-separated, UTF-8). At most 500 rows. The workspace previews before replacing and keeps an undo copy.
- Export: every cell is quoted and formula-like text gets a leading apostrophe; the workspace removes that apostrophe again on import.

## Registers

| Register | Columns | Purpose | Related documents |
| --- | --- | --- | --- |
| hazards | 14 | Observable hazards, immediate controls and owners. | 04, 28 |
| actions | 10 | Corrective and planning actions with owners, dependencies and evidence. | 03, 36 |
| jurisdiction | 12 | Each legal, contract, program or proposed requirement with its edition, basis and reviewer. | 06, 33, 34 |
| product_acceptance | 12 | Acceptance criteria for the actual installed system, approved before testing. | 08, 29 |
| inspection | 13 | Scheduled and completed inspections, defects found and reopening verification. | 12 |
| spill_response | 12 | Spill and contamination events with the four response timestamps. | 12 |
| aggregate_outcomes | 16 | Aggregate counts and exposure by site and period — never individual events. | 15, 16, 35 |
| assets | 14 | Installed products, batches, inspection frequency and removal method. | 11, 21 |
| budget | 13 | Cost lines with quotes, approvals and actuals. | 17, 44 |
| stakeholder_feedback | 10 | Themes from adult feedback — no personal details. | 24 |
| training | 10 | Competency demonstrations by role or internal code — never names. | 13, 47 |
| decisions | 10 | Gate, stop, restart and scale decisions with evidence, approver, conditions and dissent. | 14, 25, 48 |
| standards | 11 | Candidate methods, required edition, basis and applicability decision. | 21, 29 |
| change_control | 11 | Proposed changes to products, methods or documents and their review. | 12, 40 |
| evidence | 9 | Claims with category, sources, setting, limits and decision implication. | 32 |
| test_plan | 11 | Planned tests with approved thresholds and their basis. | 29 |
| audit_findings | 11 | Audit findings, containment, root cause and verification. | 40 |
| funding | 11 | Existing and proposed funding — only confirmed awards count in a budget. | 37 |
| consultation | 9 | Questions to authorities and advisors, answers, and whether each is advice or a binding condition. | 07, 42 |
| site_profile | 10 | Non-identifying site facts used for routing. | 28 |
| commissioning | 9 | Commissioning criteria, evidence and release. | 11 |
| publication_claims | 8 | Every public statement with its evidence and approval decision. | 23 |
| handoffs | 11 | Shift, contractor, tenant and role handoffs with acknowledgement. | 22, 47 |
| software_acceptance | 12 | Your organization's own checks of this workspace in its browsers (see source/MANUAL-CHECKS.md). | 26 |
