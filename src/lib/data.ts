import payloadRaw from "../data/payload.txt?raw";
const PAYLOAD_GZ_B64: string = payloadRaw.replace(/\s+/g, "");

/* ────────────────────────────── Types ────────────────────────────── */

export interface FollowUp {
  d: string;
  c: string;
}

/** One succeeded sale, joined to a lead on email → member id. */
export interface Sale {
  day: number;        // days since epoch (UTC)
  date: string;       // YYYY-MM-DD
  product: string;
  category: string;
  membership: string; // "—" when the sale carries no membership
  location: string;
  soldBy: string;
  value: number;
  /** Revenue that represents joining the studio: not retail/credits, not an intro offer. */
  converting: boolean;
  /** Dated on or after the lead was created. */
  postLead: boolean;
}

/** One class booking, joined to a lead on email → member id. */
export interface Visit {
  day: number;
  date: string;       // YYYY-MM-DD
  cls: string;
  location: string;
  teacher: string;
  kind: string;       // "Is New" bucket: New - Trial Class, Repeat Visit, …
  membership: string;
  attended: boolean;
  cancelled: boolean;
  lateCancelled: boolean;
  noShow: boolean;
  postLead: boolean;
}

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  created: string; // YYYY-MM-DD
  converted: string; // "" when not converted
  stage: string;
  status: string;
  center: string;
  cls: string;
  source: string;
  associate: string;
  channel: string;
  memberId: string;
  remarks: string;
  fups: FollowUp[];
  /** Converting purchases made after the lead was created. */
  purchases: number;
  /** Revenue from every post-lead sale, converting or not. */
  ltv: number;
  /** Classes actually attended after the lead was created. */
  visits: number;
  /** Attended at least one class after enquiring. */
  trialed: boolean;
  /** Bought a non-intro, non-retail package/membership after enquiring. */
  conv: boolean;
  retained: boolean;

  // joined history (chronological)
  sales: Sale[];
  visitLog: Visit[];
  totalSpend: number;      // every joined sale, including pre-lead
  bookings: number;        // post-lead bookings, attended or not
  cancellations: number;   // post-lead cancelled bookings
  noShows: number;
  firstVisit: string;      // "" when never seen in class
  lastVisit: string;
  trialDate: string;       // first attended post-lead class
  firstSaleDate: string;   // first converting post-lead sale

  // derived
  createdTs: number;
  createdMonth: string; // YYYY-MM
  convertedTs: number | null;
  daysToConvert: number | null;
  fupCount: number;
  search: string;
}

export interface Dicts {
  stage: string[];
  status: string[];
  center: string[];
  cls: string[];
  source: string[];
  assoc: string[];
  chan: string[];
}

/** Dictionaries for the joined sales / bookings tables. */
interface JoinDicts {
  prod: string[];
  cat: string[];
  loc: string[];
  sold: string[];
  cls: string[];
  teach: string[];
  isnew: string[];
  memb: string[];
}

export interface LeadData {
  leads: Lead[];
  dicts: Dicts;
  totalLtv: number;
  minDate: string;
  maxDate: string;
  salesCount: number;
  visitsCount: number;
}

/* ─────────────────────────── Decode ─────────────────────────────── */

const DAY_MS = 86400000;
const dayToIso = (d: number) => new Date(d * DAY_MS).toISOString().slice(0, 10);
const isoToDay = (iso: string) => (iso ? Math.round(Date.parse(iso + "T00:00:00Z") / DAY_MS) : -1);

let cache: LeadData | null = null;

