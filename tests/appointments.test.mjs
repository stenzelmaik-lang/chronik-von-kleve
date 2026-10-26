import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentOptions, appointmentChoices, calendarDays, validAppointmentDate } from '../domain/appointments.ts';
const options=[{id:'one',date:'2036-10-15T18:00:00.000Z'},{id:'two',date:'2036-10-16T18:00:00.000Z'}];
test('appointment dates require a timestamp and timezone',()=>{
  assert.ok(validAppointmentDate(options[0].date));
  for(const invalid of ['tomorrow','2036-10-15',null,'2036-10-15T18:00'])assert.equal(validAppointmentDate(invalid),false);
});
test('poll options reject duplicates, missing ids and unsupported sizes',()=>{
  assert.deepEqual(appointmentOptions(options),options);
  for(const invalid of [[],[options[0]],[options[0],options[0]],[{date:options[0].date},options[1]],Array(21).fill(options[0])])assert.throws(()=>appointmentOptions(invalid));
});
test('votes must answer every existing option without extra options',()=>{
  assert.deepEqual(appointmentChoices({one:'yes',two:'maybe'},options),{one:'yes',two:'maybe'});
  for(const invalid of [{one:'yes'},{one:'yes',two:'other'},{one:'yes',two:'no',foreign:'yes'},null])assert.throws(()=>appointmentChoices(invalid,options));
});
test('calendar has six Monday-first weeks across year boundaries',()=>{
  const days=calendarDays(2026,0); assert.equal(days.length,42); assert.equal(days[0].getDay(),1);
  assert.equal(days[0].getFullYear(),2025);assert.equal(days[0].getDate(),29);
  assert.equal(days.filter(date=>date.getMonth()===0).length,31);
});
