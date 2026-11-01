# Forge: new features (06.11.2026)

## What's new
1. **AI assistant**: a chat panel in each project that can read the open files and suggest code changes you can apply with one click. Also "Explain error" and "Fix error" buttons appear in the console when a run fails.
2. **Find in files**: search all files in a project, with a list of matches you can click to open; optional replace-all for editors.
3. **Command palette**: press Ctrl/Cmd+K to run, open a file, switch tools (Shell, Developer, Cloud, Settings) or create a file.
4. **Fork and star public projects**: on a shared project page, visitors can star it or fork it into their own account. The dashboard gets an "Explore" section listing popular public projects.

## Out of scope
- Paid AI limits or billing. The AI uses the built-in AI service; heavy use may show a "try again later" message.
- Fixing the older open roadmap items (Shell testing, live co-typing, domain email) is not part of this round.

## Technical details
- AI: server function calling the Lovable AI Gateway (default model), signed-in users only, sends at most ~40 KB of project files; streaming replies; suggested edits returned as whole-file replacements and applied through the existing file save path.
- Find in files: client-side search over loaded `project_files`; replace-all writes through `saveFile` (editors/owners only).
- Command palette: shadcn `Command` dialog in the workspace route.
- Stars/forks: new `project_stars` table (project_id, user_id, unique pair) with grants and RLS (anyone can read stars of public projects; users manage their own); fork reuses `duplicateProject`; `forked_from` nullable column on `projects`.
- Add the four items to `roadmap.md`; build check plus a browser test of each feature signed in.
