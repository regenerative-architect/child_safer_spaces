# Browser acceptance checklist for the adopting organization

The v2 browser UI could not be inspected through the automation tool because its URL policy blocked file:// access. Do these checks in the browser/environment your organization will use. Automated tests cover the pure logic separately.

1. Extract the package and open index.html without internet. Confirm all eight navigation views load.
2. Search for a phrase within a document; select a role and verify relevant supporting documents appear.
3. Edit a non-sensitive test draft, switch views, reload and verify it persists. Restore the original using the inline confirmation.
4. Create a temporary planning row, export CSV, edit/re-import using matching headers, and verify the preview and replacement. Reject a wrong-header file without losing existing data.
5. Fill G0 tasks with test evidence and verify G0 remains incomplete without a decision reference. Verify later gates stay unavailable until dependencies are complete. Reopen an earlier task and verify downstream completion resets.
6. Export a backup. Change a draft and import the prior backup; inspect the preview, apply, and verify restoration. Try an invalid file and ensure current work is preserved. Do not use production data for these tests.
7. Run the default financial example and the 25% illustration. Check exported JSON and year-by-year CSV against the visible results. Try missing/negative invalid cost inputs and confirm a clear message.
8. Print one current draft and the working handbook; check table wrapping, page breaks and source links. Compare original static handbook versus current edited text.
9. Open standalone.html separately and confirm no missing assets. Transfer draft work with export/import; do not assume storage is shared between file paths.
10. Check keyboard navigation, labels, zoom and narrow-screen layout. Test with relevant assistive technology before an organizational accessibility claim.

Remove only your temporary test records through the ordinary editor controls or restore a known clean backup. Do not delete actual organizational records as part of testing. Record browser/version, date, result, issue and resolution in the acceptance log.
