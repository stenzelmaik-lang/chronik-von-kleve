const earthRadius = 6_371_008.8;
const radians = Math.PI / 180;
/** Build a geodesic ring so the indicated radius is meaningful at any zoom. */
export function locationSearchRing(
  [longitude, latitude]: [number, number],
  accuracyMeters: number,
): number[][] {
  const lat = latitude * radians;
  const angular = accuracyMeters / earthRadius;
  const segments = 48;
  const ring = Array.from({ length: segments }, (_, index) => {
    const bearing = index * 2 * Math.PI / segments;
    const nextLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
    const offset = Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat));
    return [longitude + offset / radians, nextLat / radians];
  });
  return [...ring, ring[0]];
}
