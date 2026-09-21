import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Phone, Mail, BadgeCheck, CalendarDays, Store, Megaphone, Share2, UserRound,
  Layers, MessagesSquare, Wallet, Footprints, ShoppingBag, StickyNote, Hash, GitBranch, Check,
} from "lucide-react";
import { useApp } from "../state/app";
import { Avatar } from "./ui";
import { fmt, statusColor, stagePhase, PHASE_META, shortCenter, Lead } from "../lib/data";
import { cn } from "../utils/cn";

const PHASE_RAIL = ["Prospect", "Engagement", "Trial", "Decision", "Won"] as const;

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-md border border-line-soft bg-ink-850 text-mist-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mist-600">{label}</p>
        <div className="mt-0.5 text-[12.5px] text-mist-200">{children}</div>
      </div>
    </div>
  );
}

function Flag({ on, label, color }: { on: boolean; label: string; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        on ? "text-white" : "border-line text-mist-600",
      )}
      style={on ? { background: color + "26", borderColor: color + "55" } : undefined}
    >
      <span className="size-1 rounded-full" style={{ background: on ? color : "#3f444e" }} />
      {label}
    </span>
  );
}

function Body({ lead }: { lead: Lead }) {
  const phase = stagePhase(lead.stage);
  const lost = phase === "Lost";
  const railIdx = PHASE_RAIL.indexOf(phase as any);
  return (
    <div className="px-5 pb-8">
      {/* pipeline rail */}
      <div className="mt-4 rounded-xl border border-line-soft bg-ink-850/50 p-3.5">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">Pipeline position</p>
        <div className="flex items-center">
          {PHASE_RAIL.map((p, i) => {
            const reached = lost ? i <= 1 : i <= railIdx;
            const current = !lost && i === railIdx;
            const color = PHASE_META[p as keyof typeof PHASE_META].color;
            return (
              <div key={p} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={cn("flex size-4 items-center justify-center rounded-full border-2 transition-all", current && "scale-110")}
                    style={{
                      borderColor: reached ? color : "#2c303a",
                      background: reached ? color : "transparent",
                      boxShadow: current ? `0 0 10px ${color}66` : undefined,
                    }}
                  >
                    {reached && <Check className="size-2.5 text-ink-950" strokeWidth={4} />}
                  </span>
                  <span className={cn("text-[8.5px] font-medium", reached ? "text-mist-300" : "text-mist-600")}>{p}</span>
                </div>
                {i < PHASE_RAIL.length - 1 && (
                  <div className="mx-1 mb-4 h-0.5 flex-1 rounded-full" style={{ background: !lost && i < railIdx ? color : "#22252d" }} />
                )}
              </div>
            );
          })}
        </div>
        {lost && (
          <p className="mt-2 rounded-md bg-rose-400/10 px-2 py-1 text-[10.5px] font-medium text-rose-400">
            Exited funnel — {lead.stage}
          </p>
        )}
      </div>

      {/* mini kpis */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { icon: <Wallet className="size-3.5" />, label: "LTV", value: lead.ltv ? fmt.inrC(lead.ltv) : "—", tone: "#fbbf24" },
          { icon: <ShoppingBag className="size-3.5" />, label: "Purchases", value: lead.purchases ? String(lead.purchases) : "—", tone: "#38bdf8" },
          { icon: <Footprints className="size-3.5" />, label: "Visits", value: lead.visits ? String(lead.visits) : "—", tone: "#a78bfa" },
          { icon: <MessagesSquare className="size-3.5" />, label: "Follow-ups", value: lead.fupCount ? String(lead.fupCount) : "—", tone: "#ff6b47" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-line-soft bg-ink-850/50 p-2.5 text-center">
            <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-md" style={{ color: k.tone, background: k.tone + "14" }}>
              {k.icon}
            </span>
            <p className="tnum text-[13px] font-semibold text-white">{k.value}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-mist-600">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Flag on={lead.trialed} label="Trial completed" color="#a78bfa" />
        <Flag on={lead.conv} label="Converted" color="#34d399" />
        <Flag on={lead.retained} label="Retained" color="#a3e635" />
        <Flag on={lead.ltv > 0} label="Paying" color="#fbbf24" />
      </div>

      <div className="mt-4 divide-y divide-line-soft rounded-xl border border-line-soft bg-ink-850/40 px-3.5">
        <Row icon={<Phone className="size-3" />} label="Phone">
          {lead.phone ? (
            <a className="tnum text-sky-400 hover:underline" href={`tel:+${lead.phone.replace(/\D/g, "")}`}>{fmt.phone(lead.phone)}</a>
          ) : "—"}
        </Row>
        <Row icon={<Mail className="size-3" />} label="Email">
          {lead.email ? <a className="break-all text-sky-400 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}
        </Row>
        <Row icon={<Store className="size-3" />} label="Centre">{lead.center}</Row>
        <Row icon={<Megaphone className="size-3" />} label="Channel">{lead.channel}</Row>
        <Row icon={<Share2 className="size-3" />} label="Source">{lead.source}</Row>
        <Row icon={<UserRound className="size-3" />} label="Associate">{lead.associate}</Row>
        <Row icon={<Layers className="size-3" />} label="Class type">{lead.cls}</Row>
        <Row icon={<CalendarDays className="size-3" />} label="Created">
          <span className="tnum">{fmt.date(lead.created)}</span>
          <span className="ml-1.5 text-mist-600">({fmt.daysAgo(lead.created)})</span>
        </Row>
        {lead.converted && (
          <Row icon={<BadgeCheck className="size-3" />} label="Converted">
            <span className="tnum text-mint-400">{fmt.date(lead.converted)}</span>
            {lead.createdTs && lead.convertedTs && (
              <span className="ml-1.5 text-mist-600">
                · {Math.round((lead.convertedTs - lead.createdTs) / 86400000)}d to convert
              </span>
            )}
          </Row>
        )}
        {lead.memberId && <Row icon={<Hash className="size-3" />} label="Member ID"><span className="tnum">{lead.memberId}</span></Row>}
      </div>

      {lead.remarks && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            <StickyNote className="size-3" /> Remarks
          </p>
          <p className="rounded-xl border border-line-soft bg-ink-850/40 p-3.5 text-[12px] leading-relaxed text-mist-300">
            {lead.remarks}
          </p>
        </div>
      )}

      {lead.fupCount > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            <GitBranch className="size-3" /> Follow-up timeline · <span className="tnum text-ember-400">{lead.fupCount}</span>
          </p>
          <ol className="relative ml-1.5 space-y-3 border-l border-line pl-4">
            {lead.fups.map((fu, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-ink-950 bg-ember-500" />
                <p className="tnum text-[10.5px] font-medium text-mist-500">#{i + 1} · {fmt.date(fu.d)}</p>
                {fu.c && <p className="mt-0.5 text-[12px] leading-relaxed text-mist-300">{fu.c}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function LeadDrawer() {
  const { selected: lead, openLead } = useApp();
  useEffect(() => {
    if (!lead) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && openLead(null);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [lead, openLead]);
  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-[2px]"
            onClick={() => openLead(null)}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0.08, duration: 0.5 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-line bg-ink-900 shadow-2xl shadow-black/60"
          >
            <div className="sticky top-0 z-10 border-b border-line-soft bg-ink-900/95 px-5 pb-4 pt-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={lead.name} size={44} />
                  <div>
                    <h2 className="font-display text-[17px] font-semibold leading-tight text-white">{lead.name}</h2>
                    <p className="tnum mt-0.5 text-[11px] text-mist-500">
                      #{lead.id} · {shortCenter(lead.center)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openLead(null)}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-mist-400 transition-colors hover:bg-ink-800 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-950"
                  style={{ background: statusColor(lead.status) }}
                >
                  {lead.status}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-850 px-2.5 py-1 text-[11px] text-mist-300">
                  <span className="size-1.5 rounded-full" style={{ background: PHASE_META[stagePhase(lead.stage)].color }} />
                  {lead.stage}
                </span>
              </div>
            </div>
            <Body lead={lead} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
