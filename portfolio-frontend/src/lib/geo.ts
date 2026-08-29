/**
 * One canonical place to turn whatever geo string the API returns into a
 * country we can name, flag and plot.
 *
 * The visitor pipeline has accumulated three generations of geo values:
 *
 *   1. alpha-2 codes        "IN"      (what ipinfo.io actually returns)
 *   2. display names        "India"   (older rows, written before the code was kept)
 *   3. hand-rolled aliases  "UAE"     (from a 44-entry lookup table in the backend)
 *
 * Anything outside that 44-entry table used to reach the UI as a bare code, which
 * is why the map rendered "NP" and "LK" as if they were country names, and why
 * the same country could appear twice with its visitors split across both spellings.
 *
 * Names come from Intl.DisplayNames, so every ISO 3166-1 country is spelled the way
 * CLDR spells it rather than the way someone typed it into a dictionary literal.
 */
import { COUNTRY_CENTROIDS } from './countryCentroids';

export interface ResolvedCountry {
    /** ISO 3166-1 alpha-2, uppercase. The key everything else joins on. */
    code: string;
    /** Display name, e.g. "United Arab Emirates". */
    name: string;
    /** Flag emoji built from the code. */
    flag: string;
    lat: number | null;
    lng: number | null;
}

/**
 * Values that mean "we could not geolocate this" and must never reach the globe.
 * Compared lowercased.
 */
const JUNK = new Set([
    '', '-', 'n/a', 'na', 'null', 'undefined', 'none',
    'unknown', 'local', 'localhost', 'local development', 'development',
    'xx', 'zz', 'private', 'reserved', 'anonymous proxy', 'satellite provider',
]);

/**
 * Legacy spellings the backend has written over time, plus the abbreviations
 * people expect to work. Keys are lowercased and punctuation-stripped.
 */
const ALIASES: Record<string, string> = {
    usa: 'US', us: 'US', 'united states of america': 'US', america: 'US',
    uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB',
    scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
    uae: 'AE', 'united arab emirates': 'AE',
    'south korea': 'KR', korea: 'KR', 'republic of korea': 'KR',
    'north korea': 'KP',
    russia: 'RU', 'russian federation': 'RU',
    vietnam: 'VN', 'viet nam': 'VN',
    czechia: 'CZ', 'czech republic': 'CZ',
    turkey: 'TR', turkiye: 'TR',
    iran: 'IR', syria: 'SY', laos: 'LA', brunei: 'BN',
    bolivia: 'BO', venezuela: 'VE', tanzania: 'TZ', moldova: 'MD',
    macedonia: 'MK', 'north macedonia': 'MK',
    'ivory coast': 'CI', "cote d'ivoire": 'CI', 'cote divoire': 'CI',
    'cape verde': 'CV', 'cabo verde': 'CV',
    swaziland: 'SZ', eswatini: 'SZ',
    burma: 'MM', myanmar: 'MM',
    'hong kong': 'HK', 'hong kong sar china': 'HK',
    macao: 'MO', macau: 'MO',
    taiwan: 'TW', palestine: 'PS', vatican: 'VA', 'holy see': 'VA',
    'dr congo': 'CD', 'democratic republic of the congo': 'CD',
    congo: 'CG', 'republic of the congo': 'CG',
    'the netherlands': 'NL', holland: 'NL',
};

/** Two-letter codes CLDR knows but ISO 3166-1 does not use for a country. */
const CODE_ALIASES: Record<string, string> = { UK: 'GB' };

/** Groupings and placeholders nobody actually visits from. */
const NON_COUNTRY_CODES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ', 'XX']);

let displayNames: Intl.DisplayNames | null | undefined;

