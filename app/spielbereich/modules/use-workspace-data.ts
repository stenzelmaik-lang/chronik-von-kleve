"use client";
import type { Entry, Upload } from "@/domain/legacy";
import type { Actor } from "@/domain/types";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";
type Data = {
  entries: Entry[];
  files: Upload[];
  members: Actor[];
  catalog: { available: number; imported: number };
};
const empty: Data = {
  entries: [],
  files: [],
  members: [],
  catalog: { available: 67, imported: 0 },
};
async function fetchSection(section: string): Promise<Data> {
  if (section === "dashboard" || section === "cms" || section === "wuerfel" || section === "inventar")
    return empty;
  if (section === "galerie")
    return { ...empty, files: (await api("/api/files")).files };
  if (section === "verwaltung") {
    const [m, c] = await Promise.all([
      api("/api/members"),
      api("/api/catalog"),
    ]);
    return { ...empty, members: m.members, catalog: c };
  }
  const kind =
    section === "weltkarte"
      ? "schauplaetze"
      : section === "sitzung"
        ? "sitzungen"
        : section;
  return {
    ...empty,
    entries: (await api("/api/records?kind=" + kind)).records,
  };
}
export function useWorkspaceData(section: string, active: boolean) {
  const [version, refresh] = useState(0);
  const [result, setResult] = useState({
    section: "",
    version: -1,
    data: empty,
    error: "",
  });
  useEffect(() => {
    if (!active) return;
    let alive = true;
    fetchSection(section)
      .then((data) => {
        if (alive) setResult({ section, version, data, error: "" });
      })
      .catch((e: Error) => {
        if (alive)
          setResult({ section, version, data: empty, error: e.message });
      });
    return () => {
      alive = false;
    };
  }, [section, version, active]);
  const reload = useCallback(() => refresh((v) => v + 1), []);
  const loading =
    active && (result.section !== section || result.version !== version);
  return {
    ...(loading ? empty : result.data),
    error: loading ? "" : result.error,
    loading,
    reload,
  };
}
