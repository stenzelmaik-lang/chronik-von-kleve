// Recovery describes source claims; it never replaces the campaign CanonStatus.
export const recoveryStatuses = ["CANON", "HISTORICAL_CANON", "WORKING", "OPEN", "RUMOR", "SUPERSEDED", "CONTRADICTION", "UNPLAYED_PREP", "TEST_DATA", "TECHNICAL_ONLY", "GM_REVIEW", "RECOVERY_FUNDUS", "RECOVERY_MECHANICS", "HISTORICAL_TECHNICAL"] as const;
export type RecoveryStatus = typeof recoveryStatuses[number];
export function sourcePointer(value: unknown, pointer: string): unknown {
  if (!pointer) return value;
  if (!pointer.startsWith("/")) throw new Error("Invalid source pointer");
  return pointer.slice(1).split("/").reduce<unknown>((current, key) => {
    const decoded = key.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, decoded)) throw new Error("Source pointer not found");
    return (current as Record<string, unknown>)[decoded];
  }, value);
}
