export type AppointmentOption = { id: string; date: string };
export type AppointmentChoice = 'yes' | 'maybe' | 'no';
export function appointmentOptions(value: unknown): AppointmentOption[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) throw new Error('Bitte 2 bis 20 Terminvorschläge eintragen.');
  const options = value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Ungültiger Terminvorschlag.');
    const option = item as Record<string, unknown>;
    if (typeof option.id !== 'string' || !/^[\w-]{1,100}$/.test(option.id) || !validAppointmentDate(option.date)) throw new Error('Ungültiger Terminvorschlag.');
    return { id: option.id, date: option.date as string };
  });
  if (new Set(options.map(option => option.id)).size !== options.length || new Set(options.map(option => Date.parse(option.date))).size !== options.length) throw new Error('Terminvorschläge dürfen nicht doppelt sein.');
  return options;
}
export function validAppointmentDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year,month,day]=value.slice(0,10).split('-').map(Number);
  const calendar=new Date(Date.UTC(year,month-1,day));
  return calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day;
}
export function appointmentChoices(value: unknown, options: AppointmentOption[]): Record<string, AppointmentChoice> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Abstimmung.');
  const choices = value as Record<string, unknown>;
  if (Object.keys(choices).some(id => !options.some(option => option.id === id))) throw new Error('Unbekannter Terminvorschlag.');
  return Object.fromEntries(options.map(option => {
    const choice = choices[option.id];
    if (!['yes', 'maybe', 'no'].includes(String(choice))) throw new Error('Bitte jeden Vorschlag beantworten.');
    return [option.id, choice as AppointmentChoice];
  }));
}
export function calendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({length:42}, (_, index) => new Date(year, month, 1 - offset + index, 12));
}
