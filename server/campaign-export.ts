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
          `SELECT * FROM ${name} WHERE ${name === "campaigns" ? "id" : "campaign_id"}=?`,
        )
        .bind(a.campaignId),
    ),
  );
  return {
    format: "cvk-campaign-backup",
    formatVersion: 1,
    campaignId: a.campaignId,
    exportedAt: new Date().toISOString(),
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
