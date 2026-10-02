"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InventoryProjection } from "@/domain/inventory";
import { api } from "../api-client";
import { describeDataError, invalidatePlayerData, purgeProtectedPlayerData, readPlayerData, requestPlayerData, storePlayerData } from "../player-data-cache";
function key(characterId: string | null) { return "/api/inventory?includeArchived=1" + (characterId ? "&characterId=" + encodeURIComponent(characterId) : ""); }
export function useInventory(dataScope: string, characterId: string | null, onSelectCharacter: (id: string | null) => void) {
  const [data, setData] = useState<InventoryProjection | null>(null), [error, setError] = useState<Error | null>(null), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async (force = false) => {
    const serial = ++sequence.current, query = key(characterId), cached = readPlayerData<InventoryProjection>(dataScope, query);
    setData(cached?.value ?? null); setError(null); setLoading(!cached); setRefreshing(!!cached && (force || !cached.fresh));
    try {
      const next = await requestPlayerData(dataScope, query, () => api<InventoryProjection>(query), { force });
      if (serial !== sequence.current) return;
      setData(next);
      if (next.selectedCharacter && !characterId) { storePlayerData(dataScope, key(next.selectedCharacter.id), next); onSelectCharacter(next.selectedCharacter.id); }
    } catch (e) {
      if (serial !== sequence.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (describeDataError(e).permission) { setData(null); purgeProtectedPlayerData(); }
    } finally { if (serial === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, [dataScope, characterId, onSelectCharacter]);
  const cancel = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    // Hydrate the existing scoped cache, then fetch through its shared request coordinator.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return cancel;
  }, [load, cancel]);
  const refresh = useCallback(async () => { invalidatePlayerData(dataScope, "/api/inventory"); await load(true); }, [dataScope, load]);
  return { data: data && (!characterId || data.selectedCharacter?.id === characterId) ? data : null, error, loading, refreshing, load, refresh };
}
