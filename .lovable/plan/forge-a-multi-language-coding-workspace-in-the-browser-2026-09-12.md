# Forge — a multi-language coding workspace in the browser

A Replit-style workspace: dark, developer-focused, but with its own identity (deep slate + acid-lime accent, mono display type). You write code in the browser, hit Run, and see real output from a real language runtime.

## One important note on running code

Real terminals and long-running servers can't run inside this app's hosting. Instead, code is executed by a public code-execution service (Piston) that supports 40+ languages including Python, Node, TypeScript, Go, Rust, Java, C++, Ruby and PHP. That means:

- Real output, real errors, real exit codes, program input (stdin) supported.
- One-shot runs (a few seconds each), not an interactive shell — no `pip install`, no background web servers.
- HTML/CSS/JS projects additionally get a genuine live preview pane, rendered instantly in the browser.

If you later want true containers with a shell, that needs an external provider with a paid sandbox API; the app is built so that swapping the execution layer later touches one file.

## What gets built

**Landing page (`/`)**
Hero with a live-typing code panel, the language grid, "how it works", template gallery, footer. Sign in / Start coding calls to action.

**Templates (`/templates`)**
Starter projects per language (Python script, Node CLI, TypeScript, Go, static web app, React-less HTML/CSS/JS site). One click creates a project from a template.

**Dashboard (`/app`)** — signed in
Your projects: name, language, last edited, run count. Create, rename, duplicate, delete.

**Workspace (`/app/$projectId`)** — the IDE
- Left: file tree (create / rename / delete files and folders).
- Center: CodeMirror 6 editor with syntax highlighting per language, tabs, autosave.
- Right: output console (stdout/stderr, exit code, run time) and, for web projects, a live preview iframe.
- Top bar: language picker, Run, stdin input, share toggle.
- Keyboard shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+Enter run.

**Shared project view (`/p/$slug`)** — public, read-only
Anyone with the link sees the files and can run them, but not edit.

**Auth (`/auth`)**
Email + password sign in / sign up, plus Google sign-in.

## Backend

Lovable Cloud is enabled for accounts, saved projects, files and run history.

- `profiles` — display name, avatar, linked to the account.
- `projects` — owner, name, language, template, public flag, share slug, timestamps.
- `project_files` — project, path, content, ordering.
- `runs` — project, language, stdout/stderr, exit code, duration, who ran it.

Row-level security: owners read/write their own projects and files; public projects are readable by anyone via the share slug; run history is owner-only.

## Technical notes

- Routes: `index`, `templates`, `auth`, `_authenticated/app` (dashboard + `$projectId` workspace), `p/$slug`. Each content route gets its own head metadata.
- Editor: `@uiw/react-codemirror` with per-language extensions, loaded client-side only (`ClientOnly` + lazy import) since it touches the DOM.
- Execution: a server function `runCode` proxies to Piston, validating language/version and capping source size, so no key or endpoint is exposed to the browser; run results are written to `runs`. Swapping providers later means editing only this function.
- Web preview: files are assembled into a blob/`srcdoc` iframe with a sandbox attribute — no server round-trip.
- Design tokens (deep slate surfaces, lime accent, editor chrome colors, mono/sans pairing) all defined in `src/styles.css`; no hardcoded colors in components.
- Autosave is debounced and writes only changed files.

## Build order

1. Enable Cloud, create schema, policies and grants.
2. Design tokens + landing page + templates page.
3. Auth pages and route protection.
4. Dashboard: project list and CRUD.
5. Workspace: file tree, editor, tabs, autosave.
6. Run pipeline + console + web live preview.
7. Public share view, run history, polish and metadata.
