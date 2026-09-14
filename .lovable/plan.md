# Forge — Finishing & Launch Plan (14.09.2026)

## Status
Forge is complete and verified: build, typecheck, and database security checks are clean. Landing page, templates, auth, dashboard, workspace (editor, autosave, run), web preview, and public share links all work end to end.

## Remaining steps

### 1. Google sign-in (optional)
Email sign-in works today. Google sign-in is configured on our side but still needs your own Google app credentials (client ID + secret) added in the backend auth settings. If you want it, provide those credentials; otherwise the Google button can be hidden so visitors only see email sign-in.

### 2. Final polish pass (quick check)
- One last look at the landing page on a narrow phone screen to confirm spacing.
- Confirm the 404 page and error boundary behave as designed.

### 3. Publish
Publish the app so it goes live at the public address, then verify the published site loads and sign-in works there.

## Technical details
- No database changes, no new features, no design changes in this plan.
- Publish verification covers: landing page load, email sign-in flow, and opening one shared project link.

## Out of scope (possible future ideas, not in this plan)
- Multiple files per language project beyond the current entry file, team collaboration, and in-editor package installation.
