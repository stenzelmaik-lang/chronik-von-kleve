# M1.3 Content blocks

Migration: `0009_m1_content_blocks.sql`. Blocks belong to existing entity IDs via
a campaign-scoped foreign key. Stable block IDs and parent references cannot be
changed. Entity deletion cascades to its blocks. No entity content is rewritten.

API: `/api/content-blocks`.
- GET `?entityId=...` lists blocks; optional `id` selects one block.
- POST JSON `{entityId,kind,content,visibility,position}` creates a block.
- PATCH JSON adds `id` to the complete POST payload; identity remains unchanged.
- DELETE JSON `{entityId,id}` deletes the block.

Content is an opaque string (maximum 90,000 characters), with no HTML renderer.
Visibility is exactly `sl_secret` or `player_visible`, with no default. Position
is a nonnegative integer; ties are deterministically ordered by block ID.
Only active existing campaign owners/GM can write. Read access first requires the
existing entity projection to permit the parent. Player SQL queries select only
`player_visible`, including single-block lookup. A visible block does not grant
access to its parent. No new permission model or automatic knowledge grant exists.
Responses use the existing private/no-store API headers.

Compatibility: deploy the additive migration before using the endpoint. Existing
entity JSON and relationships remain unchanged. Concurrent edits currently use
last-write-wins; no new revision workflow is introduced. Campaign/character-specific
read expansion and editor UI are outside this milestone. No production migration
or legacy import was performed.
