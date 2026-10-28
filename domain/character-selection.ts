// Existing lifecycle flags used by inventory and live participant projections.
export function activeCharacterBody(body: Record<string, unknown>) {
  return body.archived !== true && body.lifecycleStatus !== 'ARCHIVED' && body.recoveryOnly !== true;
}
