/**
 * Builds src/data/payload.txt (gzip + base64 JSON, schema v3).
 *
 * Inputs (CSV exports, downloaded automatically unless already cached in /tmp):
 *   - Leads    : the ◉ Leads sheet  (or the previous payload, when no CSV is available)
 *   - Sales    : https://docs.google.com/spreadsheets/d/1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0
 *   - Bookings : https://docs.google.com/spreadsheets/d/1OO-Pk7P__1uqsRdmFZ82JBl4-LGPPr7MCTbwKgeLqL0
 *
 * Sales and bookings are joined to leads on email first, member id second, and
 * emitted as two flat tables the client indexes by lead. Conversion and trial
 * badges are derived from those rows at load time — see src/lib/data.ts.
 *
 * Usage: node scripts/build-payload.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE = process.env.SHEET_CACHE_DIR || '/tmp';
const SHEETS = {
  Sales: '1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0',
  Bookings: '1OO-Pk7P__1uqsRdmFZ82JBl4-LGPPr7MCTbwKgeLqL0',
};

/* ───────────────────────────── CSV ───────────────────────────── */

function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [];
      } else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function sheet(name) {
  const file = path.join(CACHE, `${name}.csv`);
  if (!fs.existsSync(file)) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEETS[name]}/export?format=csv&gid=0`;
    console.log(`fetching ${name}…`);
    execFileSync('curl', ['-sL', '--fail', '-o', file, url], { stdio: 'inherit' });
  }
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const idx = Object.fromEntries(rows[0].map((h, i) => [h.trim(), i]));
  return { rows: rows.slice(1), g: (r, c) => (r[idx[c]] ?? '').trim() };
}

/* ─────────────────────────── helpers ─────────────────────────── */

const DAY = 86400000;
/** "2026-09-01 15:01:07" | "2026-09-01" -> days since epoch, or -1 */
const day = (s) => {
  if (!s) return -1;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return -1;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
};
const money = (s) => {
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const email = (s) => s.trim().toLowerCase();

/* ─────────────────── leads: reuse packed payload ─────────────── */

const payloadPath = path.join(ROOT, 'src/data/payload.txt');
const prev = JSON.parse(
  zlib.gunzipSync(Buffer.from(fs.readFileSync(payloadPath, 'utf8').replace(/\s+/g, ''), 'base64')).toString(),
);
const leadRows = prev.r;
console.log('leads:', leadRows.length);

const byEmail = new Map(), byMid = new Map();
leadRows.forEach((r, i) => {
  const e = email(r[3] || '');
  // first lead wins — duplicates are re-enquiries of the same person
  if (e && !byEmail.has(e)) byEmail.set(e, i);
  const m = (r[13] || '').trim();
  if (m && !byMid.has(m)) byMid.set(m, i);
});
const findLead = (e, m) => {
  const a = byEmail.get(email(e || ''));
  if (a !== undefined) return a;
  const b = byMid.get((m || '').trim());
  return b === undefined ? -1 : b;
};

/* ───────────────── dictionaries for the joined tables ────────── */

const dicts = { prod: [], cat: [], loc: [], sold: [], cls: [], teach: [], isnew: [], memb: [] };
const dmap = Object.fromEntries(Object.keys(dicts).map((k) => [k, new Map()]));
const D = (k, v) => {
  v = v && v !== '-' ? v : '—';
  const m = dmap[k];
  if (m.has(v)) return m.get(v);
  const i = dicts[k].length; m.set(v, i); dicts[k].push(v); return i;
};

/* ───────────────── sales: what counts as a conversion ────────── */

// Categories that never represent joining the studio.
const NON_CONVERTING_CATEGORIES = new Set(['Retail', 'Money Credits', 'Gift Cards']);
// Trial / introductory offers — buying one is a trial, not a conversion.
const TRIAL_PRODUCT = /2\s*for\s*1|intro\s*pack|newcomer|trial|free|complimentary|^test$/i;

const S = sheet('Sales');
const sales = [];
let unmatchedSales = 0;
for (const r of S.rows) {
  const li = findLead(S.g(r, 'Customer Email'), S.g(r, 'Member ID'));
  if (li < 0) { unmatchedSales++; continue; }
  if (S.g(r, 'Payment Status') !== 'succeeded') continue;
  if (S.g(r, 'Sec. Is Voided') === 'TRUE') continue;

  const d = day(S.g(r, 'Payment Date'));
  const product = S.g(r, 'Cleaned Product');
  const category = S.g(r, 'Cleaned Category');
  const membership = S.g(r, 'Sec. Membership Name');
  const value = money(S.g(r, 'Payment Value'));

  // A converting sale: real money, after the lead came in, not retail/credits,
  // and not an introductory offer by product *or* membership name.
  const converting =
    value > 0 &&
    d >= 0 &&
    !NON_CONVERTING_CATEGORIES.has(category) &&
    !TRIAL_PRODUCT.test(product) &&
    !TRIAL_PRODUCT.test(membership) &&
    !TRIAL_PRODUCT.test(category);

  sales.push([
    li, d, D('prod', product), D('cat', category), D('loc', S.g(r, 'Calculated Location')),
    D('sold', S.g(r, 'Sold By')), value, converting ? 1 : 0, D('memb', membership),
  ]);
}
sales.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
console.log('sales joined:', sales.length, '| unmatched:', unmatchedSales);

/* ─────────────────────────── bookings ────────────────────────── */

const B = sheet('Bookings');
const visits = [];
let unmatchedVisits = 0;
for (const r of B.rows) {
  const li = findLead(B.g(r, 'Customer Email'), B.g(r, 'Member Id'));
  if (li < 0) { unmatchedVisits++; continue; }
  const d = day(B.g(r, 'Session Date'));
  if (d < 0) continue;
  const attended = B.g(r, 'Attended') === 'TRUE' ? 1 : 0;
  const cancelled = B.g(r, 'Cancelled') === 'TRUE' ? 1 : 0;
  const late = B.g(r, 'Late Cancelled') === 'TRUE' ? 1 : 0;
  const noShow = B.g(r, 'No Show') === 'TRUE' ? 1 : 0;
  visits.push([
    li, d, D('cls', B.g(r, 'Cleaned Class')), D('loc', B.g(r, 'Location Name')),
    D('teach', B.g(r, 'Teacher Name')), D('isnew', B.g(r, 'Is New')),
    attended | (cancelled << 1) | (late << 2) | (noShow << 3),
    D('memb', B.g(r, 'Membership Used')),
  ]);
}
visits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
console.log('visits joined:', visits.length, '| unmatched:', unmatchedVisits);

/* ─────────────────────────── emit ────────────────────────────── */

const out = { v: 3, n: leadRows.length, d: prev.d, s: prev.s, r: leadRows, jd: dicts, sl: sales, vs: visits };
const json = JSON.stringify(out);
const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });
fs.writeFileSync(payloadPath, gz.toString('base64'));
console.log(
  'payload.txt |', (json.length / 1048576).toFixed(2), 'MB json ->',
  (gz.length / 1048576).toFixed(2), 'MB gz ->', ((gz.length * 4 / 3) / 1048576).toFixed(2), 'MB base64',
);
