/**
 * Smoke test for src/lib/geo.ts.
 *
 * The visitor collection holds several generations of geo values, so this asserts
 * the resolver against the shapes actually found in the data rather than only the
 * happy path. Run from portfolio-frontend:  node ../scripts/check-geo.mjs
 */
import { pathToFileURL } from 'node:url';
import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// Node resolves bare specifiers relative to this file, which lives outside the
// frontend package, so esbuild is loaded from the frontend's own node_modules.
const { build } = await import(
    pathToFileURL(resolve(process.cwd(), 'node_modules/esbuild/lib/main.js')).href
);

const OUT = 'node_modules/.geo-check.mjs';

await build({
    entryPoints: ['src/lib/geo.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: OUT,
    logLevel: 'silent',
});

const geo = await import(pathToFileURL(OUT).href + `?t=${Date.now()}`);

let failures = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}  ->  ${JSON.stringify(actual)}${ok ? '' : `  expected ${JSON.stringify(expected)}`}`);
}

console.log('\n--- country resolution ---');
const name = (v) => geo.resolveCountry(v)?.name ?? null;
const code = (v) => geo.resolveCountry(v)?.code ?? null;

// Codes that used to render raw because they were outside the 44-entry table.
check('"NP"', name('NP'), 'Nepal');
check('"LK"', name('LK'), 'Sri Lanka');
check('"BD"', name('BD'), 'Bangladesh');

// The alias the old backend wrote.
check('"UAE"', name('UAE'), 'United Arab Emirates');
check('"AE"', name('AE'), 'United Arab Emirates');

// Code and name must collapse onto one bucket.
check('"IN" code', code('IN'), 'IN');
check('"India" code', code('India'), 'IN');
check('"UK" code', code('UK'), 'GB');
check('"United Kingdom" code', code('United Kingdom'), 'GB');
check('"usa" code', code('usa'), 'US');
check('"United States" code', code('United States'), 'US');

// Accents and punctuation must not defeat the reverse lookup.
check('"Cote d\'Ivoire"', code("Cote d'Ivoire"), 'CI');

// Junk must be dropped, not plotted.
for (const junk of ['Local', 'unknown', 'localhost', 'XX', '-', '', null, undefined, 'EU', 'UN']) {
    check(`junk ${JSON.stringify(junk)}`, geo.resolveCountry(junk), null);
}

console.log('\n--- flags ---');
check('flag US', geo.flagFromCode('US'), '\u{1F1FA}\u{1F1F8}');
check('flag NP', geo.flagFromCode('NP'), '\u{1F1F3}\u{1F1F5}');
check('flag bad', geo.flagFromCode('XYZ'), '');

console.log('\n--- centroids present ---');
for (const c of ['US', 'IN', 'SG', 'HK', 'NP', 'LK', 'AE', 'GB', 'BH', 'MT']) {
    const r = geo.resolveCountry(c);
    const ok = r && typeof r.lat === 'number' && typeof r.lng === 'number';
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c} centroid ${r ? `${r.lat},${r.lng}` : 'MISSING'}`);
}

console.log('\n--- city cleanup ---');
check('mojibake', geo.cleanCity('MÃ¼nchen'), 'München');
check('accented passthrough', geo.cleanCity('München'), 'München');
check('shouting', geo.cleanCity('SAN FRANCISCO'), 'San Francisco');
check('mixed case left alone', geo.cleanCity('New York'), 'New York');
check('whitespace', geo.cleanCity('  Bengaluru  '), 'Bengaluru');
check('junk city', geo.cleanCity('Local Development'), null);
check('empty city', geo.cleanCity(''), null);

unlinkSync(OUT);

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
