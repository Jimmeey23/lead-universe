const fs = require('fs');
const raw = fs.readFileSync('/tmp/leads.csv', 'utf8');
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [];
      } else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const rows = parseCSV(raw);
const H = rows[0];
const idx = Object.fromEntries(H.map((h, i) => [h, i]));
const g = (r, c) => (r[idx[c]] ?? '').trim();
const dash = (s) => s === '-' ? '' : s;
const cleanCenter = (s) => {
  if (s === 'Plash pilates studios') return 'Plash Pilates';
  if (s === 'Pop up' || s === 'pop up plash' || s === 'Out Door') return 'Pop-up & Outdoor';
  return s || 'Unknown';
};
const cleanCls = (s) => {
  if (s === 'Barre 57') return 'Barre 57';
  if (s === 'powerCycle') return 'powerCycle';
  if (s === 'MAT' || s === 'Mat 57') return 'Mat 57';
  if (s === 'FIT' || s === 'Strength Lab') return 'Strength & FIT';
  return 'Other';
};
const STAGE_MAP = {
  'Sent Introductory message': 'Sent Introductory Message',
  'Called - Did not answer': 'Called - Did Not Answer',
  'Looking For Virtual Classes': 'Looking for Virtual Classes',
  'Shared Pricing & Schedule details on WhatsApp': 'Shared Pricing & Schedule Details (WhatsApp)',
};
const cleanStage = (s) => { const v = STAGE_MAP[s] || s; return (v === '-' || !v) ? 'Uncategorized' : v; };

const dicts = { stage: [], status: [], center: [], cls: [], source: [], assoc: [], chan: [] };
const dmap = Object.fromEntries(Object.keys(dicts).map(k => [k, new Map()]));
const D = (k, v) => { const m = dmap[k]; if (m.has(v)) return m.get(v); const i = dicts[k].length; m.set(v, i); dicts[k].push(v); return i; };

const strT = [], strM = new Map();
const S = (s) => { if (!s) return -1; if (strM.has(s)) return strM.get(s); const i = strT.length; strM.set(s, i); strT.push(s); return i; };
const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

const out = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const id = g(r, 'ID'); if (!id) continue;
  const fup = [];
  for (let f = 1; f <= 4; f++) {
    const d = dash(g(r, `Follow Up ${f} Date`));
    const c = dash(g(r, `Follow Up Comments (${f})`));
    if (d || c) fup.push(d, S(c));
  }
  out.push([
    +id, g(r, 'Full Name') || 'Unknown',
    dash(g(r, 'Phone Number')), dash(g(r, 'Email')),
    g(r, 'Created At') || '', dash(g(r, 'Converted To Customer At')),
    D('stage', cleanStage(g(r, 'Stage Name'))),
    D('status', g(r, 'Status') || 'Uncategorized'),
    D('center', cleanCenter(g(r, 'Center'))),
    D('cls', cleanCls(g(r, 'Class Type'))),
    D('source', dash(g(r, 'Source Name')) || 'Unknown'),
    D('assoc', dash(g(r, 'Associate')) || 'Unassigned'),
    D('chan', dash(g(r, 'Channel')) || 'Unknown'),
    dash(g(r, 'Member ID')),
    S(dash(g(r, 'Remarks'))),
    fup, num(g(r, 'Purchases Made')), num(g(r, 'LTV')), num(g(r, 'Visits')),
    g(r, 'Trial Status') === 'Trial Completed' ? 1 : 0,
    g(r, 'Conversion Status') === 'Converted' ? 1 : 0,
    g(r, 'Retention Status') === 'Retained' ? 1 : 0,
  ]);
}
const json = JSON.stringify({ v: 2, n: out.length, d: dicts, s: strT, r: out });
fs.writeFileSync('src/data/leads.json', json);
console.log('ROWS:', out.length, '| SIZE MB:', (json.length/1048576).toFixed(2), '| strings:', strT.length);
