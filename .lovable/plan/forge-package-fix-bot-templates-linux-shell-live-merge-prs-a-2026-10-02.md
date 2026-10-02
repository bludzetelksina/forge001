# Forge — package fix, bot templates, Linux shell, live merge, PRs, Actions, domain email, compiled registries

## 1. Fix "Add package" error (confirmed cause)
Adding a package fails with "no unique or exclusion constraint matching the ON CONFLICT specification". The package list has no rule that a name appears once per project, so the "add or update" save has nothing to match on.
- Remove any duplicate package rows (keep the newest), then add a unique rule on project + name.
- The esm.sh note in the Packages panel stays; adding the same name again now updates its version.

## 2. New templates: Discord Bot and Telegram Bot
- Two starter templates (Python and JavaScript variants) on the Templates page.
- Honest limit: the run sandbox has no network and no long-running processes, so bots cannot connect live from Run. The template's console shows a clear note and the code includes a local "simulate a message" mode so logic can be tested. Running the bot for real means pushing to GitHub (feature 5) and deploying elsewhere; the README in each template explains how. The bot token is never stored in project files — templates read it from an environment variable.

## 3. Linux (GNU) shell language
- Add "Linux shell (GNU bash + coreutils)" as a language/template, running scripts through the existing code runner's bash. No interactive terminal — scripts run and print output, same as other languages.

## 4. Character-by-character co-editing
- Replace "last save wins" with real live merging: everyone's keystrokes appear in each other's editors instantly, no overwrites.
- Uses a shared-document approach (Yjs) over the existing live channel, with the merged text saved to the project periodically and on leave. Existing cursors/presence are kept.

## 5. Pull requests and code review (GitHub)
- In the Git tab: push to a new branch and open a pull request with title and description.
- List open pull requests for the linked repo, view changed files as a side-by-side diff, leave comments, approve / request changes, and merge (owner/editor only).

## 6. GitHub Actions
- Git tab "Actions" section: list recent workflow runs with status, view a run's job steps and logs, re-run, and trigger workflows that allow manual runs.
- One-click "Add a starter workflow" that commits a basic CI file for the project's language.

## 7. Email on custom domains (Resend)
- Per verified domain, the owner can connect Resend with their own Resend API key (stored server-side, never shown again).
- Forge shows the DNS records Resend requires and checks them.
- Web projects get a simple contact-form endpoint: forms on the served site send email via the owner's Resend account to an address the owner chooses. Rate-limited per domain is not available as a platform feature; a basic per-hour cap stored in the database is added.

## 8. Private registries for compiled-language sandboxes
- Honest limit: the run sandbox cannot download anything, so private packages cannot be installed at run time for Python, Go, Rust, Java, etc.
- What will be built instead: for Python and Node-based runs, Forge fetches the declared private packages through the registry on its own server before running and inlines pure-source packages into the bundle (works for small, pure-Python / pure-JS packages only). Compiled packages (Go modules, Rust crates, Maven jars) stay unsupported and the console says so. The registry form gains a "type" (npm / PyPI) selector.

## Technical notes
- Migration: dedupe `project_packages`, `ALTER TABLE ... ADD CONSTRAINT project_packages_project_id_name_key UNIQUE (project_id, name)`. New tables `project_doc_state` (Yjs snapshots, RLS via `project_role`), `domain_email` (domain_id, resend key ciphertext, to_address, hourly counter; service_role only); `project_registries.kind` column. GRANTs on every new table.
- Yjs + y-codemirror.next over a Supabase broadcast channel provider; awareness replaces the current presence payload.
- PRs/Actions use the existing per-user GitHub connection (`pulls`, `pulls/{n}/files`, `pulls/{n}/reviews`, `pulls/{n}/merge`, `actions/runs`, `actions/runs/{id}/jobs`, logs, `rerun`, `workflow_dispatch`). The GitHub connection may need the `workflow` scope; users reconnect once.
- Resend is called directly with the owner's key from a public form route under `/api/public/forms/*`, with Zod validation and the hourly cap.
- Registry prefetch happens in `run.functions.ts` before bundling; size cap respected.
- Build, typecheck, linter and a browser click-through at the end, then the pending verification of the previous round's Git/Domains/Packages tabs.

## Out of scope
Live-running bots inside Forge, interactive terminal, installing compiled-language packages in the sandbox, inbound email.
