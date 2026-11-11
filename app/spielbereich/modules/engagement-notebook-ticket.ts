"use client";

let current: { scope: string; ticket: string } | null = null;

export function publishNotebookTicket(scope: string, ticket: string | null) {
  if (ticket) current = { scope, ticket };
  else if (current?.scope === scope) current = null;
}

export function notebookEngagementTicket(scope: string) {
  return current?.scope === scope ? current.ticket : undefined;
}
