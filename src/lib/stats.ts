import { Lead, parseSheetDate } from "./data";

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
  const from = f.from ? parseSheetDate(f.from) : "";
  const to = f.to ? parseSheetDate(f.to) : "";
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
    if (from && (!l.created || l.created < from)) continue;
    if (to && (!l.created || l.created > to)) continue;
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
    ["All Leads", total, "var(--color-ember-500)"],
    ["Engaged", engaged, "var(--color-gold-400)"],
    ["Trial Scheduled", trialSet, "var(--color-cyan-400)"],
    ["Trial Completed", trialed, "var(--color-violet-400)"],
    ["Converted", conv, "var(--color-mint-400)"],
    ["Retained", ret, "var(--color-lime-400)"],
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

/* ────────────────────── Associate performance ────────────────────── */

export interface AssociateStat {
  name: string;
  leads: number;
  trialed: number;
  converted: number;
  retained: number;
  revenue: number;          // post-lead revenue on their leads
  purchases: number;
  visits: number;
  fups: number;
  touched: number;          // leads with at least one follow-up or a remark
  untouched: number;
  convRate: number;
  trialRate: number;
  trialToWin: number;
  retentionOfWon: number;
  touchRate: number;
  avgFups: number;
  revPerLead: number;
  avgDeal: number;          // revenue per converted lead
  medianDaysToConvert: number | null;
  medianDaysToFirstTouch: number | null;
  share: number;            // % of all leads in the current filter
  months: Map<string, { leads: number; won: number }>;
  topSource: string;
  topCentre: string;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
};

const topKey = (m: Map<string, number>): string => {
  let best = "—", n = -1;
  m.forEach((v, k) => {
    if (v > n) { n = v; best = k; }
  });
  return best;
};

export function associateStats(rows: Lead[]): AssociateStat[] {
  const groups = new Map<string, Lead[]>();
  for (const l of rows) {
    const arr = groups.get(l.associate);
    if (arr) arr.push(l);
    else groups.set(l.associate, [l]);
  }

  const out: AssociateStat[] = [];
  groups.forEach((ls, name) => {
    let trialed = 0, converted = 0, retained = 0, revenue = 0, purchases = 0, visits = 0, fups = 0, touched = 0;
    const convDays: number[] = [];
    const touchDays: number[] = [];
    const months = new Map<string, { leads: number; won: number }>();
    const sources = new Map<string, number>();
    const centres = new Map<string, number>();

    for (const l of ls) {
      if (l.trialed) trialed++;
      if (l.conv) converted++;
      if (l.retained) retained++;
      revenue += l.ltv;
      purchases += l.purchases;
      visits += l.visits;
      fups += l.fupCount;
      if (l.fupCount > 0 || l.remarks) touched++;
      if (l.daysToConvert != null) convDays.push(l.daysToConvert);
      if (l.fupCount > 0 && l.createdTs && l.fups[0]?.d) {
        const d = Math.round((Date.parse(l.fups[0].d + "T00:00:00") - l.createdTs) / 86400000);
        if (Number.isFinite(d) && d >= 0 && d < 400) touchDays.push(d);
      }
      const mo = months.get(l.createdMonth) ?? { leads: 0, won: 0 };
      mo.leads++;
      if (l.conv) mo.won++;
      months.set(l.createdMonth, mo);
      sources.set(l.source, (sources.get(l.source) ?? 0) + 1);
      centres.set(l.center, (centres.get(l.center) ?? 0) + 1);
    }

    const leads = ls.length;
    out.push({
      name, leads, trialed, converted, retained, revenue, purchases, visits, fups,
      touched, untouched: leads - touched,
      convRate: leads ? (converted / leads) * 100 : 0,
      trialRate: leads ? (trialed / leads) * 100 : 0,
      trialToWin: trialed ? (converted / trialed) * 100 : 0,
      retentionOfWon: converted ? (retained / converted) * 100 : 0,
      touchRate: leads ? (touched / leads) * 100 : 0,
      avgFups: leads ? fups / leads : 0,
      revPerLead: leads ? revenue / leads : 0,
      avgDeal: converted ? revenue / converted : 0,
      medianDaysToConvert: median(convDays),
      medianDaysToFirstTouch: median(touchDays),
      share: rows.length ? (leads / rows.length) * 100 : 0,
      months,
      topSource: topKey(sources),
      topCentre: topKey(centres),
    });
  });

  return out.sort((a, b) => b.leads - a.leads);
}

/** Percentile rank of a value inside a cohort, 0–100. Higher = better. */
export function rankPct(values: number[], v: number): number {
  if (values.length < 2) return 100;
  const below = values.filter((x) => x < v).length;
  return (below / (values.length - 1)) * 100;
}

