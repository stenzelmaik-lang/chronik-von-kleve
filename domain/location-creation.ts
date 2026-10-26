import type { LocationLevel } from "./location-cms.ts";

type CreationNode = {
  id: string;
  locationId: string;
  parentId: string | null;
  level: LocationLevel;
  title: string;
};

// Resolve existing identities only. Creating a sibling area always targets the
// selected main place, never the currently highlighted area or a new root.
export function locationCreationParent(
  level: LocationLevel,
  nodes: readonly CreationNode[],
  placeId: string,
  selectedId: string,
): CreationNode | null {
  if (level === "location") return null;
  const root = nodes.find(node => node.id === placeId && node.level === "location" && node.locationId === placeId && node.parentId === null);
  if (!root) return null;
  if (level === "area" || level === "information") return root;
  return nodes.find(node => node.id === selectedId && node.level === "area" && node.locationId === root.id) ?? null;
}
