import { useMemo, useState } from "react";
import { Plus, Footprints, MessagesSquare } from "lucide-react";
import { useApp } from "../state/app";
import { aggregate } from "../lib/stats";
import { Segmented, EmptyState, Avatar, Meter } from "../components/ui";
import { fmt, statusColor, shortCenter, shortChannel, Lead, stagePhase, PHASE_META } from "../lib/data";
import { KanbanSquare } from "lucide-react";

type BoardField = "status" | "phase" | "channel" | "center";

const FIELD_META: Record<BoardField, { label: string; get: (l: Lead) => string }> = {
  status: { label: "Status", get: (l) => l.status },
  phase: { label: "Pipeline phase", get: (l) => stagePhase(l.stage) },
  channel: { label: "Channel", get: (l) => l.channel },
  center: { label: "Centre", get: (l) => l.center },
};

const INITIAL = 36;

export function BoardView() {
  const { filtered, openLead } = useApp();
  const [field, setField] = useState<BoardField>("status");
  const [limits, setLimits] = useState<Record<string, number>>({});

  const columns = useMemo(() => {
    const get = FIELD_META[field].get;
    const m = new Map<string, Lead[]>();
    const sorted = [...filtered].sort((a, b) => b.createdTs - a.createdTs);
    for (const l of sorted) {
      const k = get(l);
      const arr = m.get(k);
      if (arr) arr.push(l);
      else m.set(k, [l]);
    }
    const list = [...m.entries()].map(([key, rows]) => ({ key, rows, agg: aggregate(key, rows) }));
    if (field === "phase") list.sort((a, b) => PHASE_META[a.key as keyof typeof PHASE_META].rank - PHASE_META[b.key as keyof typeof PHASE_META].rank);
    else list.sort((a, b) => b.agg.total - a.agg.total);
    return list;
  }, [filtered, field]);

  const colorOf = (key: string) =>
    field === "status" ? statusColor(key) : field === "phase" ? PHASE_META[key as keyof typeof PHASE_META]?.color ?? "#8b8f9a" : "var(--color-ember-500)";

  return (
    <div className="mx-auto max-w-[1560px] px-3 pb-10 pt-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-white">Pipeline board</h2>
          <p className="text-[11.5px] text-mist-500">{fmt.int(filtered.length)} leads arranged by {FIELD_META[field].label.toLowerCase()} · newest first</p>
        </div>
        <Segmented
          value={field}
          onChange={(v) => setField(v as BoardField)}
          options={(Object.keys(FIELD_META) as BoardField[]).map((k) => ({ value: k, label: FIELD_META[k].label }))}
        />
      </div>

      {columns.length === 0 ? (
        <EmptyState icon={<KanbanSquare className="size-5" />} title="Nothing on the board" sub="No leads match the current filters." />
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-4">
          {columns.map((col) => {
            const lim = limits[col.key] ?? INITIAL;
            const shown = col.rows.slice(0, lim);
            return (
              <div key={col.key} className="card flex w-[292px] shrink-0 snap-start flex-col self-start">
                <header className="border-b border-line-soft px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: colorOf(col.key) }} />
                    <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-semibold text-white" title={col.key}>
                      {field === "channel" ? shortChannel(col.key) : field === "center" ? shortCenter(col.key) : col.key}
                    </span>
                    <span className="tnum rounded bg-ink-750 px-1.5 py-px text-[10px] text-mist-300">{fmt.compact(col.agg.total)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Meter value={col.agg.convRate} max={30} color="var(--color-mint-400)" className="h-[3px]" />
                    <span className="tnum text-[10px] text-mint-400">{fmt.pct(col.agg.convRate)}</span>
                    <span className="tnum ml-auto text-[10px] text-mist-500">{col.agg.ltv ? fmt.inrC(col.agg.ltv) : "no rev"}</span>
                  </div>
                </header>
                <div className="max-h-[62vh] space-y-2 overflow-y-auto p-2">
                  {shown.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => openLead(l)}
                      className="group w-full rounded-lg border border-line-soft bg-ink-850/60 p-2.5 text-left transition-all hover:-translate-y-px hover:border-line-strong hover:bg-ink-800"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={l.name} size={22} />
                        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-mist-100 group-hover:text-white">{l.name}</p>
                        <span className="tnum shrink-0 text-[9.5px] text-mist-600">{fmt.daysAgo(l.created)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded border border-line-soft bg-ink-900 px-1.5 py-px text-[9.5px] text-mist-500">{shortCenter(l.center)}</span>
                        <span className="rounded border border-line-soft bg-ink-900 px-1.5 py-px text-[9.5px] text-mist-500">{l.source}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-mist-500">
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5"><MessagesSquare className="size-2.5 text-ember-400/80" />{l.fupCount}</span>
                          <span className="flex items-center gap-0.5"><Footprints className="size-2.5 text-violet-400/80" />{l.visits}</span>
                        </span>
                        {l.ltv > 0 && <span className="tnum font-semibold text-gold-400">{fmt.inrC(l.ltv)}</span>}
                      </div>
                    </button>
                  ))}
                  {col.rows.length > lim && (
                    <button
                      onClick={() => setLimits((s) => ({ ...s, [col.key]: lim + 60 }))}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line py-2 text-[11px] font-medium text-mist-500 transition-colors hover:border-ember-500/40 hover:text-ember-300"
                    >
                      <Plus className="size-3" /> {fmt.int(col.rows.length - lim)} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
