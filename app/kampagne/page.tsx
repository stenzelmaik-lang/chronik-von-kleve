/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function KampagnePage() {
  return <main className="campaign-page">
    <section className="campaign-page__hero" aria-labelledby="campaign-title">
      <img src="/images/chronik-von-kleve-banner.png" alt="Nächtliche Stadt von Kleve mit Burg, Hafen und Mond" />
      <div className="campaign-page__content">
        <p className="eyebrow">CHRONIPLAY · ERSTE KAMPAGNE</p>
        <h1 id="campaign-title">Chronik von Kleve</h1>
        <p className="campaign-page__meta">Vampire: The Masquerade V20</p>
        <p>Vampire: The Masquerade V20 bildet den Rahmen der ersten Kampagne. Die Chronik befindet sich in geschlossener Alpha; der Spielbereich ist nur für freigegebene Konten vorgesehen.</p>
        <div className="campaign-page__actions"><Link className="button button--primary" href="/anmelden">Zur geschlossenen Alpha</Link><Link className="button" href="/#start">Zur ChroniPlay-Startseite</Link></div>
      </div>
    </section>
  </main>;
}
