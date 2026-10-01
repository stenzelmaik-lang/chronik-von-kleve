export type CharacterOption = {
  id: string;
  label: string;
  description: string;
};

// These labels are presentation helpers only. They do not apply automatic
// rule effects; the player can always enter a campaign-specific value.
export const v20Archetypes: readonly CharacterOption[] = [
  { id: "architect", label: "Architekt", description: "Du planst, ordnest und baust langfristig." },
  { id: "avant-garde", label: "Avantgardist", description: "Du suchst neue Ideen und brichst bewusst mit Gewohnheiten." },
  { id: "caregiver", label: "Fürsorger", description: "Du schöpfst Sinn daraus, anderen zu helfen." },
  { id: "conformist", label: "Konformist", description: "Du stellst dich in den Dienst einer Gruppe oder Führung." },
  { id: "director", label: "Direktor", description: "Du übernimmst Verantwortung und bringst Menschen zusammen." },
  { id: "fanatic", label: "Fanatiker", description: "Eine Überzeugung oder ein Ziel bestimmt dein Handeln." },
  { id: "gallant", label: "Galanter", description: "Du suchst Aufmerksamkeit, Wirkung und Anerkennung." },
  { id: "judge", label: "Richter", description: "Du bewertest Entscheidungen und hältst andere an deinen Maßstäben." },
  { id: "lone-wolf", label: "Einzelgänger", description: "Du arbeitest lieber unabhängig als in einer festen Gruppe." },
  { id: "martyr", label: "Märtyrer", description: "Du stellst dich selbst zurück, wenn andere dich brauchen." },
  { id: "monster", label: "Monster", description: "Du hast deine dunkle Seite angenommen und verbirgst sie nicht vor dir selbst." },
  { id: "pedagogue", label: "Pädagoge", description: "Du gewinnst Kraft daraus, Wissen und Erfahrung weiterzugeben." },
  { id: "perfectionist", label: "Perfektionist", description: "Du willst deine Arbeit und dich selbst ständig verbessern." },
  { id: "rebel", label: "Rebell", description: "Du widersetzt dich Regeln, wenn sie deiner Überzeugung widersprechen." },
  { id: "rogue", label: "Schurke", description: "Du setzt auf deine eigenen Fähigkeiten und deinen eigenen Vorteil." },
  { id: "survivor", label: "Überlebenskünstler", description: "Du findest auch unter schlechten Bedingungen einen Weg weiter." },
  { id: "traditionalist", label: "Traditionalist", description: "Du vertraust auf bewährte Regeln, Rituale und Strukturen." },
  { id: "visionary", label: "Visionär", description: "Du siehst Möglichkeiten, die andere noch nicht erkennen." },
];

// Background names are offered as search helpers. Their point values remain
// editable in the existing list editor and are never guessed here.
export const v20Backgrounds: readonly CharacterOption[] = [
  { id: "allies", label: "Verbündete", description: "Menschen, die dir freiwillig helfen können." },
  { id: "contacts", label: "Kontakte", description: "Quellen und Informanten in bestimmten Kreisen." },
  { id: "fame", label: "Ruhm", description: "Bekanntheit in der sterblichen Gesellschaft." },
  { id: "generation", label: "Generation", description: "Deine Stellung in der Blutlinie." },
  { id: "herd", label: "Herde", description: "Ein verlässlicher Zugang zu sterblichem Blut." },
  { id: "influence", label: "Einfluss", description: "Macht, mit der du Entscheidungen in einem Bereich lenken kannst." },
  { id: "mentor", label: "Mentor", description: "Eine erfahrene Person, die dich unterstützt oder anleitet." },
  { id: "resources", label: "Ressourcen", description: "Verfügbares Geld, Besitz und laufende Mittel." },
  { id: "retainers", label: "Diener", description: "Menschen oder Helfer, die dir dauerhaft zugeordnet sind." },
  { id: "status", label: "Status", description: "Anerkannte Stellung innerhalb einer Gemeinschaft." },
];

// The local project does not contain a licensed V20 rulebook cost table. These
// entries are searchable labels only. A cost is never guessed; the SL must
// confirm it before the entry affects the Freebie budget.
export const v20Merits: readonly CharacterOption[] = [
  { id: "acute-sense", label: "Scharfe Sinne", description: "Ein besonders ausgeprägter Sinn." },
  { id: "ambidextrous", label: "Beidhändigkeit", description: "Du kannst beide Hände gleich sicher einsetzen." },
  { id: "common-sense", label: "Gesunder Menschenverstand", description: "Du erkennst naheliegende Risiken im Alltag." },
  { id: "concentration", label: "Konzentration", description: "Du hältst deine Aufmerksamkeit auch unter Druck." },
  { id: "danger-sense", label: "Gefahrensinn", description: "Du bemerkst ungewöhnliche Gefahren oft frühzeitig." },
  { id: "iron-will", label: "Eiserner Wille", description: "Du widerstehst Beeinflussung mit besonderer Entschlossenheit." },
  { id: "language", label: "Zusätzliche Sprache", description: "Du beherrschst eine weitere Sprache." },
];

export const v20Flaws: readonly CharacterOption[] = [
  { id: "addiction", label: "Abhängigkeit", description: "Eine Substanz oder Gewohnheit bindet dich regelmäßig." },
  { id: "dark-secret", label: "Dunkles Geheimnis", description: "Eine belastende Wahrheit darf nicht öffentlich werden." },
  { id: "enemy", label: "Feind", description: "Eine Person oder Gruppe arbeitet aktiv gegen dich." },
  { id: "phobia", label: "Phobie", description: "Eine konkrete Angst schränkt dich in passenden Situationen ein." },
  { id: "short-fuse", label: "Kurze Zündschnur", description: "Provokationen bringen dich ungewöhnlich schnell aus dem Gleichgewicht." },
];
