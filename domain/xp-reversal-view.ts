/** Receipt reconciliation: an audited correction can reverse a grant without deleting the original. */
export function reversedRewardIds(
  ledger: readonly { id: string; kind: string; amount: number; referenceId?: string }[],
): Set<string> {
  const grants = new Map(ledger.filter(e => e.kind === 'grant').map(e => [e.id, e.amount]));
  return new Set(ledger.filter(e =>
    e.kind === 'correction' && typeof e.referenceId === 'string' &&
    grants.get(e.referenceId) === -e.amount,
  ).map(e => e.referenceId!));
}
