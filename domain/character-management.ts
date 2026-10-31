/** Extensions to the existing character body, never a second character store. */
import { validateSpecialties } from './character-specialties.ts';
import { validateCustomAbilityIds } from './custom-abilities.ts';
export type CharacterBody = Record<string, unknown>;
export type DevelopmentPermission = 'direct' | 'approval' | 'blocked';
export type CharacterPermissions = { editing: boolean; development: DevelopmentPermission };
export function characterFieldEqual(left:unknown,right:unknown):boolean {
  if(left===right)return true;
  if(Array.isArray(left)&&Array.isArray(right))return left.length===right.length&&left.every((value,index)=>characterFieldEqual(value,right[index]));
  if(left&&right&&typeof left==='object'&&typeof right==='object'&&!Array.isArray(left)&&!Array.isArray(right)){
    const a=left as CharacterBody,b=right as CharacterBody;return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&characterFieldEqual(a[key],b[key]));
  }
  return false;
}
export const characterSheetFields = ['player','chronicle','nature','demeanor','concept','clan','generation','sire','attributes','skills','specialties','customAbilities','disciplines','paths','backgrounds','virtues','humanity','humanityPath','willpower','bloodMax','bloodPerRound','merits','flaws','clanWeakness','text','goals','playGuide','inventory','individualInfo'] as const;
export function characterPermissions(body: CharacterBody): CharacterPermissions {
  const saved = body.characterPermissions as Partial<CharacterPermissions> | undefined;
  return { editing: saved?.editing === true, development: ['direct','approval','blocked'].includes(String(saved?.development)) ? saved!.development! : 'direct' };
}
export function characterCanEditSheet(body: CharacterBody, gm: boolean) {
  return gm || characterPermissions(body).editing || (!body.historicalSnapshot && body.engineVersion===1&&body.characterState === 'draft');
}
export function characterSheet(body: CharacterBody) {
  return Object.fromEntries(characterSheetFields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
}
export function validateExistingSheet(body: CharacterBody): string | null {
  for(const key of ['player','chronicle','nature','demeanor','concept','clan','sire','humanityPath','clanWeakness','text','goals','playGuide','individualInfo']) {
    if(body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'string' || (body[key] as string).length > 30000))return `Ungültiges Textfeld: ${key}.`;
  }
  for (const key of ['attributes','skills','virtues']) {
    const value = body[key];
    if (value === undefined) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 100) return `Ungültige Werte: ${key}.`;
    if (Object.entries(value).some(([name,n]) => !name.trim() || name.length > 120 || !Number.isInteger(n) || Number(n) < 0 || Number(n) > 10)) return 'Bogenwerte müssen ganze Zahlen zwischen 0 und 10 sein.';
  }
  for (const key of ['disciplines','paths','backgrounds','customAbilities','merits','flaws']) {
    const value = body[key];
    if (value === undefined || typeof value === 'string') continue; // Historical free text remains intact.
    if (!Array.isArray(value) || value.length > 100 || value.some(row => !row || typeof row !== 'object' || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 120 || !Number.isInteger(row[key === 'merits' || key === 'flaws' ? 'cost' : 'value']) || row[key === 'merits' || key === 'flaws' ? 'cost' : 'value'] < 0 || row[key === 'merits' || key === 'flaws' ? 'cost' : 'value'] > (key === 'merits' || key === 'flaws' ? 999 : 10))) return `Ungültige Einträge: ${key}.`;
  }
  for (const [key, max] of [['humanity',10],['willpower',10],['generation',20],['bloodMax',100],['bloodPerRound',100]] as const) {
    if (body[key] !== undefined && body[key] !== null && (!Number.isInteger(body[key]) || Number(body[key]) < 0 || Number(body[key]) > max)) return `Ungültiger Wert: ${key} (0–${max}).`;
  }
  const customError = validateCustomAbilityIds(body.customAbilities); if (customError) return customError;
  const specialtyError = validateSpecialties(body.specialties, body); if (specialtyError) return specialtyError;
  if (Number(body.willpower) < Number(body.willpowerTemporary ?? 0) || Number(body.bloodMax) < Number(body.blood ?? 0)) return 'Dauerhafte Höchstwerte dürfen nicht unter den aktuellen Ressourcen liegen.';
  return null;
}
export type CharacterXpEntry = { id:string; kind:'grant'|'spend'|'historical'|'correction'; amount:number; reason:string; createdAt:string; referenceId?:string; purchase?:{category:string;target?:string;from:number;to:number} };
export function characterLedger(body: CharacterBody): CharacterXpEntry[] { return Array.isArray(body.xpLedger) ? body.xpLedger as CharacterXpEntry[] : []; }
export function ledgerDelta(entry: CharacterXpEntry) { return entry.kind === 'spend' ? -entry.amount : entry.amount; }
export function characterXpSummary(body: CharacterBody) {
  const ledger = characterLedger(body), history = body.historicalXp as {available:number;earned:number|null;spent:number|null} | undefined;
  const grants = ledger.filter(e => e.kind === 'grant').reduce((n,e) => n + e.amount,0);
  const purchases = ledger.filter(e => e.kind === 'spend').reduce((n,e) => n + e.amount,0);
  const corrections = ledger.filter(e => e.kind === 'correction').reduce((n,e) => n + e.amount,0);
  const tracked = body.engineVersion === 1 || ledger.length > 0;
  return { available: tracked ? ledger.reduce((n,e) => n + ledgerDelta(e),0) : typeof body.xpFree === 'number' ? body.xpFree : null,
    received: history ? history.earned === null ? null : history.earned + grants : body.historicalVerification ? null : tracked ? grants : typeof body.xp === 'number' ? body.xp : null,
    spent: history ? history.spent === null ? null : history.spent + purchases : body.historicalVerification ? null : tracked ? purchases : null,
    historicalEarned: history?.earned ?? null, historicalSpent: history?.spent ?? null, historicalAvailable: history?.available ?? null,
    grants, purchases, corrections, historical: !!history };
}
export function verifyHistoricalCharacter(body:CharacterBody,input:HistoricalXpInput,actorId:string,now=new Date().toISOString()):CharacterBody {
  if(body.engineVersion!==1||body.characterState!=='confirmed'||body.historicalSnapshot||body.creationSnapshot)throw new Error('Nur einen älteren bestätigten Bogen ohne Ursprungssnapshot prüfen.');
  const error=validateExistingSheet(body);if(error)throw new Error(error);
  if(input.earned!==null||input.spent!==null||input.available!==characterXpSummary(body).available)throw new Error('Die Prüfung erhält den bestehenden XP-Verlauf vollständig; keine zweite Eröffnung oder Umdeutung seiner Gesamtsummen.');
  return {...body,characterState:'review',historicalSnapshot:characterSheet(body),historicalVerification:{source:input.source,reason:input.reason,recordedBy:actorId,recordedAt:now,balance:input.available,entries:characterLedger(body).length}};
}
export type HistoricalXpInput = { available:number; earned:number|null; spent:number|null; source:string; reason:string; operationId:string };
export function adoptHistoricalCharacter(body: CharacterBody, input: HistoricalXpInput, actorId: string, now = new Date().toISOString()): CharacterBody {
  if (body.historicalSnapshot || body.historicalXp || characterLedger(body).length || body.characterState === 'confirmed' || body.creationSnapshot) throw new Error('Eine Bestandsübernahme ist nur einmal und ohne bestehende XP-Buchungen oder Bestätigung möglich.');
  const error = validateExistingSheet(body); if (error) throw new Error(error);
  if (!Number.isSafeInteger(input.available) || input.available < 0 || [input.earned,input.spent].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0))) throw new Error('Historische XP müssen nichtnegative ganze Zahlen oder ausdrücklich unbekannt sein.');
  if (input.earned !== null && input.spent !== null && input.earned - input.spent !== input.available) throw new Error('Historische Gesamt-XP minus Verbrauch müssen dem verfügbaren Saldo entsprechen.');
  return {...body, engineVersion:1, characterState:'review', historicalSnapshot:characterSheet(body), historicalXp:{available:input.available,earned:input.earned,spent:input.spent,source:input.source,reason:input.reason,recordedBy:actorId,recordedAt:now}, xpLedger:[{id:input.operationId,kind:'historical',amount:input.available,reason:input.reason,createdAt:now}]};
}
export function appendCharacterXp(body: CharacterBody, entry: CharacterXpEntry): CharacterBody {
  if (characterLedger(body).some(e => e.id === entry.id)) throw new Error('Diese XP-Buchung wurde bereits verarbeitet.');
  if (!Number.isSafeInteger(entry.amount) || (entry.kind !== 'correction' && entry.amount <= 0) || (entry.kind === 'correction' && entry.amount === 0)) throw new Error('Ungültiger XP-Betrag.');
  if (entry.referenceId) {
    const original = characterLedger(body).find(e => e.id === entry.referenceId);
    if (!original || original.kind !== 'grant' || entry.amount !== -original.amount || characterLedger(body).some(e => e.referenceId === original.id)) throw new Error('Nur eine noch nicht korrigierte Gutschrift kann einmal vollständig gegengebucht werden.');
  }
  const next = {...body,xpLedger:[...characterLedger(body),entry]};
  if ((characterXpSummary(next).available ?? -1) < 0) throw new Error('Diese Buchung würde einen negativen XP-Saldo erzeugen.');
  return next;
}
