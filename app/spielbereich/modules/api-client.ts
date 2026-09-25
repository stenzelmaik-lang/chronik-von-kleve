"use client";

import type { ApiResult } from "@/domain/legacy";
import { purgeProtectedPlayerData } from "./player-data-cache";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
  if (!r.ok) {
    if ([401, 403, 404].includes(r.status)) purgeProtectedPlayerData();
    throw new ApiError(
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "Bitte erneut versuchen.",
      r.status,
    );
  }
  return data as T;
}