function getDisplayNames(): Intl.DisplayNames | null {
    if (displayNames !== undefined) return displayNames;
    try {
        displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        // Very old browser, or an environment without full ICU data.
        displayNames = null;
    }
    return displayNames;
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalizeKey(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[.,'’`()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Reverse index of display name -> alpha-2, built once from the codes we know. */
let nameToCode: Map<string, string> | null = null;

function getNameToCode(): Map<string, string> {
    if (nameToCode) return nameToCode;
    const map = new Map<string, string>();
    const dn = getDisplayNames();
    if (dn) {
        for (const code of Object.keys(COUNTRY_CENTROIDS)) {
            try {
                const name = dn.of(code);
                // Intl echoes the input back when it does not know the region.
                if (name && name !== code) map.set(normalizeKey(name), code);
            } catch {
                // Skip codes this runtime rejects.
            }
        }
    }
    // Aliases are added last so they win over any CLDR name that collides.
    for (const [alias, code] of Object.entries(ALIASES)) {
        map.set(normalizeKey(alias), code);
    }
    nameToCode = map;
    return map;
}

/** Flag emoji from an alpha-2 code, via regional indicator symbols. */
export function flagFromCode(code: string): string {
    if (!/^[A-Za-z]{2}$/.test(code)) return '';
    return String.fromCodePoint(
        ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
}

/** Canonical English name for an alpha-2 code, or the code itself if unknown. */
export function countryNameFromCode(code: string): string {
    const dn = getDisplayNames();
    if (!dn) return code;
    try {
        return dn.of(code) || code;
    } catch {
        return code;
    }
}

/**
 * Resolve any country string — code, display name or legacy alias — to one
 * canonical country. Returns null for junk and for values we cannot place,
 * so callers can drop the row rather than plot a mystery pin.
 */
export function resolveCountry(raw: string | null | undefined): ResolvedCountry | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed || JUNK.has(trimmed.toLowerCase())) return null;

    // Aliases first: CLDR will happily name "UK", and taking that at face value
    // gives British visitors a second bucket alongside GB.
    let code = getNameToCode().get(normalizeKey(trimmed));

    if (!code && /^[A-Za-z]{2}$/.test(trimmed)) {
        code = trimmed.toUpperCase();
    }

    if (!code) return null;

    code = CODE_ALIASES[code] ?? code;
    if (NON_COUNTRY_CODES.has(code)) return null;

    const name = countryNameFromCode(code);
    // A code Intl cannot name and we have no centroid for is not a real country.
    if (name === code && !COUNTRY_CENTROIDS[code]) return null;

    const centroid = COUNTRY_CENTROIDS[code];
    return {
        code,
        name,
        flag: flagFromCode(code),
        lat: centroid ? centroid[0] : null,
        lng: centroid ? centroid[1] : null,
    };
}

/**
 * Repair text that was stored as UTF-8 but decoded as Latin-1 somewhere upstream,
 * which is how "München" becomes "MÃ¼nchen". Left untouched if it does not match
 * that signature, so genuinely accented names survive.
 */
function repairMojibake(value: string): string {
    if (!/[\u00c3\u00c2][\u0080-\u00bf]/.test(value)) return value;
    try {
        const bytes = Uint8Array.from(value, (ch) => ch.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decoded;
    } catch {
        return value;
    }
}

/**
 * Clean a city name for display. Returns null when the value carries no
 * information, so the UI can fall back to showing the country alone.
 */
export function cleanCity(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let city = repairMojibake(String(raw)).replace(/\s+/g, ' ').trim();
    if (!city || JUNK.has(city.toLowerCase())) return null;
    // Some feeds shout the city; restore normal casing but leave mixed case alone.
    if (city.length > 3 && city === city.toUpperCase() && /[A-Z]/.test(city)) {
        city = city
            .toLowerCase()
            .replace(/(^|[\s\-'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
    }
    return city;
}

/** "Bengaluru, India" — or just the country when there is no usable city. */
export function formatPlace(city: string | null, country: ResolvedCountry): string {
    return city ? `${city}, ${country.name}` : country.name;
}
