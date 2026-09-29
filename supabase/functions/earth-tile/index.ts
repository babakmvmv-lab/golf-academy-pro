// Public read-only map-tile proxy. Purpose: on networks where tile CDNs
// (Google/Esri/OpenTopoMap) are unreachable, the academy's automatic ground
// imagery (EarthShot) can still fetch tiles through Supabase's edge runtime.
// No keys, no database, no auth — it only forwards public map tiles.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,apikey',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return new Response('GET only', { status: 405, headers: CORS });
  const u = new URL(req.url);
  const m = u.searchParams.get('m') === 'topo' ? 'topo' : 'sat';
  const z = Number(u.searchParams.get('z'));
  const x = Number(u.searchParams.get('x'));
  const y = Number(u.searchParams.get('y'));
  const max = Math.pow(2, z);
  if (
    !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
    z < 0 || z > 20 || x < 0 || y < 0 || x >= max || y >= max
  ) {
    return new Response('bad tile coordinates', { status: 400, headers: CORS });
  }
  const sources: string[] = m === 'topo'
    ? [
        `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
      ]
    : [
        `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`,
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      ];
  for (const src of sources) {
    try {
      const r = await fetch(src, {
        headers: { 'user-agent': UA, accept: 'image/*' },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) continue;
      const b = await r.arrayBuffer();
      if (b.byteLength < 300) continue;
      const ct = r.headers.get('content-type') || (m === 'topo' ? 'image/png' : 'image/jpeg');
      if (!/^image\//i.test(ct)) continue;
      return new Response(b, {
        status: 200,
        headers: { ...CORS, 'Content-Type': ct, 'Cache-Control': 'public, max-age=604800' },
      });
    } catch (_e) {
      /* منبع بعدی */
    }
  }
  return new Response('tile unavailable', { status: 502, headers: CORS });
});
