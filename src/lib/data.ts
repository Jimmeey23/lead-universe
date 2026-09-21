import payloadRaw from "../data/payload.txt?raw";
const PAYLOAD_GZ_B64: string = payloadRaw.replace(/\s+/g, "");

/* ────────────────────────────── Types ────────────────────────────── */

export interface FollowUp {
  d: string;
  c: string;
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
  purchases: number;
  ltv: number;
  visits: number;
  trialed: boolean;
  conv: boolean;
  retained: boolean;
  // derived
  createdTs: number;
  createdMonth: string; // YYYY-MM
  convertedTs: number | null;
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

export interface LeadData {
  leads: Lead[];
  dicts: Dicts;
  totalLtv: number;
  minDate: string;
  maxDate: string;
}

/* ─────────────────────────── Decode ─────────────────────────────── */

let cache: LeadData | null = null;

export async function loadLeads(): Promise<LeadData> {
  if (cache) return cache;
  const bin = Uint8Array.from(atob(PAYLOAD_GZ_B64), (c) => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const raw = JSON.parse(text) as { d: Dicts; s: string[]; r: any[][] };
  const { d, s } = raw;
  const S = (i: number) => (i < 0 ? "" : s[i]);

  let totalLtv = 0;
  let minTs = Infinity;
  let maxTs = -Infinity;

  const leads: Lead[] = raw.r.map((r) => {
    const created = r[4] as string;
    const converted = (r[5] as string) || "";
    const createdTs = created ? Date.parse(created + "T00:00:00") : 0;
    const convertedTs = converted ? Date.parse(converted + "T00:00:00") : null;
    if (createdTs && createdTs < minTs) minTs = createdTs;
    if (createdTs && createdTs > maxTs) maxTs = createdTs;
    totalLtv += r[17];
    const fups: FollowUp[] = [];
    const f = r[15] as any[];
    for (let i = 0; i < f.length; i += 2) fups.push({ d: f[i] as string, c: S(f[i + 1]) });
    return {
      id: r[0],
      name: r[1],
      phone: r[2],
      email: r[3],
      created,
      converted,
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
      purchases: r[16],
      ltv: r[17],
      visits: r[18],
      trialed: r[19] === 1,
      conv: r[20] === 1,
      retained: r[21] === 1,
      createdTs,
      createdMonth: created.slice(0, 7),
      convertedTs,
      fupCount: fups.length,
      search: `${r[1]} ${r[3]} ${r[2]} ${r[0]} ${S(r[14])}`.toLowerCase(),
    };
  });

  const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  cache = {
    leads,
    dicts: d,
    totalLtv,
    minDate: iso(minTs),
    maxDate: iso(maxTs),
  };
  return cache;
}

/* ───────────────────── Stage phases / semantics ─────────────────── */

export type Tone = "mint" | "rose" | "sky" | "amber" | "violet" | "cyan" | "zinc" | "ember";

export const STATUS_META: Record<string, { color: string; label: string; tone: Tone }> = {
  Won: { color: "#34d399", label: "Won", tone: "mint" },
  Lost: { color: "#fb7185", label: "Lost", tone: "rose" },
  Open: { color: "#38bdf8", label: "Open", tone: "sky" },
  "Trial Completed": { color: "#a78bfa", label: "Trial Completed", tone: "violet" },
  "Trial Scheduled": { color: "#22d3ee", label: "Trial Scheduled", tone: "cyan" },
  Unresponsive: { color: "#fbbf24", label: "Unresponsive", tone: "amber" },
  Disqualified: { color: "#71717a", label: "Disqualified", tone: "zinc" },
  Uncategorized: { color: "#52525b", label: "Uncategorized", tone: "zinc" },
};
export const statusColor = (s: string) => STATUS_META[s]?.color ?? "#8b8f9a";

export type Phase = "Prospect" | "Engagement" | "Trial" | "Decision" | "Won" | "Lost";

export const PHASE_META: Record<Phase, { color: string; rank: number }> = {
  Prospect: { color: "#38bdf8", rank: 0 },
  Engagement: { color: "#fbbf24", rank: 1 },
  Trial: { color: "#a78bfa", rank: 2 },
  Decision: { color: "#22d3ee", rank: 3 },
  Won: { color: "#34d399", rank: 4 },
  Lost: { color: "#fb7185", rank: 5 },
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
  inrC: (n: number) => "₹" + inrCompact.format(n),
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

export const PALETTE = ["#ff6b47", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#22d3ee", "#f472b6", "#a3e635", "#94a3b8"];

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
