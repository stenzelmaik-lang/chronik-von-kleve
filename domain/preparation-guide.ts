export const sessionGuideSteps = [
  {id:'basics',label:'Grunddaten',hint:'Gib deinem Spielabend einen Titel und halte kurz fest, was du vorhast. Termine werden separat im Kalender geplant.'},
  {id:'scenes',label:'Szenen planen',hint:'Lege die Abschnitte deines Abends an oder verknüpfe vorhandene Szenen. Jede Szene erhält ihre eigene geführte Vorbereitung.'},
  {id:'notes',label:'SL-Notizen',hint:'Was musst du für den gesamten Abend im Blick behalten? Diese Hinweise bleiben ausschließlich für die Spielleitung.'},
  {id:'review',label:'Prüfen',hint:'Prüfe deinen Ablauf. Du entscheidest, ob die Vorbereitung fertig ist. Speichern startet keine Sitzung und gibt nichts an Spieler frei.'},
] as const;
export const sceneGuideSteps = [
  {id:'narration',label:'Erzählung',hint:'Wie beginnt die Szene? Formuliere den Einstieg und die Informationen, die du später erzählen oder vorlesen möchtest.'},
  {id:'atmosphere',label:'Atmosphäre',hint:'Beschreibe Stimmung, Licht, Geräusche und andere Sinneseindrücke. Hinterlege nur, was du für diese Szene brauchst.'},
  {id:'dialogueNotes',label:'NPCs und Dialoge',hint:'Wähle vorhandene NPCs und notiere ihre Gesprächsangebote, Ziele und möglichen Antworten. Es entstehen keine Kopien ihrer Akten.'},
  {id:'interactions',label:'Interaktionen und Spielmaterial',hint:'Was können die Spieler untersuchen oder auslösen? Bereite Handouts, Hinweise, Medien und weitere Bausteine vor und bringe sie in deine geplante Reihenfolge.'},
  {id:'secrets',label:'Geheimnisse',hint:'Was bleibt zunächst verborgen? Notiere Hintergründe und Voraussetzungen für eine spätere bewusste Freigabe.'},
  {id:'visions',label:'Visionen & persönliche Botschaften',hint:'Bereite Träume, Visionen oder vertrauliche Informationen für ausgewählte Spieler vor. Erst „Privat zustellen“ sendet die Botschaft in ihre persönlichen Postfächer.'},
  {id:'possibleConsequences',label:'Folgen und Proben',hint:'Bereite mögliche Proben, Abzweigungen und Konsequenzen vor. Sie werden hier nur geplant; keine Regel oder Strafe wird automatisch ausgelöst.'},
  {id:'gmNotes',label:'SL-Notizen',hint:'Halte deine privaten Regiehinweise fest. Danach kannst du zur Spielabendplanung zurückkehren und die nächste Szene vorbereiten.'},
] as const;
export type SessionGuideStep = typeof sessionGuideSteps[number]['id'];
export function sessionStep(value:string|null|undefined):SessionGuideStep {
  return sessionGuideSteps.find(step=>step.id===value)?.id || 'basics';
}
export function sceneStep(value:string|null|undefined) {
  return sceneGuideSteps.find(step=>step.id===value)?.id || 'narration';
}
