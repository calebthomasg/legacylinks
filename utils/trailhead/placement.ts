export type Placement = { latitude: number; longitude: number };
const earthRadius = 6371008.8;
const rad = Math.PI / 180;

export function parsePlacement(latitude: string, longitude: string): Placement | null {
  const lat = Number(latitude), lng = Number(longitude);
  return latitude.trim() && longitude.trim() && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {latitude: lat, longitude: lng} : null;
}

export function movedMeters(a: Placement, b: Placement) {
  const h = Math.sin((b.latitude-a.latitude)*rad/2)**2 +
    Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((b.longitude-a.longitude)*rad/2)**2;
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.min(1,h)));
}

export function radiusPolygon(p: Placement, meters: number) {
  const lat = p.latitude * rad, delta = meters / earthRadius;
  const ring: number[][] = [];
  for (let i=0; i<64; i++) {
    const bearing = i*Math.PI/32;
    const y = Math.asin(Math.sin(lat)*Math.cos(delta)+Math.cos(lat)*Math.sin(delta)*Math.cos(bearing));
    const x = Math.atan2(Math.sin(bearing)*Math.sin(delta)*Math.cos(lat),Math.cos(delta)-Math.sin(lat)*Math.sin(y));
    ring.push([p.longitude+x/rad,y/rad]);
  }
  ring.push(ring[0]);
  return {type:"Polygon",coordinates:[ring]};
}
