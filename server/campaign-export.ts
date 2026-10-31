import type { Actor } from "@/domain/types";
// One D1 batch gives a consistent structured snapshot. R2 objects stay separate.
export async function campaignExport(db: D1Database, a: Actor) {
  if (!a.gm || a.status !== "active") throw new Error("GM required");
  const names = [
    "campaigns",
    "entities",
    "relationships",
    "knowledge",
    "world_events",
    "records",
    "files",
    "members",
    "recovery_sources",
    "recovery_records",
    "recovery_conflicts",
    "location_nodes",
    "location_actions",
  ] as const;
  const data = await db.batch(
    names.map((name) =>
      db
        .prepare(
          `SELECT * FROM ${name} WHERE ${name === "campaigns" ? "id" : "campaign_id"}=?` +
            (name === "records" ? " AND (coalesce(json_extract(body,'$.context'),'')<>'sl-message' OR owner_id=? OR json_extract(body,'$.senderId')=?) AND (coalesce(json_extract(body,'$.context'),'')<>'table-material' OR owner_id=?)" : name === "entities" ? " AND NOT EXISTS (SELECT 1 FROM records r WHERE r.campaign_id=entities.campaign_id AND r.id=entities.legacy_record_id AND json_valid(r.body) AND json_extract(r.body,'$.context')='table-material' AND r.owner_id<>?)" : ""),
        )
        .bind(a.campaignId, ...(name === "records" ? [a.id, a.id, a.id] : name === "entities" ? [a.id] : [])),
    ),
  );
  return {
    format: "cvk-campaign-backup",
    formatVersion: 1,
    campaignId: a.campaignId,
    exportedAt: new Date().toISOString(),
    privateMessages: "Nur selbst empfangene oder selbst gesendete Briefe. Die SL-Rolle gewährt keinen Zugriff auf fremde Korrespondenz. Eine vollständige technische Sicherung erfolgt administrativ außerhalb dieses Benutzerexports.",
    ...Object.fromEntries(names.map((name, i) => [name, data[i].results])),
    binaries: {
      included: false,
      storage: "R2",
      instructions:
        "Dateibytes getrennt sichern. files.key ist der unveränderte R2-Objektschlüssel. Dieser JSON-Export enthält keine Binärdateien.",
    },
    encoding:
      "Legacy records.body, entities.content and world_events.payload remain exact JSON strings for lossless recovery.",
  };
}