/* ───────────────── Associate drill-down analytics ────────────────── */

export interface Bucket {
  label: string;
  leads: number;
  won: number;
  rate: number;
}

export interface AssociateDetail {
  name: string;
  leads: Lead[];
  /** Follow-up effort vs. outcome — does chasing harder actually pay off? */
  fupBuckets: Bucket[];
  /** How long conversions take once they happen. */
  speedBuckets: { label: string; n: number }[];
  statusMix: Agg[];
  sourceMix: Agg[];
  centreMix: Agg[];
  classMix: Agg[];
  /** Products their converted leads actually bought. */
  products: { name: string; n: number; value: number }[];
  monthly: { m: string; leads: number; won: number; revenue: number; convRate: number }[];
  visitsPerConverted: number;
  lateCancelRate: number;
  untouched: number;
  ageingOpen: number; // open leads with no follow-up in 30+ days
}

const FUP_BUCKETS: [string, (n: number) => boolean][] = [
  ["0", (n) => n === 0],
  ["1", (n) => n === 1],
  ["2", (n) => n === 2],
  ["3", (n) => n === 3],
  ["4+", (n) => n >= 4],
];

const SPEED_BUCKETS: [string, (d: number) => boolean][] = [
  ["same day", (d) => d === 0],
  ["1–7d", (d) => d >= 1 && d <= 7],
  ["8–30d", (d) => d >= 8 && d <= 30],
  ["31–90d", (d) => d >= 31 && d <= 90],
  ["90d+", (d) => d > 90],
];

export function associateDetail(name: string, rows: Lead[], months: string[]): AssociateDetail {
  const leads = rows.filter((l) => l.associate === name);

  const fupBuckets: Bucket[] = FUP_BUCKETS.map(([label, test]) => {
    const set = leads.filter((l) => test(l.fupCount));
    const won = set.filter((l) => l.conv).length;
    return { label, leads: set.length, won, rate: set.length ? (won / set.length) * 100 : 0 };
  });

  const speedBuckets = SPEED_BUCKETS.map(([label, test]) => ({
    label,
    n: leads.filter((l) => l.daysToConvert != null && test(l.daysToConvert)).length,
  }));

  const prod = new Map<string, { n: number; value: number }>();
  let visits = 0, convCount = 0, bookings = 0, lateCancels = 0;
  for (const l of leads) {
    if (l.conv) { convCount++; visits += l.visits; }
    bookings += l.bookings;
    for (const v of l.visitLog) if (v.postLead && v.lateCancelled) lateCancels++;
    for (const s of l.sales) {
      if (!s.postLead || !s.converting) continue;
      const cur = prod.get(s.product) ?? { n: 0, value: 0 };
      cur.n++; cur.value += s.value;
      prod.set(s.product, cur);
    }
  }

  const monthMap = new Map(months.map((m) => [m, { m, leads: 0, won: 0, revenue: 0, convRate: 0 }]));
  for (const l of leads) {
    const p = monthMap.get(l.createdMonth);
    if (!p) continue;
    p.leads++;
    if (l.conv) { p.won++; p.revenue += l.ltv; }
  }
  const monthly = [...monthMap.values()];
  for (const p of monthly) p.convRate = p.leads ? (p.won / p.leads) * 100 : 0;

  const now = Date.now();
  const openish = (l: Lead) => !l.conv && !["Lost", "Disqualified"].includes(l.status);
  const lastTouch = (l: Lead) => {
    const last = l.fups[l.fups.length - 1]?.d;
    return last ? Date.parse(last + "T00:00:00") : l.createdTs;
  };

  return {
    name,
    leads,
    fupBuckets,
    speedBuckets,
    statusMix: groupAgg(leads, (l) => l.status),
    sourceMix: groupAgg(leads, (l) => l.source).slice(0, 8),
    centreMix: groupAgg(leads, (l) => l.center),
    classMix: groupAgg(leads, (l) => l.cls),
    products: [...prod.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    monthly,
    visitsPerConverted: convCount ? visits / convCount : 0,
    lateCancelRate: bookings ? (lateCancels / bookings) * 100 : 0,
    untouched: leads.filter((l) => l.fupCount === 0 && !l.remarks).length,
    ageingOpen: leads.filter((l) => openish(l) && now - lastTouch(l) > 30 * 86400000).length,
  };
}

/** Monthly lead counts for an associate, as a plain array for sparklines. */
export function assocSpark(a: AssociateStat, months: string[]): number[] {
  return months.map((m) => a.months.get(m)?.leads ?? 0);
}
