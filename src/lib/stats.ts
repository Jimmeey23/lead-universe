import { Lead } from "./data";

/* ─────────────────────────── Filters ─────────────────────────────── */

export type FlagFilter = "any" | "yes" | "no";

export interface Filters {
  q: string;
  centers: string[];
  statuses: string[];
  stages: string[];
  channels: string[];
  sources: string[];
  associates: string[];
  classes: string[];
  from: string; // YYYY-MM-DD or ""
  to: string;
  trialed: FlagFilter;
  conv: FlagFilter;
  retained: FlagFilter;
  hasLtv: FlagFilter;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  centers: [],
  statuses: [],
  stages: [],
  channels: [],
  sources: [],
  associates: [],
  classes: [],
  from: "",
  to: "",
  trialed: "any",
  conv: "any",
  retained: "any",
  hasLtv: "any",
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.q.trim()) n++;
  n += f.centers.length ? 1 : 0;
  n += f.statuses.length ? 1 : 0;
  n += f.stages.length ? 1 : 0;
  n += f.channels.length ? 1 : 0;
  n += f.sources.length ? 1 : 0;
  n += f.associates.length ? 1 : 0;
  n += f.classes.length ? 1 : 0;
  n += f.from || f.to ? 1 : 0;
  n += f.trialed !== "any" ? 1 : 0;
  n += f.conv !== "any" ? 1 : 0;
  n += f.retained !== "any" ? 1 : 0;
  n += f.hasLtv !== "any" ? 1 : 0;
  return n;
}

const FLAG: Record<FlagFilter, (v: boolean) => boolean> = {
  any: () => true,
  yes: (v) => v,
  no: (v) => !v,
};

export function applyFilters(leads: Lead[], f: Filters): Lead[] {
  const q = f.q.trim().toLowerCase();
  const fromTs = f.from ? Date.parse(f.from + "T00:00:00") : null;
  const toTs = f.to ? Date.parse(f.to + "T00:00:00") : null;
  const cSet = new Set(f.centers), stSet = new Set(f.statuses), sgSet = new Set(f.stages);
  const chSet = new Set(f.channels), soSet = new Set(f.sources), aSet = new Set(f.associates), clSet = new Set(f.classes);
  const fT = FLAG[f.trialed], fC = FLAG[f.conv], fR = FLAG[f.retained], fL = FLAG[f.hasLtv];

  const out: Lead[] = [];
  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    if (cSet.size && !cSet.has(l.center)) continue;
    if (stSet.size && !stSet.has(l.status)) continue;
    if (sgSet.size && !sgSet.has(l.stage)) continue;
    if (chSet.size && !chSet.has(l.channel)) continue;
    if (soSet.size && !soSet.has(l.source)) continue;
    if (aSet.size && !aSet.has(l.associate)) continue;
    if (clSet.size && !clSet.has(l.cls)) continue;
    if (fromTs !== null && l.createdTs < fromTs) continue;
    if (toTs !== null && l.createdTs > toTs) continue;
    if (!fT(l.trialed)) continue;
    if (!fC(l.conv)) continue;
    if (!fR(l.retained)) continue;
    if (!fL(l.ltv > 0)) continue;
    if (q && !l.search.includes(q)) continue;
    out.push(l);
  }
  return out;
}

/* ─────────────────────────── Aggregation ─────────────────────────── */

export interface Agg {
  key: string;
  total: number;
  won: number;
  lost: number;
  open: number; // still workable (Open + Trial Scheduled + Trial Completed + Uncategorized)
  trialed: number;
  retained: number;
  ltv: number;
  purchases: number;
  visits: number;
  fups: number;
  convRate: number;
  trialRate: number;
  trialToWin: number;
  ltvPerLead: number;
  avgFups: number;
}

export function aggregate(key: string, rows: Lead[]): Agg {
  let won = 0, lost = 0, open = 0, trialed = 0, retained = 0, ltv = 0, purchases = 0, visits = 0, fups = 0;
  for (const l of rows) {
    if (l.conv) won++;
    if (l.status === "Lost" || l.status === "Disqualified" || l.status === "Unresponsive") lost++;
    if (l.status === "Open" || l.status === "Trial Scheduled" || l.status === "Trial Completed") open++;
    if (l.trialed) trialed++;
    if (l.retained) retained++;
    ltv += l.ltv;
    purchases += l.purchases;
    visits += l.visits;
    fups += l.fupCount;
  }
  const total = rows.length;
  return {
    key, total, won, lost, open, trialed, retained, ltv, purchases, visits, fups,
    convRate: total ? (won / total) * 100 : 0,
    trialRate: total ? (trialed / total) * 100 : 0,
    trialToWin: trialed ? (won / trialed) * 100 : 0,
    ltvPerLead: total ? ltv / total : 0,
    avgFups: total ? fups / total : 0,
  };
}

