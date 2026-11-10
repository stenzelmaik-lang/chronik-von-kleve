// Alpha 2.0 (#75): every evening that was actually played gets a durable ID of
// its own. The session record (kind "sitzungen") is only read here and never
// written: one record may be reused for many evenings, and its status may change
// or the record may disappear later. The played evening stays as it was registered.
import { validAppointmentDate } from "../domain/appointments.ts";
import { parseBody, validId, XpRewardServiceError } from "./xp-reward-errors.ts";

export type PlayedSession = { id: string; campaignId: string; sessionRecordId: string; appointmentId: string | null; playedOn: string; title: string; registeredBy: string; registeredAt: string };
type Row = { id: string; campaign_id: string; session_record_id: string; appointment_id: string | null; played_on: string; title: string; registered_by: string; registered_at: string };
const view = (row: Row): PlayedSession => ({ id: row.id, campaignId: row.campaign_id, sessionRecordId: row.session_record_id, appointmentId: row.appointment_id, playedOn: row.played_on, title: row.title, registeredBy: row.registered_by, registeredAt: row.registered_at });

function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number), date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The played evening with this ID in this campaign. Neither a session record nor a calendar entry is one. */
export async function playedSession(db: D1Database, campaignId: string, id: unknown): Promise<PlayedSession> {
  if (!validId(id)) throw new XpRewardServiceError(400, "Bitte einen Spielabend auswählen.");
  const row = await db.prepare("SELECT * FROM played_sessions WHERE id=? AND campaign_id=?").bind(id, campaignId).first<Row>();
  if (!row) throw new XpRewardServiceError(404, "Spielabend nicht verfügbar.");
  return view(row);
}

export type RegisterPlayedSessionInput = { campaignId: string; actorId: string; sessionRecordId: string; playedOn: string; appointmentId?: string | null; now?: string };

/**
 * Registers that the session record was played on that day. The Spielleitung
 * must have closed the record ("Abgeschlossen") at this moment; afterwards the
 * evening no longer depends on it. Registering the same record and day again
 * returns the existing evening. The caller must have verified that the actor is
 * the Spielleitung.
 */
export async function registerPlayedSession(db: D1Database, input: RegisterPlayedSessionInput): Promise<{ session: PlayedSession; created: boolean }> {
  const now = input.now ?? new Date().toISOString(), appointmentId = input.appointmentId ?? null;
  if (!validId(input.sessionRecordId)) throw new XpRewardServiceError(400, "Bitte eine Sitzung auswählen.");
  if (appointmentId !== null && !validId(appointmentId)) throw new XpRewardServiceError(400, "Ungültiger Termin.");
  // One day of slack for time zones; an evening cannot be registered in advance.
  if (!validDay(input.playedOn) || input.playedOn > new Date(Date.parse(now) + 86400000).toISOString().slice(0, 10)) throw new XpRewardServiceError(400, "Bitte das Datum des gespielten Abends angeben (JJJJ-MM-TT, nicht in der Zukunft).");
  const find = () => db.prepare("SELECT * FROM played_sessions WHERE campaign_id=? AND session_record_id=? AND played_on=?").bind(input.campaignId, input.sessionRecordId, input.playedOn).first<Row>();
  const same = (row: Row) => {
    if (appointmentId !== null && row.appointment_id !== appointmentId) throw new XpRewardServiceError(409, "Dieser Spielabend ist bereits registriert und wird nicht nachträglich mit einem anderen Termin verknüpft.");
    return { session: view(row), created: false };
  };
  const existing = await find();
  if (existing) return same(existing);
  const record = await db.prepare("SELECT title,body FROM records WHERE id=? AND campaign_id=? AND kind='sitzungen'").bind(input.sessionRecordId, input.campaignId).first<{ title: string; body: string }>();
  if (!record) throw new XpRewardServiceError(404, "Sitzung nicht verfügbar.");
  if (parseBody(record.body).status !== "Abgeschlossen") throw new XpRewardServiceError(409, "Diese Sitzung ist noch nicht abgeschlossen.");
  if (appointmentId !== null) {
    const appointment = await db.prepare("SELECT body FROM records WHERE id=? AND campaign_id=? AND kind='termine'").bind(appointmentId, input.campaignId).first<{ body: string }>();
    if (!appointment) throw new XpRewardServiceError(404, "Termin nicht verfügbar.");
    const body = parseBody(appointment.body);
    if ((body.scheduleKind === "poll" && body.pollClosed !== true) || !validAppointmentDate(body.date)) throw new XpRewardServiceError(409, "Dieser Termin ist noch nicht verbindlich festgelegt.");
    const taken = await db.prepare("SELECT id FROM played_sessions WHERE campaign_id=? AND appointment_id=?").bind(input.campaignId, appointmentId).first<{ id: string }>();
    if (taken) throw new XpRewardServiceError(409, "Dieser Termin gehört bereits zu einem anderen Spielabend.");
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO played_sessions(id,campaign_id,session_record_id,appointment_id,played_on,title,registered_by,registered_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING")
    .bind(id, input.campaignId, input.sessionRecordId, appointmentId, input.playedOn, record.title, input.actorId, now).run();
  const stored = await find();
  // No row: a parallel request linked the same calendar entry to another evening first.
  if (!stored) throw new XpRewardServiceError(409, "Dieser Termin gehört bereits zu einem anderen Spielabend.");
  return stored.id === id ? { session: view(stored), created: true } : same(stored);
}
