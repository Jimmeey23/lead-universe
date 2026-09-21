import { useMemo } from "react";
import {
  Users, Percent, Sparkles, Wallet, Gauge, MessagesSquare, Trophy, Target, Flame, ArrowRight,
} from "lucide-react";
import { useApp } from "../state/app";
import { groupAgg, funnel, monthlySeries, overallKpis, dowSeries, Agg } from "../lib/stats";
import { Kpi, Delta, Funnel, TrendChart, Donut, ChannelMatrix } from "../components/viz";
import { Panel, Meter, LegendDot, Avatar } from "../components/ui";
import { fmt, statusColor, shortChannel } from "../lib/data";

function prevHalfDelta(series: { m: string; leads: number; won: number }[]) {
  const half = Math.floor(series.length / 2);
  if (half < 2) return 0;
  const a = series.slice(0, half).reduce((s, x) => s + x.leads, 0);
  const b = series.slice(half).reduce((s, x) => s + x.leads, 0);
  return a ? ((b - a) / a) * 100 : 0;
}

function Leaderboard({
  rows, mode, onPick, limit = 8,
}: {
  rows: Agg[];
  mode: "ltv" | "conv" | "volume";
  onPick: (k: string) => void;
  limit?: number;
}) {
  const maxLtv = Math.max(...rows.map((r) => r.ltv), 1);
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const shown = rows.slice(0, limit);
  return (
    <div className="space-y-1">
      {shown.map((r, i) => (
        <button
          key={r.key}
          onClick={() => onPick(r.key)}
          className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-850"
        >
          <span className="tnum w-5 shrink-0 text-center text-[10.5px] text-mist-600">{String(i + 1).padStart(2, "0")}</span>
          {mode !== "conv" && <Avatar name={r.key} size={24} />}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] font-medium text-mist-200 group-hover:text-white">{r.key}</span>
              <span className="tnum shrink-0 text-[11.5px] font-semibold text-white">
                {mode === "ltv" ? fmt.inrC(r.ltv) : mode === "conv" ? fmt.pct(r.convRate) : fmt.compact(r.total)}
              </span>
            </span>
            <span className="mt-1 block">
              <Meter
                value={mode === "conv" ? r.convRate : mode === "ltv" ? r.ltv : r.total}
                max={mode === "conv" ? 30 : mode === "ltv" ? maxLtv : maxTotal}
                color={mode === "conv" ? "var(--color-mint-400)" : mode === "ltv" ? "var(--color-gold-400)" : "var(--color-ember-500)"}
                className="h-[3px]"
              />
            </span>
          </span>
          <span className="tnum w-[68px] shrink-0 text-right text-[10px] text-mist-600">
            {mode === "ltv" ? `${fmt.compact(r.total)} leads` : mode === "conv" ? `${fmt.compact(r.won)}/${fmt.compact(r.total)}` : fmt.pct(r.convRate)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function OverviewView() {
  const { filtered, data, setFilters, setView } = useApp();

  const kpis = useMemo(() => overallKpis(filtered), [filtered]);
  const fun = useMemo(() => funnel(filtered), [filtered]);
  const monthly = useMemo(
    () => monthlySeries(filtered, data?.minDate.slice(0, 7) ?? "2024-04", data?.maxDate.slice(0, 7) ?? "2026-09"),
    [filtered, data],
  );
  const byStatus = useMemo(() => groupAgg(filtered, (l) => l.status), [filtered]);
  const byChannel = useMemo(() => groupAgg(filtered, (l) => l.channel), [filtered]);
  const bySource = useMemo(() => groupAgg(filtered, (l) => l.source), [filtered]);
  const byAssociate = useMemo(() => groupAgg(filtered, (l) => l.associate), [filtered]);
  const dow = useMemo(() => dowSeries(filtered), [filtered]);
  const leadDelta = useMemo(() => prevHalfDelta(monthly), [monthly]);

  if (!data) return null;

  const bestChannel = [...byChannel].filter((c) => c.total >= 50).sort((a, b) => b.convRate - a.convRate)[0];
  const bestAssoc = [...byAssociate].filter((a) => a.total >= 100).sort((a, b) => b.convRate - a.convRate)[0];
  const busyDow = [...dow].sort((a, b) => b.leads - a.leads)[0];
  const sparkLeads = monthly.map((m) => m.leads);
  const sparkConv = monthly.map((m) => m.convRate);
  const sparkLtv = monthly.map((m) => m.ltv);
  const sparkTrials = monthly.map((m) => m.trialed);

  const goStatus = (s: string) => { setFilters((f) => ({ ...f, statuses: [s] })); setView("explorer"); };
  const goChannel = (c: string) => { setFilters((f) => ({ ...f, channels: [c] })); setView("explorer"); };
  const goSource = (s: string) => { setFilters((f) => ({ ...f, sources: [s] })); setView("explorer"); };
  const goAssoc = (a: string) => { setFilters((f) => ({ ...f, associates: [a] })); setView("explorer"); };

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-3 pb-16 pt-4 sm:px-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={fmt.compact(kpis.total)} icon={<Users className="size-3.5" />} spark={sparkLeads} sub={<>volume shift <Delta v={leadDelta} /> vs prior half</>} />
        <Kpi label="Conversion" value={fmt.pct(kpis.convRate)} icon={<Percent className="size-3.5" />} tone="#34d399" spark={sparkConv} delay={0.04} sub={<>{fmt.int(kpis.won)} won of {fmt.int(kpis.total)}</>} />
        <Kpi label="Trials done" value={fmt.compact(kpis.trialed)} icon={<Sparkles className="size-3.5" />} tone="#a78bfa" spark={sparkTrials} delay={0.08} sub={<>{fmt.pct(kpis.trialToWin)} convert after trial</>} />
        <Kpi label="Revenue · LTV" value={fmt.inrC(kpis.ltv)} icon={<Wallet className="size-3.5" />} tone="#fbbf24" spark={sparkLtv} delay={0.12} sub={<>from {fmt.compact(kpis.purchases)} purchases</>} />
        <Kpi label="Rev / lead" value={fmt.inrC(kpis.ltvPerLead)} icon={<Gauge className="size-3.5" />} tone="#38bdf8" delay={0.16} sub={<>blended acquisition yield</>} />
        <Kpi label="Follow-up avg" value={kpis.avgFups.toFixed(2)} icon={<MessagesSquare className="size-3.5" />} delay={0.2} sub={<>{fmt.pct(kpis.engagedPct, 0)} of leads touched</>} />
      </div>

      {/* Highlights strip */}
      <Panel pad className="border-ember-500/20 bg-gradient-to-r from-ember-950/40 via-ink-900 to-ink-900">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-ember-400">
            <Flame className="size-4" /> Signals
          </span>
          {bestChannel && (
            <p className="text-[12px] text-mist-300">
              <span className="text-mist-500">Best converting channel:</span>{" "}
              <button onClick={() => goChannel(bestChannel.key)} className="font-semibold text-white underline decoration-sky-400/40 decoration-dotted underline-offset-4 hover:text-sky-400">
                {shortChannel(bestChannel.key)}
              </button>{" "}
              <span className="tnum text-mint-400">{fmt.pct(bestChannel.convRate)}</span>
            </p>
          )}
          {bestAssoc && (
            <p className="text-[12px] text-mist-300">
              <span className="text-mist-500">Top associate:</span>{" "}
              <button onClick={() => goAssoc(bestAssoc.key)} className="font-semibold text-white underline decoration-ember-400/40 decoration-dotted underline-offset-4 hover:text-ember-400">
                {bestAssoc.key}
              </button>{" "}
              <span className="tnum text-mint-400">{fmt.pct(bestAssoc.convRate)}</span> on {fmt.int(bestAssoc.total)} leads
            </p>
          )}
          {busyDow && (
            <p className="text-[12px] text-mist-300">
              <span className="text-mist-500">Peak intake day:</span> <span className="font-semibold text-white">{busyDow.d}</span>{" "}
              <span className="tnum text-mist-400">{fmt.compact(busyDow.leads)} leads</span>
            </p>
          )}
        </div>
      </Panel>

      {/* Funnel + status */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          className="xl:col-span-7"
          title="Conversion funnel"
          sub="Stage-to-stage progression across the current selection"
          right={<LegendDot color="#ff6b47" label="share of leads" />}
        >
          <Funnel
            steps={fun}
            onSelect={(label) => {
              if (label === "Converted") setFilters((f) => ({ ...f, conv: "yes" }));
              else if (label === "Trial Completed") setFilters((f) => ({ ...f, trialed: "yes" }));
              else if (label === "Retained") setFilters((f) => ({ ...f, retained: "yes" }));
              else if (label === "Engaged") setFilters((f) => ({ ...f, statuses: ["Open", "Won", "Lost", "Trial Scheduled", "Trial Completed"] }));
              setView("explorer");
            }}
          />
        </Panel>
        <Panel className="xl:col-span-5" title="Status composition" sub="Where every lead currently sits">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
            <div className="w-full max-w-[228px] shrink-0">
              <Donut slices={byStatus.map((s) => ({ key: s.key, value: s.total }))} centerLabel="leads" centerValue={fmt.compact(kpis.total)} />
            </div>
            <div className="w-full flex-1 space-y-1">
              {byStatus.map((s) => (
                <button
                  key={s.key}
                  onClick={() => goStatus(s.key)}
                  className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-ink-850"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: statusColor(s.key) }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-mist-300 group-hover:text-white">{s.key}</span>
                  <span className="tnum text-[11px] text-mist-500">{fmt.compact(s.total)}</span>
                  <span className="tnum w-11 text-right text-[11px] text-mist-400">{fmt.pct((s.total / (kpis.total || 1)) * 100, 0)}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Trend */}
      <Panel
        title="Intake & conversion timeline"
        sub="Lead volume, trials and wins by creation month"
        right={
          <div className="flex items-center gap-3">
            <LegendDot color="#ff6b47" label="Leads in" />
            <LegendDot color="#a78bfa" label="Trials" />
            <LegendDot color="#34d399" label="Won" />
          </div>
        }
      >
        <TrendChart data={monthly} />
      </Panel>

      {/* Channel + leaderboards */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7" title="Channel performance" sub="Volume vs converted share and revenue by acquisition channel">
          <ChannelMatrix rows={byChannel} maxTotal={byChannel[0]?.total ?? 1} onSelect={goChannel} />
        </Panel>
        <Panel
          className="xl:col-span-5"
          title="Top sources by revenue"
          sub="Origin of the leads that monetise"
          right={
            <button onClick={() => setView("explorer")} className="flex items-center gap-1 text-[11px] font-medium text-ember-400 hover:text-ember-300">
              All <ArrowRight className="size-3" />
            </button>
          }
        >
          <Leaderboard rows={bySource.filter((s) => s.ltv > 0)} mode="ltv" onPick={goSource} limit={9} />
        </Panel>
      </div>

      {/* Associates + org */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7" title="Associate leaderboard" sub="Sorted by conversion rate · minimum 50 assigned leads">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-line-soft text-left">
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Associate</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Leads</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Trials</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Won</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Conv</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">F/U avg</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...byAssociate]
                  .filter((a) => a.total >= 50)
                  .sort((a, b) => b.convRate - a.convRate)
                  .slice(0, 10)
                  .map((a, i) => (
                    <tr key={a.key} onClick={() => goAssoc(a.key)} className="group cursor-pointer border-b border-line-soft/50 transition-colors hover:bg-ink-850/60">
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2.5">
                          <span className={cnRank(i)}>{i + 1}</span>
                          <Avatar name={a.key} size={24} />
                          <span className="text-[12.5px] font-medium text-mist-200 group-hover:text-white">{a.key}</span>
                          {i === 0 && <Trophy className="size-3.5 text-gold-400" />}
                        </span>
                      </td>
                      <td className="tnum px-2 py-2 text-right text-[12px] text-mist-300">{fmt.int(a.total)}</td>
                      <td className="tnum px-2 py-2 text-right text-[12px] text-mist-400">{fmt.int(a.trialed)}</td>
                      <td className="tnum px-2 py-2 text-right text-[12px] text-mist-300">{fmt.int(a.won)}</td>
                      <td className="tnum px-2 py-2 text-right text-[12px] font-semibold text-mint-400">{fmt.pct(a.convRate)}</td>
                      <td className="tnum px-2 py-2 text-right text-[12px] text-mist-400">{a.avgFups.toFixed(1)}</td>
                      <td className="tnum px-2 py-2 text-right text-[12px] text-gold-400">{fmt.inrC(a.ltv)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="xl:col-span-5" title="Day-of-week intake" sub="When enquiries arrive · conversion overlay">
          <div className="flex h-[210px] items-end gap-2 px-1 pt-2">
            {dow.map((d) => {
              const max = Math.max(...dow.map((x) => x.leads), 1);
              const rate = d.leads ? (d.won / d.leads) * 100 : 0;
              return (
                <div key={d.d} className="group flex flex-1 flex-col items-center gap-1.5">
                  <span className="tnum text-[9.5px] text-mist-600 opacity-0 transition-opacity group-hover:opacity-100">{fmt.compact(d.leads)}</span>
                  <div className="relative flex h-full w-full items-end overflow-hidden rounded-md bg-ink-850">
                    <div
                      className="absolute bottom-0 w-full rounded-t-md transition-all duration-500 group-hover:brightness-125"
                      style={{ height: `${(d.leads / max) * 100}%`, background: "linear-gradient(180deg,#38bdf8,#38bdf833)" }}
                    />
                    <div
                      className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                      style={{ height: `${(d.won / max) * 100}%`, background: "linear-gradient(180deg,#34d399,#34d39933)" }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-mist-400">{d.d}</span>
                  <span className="tnum -mt-1 text-[9px] text-mint-400/80">{fmt.pct(rate, 0)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-center gap-4">
            <LegendDot color="#38bdf8" label="Leads in" />
            <LegendDot color="#34d399" label="Won" />
          </div>
          <div className="mt-4 rounded-lg border border-line-soft bg-ink-850/50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-mist-300">
              <Target className="size-3.5 text-ember-400" />
              Trial-to-win efficiency across selection: <span className="tnum text-mint-400">{fmt.pct(kpis.trialToWin)}</span>
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-mist-500">
              {fmt.int(kpis.trialed)} trials produced {fmt.int(kpis.won)} memberships. Every extra trial booked is worth ≈ {fmt.inr(kpis.trialed ? kpis.ltv / kpis.trialed : 0)} of LTV.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function cnRank(i: number) {
  const base = "tnum flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold";
  if (i === 0) return base + " bg-gold-400/15 text-gold-400";
  if (i === 1) return base + " bg-mist-300/10 text-mist-300";
  if (i === 2) return base + " bg-ember-500/15 text-ember-400";
  return base + " text-mist-600";
}
