import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../utils/cn";
import { fmt, statusColor, shortChannel } from "../lib/data";
import { FunnelStep, MonthPoint, Agg } from "../lib/stats";

/* ─────────────────────────── KPI Card ───────────────────────────── */

export function Kpi({
  label, value, sub, icon, tone = "#ff6b47", spark, delay = 0,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone?: string;
  spark?: number[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="card card-hover relative overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[0.13] blur-2xl"
        style={{ background: tone }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mist-500">{label}</span>
        <span
          className="flex size-7 items-center justify-center rounded-lg border border-line-soft"
          style={{ color: tone, background: tone + "14" }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="tnum font-display text-[26px] font-semibold leading-none tracking-tight text-white">{value}</p>
        {spark && spark.length > 1 && <Spark data={spark} tone={tone} />}
      </div>
      {sub && <div className="mt-2 text-[11px] leading-snug text-mist-500">{sub}</div>}
    </motion.div>
  );
}

export function Spark({ data, tone = "#ff6b47", w = 84, h = 26 }: { data: number[]; tone?: string; w?: number; h?: number }) {
  const { line, area } = useMemo(() => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const rng = max - min || 1;
    const pts = data.map((v, i) => [ (i / (data.length - 1)) * w, h - 2 - ((v - min) / rng) * (h - 5) ] as const);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { line, area: `${line} L${w},${h} L0,${h} Z` };
  }, [data, w, h]);
  const gid = useMemo(() => "sp" + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg width={w} height={h} className="shrink-0 opacity-90">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Delta({ v, invert = false }: { v: number; invert?: boolean }) {
  const good = invert ? v < 0 : v > 0;
  const Icon = v >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tnum", good ? "text-mint-400" : "text-rose-400")}>
      <Icon className="size-3" />
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

/* ───────────────────────────── Funnel ───────────────────────────── */

export function Funnel({ steps, onSelect }: { steps: FunnelStep[]; onSelect?: (label: string) => void }) {
  const max = steps[0]?.count || 1;
  return (
    <div className="space-y-[3px]">
      {steps.map((s, i) => (
        <div key={s.label}>
          <button
            onClick={() => onSelect?.(s.label)}
            className="group flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-ink-850"
          >
            <span className="w-[104px] shrink-0 truncate text-[11.5px] font-medium text-mist-400 group-hover:text-mist-200">
              {s.label}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-ink-850/80">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2.5, (s.count / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ background: `linear-gradient(90deg, ${s.color}33, ${s.color})`, boxShadow: `0 0 18px ${s.color}30 inset` }}
              />
              <span className="tnum absolute inset-y-0 left-2.5 flex items-center text-[11px] font-semibold text-white/95 mix-blend-plus-lighter">
                {fmt.compact(s.count)}
              </span>
            </div>
            <span className="tnum w-[52px] shrink-0 text-right text-[11px] text-mist-400">{fmt.pct(s.pct)}</span>
          </button>
          {i < steps.length - 1 && (
            <div className="ml-[120px] flex w-fit items-center gap-1 rounded-full border border-line-soft bg-ink-900 px-1.5 py-px">
              <span className="tnum text-[9.5px] text-mist-600">▼ {fmt.pct(steps[i + 1].stepRate, 0)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────── Trend chart ─────────────────────────── */

const tooltipStyle: React.CSSProperties = {
  background: "#15171d",
  border: "1px solid #2c303a",
  borderRadius: 10,
  fontSize: 11.5,
  boxShadow: "0 12px 32px rgba(0,0,0,.55)",
  padding: "8px 10px",
};

export function TrendChart({ data, height = 250 }: { data: MonthPoint[]; height?: number }) {
  const id = useMemo(() => "tg" + Math.random().toString(36).slice(2, 7), []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="20%">
        <defs>
          <linearGradient id={`${id}-leads`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b47" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#ff6b47" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey="m"
          tickFormatter={(m: string) => fmt.month(m)}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
          dy={6}
        />
        <YAxis hide domain={[0, "dataMax + 120"]} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#f3f3f5", fontFamily: "Space Grotesk", fontWeight: 600, marginBottom: 4 }}
          labelFormatter={(m) => fmt.month(String(m))}
          formatter={(v: any, name: any) => [fmt.int(Number(v)), name]}
          itemStyle={{ padding: 0 }}
        />
        <Area type="monotone" dataKey="leads" name="Leads in" stroke="#ff6b47" strokeWidth={2} fill={`url(#${id}-leads)`} dot={false} activeDot={{ r: 3.5 }} />
        <Line type="monotone" dataKey="trialed" name="Trials" stroke="#a78bfa" strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
        <Line type="monotone" dataKey="won" name="Won" stroke="#34d399" strokeWidth={1.8} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ──────────────────────────── Donut ─────────────────────────────── */

export function Donut({
  slices, height = 200, centerLabel, centerValue,
}: {
  slices: { key: string; value: number }[];
  height?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="key"
            innerRadius="68%"
            outerRadius="94%"
            paddingAngle={2.5}
            cornerRadius={4}
            strokeWidth={0}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={statusColor(s.key)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [`${fmt.int(Number(v))} · ${fmt.pct((Number(v) / total) * 100)}`, name]}
            itemStyle={{ padding: 0 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-display text-[22px] font-semibold text-white">{centerValue}</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-mist-500">{centerLabel}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── Channel matrix bars ────────────────────── */

export function ChannelMatrix({ rows, maxTotal, onSelect }: { rows: Agg[]; maxTotal: number; onSelect?: (k: string) => void }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <button
          key={r.key}
          onClick={() => onSelect?.(r.key)}
          className="group grid w-full grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-ink-850 sm:grid-cols-[180px_1fr_160px]"
        >
          <span className="truncate text-[12px] font-medium text-mist-300 group-hover:text-white" title={r.key}>
            {shortChannel(r.key)}
          </span>
          <div className="relative h-[22px] overflow-hidden rounded-md bg-ink-850/80">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(r.total / maxTotal) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 rounded-md opacity-90"
              style={{ background: "linear-gradient(90deg,#38bdf822,#38bdf8)" }}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(r.won / maxTotal) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 rounded-md"
              style={{ background: "#34d399" }}
            />
            <span className="tnum absolute inset-y-0 left-2 flex items-center text-[10.5px] font-semibold text-white">
              {fmt.compact(r.total)}
            </span>
          </div>
          <div className="col-start-3 row-start-1 flex items-center justify-end gap-3 text-right max-sm:col-start-3">
            <span className="tnum text-[11px] text-mint-400">{fmt.pct(r.convRate)}</span>
            <span className="tnum hidden w-[72px] text-[11px] text-mist-500 sm:inline">{fmt.inrC(r.ltv)}</span>
          </div>
        </button>
      ))}
      <div className="flex justify-end gap-4 pt-1 pr-1">
        <span className="flex items-center gap-1.5 text-[10px] text-mist-500"><span className="size-2 rounded-sm bg-sky-400" /> Leads</span>
        <span className="flex items-center gap-1.5 text-[10px] text-mist-500"><span className="size-2 rounded-sm bg-mint-400" /> Converted</span>
      </div>
    </div>
  );
}
