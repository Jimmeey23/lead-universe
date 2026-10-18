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

function parseSheetDate(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s === '0') return '';

  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const usComma = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),/.exec(s);
  if (usComma) {
    const m = usComma[1].padStart(2, '0');
    const d = usComma[2].padStart(2, '0');
    const y = usComma[3];
    return `${y}-${m}-${d}`;
  }

  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10);
    const p2 = parseInt(dmy[2], 10);
    const y = dmy[3];
    let d, m;
    if (p1 > 12) {
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      m = String(p1).padStart(2, '0');
      d = String(p2).padStart(2, '0');
    } else {
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    }
    return `${y}-${m}-${d}`;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

const strT = [], strM = new Map();
const S = (s) => { if (!s) return -1; if (strM.has(s)) return strM.get(s); const i = strT.length; strM.set(s, i); strT.push(s); return i; };
const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

const out = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const id = g(r, 'ID'); if (!id) continue;
  const fup = [];
  for (let f = 1; f <= 4; f++) {
    const d = parseSheetDate(dash(g(r, `Follow Up ${f} Date`)));
    const c = dash(g(r, `Follow Up Comments (${f})`));
    if (d || c) fup.push(d, S(c));
  }
  out.push([
    +id, g(r, 'Full Name') || 'Unknown',
    dash(g(r, 'Phone Number')), dash(g(r, 'Email')),
    parseSheetDate(g(r, 'Created At')), parseSheetDate(dash(g(r, 'Converted To Customer At'))),
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
