import { useMemo, useState } from "react";
import { Building2, Users, Percent, Sparkles, Wallet, Gauge, Crown, ArrowUpRight } from "lucide-react";
import { useApp } from "../state/app";
import { groupAgg, funnel, monthlySeries, overallKpis } from "../lib/stats";
import { Panel, Meter, EmptyState, Segmented } from "../components/ui";
import { Kpi, Funnel, TrendChart, Donut, ChannelMatrix } from "../components/viz";
import { fmt, statusColor, shortCenter } from "../lib/data";
import { cn } from "../utils/cn";
import { Store } from "lucide-react";

type Metric = "total" | "convRate" | "ltv" | "trialRate";

const METRIC_META: Record<Metric, { label: string; get: (a: any) => number; fmt: (n: number) => string }> = {
  total: { label: "Leads", get: (a) => a.total, fmt: (n) => fmt.compact(n) },
  convRate: { label: "Conv %", get: (a) => a.convRate, fmt: (n) => fmt.pct(n) },
  ltv: { label: "Revenue", get: (a) => a.ltv, fmt: (n) => fmt.inrC(n) },
  trialRate: { label: "Trial %", get: (a) => a.trialRate, fmt: (n) => fmt.pct(n, 0) },
};

export function StudiosView() {
  const { filtered, data, setFilters, setView } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("total");
  const [asTab, setAsTab] = useState<"conv" | "ltv">("conv");

  const byCenter = useMemo(() => groupAgg(filtered, (l) => l.center), [filtered]);
  const current = selected ?? byCenter[0]?.key ?? null;

  const studioLeads = useMemo(() => filtered.filter((l) => l.center === current), [filtered, current]);
  const kpis = useMemo(() => overallKpis(studioLeads), [studioLeads]);
  const netKpis = useMemo(() => overallKpis(filtered), [filtered]);
  const fun = useMemo(() => funnel(studioLeads), [studioLeads]);
  const monthly = useMemo(
    () => monthlySeries(studioLeads, data?.minDate.slice(0, 7) ?? "2024-04", data?.maxDate.slice(0, 7) ?? "2026-09"),
    [studioLeads, data],
  );
  const byStatus = useMemo(() => groupAgg(studioLeads, (l) => l.status), [studioLeads]);
  const byChannel = useMemo(() => groupAgg(studioLeads, (l) => l.channel), [studioLeads]);
  const byAssociate = useMemo(() => groupAgg(studioLeads, (l) => l.associate), [studioLeads]);
  const bySource = useMemo(() => groupAgg(studioLeads, (l) => l.source).slice(0, 7), [studioLeads]);
  const byClass = useMemo(() => groupAgg(studioLeads, (l) => l.cls), [studioLeads]);

  if (!data) return null;
  if (!current) return <EmptyState icon={<Store className="size-5" />} title="No studios in selection" sub="Reset filters to restore studio data." />;

  const networkConv = netKpis.convRate;
  const sorted = [...byCenter].sort((a, b) => METRIC_META[metric].get(b) - METRIC_META[metric].get(a));
  const maxLeads = byCenter[0]?.total ?? 1;
  const curAgg = byCenter.find((c) => c.key === current);
  const associates = [...byAssociate].sort((a, b) => (asTab === "conv" ? b.convRate - a.convRate : b.ltv - a.ltv)).slice(0, 8);

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-3 pb-16 pt-4 sm:px-5">
      {/* Compare table */}
      <Panel
        title="Studio comparison"
        sub="Every centre measured on the same scoreboard · click a row to inspect"
        right={
          <Segmented
            size="sm"
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
            options={(Object.keys(METRIC_META) as Metric[]).map((k) => ({ value: k, label: METRIC_META[k].label }))}
          />
        }
        pad={false}
      >
        <div className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-line-soft text-left">
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Centre</th>
                <th className="w-[190px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Share of volume</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Leads</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Trials</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Won</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Conv</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">vs network</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Revenue</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">Rev/lead</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-500">F/U avg</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const active = c.key === current;
                const delta = c.convRate - networkConv;
                return (
                  <tr
                    key={c.key}
                    onClick={() => setSelected(c.key)}
                    className={cn(
                      "cursor-pointer border-b border-line-soft/50 transition-colors",
                      active ? "bg-ember-950/40 hover:bg-ember-950/60" : "hover:bg-ink-850/60",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className={cn("flex size-6 items-center justify-center rounded-md border", active ? "border-ember-500/50 bg-ember-500/10 text-ember-400" : "border-line bg-ink-850 text-mist-500")}>
                          <Building2 className="size-3" />
                        </span>
                        <span className={cn("text-[12.5px] font-medium", active ? "text-mist-100" : "text-mist-200")}>{shortCenter(c.key)}</span>
                        {byCenter[0]?.key === c.key && <Crown className="size-3 text-gold-400" />}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Meter value={c.total} max={maxLeads} color={active ? "var(--color-ember-500)" : "#3a4152"} className="h-1.5" />
                        <span className="tnum w-9 text-[10px] text-mist-500">{fmt.pct((c.total / (netKpis.total || 1)) * 100, 0)}</span>
                      </div>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[12px] text-mist-200">{fmt.int(c.total)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[12px] text-violet-400">{fmt.int(c.trialed)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[12px] text-mist-300">{fmt.int(c.won)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[12px] font-semibold text-mint-400">{fmt.pct(c.convRate)}</td>
                    <td className={cn("tnum px-3 py-2.5 text-right text-[11px]", delta >= 0 ? "text-mint-400/80" : "text-rose-400/80")}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(1)}pt
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[12px] text-gold-400">{fmt.inrC(c.ltv)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[11px] text-mist-400">{fmt.inrC(c.ltvPerLead)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[11px] text-mist-400">{c.avgFups.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Studio header */}
      <div className="card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.12] blur-3xl" style={{ background: "var(--color-ember-500)" }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ember-400">Studio dossier</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-mist-100">{current}</h2>
            <p className="mt-0.5 text-[12px] text-mist-500">
              {curAgg && <>Ranked #{sorted.findIndex((c) => c.key === current) + 1} of {byCenter.length} by {METRIC_META[metric].label.toLowerCase()} · </>}
              {fmt.int(kpis.total)} leads in current selection
            </p>
          </div>
          <button
            onClick={() => { setFilters((f) => ({ ...f, centers: [current] })); setView("explorer"); }}
            className="flex items-center gap-1.5 rounded-lg border border-ember-500/40 bg-ember-950 px-3 py-2 text-[12px] font-medium text-ember-300 transition-colors hover:bg-ember-500 hover:text-onaccent"
          >
            Open {fmt.compact(kpis.total)} leads <ArrowUpRight className="size-3.5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Leads" value={fmt.compact(kpis.total)} icon={<Users className="size-3.5" />} sub={<>{fmt.pct((kpis.total / (netKpis.total || 1)) * 100)} of selection</>} />
          <Kpi label="Conversion" value={fmt.pct(kpis.convRate)} icon={<Percent className="size-3.5" />} tone="#34d399" delay={0.04} sub={<>network avg {fmt.pct(networkConv)}</>} />
          <Kpi label="Trial rate" value={fmt.pct(kpis.trialRate, 0)} icon={<Sparkles className="size-3.5" />} tone="#a78bfa" delay={0.08} sub={<>{fmt.pct(kpis.trialToWin)} trial→win</>} />
          <Kpi label="Revenue" value={fmt.inrC(kpis.ltv)} icon={<Wallet className="size-3.5" />} tone="#fbbf24" delay={0.12} sub={<>{fmt.pct(netKpis.ltv ? (kpis.ltv / netKpis.ltv) * 100 : 0, 0)} of network</>} />
          <Kpi label="Rev / lead" value={fmt.inrC(kpis.ltvPerLead)} icon={<Gauge className="size-3.5" />} tone="#38bdf8" delay={0.16} sub={<>network {fmt.inrC(netKpis.ltvPerLead)}</>} />
        </div>
      </div>

      {/* Funnel + status + trend */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Studio funnel" sub="Progression for this centre only">
          <Funnel steps={fun} />
        </Panel>
        <Panel className="xl:col-span-3" title="Status" sub="Live composition">
          <Donut
            slices={byStatus.map((s) => ({ key: s.key, value: s.total }))}
            centerLabel="leads"
            centerValue={fmt.compact(kpis.total)}
          />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {byStatus.slice(0, 5).map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-[10px] text-mist-500">
                <span className="size-1.5 rounded-full" style={{ background: statusColor(s.key) }} />
                {s.key} <span className="tnum">{fmt.pct((s.total / (kpis.total || 1)) * 100, 0)}</span>
              </span>
            ))}
          </div>
        </Panel>
        <Panel className="xl:col-span-4" title="Class mix" sub="Demand by programme">
          <div className="space-y-3 pt-1">
            {byClass.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[12px] font-medium text-mist-200">{c.key}</span>
                  <span className="tnum text-[11px] text-mist-400">
                    {fmt.compact(c.total)} · <span className="text-mint-400">{fmt.pct(c.convRate)}</span>
                  </span>
                </div>
                <Meter value={c.total} max={byClass[0]?.total ?? 1} color="linear-gradient(90deg,#a78bfa,#22d3ee)" className="h-1.5" />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line-soft pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">Top sources</p>
            <div className="space-y-1.5">
              {bySource.slice(0, 5).map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-mist-300">{s.key}</span>
                  <span className="tnum shrink-0 text-mist-500">{fmt.compact(s.total)} · <span className="text-mint-400">{fmt.pct(s.convRate, 0)}</span></span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Studio timeline" sub={`Intake, trials and wins for ${shortCenter(current)}`}>
        <TrendChart data={monthly} height={220} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7" title="Channels at this studio" sub="What actually fills the room here">
          <ChannelMatrix rows={byChannel} maxTotal={byChannel[0]?.total ?? 1} />
        </Panel>
        <Panel
          className="xl:col-span-5"
          title="Studio associates"
          sub="Who works these leads"
          right={
            <Segmented
              size="xs"
              value={asTab}
              onChange={(v) => setAsTab(v as "conv" | "ltv")}
              options={[{ value: "conv", label: "By conv" }, { value: "ltv", label: "By revenue" }]}
            />
          }
        >
          <div className="space-y-1">
            {associates.map((a, i) => (
              <div key={a.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-850">
                <span className="tnum w-4 shrink-0 text-[10.5px] text-mist-600">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-mist-200">{a.key}</span>
                    <span className="tnum text-[11px] font-semibold text-mist-100">
                      {asTab === "conv" ? fmt.pct(a.convRate) : fmt.inrC(a.ltv)}
                    </span>
                  </span>
                  <Meter
                    className="mt-1 h-[3px]"
                    value={asTab === "conv" ? a.convRate : a.ltv}
                    max={asTab === "conv" ? 35 : associates[0]?.ltv ?? 1}
                    color={asTab === "conv" ? "var(--color-mint-400)" : "var(--color-gold-400)"}
                  />
                </span>
                <span className="tnum w-[76px] shrink-0 text-right text-[10px] text-mist-600">
                  {fmt.compact(a.won)}/{fmt.compact(a.total)} won
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
