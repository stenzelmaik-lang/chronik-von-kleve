"use client";

// SL edits made elsewhere become visible within 30 seconds; local writes invalidate the affected endpoint immediately.
export const PLAYER_DATA_TTL_MS = 30_000;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const requests = new Map<string, Promise<unknown>>();
let activeScope: string | null = null;
let scopeEpoch = 0;

function fullKey(scope: string, key: string) {
  return `${scope}\u0000${key}`;
}

export function activatePlayerDataScope(scope: string) {
  if (activeScope === scope) return;
  activeScope = scope;
  scopeEpoch += 1;
  cache.clear();
  requests.clear();
}

export function readPlayerData<T>(scope: string, key: string) {
  if (activeScope !== scope) return undefined;
  const entry = cache.get(fullKey(scope, key));
  if (!entry) return undefined;
  return { value: entry.value as T, fresh: entry.expiresAt > Date.now() };
}

export function storePlayerData<T>(scope: string, key: string, value: T) {
  activatePlayerDataScope(scope);
  cache.set(fullKey(scope, key), {
    value,
    expiresAt: Date.now() + PLAYER_DATA_TTL_MS,
  });
}

export function invalidatePlayerData(scope: string, keyPrefix?: string) {
  if (activeScope !== scope) return;
  scopeEpoch += 1;
  requests.clear();
  const prefix = fullKey(scope, keyPrefix ?? "");
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearPlayerDataScope(scope: string) {
  if (activeScope !== scope) return;
  activeScope = null;
  scopeEpoch += 1;
  cache.clear();
  requests.clear();
}

export function purgeProtectedPlayerData() {
  if (activeScope === null) return;
  activeScope = null;
  scopeEpoch += 1;
  cache.clear();
  requests.clear();
}

function statusOf(error: unknown) {
  return error && typeof error === "object" && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0;
}

export function requestPlayerData<T>(
  scope: string,
  key: string,
  loader: () => Promise<T>,
  options: { force?: boolean } = {},
): Promise<T> {
  activatePlayerDataScope(scope);
  const id = fullKey(scope, key);
  const cached = cache.get(id);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T);
  }
  const inFlight = requests.get(id);
  if (inFlight) return inFlight as Promise<T>;

  const requestEpoch = scopeEpoch;
  const promise = loader()
    .then((value) => {
      if (activeScope === scope && scopeEpoch === requestEpoch) {
        cache.set(id, { value, expiresAt: Date.now() + PLAYER_DATA_TTL_MS });
      }
      return value;
    })
    .catch((error: unknown) => {
      if (activeScope === scope && [401, 403, 404].includes(statusOf(error))) {
        purgeProtectedPlayerData();
      }
      throw error;
    })
    .finally(() => {
      if (requests.get(id) === promise) requests.delete(id);
    });
  requests.set(id, promise);
  return promise;
}

export function describeDataError(error: unknown) {
  const status = statusOf(error);
  const title =
    status === 401
      ? "Deine Anmeldung ist nicht mehr gültig."
      : status === 403
        ? "Du hast für diesen Bereich keine Freigabe."
        : status === 404
          ? "Der angeforderte Eintrag ist nicht verfügbar."
          : "Die Daten konnten nicht abgerufen werden.";
  return {
    title,
    detail:
      error instanceof Error
        ? error.message
        : "Bitte versuche es erneut.",
    permission: status === 401 || status === 403 || status === 404,
  };
}
