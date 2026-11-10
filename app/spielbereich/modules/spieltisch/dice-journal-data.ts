import type { DiceEvent } from './types';

export function groupDiceRolls(events: readonly DiceEvent[]) {
  const groups = new Map<string, { authorId: string; authorName: string; rolls: DiceEvent[] }>();

  for (const event of [...events].reverse()) {
    const group = groups.get(event.authorId);
    if (group) group.rolls.push(event);
    else groups.set(event.authorId, { authorId: event.authorId, authorName: event.authorName, rolls: [event] });
  }

  return [...groups.values()];
}

export function summarizeDiceRolls(events: readonly DiceEvent[], excluded: ReadonlySet<string>) {
  const summary = { rolls: 0, dice: 0, success: 0, failure: 0, botch: 0, faces: Array<number>(10).fill(0) };

  for (const event of events) {
    if (excluded.has(event.id)) continue;
    summary.rolls++;
    summary[event.result.outcome]++;
    summary.dice += event.roll.dice.length;
    for (const face of event.roll.dice) summary.faces[face - 1]++;
  }

  return summary;
}
