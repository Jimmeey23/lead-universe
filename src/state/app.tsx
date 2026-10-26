import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useDeferredValue } from "react";
import { Lead, LeadData, loadLeads } from "../lib/data";
import { Filters, EMPTY_FILTERS, applyFilters } from "../lib/stats";

export type ViewId = "overview" | "explorer" | "board" | "studios" | "associates";

export type Theme = "dark" | "light";

const THEME_KEY = "leadpulse:theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* private mode — fall through to the system preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

interface AppState {
  data: LeadData | null;
  error: string | null;
  filters: Filters;
  setFilters: (up: (f: Filters) => Filters) => void;
  resetFilters: () => void;
  filtered: Lead[];
  view: ViewId;
  setView: (v: ViewId) => void;
  selected: Lead | null;
  openLead: (l: Lead | null) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersRaw] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewId>("overview");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* not persisting is fine */
    }
  }, [theme]);

  useEffect(() => {
    let alive = true;
    loadLeads()
      .then((d) => {
        if (alive) {
          setFiltersRaw((f) => ({ ...f, from: "", to: "" }));
          setData(d);
        }
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  const setFilters = useCallback((up: (f: Filters) => Filters) => setFiltersRaw(up), []);
  const resetFilters = useCallback(() => setFiltersRaw(EMPTY_FILTERS), []);
  const openLead = useCallback((l: Lead | null) => setSelected(l), []);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  // inputs update immediately; the 25k-lead refilter and every chart downstream catch up at low priority
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => (data ? applyFilters(data.leads, deferredFilters) : []), [data, deferredFilters]);

  const value = useMemo(
    () => ({ data, error, filters, setFilters, resetFilters, filtered, view, setView, selected, openLead, theme, toggleTheme }),
    [data, error, filters, setFilters, resetFilters, filtered, view, selected, openLead, theme, toggleTheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Resolves CSS custom properties to concrete colours for the current theme.
 * Recharts drops `var(...)` in a few places (Radar fills), so charts that need
 * a literal colour read it through here and re-render when the theme flips.
 */
export function useResolvedColors(vars: string[]): string[] {
  const { theme } = useApp();
  return useMemo(() => {
    if (typeof window === "undefined") return vars;
    const cs = getComputedStyle(document.documentElement);
    return vars.map((v) => {
      const name = /^var\((--[^)]+)\)$/.exec(v.trim())?.[1];
      if (!name) return v;
      return cs.getPropertyValue(name).trim() || v;
    });
    // theme is the trigger: the variables themselves do not change identity
  }, [vars, theme]);
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
