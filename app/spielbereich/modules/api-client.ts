"use client";

import type { ApiResult } from "@/domain/legacy";

export async function api<T = ApiResult>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers:
      body instanceof FormData
        ? {}
        : body
          ? { "Content-Type": "application/json" }
          : {},
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await r
    .json()
    .catch(() => ({ error: "Die Antwort konnte nicht gelesen werden." }));
  if (!r.ok)
    throw new Error(
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "Bitte erneut versuchen.",
    );
  return data as T;
}
