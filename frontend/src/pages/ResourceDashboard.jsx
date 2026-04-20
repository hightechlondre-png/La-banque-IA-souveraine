import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu, Database, Zap, Moon, Play, Square, RefreshCw,
  Activity, TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Settings, BatteryLow, BatteryMedium, BatteryFull, Loader2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from "recharts";

// ── Cluster configs ───────────────────────────────────────
const CLUSTERS = [
  { id: "L0", name: "L0 — EventCore",     color: "#f59e0b", memTotal: 512,  cpuMax: 100 },
  { id: "L1", name: "L1 — RelationMesh",  color: "#3b82f6", memTotal: 1024, cpuMax: 80  },
  { id: "L2", name: "L2 — NarrativeHub",  color: "#10b981", memTotal: 2048, cpuMax: 60  },
  { id: "L3", name: "L3 — WorldBranch",   color: "#8b5cf6", memTotal: 4096, cpuMax: 40  },
  { id: "L4", name: "L4 — StrategicCore", color: "#ef4444", memTotal: 8192, cpuMax: 20  },
];

const SLEEP_THRESHOLD = 15; // % CPU usage below which a node is eligible for sleep
const SLEEP_DURATION  = 30; // seconds simulated

function initCluster(c) {
  return {
    ...c,
    memUsed:   Math.round(c.memTotal * (0.3 + Math.random() * 0.5)),
    cpuUsage:  Math.round(10 + Math.random() * 70),
    aiCycles:  Math.round(100 + Math.random() * 900),
    nodeCount: Math.round(4 + Math.random() * 20),
    sleeping:  0,
    status:    "active",   // active | idle | sleeping
    history:   [],
    autoSleep: true,
  };
}

function nextTick(cluster) {
  if (cluster.status === "sleeping") {
    return {
      ...cluster,
      cpuUsage: Math.max(1, cluster.cpuUsage - 3 + Math.random() * 2),
      aiCycles: Math.max(0, cluster.aiCycles - 20 + Math.random() * 10),
    };
  }
  const drift = (v, range, min, max) =>
    Math.max(min, Math.min(max, v + (Math.random() - 0.5) * range));
  const cpu = drift(cluster.cpuUsage, 12, 2, cluster.cpuMax);
  const mem = drift(cluster.memUsed, cluster.memTotal * 0.06, cluster.memTotal * 0.1, cluster.memTotal * 0.95);
  const ai  = drift(cluster.aiCycles, 80, 0, 1000);
  const status = cpu < SLEEP_THRESHOLD ? "idle" : "active";
  return { ...cluster, cpuUsage: Math.round(cpu), memUsed: Math.round(mem), aiCycles: Math.round(ai), status };
}

