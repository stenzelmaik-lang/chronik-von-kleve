import Link from 'next/link';
import { engagementPrivacyContact } from '@/server/engagement-config';

export const dynamic = 'force-dynamic';

export default function Datenschutz() {
  const contact = engagementPrivacyContact();
  return <main className="page-container">
    <h1>Datenschutz</h1>
    {contact && <section id="engagement">
      <h2>Freiwillige Aktivitätsmessung für Engagement-EP</h2>
      <p>Verantwortlich für die Aktivitätsmessung ist {contact.controller}. Kontakt <a href={'mailto:' + contact.email}>{contact.email}</a>.</p>
      <p>Wenn du die Messung im Spielbereich einschaltest, speichert ChroniPlay für dein Konto und deine Kampagne die aktive Zeit je Tag und Bereich. Dadurch kann ChroniPlay dir den Fortschritt anzeigen und nach bestätigter Vorbereitung automatisch Engagement-EP buchen. Du kannst ChroniPlay ohne die Messung spielen.</p>
      <p>Für die Prüfung einer Figurnotiz verarbeitet ChroniPlay den Text beim Speichern. Im Aktivitätsnachweis stehen die Seitenkennung, der bestätigte Textumfang und die angerechneten Sekunden. Tastatureingaben, Mausbewegungen und Notiztexte werden als Teil der Messung nicht gespeichert. Du siehst deine eigenen Messdaten. Die Spielleitung sieht bestätigte Summen je Figur und gebuchte Stufen.</p>
      <p>Die Messung beruht auf deiner Einwilligung. Du kannst sie für künftige Messungen jederzeit durch Ausschalten widerrufen. Auch ein Neuladen beendet die Messung. ChroniPlay wertet Zeit- und Nachweisdaten aus den letzten 365 Berliner Kalendertagen aus. Ein täglicher Löschlauf entfernt ältere Daten aus der laufenden Datenbank. Bereits gebuchte EP bleiben im Charakter-Ledger nachvollziehbar.</p>
      <p>ChroniPlay läuft bei Cloudflare. Für Fragen zur Verarbeitung sowie Auskunft, Berichtigung oder Löschung wende dich an den Kontakt oben. Du kannst dich auch an deine Datenschutzaufsichtsbehörde wenden.</p>
    </section>}
    <Link href="/">Zur Startseite</Link>
  </main>;
}