export async function loadLeads(): Promise<LeadData> {
  if (cache) return cache;
  const bin = Uint8Array.from(atob(PAYLOAD_GZ_B64), (c) => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const raw = JSON.parse(text) as {
    d: Dicts; s: string[]; r: any[][]; jd: JoinDicts; sl: number[][]; vs: number[][];
  };
  const { d, s, jd } = raw;
  const S = (i: number) => (i < 0 ? "" : s[i]);

  let totalLtv = 0;
  let minTs = Infinity;
  let maxTs = -Infinity;

  const leads: Lead[] = raw.r.map((r) => {
    const created = r[4] as string;
    const createdTs = created ? Date.parse(created + "T00:00:00") : 0;
    if (createdTs && createdTs < minTs) minTs = createdTs;
    if (createdTs && createdTs > maxTs) maxTs = createdTs;
    const fups: FollowUp[] = [];
    const f = r[15] as any[];
    for (let i = 0; i < f.length; i += 2) fups.push({ d: f[i] as string, c: S(f[i + 1]) });
    return {
      id: r[0],
      name: r[1],
      phone: r[2],
      email: r[3],
      created,
      converted: "",
      stage: d.stage[r[6]],
      status: d.status[r[7]],
      center: d.center[r[8]],
      cls: d.cls[r[9]],
      source: d.source[r[10]],
      associate: d.assoc[r[11]],
      channel: d.chan[r[12]],
      memberId: r[13],
      remarks: S(r[14]),
      fups,
      purchases: 0,
      ltv: 0,
      visits: 0,
      trialed: false,
      conv: false,
      retained: r[21] === 1,
      sales: [],
      visitLog: [],
      totalSpend: 0,
      bookings: 0,
      cancellations: 0,
      noShows: 0,
      firstVisit: "",
      lastVisit: "",
      trialDate: "",
      firstSaleDate: "",
      createdTs,
      createdMonth: created.slice(0, 7),
      convertedTs: null,
      daysToConvert: null,
      fupCount: fups.length,
      search: `${r[1]} ${r[3]} ${r[2]} ${r[0]} ${S(r[14])}`.toLowerCase(),
    } as Lead;
  });

  // ── attach sales history ──────────────────────────────────────────
  // rows: [leadIdx, day, prod, cat, loc, soldBy, value, converting, membership]
  const createdDay = leads.map((l) => isoToDay(l.created));
  for (const row of raw.sl) {
    const l = leads[row[0]];
    const cd = createdDay[row[0]];
    const postLead = cd >= 0 && row[1] >= cd;
    const sale: Sale = {
      day: row[1],
      date: dayToIso(row[1]),
      product: jd.prod[row[2]],
      category: jd.cat[row[3]],
      location: jd.loc[row[4]],
      soldBy: jd.sold[row[5]],
      value: row[6],
      converting: row[7] === 1,
      membership: jd.memb[row[8]],
      postLead,
    };
    l.sales.push(sale);
    l.totalSpend += sale.value;
    if (!postLead) continue;
    l.ltv += sale.value;
    if (sale.converting) {
      l.purchases++;
      if (!l.conv) {
        l.conv = true;
        l.firstSaleDate = sale.date;
        l.converted = sale.date;
        l.convertedTs = Date.parse(sale.date + "T00:00:00");
        l.daysToConvert = Math.max(0, row[1] - cd);
      }
    }
  }

  // ── attach visit history ──────────────────────────────────────────
  // rows: [leadIdx, day, cls, loc, teacher, isNew, flags, membership]
  for (const row of raw.vs) {
    const l = leads[row[0]];
    const cd = createdDay[row[0]];
    const postLead = cd >= 0 && row[1] >= cd;
    const flags = row[6];
    const attended = (flags & 1) === 1;
    const visit: Visit = {
      day: row[1],
      date: dayToIso(row[1]),
      cls: jd.cls[row[2]],
      location: jd.loc[row[3]],
      teacher: jd.teach[row[4]],
      kind: jd.isnew[row[5]],
      membership: jd.memb[row[7]],
      attended,
      cancelled: (flags & 2) === 2,
      lateCancelled: (flags & 4) === 4,
      noShow: (flags & 8) === 8,
      postLead,
    };
    l.visitLog.push(visit);
    if (attended) {
      if (!l.firstVisit) l.firstVisit = visit.date;
      l.lastVisit = visit.date;
    }
    if (!postLead) continue;
    l.bookings++;
    if (visit.cancelled) l.cancellations++;
    if (visit.noShow) l.noShows++;
    if (attended) {
      l.visits++;
      if (!l.trialed) {
        l.trialed = true;
        l.trialDate = visit.date;
      }
    }
  }

  for (const l of leads) totalLtv += l.ltv;

  const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  cache = {
    leads,
    dicts: d,
    totalLtv,
    minDate: iso(minTs),
    maxDate: iso(maxTs),
    salesCount: raw.sl.length,
    visitsCount: raw.vs.length,
  };
  return cache;
}

/* ───────────────────── Stage phases / semantics ─────────────────── */

export type Tone = "mint" | "rose" | "sky" | "amber" | "violet" | "cyan" | "zinc" | "ember";

/* Colours are CSS custom properties, not literals, so light mode can restate
   them without every component knowing which theme is on. */
export const STATUS_META: Record<string, { color: string; label: string; tone: Tone }> = {
  Won: { color: "var(--color-mint-400)", label: "Won", tone: "mint" },
  Lost: { color: "var(--color-rose-400)", label: "Lost", tone: "rose" },
  Open: { color: "var(--color-sky-400)", label: "Open", tone: "sky" },
  "Trial Completed": { color: "var(--color-violet-400)", label: "Trial Completed", tone: "violet" },
  "Trial Scheduled": { color: "var(--color-cyan-400)", label: "Trial Scheduled", tone: "cyan" },
  Unresponsive: { color: "var(--color-gold-400)", label: "Unresponsive", tone: "amber" },
  Disqualified: { color: "var(--color-zinc-400)", label: "Disqualified", tone: "zinc" },
  Uncategorized: { color: "var(--color-mist-500)", label: "Uncategorized", tone: "zinc" },
};
export const statusColor = (s: string) => STATUS_META[s]?.color ?? "var(--color-mist-500)";

/** A translucent wash of any colour — safe with CSS variables. */
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export type Phase = "Prospect" | "Engagement" | "Trial" | "Decision" | "Won" | "Lost";

export const PHASE_META: Record<Phase, { color: string; rank: number }> = {
  Prospect: { color: "var(--color-sky-400)", rank: 0 },
  Engagement: { color: "var(--color-gold-400)", rank: 1 },
  Trial: { color: "var(--color-violet-400)", rank: 2 },
  Decision: { color: "var(--color-cyan-400)", rank: 3 },
  Won: { color: "var(--color-mint-400)", rank: 4 },
  Lost: { color: "var(--color-rose-400)", rank: 5 },
};

export function stagePhase(stage: string): Phase {
  if (stage === "Membership Sold") return "Won";
  if (/^Not Interested|^Lead Dropped|Language Barrier|Invalid Contact|Will (get back|come back)/.test(stage)) return "Lost";
  if (/^Trial (Scheduled|Rescheduled)/.test(stage)) return "Trial";
  if (/^Trial Completed|No Response after Trial|Positive Trial Feedback|Post Trial/.test(stage)) return "Decision";
  if (/^New Enquiry|^Initial Contact|Introductory|^Uncategorized/.test(stage)) return "Prospect";
  return "Engagement";
}

/* ─────────────────────────── Formatters ─────────────────────────── */

const inrCompact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const inrFull = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const numFull = new Intl.NumberFormat("en-IN");
const numCompact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = {
  int: (n: number) => numFull.format(Math.round(n)),
  compact: (n: number) => numCompact.format(n),
  inr: (n: number) => "₹" + inrFull.format(Math.round(n)),
  // below a thousand the compact form ("₹403.6") reads worse than the plain one
  inrC: (n: number) => "₹" + (Math.abs(n) < 1000 ? inrFull.format(Math.round(n)) : inrCompact.format(n)),
  pct: (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) + "%" : "—"),
  date: (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  },
  month: (ym: string) => {
    const d = new Date(ym + "-01T00:00:00");
    return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  },
  daysAgo: (iso: string) => {
    if (!iso) return "—";
    const t = Date.parse(iso + "T00:00:00");
    const days = Math.max(0, Math.round((Date.now() - t) / 86400000));
    if (days === 0) return "today";
    if (days === 1) return "1d ago";
    if (days < 31) return `${days}d ago`;
    if (days < 365) return `${Math.round(days / 30.4)}mo ago`;
    return `${(days / 365).toFixed(1)}y ago`;
  },
  phone: (p: string) => {
    if (!p) return "—";
    const d = p.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    return "+" + d;
  },
};

