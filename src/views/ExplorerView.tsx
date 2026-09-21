import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Table2, LayoutGrid, Rows3, List, ChevronDown, Download, X, MessagesSquare, Footprints, Group,
} from "lucide-react";
import { useApp } from "../state/app";
import {
  DataTable, ColumnsMenu, SortSpec, SortKey, GroupKey, GROUP_META, ColId, ALL_COLS, sortLeads, exportCsv,
} from "../components/DataTable";
import { Segmented, Avatar, useClickOutside, EmptyState, Panel } from "../components/ui";
import { fmt, statusColor, shortCenter, Lead, initials, tint } from "../lib/data";
import { cn } from "../utils/cn";
import { UserRoundSearch } from "lucide-react";

/* ─────────────────────────── Group select ───────────────────────── */

function GroupSelect({ value, onChange }: { value: GroupKey; onChange: (v: GroupKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
          value !== "none"
            ? "border-ember-500/50 bg-ember-950 text-ember-300"
            : "border-line bg-ink-850 text-mist-400 hover:border-line-strong hover:text-mist-200",
        )}
      >
        <Group className="size-3.5" />
        Group: {GROUP_META[value].label}
        <ChevronDown className={cn("size-3.5 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 mt-1.5 w-[200px] rounded-xl border border-line-strong bg-ink-800 p-1 shadow-2xl shadow-black/60"
          >
            {(Object.keys(GROUP_META) as GroupKey[]).map((k) => (
              <button
                key={k}
                onClick={() => { onChange(k); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px]",
                  k === value ? "bg-ink-700 text-mist-100" : "text-mist-300 hover:bg-ink-750",
                )}
              >
                {GROUP_META[k].label}
                {k === value && <span className="size-1.5 rounded-full bg-ember-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────── Cards grid ─────────────────────────── */

function LeadCard({ lead, i }: { lead: Lead; i: number }) {
  const { openLead } = useApp();
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i, 24) * 0.012 }}
      onClick={() => openLead(lead)}
      className="card card-hover group p-3.5 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={lead.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-mist-100 group-hover:text-mist-100">{lead.name}</p>
            <p className="tnum truncate text-[10px] text-mist-600">#{lead.id} · {fmt.date(lead.created)}</p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
          style={{
            background: tint(statusColor(lead.status), 15),
            borderColor: tint(statusColor(lead.status), 40),
            color: statusColor(lead.status),
          }}
        >
          {lead.status}
        </span>
      </div>
      <p className="mt-2.5 truncate text-[11.5px] text-mist-400" title={lead.stage}>{lead.stage}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-md border border-line-soft bg-ink-850 px-1.5 py-0.5 text-[10px] text-mist-400">{shortCenter(lead.center)}</span>
        <span className="rounded-md border border-line-soft bg-ink-850 px-1.5 py-0.5 text-[10px] text-mist-400">{lead.source}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5">
        <span className="tnum text-[12px] font-semibold text-mist-100">{lead.ltv ? fmt.inrC(lead.ltv) : "—"}</span>
        <span className="flex items-center gap-2.5 text-[10.5px] text-mist-500">
          <span className="flex items-center gap-1"><MessagesSquare className="size-3 text-ember-400/80" />{lead.fupCount}</span>
          <span className="flex items-center gap-1"><Footprints className="size-3 text-violet-400/80" />{lead.visits}</span>
          <span className="flex items-center gap-1 text-mist-600">{initials(lead.associate)}</span>
        </span>
      </div>
    </motion.button>
  );
}

/* ───────────────────────────── View ─────────────────────────────── */

const SORT_LABEL: Record<SortKey, string> = {
  name: "Name", created: "Created", converted: "Converted", status: "Status", stage: "Stage",
  center: "Centre", source: "Source", associate: "Associate", channel: "Channel", cls: "Class",
  fups: "Follow-ups", visits: "Visits", purchases: "Purchases", ltv: "LTV",
};

export function ExplorerView() {
  const { filtered } = useApp();
  const [layout, setLayout] = useState<"table" | "cards">("table");
  const [group, setGroup] = useState<GroupKey>("status");
  const [density, setDensity] = useState<"compact" | "cozy">("cozy");
  const [sort, setSort] = useState<SortSpec[]>([{ key: "created", dir: "desc" }]);
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(() => new Set(ALL_COLS.filter((c) => c.default).map((c) => c.id)));
  const [cardLimit, setCardLimit] = useState(48);

  const sorted = useMemo(() => sortLeads(filtered, sort), [filtered, sort]);

  const toggleCol = (c: ColId) =>
    setVisibleCols((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  return (
    <div className="mx-auto max-w-[1560px] px-3 pb-16 pt-4 sm:px-5">
      <Panel pad={false} className="overflow-visible">
        {/* toolbar */}
        <div className="relative z-20 flex flex-wrap items-center gap-1.5 border-b border-line-soft bg-ink-900/60 px-3 py-2.5 sm:px-4">
          <Segmented
            value={layout}
            onChange={(v) => setLayout(v as "table" | "cards")}
            options={[
              { value: "table", label: <><Table2 className="size-3.5" /> Table</> },
              { value: "cards", label: <><LayoutGrid className="size-3.5" /> Cards</> },
            ]}
          />
          <GroupSelect value={group} onChange={setGroup} />
          <Segmented
            size="sm"
            value={density}
            onChange={(v) => setDensity(v as "compact" | "cozy")}
            options={[
              { value: "cozy", label: <><List className="size-3.5" /> Cozy</> },
              { value: "compact", label: <><Rows3 className="size-3.5" /> Dense</> },
            ]}
          />
          {/* active sorts */}
          {sort.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {sort.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => setSort(sort.filter((x) => x.key !== s.key))}
                  title="Remove sort"
                  className="flex h-8 items-center gap-1 rounded-lg border border-line bg-ink-850 px-2 text-[10.5px] font-medium text-mist-400 transition-colors hover:border-rose-400/40 hover:text-rose-400"
                >
                  <span className="tnum text-mist-600">{i + 1}</span>
                  {SORT_LABEL[s.key]} {s.dir === "asc" ? "↑" : "↓"}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <ColumnsMenu visible={visibleCols} toggle={toggleCol} />
            <button
              onClick={() => exportCsv(sorted)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-2.5 text-[12px] font-medium text-mist-400 transition-colors hover:border-line-strong hover:text-mist-200"
            >
              <Download className="size-3.5" /> Export
            </button>
          </div>
        </div>

        {/* body */}
        {layout === "table" ? (
          <DataTable rows={filtered} sort={sort} onSort={setSort} group={group} density={density} visibleCols={visibleCols} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserRoundSearch className="size-5" />} title="No leads match" sub="Loosen the filters or reset them to see records again." />
        ) : (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {sorted.slice(0, cardLimit).map((l, i) => <LeadCard key={l.id} lead={l} i={i} />)}
            </div>
            {sorted.length > cardLimit && (
              <button
                onClick={() => setCardLimit((n) => n + 96)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-ink-850 py-3 text-[12px] font-medium text-mist-300 transition-colors hover:border-ember-500/40 hover:text-ember-300"
              >
                Load more — {fmt.int(cardLimit)} of {fmt.int(sorted.length)}
              </button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
