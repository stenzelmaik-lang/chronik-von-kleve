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
      <p>In der geschlossenen Alpha ist die Aktivitätsmessung standardmäßig an. ChroniPlay speichert für dein Konto und deine Kampagne die aktive Zeit je Tag und Bereich. Die Messung zeigt dir deinen Fortschritt bei der Spielabendvorbereitung und kann nach bestätigter Vorbereitung Engagement-EP auslösen. Sie pausiert bei Inaktivität, außerhalb des sichtbaren Tabs und am Spieltisch.</p>
      <p>Für die Prüfung einer Figurnotiz verarbeitet ChroniPlay den Text beim Speichern. Im Aktivitätsnachweis stehen die Seitenkennung, der bestätigte Textumfang und die angerechneten Sekunden. Tastatureingaben, Mausbewegungen und Notiztexte werden als Teil der Messung nicht gespeichert. Du siehst deine eigenen Messdaten. Die Spielleitung sieht bestätigte Summen je Figur und gebuchte Stufen.</p>
      <p>Du kannst die Messung jederzeit unter <Link href="/profil#aktivitaetsmessung">Profil &amp; Einstellungen</Link> ausschalten und die Änderung mit „Profil speichern“ übernehmen. Danach kannst du ChroniPlay weiterspielen. Die Einstellung gilt für dein Konto und bleibt beim Neuladen und auf anderen Geräten erhalten. ChroniPlay wertet Zeit- und Nachweisdaten aus den letzten 365 Berliner Kalendertagen aus. Ein täglicher Löschlauf entfernt ältere Daten aus der laufenden Datenbank. Bereits gebuchte EP bleiben im Charakter-Ledger nachvollziehbar.</p>
      <p>ChroniPlay läuft bei Cloudflare. Für Fragen zur Verarbeitung sowie Auskunft, Berichtigung oder Löschung wende dich an den Kontakt oben. Du kannst dich auch an deine Datenschutzaufsichtsbehörde wenden.</p>
    </section>}
    <Link href="/">Zur Startseite</Link>
  </main>;
}
