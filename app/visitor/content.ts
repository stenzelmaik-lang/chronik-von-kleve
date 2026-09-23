export const visitorContent = {
  title: "Chronik von Kleve",
  system: "Vampire: The Masquerade V20",
  intro:
    "Kleve bei Nacht. Eine gemeinsame Chronik in der Welt von Vampire: The Masquerade – und der Treffpunkt fuer unsere Runde.",
  heroImage: "/images/kleve.png",
  cityImage: "/images/kleve.png",
  sections: [
    {
      label: "Oeffentlicher Einstieg",
      title: "Ein ruhiger Anfang fuer eine dunkle Chronik.",
      text: "Vampire: The Masquerade V20 bildet den Rahmen unserer gemeinsamen Pen-&-Paper-Runde. Hier beginnt der Weg in die Chronik von Kleve.",
    },
    {
      label: "Digitale Chronik",
      title: "Die Spuren einer gemeinsamen Geschichte.",
      text: "Orte, Handouts und Notizen begleiten die Runde im Spielbereich. Was dein Charakter bereits weiss, bleibt dort fuer dich greifbar.",
    },
    {
      label: "Mitspieler",
      title: "Der Spielbereich bleibt ein geschuetzter Raum.",
      text: "Spieler melden sich mit ChatGPT an und erhalten erst nach Freigabe durch die Spielleitung Zugriff auf ihre Bereiche.",
    },
  ],
  previewItems: [
    "Startpunkt fuer Besucher und neue Mitspieler",
    "Zugang zum geschuetzten Spielbereich",
    "Vampire: The Masquerade V20",
  ],
};

export type VisitorContent = typeof visitorContent;
