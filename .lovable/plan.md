# Forge — Multi-file projects, team collaboration, packages

Three additions to the existing workspace: real multi-file projects, inviting people to work on a project together, and a per-project package list.

## 1. Multi-file projects

Today a project stores many files but only the entry file is sent to the runner. This makes every file count.

- **File tree gets full editing**: create file, create folder, rename, duplicate, delete, and drag-free move via rename (e.g. `utils/helpers.py`). Entry file can be changed from the tree.
- **Running a multi-file project**: the run service executes one program, so Forge assembles a self-extracting bundle — a small generated wrapper that recreates every project file on disk inside the sandbox, then compiles/runs the entry file exactly as it would locally.
  - Python, Ruby, PHP, JavaScript, TypeScript, Bash: wrapper written in the same language; imports between files work normally.
  - Go, Rust, Java, C, C++: wrapper writes the sources out and then invokes the compiler/build step before running, so multi-file builds work where the sandbox toolchain allows it. Where a build genuinely can't work, the console says exactly what failed instead of silently running only the entry file.
- **Web projects** already resolve sibling files in the preview; this extends to nested folders and multiple HTML pages, with in-preview links between them.
- Size guard: total bundled source is capped and the console warns before hitting the limit.

## 2. Team collaboration (invite by email, shared editing)

- **Share dialog** on a project gains a Members section: invite by email address, pick **Editor** or **Viewer**, see pending and accepted members, change a role, remove someone.
- An invited person who already has a Forge account sees the project in their dashboard under "Shared with me". Someone without an account gets a pending invite that activates when they sign up with that email.
- **Editors** can edit files, run, and rename the project. **Viewers** can open and run, but not save. Only the owner can delete the project or manage members.
- Changes are saved per file; when another member saves, open collaborators see the file refresh with a small "updated by <name>" note. No live cursors in this version.
- A member list avatar strip appears in the workspace header.

## 3. Package list per project

- A **Packages** panel in the workspace: add a package name (and optional version), remove it, see the list.
- What actually happens per language:
  - **Web / JavaScript / TypeScript**: packages are wired in from a CDN, so `import` of the declared package works in the preview and in JS runs.
  - **Python, Ruby, PHP, Go, Rust, Java, C/C++**: the sandbox has no internet, so Forge attempts the language's standard install step as part of the run and, when it isn't available, the console states clearly that the package can't be installed here and which libraries are preinstalled.
- The panel always tells the truth about what will and won't be available before the user runs.

## Technical notes

- **Database migration**: new `project_members` (project_id, user_id, role, invited_email, status) and `project_packages` (project_id, name, version, created_at). RLS rewritten across `projects`, `project_files`, `runs` so access flows through a `security definer` helper `public.project_role(project_id, user_id)` returning owner/editor/viewer/none — avoids recursive policy evaluation. GRANTs for `authenticated`; `anon` keeps only the existing public-share read path. Pending email invites are claimed by a trigger on new-user creation.
- **Bundling** lives in `src/lib/bundle.ts` (pure, testable: files + language → single source string) and is consumed by the existing `runCode` server function, which keeps its single-provider swap point. Per-language wrapper templates sit beside the existing `LANGUAGES` spec.
- File tree, members, and packages each become their own component under `src/components/`; workspace route wires them into the existing left panel as tabs (Files / Packages / Members).
- Saves stay debounced-autosave; refresh-on-remote-change uses a Supabase realtime subscription on `project_files` for the open project.
- No design-system changes: existing tokens, fonts, and dark lime-on-slate palette throughout.

## Out of scope

Live cursors / character-by-character co-editing, git integration, custom domains for web projects, private package registries.
