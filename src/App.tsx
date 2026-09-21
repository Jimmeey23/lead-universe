import { AnimatePresence, motion } from "framer-motion";
import { Activity, LayoutDashboard, Table2, KanbanSquare, Building2, Database, AlertTriangle, Users, Sun, Moon } from "lucide-react";
import { AppProvider, useApp, ViewId } from "./state/app";
import { FilterBar } from "./components/FilterBar";
import { LeadDrawer } from "./components/LeadDrawer";
import { OverviewView } from "./views/OverviewView";
import { ExplorerView } from "./views/ExplorerView";
import { BoardView } from "./views/BoardView";
import { StudiosView } from "./views/StudiosView";
import { AssociatesView } from "./views/AssociatesView";
import { fmt } from "./lib/data";
import { cn } from "./utils/cn";

const VIEWS: { id: ViewId; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="size-4" />, sub: "Command deck" },
  { id: "explorer", label: "Explorer", icon: <Table2 className="size-4" />, sub: "Sort · group · drill" },
  { id: "board", label: "Board", icon: <KanbanSquare className="size-4" />, sub: "Pipeline lanes" },
  { id: "studios", label: "Studios", icon: <Building2 className="size-4" />, sub: "Per-centre dossier" },
  { id: "associates", label: "Associates", icon: <Users className="size-4" />, sub: "Head-to-head performance" },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      className="relative flex h-7 w-[52px] shrink-0 items-center rounded-full border border-line bg-ink-850 px-1 transition-colors hover:border-line-strong"
    >
      <motion.span
        layout
        transition={{ type: "spring", bounce: 0.24, duration: 0.45 }}
        className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-ember-400 to-ember-600 text-onaccent shadow"
        style={{ marginLeft: dark ? 0 : 22 }}
      >
        {dark ? <Moon className="size-3" strokeWidth={2.4} /> : <Sun className="size-3" strokeWidth={2.4} />}
      </motion.span>
    </button>
  );
}

function Loader({ error }: { error: string | null }) {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex items-end gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="eq-bar w-2 rounded-full bg-ember-500"
            style={{ height: 34 - i * 9, animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="font-display text-[17px] font-semibold tracking-wide text-mist-100">
          Lead<span className="text-gradient">Pulse</span>
        </p>
        {error ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-rose-400">
            <AlertTriangle className="size-3.5" /> Failed to decode dataset — {error}
          </p>
        ) : (
          <p className="tnum mt-2 text-[11.5px] text-mist-500">Decoding 24,865 lead records…</p>
        )}
      </div>
    </div>
  );
}

function Header() {
  const { view, setView, data } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-[52px] max-w-[1560px] items-center gap-4 px-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-ember-400 to-ember-600 shadow-lg shadow-ember-500/25">
            <Activity className="size-4 text-onaccent" strokeWidth={2.6} />
          </span>
          <div className="leading-none">
            <p className="font-display text-[15px] font-semibold tracking-wide text-mist-100">
              Lead<span className="text-ember-400">Pulse</span>
            </p>
            <p className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.2em] text-mist-600 sm:block">
              Studio lead intelligence
            </p>
          </div>
        </div>

        <nav className="mx-auto flex items-center gap-1 rounded-xl border border-line bg-ink-900 p-1">
          {VIEWS.map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active ? "text-mist-100" : "text-mist-500 hover:text-mist-200",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-ink-700 ring-1 ring-line-strong"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {v.icon}
                  <span className="hidden sm:inline">{v.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
        </div>

        {data && (
          <div className="hidden items-center gap-2 lg:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-ink-900 px-2.5 py-1 text-[10.5px] font-medium text-mist-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-mint-400" />
              </span>
              <span className="tnum">{fmt.compact(data.leads.length)}</span> records live
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function Shell() {
  const { data, error, view } = useApp();
  if (!data) return <Loader error={error} />;

  return (
    <div className="grid-bg min-h-screen">
      <Header />
      <FilterBar />
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "overview" && <OverviewView />}
            {view === "explorer" && <ExplorerView />}
            {view === "board" && <BoardView />}
            {view === "studios" && <StudiosView />}
            {view === "associates" && <AssociatesView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-line-soft py-5">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-2 px-3 sm:px-5">
          <p className="flex items-center gap-1.5 text-[10.5px] text-mist-600">
            <Database className="size-3" />
            Source: ◉ Leads · Sales · Bookings — Google Sheets snapshot · {data.minDate} → {data.maxDate} ·{" "}
            <span className="tnum">{fmt.compact(data.salesCount)}</span> sales ·{" "}
            <span className="tnum">{fmt.compact(data.visitsCount)}</span> visits joined
          </p>
          <p className="text-[10.5px] text-mist-600">
            LeadPulse · built for studio growth teams
          </p>
        </div>
      </footer>

      <LeadDrawer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
