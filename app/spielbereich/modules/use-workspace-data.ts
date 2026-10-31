"use client";

import type { Entry, Upload } from "@/domain/legacy";
import type { Actor } from "@/domain/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import {
  describeDataError,
  readPlayerData,
  requestPlayerData,
} from "./player-data-cache";

type MemberManagementActor = Actor & { version: number };

type Data = {
  entries: Entry[];
  files: Upload[];
  members: MemberManagementActor[];
  catalog: { available: number; imported: number };
};

const empty: Data = {
  entries: [],
  files: [],
  members: [],
  catalog: { available: 67, imported: 0 },
};

function pathFor(section: string, inspection = false) {
  if (section === "galerie") return "/api/files";
  if (section === "verwaltung") return "/api/members|/api/catalog";
  if (["vorbereitung", "nscs", "dashboard", "cms", "ortscms", "wuerfel", "inventar", "schauplaetze", "weltkarte", "regelwerk", "rueckblick"].includes(section))
    return `empty:${section}`;
  const kind =
    section === "weltkarte"
      ? "schauplaetze"
      : section === "sitzung"
        ? "sitzungen"
        : section;
  return `/api/records?kind=${encodeURIComponent(kind)}${inspection && kind === "charaktere" ? "&view=sl" : ""}`;
}

async function fetchSection(section: string, inspection = false): Promise<Data> {
  if (["vorbereitung", "nscs", "dashboard", "cms", "ortscms", "wuerfel", "inventar", "schauplaetze", "weltkarte", "regelwerk", "rueckblick"].includes(section))
    return empty;
  if (section === "galerie")
    return { ...empty, files: (await api<{ files: Upload[] }>("/api/files")).files };
  if (section === "verwaltung") {
    const [members, catalog] = await Promise.all([
      api<{ members: MemberManagementActor[] }>("/api/members"),
      api<{ available: number; imported: number }>("/api/catalog"),
    ]);
    return { ...empty, members: members.members, catalog };
  }
  const path = pathFor(section, inspection);
  return { ...empty, entries: (await api<{ records: Entry[] }>(path)).records };
}

type Result = {
  key: string;
  hasValue: boolean;
  data: Data;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
};

const initial: Result = {
  key: "",
  hasValue: false,
  data: empty,
  error: null,
  loading: false,
  refreshing: false,
};

export function useWorkspaceData(
  section: string,
  active: boolean,
  scope: string,
  inspection = false,
) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const forceNext = useRef(false);
  const [result, setResult] = useState<Result>(initial);
  const key = pathFor(section, inspection);
  const resultKey = `${scope}\u0000${key}`;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const force = forceNext.current;
    forceNext.current = false;
    const cached = key.startsWith("empty:")
      ? undefined
      : readPlayerData<Data>(scope, key);

    if (key.startsWith("empty:")) return;

    setResult(current => {
      const retainCharacter = section === 'charaktere' && force && current.key === resultKey && current.hasValue;
      return {
      key: resultKey,
      hasValue: cached !== undefined || retainCharacter,
      data: cached?.value ?? (retainCharacter ? current.data : empty),
      error: null,
      loading: cached === undefined && !retainCharacter,
      refreshing: retainCharacter || cached !== undefined && (force || !cached.fresh),
      };
    });

    requestPlayerData(scope, key, () => fetchSection(section, inspection), { force })
      .then((data) => {
        if (alive) setResult({ key: resultKey, hasValue: true, data, error: null, loading: false, refreshing: false });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        const issue = describeDataError(error);
        const permissionFailure = issue.permission;
        setResult({
          key: resultKey,
          hasValue: !permissionFailure && cached !== undefined,
          data: !permissionFailure && cached ? cached.value : empty,
          error: error instanceof Error ? error : new Error(issue.detail),
          loading: false,
          refreshing: false,
        });
      });

    return () => {
      alive = false;
    };
  }, [active, key, refreshVersion, resultKey, scope, section, inspection]);

  const cached = active && !key.startsWith("empty:")
    ? readPlayerData<Data>(scope, key)
    : undefined;
  const matches = result.key === resultKey;
  const isEmptySection = key.startsWith("empty:");
  const hasValue = isEmptySection || (matches ? result.hasValue : cached !== undefined);
  const data = isEmptySection ? empty : matches ? result.data : cached?.value ?? empty;
  const error = isEmptySection ? null : matches ? result.error : null;
  const loading = active && !hasValue;
  const refreshing = matches
    ? result.refreshing
    : cached !== undefined && !cached.fresh;
  const reload = useCallback(() => {
    forceNext.current = true;
    setRefreshVersion((version) => version + 1);
  }, []);

  return { ...data, hasData: hasValue, loading, refreshing, error, reload };
}
