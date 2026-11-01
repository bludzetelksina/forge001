# Forge: Shell memory defaults to 1 GB (06.11.2026)

## What changes
- Every project's Shell machine starts with **1 GB memory** by default (was 256 MB).
- Settings > "Shell machine memory" shows 1 GB preselected; 128 MB / 256 MB / 512 MB stay available as lower options.
- People who already picked a size in their browser keep their choice.
- Shell status bar shows "1024 MB · 1 CPU" when the default is used.

## Also in this round (open roadmap items)
- Run a final build check, then a browser test of the Shell tab: boot, sign in as forge / server123, run a command, save and restore the machine state.
- Quick click-through of Developer, Cloud and Settings tabs to confirm they open without errors.

## Technical details
- `src/components/SettingsPanel.tsx`: `vmMemoryFor` fallback 256 -> 1024; SSR fallback also 1024.
- `src/components/ShellPanel.tsx`: `memoryMb` default prop 256 -> 1024.
- `public/v86/vm.html`: `mem` fallback 256 -> 1024 (already capped at 1024).
- Update `roadmap.md` with this item and tick it off once verified.
