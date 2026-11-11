export class XpRewardServiceError extends Error {
  status: 400 | 404 | 409 | 413;
  constructor(status: 400 | 404 | 409 | 413, message: string) { super(message); this.name = "XpRewardServiceError"; this.status = status; }
}

// No colon: an ID can never run into the other parts of a derived ledger ID.
const idPart = /^[A-Za-z0-9_-]{1,100}$/;
export const validId = (value: unknown): value is string => typeof value === "string" && idPart.test(value);

export const parseBody = (raw: string): Record<string, unknown> => { try { const body = JSON.parse(raw); return body && typeof body === "object" && !Array.isArray(body) ? body : {}; } catch { return {}; } };