export function groupAgg(rows: Lead[], getKey: (l: Lead) => string): Agg[] {
  const m = new Map<string, Lead[]>();
  for (const l of rows) {
    const k = getKey(l);
    const arr = m.get(k);
    if (arr) arr.push(l);
    else m.set(k, [l]);
  }
  const out: Agg[] = [];
  m.forEach((v, k) => out.push(aggregate(k, v)));
  return out.sort((a, b) => b.total - a.total);
}

/* ───────────────────────────── Funnel ────────────────────────────── */

export interface FunnelStep {
  label: string;
  count: number;
  pct: number; // of total
  stepRate: number; // from previous step
  color: string;
}

export function funnel(rows: Lead[]): FunnelStep[] {
  const total = rows.length;
  const engaged = rows.filter((l) => !["Unresponsive", "Disqualified", "Uncategorized"].includes(l.status)).length;
  const trialSet = rows.filter((l) => l.trialed || l.status === "Trial Scheduled").length;
  const trialed = rows.filter((l) => l.trialed).length;
  const conv = rows.filter((l) => l.conv).length;
  const ret = rows.filter((l) => l.retained).length;
  const stages: [string, number, string][] = [
    ["All Leads", total, "#ff6b47"],
    ["Engaged", engaged, "#fbbf24"],
    ["Trial Scheduled", trialSet, "#22d3ee"],
    ["Trial Completed", trialed, "#a78bfa"],
    ["Converted", conv, "#34d399"],
    ["Retained", ret, "#a3e635"],
  ];
  let prev = 0;
  return stages.map(([label, count, color], i) => {
    const step: FunnelStep = {
      label, count, color,
      pct: total ? (count / total) * 100 : 0,
      stepRate: i === 0 ? 100 : prev ? (count / prev) * 100 : 0,
    };
    prev = count;
    return step;
  });
}

/* ─────────────────────────── Monthly series ──────────────────────── */

export interface MonthPoint {
  m: string;
  leads: number;
  won: number;
  trialed: number;
  ltv: number;
  convRate: number;
}

export function monthRange(min: string, max: string): string[] {
  const out: string[] = [];
  if (!min || !max) return out;
  let [y, mo] = min.split("-").map(Number);
  const [ey, emo] = max.split("-").map(Number);
  while (y < ey || (y === ey && mo <= emo)) {
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo++;
    if (mo > 12) { mo = 1; y++; }
  }
  return out;
}

export function monthlySeries(rows: Lead[], min: string, max: string): MonthPoint[] {
  const months = monthRange(min, max);
  const m = new Map<string, MonthPoint>(months.map((k) => [k, { m: k, leads: 0, won: 0, trialed: 0, ltv: 0, convRate: 0 }]));
  for (const l of rows) {
    const p = m.get(l.createdMonth);
    if (!p) continue;
    p.leads++;
    if (l.conv) { p.won++; p.ltv += l.ltv; }
    if (l.trialed) p.trialed++;
  }
  const out = [...m.values()];
  for (const p of out) p.convRate = p.leads ? (p.won / p.leads) * 100 : 0;
  return out;
}

/* ─────────────────────────── Insights ────────────────────────────── */

export interface Insight {
  title: string;
  value: string;
  sub: string;
}

export function overallKpis(rows: Lead[]) {
  const a = aggregate("All", rows);
  const withRemarks = rows.filter((l) => l.remarks || l.fupCount > 0).length;
  const untouched = rows.filter((l) => !l.remarks && l.fupCount === 0).length;
  return {
    ...a,
    engagedPct: a.total ? ((withRemarks / a.total) * 100) : 0,
    untouched,
  };
}

/** Day-of-week performance, 0 = Sun */
export function dowSeries(rows: Lead[]): { d: string; leads: number; won: number }[] {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const acc = names.map((d) => ({ d, leads: 0, won: 0 }));
  for (const l of rows) {
    if (!l.createdTs) continue;
    const dow = new Date(l.createdTs).getDay();
    acc[dow].leads++;
    if (l.conv) acc[dow].won++;
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((i) => acc[i]);
}

export function optionCounts(leads: Lead[], getKey: (l: Lead) => string): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of leads) {
    const k = getKey(l);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function topNWithOther<T extends { total?: number; count?: number }>(rows: T[], n: number): { top: T[]; otherCount: number } {
  if (rows.length <= n) return { top: rows, otherCount: 0 };
  const top = rows.slice(0, n);
  const otherCount = rows.slice(n).reduce((s, r) => s + (r.total ?? r.count ?? 0), 0);
  return { top, otherCount };
}
