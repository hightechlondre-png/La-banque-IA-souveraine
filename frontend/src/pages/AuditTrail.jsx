import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileSearch, Filter, TrendingUp, TrendingDown, Scissors, Zap, Lock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

function severity(event) {
  if (event.type === "PRUNE")       return "critical";
  if (event.type === "TIER_CHANGE") return "high";
  const abs = Math.abs(event.delta ?? 0);
  if (abs >= 0.12) return "critical";
  if (abs >= 0.07) return "high";
  if (abs >= 0.04) return "medium";
  return "low";
}

const SEVERITY_LABELS = ["critical", "high", "medium", "low"];

const typeConfig = {
  RESONANCE_UP:   { label: "Résonance ↑",  icon: TrendingUp,   color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  RESONANCE_DOWN: { label: "Résonance ↓",  icon: TrendingDown, color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20"    },
  PRUNE:          { label: "Élagage",       icon: Scissors,     color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  TIER_CHANGE:    { label: "Tier Change",   icon: Zap,          color: "text-primary",    bg: "bg-primary/10 border-primary/20"    },
};

const severityConfig = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium:   "bg-accent/10 text-accent border-accent/20",
  low:      "bg-primary/10 text-primary border-primary/20",
};

const tierBadge = {
  SEALED:     "bg-red-500/10 text-red-400 border-red-500/20",
  DEEP:       "bg-purple-500/10 text-purple-400 border-purple-500/20",
  ACTIVE:     "bg-green-500/10 text-green-400 border-green-500/20",
  SHORT_TERM: "bg-primary/10 text-primary border-primary/20",
  DORMANT:    "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const levelColor = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"];

export default function AuditTrail() {
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const { data: rawEvents = [], isLoading } = useQuery({
    queryKey: ["audit-events"],
    queryFn: () => base44.entities.AuditEvent.list("-ts", 100),
  });

  const events = useMemo(() => rawEvents.map((e) => ({ ...e, severity: severity(e) })), [rawEvents]);

  const filtered = useMemo(() => events.filter((e) => {
    if (filterLevel    !== "all" && String(e.fractal_level) !== filterLevel) return false;
    if (filterSeverity !== "all" && e.severity !== filterSeverity)            return false;
    if (filterType     !== "all" && e.type !== filterType)                    return false;
    return true;
  }), [events, filterLevel, filterSeverity, filterType]);

  const counts = useMemo(() => ({
    total:    events.length,
    prune:    events.filter((e) => e.type === "PRUNE").length,
    critical: events.filter((e) => e.severity === "critical").length,
    tier:     events.filter((e) => e.type === "TIER_CHANGE").length,
  }), [events]);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Audit Trail</h2>
          <p className="text-sm text-muted-foreground mt-1">N-MEM-B — Historique chronologique des mutations mémoire</p>
        </div>
        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
          <Lock className="h-3 w-3 mr-1" />
          IMMUTABLE LOG
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Événements totaux", value: counts.total,    icon: FileSearch,  color: "text-primary" },
          { label: "Élagages (Prune)",  value: counts.prune,    icon: Scissors,    color: "text-orange-400" },
          { label: "Impact Critique",   value: counts.critical, icon: TrendingUp,  color: "text-red-400" },
          { label: "Tier Changes",      value: counts.tier,     icon: Zap,         color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Filtres</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Niveau Fractal</span>
            <div className="flex gap-1.5">
              {["all","0","1","2","3","4"].map((l) => (
                <button key={l} onClick={() => setFilterLevel(l)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all",
                    filterLevel === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                  style={filterLevel !== l && l !== "all" ? { borderBottom: `2px solid ${levelColor[Number(l)]}` } : {}}>
                  {l === "all" ? "Tous" : `L${l}`}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px bg-border" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Sévérité</span>
            <div className="flex gap-1.5 flex-wrap">
              {["all", ...SEVERITY_LABELS].map((s) => (
                <button key={s} onClick={() => setFilterSeverity(s)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                    filterSeverity === s ? "bg-primary text-primary-foreground border-primary"
                      : s === "all" ? "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                      : cn("border-transparent hover:text-foreground", severityConfig[s])
                  )}>
                  {s === "all" ? "Tous" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px bg-border" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</span>
            <div className="flex gap-1.5 flex-wrap">
              {["all", ...Object.keys(typeConfig)].map((t) => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}>
                  {t === "all" ? "Tous" : typeConfig[t].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-1">
            {filtered.length} événement{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          </p>

          <div className="space-y-2">
            {filtered.map((event) => {
              const cfg = typeConfig[event.type];
              const Icon = cfg?.icon ?? Zap;
              const isOpen = expanded === event.id;
              const sev = event.severity;

              return (
                <div key={event.id}
                  className={cn("bg-card border rounded-xl transition-all",
                    sev === "critical" ? "border-red-500/30" : sev === "high" ? "border-orange-500/20" : "border-border"
                  )}>
                  <button onClick={() => setExpanded(isOpen ? null : event.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/20 transition-colors rounded-xl">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${levelColor[event.fractal_level]}22`, border: `1px solid ${levelColor[event.fractal_level]}55` }}>
                      <Icon className={`h-4 w-4 ${cfg?.color ?? "text-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{event.concept}</span>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", cfg?.bg)}>{cfg?.label}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", severityConfig[sev])}>{sev}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", tierBadge[event.tier] ?? "")}>{event.tier}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{event.ts?.slice(0,19).replace("T"," ")}</span>
                        <span className="text-[10px]" style={{ color: levelColor[event.fractal_level] }}>L{event.fractal_level}</span>
                        {event.delta != null && (
                          <span className={cn("text-[10px] font-mono font-bold", event.delta > 0 ? "text-green-400" : "text-red-400")}>
                            {event.delta > 0 ? "+" : ""}{(event.delta * 100).toFixed(0)}% résonance
                          </span>
                        )}
                        {event.type === "TIER_CHANGE" && (
                          <span className="text-[10px] text-muted-foreground font-mono">{event.tier_from} → {event.tier_to}</span>
                        )}
                      </div>
                    </div>
                    {event.delta != null && (
                      <div className="shrink-0 text-right hidden sm:block">
                        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(Math.abs((event.to_val ?? event.from_val) ?? 0) * 100, 100)}%`,
                            background: levelColor[event.fractal_level],
                          }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {event.to_val != null ? `${(event.to_val * 100).toFixed(0)}%` : `${(event.from_val * 100).toFixed(0)}%`}
                        </span>
                      </div>
                    )}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                             : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {[
                        ["ID Nœud",     event.node_id],
                        ["Trigger",     event.trigger],
                        ["De",          event.from_val != null ? `${(event.from_val*100).toFixed(0)}%` : "—"],
                        ["Vers",        event.to_val != null ? `${(event.to_val*100).toFixed(0)}%` : event.type === "PRUNE" ? "SUPPRIMÉ" : "—"],
                        ["Decay factor",(0.95 - event.fractal_level * 0.10).toFixed(2)],
                        ["Seuil prop.", (0.05 + event.fractal_level * 0.10).toFixed(2)],
                        ...(event.type === "TIER_CHANGE" ? [["Tier", `${event.tier_from} → ${event.tier_to}`]] : []),
                      ].map(([k, v]) => (
                        <div key={k} className="bg-secondary/50 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground mb-0.5">{k}</p>
                          <p className="font-mono text-foreground break-all">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <FileSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun événement ne correspond aux filtres sélectionnés.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}