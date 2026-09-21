import { useMemo, useState } from "react";
import {
  LabelList,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Bar, Area, Cell, PieChart, Pie,
} from "recharts";
import {
  Users, Trophy, Percent, Wallet, Timer, MessagesSquare, ArrowUpRight,
  Sparkles, Target, Swords, Crosshair, AlertTriangle, PackageOpen, Gauge, Layers,
  CalendarClock, Footprints, Flame, Minus,
} from "lucide-react";
import { useApp, useResolvedColors } from "../state/app";
import {
  associateStats, associateDetail, assocSpark, monthRange, funnel,
  AssociateStat, AssociateDetail,
} from "../lib/stats";
import { Panel, Segmented, Meter, EmptyState, Avatar } from "../components/ui";
import { Kpi, Funnel, Spark } from "../components/viz";
import { fmt, PALETTE, tint, statusColor, shortCenter } from "../lib/data";
import { cn } from "../utils/cn";

/* ───────────────────────── Metric catalogue ──────────────────────── */

type Col = {
  id: string;
  label: string;
  title: string;
  get: (a: AssociateStat) => number;
  fmt: (a: AssociateStat) => string;
  /** false = lower is better */
  higherIsBetter?: boolean;
  /** draw an inline bar under the value */
  bar?: boolean;
};

