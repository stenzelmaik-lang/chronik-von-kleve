import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locationSearchRing } from '../domain/location-map-area.ts';

const position = [6.13831, 51.7899];
const radians = Math.PI / 180;
function meters([lon1, lat1], [lon2, lat2]) {
  const h = Math.sin((lat2-lat1)*radians/2)**2
    + Math.cos(lat1*radians)*Math.cos(lat2*radians)*Math.sin((lon2-lon1)*radians/2)**2;
  return 2*6_371_008.8*Math.asin(Math.sqrt(h));
}

test('a rendered search area is closed and its radius stays consistent across directions', () => {
  const center = position;
  const ring = locationSearchRing(center, 50_000);
  assert.deepEqual(ring.at(-1), ring[0]);
  for (const vertex of ring) assert.ok(Math.abs(meters(center, vertex)-50_000)<1);
});
