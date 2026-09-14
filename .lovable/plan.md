# Forge — finish and verify

Everything from the approved Forge plan is written: landing page, templates, auth, dashboard, workspace, public share page, database, and the code runner. What remains is verification and fixing whatever the last unverified files break.

## Steps

1. **Build and typecheck**
   - Run the build to surface route-tree, import, or typing errors in the last files written (`app.$projectId.tsx`, `p.$slug.tsx`, and the components/lib files).
   - Fix every error until the build is green.

2. **Database check**
   - Re-run the security linter on the backend to confirm the earlier function-permission fix holds and no new warnings exist.

3. **Browser click-through**
   - Landing page renders with correct design.
   - Sign in (test account), dashboard loads, create a project from a template.
   - Workspace: edit a file, confirm autosave, press Run and see real output in the console.
   - Web project: live preview renders.
   - Toggle a project public, open the share link signed out, run the code there.

4. **Fix anything found** in the click-through, then re-verify.

## Technical notes

- No new features, no design changes — this pass is verification and repair only.
- The code runner uses the Paiza guest API via the `runCode` server function; no keys needed.
- Google sign-in works only after you add your own Google OAuth credentials in the backend auth settings; email sign-in works now.
