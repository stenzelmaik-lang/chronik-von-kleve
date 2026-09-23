import { z } from "zod";

export const KLEVE_CAMPAIGN_ID = "chronik-von-kleve";
export const visibilitySchema = z.enum(["private", "sl", "group"]);
export type Visibility = z.infer<typeof visibilitySchema>;
export const canonStatusSchema = z.enum([
  "CANON",
  "WORKING",
  "RUMOR",
  "GM_SECRET",
  "PLAYER_KNOWLEDGE",
  "SUPERSEDED",
  "OPEN",
]);
export type CanonStatus = z.infer<typeof canonStatusSchema>;
export const knowledgeStateSchema = z.enum([
  "UNKNOWN",
  "RUMOR",
  "DISCOVERED",
  "OBSERVED",
  "CLAIMED",
  "VERIFIED",
  "DISPROVED",
]);
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;
export const entityTypeSchema = z.enum([
  "CHARACTER",
  "NPC",
  "PLACE",
  "CLUE",
  "HANDOUT",
  "SESSION",
  "SCENE",
  "FACTION",
  "CHRONICLE",
  "RULE",
  "MERCHANT",
  "NOTE",
  "ITEM",
  "LEGACY",
]);
export type EntityType = z.infer<typeof entityTypeSchema>;
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type Campaign = { id: string; name: string; createdAt: string };
export type Membership = {
  id: string;
  campaignId: string;
  email: string;
  name: string;
  status: "pending" | "active" | "blocked";
};
export type Actor = Membership & { gm: boolean };
export type Entity = {
  id: string;
  campaignId: string;
  type: EntityType;
  canonStatus: CanonStatus;
  ownerId: string;
  visibility: Visibility;
  title: string;
  content: JsonObject;
  gmBody?: string;
  legacyRecordId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type KnowledgeGrant = {
  id: string;
  campaignId: string;
  entityId: string;
  audience: "group" | "player";
  // Group is the set of active members of this campaign. No new group UI.
  subjectId: string;
  state: KnowledgeState;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
};
export type Relationship = {
  id: string;
  campaignId: string;
  sourceId: string;
  targetId: string;
  type: string;
  visibility: Visibility;
  createdAt: string;
};
export type WorldEvent = {
  id: string;
  campaignId: string;
  entityId: string | null;
  actorId: string;
  type: string;
  payload: JsonObject;
  createdAt: string;
};
