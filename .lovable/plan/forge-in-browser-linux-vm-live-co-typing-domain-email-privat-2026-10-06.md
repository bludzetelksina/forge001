# Forge — in-browser Linux VM, live co-typing, domain email, private-registry runs, full tab test

## 1. Linux VM project (v86, lightweight Linux)
- New template "Linux VM". Creating it makes a project and opens the workspace, where a virtual machine boots automatically inside the browser tab.
- Runs a small 32-bit Linux in v86 instead of Ubuntu 24.04. v86 can't run 64-bit Ubuntu, and the 4 CPU / 4 GB / 128 GB machine you asked for isn't possible in a browser tab.
- Actual machine: 1 virtual CPU, 512 MB-1 GB memory (the project settings let you choose up to the most v86 allows), and a small disk.
- Boots straight to a shell with user `forge` and password `server123` already set up, with no installer to step through.
- Shows the VM screen and keyboard input, plus buttons to restart and to save or restore the machine's state (saved in the browser).
- Honest limits: slow compared to a real PC, no network access, and changes stay in this browser unless you save a snapshot.
- I'll check this end to end: create the project, open it, and confirm the VM reaches a logged-in `forge` prompt.

## 2. Live typing together, letter by letter
- Everyone's keystrokes appear in each other's editors instantly, without overwriting each other. The current cursors and "Here now" strip stay.
- The merged text is saved to the project automatically.

## 3. Email from custom domains (one shared Resend account)
- You connect one Resend account for all of Forge.
- On a verified domain, the owner turns on email and sees the DNS records Resend needs, with a Check button.
- Web projects served on that domain get a contact-form address. Form submissions are emailed to an address the owner chooses, capped per hour so a form can't be used for spam.

## 4. Private-registry packages for Python and JavaScript runs
- Before a Python or JavaScript run, Forge fetches the declared private packages through the project's registry on its own server and adds them to the run.
- This only works for small packages made purely of Python or JavaScript source. Anything that needs compiling is skipped, and the console says so.
- The registry form gets a type option: npm or PyPI.

## 5. Workspace tools: Shell, Developer, Cloud, Settings
A Tools strip in every project's workspace (like Replit), opening each tool as a panel:
- **Shell** — the in-browser Linux VM terminal (user forge / server123). It boots the first time Shell is opened, in any project, so every project gets a shell. The "Linux VM" template opens with Shell already showing.
- **Developer** — the run console, run history (last 20 runs with output and time), and project environment variables. Variables are passed to runs as program settings; bot tokens go here. They're visible to owners and editors only, never on the public share page.
- **Cloud** — sharing on or off with the public link, custom domains (the current Domains panel moves here), and domain email through Resend.
- **Settings** — project name, language, entry file, VM memory, duplicate, and delete the project (owner only, with a confirmation).
- The existing Files, Packages, Members and Git tabs stay in the left sidebar. Domains moves into Cloud.

## 6. Full browser test
- Test the Git, Cloud (domains), Packages and the four new tools in a real browser, plus the VM reaching the forge prompt, live typing (two browser windows), adding a package, and the bot templates.

## Technical notes
- v86 (npm `v86`) loaded client-only, with its BIOS files and a prebuilt Buildroot/Alpine i386 image downloaded on demand from a CDN (not bundled into the app). Autologin and the `forge` user are baked into the image's init. Memory is set through v86's `memory_size`. State snapshots use `save_state`/`restore_state` in IndexedDB. New language id `vm` with `runner: null`.
- Live typing: Yjs + y-codemirror.next with a small Supabase broadcast provider per file; awareness carries the cursors. The leader client debounces writes back to `project_files`. The postgres_changes "updated by someone else" refresh is turned off for files open in a shared document.
- Resend through the Lovable connector gateway (`standard_connectors--connect` resend). New table `domain_email` (domain_id, enabled, to_address, sent_this_hour, hour_start; owner-only RLS, GRANTs). Public route `/api/public/forms/$domain` validates input with Zod, checks the domain is verified and email is enabled, enforces the hourly cap, then calls POST /emails.
- Registry: new column `project_registries.kind` ('npm' | 'pypi', default 'npm'). In `run.functions.ts`, packages in the registry's scope are fetched (npm tarball, or a PyPI sdist/wheel that contains only `.py` files), unpacked server-side, size-capped, and added to the run's files before bundling.
- Tools: the workspace right-hand panel becomes a tab strip (Console/Preview plus Shell, Developer, Cloud, Settings), and the selected tool is kept in the URL search param `?tool=`. New table `project_env` (project_id, key, value, unique (project_id, key)). It's readable and writable only by owners and editors through `project_role` RLS, with GRANTs to authenticated. `runCode` gets an optional `env` map; for Python, JavaScript, TypeScript, Ruby, PHP and bash, `bundle.ts` adds a small prelude that sets those variables before the entry file runs. Run history reads the existing `runs` table.
- Playwright run with a minted session at the end. Typecheck and build checks too.

## Out of scope
Ubuntu 24.04 / 64-bit guests, multi-core or 4 GB+ VMs, network inside the VM, inbound email, per-owner Resend accounts.
