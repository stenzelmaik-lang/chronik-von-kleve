/* eslint-disable @next/next/no-img-element -- Static non-secret placeholder. */
import styles from './npc-cards.module.css';
export const npcTopSecretImage='/images/npc-top-secret.png';
export function NPCTopSecret(){return <section className={styles.redactedDossier} aria-label="Anonyme NPC-Akte"><img src={npcTopSecretImage} alt="Versiegelte Top-Secret-Akte"/><h1>TOP SECRET</h1><div className={styles.redaction} aria-hidden="true"><span/><span/><span/></div><p>Identität und Inhalte sind noch nicht freigegeben.</p></section>;}
