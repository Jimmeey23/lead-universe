import { useMemo, useState } from "react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Users, Trophy, Percent, Wallet, Timer, MessagesSquare, ArrowUpRight, ArrowDownRight,
  UserRound, Sparkles, Target,
} from "lucide-react";
import { useApp } from "../state/app";
import { associateStats, AssociateStat, monthRange } from "../lib/stats";
import { Panel, Segmented, Meter, EmptyState, Avatar } from "../components/ui";
import { Kpi } from "../components/viz";
import { fmt, PALETTE } from "../lib/data";
import { cn } from "../utils/cn";

/* ─────────────────────── Scoreboard definition ───────────────────── */

type Col = {
  id: string;
  label: string;
  title: string;
  get: (a: AssociateStat) => number;
  fmt: (a: AssociateStat) => string;
  /** false = lower is better */
  higherIsBetter?: boolean;
};

const COLS: Col[] = [
  { id: "leads", label: "Leads", title: "Leads assigned in the current filter", get: (a) => a.leads, fmt: (a) => fmt.int(a.leads) },
  { id: "trialed", label: "Trials", title: "Leads who attended a class after enquiring (Bookings sheet)", get: (a) => a.trialed, fmt: (a) => fmt.int(a.trialed) },
  { id: "converted", label: "Won", title: "Leads with a qualifying purchase after enquiring (Sales sheet)", get: (a) => a.converted, fmt: (a) => fmt.int(a.converted) },
  { id: "convRate", label: "Conv %", title: "Won ÷ leads", get: (a) => a.convRate, fmt: (a) => fmt.pct(a.convRate) },
  { id: "trialRate", label: "Trial %", title: "Trials ÷ leads", get: (a) => a.trialRate, fmt: (a) => fmt.pct(a.trialRate, 0) },
  { id: "trialToWin", label: "Trial→Won", title: "Won ÷ trials — how well they close someone who has been in class", get: (a) => a.trialToWin, fmt: (a) => fmt.pct(a.trialToWin, 0) },
  { id: "revenue", label: "Revenue", title: "Revenue booked by their leads after the enquiry date", get: (a) => a.revenue, fmt: (a) => fmt.inrC(a.revenue) },
  { id: "revPerLead", label: "Rev/lead", title: "Revenue ÷ leads", get: (a) => a.revPerLead, fmt: (a) => fmt.inrC(a.revPerLead) },
  { id: "avgDeal", label: "Avg deal", title: "Revenue ÷ won leads", get: (a) => a.avgDeal, fmt: (a) => (a.converted ? fmt.inrC(a.avgDeal) : "—") },
  { id: "touchRate", label: "Touched %", title: "Leads with at least one follow-up or remark", get: (a) => a.touchRate, fmt: (a) => fmt.pct(a.touchRate, 0) },
  { id: "avgFups", label: "F/U avg", title: "Average follow-ups logged per lead", get: (a) => a.avgFups, fmt: (a) => a.avgFups.toFixed(1) },
  {
    id: "speed", label: "1st touch", title: "Median days from enquiry to first logged follow-up — lower is better",
    get: (a) => a.medianDaysToFirstTouch ?? 999, higherIsBetter: false,
    fmt: (a) => (a.medianDaysToFirstTouch == null ? "—" : `${a.medianDaysToFirstTouch}d`),
  },
  {
    id: "cycle", label: "Days to win", title: "Median days from enquiry to the qualifying purchase — lower is better",
    get: (a) => a.medianDaysToConvert ?? 999, higherIsBetter: false,
    fmt: (a) => (a.medianDaysToConvert == null ? "—" : `${a.medianDaysToConvert}d`),
  },
];

/** Dimensions used by the radar + head-to-head bars, normalised to the cohort best. */
const RADAR_DIMS: { key: string; label: string; get: (a: AssociateStat) => number }[] = [
  { key: "volume", label: "Volume", get: (a) => a.leads },
  { key: "conv", label: "Conv %", get: (a) => a.convRate },
  { key: "trial", label: "Trial %", get: (a) => a.trialRate },
  { key: "close", label: "Trial→Won", get: (a) => a.trialToWin },
  { key: "rev", label: "Rev/lead", get: (a) => a.revPerLead },
  { key: "effort", label: "Follow-up", get: (a) => a.avgFups },
  { key: "reach", label: "Touched %", get: (a) => a.touchRate },
];

const MIN_LEADS = 20; // below this the rates are noise, so they sit out of the rankings

/* ───────────────────────────── View ──────────────────────────────── */

