export const engagementCategories = ['character', 'notebook', 'codex', 'story', 'other'] as const;
export type EngagementCategory = typeof engagementCategories[number];
export const pulseMs = 30_000;
export const minimumPulseMs = 25_000;
export const maximumPulseMs = 40_000;
const idleMs = 120_000;

export function engagementCategoryForSection(section: string): EngagementCategory | null {
  switch (section) {
    case 'charaktere':
    case 'inventar': return 'character';
    case 'notizen': return 'notebook';
    case 'regelwerk':
    case 'archiv': return 'codex';
    case 'chronik':
    case 'rueckblick':
    case 'schauplaetze':
    case 'weltkarte':
    case 'nscs': return 'story';
    case 'dashboard':
    case 'termine':
    case 'galerie':
    case 'gefallen':
    case 'wirtschaft':
    case 'neuigkeiten':
    case 'haendler': return 'other';
    default: return null;
  }
}

/** In-memory timing only. A discontinuity needs a fresh interaction and ticket. */
export class ActiveEngagement {
  private lastInteraction: number | null = null;
  private lastSent: { steady: number; wall: number } | null = null;

  interact(steady: number, trusted: boolean, wall = steady) {
    if (!trusted) return;
    this.due(steady, wall);
    this.lastInteraction = steady;
  }

  due(steady: number, wall: number): boolean {
    if (this.lastInteraction === null || steady - this.lastInteraction >= idleMs) {
      this.pause();
      return false;
    }
    if (!this.lastSent) return true;
    const elapsed = steady - this.lastSent.steady;
    const wallElapsed = wall - this.lastSent.wall;
    if (elapsed > maximumPulseMs || Math.abs(wallElapsed - elapsed) > 3_000) {
      this.pause();
      return false;
    }
    return elapsed >= pulseMs;
  }

  sent(steady: number, wall: number) {
    this.lastSent = { steady, wall };
  }

  pause() {
    this.lastInteraction = null;
    this.lastSent = null;
  }

  get continuing() {
    return this.lastSent !== null;
  }

  get active() {
    return this.lastInteraction !== null;
  }
}
