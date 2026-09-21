import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Phone, Mail, BadgeCheck, CalendarDays, Store, Megaphone, Share2, UserRound,
  Layers, MessagesSquare, Wallet, Footprints, ShoppingBag, StickyNote, Hash, GitBranch, Check,
  Receipt, Dumbbell, Ban, CircleSlash,
} from "lucide-react";
import { useApp } from "../state/app";
import { Avatar } from "./ui";
import { fmt, statusColor, stagePhase, PHASE_META, shortCenter, tint, Lead, Sale, Visit } from "../lib/data";
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

function Flag({ on, label, color, hint }: { on: boolean; label: string; color: string; hint?: string }) {
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        on ? "text-mist-100" : "border-line text-mist-600",
      )}
      style={on ? { background: tint(color, 18), borderColor: tint(color, 45), color } : undefined}
    >
      <span className="size-1 rounded-full" style={{ background: on ? color : "var(--color-line-strong)" }} />
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
                      borderColor: reached ? color : "var(--color-line-strong)",
                      background: reached ? color : "transparent",
                      boxShadow: current ? `0 0 10px ${tint(color, 45)}` : undefined,
                    }}
                  >
                    {reached && <Check className="size-2.5 text-ink-900" strokeWidth={4} />}
                  </span>
                  <span className={cn("text-[8.5px] font-medium", reached ? "text-mist-300" : "text-mist-600")}>{p}</span>
                </div>
                {i < PHASE_RAIL.length - 1 && (
                  <div className="mx-1 mb-4 h-0.5 flex-1 rounded-full" style={{ background: !lost && i < railIdx ? color : "var(--color-line)" }} />
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
          { icon: <Wallet className="size-3.5" />, label: "LTV", value: lead.ltv ? fmt.inrC(lead.ltv) : "—", tone: "var(--color-gold-400)" },
          { icon: <ShoppingBag className="size-3.5" />, label: "Purchases", value: lead.purchases ? String(lead.purchases) : "—", tone: "var(--color-sky-400)" },
          { icon: <Footprints className="size-3.5" />, label: "Visits", value: lead.visits ? String(lead.visits) : "—", tone: "var(--color-violet-400)" },
          { icon: <MessagesSquare className="size-3.5" />, label: "Follow-ups", value: lead.fupCount ? String(lead.fupCount) : "—", tone: "var(--color-ember-500)" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-line-soft bg-ink-850/50 p-2.5 text-center">
            <span className="mx-auto mb-1 flex size-6 items-center justify-center rounded-md" style={{ color: k.tone, background: tint(k.tone, 12) }}>
              {k.icon}
            </span>
            <p className="tnum text-[13px] font-semibold text-mist-100">{k.value}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-mist-600">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Flag
          on={lead.trialed}
          label="Trial completed"
          color="var(--color-violet-400)"
          hint={lead.trialed ? `Attended a class on ${fmt.date(lead.trialDate)} — from the Bookings sheet` : "No class attended after the enquiry date"}
        />
        <Flag
          on={lead.conv}
          label="Converted"
          color="var(--color-mint-400)"
          hint={lead.conv ? `Bought ${lead.sales.find((s) => s.converting && s.postLead)?.product} on ${fmt.date(lead.firstSaleDate)}` : "No qualifying purchase after the enquiry date (intro offers, retail and credits do not count)"}
        />
        <Flag on={lead.retained} label="Retained" color="var(--color-lime-400)" />
        <Flag on={lead.ltv > 0} label="Paying" color="var(--color-gold-400)" hint={`${fmt.inr(lead.ltv)} spent after the enquiry`} />
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
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-ink-900 bg-ember-500" />
                <p className="tnum text-[10.5px] font-medium text-mist-500">#{i + 1} · {fmt.date(fu.d)}</p>
                {fu.c && <p className="mt-0.5 text-[12px] leading-relaxed text-mist-300">{fu.c}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <SalesHistory lead={lead} />
      <VisitHistory lead={lead} />
    </div>
  );
}

/* ───────────────────── Purchase history (Sales sheet) ──────────────── */

function SaleLine({ s, created }: { s: Sale; created: string }) {
  const pre = !s.postLead;
  return (
    <li className="relative">
      <span
        className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-ink-900")}
        style={{ background: s.converting && !pre ? "var(--color-mint-400)" : pre ? "var(--color-line-strong)" : "var(--color-gold-400)" }}
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[12px] font-medium text-mist-200">{s.product}</p>
        <span className="tnum shrink-0 text-[11.5px] font-semibold text-gold-400">{fmt.inr(s.value)}</span>
      </div>
      <p className="tnum mt-0.5 text-[10.5px] text-mist-500">
        {fmt.date(s.date)} · {s.category}
        {s.location && s.location !== "—" && <> · {shortCenter(s.location)}</>}
        {s.soldBy && s.soldBy !== "—" && <> · {s.soldBy}</>}
      </p>
      {s.membership && s.membership !== "—" && (
        <p className="mt-0.5 text-[10.5px] text-mist-600">Membership · {s.membership}</p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        {pre ? (
          <Tag color="var(--color-zinc-400)" icon={<CircleSlash className="size-2.5" />} label={`before enquiry (${fmt.date(created)})`} />
        ) : s.converting ? (
          <Tag color="var(--color-mint-400)" icon={<BadgeCheck className="size-2.5" />} label="counts as conversion" />
        ) : (
          <Tag color="var(--color-gold-400)" icon={<Ban className="size-2.5" />} label="excluded — intro / retail / credits" />
        )}
      </div>
    </li>
  );
}

function Tag({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[9.5px] font-medium"
      style={{ background: tint(color, 14), color }}
    >
      {icon}
      {label}
    </span>
  );
}

function SalesHistory({ lead }: { lead: Lead }) {
  if (!lead.sales.length) {
    return (
      <Empty
        icon={<Receipt className="size-3" />}
        title="Purchase history"
        note={lead.email || lead.memberId ? "No sales matched this lead in the Sales sheet." : "No email or member ID to match against the Sales sheet."}
      />
    );
  }
  const converting = lead.sales.filter((s) => s.converting && s.postLead).length;
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
        <Receipt className="size-3" /> Purchase history ·{" "}
        <span className="tnum text-ember-400">{lead.sales.length}</span>
        <span className="ml-auto normal-case tracking-normal text-mist-500">
          {converting} qualifying · {fmt.inr(lead.totalSpend)} lifetime
        </span>
      </p>
      <ol className="relative ml-1.5 space-y-3 border-l border-line pl-4">
        {lead.sales.map((s, i) => (
          <SaleLine key={i} s={s} created={lead.created} />
        ))}
      </ol>
    </div>
  );
}

/* ───────────────────── Visit history (Bookings sheet) ──────────────── */

function visitTone(v: Visit) {
  if (v.attended) return { c: "var(--color-violet-400)", t: "Attended" };
  if (v.noShow) return { c: "var(--color-rose-400)", t: "No show" };
  if (v.lateCancelled) return { c: "var(--color-ember-600)", t: "Late cancelled" };
  if (v.cancelled) return { c: "var(--color-zinc-400)", t: "Cancelled" };
  return { c: "var(--color-mist-500)", t: "Not attended" };
}

function VisitHistory({ lead }: { lead: Lead }) {
  if (!lead.visitLog.length) {
    return (
      <Empty
        icon={<Dumbbell className="size-3" />}
        title="Visit history"
        note="No bookings matched this lead in the Bookings sheet."
      />
    );
  }
  // newest first — recency is what a caller needs on the phone
  const rows = [...lead.visitLog].reverse();
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
        <Dumbbell className="size-3" /> Visit history ·{" "}
        <span className="tnum text-ember-400">{lead.visitLog.length}</span>
        <span className="ml-auto normal-case tracking-normal text-mist-500">
          {lead.visits} attended after enquiry
          {lead.lastVisit && <> · last {fmt.daysAgo(lead.lastVisit)}</>}
        </span>
      </p>
      <ol className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {rows.map((v, i) => {
          const tone = visitTone(v);
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border border-line-soft bg-ink-850/40 px-2.5 py-1.5",
                !v.postLead && "opacity-55",
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: tone.c }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-mist-200">{v.cls}</p>
                <p className="tnum truncate text-[10px] text-mist-600">
                  {fmt.date(v.date)}
                  {v.teacher && v.teacher !== "—" && <> · {v.teacher}</>}
                  {v.location && v.location !== "—" && <> · {shortCenter(v.location)}</>}
                </p>
              </div>
              <span className="shrink-0 text-[9.5px] font-medium" style={{ color: tone.c }}>
                {tone.t}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-[9.5px] text-mist-600">
        Faded rows pre-date the enquiry on {fmt.date(lead.created)} and are ignored by the badges.
      </p>
    </div>
  );
}

function Empty({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600">
        {icon} {title}
      </p>
      <p className="rounded-xl border border-dashed border-line-soft px-3.5 py-3 text-[11.5px] text-mist-600">{note}</p>
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
            className="scrim fixed inset-0 z-50 backdrop-blur-[2px]"
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
                    <h2 className="font-display text-[17px] font-semibold leading-tight text-mist-100">{lead.name}</h2>
                    <p className="tnum mt-0.5 text-[11px] text-mist-500">
                      #{lead.id} · {shortCenter(lead.center)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openLead(null)}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-mist-400 transition-colors hover:bg-ink-800 hover:text-mist-100"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: tint(statusColor(lead.status), 16),
                    borderColor: tint(statusColor(lead.status), 42),
                    color: statusColor(lead.status),
                  }}
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
