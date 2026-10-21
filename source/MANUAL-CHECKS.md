# Acceptance checklist for the adopting organization

Version 4 was tested automatically in Chromium 141 only (see `TEST-REPORT.md`). Before relying on the workspace, run these checks in each browser and device your organization will use, with **test data only**. Record each step in the software-acceptance register (Planning registers → software acceptance): browser and version, device, how it was opened, step, expected and actual result, pass/fail/undetermined, issue and resolution.

1. Extract the whole package and open `index.html` without internet. Discover appears and the yellow "scripts have not loaded" notice is gone. Open every item in the navigation, then switch to the full workspace and open the rest. Repeat with `standalone.html`.
2. The status bar says "Saved in this browser" and "Browser database". If it says "Fallback storage" or "Not stored", note it: your browser does not allow its database for this way of opening the file. Enter a test site code, reload, and confirm it persists.
3. On Start here, answer the four questions and open the first suggested step. Choose a role and open one of its workflows and documents.
4. Press Ctrl K (or Cmd K, or /), search for "cart", open a result, edit a test draft, reload, confirm the draft persists and is labelled; restore the original and use Undo.
5. Open the workspace in a second tab. Change the site code in the first tab, then in the second. The second tab must say the workspace was changed elsewhere and stop saving.
6. In a register, add a test row containing a made-up phone number and confirm the personal-data check asks before saving. Then export a backup and confirm the "Check before you export" message lists where the text is.
7. Download the register CSV, open it in your spreadsheet program, change one cell, save as CSV UTF-8, and import it. Check the preview, apply, then Undo. Try a file with the wrong headers and confirm nothing changes.
8. Mark the G0 tasks done with test evidence, add a decision reference and record G0. Change a task owner (G0 stays complete) and then its evidence (G0 reopens with a message).
9. Export a backup. Change the site code. Import the backup, check the preview, apply, and confirm the code is restored. Try an invalid file and confirm current work is preserved.
10. In Cost scenarios, confirm the default NPV is −23,658.95 units and the 25% case is −2,011.57; try a horizon of 0 and confirm a clear message.
11. Open Settings: choose dark, Largest text, More contrast and Reduce motion. Confirm each applies at once and survives a reload; then Reset settings.
12. On Discover, the background should move gently and offer "Pause the moving background". Press it. With your device's reduced-motion setting on, the scene must be still and the button absent.
13. Print one document, the brief and the working handbook; check page breaks and wide tables.
14. On a phone, open the menu, move through it with a keyboard or switch control if available, and close it with Escape or the menu button. Check there is no sideways scrolling.
15. Use only the keyboard to reach and operate every control in steps 3–12. Zoom to 200% and 400%. Test with the screen readers your staff and public use.
16. If you publish the folder on an HTTPS intranet or website: open it once, then go offline and reload. It should still open. Confirm in your browser's developer tools that no planning data appears in the cache.
17. If you upgraded from version 3 in the same browser, confirm the notice that your work was copied into the browser database, that your drafts are present, and that the version 3 copy is listed under Your data.

When finished, remove the test data with "Your data → Erase this workspace" or by restoring a clean backup. Never delete real organizational records as part of testing.
