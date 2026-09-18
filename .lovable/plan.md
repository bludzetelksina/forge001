# Forge — co-editing presence, GitHub, custom domains, private registries

Four additions to the existing workspace. No redesign, no changes to the current run pipeline beyond what each feature needs.

## 1. Live cursors and presence

While two people have the same project open:

- A strip at the top of the editor shows who else is in the project, with a colour per person.
- Each person's coloured caret and name label appears in the editor at their cursor position, and their selection is lightly highlighted.
- The label shows which file each person is currently viewing; carets only render for people in the same file.
- Text itself still syncs the way it does now: whoever saves wins, and other people's open editors refresh when a file changes on the server. If two people type into the same file at once, the later save overwrites — the presence strip is there so people can avoid that.
- Going offline or closing the tab removes the person from the strip within a few seconds.

## 2. GitHub integration (each person connects their own account)

- A Git tab in the project side panel. First use shows a "Connect GitHub" button which sends the person through GitHub's own approval screen; after that their account stays linked to their Forge account.
- Once connected: pick one of their repositories and a branch, then
  - **Import** — pulls the repo's files into the project (text files only, skipping anything oversized or binary, with a summary of what was skipped).
  - **Push** — commits the project's current files to the chosen branch with a message the person types.
  - **Create repo** — makes a new repository from the project.
- The panel shows the linked repo, branch, last sync time, and a plain list of which files will change before a push is confirmed.
- Only the owner and editors can push or import; viewers see the panel read-only.

## 3. Custom domains for web projects

For HTML/CSS/JS projects only (the languages that render in the preview).

- A Domains tab on the project lets the owner add a domain or subdomain they own.
- Forge shows the exact DNS records to add and a "Check" button that verifies live whether the records have propagated, with status: Pending, Verified, Live, or Not pointing here.
- Once verified, requests arriving on that domain are served the project's real files — actual pages, not the preview frame — with correct content types for HTML, CSS, JS, images, and JSON, and the project's entry file as the index.
- Honest limitation up front: for a domain to reach Forge at all, that domain also has to be attached to this Forge app once at the hosting level. Root domains and named subdomains work this way; a wildcard like `*.yourdomain.com` (a subdomain per project, automatically) depends on the hosting allowing a wildcard, which I cannot guarantee. I will build the per-domain flow, and if wildcards turn out to be available we can add automatic subdomains later.
- Domains only serve projects marked public.

## 4. Private package registries

- The Packages tab gains a registry section per project: registry URL, optional scope (e.g. `@acme`), and a token.
- The token is stored server-side and never sent to the browser or shown again after saving — the panel shows only "token saved".
- For web/JS/TS projects, package files are fetched through Forge's server using the stored token, so the preview can load private packages.
- For the compiled and interpreted languages (Python, Go, Rust, Java, etc.) the sandbox that runs code cannot install packages at all — the console will say so in plain words rather than failing silently. That limit already exists today; the registry does not change it.
- Only the owner can add or remove a registry; editors see it exists and can use it.

## Technical notes

- Presence uses a Supabase realtime presence channel per project, tracking `{user_id, display_name, colour, file_path, cursor, selection}`, rendered as a CodeMirror decoration layer plus a remote-cursor extension. No CRDT, no Yjs — that is the "presence only" choice.
- GitHub uses the Lovable App User Connector for GitHub (per-end-user OAuth through the connector gateway). Repo reads/writes go through server functions using the signed-in user's connection key, keyed on their Supabase user id; the Contents and Git Trees APIs handle import, and a tree + commit + ref update handles push.
- New tables: `project_domains` (project_id, hostname unique, verification token, status, timestamps) and `project_registries` (project_id, registry_url, scope, encrypted token, created_by). Both get GRANTs, RLS through the existing `project_role()` helper, owner-only writes, and no anon read of tokens. Domain verification uses a DNS-over-HTTPS lookup from a server function.
- Domain serving is a server route that resolves the incoming `Host` header to a verified `project_domains` row, reads that project's files, and returns them with content types — no session, public projects only.
- Registry proxying is a server function that signs outbound requests with the stored token; the token column is read only by server code, never selected client-side.
- Build, typecheck, database linter, and a browser click-through at the end as usual.

## Out of scope

Character-by-character merge (no operational transform / CRDT), pull requests and code review, GitHub Actions, email on the domain, and private registries for compiled-language sandboxes.
