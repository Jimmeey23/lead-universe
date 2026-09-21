import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, CornerDownRight,
  MessagesSquare, Eye, Download, Plus, Users,
} from "lucide-react";
import { Lead, fmt, statusColor, shortCenter, shortChannel } from "../lib/data";
import { Agg, aggregate } from "../lib/stats";
import { Avatar, Meter, useClickOutside, EmptyState } from "./ui";
import { cn } from "../utils/cn";
import { useApp } from "../state/app";

/* ───────────────────────────── Types ────────────────────────────── */

export type SortKey =
  | "name" | "created" | "converted" | "status" | "stage" | "center" | "source"
  | "associate" | "channel" | "cls" | "fups" | "visits" | "purchases" | "ltv";

export interface SortSpec { key: SortKey; dir: "asc" | "desc" }

export type GroupKey = "none" | "center" | "channel" | "source" | "associate" | "status" | "stage" | "cls" | "month";

export type ColId = "status" | "stage" | "center" | "channel" | "source" | "associate" | "cls" | "created" | "fups" | "visits" | "purchases" | "ltv";

export const ALL_COLS: { id: ColId; label: string; sortable?: SortKey; hideable: boolean; default: boolean }[] = [
  { id: "status", label: "Status", sortable: "status", hideable: false, default: true },
  { id: "stage", label: "Stage", sortable: "stage", hideable: true, default: true },
  { id: "center", label: "Centre", sortable: "center", hideable: true, default: true },
  { id: "source", label: "Source", sortable: "source", hideable: true, default: true },
  { id: "channel", label: "Channel", sortable: "channel", hideable: true, default: false },
  { id: "associate", label: "Associate", sortable: "associate", hideable: true, default: true },
  { id: "cls", label: "Class", sortable: "cls", hideable: true, default: false },
  { id: "created", label: "Created", sortable: "created", hideable: true, default: true },
  { id: "fups", label: "F/U", sortable: "fups", hideable: true, default: true },
  { id: "visits", label: "Visits", sortable: "visits", hideable: true, default: false },
  { id: "purchases", label: "Purchases", sortable: "purchases", hideable: true, default: false },
  { id: "ltv", label: "LTV", sortable: "ltv", hideable: true, default: true },
];

export const GROUP_META: Record<GroupKey, { label: string; get: (l: Lead) => string }> = {
  none: { label: "No grouping", get: () => "All leads" },
  center: { label: "Centre", get: (l) => l.center },
  channel: { label: "Channel", get: (l) => l.channel },
  source: { label: "Source", get: (l) => l.source },
  associate: { label: "Associate", get: (l) => l.associate },
  status: { label: "Status", get: (l) => l.status },
  stage: { label: "Stage", get: (l) => l.stage },
  cls: { label: "Class type", get: (l) => l.cls },
  month: { label: "Created month", get: (l) => l.createdMonth },
};

const ACCESSOR: Record<SortKey, (l: Lead) => string | number> = {
  name: (l) => l.name.toLowerCase(),
  created: (l) => l.createdTs,
  converted: (l) => (l.convertedTs ?? 0),
  status: (l) => l.status,
  stage: (l) => l.stage,
  center: (l) => l.center,
  source: (l) => l.source,
  associate: (l) => l.associate,
  channel: (l) => l.channel,
  cls: (l) => l.cls,
  fups: (l) => l.fupCount,
  visits: (l) => l.visits,
  purchases: (l) => l.purchases,
  ltv: (l) => l.ltv,
};

export function sortLeads(rows: Lead[], spec: SortSpec[]): Lead[] {
  if (!spec.length) return rows;
  const out = [...rows];
  out.sort((a, b) => {
    for (const s of spec) {
      const av = ACCESSOR[s.key](a), bv = ACCESSOR[s.key](b);
      const r = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      if (r !== 0) return s.dir === "asc" ? r : -r;
    }
    return 0;
  });
  return out;
}

/* ─────────────────────────── Cell render ────────────────────────── */

function StatusPill({ s }: { s: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-soft bg-ink-850 px-2 py-0.5 text-[10.5px] font-medium text-mist-200">
      <span className="size-1.5 rounded-full" style={{ background: statusColor(s) }} />
      {s}
    </span>
  );
}

