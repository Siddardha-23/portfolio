/**
 * One-shot generator for the globe's geo assets.
 *
 * Reads the Natural Earth 1:110m admin-0 country set that ships inside
 * three-globe and emits two artefacts:
 *
 *   public/geo/countries.geojson   slim polygons (geometry + iso + name only)
 *   src/lib/countryCentroids.ts    alpha-2 -> [lat, lng], for visitors whose
 *                                  row has a country but no city coordinates
 *
 * Run from portfolio-frontend:  node ../scripts/build-geo-assets.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'node_modules/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson';

// Natural Earth leaves ISO_A2 as '-99' for a handful of entries (France and
// Norway carry it on their sovereignty fields instead, Kosovo has no ISO code).
const ISO_FIXUPS = {
    France: 'FR',
    Norway: 'NO',
    'Somaliland': 'SO',
    'N. Cyprus': 'CY',
    Kosovo: 'XK',
};

// Natural Earth's 1:110m set has no polygon for city-states and small islands,
// so they would have no centroid and their visitors would never appear. These
// are only ever a fallback for a row with no city coordinates, so a single
// representative point per territory is enough.
const MICROSTATE_CENTROIDS = {
    SG: [1.35, 103.82], HK: [22.32, 114.17], MO: [22.2, 113.55],
    MT: [35.9, 14.5], BH: [26.07, 50.55], MU: [-20.35, 57.55],
    MV: [3.2, 73.2], SC: [-4.68, 55.49], KM: [-11.65, 43.33],
    CV: [16.0, -24.0], ST: [0.34, 6.73],
    LI: [47.17, 9.51], MC: [43.73, 7.42], SM: [43.94, 12.46],
    AD: [42.51, 1.52], VA: [41.9, 12.45], GI: [36.14, -5.35],
    JE: [49.21, -2.13], GG: [49.46, -2.58], IM: [54.24, -4.55],
    AG: [17.06, -61.8], KN: [17.34, -62.76], LC: [13.91, -60.98],
    VC: [13.25, -61.2], GD: [12.12, -61.68], BB: [13.19, -59.54],
    DM: [15.41, -61.37], AW: [12.52, -69.97], CW: [12.17, -68.99],
    BM: [32.32, -64.75], KY: [19.31, -81.25], VG: [18.42, -64.64],
    TC: [21.69, -71.8], AI: [18.22, -63.07], MS: [16.74, -62.19],
    BN: [4.54, 114.72], TL: [-8.87, 125.73], MH: [7.13, 171.18],
    FM: [6.92, 158.16], PW: [7.51, 134.58], NR: [-0.53, 166.94],
    TV: [-8.52, 179.2], KI: [1.87, -157.36], TO: [-21.18, -175.2],
    WS: [-13.76, -172.1], CK: [-21.24, -159.78], NU: [-19.05, -169.92],
    NC: [-21.3, 165.5], PF: [-17.68, -149.41], GU: [13.44, 144.79],
    MP: [15.19, 145.75], AS: [-14.3, -170.7], FO: [62.0, -6.79],
    AX: [60.18, 19.94], MF: [18.08, -63.05], BL: [17.9, -62.83],
    SX: [18.03, -63.05], PM: [46.89, -56.32], WF: [-13.29, -176.2],
    TK: [-9.2, -171.85], RE: [-21.11, 55.53], YT: [-12.83, 45.17],
    GP: [16.25, -61.58], MQ: [14.64, -61.02], SJ: [78.0, 16.0],
};

const raw = JSON.parse(readFileSync(SRC, 'utf8'));

/** Signed area of a ring in degrees^2 — used to pick a country's largest landmass. */
function ringArea(ring) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return Math.abs(area / 2);
}

/** Area-weighted centroid of a single ring. */
function ringCentroid(ring) {
    let cx = 0, cy = 0, a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        a += f;
        cx += (ring[j][0] + ring[i][0]) * f;
        cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (a === 0) return ring[0];
    return [cx / (3 * a), cy / (3 * a)];
}

/** Outer rings of a Polygon / MultiPolygon, largest first. */
function outerRings(geometry) {
    if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0]);
    return [];
}

const features = [];
const centroids = {};

for (const f of raw.features) {
    const p = f.properties;
    const name = p.NAME || p.ADMIN || p.SOVEREIGNT;
    let iso = (p.ISO_A2 || '').trim().toUpperCase();
    if (!iso || iso === '-99') iso = ISO_FIXUPS[name] || '';

    features.push({
        type: 'Feature',
        properties: { iso, name },
        geometry: f.geometry,
    });

    if (!iso) continue;

    const rings = outerRings(f.geometry);
    if (!rings.length) continue;
    // Largest landmass, so Alaska does not drag the US pin into the Pacific.
    const biggest = rings.reduce((a, b) => (ringArea(a) >= ringArea(b) ? a : b));
    const [lng, lat] = ringCentroid(biggest);
    centroids[iso] = [Math.round(lat * 10) / 10, Math.round(lng * 10) / 10];
}

// Fill in only what Natural Earth could not supply, so a future higher-resolution
// source silently wins over the hand-entered points above.
let supplemented = 0;
for (const [iso, latLng] of Object.entries(MICROSTATE_CENTROIDS)) {
    if (!centroids[iso]) {
        centroids[iso] = latLng;
        supplemented++;
    }
}

mkdirSync('public/geo', { recursive: true });
writeFileSync(
    'public/geo/countries.geojson',
    JSON.stringify({ type: 'FeatureCollection', features })
);

const entries = Object.keys(centroids)
    .sort()
    .map((iso) => `    ${iso}: [${centroids[iso][0]}, ${centroids[iso][1]}],`)
    .join('\n');

writeFileSync(
    'src/lib/countryCentroids.ts',
    `/**
 * Alpha-2 country code -> [lat, lng] of the country's largest landmass.
 *
 * GENERATED by scripts/build-geo-assets.mjs from Natural Earth 1:110m.
 * Do not edit by hand; re-run the script instead.
 *
 * Used only as a fallback: when a visitor row carries a country but no
 * city-level coordinates, the marker lands on the country instead of vanishing.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
${entries}
};
`
);

console.log(`features: ${features.length}`);
console.log(`centroids: ${Object.keys(centroids).length} (${supplemented} supplemented)`);
console.log(`missing iso: ${features.filter((f) => !f.properties.iso).map((f) => f.properties.name).join(', ') || 'none'}`);
