import Link from 'next/link';
import { engagementPrivacyContact } from '@/server/engagement-config';

export const dynamic = 'force-dynamic';

export default function Impressum() {
  const contact = engagementPrivacyContact();
  return <main className="page-container">
    <h1>Impressum</h1>
    <p>ChroniPlay ist ein privates Projekt für eine geschlossene Pen-&amp;-Paper-Spielrunde.</p>
    {contact && <section aria-labelledby="projektkontakt">
      <h2 id="projektkontakt">Projekt und Kontakt</h2>
      <p>{contact.controller}<br /><a href={'mailto:' + contact.email}>{contact.email}</a></p>
    </section>}
    <p><Link href="/datenschutz">Datenschutzerklärung</Link></p>
    <Link href="/">Zur Startseite</Link>
  </main>;
}