/* ─────────────────────────── Mix utilities ──────────────────────── */

export const PALETTE = Array.from({ length: 10 }, (_, i) => `var(--color-series-${i + 1})`);

export const CHANNEL_SHORT: Record<string, string> = {
  "Website & Online Sources": "Website & Online",
  "Direct & Walk-in ◉ Leads": "Direct & Walk-in",
  "Referrals & Word-of-Mouth": "Referrals & WOM",
  "Social Media & Influencer Marketing": "Social & Influencer",
  "Calls, Messages & Automated Enquiries": "Calls & Messages",
  "Miscellaneous & Other": "Misc & Other",
  Unknown: "Unknown",
};
export const shortChannel = (c: string) => CHANNEL_SHORT[c] ?? (c.length > 18 ? c.slice(0, 17) + "…" : c);

export const CENTER_SHORT: Record<string, string> = {
  "Kenkere House, Bengaluru": "Kenkere House · BLR",
  "Supreme HQ, Bandra": "Supreme HQ · Bandra",
  "Kwality House, Kemps Corner": "Kwality House · Kemps",
  "the Studio by Copper + Cloves, Indiranagar": "Copper + Cloves · Indiranagar",
  "Plash Pilates": "Plash Pilates",
  "Physique 57 India": "P57 India",
  "Pop-up & Outdoor": "Pop-up & Outdoor",
};
export const shortCenter = (c: string) => CENTER_SHORT[c] ?? c;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Deterministic soft hue from a string — for avatar gradients. */
export function hueOf(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 62%)`;
}
