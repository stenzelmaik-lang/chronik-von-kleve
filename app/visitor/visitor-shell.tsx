/* eslint-disable @next/next/no-html-link-for-pages -- Native Home links guarantee a full document transition between independent shells. */
/* eslint-disable @next/next/no-img-element -- Existing project assets are served from the public folder and used as authored page imagery. */
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  LogIn,
  Map,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { VisitorContent } from "./content";

import styles from "./visitor-shell.module.css";

type VisitorShellProps = {
  content: VisitorContent;
  entryHref: string;
  isSignedIn: boolean;
};

const navItems = [
  { label: "Chronik", href: "#chronik" },
  { label: "Welt", href: "#welt" },
  { label: "Mitspieler", href: "#mitspieler" },
];

const icons = [BookOpen, Map, Users];

export function VisitorShell({
  content,
  entryHref,
  isSignedIn,
}: VisitorShellProps) {
  return (
    <main className={styles.visitorShell}>
      <header className={styles.navbar} aria-label="Oeffentliche Navigation">
        <a href="/" className={styles.brand} aria-label="Zur Startseite">
          <span className={styles.brandMark}>CVK</span>
          <span className={styles.brandText}>Chronik von Kleve</span>
        </a>

        <nav className={styles.desktopNav} aria-label="Startseitenbereiche">
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className={styles.navEntry} href={entryHref} target="_top">
          {isSignedIn ? "Spielbereich" : "Anmelden"}
          <LogIn aria-hidden="true" size={16} />
        </a>

        <details className={styles.mobileNav}>
          <summary>Menue</summary>
          <div>
            {navItems.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
            <a href={entryHref} target="_top">
              {isSignedIn ? "Spielbereich" : "Anmelden"}
            </a>
          </div>
        </details>
      </header>

      <section className={styles.hero} aria-labelledby="visitor-title">
        <div className={styles.heroBackdrop} aria-hidden="true">
          <img src={content.heroImage} alt="" />
        </div>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{content.system}</p>
            <h1 id="visitor-title">{content.title}</h1>
            <p>{content.intro}</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href={entryHref} target="_top">
                {isSignedIn ? "Spielbereich betreten" : "Mit ChatGPT anmelden"}
                <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className={styles.secondaryAction} href="#chronik">
                Oeffentliche Seite ansehen
              </a>
            </div>
          </div>

          <aside className={styles.signalPanel} aria-label="Chronik Signal">
            <span>V20</span>
            <strong>Story Companion</strong>
            <p>Eine Stadt. Eine Runde. Eine gemeinsame Chronik.</p>
          </aside>
        </div>
      </section>

      <section className={styles.introBand} id="chronik">
        <div>
          <p className={styles.kicker}>Chronik von Kleve</p>
          <h2>Unsere Chronik beginnt in Kleve.</h2>
        </div>
        <p>
          Ein gemeinsamer Ort zwischen den Spielabenden: fuer die Runde,
          ihre Erinnerungen und die naechsten Schritte in der Chronik.
        </p>
      </section>

      <section className={styles.storySection} id="welt">
        <div className={styles.storyMedia}>
          <img src={content.cityImage} alt="Bestehendes Titelmotiv der Chronik von Kleve" />
        </div>

        <div className={styles.storyCopy}>
          {content.sections.map((section, index) => {
            const Icon = icons[index] ?? ShieldCheck;
            return (
              <article className={styles.storyBlock} key={section.label}>
                <div className={styles.storyIcon}>
                  <Icon aria-hidden="true" size={20} />
                </div>
                <div>
                  <p className={styles.kicker}>{section.label}</p>
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.accessBand} id="mitspieler">
        <div>
          <p className={styles.kicker}>Zugang</p>
          <h2>Bereit fuer die Runde.</h2>
          <p>
            Der Spielbereich bleibt der Ort fuer Charaktere, Notizen, Orte,
            Dateien und freigegebene Inhalte. Besucher sehen diese Daten erst,
            wenn sie sich anmelden und freigegeben wurden.
          </p>
        </div>

        <div className={styles.accessList} aria-label="Oeffentliche Hinweise">
          {content.previewItems.map((item) => (
            <span key={item}>
              <ChevronRight aria-hidden="true" size={16} />
              {item}
            </span>
          ))}
        </div>

        <a className={styles.primaryAction} href={entryHref} target="_top">
          {isSignedIn ? "Zum Spielbereich" : "Anmelden und Zugang anfragen"}
          <ArrowRight aria-hidden="true" size={18} />
        </a>
      </section>

      <footer className={styles.footer}>
        <a href="/" aria-label="Zur Startseite">
          CVK
        </a>
        <span>Chronik von Kleve</span>
        <span>{content.system}</span>
      </footer>
    </main>
  );
}
