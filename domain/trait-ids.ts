/** Stable V20 trait IDs (CP-RULES-W10-001, 3.2) mapped onto the keys the existing sheet stores.
 * Leaf module without imports, so sheet validation and the dice engine can share it without cycles. */
/** Spec 3.2 IDs. Values are the keys the current sheet stores in `attributes`. */
export const W10_ATTRIBUTE_KEYS = Object.freeze({
  strength: 'Körperkraft', dexterity: 'Geschick', stamina: 'Widerstandsfähigkeit',
  charisma: 'Charisma', manipulation: 'Manipulation', appearance: 'Erscheinungsbild',
  perception: 'Wahrnehmung', intelligence: 'Intelligenz', wits: 'Geistesschärfe',
} as const);
/** Spec 3.2 IDs. Values are the keys the current sheet stores in `skills`.
 * Sheet labels win over the spec's suggested translations (investigation → "Nachforschungen",
 * law → "Gesetzeskenntnis"); the spec's wording is only a UI alias. */
export const W10_ABILITY_KEYS = Object.freeze({
  alertness: 'Aufmerksamkeit', athletics: 'Sportlichkeit', awareness: 'Magiegespür', brawl: 'Handgemenge',
  empathy: 'Empathie', expression: 'Ausdruck', intimidation: 'Einschüchtern', leadership: 'Führungsqualitäten',
  streetwise: 'Szenekenntnis', subterfuge: 'Ausflüchte',
  animalKen: 'Tierkunde', crafts: 'Handwerk', drive: 'Fahren', etiquette: 'Etikette', firearms: 'Schusswaffen',
  melee: 'Nahkampf', performance: 'Vortrag', larceny: 'Diebstahl', stealth: 'Heimlichkeit', survival: 'Überleben',
  academics: 'Akademisches Wissen', computer: 'Computer', finance: 'Finanzen', investigation: 'Nachforschungen',
  law: 'Gesetzeskenntnis', medicine: 'Medizin', occult: 'Okkultismus', politics: 'Politik',
  science: 'Naturwissenschaften', technology: 'Technologie',
} as const);
