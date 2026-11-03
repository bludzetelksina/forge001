# Forge — 13.11.2026 update: "What's new" + new features

## 1. What's new page and popup
- New public page `/changelog` listing every Forge release (date, title, short bullet list), starting with all past updates: 12.09 launch, 15.09 multi-file/teams/packages, 18.09 GitHub/domains/presence, 02.10 bots/PRs/Actions, 06.10 Shell/Developer/Cloud/Settings, 06.11 Assistant/Find/Command palette/Explore, 13.11 this release.
- "What's new" link in the header and dashboard; a small dot shows when there's an unseen release.
- After sign-in, a one-time popup summarises the latest release with a "See all" link (remembered per browser).

## 2. New features in this release
- **Project version history:** automatic snapshots on each Run and every 10 minutes of editing; Settings tab lists them, with preview and "Restore".
- **Code formatting:** "Format file" button and Shift+Alt+F (Prettier for JS/TS/HTML/CSS/JSON; others untouched).
- **Light / dark theme toggle** for the editor and app, saved per user.
- **Keyboard shortcuts sheet** (press `?`) listing all shortcuts, also reachable from the command palette.

## 3. Finish open items from earlier rounds
- Typecheck/build until clean.
- Browser click-through: Files, Packages, Members, Git, Shell, Developer, Cloud, Settings, Assistant, Explore, and the new screens.
- Remove leftover test VM projects created during earlier testing (only the test account's).
- Still open and not part of this round: live letter-by-letter typing, domain contact-form email, private package loading for Python/JS — stay on the roadmap.

## Technical details
- Changelog data in a static `src/lib/changelog.ts` array (no database); last-seen release id in localStorage, read in `useEffect`.
- New table `project_snapshots` (project_id, files jsonb, created_by, created_at) with RLS via existing project-access helper and grants; keep last 30 per project.
- Prettier standalone loaded lazily in the browser.
- Theme via `.dark` class on `<html>` and existing semantic tokens; add light token set in `src/styles.css`.
- Each new route gets its own head() metadata; update `roadmap.md` and `AGENTS.md`.