function Cell({ col, lead }: { col: ColId; lead: Lead }) {
  switch (col) {
    case "status": return <StatusPill s={lead.status} />;
    case "stage": return <span className="block max-w-[180px] truncate text-mist-300" title={lead.stage}>{lead.stage}</span>;
    case "center": return <span className="block max-w-[150px] truncate text-mist-300" title={lead.center}>{shortCenter(lead.center)}</span>;
    case "channel": return <span className="block max-w-[150px] truncate text-mist-400" title={lead.channel}>{shortChannel(lead.channel)}</span>;
    case "source": return <span className="block max-w-[140px] truncate text-mist-300" title={lead.source}>{lead.source}</span>;
    case "associate": return <span className="block max-w-[120px] truncate text-mist-300" title={lead.associate}>{lead.associate}</span>;
    case "cls": return <span className="text-mist-400">{lead.cls}</span>;
    case "created": return <span className="tnum whitespace-nowrap text-mist-400">{fmt.date(lead.created)}</span>;
    case "fups":
      return lead.fupCount ? (
        <span className="tnum inline-flex items-center gap-1 rounded-md bg-ink-750 px-1.5 py-0.5 text-[10.5px] text-mist-300">
          <MessagesSquare className="size-3 text-ember-400" />{lead.fupCount}
        </span>
      ) : <span className="text-mist-600">—</span>;
    case "visits": return <span className="tnum text-mist-300">{lead.visits ? fmt.int(lead.visits) : "—"}</span>;
    case "purchases": return <span className="tnum text-mist-300">{lead.purchases ? fmt.int(lead.purchases) : "—"}</span>;
    case "ltv":
      return lead.ltv ? (
        <span className="tnum font-medium text-mint-400">{fmt.inr(lead.ltv)}</span>
      ) : <span className="text-mist-600">—</span>;
  }
}

/* ─────────────────────────── Group header ───────────────────────── */

function GroupHead({
  g, open, onToggle, colSpan, compact,
}: { g: Agg & { label: string }; open: boolean; onToggle: () => void; colSpan: number; compact: boolean }) {
  const maxRate = 25;
  return (
    <tr>
      <td colSpan={colSpan} className={cn("border-b border-line-soft bg-ink-850/70", compact ? "py-0.5" : "py-1")}>
        <button onClick={onToggle} className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-left">
          <span className="flex size-5 items-center justify-center rounded-md border border-line bg-ink-800 text-mist-400 transition-colors group-hover:text-mist-100">
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
          <span className="font-display text-[12.5px] font-semibold text-mist-100">{g.label}</span>
          <span className="tnum rounded bg-ink-750 px-1.5 py-px text-[10px] text-mist-400">{fmt.int(g.total)} leads</span>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="flex w-24 items-center gap-1.5">
              <Meter value={g.convRate} max={maxRate} color="var(--color-mint-400)" className="h-[3px]" />
              <span className="tnum text-[10px] text-mint-400">{fmt.pct(g.convRate)}</span>
            </span>
            <span className="flex w-24 items-center gap-1.5">
              <Meter value={g.trialRate} max={50} color="var(--color-violet-400)" className="h-[3px]" />
              <span className="tnum text-[10px] text-violet-400">{fmt.pct(g.trialRate, 0)}</span>
            </span>
          </span>
          <span className="tnum ml-auto text-[11px] text-mist-400">
            {g.ltv ? <span className="text-gold-400">{fmt.inrC(g.ltv)}</span> : "no revenue"} · won {fmt.int(g.won)} · f/u avg {g.avgFups.toFixed(1)}
          </span>
        </button>
      </td>
    </tr>
  );
}

/* ─────────────────────────── Column menu ────────────────────────── */

