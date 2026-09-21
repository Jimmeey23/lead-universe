import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../utils/cn";
import { fmt, initials, hueOf } from "../lib/data";

/* ──────────────────────────── Hooks ─────────────────────────────── */

export function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [onOut]);
  return ref;
}

/* ──────────────────────────── Panel ─────────────────────────────── */

export function Panel({
  title, sub, right, children, className, pad = true,
}: {
  title?: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {title !== undefined && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            <h3 className="font-display text-[13.5px] font-semibold tracking-wide text-mist-100">{title}</h3>
            {sub && <p className="mt-0.5 text-[11.5px] text-mist-500">{sub}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn(pad && "p-4 sm:p-5", title !== undefined && pad && "pt-3.5")}>{children}</div>
    </section>
  );
}

/* ─────────────────────────── Segmented ──────────────────────────── */

export function Segmented<T extends string>({
  options, value, onChange, size = "md", accent = false,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md" | "xs";
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-line bg-ink-850 p-0.5",
        size === "xs" && "rounded-md p-[3px]",
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative whitespace-nowrap rounded-md font-medium transition-colors",
              size === "md" && "px-3 py-1.5 text-[12px]",
              size === "sm" && "px-2.5 py-1 text-[11.5px]",
              size === "xs" && "px-2 py-0.5 text-[10.5px]",
              active ? "text-white" : "text-mist-500 hover:text-mist-200",
            )}
          >
            {active && (
              <motion.span
                layoutId={accent ? "seg-accent" : undefined}
                className={cn(
                  "absolute inset-0 rounded-md",
                  accent ? "bg-ember-500/90" : "bg-ink-700 ring-1 ring-line-strong",
                )}
                transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── MultiSelect ────────────────────────── */

export interface MsOption {
  value: string;
  count?: number;
  color?: string;
  label?: string;
}

export function MultiSelect({
  label, icon, options, selected, onChange, wide = false, short,
}: {
  label: string;
  icon?: React.ReactNode;
  options: MsOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  wide?: boolean;
  short?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickOutside(() => setOpen(false));
  const n = selected.length;
  const shown = q
    ? options.filter((o) => (o.label ?? o.value).toLowerCase().includes(q.toLowerCase()))
    : options;

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
          n > 0
            ? "border-ember-500/50 bg-ember-950 text-ember-300"
            : "border-line bg-ink-850 text-mist-400 hover:border-line-strong hover:text-mist-200",
        )}
      >
        {icon}
        <span>{label}</span>
        {n > 0 && (
          <span className="tnum rounded bg-ember-500 px-1 py-px text-[10px] font-semibold text-ink-950">{n}</span>
        )}
        <ChevronDown className={cn("size-3.5 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute z-40 mt-1.5 max-h-[340px] overflow-hidden rounded-xl border border-line-strong bg-ink-800 shadow-2xl shadow-black/60",
              wide ? "w-[320px]" : "w-[240px]",
            )}
          >
            <div className="flex items-center gap-1.5 border-b border-line-soft px-2.5 py-2">
              <Search className="size-3.5 text-mist-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full bg-transparent text-[12px] text-mist-100 outline-none placeholder:text-mist-600"
              />
              {n > 0 && (
                <button
                  onClick={() => onChange([])}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-ember-400 hover:bg-ember-950"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {shown.length === 0 && <p className="px-2 py-3 text-[11.5px] text-mist-600">No matches.</p>}
              {shown.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                      on ? "bg-ink-700/80 text-white" : "text-mist-300 hover:bg-ink-750",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                        on ? "border-ember-500 bg-ember-500" : "border-line-strong bg-ink-850",
                      )}
                    >
                      {on && <Check className="size-2.5 text-ink-950" strokeWidth={3.5} />}
                    </span>
                    {o.color && <span className="size-1.5 shrink-0 rounded-full" style={{ background: o.color }} />}
                    <span className="min-w-0 flex-1 truncate">{o.label ?? (short ? short(o.value) : o.value)}</span>
                    {o.count !== undefined && (
                      <span className="tnum shrink-0 text-[10.5px] text-mist-600">{fmt.compact(o.count)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────── Flag toggle ────────────────────────── */

export function FlagToggle({
  label, value, onChange, onColor = "#34d399",
}: {
  label: string;
  value: "any" | "yes" | "no";
  onChange: (v: "any" | "yes" | "no") => void;
  onColor?: string;
}) {
  const cycle: Record<string, "any" | "yes" | "no"> = { any: "yes", yes: "no", no: "any" };
  return (
    <button
      onClick={() => onChange(cycle[value])}
      title={`${label}: ${value === "any" ? "ignored" : value}. Click to cycle.`}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors",
        value === "yes" && "border-transparent text-ink-950",
        value === "no" && "border-rose-400/50 bg-rose-400/10 text-rose-400",
        value === "any" && "border-line bg-ink-850 text-mist-500 hover:text-mist-200 hover:border-line-strong",
      )}
      style={value === "yes" ? { background: onColor } : undefined}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          value === "any" ? "bg-mist-600" : value === "yes" ? "bg-ink-950" : "bg-rose-400",
        )}
      />
      {label}
      {value !== "any" && <span className="text-[10px] opacity-70">{value === "yes" ? "only" : "excl."}</span>}
    </button>
  );
}

/* ───────────────────────────── Avatar ───────────────────────────── */

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-ink-950/90"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${hueOf(name)}, ${hueOf(name + "~")})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* ───────────────────────────── Meter ────────────────────────────── */

export function Meter({
  value, max = 100, color = "var(--color-ember-500)", className, track = "bg-ink-750",
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  track?: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full", track, className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

/* ─────────────────────────── Small bits ─────────────────────────── */

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-mist-400">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-ink-850 text-mist-500">
        {icon}
      </div>
      <p className="font-display text-[14px] font-semibold text-mist-200">{title}</p>
      {sub && <p className="max-w-[280px] text-[11.5px] leading-relaxed text-mist-500">{sub}</p>}
    </div>
  );
}

export function ClearPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center gap-1 rounded-lg border border-transparent px-2 text-[11.5px] font-medium text-mist-500 transition-colors hover:bg-ink-800 hover:text-ember-400"
    >
      <X className="size-3.5" /> Reset
    </button>
  );
}
