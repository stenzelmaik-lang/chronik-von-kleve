import { appointmentOptions, validAppointmentDate } from './appointments.ts';
import { engagementTargetsForDays, type EngagementTargets } from './engagement-targets.ts';

const dayMs = 86_400_000;
const zone = 'Europe/Berlin';
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const offsetFormat = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' });
const isoDay = (utc: number) => new Date(utc).toISOString().slice(0, 10);

export function berlinDay(ms: number) {
  const parts = dayFormat.formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  return [part('year'), part('month'), part('day')].join('-');
}

export function shiftDay(day: string, days: number) {
  return isoDay(Date.parse(day + 'T00:00:00Z') + days * dayMs);
}

export function berlinMidnight(day: string) {
  const wall = Date.parse(day + 'T00:00:00Z');
  const offsetAt = (time: number) => {
    const offset = offsetFormat.formatToParts(time).find(part => part.type === 'timeZoneName')?.value;
    const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    return match ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000 : 0;
  };
  return wall - offsetAt(wall - offsetAt(wall));
}

export type PlayedEngagementStart = { id: string; day: string };
export type EngagementAppointment = { id: string; body: Record<string, unknown> };
type BaseWindow = { intervalId: string; fromDay: string };
type TimedWindow = BaseWindow & { appointmentId: string; appointmentDate: string; untilDay: string };
export type EngagementWindow =
  | { status: 'no-played-session' }
  | (BaseWindow & { status: 'waiting' })
  | (TimedWindow & { status: 'unsupported' })
  | (TimedWindow & { status: 'preview' | 'confirmed'; targets: EngagementTargets });

export function engagementWindow(played: PlayedEngagementStart | null, appointments: EngagementAppointment[], now: number): EngagementWindow {
  if (!played) return { status: 'no-played-session' };
  const today = berlinDay(now);
  const base = { intervalId: played.id, fromDay: shiftDay(played.day, 1) };
  const dates = appointments.flatMap(({ id, body }) => {
    if (body.engagementGameNight !== true) return [];
    if (body.scheduleKind === 'poll' && body.pollClosed === false) {
      try {
        return appointmentOptions(body.pollOptions).map(option => ({ id, date: option.date, preview: true }));
      } catch {
        return [];
      }
    }
    if ((body.scheduleKind === 'fixed' || (body.scheduleKind === 'poll' && body.pollClosed === true)) && validAppointmentDate(body.date)) {
      return [{ id, date: body.date, preview: false }];
    }
    return [];
  }).filter(candidate => {
    const day = berlinDay(Date.parse(candidate.date));
    return day >= today && day > played.day && (!candidate.preview || Date.parse(candidate.date) > now);
  }).sort((a, b) => Number(a.preview) - Number(b.preview) || Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id));
  const next = dates[0];
  if (!next) return { ...base, status: 'waiting' };
  const untilDay = berlinDay(Date.parse(next.date));
  const window = { ...base, untilDay, appointmentId: next.id, appointmentDate: next.date };
  const intervalDays = (berlinMidnight(untilDay) - berlinMidnight(played.day)) / dayMs;
  try {
    return { ...window, status: next.preview ? 'preview' : 'confirmed', targets: engagementTargetsForDays(intervalDays) };
  } catch {
    return { ...window, status: 'unsupported' };
  }
}
