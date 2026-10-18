import { useMemo, useState } from "react";
import { CalendarDays, Building2, Megaphone, Share2, Milestone, TrafficCone, UserRound, Layers, Search, Filter, RotateCcw } from "lucide-react";
import { useApp } from "../state/app";
import { MultiSelect, FlagToggle, ClearPill, MsOption } from "./ui";
import { optionCounts, activeFilterCount } from "../lib/stats";
import { fmt, statusColor, shortChannel, shortCenter } from "../lib/data";
import { cn } from "../utils/cn";

const PRESETS = [
  { key: "all", label: "All time", days: 0 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "6m", label: "6mo", days: 183 },
  { key: "12m", label: "12mo", days: 365 },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"] | "range";

export function FilterBar() {
  const { data, filters: f, setFilters, resetFilters, filtered } = useApp();
  const [preset, setPreset] = useState<PresetKey>("all");
  const nActive = activeFilterCount(f);

  const opts = useMemo(() => {
    if (!data) return null;
    const oc = (get: Parameters<typeof optionCounts>[1]) => optionCounts(data.leads, get);
    return {
      centers: oc((l) => l.center) as MsOption[],
      channels: oc((l) => l.channel).map((o) => ({ ...o, label: shortChannel(o.value) })) as MsOption[],
      sources: oc((l) => l.source) as MsOption[],
      stages: oc((l) => l.stage) as MsOption[],
      statuses: oc((l) => l.status).map((o) => ({ ...o, color: statusColor(o.value) })) as MsOption[],
      associates: oc((l) => l.associate) as MsOption[],
      classes: oc((l) => l.cls) as MsOption[],
    };
  }, [data]);

  if (!data || !opts) return null;

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    if (key === "range") {
      setFilters((x) => ({ ...x, from: x.from || data.minDate, to: x.to || data.maxDate }));
      return;
    }
    const p = PRESETS.find((x) => x.key === key)!;
    if (!p.days) {
      setFilters((x) => ({ ...x, from: "", to: "" }));
      return;
    }
    const to = data.maxDate;
    const [y, m, d] = to.split("-").map(Number);
    const target = new Date(Date.UTC(y, m - 1, d - (p.days - 1)));
    const from = target.toISOString().slice(0, 10);
    setFilters((x) => ({ ...x, from, to }));
  };

  const total = data.leads.length;
  const share = total ? (filtered.length / total) * 100 : 0;

  return (
    <div className="relative z-30 border-b border-line-soft bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto max-w-[1560px] px-3 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* search */}
          <div className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-line bg-ink-850 px-2.5 transition-colors focus-within:border-ember-500/60 sm:max-w-[260px]">
            <Search className="size-3.5 shrink-0 text-mist-500" />
            <input
              value={f.q}
              onChange={(e) => setFilters((x) => ({ ...x, q: e.target.value }))}
              placeholder="Search name, email, phone, remarks…"
              className="w-full bg-transparent text-[12px] text-mist-100 outline-none placeholder:text-mist-600"
            />
            {f.q && (
              <button onClick={() => setFilters((x) => ({ ...x, q: "" }))} className="text-mist-500 hover:text-mist-200">
                <RotateCcw className="size-3" />
              </button>
            )}
          </div>

          {/* period */}
          <div className="flex items-center gap-1">
            <div className="inline-flex items-center rounded-lg border border-line bg-ink-850 p-0.5">
              <span className="pl-1.5 pr-0.5 text-mist-600"><CalendarDays className="size-3.5" /></span>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    preset === p.key ? "bg-ink-700 text-mist-100 ring-1 ring-line-strong" : "text-mist-500 hover:text-mist-200",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => applyPreset("range")}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  preset === "range" ? "bg-ink-700 text-mist-100 ring-1 ring-line-strong" : "text-mist-500 hover:text-mist-200",
                )}
              >
                Range
              </button>
            </div>
            {preset === "range" && (
              <div className="flex items-center gap-1 text-[11px] text-mist-500">
                <input
                  type="date" value={f.from} aria-label="Start date"
                  onChange={(e) => {
                    const from = e.target.value;
                    setFilters((x) => ({ ...x, from, to: from && x.to && from > x.to ? from : x.to }));
                  }}
                  className="h-8 rounded-lg border border-line bg-ink-850 px-1.5 text-[11px] text-mist-200 outline-none focus:border-ember-500/60"
                />
                <span>→</span>
                <input
                  type="date" value={f.to} aria-label="End date"
                  onChange={(e) => {
                    const to = e.target.value;
                    setFilters((x) => ({ ...x, to, from: to && x.from && to < x.from ? to : x.from }));
                  }}
                  className="h-8 rounded-lg border border-line bg-ink-850 px-1.5 text-[11px] text-mist-200 outline-none focus:border-ember-500/60"
                />
              </div>
            )}
          </div>

          <div className="hidden h-5 w-px bg-line-soft lg:block" />

          {/* facets */}
          <MultiSelect label="Centre" icon={<Building2 className="size-3.5" />} options={opts.centers} selected={f.centers} onChange={(v) => setFilters((x) => ({ ...x, centers: v }))} short={shortCenter} />
          <MultiSelect label="Channel" icon={<Megaphone className="size-3.5" />} options={opts.channels} selected={f.channels} onChange={(v) => setFilters((x) => ({ ...x, channels: v }))} wide />
          <MultiSelect label="Source" icon={<Share2 className="size-3.5" />} options={opts.sources} selected={f.sources} onChange={(v) => setFilters((x) => ({ ...x, sources: v }))} wide />
          <MultiSelect label="Stage" icon={<Milestone className="size-3.5" />} options={opts.stages} selected={f.stages} onChange={(v) => setFilters((x) => ({ ...x, stages: v }))} wide />
          <MultiSelect label="Status" icon={<TrafficCone className="size-3.5" />} options={opts.statuses} selected={f.statuses} onChange={(v) => setFilters((x) => ({ ...x, statuses: v }))} />
          <MultiSelect label="Associate" icon={<UserRound className="size-3.5" />} options={opts.associates} selected={f.associates} onChange={(v) => setFilters((x) => ({ ...x, associates: v }))} />
          <MultiSelect label="Class" icon={<Layers className="size-3.5" />} options={opts.classes} selected={f.classes} onChange={(v) => setFilters((x) => ({ ...x, classes: v }))} />

          <div className="hidden h-5 w-px bg-line-soft lg:block" />

          {/* outcome flags */}
          <FlagToggle label="Tried" value={f.trialed} onChange={(v) => setFilters((x) => ({ ...x, trialed: v }))} onColor="var(--color-violet-400)" />
          <FlagToggle label="Won" value={f.conv} onChange={(v) => setFilters((x) => ({ ...x, conv: v }))} />
          <FlagToggle label="Retained" value={f.retained} onChange={(v) => setFilters((x) => ({ ...x, retained: v }))} onColor="var(--color-lime-400)" />
          <FlagToggle label="Paying" value={f.hasLtv} onChange={(v) => setFilters((x) => ({ ...x, hasLtv: v }))} onColor="var(--color-gold-400)" />

          <div className="ml-auto flex items-center gap-2">
            {nActive > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] text-mist-500">
                <Filter className="size-3" />
                <span className="tnum text-ember-400">{nActive}</span> active
              </span>
            )}
            <ClearPill onClick={() => { resetFilters(); setPreset("all"); }} />
          </div>
        </div>

        {/* result line */}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-mist-500">
          <span className="tnum font-semibold text-mist-200">{fmt.int(filtered.length)}</span>
          <span>of {fmt.int(total)} leads</span>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-ink-750">
            <div className="h-full rounded-full bg-ember-500 transition-all duration-500" style={{ width: `${share}%` }} />
          </div>
          <span className="tnum">{fmt.pct(share, 1)}</span>
          <span className="hidden text-mist-600 sm:inline">·</span>
          <span className="hidden sm:inline">
            {data.minDate} → {data.maxDate}
          </span>
        </div>
      </div>
    </div>
  );
}
