/** GE-02: the one register of everything that may change a character check's pool or difficulty.
 * The central calculation (deriveW10Preview → resolveC1OrdinaryCheck) may only produce released entries; the live check path
 * refuses any roll whose provenance contains an unreleased or unknown entry. New mechanics (hunger, stress, scene conditions …)
 * are added here first, unreleased, and only take effect after a rules release (Hausregel > V20 > Erschaffung).
 * Pure data and checks: no randomness, no rule arithmetic. */
export type W10ModifierPart='attribute'|'ability'|'specialty'|'wounds'|'difficulty'|'pool';
export type W10ModifierEntry=Readonly<{id:string;part:W10ModifierPart;label:string;released:boolean;basis:string}>;

export const W10_MODIFIER_REGISTER:readonly W10ModifierEntry[]=Object.freeze(([
 {id:'attribute',part:'attribute',label:'Attribut',released:true,basis:'V20: Wert aus dem Charakterbogen'},
 {id:'ability',part:'ability',label:'Fähigkeit',released:true,basis:'V20: Wert aus dem Charakterbogen'},
 {id:'specialty',part:'specialty',label:'Spezialisierung',released:true,basis:'V20: ab Wert 4 zählt eine 10 doppelt'},
 {id:'wound_penalty',part:'wounds',label:'Wundabzug',released:true,basis:'V20: Gesundheitsstufe'},
 {id:'untrained_skill',part:'difficulty',label:'Fertigkeit ohne Wert',released:true,basis:'V20: ungelernte Fertigkeit +1 SG'},
 {id:'personal_stress',part:'difficulty',label:'Persönlicher Stress',released:false,basis:'ChroniPlay-Hausregelentwurf, nicht freigegeben'},
 {id:'group_stress',part:'difficulty',label:'Gruppenstress',released:false,basis:'Hausregel offen'},
 {id:'hunger',part:'pool',label:'Hungerwürfel',released:false,basis:'V5-Mechanik; Entscheidung Blut → Hunger offen'},
 {id:'scene_condition',part:'difficulty',label:'Szenenbedingung',released:false,basis:'Regel offen'},
 {id:'willpower',part:'pool',label:'Willenskraft',released:false,basis:'Vorabansage und Buchung erst mit Phase D'},
 {id:'masquerade',part:'difficulty',label:'Maskerade',released:false,basis:'Maskeradestufe wirkt nicht auf Proben; Regel offen'},
] as W10ModifierEntry[]).map(entry=>Object.freeze(entry)));

/** Trait parts are identified by their part (the id is the trait); modifiers by their own id. */
export function registerKey(p:{part:string;id:string}){return p.part==='attribute'||p.part==='ability'||p.part==='specialty'?p.part:p.id;}
export function registerEntry(p:{part:string;id:string}){return W10_MODIFIER_REGISTER.find(e=>e.id===registerKey(p));}
/** Provenance entries the register does not release (unknown counts as unreleased). Empty means the check may be rolled. */
export function unreleasedModifiers(provenance:readonly {part:string;id:string;label?:string}[]){return provenance.filter(p=>!registerEntry(p)?.released);}