const COLS: Col[] = [
  { id: "leads", label: "Leads", title: "Leads assigned in the current filter", get: (a) => a.leads, fmt: (a) => fmt.int(a.leads), bar: true },
  { id: "trialed", label: "Trials", title: "Leads who attended a class after enquiring (Bookings sheet)", get: (a) => a.trialed, fmt: (a) => fmt.int(a.trialed) },
  { id: "converted", label: "Won", title: "Leads with a qualifying purchase after enquiring (Sales sheet)", get: (a) => a.converted, fmt: (a) => fmt.int(a.converted) },
  { id: "convRate", label: "Conv %", title: "Won ÷ leads", get: (a) => a.convRate, fmt: (a) => fmt.pct(a.convRate), bar: true },
  { id: "trialRate", label: "Trial %", title: "Trials ÷ leads", get: (a) => a.trialRate, fmt: (a) => fmt.pct(a.trialRate, 0), bar: true },
  { id: "trialToWin", label: "Trial→Won", title: "Won ÷ trials — how well they close someone who has already been in class", get: (a) => a.trialToWin, fmt: (a) => fmt.pct(a.trialToWin, 0), bar: true },
  { id: "revenue", label: "Revenue", title: "Revenue booked by their leads after the enquiry date", get: (a) => a.revenue, fmt: (a) => fmt.inrC(a.revenue), bar: true },
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

const RADAR_DIMS: { key: string; label: string; get: (a: AssociateStat) => number }[] = [
  { key: "volume", label: "Volume", get: (a) => a.leads },
  { key: "conv", label: "Conv %", get: (a) => a.convRate },
  { key: "trial", label: "Trial %", get: (a) => a.trialRate },
  { key: "close", label: "Trial→Won", get: (a) => a.trialToWin },
  { key: "rev", label: "Rev/lead", get: (a) => a.revPerLead },
  { key: "effort", label: "Follow-up", get: (a) => a.avgFups },
  { key: "reach", label: "Touched %", get: (a) => a.touchRate },
];

/** Metrics shown as mirrored bars in the head-to-head. */
const H2H: { label: string; get: (a: AssociateStat) => number; fmt: (n: number) => string; invert?: boolean }[] = [
  { label: "Leads handled", get: (a) => a.leads, fmt: (n) => fmt.int(n) },
  { label: "Conversion %", get: (a) => a.convRate, fmt: (n) => fmt.pct(n) },
  { label: "Trial rate %", get: (a) => a.trialRate, fmt: (n) => fmt.pct(n, 0) },
  { label: "Trial → won %", get: (a) => a.trialToWin, fmt: (n) => fmt.pct(n, 0) },
  { label: "Revenue", get: (a) => a.revenue, fmt: (n) => fmt.inrC(n) },
  { label: "Revenue / lead", get: (a) => a.revPerLead, fmt: (n) => fmt.inrC(n) },
  { label: "Average deal", get: (a) => a.avgDeal, fmt: (n) => fmt.inrC(n) },
  { label: "Follow-ups / lead", get: (a) => a.avgFups, fmt: (n) => n.toFixed(1) },
  { label: "Touched %", get: (a) => a.touchRate, fmt: (n) => fmt.pct(n, 0) },
  { label: "Days to first touch", get: (a) => a.medianDaysToFirstTouch ?? 0, fmt: (n) => `${n.toFixed(0)}d`, invert: true },
  { label: "Days to win", get: (a) => a.medianDaysToConvert ?? 0, fmt: (n) => `${n.toFixed(0)}d`, invert: true },
];

const MIN_LEADS = 20; // below this the rates are noise, so they sit out of the rankings

const TT = {
  background: "var(--color-ink-850)",
  border: "1px solid var(--color-line)",
  borderRadius: 10,
  fontSize: 11.5,
  boxShadow: "var(--shadow-panel)",
  color: "var(--color-mist-100)",
} as const;

/* ─────────────────────────────── View ───────────────────────────── */

export function AssociatesView() {
  const { filtered, data, setFilters, setView } = useApp();
  const [sort, setSort] = useState<string>("leads");
  const [desc, setDesc] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<"leads" | "won" | "convRate">("leads");
  const [drillTab, setDrillTab] = useState<"mix" | "effort" | "money">("mix");
  const solid = useResolvedColors(PALETTE);

  const months = useMemo(
    () => monthRange(data?.minDate.slice(0, 7) ?? "", data?.maxDate.slice(0, 7) ?? ""),
    [data],
  );
  const stats = useMemo(() => associateStats(filtered), [filtered]);
  const ranked = useMemo(() => stats.filter((a) => a.leads >= MIN_LEADS), [stats]);

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.id === sort) ?? COLS[0];
    const dir = desc ? -1 : 1;
    return [...stats].sort((a, b) => (col.get(a) - col.get(b)) * dir);
  }, [stats, sort, desc]);

  const compare = useMemo(() => {
    const names = picked.length ? picked : ranked.slice(0, 2).map((a) => a.name);
    return names.map((n) => stats.find((s) => s.name === n)).filter(Boolean) as AssociateStat[];
  }, [picked, ranked, stats]);

  const focused = focus ?? compare[0]?.name ?? null;
  const detail = useMemo(
    () => (focused ? associateDetail(focused, filtered, months) : null),
    [focused, filtered, months],
  );
  const focusStat = stats.find((s) => s.name === focused) ?? null;

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
    const rates = ranked.map((a) => a.convRate).sort((x, y) => x - y);
    return {
      leads, won, rev, fups,
      convRate: leads ? (won / leads) * 100 : 0,
      spread: rates.length ? rates[rates.length - 1] - rates[0] : 0,
    };
  }, [stats, ranked]);

  const leaders = useMemo(() => {
    const pick = (
      label: string,
      get: (a: AssociateStat) => number,
      format: (a: AssociateStat) => string,
      icon: React.ReactNode,
      tone: string,
    ) => {
      const top = [...ranked].sort((a, b) => get(b) - get(a))[0];
      return top ? { label, name: top.name, value: format(top), icon, tone } : null;
    };
    return [
      pick("Highest conversion", (a) => a.convRate, (a) => fmt.pct(a.convRate), <Percent className="size-3.5" />, "var(--color-mint-400)"),
      pick("Most revenue", (a) => a.revenue, (a) => fmt.inrC(a.revenue), <Wallet className="size-3.5" />, "var(--color-gold-400)"),
      pick("Best trial→won", (a) => a.trialToWin, (a) => fmt.pct(a.trialToWin, 0), <Target className="size-3.5" />, "var(--color-violet-400)"),
      pick("Fastest first touch", (a) => -(a.medianDaysToFirstTouch ?? 99), (a) => `${a.medianDaysToFirstTouch ?? "—"}d to first follow-up`, <Timer className="size-3.5" />, "var(--color-sky-400)"),
    ].filter(Boolean) as { label: string; name: string; value: string; icon: React.ReactNode; tone: string }[];
  }, [ranked]);

  const trendSeries = compare.length ? compare : ranked.slice(0, 4);
  const trend = useMemo(
    () =>
      months.map((m) => {
        const point: Record<string, number | string> = { m };
        for (const a of trendSeries) {
          const v = a.months.get(m);
          point[a.name] =
            trendMetric === "convRate" ? (v && v.leads ? (v.won / v.leads) * 100 : 0) : v ? v[trendMetric] : 0;
        }
        return point;
      }),
    [trendSeries, months, trendMetric],
  );

  if (!stats.length) {
    return <EmptyState icon={<Users className="size-5" />} title="No associates in selection" sub="Reset the filters to restore the team." />;
  }

  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 4 ? [...p.slice(1), name] : [...p, name]));

  const drillTo = (name: string) => {
    setFilters((f) => ({ ...f, associates: [name] }));
    setView("explorer");
  };

  const avgConv = team.convRate;
  const avgLeads = ranked.length ? ranked.reduce((n, a) => n + a.leads, 0) / ranked.length : 0;

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-3 pb-16 pt-4 sm:px-5">
      {/* ── team header ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<Users className="size-4" />} label="Associates" value={fmt.int(stats.length)} sub={`${ranked.length} with ${MIN_LEADS}+ leads`} tone="var(--color-ember-500)" />
        <Kpi icon={<Percent className="size-4" />} label="Team conversion" value={fmt.pct(team.convRate)} sub={`${fmt.int(team.won)} won of ${fmt.int(team.leads)}`} tone="var(--color-mint-400)" />
        <Kpi icon={<Wallet className="size-4" />} label="Revenue booked" value={fmt.inrC(team.rev)} sub="post-enquiry sales" tone="var(--color-gold-400)" />
        <Kpi icon={<MessagesSquare className="size-4" />} label="Follow-ups" value={fmt.compact(team.fups)} sub={`${(team.leads ? team.fups / team.leads : 0).toFixed(1)} per lead`} tone="var(--color-violet-400)" />
        <Kpi icon={<Gauge className="size-4" />} label="Conversion spread" value={`${team.spread.toFixed(1)}pt`} sub="best minus worst ranked" tone="var(--color-sky-400)" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {leaders.map((l) => (
          <button
            key={l.label}
            onClick={() => { setFocus(l.name); if (!picked.includes(l.name)) toggle(l.name); }}
            className="card card-hover flex items-center gap-3 p-3 text-left"
          >
            <Avatar name={l.name} size={34} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: l.tone }}>
                {l.icon} {l.label}
              </p>
              <p className="truncate text-[12.5px] font-medium text-mist-100">{l.name}</p>
              <p className="tnum text-[11px] text-mist-500">{l.value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── quadrant map ────────────────────────────────────────── */}
      <Panel
        title="Volume vs conversion"
        sub={`Bubble size is revenue · crosshairs sit at the team average · ${MIN_LEADS}+ lead books only`}
        right={
          <div className="hidden items-center gap-3 text-[10px] text-mist-500 sm:flex">
            <span className="flex items-center gap-1"><Flame className="size-3 text-mint-400" /> high volume &amp; high conversion, top-right</span>
            <span className="flex items-center gap-1"><Crosshair className="size-3 text-rose-400" /> big book, low conversion, bottom-right</span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 18, left: -6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="leads" name="Leads" tickLine={false} axisLine={false}
              tickFormatter={(v: any) => fmt.compact(Number(v))}
              label={{ value: "leads handled", position: "insideBottom", offset: -10, fill: "var(--color-mist-500)", fontSize: 10.5 }}
            />
            <YAxis
              type="number" dataKey="convRate" name="Conv %" tickLine={false} axisLine={false} width={46}
              tickFormatter={(v: any) => `${Number(v).toFixed(0)}%`}
            />
            <ZAxis type="number" dataKey="revenue" range={[60, 900]} name="Revenue" />
            <ReferenceLine x={avgLeads} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
            <ReferenceLine y={avgConv} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const d: any = payload?.[0]?.payload;
                if (!d) return null;
                return (
                  <div className="card px-3 py-2 text-[11.5px]">
                    <p className="font-semibold text-mist-100">{d.name}</p>
                    <p className="tnum text-mist-400">{fmt.int(d.leads)} leads · {fmt.pct(d.convRate)} conv</p>
                    <p className="tnum text-gold-400">{fmt.inr(d.revenue)} revenue</p>
                  </div>
                );
              }}
            />
            <Scatter data={ranked} onClick={(p: any) => setFocus(p?.name)}>
              {ranked.map((a, i) => {
                const on = compare.some((c) => c.name === a.name);
                return (
                  <Cell
                    key={a.name}
                    fill={tint(PALETTE[i % PALETTE.length], on ? 85 : 38)}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={on ? 2 : 1}
                    cursor="pointer"
                  />
                );
              })}
              <LabelList
                dataKey="name"
                position="top"
                offset={9}
                fill="var(--color-mist-500)"
                fontSize={9.5}
                formatter={(v: any) => String(v).split(" ")[0]}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── scoreboard ──────────────────────────────────────────── */}
      <Panel
        title="Associate scoreboard"
        sub="Tick up to 4 to compare · click a name to drill down · bars are relative to the best in the team"
        right={
          <button
            onClick={() => setPicked([])}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-mist-400 transition-colors hover:border-line-strong hover:text-mist-100"
          >
            Clear selection
          </button>
        }
        pad={false}
      >
        <div className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[1240px]">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Associate</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Intake</th>
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
                      sort === c.id ? "text-ember-500" : "text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {c.label}
                    {sort === c.id && <span className="ml-1">{desc ? "▾" : "▴"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, rank) => {
                const on = compare.some((c) => c.name === a.name);
                const isFocus = a.name === focused;
                const thin = a.leads < MIN_LEADS;
                return (
                  <tr
                    key={a.name}
                    className={cn(
                      "border-b border-line-soft/60 transition-colors hover:bg-ink-850",
                      on && "bg-ember-500/[0.06]",
                      isFocus && "shadow-[inset_3px_0_0_0_var(--color-ember-500)]",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggle(a.name)}
                          title="Add to the comparison"
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            on ? "border-ember-500 bg-ember-500" : "border-line-strong hover:border-ember-500",
                          )}
                        >
                          {on && <span className="size-1.5 rounded-sm bg-ink-900" />}
                        </button>
                        <span className="tnum w-4 shrink-0 text-[10px] text-mist-600">{rank + 1}</span>
                        <Avatar name={a.name} size={26} />
                        <button onClick={() => setFocus(a.name)} className="min-w-0 text-left">
                          <p className="truncate text-[12.5px] font-medium text-mist-100 hover:text-ember-500">{a.name}</p>
                          <p className="truncate text-[10px] text-mist-600">
                            {fmt.pct(a.share, 0)} of volume · {shortCenter(a.topCentre)}
                          </p>
                        </button>
                        {thin && (
                          <span className="rounded bg-ink-750 px-1.5 py-px text-[9px] text-mist-500" title={`Fewer than ${MIN_LEADS} leads — rates are unreliable`}>
                            thin
                          </span>
                        )}
                        <button
                          onClick={() => drillTo(a.name)}
                          title="Open this book in Explorer"
                          className="ml-auto text-mist-600 transition-colors hover:text-ember-500"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Spark data={assocSpark(a, months)} tone={PALETTE[rank % PALETTE.length]} w={80} h={22} />
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
                          {c.bar && (
                            <Meter
                              value={v}
                              max={Math.max(...pool, v) || 1}
                              color={isBest ? "var(--color-mint-400)" : "var(--color-mist-500)"}
                              className="mt-1 h-[3px]"
                            />
                          )}
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

      {/* ── head to head ────────────────────────────────────────── */}
      {compare.length >= 2 && <HeadToHead a={compare[0]} b={compare[1]} />}

      {/* ── radar + trend ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <Panel title="Shape of the book" sub="Each axis scaled to the best performer in the team">
          {compare.length ? (
            <ResponsiveContainer width="100%" height={310}>
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
                    isAnimationActive={false}
                    key={a.name}
                    name={a.name}
                    dataKey={a.name}
                    stroke={solid[i % solid.length]}
                    fill={solid[i % solid.length]}
                    /* only the first shape is filled — overlapping washes turn muddy */
                    fillOpacity={i === 0 ? 0.14 : 0}
                    strokeWidth={1.8}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}% of best`} contentStyle={TT} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-[12px] text-mist-600">Tick an associate in the scoreboard.</p>
          )}
        </Panel>

        <Panel
          title="Month by month"
          sub="Selected associates across the whole window"
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
          <ResponsiveContainer width="100%" height={310}>
            <LineChart data={trend} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tickFormatter={(v: any) => fmt.month(String(v))} tickLine={false} axisLine={false} minTickGap={22} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: any) => (trendMetric === "convRate" ? `${v}%` : fmt.compact(Number(v)))} />
              <Tooltip
                labelFormatter={(l: any) => fmt.month(String(l))}
                formatter={(v: any) => (trendMetric === "convRate" ? fmt.pct(Number(v)) : fmt.int(Number(v)))}
                contentStyle={TT}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {trendSeries.map((a, i) => (
                <Line key={a.name} type="monotone" dataKey={a.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.9} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── drill-down ──────────────────────────────────────────── */}
      {detail && focusStat && (
        <Drill
          stat={focusStat}
          detail={detail}
          tab={drillTab}
          setTab={setDrillTab}
          onOpen={() => drillTo(focusStat.name)}
          teamConv={team.convRate}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Head-to-head ──────────────────────────── */

function HeadToHead({ a, b }: { a: AssociateStat; b: AssociateStat }) {
  const cA = PALETTE[0];
  const cB = PALETTE[1];
  const decided = H2H.filter((m) => m.get(a) !== m.get(b));
  const winsA = decided.filter((m) => (m.invert ? m.get(a) < m.get(b) : m.get(a) > m.get(b))).length;
  const winsB = decided.length - winsA;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Swords className="size-4 text-ember-500" /> Head to head
        </span>
      }
      sub="The first two ticked associates, measured line by line"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <Side stat={a} color={cA} wins={winsA} total={decided.length} align="left" />
        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">
          vs
        </span>
        <Side stat={b} color={cB} wins={winsB} total={decided.length} align="right" />
      </div>

      <div className="space-y-2.5">
        {H2H.map((m) => {
          const va = m.get(a), vb = m.get(b);
          const max = Math.max(va, vb) || 1;
          const aWins = va === vb ? null : m.invert ? va < vb : va > vb;
          return (
            <div key={m.label} className="grid grid-cols-[minmax(0,1fr)_132px_minmax(0,1fr)] items-center gap-2">
              <div className="flex items-center justify-end gap-2">
                <span className={cn("tnum shrink-0 text-[11.5px]", aWins === true ? "font-semibold text-mist-100" : "text-mist-400")}>
                  {m.fmt(va)}
                </span>
                <div className="h-2.5 w-full max-w-[260px] overflow-hidden rounded-l-full bg-ink-850">
                  <div
                    className="ml-auto h-full rounded-l-full"
                    style={{ width: `${(va / max) * 100}%`, background: aWins === true ? cA : tint(cA, 38) }}
                  />
                </div>
              </div>
              <p className="text-center text-[10.5px] text-mist-500">{m.label}</p>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-full max-w-[260px] overflow-hidden rounded-r-full bg-ink-850">
                  <div
                    className="h-full rounded-r-full"
                    style={{ width: `${(vb / max) * 100}%`, background: aWins === false ? cB : tint(cB, 38) }}
                  />
                </div>
                <span className={cn("tnum shrink-0 text-[11.5px]", aWins === false ? "font-semibold text-mist-100" : "text-mist-400")}>
                  {m.fmt(vb)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] text-mist-600">
        Lower wins on the two timing rows; the stronger side is the solid bar.
      </p>
    </Panel>
  );
}

function Side({
  stat, color, wins, total, align,
}: {
  stat: AssociateStat;
  color: string;
  wins: number;
  total: number;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      <Avatar name={stat.name} size={42} />
      <div className="min-w-0">
        <p className="truncate font-display text-[14px] font-semibold text-mist-100">{stat.name}</p>
        <p className="tnum truncate text-[11px] text-mist-500">
          {fmt.int(stat.leads)} leads · {fmt.pct(stat.convRate)} conv · {fmt.inrC(stat.revenue)}
        </p>
        <span
          className="mt-1 inline-block rounded-full px-2 py-px text-[10px] font-semibold"
          style={{ background: tint(color, 16), color }}
        >
          wins {wins} of {total}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────── Drill-down ───────────────────────────── */

function Drill({
  stat, detail, tab, setTab, onOpen, teamConv,
}: {
  stat: AssociateStat;
  detail: AssociateDetail;
  tab: "mix" | "effort" | "money";
  setTab: (t: "mix" | "effort" | "money") => void;
  onOpen: () => void;
  teamConv: number;
}) {
  const fun = useMemo(() => funnel(detail.leads), [detail.leads]);
  const alerts = [
    {
      icon: <AlertTriangle className="size-3.5" />, label: "Untouched leads", value: fmt.int(detail.untouched),
      tone: detail.untouched > detail.leads.length * 0.05 ? "var(--color-rose-400)" : "var(--color-mist-500)",
    },
    { icon: <CalendarClock className="size-3.5" />, label: "Open, cold 30d+", value: fmt.int(detail.ageingOpen), tone: "var(--color-gold-400)" },
    { icon: <Footprints className="size-3.5" />, label: "Visits per won lead", value: detail.visitsPerConverted.toFixed(1), tone: "var(--color-violet-400)" },
    { icon: <Minus className="size-3.5" />, label: "Late-cancel rate", value: fmt.pct(detail.lateCancelRate, 1), tone: "var(--color-sky-400)" },
  ];

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Avatar name={stat.name} size={26} />
          {stat.name}
          <span className="rounded-full border border-line px-2 py-px text-[10px] font-normal text-mist-500">drill-down</span>
        </span>
      }
      sub={`${fmt.int(stat.leads)} leads · ${fmt.pct(stat.convRate)} conversion against a team ${fmt.pct(teamConv)} · top source ${stat.topSource}`}
      right={
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: "mix", label: "Mix" },
              { value: "effort", label: "Effort" },
              { value: "money", label: "Money" },
            ]}
          />
          <button
            onClick={onOpen}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] text-mist-400 transition-colors hover:border-line-strong hover:text-mist-100"
          >
            Open leads <ArrowUpRight className="size-3" />
          </button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {alerts.map((al) => (
          <div key={al.label} className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-ink-850/50 px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-md" style={{ color: al.tone, background: tint(al.tone, 12) }}>
              {al.icon}
            </span>
            <div>
              <p className="tnum text-[14px] font-semibold text-mist-100">{al.value}</p>
              <p className="text-[9.5px] uppercase tracking-wider text-mist-600">{al.label}</p>
            </div>
          </div>
        ))}
      </div>

      {tab === "mix" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <SubTitle icon={<Layers className="size-3" />}>Their funnel</SubTitle>
            <Funnel steps={fun} />
          </div>
          <div>
            <SubTitle icon={<Users className="size-3" />}>Status of their book</SubTitle>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={detail.statusMix} dataKey="total" nameKey="key" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                  {detail.statusMix.map((s) => (
                    <Cell key={s.key} fill={statusColor(s.key)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v: any, n: any) => [fmt.int(Number(v)), String(n)]} />
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div>
              <SubTitle icon={<Sparkles className="size-3" />}>Where their leads come from</SubTitle>
              <MixBars rows={detail.sourceMix.map((s) => ({ label: s.key, n: s.total, rate: s.convRate }))} tone="var(--color-sky-400)" />
            </div>
            <div>
              <SubTitle icon={<Layers className="size-3" />}>Class interest</SubTitle>
              <MixBars rows={detail.classMix.map((s) => ({ label: s.key, n: s.total, rate: s.convRate }))} tone="var(--color-violet-400)" />
            </div>
          </div>
        </div>
      )}

      {tab === "effort" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <SubTitle icon={<MessagesSquare className="size-3" />}>Does chasing harder pay off?</SubTitle>
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={detail.fupBuckets} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis yAxisId="l" tickLine={false} axisLine={false} width={52} tickFormatter={(v: any) => fmt.compact(Number(v))} />
                <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={40} tickFormatter={(v: any) => `${Number(v).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={TT}
                  formatter={(v: any, n: any) => (n === "Conv %" ? fmt.pct(Number(v)) : fmt.int(Number(v)))}
                  labelFormatter={(l: any) => `${l} follow-ups logged`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="leads" name="Leads" fill={tint("var(--color-sky-400)", 42)} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="l" dataKey="won" name="Won" fill="var(--color-mint-400)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="rate" name="Conv %" stroke="var(--color-ember-500)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div>
            <SubTitle icon={<Timer className="size-3" />}>How long a win takes</SubTitle>
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={detail.speedBuckets} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={52} />
                <Tooltip contentStyle={TT} formatter={(v: any) => [fmt.int(Number(v)), "conversions"]} />
                <Bar dataKey="n" name="Conversions" radius={[4, 4, 0, 0]}>
                  {detail.speedBuckets.map((_, i) => (
                    <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[10px] text-mist-600">
              Median {stat.medianDaysToConvert == null ? "—" : `${stat.medianDaysToConvert}d`} from enquiry to the qualifying purchase.
            </p>
          </div>
        </div>
      )}

      {tab === "money" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
          <div>
            <SubTitle icon={<Wallet className="size-3" />}>Revenue and wins by month</SubTitle>
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={detail.monthly} margin={{ top: 8, right: 10, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" tickFormatter={(v: any) => fmt.month(String(v))} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis yAxisId="l" tickLine={false} axisLine={false} width={54} tickFormatter={(v: any) => fmt.inrC(Number(v))} />
                <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={34} />
                <Tooltip
                  contentStyle={TT}
                  labelFormatter={(l: any) => fmt.month(String(l))}
                  formatter={(v: any, n: any) => (n === "Revenue" ? fmt.inr(Number(v)) : fmt.int(Number(v)))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-gold-400)" fill={tint("var(--color-gold-400)", 22)} strokeWidth={1.8} />
                <Bar yAxisId="r" dataKey="won" name="Won" fill={tint("var(--color-mint-400)", 60)} radius={[3, 3, 0, 0]} barSize={10} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div>
            <SubTitle icon={<PackageOpen className="size-3" />}>What their leads actually bought</SubTitle>
            {detail.products.length ? (
              <ul className="space-y-2">
                {detail.products.map((p, i) => (
                  <li key={p.name}>
                    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                      <span className="truncate text-mist-300">{p.name}</span>
                      <span className="tnum shrink-0 text-mist-500">
                        {p.n}× · <span className="text-gold-400">{fmt.inrC(p.value)}</span>
                      </span>
                    </div>
                    <Meter value={p.value} max={detail.products[0].value || 1} color={PALETTE[i % PALETTE.length]} className="mt-1 h-1.5" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line-soft px-3 py-6 text-center text-[11.5px] text-mist-600">
                No qualifying purchases from this book yet.
              </p>
            )}
            <div className="mt-4">
              <SubTitle icon={<Trophy className="size-3" />}>Centres worked</SubTitle>
              <MixBars rows={detail.centreMix.map((c) => ({ label: shortCenter(c.key), n: c.total, rate: c.convRate }))} tone="var(--color-ember-500)" />
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SubTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
      {icon} {children}
    </p>
  );
}

function MixBars({ rows, tone }: { rows: { label: string; n: number; rate: number }[]; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          <span className="w-[108px] shrink-0 truncate text-[11px] text-mist-400" title={r.label}>{r.label}</span>
          <Meter value={r.n} max={max} color={tone} className="h-1.5" />
          <span className="tnum w-[40px] shrink-0 text-right text-[10.5px] text-mist-500">{fmt.int(r.n)}</span>
          <span className="tnum w-[40px] shrink-0 text-right text-[10.5px] text-mint-400">{fmt.pct(r.rate, 0)}</span>
        </li>
      ))}
    </ul>
  );
}
