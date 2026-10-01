import { creationBudgetSummary, editCreationRating, freebieTotal, validateCharacterDraft, withCreationBaseValues, type CreationBudgetLine } from './character-engine.ts';

// Presentation of the existing engine results. This module defines no rule prices or limits.
export function creationGuidance(campaignId: string, body: Record<string, unknown>) {
  const source = withCreationBaseValues(body);
  const budget = creationBudgetSummary(source);
  if (body.engineVersion!==1) {
    const legacy=validateCharacterDraft(campaignId,body);
    return {budget,groups:[],missing:[],saveable:legacy.ok,draftReason:legacy.ok?'':legacy.error,reviewReady:false,reviewReason:'Bestehender Bogen · keine automatische Übernahme in die Erschaffungsprüfung.'};
  }
  const groups: Array<{ label: string; line: CreationBudgetLine; step: string }> = [
    ...Object.entries(budget.attributes).map(([key, line]) => ({ label: ({physical:'Körperlich',social:'Sozial',mental:'Mental'} as Record<string,string>)[key], line, step:'traits' })),
    ...Object.entries(budget.abilities).map(([key, line]) => ({ label: ({talents:'Talente',skills:'Fertigkeiten',knowledges:'Kenntnisse'} as Record<string,string>)[key], line, step:'traits' })),
    { label:'Clan-Disziplinen', line:budget.disciplines, step:'powers' },
    { label:'Hintergründe', line:budget.backgrounds, step:'powers' },
    { label:'Tugenden', line:budget.virtues, step:'advantages' },
  ];
  const draft = validateCharacterDraft(campaignId, { ...source, characterState:'draft' });
  const review = validateCharacterDraft(campaignId, { ...source, characterState:'review' });
  return { budget, groups, missing:groups.filter(g => g.line.remaining > 0).map(g => ({ label:g.label, remaining:g.line.remaining, step:g.step })), saveable:draft.ok, draftReason:draft.ok?'':draft.error, reviewReady:review.ok, reviewReason:review.ok?'Alle regulären Punkte sind verteilt. Du kannst den gespeicherten Bogen einreichen.':review.error };
}

export function creationRatingQuote(campaignId: string, body: Record<string, unknown>, group: 'attributes'|'skills'|'virtues', name: string, value: number) {
  const source = withCreationBaseValues(body);
  const next = editCreationRating(source, group, name, value);
  return creationChangeQuote(campaignId, source, next);
}

export function creationChangeQuote(campaignId: string, body: Record<string, unknown>, next: Record<string, unknown>) {
  const source=withCreationBaseValues(body);
  const cost = freebieTotal(next) - freebieTotal(source);
  const validation = validateCharacterDraft(campaignId, { ...next, characterState:'draft' });
  const price = cost > 0 ? `${cost} Freebies` : cost < 0 ? `${-cost} Freebies zurück` : 'Reguläre Punkte · keine Freebies';
  return { allowed:validation.ok, cost, label:validation.ok ? price : `${price} · ${validation.error}` };
}

export function xpOptionHint(target: { available:boolean; hint:string; cost:number }, available:number) {
  if (target.hint) return target.hint;
  if (!target.available && target.cost > available) return `${target.cost} XP nötig · ${available} verfügbar · es fehlen ${target.cost - available} XP.`;
  if (!target.available) return 'Diese Steigerung ist im aktuellen Charakterstand gesperrt.';
  return `${target.cost} XP · danach ${available - target.cost} XP verfügbar`;
}
