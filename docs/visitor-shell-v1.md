# Visitor Shell / Startseite V1

Scope: public homepage and reliable return to Home from the existing workspace. No data, auth, location, discovery or recovery changes.

## Architecture

- `app/page.tsx` resolves the existing identity and entry URL on the server.
- `app/visitor/content.ts` owns the public editorial content and approved image references.
- `app/visitor/visitor-shell.tsx` owns the independent Visitor Shell. No workspace sidebar is imported.
- `app/visitor/visitor-shell.module.css` scopes the design foundations to the Visitor Shell, avoiding changes to existing product surfaces.
- Existing WorkspaceShell gains a persistent top-header Home link; the sidebar CVK link remains. Both use native anchors because a live browser check reproduced a failed cross-shell transition with the existing client router. Home performs a full document navigation.

## Design / UX

Charcoal and black surfaces, bone text, blood-red primary buttons, restrained brass details. Georgia display typography and system sans-serif body text avoid external font requests. Fluid heading sizes and containers grow to 1680px; body copy keeps a readable width. Breakpoints: 1080, 820 and 520px. Native details/summary mobile navigation works with keyboard and without client scripting. Focus outlines and reduced-motion overrides are explicit.

Hero uses a CSS crop of the existing `kleve.png` artwork; the original bytes are unchanged. The same original appears in the story section. This is the only featured asset and is PLAYER_SAFE in the existing media audit. UNKNOWN legacy media is not promoted to the homepage. No campaign facts or secret entities are read by this page.

## Validation

12 existing domain tests and 144 isolated-local integration checks passed. Build, ESLint and TypeScript passed. Browser checks cover 2560x1440, 1920x1080, 1366x768, 820x1180 and 390x844: image loading, no horizontal overflow, Home destination, existing login destination, keyboard focus, mobile menu and reduced motion. Screenshots and raw browser results are delivered with the handover.

## Limits

Public teaser copy is editorial and stored in code; no dynamic public-content publishing workflow was added. Visual acceptance belongs to the main chat. Existing data access rules and any pre-existing framework warnings remain outside this scope. Production recovery counts require an authenticated read to verify; no productive writes or migrations are performed by this task.
