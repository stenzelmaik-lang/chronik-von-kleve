import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export const campaignId = 'chronik-von-kleve', now = '2026-11-10T12:00:00.000Z';

// Real SQLite behind the D1 surface the reward services use. Every call is async,
// so concurrent bookings interleave their reads and writes like separate requests.
// The settlement tables come from the real migration. Synthetic data only.
export function setupRewardDb({ latestPlayedOn = '2026-11-07' } = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'private',title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '{}',gm_body TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,campaign_id TEXT NOT NULL DEFAULT 'chronik-von-kleve');
    CREATE TABLE entities(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,type TEXT NOT NULL,canon_status TEXT NOT NULL DEFAULT 'WORKING');
    CREATE TABLE world_events(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,entity_id TEXT,actor_id TEXT NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const migration = readdirSync('drizzle').find(name => /^\d{4}_alpha2_xp_settlement\.sql$/.test(name));
  if (!migration) throw new Error('Migration *_alpha2_xp_settlement.sql fehlt.');
  for (const statement of readFileSync('drizzle/' + migration, 'utf8').split('--> statement-breakpoint')) if (statement.trim()) sql.exec(statement);
  class Statement {
    constructor(q, v = []) { this.q = q; this.v = v; }
    bind(...v) { return new Statement(this.q, v); }
    async first() { await null; return sql.prepare(this.q).get(...this.v) ?? null; }
    async all() { await null; return { results: sql.prepare(this.q).all(...this.v) }; }
    async run() { await null; return { meta: { changes: Number(sql.prepare(this.q).run(...this.v).changes) } }; }
  }
  const db = { prepare: q => new Statement(q), batch: async list => { await null; return list.map(s => ({ meta: { changes: Number(sql.prepare(s.q).run(...s.v).changes) } })); } };
  const entity = (id, type, campaign = campaignId, canon = 'WORKING') => sql.prepare('INSERT INTO entities(id,campaign_id,type,canon_status) VALUES(?,?,?,?)').run(id, campaign, type, canon);
  const record = (id, kind, body, campaign = campaignId) => sql.prepare("INSERT INTO records(id,owner_id,kind,title,body,created_at,updated_at,campaign_id) VALUES(?,?,?,?,?,'t','t',?)").run(id, 'player-a', kind, 'Titel ' + id, JSON.stringify(body), campaign);
  const played = (id, sessionRecordId, playedOn, campaign = campaignId, appointmentId = null) => sql.prepare("INSERT INTO played_sessions(id,campaign_id,session_record_id,appointment_id,played_on,title,registered_by,registered_at) VALUES(?,?,?,?,?,?,'gm','2026-11-08T09:00:00.000Z')").run(id, campaign, sessionRecordId, appointmentId, playedOn, 'Titel ' + sessionRecordId);
  const confirmed = (extra = {}) => ({ engineVersion: 1, characterState: 'confirmed', clan: 'Toreador', xpLedger: [{ id: 'opening', kind: 'historical', amount: 9, reason: 'Bestand', createdAt: 't' }], ...extra });
  for (const id of ['char-a', 'char-b', 'char-c']) record(id, 'charaktere', confirmed());
  record('char-draft', 'charaktere', { engineVersion: 1, characterState: 'draft' });
  record('char-legacy', 'charaktere', { clan: 'Brujah', xp: 12 });
  record('char-archived', 'charaktere', confirmed({ archived: true }));
  record('char-secret', 'charaktere', confirmed({ canonStatus: 'GM_SECRET' }));
  record('char-entity-secret', 'charaktere', confirmed()); entity('char-entity-secret', 'CHARACTER', campaignId, 'GM_SECRET');
  record('char-foreign', 'charaktere', confirmed(), 'andere-chronik');
  // Session records as they exist today. One of them is reused for several evenings.
  record('sitzung-1', 'sitzungen', { status: 'Abgeschlossen', scene: 'Finale', log: ['x'] });
  record('sitzung-neu', 'sitzungen', { status: 'Abgeschlossen' });
  record('sitzung-laeuft', 'sitzungen', { status: 'Läuft' });
  record('sitzung-bereit', 'sitzungen', { scene: 'Vorbereitung' });
  record('sitzung-fremd', 'sitzungen', { status: 'Abgeschlossen' }, 'andere-chronik');
  record('termin-1', 'termine', { scheduleKind: 'fixed', date: '2026-10-03T19:00:00+02:00' });
  record('termin-2', 'termine', { scheduleKind: 'poll', pollClosed: true, date: '2026-11-07T19:00:00+01:00', pollOptions: [] });
  record('termin-offen', 'termine', { scheduleKind: 'poll', pollClosed: false, pollOptions: [] });
  record('termin-fremd', 'termine', { scheduleKind: 'fixed', date: '2026-10-03T19:00:00+02:00' }, 'andere-chronik');
  record('notiz-1', 'notizen', { status: 'Abgeschlossen' });
  // Played evenings: durable IDs of their own, two of them from the same reused session record.
  played('abend-1', 'sitzung-1', latestPlayedOn);
  played('abend-2', 'sitzung-1', '2026-10-03', campaignId, 'termin-1');
  played('abend-fremd', 'sitzung-fremd', '2026-11-07', 'andere-chronik');
  entity('bogen-1', 'storyline'); entity('bogen-2', 'storyline'); entity('bogen-fremd', 'storyline', 'andere-chronik'); entity('npc-1', 'NPC');
  const body = id => JSON.parse(sql.prepare('SELECT body FROM records WHERE id=?').get(id).body);
  const version = id => sql.prepare('SELECT version FROM records WHERE id=?').get(id).version;
  const events = () => sql.prepare('SELECT * FROM world_events ORDER BY created_at,id').all();
  const rows = (table, where = '1=1') => sql.prepare(`SELECT * FROM ${table} WHERE ${where}`).all();
  return { sql, db, body, version, events, rows };
}
