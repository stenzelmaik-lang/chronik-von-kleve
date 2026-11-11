/** MVP voting is recognition, not an XP ledger. XP are booked separately by the GM. */
export type MvpBallot = { voterId: string; nomineeId: string; at: string };
export type MvpPoll = {
  version: number;
  status: 'open' | 'closed';
  votes: MvpBallot[];
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  closedBy?: string;
};
export function castMvpVote(
  poll: MvpPoll, voterId: string, nomineeId: string,
  eligibleIds: readonly string[], now: string,
): MvpPoll {
  if (poll.status !== 'open') throw new Error('Die MVP-Abstimmung ist bereits abgeschlossen.');
  if (!eligibleIds.includes(voterId)) throw new Error('Nur tatsächlich teilnehmende Spieler dürfen abstimmen.');
  if (!eligibleIds.includes(nomineeId)) throw new Error('Der nominierte Spieler hat nicht teilgenommen.');
  if (voterId === nomineeId) throw new Error('Eine Selbstwahl ist nicht möglich.');
  const prior = poll.votes.find(vote => vote.voterId === voterId);
  if (prior?.nomineeId === nomineeId) return poll;
  const vote = { voterId, nomineeId, at: now };
  return {
    ...poll, version: poll.version + 1,
    votes: [...poll.votes.filter(row => row.voterId !== voterId), vote],
  };
}
export function closeMvpVote(poll: MvpPoll, actorId: string, now: string): MvpPoll {
  if (poll.status === 'closed') return poll;
  return { ...poll, status: 'closed', version: poll.version + 1, closedAt: now, closedBy: actorId };
}
export function tallyMvpVotes(votes: readonly MvpBallot[]): { nomineeId: string; votes: number }[] {
  const counts = new Map<string,number>();
  for (const vote of votes) counts.set(vote.nomineeId,(counts.get(vote.nomineeId)??0)+1);
  return [...counts].map(([nomineeId,count])=>({nomineeId,votes:count}))
    .sort((a,b)=>b.votes-a.votes || a.nomineeId.localeCompare(b.nomineeId));
}
