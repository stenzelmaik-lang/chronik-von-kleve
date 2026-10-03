# M1.4 Relations integrity

The existing relationships table already has composite foreign keys from both
endpoints to entities(campaign_id,id). No schema change or migration is needed.
Existing relation rows/types remain untouched. No entities are copied or created.

`/api/relationships`: GET `?entityId=...` (optional `id`), POST JSON
`{sourceId,targetId,type,visibility}`, DELETE JSON `{id}`.
POST supports related_to, appears_in, located_at, part_of; defaults visibility to sl.
Reads and deletes also support existing legacy relation types.
No existing supported self-relation workflow was found. New self-relations are
rejected; existing legacy self-relations are preserved. No direction/cardinality
ontology or duplicate suppression is added.

Existing active campaign SL roles may create/delete. Both endpoints must exist
in the current campaign and pass the existing entity projection. Players can see
group relations only when both endpoints are accessible. Private relations require
ownership of both endpoints because the existing table has no relationship owner.
This conservative interpretation applies only to the new endpoint; existing
specialized relationship readers are unchanged. Secret/missing relationships are
returned as 404 on direct lookup. Existing private/no-store headers are retained.

No production write, legacy import or migration was performed. Creation relies on
the existing foreign keys for integrity if an endpoint is concurrently deleted.
