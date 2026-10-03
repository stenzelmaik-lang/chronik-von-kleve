"use client";
import { useCallback, useEffect, useState } from "react";
import { sections } from "./navigation";
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: unknown;
      annotations: unknown;
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => unknown;
};
export function useNavigation(
  gm: boolean,
  initialSection: string,
  onNavigate: () => void,
  canManageLocations = gm,
) {
  const canOpen = useCallback(
    (id: string) => {
      const item = sections.find((s) => s.id === id);
      return (!!item && (!item.gmOnly || gm) && (!item.cmsAccessOnly || canManageLocations)) || (id === "verwaltung" && gm);
    },
    [gm, canManageLocations],
  );
  const [section, setSection] = useState(() =>
    canOpen(initialSection) ? initialSection : "dashboard",
  );
  const navigate = useCallback(
    (id: string) => {
      if (!canOpen(id)) return;
      setSection(id);
      onNavigate();
      const nextUrl = new URL(window.location.href);
      nextUrl.pathname = window.location.pathname;
      nextUrl.searchParams.set("bereich", id);
      nextUrl.searchParams.delete("ort");
      if (nextUrl.href !== window.location.href) history.pushState(null, "", nextUrl);
    },
    [canOpen, onNavigate],
  );
  useEffect(() => {
    const syncWithHistory = () => {
      const requested = new URLSearchParams(window.location.search).get("bereich") || "dashboard";
      setSection(canOpen(requested) ? requested : "dashboard");
      onNavigate();
    };
    window.addEventListener("popstate", syncWithHistory);
    return () => window.removeEventListener("popstate", syncWithHistory);
  }, [canOpen, onNavigate]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "open_cvk_section",
            title: "Bereich der Chronik öffnen",
            description:
              "Öffnet einen vorhandenen Bereich. Speichert keine Daten.",
            inputSchema: {
              type: "object",
              properties: {
                section: {
                  type: "string",
                  enum: sections
                    .filter((s) => (!s.gmOnly || gm) && (!s.cmsAccessOnly || canManageLocations))
                    .map((s) => s.id),
                },
              },
              required: ["section"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute(input: unknown) {
              const id =
                input && typeof input === "object" && "section" in input
                  ? input.section
                  : undefined;
              if (typeof id !== "string" || !canOpen(id))
                throw new Error("Unbekannter Bereich");
              navigate(id);
              return { section: id, opened: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [navigate, canOpen, gm, canManageLocations]);
  return { section, navigate };
}
