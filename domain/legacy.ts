import type { Actor, JsonValue, Visibility } from "./types";
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
};
export type Favor = {
  id: string;
  npc: string;
  value: number;
  note: string;
  status: string;
  date: string;
};
export type Initiative = {
  id: string;
  name: string;
  value: number;
  condition: string;
};
export type SessionLog = { id: string; text: string; time: string };
// Explicit compatibility envelope. Unknown legacy fields survive round trips.
export type LegacyBody = {
  [key: string]: unknown;
  text?: string;
  summary?: string;
  image?: string;
  date?: string;
  source?: string;
  clan?: string;
  concept?: string;
  humanity?: number;
  willpower?: number;
  blood?: number;
  xp?: number;
  attributes?: Record<string, number>;
  skills?: Record<string, number>;
  virtues?: Record<string, number>;
  health?: Record<string, boolean | string>;
  geo?: { lat?: number; lon?: number };
  discovered?: boolean;
  content_unlocked?: boolean;
  rules_unlocked?: boolean;
  encounters_unlocked?: boolean;
  transactions?: Transaction[];
  favors?: Favor[];
  initiative?: Initiative[];
  log?: SessionLog[];
};
export type Entry = {
  id?: string;
  campaignId?: string;
  owner_id?: string;
  kind: string;
  title: string;
  visibility: Visibility;
  body: LegacyBody;
  gmBody?: string;
  version?: number;
  updated_at?: string;
  canEdit?: boolean;
};
export type Upload = {
  id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  mime: string;
  size: number;
};
export type LegacyRecordRow = {
  id: string;
  campaign_id: string;
  owner_id: string;
  kind: string;
  visibility: Visibility;
  title: string;
  body: string;
  gm_body: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type FileRow = Upload & {
  campaign_id: string;
  key: string;
  created_at: string;
};
export type ApiResult = {
  records: Entry[];
  files: Upload[];
  members: Actor[];
  available: number;
  imported: number;
  id: string;
  version: number;
};
export type BodyValue = JsonValue | undefined;
