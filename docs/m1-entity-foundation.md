# M1.2 Entity foundation

Branch: `codex/m1-kernmodell`; base: `c8c16483a8acaa927f5a669ddcbd7fd0b9b19c33`.

`storyline` extends the existing entity type list. Core status validation uses
`draft | open | confirmed | replaced`. Existing stored status values remain accepted
by the compatibility schema and existing writers. In particular, `GM_SECRET` must
not be mapped to a core status because existing access checks depend on it.
The entity creation API defaults to `draft`; the legacy SQL default remains
`WORKING` to preserve existing trigger/writer behavior. No implicit legacy import
or status backfill is performed.

Migration `0008_m1_entity_foundation.sql` adds nullable `play_state` and
`replaced_by`. The replacement references a stable entity ID, must belong to the
same campaign, cannot reference itself, and prevents deleting the referenced entity.
Visibility and relationships retain their existing behavior. Status and replacement
are independent optional authoring fields; this milestone does not define a workflow
or forbid multi-entity replacement cycles.

Deploy migration before using new API columns. No production migration was run.
The migration uses additive columns, a single-ID foreign key and campaign validation
triggers; the Drizzle schema uses the same single-ID foreign key. Campaign validation
and legacy canon validation triggers are intentionally maintained in migration SQL.

M1.5 adds migration 0010: nullable default_visibility maps the M1 model to
sl_secret/player_visible. NULL retains the exact legacy visibility/knowledge rules.
Omitting defaultVisibility retains legacy behavior, including existing NPC writers.
M1 callers explicitly select sl_secret or player_visible. Explicit
player_visible permits an active campaign member to read the safe projection;
sl_secret overrides knowledge grants. Legacy GM_SECRET protection remains intact.

PATCH /api/entities accepts id, expectedVersion and optional canonStatus, playState,
replacedBy, defaultVisibility. Only existing campaign SL roles can update; stale
versions return 409. Identity, content, legacy data and historical relations remain
unchanged. The integration runner loads all migrations directly from the journal.

Local schema tests use an in-memory SQLite database with migrations 0000–0008.

Raw replacement references are only projected to the GM, since a successor can be
secret. The pnpm lockfile was repaired for the already declared parse5 dependency
that was missing from the main lockfile; no application dependency was added.