function energyCost(cluster) {
  // Simplified: proportional to CPU * nodes
  return ((cluster.cpuUsage / 100) * cluster.nodeCount * 2.4).toFixed(2); // W simulated
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Cluster card ──────────────────────────────────────────
function ClusterCard({ cluster, onToggleSleep, onToggleAuto }) {
  const memPct = Math.round((cluster.memUsed / cluster.memTotal) * 100);
  const cpuPct = Math.round(cluster.cpuUsage);
  const isSleeping = cluster.status === "sleeping";
  const isIdle     = cluster.status === "idle";
  const energy     = energyCost(cluster);

  const BattIcon = cpuPct < 20 ? BatteryLow : cpuPct < 60 ? BatteryMedium : BatteryFull;
  const battColor = cpuPct < 20 ? "text-red-400" : cpuPct < 60 ? "text-accent" : "text-green-400";

  return (
    <div className={cn("bg-card border rounded-xl p-4 space-y-3 transition-all",
      isSleeping ? "border-blue-500/30 opacity-70" :
      isIdle     ? "border-accent/30" : "border-border")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: cluster.color }} />
          <p className="text-xs font-bold text-foreground">{cluster.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[9px]",
            isSleeping ? "border-blue-500/30 text-blue-400" :
            isIdle     ? "border-accent/30 text-accent" : "border-green-500/20 text-green-400")}>
            {isSleeping ? <Moon className="h-2.5 w-2.5 mr-1" /> : isIdle ? <TrendingDown className="h-2.5 w-2.5 mr-1" /> : <Activity className="h-2.5 w-2.5 mr-1" />}
            {isSleeping ? "Veille" : isIdle ? "Inactif" : "Actif"}
          </Badge>
        </div>
      </div>

      {/* CPU */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> Cycles IA</span>
          <span className={cn("font-mono font-bold", cpuPct > 80 ? "text-red-400" : cpuPct > 50 ? "text-accent" : "text-green-400")}>{cpuPct}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${cpuPct}%`, background: cpuPct > 80 ? "#ef4444" : cpuPct > 50 ? "#f59e0b" : cluster.color }} />
        </div>
        <p className="text-[9px] text-muted-foreground">{cluster.aiCycles} cycles/s · {cluster.nodeCount} nœuds</p>
      </div>

      {/* Memory */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" /> Mémoire</span>
          <span className={cn("font-mono font-bold", memPct > 85 ? "text-red-400" : memPct > 65 ? "text-accent" : "text-green-400")}>{memPct}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${memPct}%`, background: memPct > 85 ? "#ef4444" : memPct > 65 ? "#f59e0b" : "#3b82f6" }} />
        </div>
        <p className="text-[9px] text-muted-foreground">{cluster.memUsed} MB / {cluster.memTotal} MB</p>
      </div>

      {/* Energy */}
      <div className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-accent" />
          <span className="text-[10px] text-muted-foreground">Consommation</span>
        </div>
        <span className={cn("text-xs font-mono font-bold", isSleeping ? "text-blue-400" : "text-accent")}>{isSleeping ? "~0.1 W" : `${energy} W`}</span>
      </div>

      {/* Sparkline */}
      {cluster.history.length > 2 && (
        <div className="h-14">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cluster.history.slice(-20)}>
              <Line type="monotone" dataKey="cpu" stroke={cluster.color} strokeWidth={1.5} dot={false} name="CPU%" />
              <Line type="monotone" dataKey="mem" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="3 2" name="Mém%" />
              <ReferenceLine y={SLEEP_THRESHOLD} stroke="#8b5cf6" strokeDasharray="3 2" strokeOpacity={0.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => onToggleSleep(cluster.id)}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all",
            isSleeping ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                       : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20")}>
          {isSleeping ? <Play className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          {isSleeping ? "Réveiller" : "Mettre en veille"}
        </button>
        <button onClick={() => onToggleAuto(cluster.id)}
          className={cn("flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition-all",
            cluster.autoSleep ? "bg-accent/10 border-accent/30 text-accent" : "bg-secondary border-border text-muted-foreground")}>
          <Settings className="h-3 w-3" />Auto
        </button>
      </div>
      {cluster.autoSleep && !isSleeping && (
        <p className="text-[9px] text-accent text-center">Auto-veille si CPU &lt; {SLEEP_THRESHOLD}%</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function ResourceDashboard() {
  const [clusters, setClusters] = useState(() => CLUSTERS.map(initCluster));
  const [running, setRunning]   = useState(true);
  const [tick, setTick]         = useState(0);
  const [networkHistory, setNetworkHistory] = useState([]);
  const [automations, setAutomations] = useState([]);
  const intervalRef = useRef(null);
  const tickRef     = useRef(0);

  // Simulation
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      setTick(t);
      const ts = `T+${t}s`;

      setClusters(prev => {
        const next = prev.map(c => {
          const updated = nextTick(c);
          // Auto-sleep logic
          if (c.autoSleep && !c.status.includes("sleeping") && updated.cpuUsage < SLEEP_THRESHOLD) {
            // trigger after 3 consecutive idle ticks — simulate via random to keep it simple
            if (Math.random() < 0.15) {
              setAutomations(a => [{
                ts, cluster: c.name, action: "Mise en veille automatique",
                reason: `CPU ${updated.cpuUsage}% < seuil ${SLEEP_THRESHOLD}%`, color: "text-blue-400"
              }, ...a].slice(0, 20));
              return { ...updated, status: "sleeping", history: [...(updated.history || []), { t: ts, cpu: updated.cpuUsage, mem: Math.round((updated.memUsed / updated.memTotal) * 100) }].slice(-40) };
            }
          }
          // Auto-wake if CPU would spike
          if (c.status === "sleeping" && Math.random() < 0.05) {
            setAutomations(a => [{
              ts, cluster: c.name, action: "Réveil automatique",
              reason: "Charge détectée sur cluster voisin", color: "text-green-400"
            }, ...a].slice(0, 20));
            return { ...updated, status: "active", history: [...(updated.history || []), { t: ts, cpu: updated.cpuUsage, mem: Math.round((updated.memUsed / updated.memTotal) * 100) }].slice(-40) };
          }
          return { ...updated, history: [...(updated.history || []), { t: ts, cpu: updated.cpuUsage, mem: Math.round((updated.memUsed / updated.memTotal) * 100) }].slice(-40) };
        });

        // Network history
        const totalCpu = next.reduce((s, c) => s + c.cpuUsage, 0) / next.length;
        const totalMem = next.reduce((s, c) => s + (c.memUsed / c.memTotal) * 100, 0) / next.length;
        const totalEnergy = next.reduce((s, c) => s + parseFloat(energyCost(c)), 0);
        const sleeping = next.filter(c => c.status === "sleeping").length;
        setNetworkHistory(h => [...h, { t: ts, cpu: Math.round(totalCpu), mem: Math.round(totalMem), energy: parseFloat(totalEnergy.toFixed(2)), sleeping }].slice(-60));

        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const toggleSleep = (id) => {
    setClusters(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newStatus = c.status === "sleeping" ? "active" : "sleeping";
      const ts = `T+${tickRef.current}s`;
      setAutomations(a => [{
        ts, cluster: c.name,
        action: newStatus === "sleeping" ? "Mise en veille manuelle" : "Réveil manuel",
        reason: "Action utilisateur", color: newStatus === "sleeping" ? "text-blue-400" : "text-green-400"
      }, ...a].slice(0, 20));
      return { ...c, status: newStatus };
    }));
  };

  const toggleAuto = (id) => {
    setClusters(prev => prev.map(c => c.id === id ? { ...c, autoSleep: !c.autoSleep } : c));
  };

  const sleepAll = () => {
    const ts = `T+${tickRef.current}s`;
    setClusters(prev => prev.map(c => ({ ...c, status: "sleeping" })));
    setAutomations(a => [{ ts, cluster: "Tous", action: "Mise en veille globale", reason: "Action utilisateur", color: "text-blue-400" }, ...a].slice(0, 20));
  };

  const wakeAll = () => {
    const ts = `T+${tickRef.current}s`;
    setClusters(prev => prev.map(c => ({ ...c, status: "active" })));
    setAutomations(a => [{ ts, cluster: "Tous", action: "Réveil global", reason: "Action utilisateur", color: "text-green-400" }, ...a].slice(0, 20));
  };

  // Global stats
  const activeClusters  = clusters.filter(c => c.status !== "sleeping").length;
  const sleepingClusters = clusters.filter(c => c.status === "sleeping").length;
  const avgCpu   = Math.round(clusters.reduce((s, c) => s + c.cpuUsage, 0) / clusters.length);
  const avgMem   = Math.round(clusters.reduce((s, c) => s + (c.memUsed / c.memTotal) * 100, 0) / clusters.length);
  const totalEnergy = clusters.reduce((s, c) => s + parseFloat(energyCost(c)), 0).toFixed(2);
  const savedEnergy = clusters.filter(c => c.status === "sleeping").reduce((s, c) => s + parseFloat(energyCost({ ...c, status: "active" })), 0).toFixed(2);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Ressources des Clusters</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mémoire · Cycles IA · Énergie · Automatisation de mise en veille
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={sleepAll}>
            <Moon className="h-4 w-4 mr-2" />Tout mettre en veille
          </Button>
          <Button variant="outline" size="sm" onClick={wakeAll}>
            <Play className="h-4 w-4 mr-2" />Tout réveiller
          </Button>
          <Button className={cn(running && "bg-red-600 hover:bg-red-700")} size="sm"
            onClick={() => setRunning(r => !r)}>
            {running ? <Square className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Pause" : "Reprendre"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "CPU IA moyen",       value: `${avgCpu}%`,          color: avgCpu > 70 ? "text-red-400" : "text-green-400", icon: Cpu         },
          { label: "Mémoire moyenne",    value: `${avgMem}%`,          color: avgMem > 80 ? "text-red-400" : "text-primary",   icon: Database    },
          { label: "Énergie totale",     value: `${totalEnergy} W`,    color: "text-accent",                                   icon: Zap         },
          { label: "Énergie économisée", value: `${savedEnergy} W`,    color: parseFloat(savedEnergy) > 0 ? "text-green-400" : "text-muted-foreground", icon: BatteryLow },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Activity className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-semibold text-green-400">{activeClusters} actifs</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Moon className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">{sleepingClusters} en veille</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-xl">
          <Settings className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold text-accent">{clusters.filter(c => c.autoSleep).length} auto-veille actifs</span>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">
          Seuil auto-veille : CPU &lt; {SLEEP_THRESHOLD}%
        </div>
      </div>

      {/* Network timeline charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">CPU IA & Mémoire — Réseau Global</h3>
          </div>
          {networkHistory.length < 2 ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">En attente de données…</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={networkHistory}>
                  <defs>
                    <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={SLEEP_THRESHOLD} stroke="#8b5cf6" strokeDasharray="3 2" strokeOpacity={0.5} label={{ value: "Seuil veille", position: "right", fontSize: 8, fill: "#8b5cf6" }} />
                  <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fill="url(#gCpu)" dot={false} name="CPU IA %" />
                  <Area type="monotone" dataKey="mem" stroke="#10b981" strokeWidth={1.5} fill="url(#gMem)" dot={false} name="Mémoire %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Consommation Énergétique Réseau (W)</h3>
          </div>
          {networkHistory.length < 2 ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">En attente de données…</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={networkHistory}>
                  <defs>
                    <linearGradient id="gEnergy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={2} fill="url(#gEnergy)" dot={false} name="Énergie (W)" />
                  <Line type="monotone" dataKey="sleeping" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Clusters en veille" yAxisId={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Cluster cards */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Clusters Fractals — Détail</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {clusters.map(c => (
            <ClusterCard key={c.id} cluster={c} onToggleSleep={toggleSleep} onToggleAuto={toggleAuto} />
          ))}
        </div>
      </div>

      {/* Automation log */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Journal d'Automatisation</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">{automations.length} événements</Badge>
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {automations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Aucun événement d'automatisation pour l'instant…</p>
          ) : automations.map((a, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2 text-[10px]">
              <span className="text-muted-foreground font-mono shrink-0">{a.ts}</span>
              <span className="text-muted-foreground shrink-0">{a.cluster}</span>
              <span className={cn("font-semibold", a.color)}>{a.action}</span>
              <span className="text-muted-foreground ml-auto truncate">{a.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}