import test from 'node:test';
import assert from 'node:assert/strict';
import {validCalendarDate,formatCalendarDate} from '../domain/calendar-date.ts';

test('calendar dates accept real days only, with true month lengths and leap years', () => {
  for (const ok of ['1998-03-14','2000-02-29','0001-01-01','2026-12-31']) assert.ok(validCalendarDate(ok),ok);
  for (const bad of ['1998-3-14','1999-02-29','1900-02-29','2026-13-01','2026-04-31','0000-01-01','',null,undefined,19980314,'14.03.1998',' 1998-03-14']) assert.equal(validCalendarDate(bad),false,String(bad));
});

test('calendar dates are shown in German; empty and invalid stored values stay recognisable', () => {
  assert.equal(formatCalendarDate('1998-03-14'),'14. März 1998');
  assert.equal(formatCalendarDate('2026-11-08'),'8. November 2026');
  assert.equal(formatCalendarDate(null),'Ohne Datum');
  assert.equal(formatCalendarDate('',"Ohne Spieldatum"),'Ohne Spieldatum');
  assert.equal(formatCalendarDate('irgendwann'),'irgendwann','invalid stored values stay visible');
});
