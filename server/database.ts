import { env } from "cloudflare:workers";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function database() {
  if (!env.DB) {
    throw new HttpError(503, "Die Datenbank ist gerade nicht erreichbar. Bitte versuche es erneut.");
  }
  return env.DB;
}