export function AssociatesView() {
  const { filtered, data, setFilters, setView } = useApp();
  const [sort, setSort] = useState<string>("leads");
  const [desc, setDesc] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [trendMetric, setTrendMetric] = useState<"leads" | "won" | "convRate">("leads");

  const stats = useMemo(() => associateStats(filtered), [filtered]);
  const ranked = useMemo(() => stats.filter((a) => a.leads >= MIN_LEADS), [stats]);

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.id === sort) ?? COLS[0];
    const dir = desc ? -1 : 1;
    return [...stats].sort((a, b) => (col.get(a) - col.get(b)) * dir);
  }, [stats, sort, desc]);

  // Default the comparison to the two biggest books of leads.
  const compare = useMemo(() => {
    const names = picked.length ? picked : ranked.slice(0, 2).map((a) => a.name);
    return names.map((n) => stats.find((s) => s.name === n)).filter(Boolean) as AssociateStat[];
  }, [picked, ranked, stats]);

  const best = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of RADAR_DIMS) m[d.key] = Math.max(1, ...ranked.map(d.get));
    return m;
  }, [ranked]);

  const team = useMemo(() => {
    const leads = stats.reduce((n, a) => n + a.leads, 0);
    const won = stats.reduce((n, a) => n + a.converted, 0);
    const rev = stats.reduce((n, a) => n + a.revenue, 0);
    const fups = stats.reduce((n, a) => n + a.fups, 0);
    return { leads, won, rev, fups, convRate: leads ? (won / leads) * 100 : 0 };
  }, [stats]);

  const leaders = useMemo(() => {
    const pick = (label: string, get: (a: AssociateStat) => number, format: (a: AssociateStat) => string, icon: React.ReactNode) => {
      const top = [...ranked].sort((a, b) => get(b) - get(a))[0];
      return top ? { label, name: top.name, value: format(top), icon } : null;
    };
    return [
      pick("Highest conversion", (a) => a.convRate, (a) => fmt.pct(a.convRate), <Percent className="size-3.5" />),
      pick("Most revenue", (a) => a.revenue, (a) => fmt.inrC(a.revenue), <Wallet className="size-3.5" />),
      pick("Best trial→won", (a) => a.trialToWin, (a) => fmt.pct(a.trialToWin, 0), <Target className="size-3.5" />),
      pick("Most persistent", (a) => a.avgFups, (a) => `${a.avgFups.toFixed(1)} f/u per lead`, <MessagesSquare className="size-3.5" />),
    ].filter(Boolean) as { label: string; name: string; value: string; icon: React.ReactNode }[];
  }, [ranked]);

  const months = useMemo(
    () => monthRange(data?.minDate.slice(0, 7) ?? "", data?.maxDate.slice(0, 7) ?? ""),
    [data],
  );

  const trend = useMemo(() => {
    const series = compare.length ? compare : ranked.slice(0, 4);
    return months.map((m) => {
      const point: Record<string, number | string> = { m };
      for (const a of series) {
        const v = a.months.get(m);
        point[a.name] =
          trendMetric === "convRate" ? (v && v.leads ? (v.won / v.leads) * 100 : 0) : v ? v[trendMetric] : 0;
      }
      return point;
    });
  }, [compare, ranked, months, trendMetric]);

  const trendNames = (compare.length ? compare : ranked.slice(0, 4)).map((a) => a.name);

  if (!stats.length) {
    return <EmptyState icon={<Users className="size-5" />} title="No associates in selection" sub="Reset the filters to restore the team." />;
  }

  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 4 ? [...p.slice(1), name] : [...p, name]));

  const drillTo = (name: string) => {
    setFilters((f) => ({ ...f, associates: [name] }));
    setView("explorer");
  };

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-3 pb-16 pt-4 sm:px-5">
      {/* team-level summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Associates" value={fmt.int(stats.length)} sub={`${ranked.length} with ${MIN_LEADS}+ leads`} tone="#ff6b47" />
        <Kpi icon={<Percent className="size-4" />} label="Team conversion" value={fmt.pct(team.convRate)} sub={`${fmt.int(team.won)} won of ${fmt.int(team.leads)}`} tone="#34d399" />
        <Kpi icon={<Wallet className="size-4" />} label="Revenue booked" value={fmt.inrC(team.rev)} sub="post-enquiry sales" tone="#fbbf24" />
        <Kpi icon={<MessagesSquare className="size-4" />} label="Follow-ups logged" value={fmt.compact(team.fups)} sub={`${(team.leads ? team.fups / team.leads : 0).toFixed(1)} per lead`} tone="#a78bfa" />
      </div>

      {/* leaderboard callouts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {leaders.map((l) => (
          <button
            key={l.label}
            onClick={() => toggle(l.name)}
            className="card card-hover flex items-center gap-3 p-3 text-left"
          >
            <Avatar name={l.name} size={34} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mist-600">
                {l.icon} {l.label}
              </p>
              <p className="truncate text-[12.5px] font-medium text-mist-100">{l.name}</p>
              <p className="tnum text-[11px] text-ember-400">{l.value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* scoreboard */}
      <Panel
        title="Associate scoreboard"
        sub={`Every associate on the same columns · tick up to 4 to compare · rates for ${MIN_LEADS}+ lead books are ranked`}
        right={
          <button
            onClick={() => setPicked([])}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-mist-400 transition-colors hover:text-mist-100"
          >
            Clear selection
          </button>
        }
        pad={false}
      >
        <div className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Associate</th>
                {COLS.map((c) => (
                  <th
                    key={c.id}
                    title={c.title}
                    onClick={() => {
                      if (sort === c.id) setDesc((d) => !d);
                      else { setSort(c.id); setDesc(c.higherIsBetter !== false); }
                    }}
                    className={cn(
                      "cursor-pointer select-none px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                      sort === c.id ? "text-ember-400" : "text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {c.label}
                    {sort === c.id && <span className="ml-1">{desc ? "▾" : "▴"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const on = compare.some((c) => c.name === a.name);
                const thin = a.leads < MIN_LEADS;
                return (
                  <tr
                    key={a.name}
                    onClick={() => toggle(a.name)}
                    className={cn(
                      "cursor-pointer border-b border-line-soft/60 transition-colors hover:bg-ink-850",
                      on && "bg-ember-500/[0.07]",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-3.5 shrink-0 items-center justify-center rounded border",
                            on ? "border-ember-500 bg-ember-500" : "border-line-strong",
                          )}
                        >
                          {on && <span className="size-1.5 rounded-sm bg-onaccent" />}
                        </span>
                        <Avatar name={a.name} size={24} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-mist-100">{a.name}</p>
                          <p className="truncate text-[10px] text-mist-600">
                            {fmt.pct(a.share, 0)} of volume · {a.topCentre}
                          </p>
                        </div>
                        {thin && (
                          <span className="rounded bg-ink-750 px-1.5 py-px text-[9px] text-mist-500" title={`Fewer than ${MIN_LEADS} leads — rates are unreliable`}>
                            thin
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); drillTo(a.name); }}
                          title="Open this book in Explorer"
                          className="ml-auto text-mist-600 transition-colors hover:text-ember-400"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    {COLS.map((c) => {
                      const v = c.get(a);
                      const pool = ranked.map(c.get);
                      const bestV = c.higherIsBetter === false ? Math.min(...pool) : Math.max(...pool);
                      const isBest = !thin && pool.length > 1 && v === bestV;
                      return (
                        <td key={c.id} className="px-3 py-2 text-right">
                          <span className={cn("tnum text-[12px]", isBest ? "font-semibold text-mint-400" : "text-mist-300")}>
                            {c.fmt(a)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* head to head */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel title="Shape of the book" sub="Each axis scaled to the best performer in the cohort">
          {compare.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart
                data={RADAR_DIMS.map((d) => {
                  const p: Record<string, number | string> = { dim: d.label };
                  for (const a of compare) p[a.name] = Math.round((d.get(a) / best[d.key]) * 100);
                  return p;
                })}
              >
                <PolarGrid stroke="var(--color-line)" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--color-mist-500)", fontSize: 10.5 }} />
                {compare.map((a, i) => (
                  <Radar
                    key={a.name}
                    name={a.name}
                    dataKey={a.name}
                    stroke={PALETTE[i % PALETTE.length]}
                    fill={PALETTE[i % PALETTE.length]}
                    fillOpacity={0.16}
                    strokeWidth={1.8}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => `${v}% of best`}
                  contentStyle={{
                    background: "var(--color-ink-850)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 10,
                    fontSize: 11.5,
                    boxShadow: "var(--shadow-panel)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-[12px] text-mist-600">Pick an associate in the scoreboard.</p>
          )}
        </Panel>

        <Panel
          title="Month by month"
          sub="Selected associates over the full window"
          right={
            <Segmented
              size="sm"
              value={trendMetric}
              onChange={(v) => setTrendMetric(v as typeof trendMetric)}
              options={[
                { value: "leads", label: "Leads" },
                { value: "won", label: "Won" },
                { value: "convRate", label: "Conv %" },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tickFormatter={(v: any) => fmt.month(String(v))} tickLine={false} axisLine={false} minTickGap={22} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => (trendMetric === "convRate" ? `${v}%` : fmt.compact(v))} />
              <Tooltip
                labelFormatter={(l: any) => fmt.month(String(l))}
                formatter={(v: any) => (trendMetric === "convRate" ? fmt.pct(Number(v)) : fmt.int(Number(v)))}
                contentStyle={{
                  background: "var(--color-ink-850)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 10,
                  fontSize: 11.5,
                  boxShadow: "var(--shadow-panel)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {trendNames.map((n, i) => (
                <Line key={n} type="monotone" dataKey={n} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.8} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* per-associate dossiers */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(compare.length ? compare : ranked.slice(0, 3)).map((a, i) => (
          <Dossier key={a.name} a={a} tone={PALETTE[i % PALETTE.length]} cohort={ranked} onOpen={() => drillTo(a.name)} />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── Dossier card ─────────────────────────── */

function Dossier({
  a, tone, cohort, onOpen,
}: {
  a: AssociateStat;
  tone: string;
  cohort: AssociateStat[];
  onOpen: () => void;
}) {
  const avg = (get: (x: AssociateStat) => number) =>
    cohort.length ? cohort.reduce((n, x) => n + get(x), 0) / cohort.length : 0;

  const rows: { label: string; value: string; v: number; peer: number; invert?: boolean }[] = [
    { label: "Conversion", value: fmt.pct(a.convRate), v: a.convRate, peer: avg((x) => x.convRate) },
    { label: "Trial rate", value: fmt.pct(a.trialRate, 0), v: a.trialRate, peer: avg((x) => x.trialRate) },
    { label: "Trial → won", value: fmt.pct(a.trialToWin, 0), v: a.trialToWin, peer: avg((x) => x.trialToWin) },
    { label: "Revenue / lead", value: fmt.inrC(a.revPerLead), v: a.revPerLead, peer: avg((x) => x.revPerLead) },
    { label: "Follow-ups / lead", value: a.avgFups.toFixed(1), v: a.avgFups, peer: avg((x) => x.avgFups) },
    {
      label: "Days to first touch",
      value: a.medianDaysToFirstTouch == null ? "—" : `${a.medianDaysToFirstTouch}d`,
      v: a.medianDaysToFirstTouch ?? 0,
      peer: avg((x) => x.medianDaysToFirstTouch ?? 0),
      invert: true,
    },
  ];

  return (
    <section className="card card-hover overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <Avatar name={a.name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13.5px] font-semibold text-mist-100">{a.name}</p>
          <p className="truncate text-[11px] text-mist-500">
            {fmt.int(a.leads)} leads · {a.topCentre} · top source {a.topSource}
          </p>
        </div>
        <button onClick={onOpen} title="Open in Explorer" className="text-mist-600 transition-colors hover:text-ember-400">
          <ArrowUpRight className="size-4" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {[
          { icon: <Trophy className="size-3.5" />, label: "Won", value: fmt.int(a.converted) },
          { icon: <Sparkles className="size-3.5" />, label: "Trials", value: fmt.int(a.trialed) },
          { icon: <Wallet className="size-3.5" />, label: "Revenue", value: fmt.inrC(a.revenue) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-line-soft bg-ink-850/50 p-2 text-center">
            <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-md" style={{ color: tone, background: tone + "16" }}>
              {k.icon}
            </span>
            <p className="tnum text-[13px] font-semibold text-mist-100">{k.value}</p>
            <p className="text-[9px] uppercase tracking-wider text-mist-600">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 px-4 pb-4">
        {rows.map((r) => {
          const delta = r.peer ? ((r.v - r.peer) / r.peer) * 100 : 0;
          const good = r.invert ? delta <= 0 : delta >= 0;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="text-mist-400">{r.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="tnum font-medium text-mist-100">{r.value}</span>
                  <span className={cn("tnum flex items-center text-[10px]", good ? "text-mint-400" : "text-rose-400")}>
                    {good ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                    {Math.abs(delta).toFixed(0)}%
                  </span>
                </span>
              </div>
              <Meter value={r.v} max={Math.max(r.v, r.peer) * 1.2 || 1} color={tone} className="mt-1" />
              <p className="mt-0.5 text-[9.5px] text-mist-600">team avg {r.invert ? `${r.peer.toFixed(0)}d` : r.peer.toFixed(r.peer < 10 ? 1 : 0)}</p>
            </div>
          );
        })}
      </div>

      <footer className="flex items-center gap-1.5 border-t border-line-soft px-4 py-2.5 text-[10.5px] text-mist-600">
        <Timer className="size-3" />
        {a.medianDaysToConvert == null ? "No completed conversions yet" : `Median ${a.medianDaysToConvert}d from enquiry to purchase`}
        <span className="ml-auto flex items-center gap-1">
          <UserRound className="size-3" />
          {fmt.int(a.untouched)} untouched
        </span>
      </footer>
    </section>
  );
}
