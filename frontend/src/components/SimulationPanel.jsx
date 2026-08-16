import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Zap, Square, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const CONCEPTS = [
  "Trahison Capitaine", "Alliance Brisée", "Mutation Biologique",
  "Crise Économique", "Mort du Roi", "Pacte Commercial",
  "Corruption Judiciaire", "Siège Militaire", "Traité de Paix",
  "Révolte Populaire", "Épidémie Virale", "Fraude Institutionnelle",
];
const TYPES = ["EVENT", "RELATION", "ENTITY", "PATTERN"];
const TIERS = ["SHORT_TERM", "ACTIVE", "DEEP", "DORMANT", "SEALED"];
const CONTEXTS = ["Faction A", "Faction B", "Faction C", "Faction D", "Global"];
const AUDIT_TYPES = ["RESONANCE_UP", "RESONANCE_DOWN", "PRUNE", "TIER_CHANGE"];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function injectNode() {
  const resonance = parseFloat(rand(0.1, 1.0).toFixed(2));
  const fractal_level = Math.floor(rand(0, 5));
  const tier = resonance > 0.85 ? "SEALED" : resonance > 0.65 ? "DEEP" : resonance > 0.35 ? "ACTIVE" : "DORMANT";

  await base44.entities.MemoryNode.create({
    node_id: `sim-${Date.now()}`,
    concept: pick(CONCEPTS),
    type: pick(TYPES),
    fractal_level,
    emotion_weight: parseFloat(rand(0.1, 1.0).toFixed(2)),
    resonance,
    tier,
    context_id: pick(CONTEXTS),
    last_activated: new Date().toISOString(),
    relation_ids: [],
  });
}

async function injectAuditEvent() {
  const type = pick(AUDIT_TYPES);
  const fractal_level = Math.floor(rand(0, 5));
  const from_val = parseFloat(rand(0.1, 0.9).toFixed(2));
  const delta = type === "RESONANCE_UP" ? parseFloat(rand(0.05, 0.25).toFixed(2))
              : type === "RESONANCE_DOWN" ? -parseFloat(rand(0.05, 0.20).toFixed(2))
              : null;
  const to_val = delta != null ? parseFloat(Math.min(1, Math.max(0, from_val + delta)).toFixed(2)) : null;

  await base44.entities.AuditEvent.create({
    event_id: `sim-${Date.now()}`,
    ts: new Date().toISOString(),
    type,
    node_id: `sim-${Date.now()}`,
    concept: pick(CONCEPTS),
    fractal_level,
    delta,
    from_val,
    to_val,
    tier: pick(TIERS),
    tier_from: type === "TIER_CHANGE" ? pick(TIERS) : undefined,
    tier_to:   type === "TIER_CHANGE" ? "SEALED"    : undefined,
    trigger: "SIMULATION — injection manuelle",
  });
}

const SPEEDS = [
  { label: "Lent", ms: 3000 },
  { label: "Normal", ms: 1500 },
  { label: "Rapide", ms: 600 },
];

export default function SimulationPanel() {
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [count, setCount] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const intervalRef = useRef(null);
  const busyRef = useRef(false);

  const start = () => {
    if (running) return;
    setRunning(true);
    setCount(0);
    toast.success("Simulation démarrée", { description: "Injection de données en cours…", duration: 2000 });
    intervalRef.current = setInterval(async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await Promise.all([injectNode(), injectAuditEvent()]);
        setCount((c) => c + 1);
      } catch (e) {
        // silently ignore timeout / network errors during simulation
      } finally {
        busyRef.current = false;
      }
    }, SPEEDS[speed].ms);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    toast.info("Simulation arrêtée", { description: `${count} cycles injectés.`, duration: 3000 });
  };

  const injectOnce = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await Promise.all([injectNode(), injectAuditEvent()]);
      setCount((c) => c + 1);
      toast.success("Injection unique", { description: "1 nœud + 1 événement audit créés.", duration: 2000 });
    } catch (e) {
      toast.error("Erreur d'injection", { description: "Timeout — réessayez.", duration: 2000 });
    } finally {
      busyRef.current = false;
    }
  };

  // When collapsed → render minimal circular FAB in a safe zone (top-right, just under TopBar)
  if (collapsed) {
    return (
      <button
        data-testid="simulation-panel"
        onClick={() => setCollapsed(false)}
        title="Ouvrir la simulation"
        className="fixed top-20 right-4 z-30 h-9 w-9 rounded-full bg-card border border-primary/30 shadow-lg flex items-center justify-center hover:border-primary/60 hover:bg-secondary/50 transition-colors"
      >
        <div className="relative">
          <Zap className={cn("h-3.5 w-3.5", running ? "text-green-400" : "text-muted-foreground")} />
          {running && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </button>
    )
  }

  return (
    <div
      data-testid="simulation-panel"
      className="fixed bottom-5 right-5 z-40 w-64 bg-card border border-primary/30 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", running ? "bg-green-500 animate-pulse" : "bg-muted-foreground")} />
          <span className="text-xs font-bold text-foreground">Mode Simulation</span>
          {running && (
            <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              ×{count}
            </span>
          )}
        </div>
        {collapsed ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                   : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {/* Speed selector */}
          <div className="pt-3">
            <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Vitesse d&apos;injection</p>
            <div className="flex gap-1.5">
              {SPEEDS.map((s, i) => (
                <button key={s.label} onClick={() => setSpeed(i)} disabled={running}
                  className={cn("flex-1 py-1 rounded-lg text-xs font-semibold transition-all",
                    speed === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                    running && "opacity-40 cursor-not-allowed")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* What gets injected */}
          <div className="bg-secondary/40 rounded-lg p-2.5 text-[10px] text-muted-foreground space-y-1">
            <p>● MemoryNode aléatoire (résonance 0.1→1.0)</p>
            <p>● AuditEvent (PRUNE / RESONANCE / TIER)</p>
            <p className="text-primary">→ Déclenche alertes si résonance &gt; 90%</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!running ? (
              <button onClick={start}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/80 transition-colors">
                <Zap className="h-3.5 w-3.5" /> Démarrer
              </button>
            ) : (
              <button onClick={stop}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-colors">
                <Square className="h-3.5 w-3.5" /> Arrêter
              </button>
            )}
            <button onClick={injectOnce}
              className="px-3 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors border border-border">
              ×1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}