function ColumnsMenu({ visible, toggle }: { visible: Set<ColId>; toggle: (c: ColId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-2.5 text-[12px] font-medium text-mist-400 transition-colors hover:border-line-strong hover:text-mist-200"
      >
        <Eye className="size-3.5" /> Columns
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-1.5 w-[190px] rounded-xl border border-line-strong bg-ink-800 p-1 shadow-2xl shadow-black/60"
          >
            {ALL_COLS.filter((c) => c.hideable).map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] text-mist-300 hover:bg-ink-750"
              >
                {c.label}
                <span className={cn("size-1.5 rounded-full", visible.has(c.id) ? "bg-mint-400" : "bg-line-strong")} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────── Export ───────────────────────────── */

export function exportCsv(rows: Lead[]) {
  const esc = (s: string | number) => {
    const v = String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const head = ["ID","Name","Phone","Email","Created","Converted","Stage","Status","Centre","Channel","Source","Associate","Class","FollowUps","Purchases","LTV","Visits","Trialed","Converted?","Retained"];
  const lines = rows.map((l) =>
    [l.id, l.name, l.phone, l.email, l.created, l.converted, l.stage, l.status, l.center, l.channel, l.source, l.associate, l.cls, l.fupCount, l.purchases, l.ltv, l.visits, l.trialed ? 1 : 0, l.conv ? 1 : 0, l.retained ? 1 : 0].map(esc).join(","),
  );
  const blob = new Blob([head.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lead-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ───────────────────────────── Table ────────────────────────────── */

const PAGE = 150;

export function DataTable({
  rows, sort, onSort, group, density, visibleCols,
}: {
  rows: Lead[];
  sort: SortSpec[];
  onSort: (spec: SortSpec[]) => void;
  group: GroupKey;
  density: "compact" | "cozy";
  visibleCols: Set<ColId>;
}) {
  const { openLead } = useApp();
  const [limit, setLimit] = useState(PAGE);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const compact = density === "compact";

  const sorted = useMemo(() => sortLeads(rows, sort), [rows, sort]);
  const cols = useMemo(() => ALL_COLS.filter((c) => visibleCols.has(c.id)), [visibleCols]);

  const groups = useMemo(() => {
    if (group === "none") return null;
    const get = GROUP_META[group].get;
    const m = new Map<string, Lead[]>();
    for (const l of sorted) {
      const k = get(l) || "—";
      const arr = m.get(k);
      if (arr) arr.push(l);
      else m.set(k, [l]);
    }
    const list = [...m.entries()].map(([k, v]) => ({
      ...(aggregate(k, v) as Agg & { label: string; rows: Lead[] }),
      label: k,
      rows: v,
    }));
    if (group === "month") list.sort((a, b) => b.label.localeCompare(a.label));
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [sorted, group]);

  // reset pagination when inputs change
  React.useEffect(() => { setLimit(PAGE); }, [rows, sort, group, density]);

  const headerCell = (c: (typeof ALL_COLS)[number]) => {
    const active = sort.find((s) => s.key === c.sortable);
    const ord = sort.length > 1 && active ? sort.indexOf(active) + 1 : null;
    const right = c.id === "ltv" || c.id === "visits" || c.id === "purchases" || c.id === "fups";
    return (
      <th
        key={c.id}
        className={cn(
          "whitespace-nowrap px-3 font-medium", compact ? "py-2" : "py-2.5",
          right ? "text-right" : "text-left",
        )}
      >
        {c.sortable ? (
          <button
            onClick={(e) => {
              const additive = e.shiftKey;
              onSort(
                ((): SortSpec[] => {
                  const cur = sort.find((s) => s.key === c.sortable);
                  if (!cur) return additive ? [...sort, { key: c.sortable!, dir: c.sortable === "name" ? "asc" : "desc" }] : [{ key: c.sortable!, dir: c.sortable === "name" ? "asc" : "desc" }];
                  if (cur.dir === "desc" && c.sortable !== "name") return additive ? sort.map((s) => s.key === c.sortable ? { ...s, dir: "asc" } : s) : [{ key: c.sortable!, dir: "asc" }];
                  if (cur.dir === "asc") return additive ? sort.map((s) => s.key === c.sortable ? { ...s, dir: "desc" } : s) : [{ key: c.sortable!, dir: "desc" }];
                  return additive ? sort.filter((s) => s.key !== c.sortable) : [];
                })(),
              );
            }}
            className={cn(
              "inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors",
              active ? "text-ember-400" : "text-mist-500 hover:text-mist-200",
              right && "flex-row-reverse",
            )}
            title="Click to sort · Shift+click for multi-sort"
          >
            {c.label}
            {active ? (active.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-50" />}
            {ord !== null && <span className="rounded bg-ember-500 px-1 text-[9px] text-onaccent">{ord}</span>}
          </button>
        ) : (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mist-500">{c.label}</span>
        )}
      </th>
    );
  };

  const leadRow = (l: Lead, inGroup: boolean) => (
    <tr
      key={l.id}
      onClick={() => openLead(l)}
      className="group cursor-pointer border-b border-line-soft/60 transition-colors hover:bg-ink-850/60"
    >
      <td className={cn("px-3", compact ? "py-1.5" : "py-2.5")}>
        <div className="flex items-center gap-2.5">
          {inGroup ? (
            <CornerDownRight className="size-3.5 shrink-0 text-mist-600" />
          ) : (
            <Avatar name={l.name} size={compact ? 24 : 28} />
          )}
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-mist-100 transition-colors group-hover:text-mist-100">
              {l.name}
            </p>
            <p className="tnum truncate text-[10.5px] text-mist-600">
              #{l.id}{l.email ? ` · ${l.email}` : l.phone ? ` · ${fmt.phone(l.phone)}` : ""}
            </p>
          </div>
        </div>
      </td>
      {cols.map((c) => (
        <td key={c.id} className={cn("px-3 text-[12px]", compact ? "py-1.5" : "py-2.5", (c.id === "ltv" || c.id === "visits" || c.id === "purchases" || c.id === "fups") && "text-right")}>
          <Cell col={c.id} lead={l} />
        </td>
      ))}
    </tr>
  );

  if (!rows.length) {
    return <EmptyState icon={<Users className="size-5" />} title="No leads match" sub="Loosen the filters or reset them to see records again." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead className="sticky top-[52px] z-10 bg-ink-900">
          <tr className="border-b border-line">
            <th className={cn("w-[240px] px-3 text-left", compact ? "py-2" : "py-2.5")}>
              {(() => {
                const active = sort.find((s) => s.key === "name");
                return (
                  <button
                    onClick={() => onSort(active ? (active.dir === "asc" ? [{ key: "name", dir: "desc" }] : []) : [{ key: "name", dir: "asc" }])}
                    className={cn("inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]", active ? "text-ember-400" : "text-mist-500 hover:text-mist-200")}
                  >
                    Lead {active ? (active.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                  </button>
                );
              })()}
            </th>
            {cols.map(headerCell)}
          </tr>
        </thead>
        <tbody>
          {groups
            ? groups.map((g) => {
                const isClosed = closed.has(g.label);
                const cap = expandedGroups.has(g.label) ? g.rows.length : 15;
                const visible = g.rows.slice(0, cap);
                return (
                  <React.Fragment key={g.label}>
                    <GroupHead
                      g={g} open={!isClosed} colSpan={cols.length + 1} compact={compact}
                      onToggle={() =>
                        setClosed((s) => {
                          const n = new Set(s);
                          if (n.has(g.label)) n.delete(g.label); else n.add(g.label);
                          return n;
                        })
                      }
                    />
                    {!isClosed && visible.map((l) => leadRow(l, false))}
                    {!isClosed && g.rows.length > cap && (
                      <tr>
                        <td colSpan={cols.length + 1} className="border-b border-line-soft">
                          <button
                            onClick={() => setExpandedGroups((s) => new Set(s).add(g.label))}
                            className="flex w-full items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-ember-400 transition-colors hover:bg-ink-850"
                          >
                            <Plus className="size-3.5" /> Show all {fmt.int(g.rows.length)} in {g.label}
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            : sorted.slice(0, limit).map((l) => leadRow(l, false))}
        </tbody>
      </table>

      {!groups && sorted.length > limit && (
        <button
          onClick={() => setLimit((n) => n + PAGE * 2)}
          className="flex w-full items-center justify-center gap-2 border-t border-line-soft py-3 text-[12px] font-medium text-mist-400 transition-colors hover:bg-ink-850 hover:text-mist-100"
        >
          <Download className="size-3.5 rotate-180" />
          Load more — showing {fmt.int(limit)} of {fmt.int(sorted.length)}
        </button>
      )}
      {!groups && (
        <p className="tnum border-t border-line-soft px-4 py-2.5 text-[10.5px] text-mist-600">
          {fmt.int(Math.min(limit, sorted.length))} / {fmt.int(sorted.length)} rows · click a row for the full profile · shift+click headers for multi-sort
        </p>
      )}
    </div>
  );
}

export { ColumnsMenu };
