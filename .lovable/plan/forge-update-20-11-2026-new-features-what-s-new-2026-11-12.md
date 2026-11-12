# Forge update — 20.11.2026: new features + What's new

## 1. What's new entry
- Add a "20 Nov 2026" release at the top of the changelog page listing everything below.
- Signed-in users see the one-time popup for it; the header dot lights up again.

## 2. New features
1. **Split editor** — open two files side by side; drag to resize; close either side.
2. **Project README card** — if a project has README.md, show it rendered on the dashboard card hover and on the public share page.
3. **Run with input** — a "stdin" box in the Developer tool so programs that read input (e.g. `input()` in Python) get it when you press Run.
4. **Project tags and filter** — add tags (e.g. "school", "bot") in Settings; filter the dashboard and Explore list by tag.
5. **Download project as ZIP** — button in Settings and in the command palette.

## 3. Finish open items
- Retry the profiles privacy fix (only you and collaborators can see your name/picture) once the database is reachable.
- Clean build check, then a browser click-through of the new features plus Format, Shortcuts and Version history.
- Still not in this round: live letter-by-letter typing, contact-form email from custom domains, private package loading for Python/JS.

## Out of scope
- Paid plans, new languages, mobile app.

## Technical details
- Changelog: new entry in static `src/lib/changelog.ts` (newest first); bump test.
- Split editor: second CodeMirror instance in the workspace route, state `secondaryPath`.
- README: render with a small markdown renderer (sanitized), read from `project_files`.
- Stdin: pass to the Paiza runner `input` field; store last value per project in localStorage.
- Tags: new `tags text[] default '{}'` column on `projects` (additive), GIN index; filters client-side.
- ZIP: `fflate` in the browser, built from `project_files`.
- Profiles fix: `shares_project_with(uuid)` security-definer helper + replace the `USING (true)` policy.
- Unit tests: stdin passthrough, tag filtering, ZIP file list.
