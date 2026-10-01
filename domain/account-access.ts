import { z } from "zod";

export const profileInput = z.object({
  version: z.number().int().min(1),
  displayName: z.string().trim().min(1).max(80),
  avatarFileId: z.string().min(1).max(100).nullable(),
  preferences: z.object({ reducedMotion: z.boolean(), compactView: z.boolean() }).strict(),
}).strict();
export const passwordInput = z.object({
  version: z.number().int().min(1), currentPassword: z.string().min(1).max(200),
  password: z.string().min(12).max(200), confirmation: z.string().min(12).max(200),
}).strict().refine(v => v.password === v.confirmation, { message: "Die neuen Passwörter stimmen nicht überein." });
export const sessionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), id: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal("revoke_others") }).strict(),
  z.object({ action: z.literal("revoke_all") }).strict(),
]);
export const invitationInput = z.object({
  action: z.literal("invite"), email: z.string().trim().email().max(320),
  campaignId: z.string().min(1).max(100), memberId: z.string().min(1).max(100).nullable(),
  days: z.number().int().min(1).max(7),
}).strict();
export const managementInput = z.union([
  invitationInput,
  z.object({ action: z.literal("revoke"), id: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal("account_status"), userId: z.string().min(1).max(100), version: z.number().int().min(1), status: z.enum(["active", "blocked"]), currentPassword: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal("reset"), userId: z.string().min(1).max(100), currentPassword: z.string().min(1).max(200), approvalReference: z.string().trim().min(16).max(300) }).strict(),
]);
export const acceptInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(80), password: z.string().min(12).max(200),
  confirmation: z.string().min(12).max(200),
}).strict().refine(v => v.password === v.confirmation, { message: "Die Passwörter stimmen nicht überein." });
export const resetInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().min(12).max(200),
  confirmation: z.string().min(12).max(200),
}).strict().refine(v => v.password === v.confirmation, { message: "Die Passwörter stimmen nicht überein." });
export const accessEnvironment = z.enum(["local-test", "closed-alpha-production"]);
export type AccessEnvironment = z.infer<typeof accessEnvironment>;
export function canInvite(role: string, status: string) {
  return status === "active" && ["campaign_owner", "campaign_gm"].includes(role);
}
export const roleLabels: Record<string, string> = { player: "Spieler", campaign_owner: "Kampagnenleitung", campaign_gm: "Spielleitung", campaign_editor: "Redaktion", platform_admin: "Plattformadministration" };
