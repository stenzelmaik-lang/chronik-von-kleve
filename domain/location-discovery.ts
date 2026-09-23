import type { DiscoveryState } from "./location-types";

export const discoveryOrder: readonly DiscoveryState[] = ["hidden", "rumored", "known", "visited", "investigated"];
export function validDiscovery(value: unknown): DiscoveryState {
  return discoveryOrder.includes(value as DiscoveryState) ? value as DiscoveryState : "hidden";
}
export function canAdvanceDiscovery(current: unknown, next: DiscoveryState) {
  return discoveryOrder.indexOf(next) >= discoveryOrder.indexOf(validDiscovery(current));
}
export function locationIsSecret(canon: string, content: Record<string, unknown>, attributes: Record<string, unknown>) {
  return canon === "GM_SECRET" || [content, attributes].some(data =>
    data.recoveryOnly === true || data.canonStatus === "GM_SECRET" || data.canon_status === "GM_SECRET");
}
