import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play, Square, RefreshCw, Zap, Activity, AlertTriangle,
  TrendingUp, TrendingDown, Cpu, Database, Wifi, WifiOff
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from "recharts";

// ── Cluster definitions ───────────────────────────────────
const CLUSTERS = [
  { id: "c0", name: "L0-EventCore",     level: 0, color: "#f59e0b", baseLatency: 12,  capacity: 800  },
  { id: "c1", name: "L1-RelationMesh",  level: 1, color: "#3b82f6", baseLatency: 28,  capacity: 600  },
  { id: "c2", name: "L2-NarrativeHub",  level: 2, color: "#10b981", baseLatency: 55,  capacity: 400  },
  { id: "c3", name: "L3-WorldBranch",   level: 3, color: "#8b5cf6", baseLatency: 110, capacity: 250  },
  { id: "c4", name: "L4-StrategicCore", level: 4, color: "#ef4444", baseLatency: 200, capacity: 100  },
];

const SCENARIOS = {
  ramp:   { label: "Montée progressive",  desc: "Charge croissante de 0% à 100% sur 60s",       tpsTarget: (t) => Math.min(t * 12, 1200) },
  spike:  { label: "Pic soudain",          desc: "Spike instantané à 1500 TPS puis retour",       tpsTarget: (t) => t < 5 ? 1500 : t < 10 ? 200 : t < 20 ? 1500 : 300 },
  wave:   { label: "Vague sinusoïdale",    desc: "Oscillation régulière simulant le trafic réel", tpsTarget: (t) => 400 + Math.sin(t * 0.4) * 380 },
  flood:  { label: "DDoS Fractal",         desc: "Saturation totale – test de survie réseau",     tpsTarget: (t) => Math.min(2000, 200 + t * 40) },
};

const TICK_MS = 500;

// ── Helpers ───────────────────────────────────────────────
function calcLatency(cluster, load, jitter) {
  const sat = Math.min(load / cluster.capacity, 1);
  const base = cluster.baseLatency;
  const stress = base * (1 + Math.pow(sat, 3) * 15);
  return Math.max(1, stress + (Math.random() - 0.5) * jitter * stress * 0.4);
}

function calcResonanceLoss(cluster, load, tick) {
  const sat = Math.min(load / cluster.capacity, 1);
  const base = sat > 0.8 ? (sat - 0.8) * 0.6 : 0;
  return Math.min(1, base + Math.random() * 0.02 * sat);
}

function calcDropRate(load, capacity) {
  const sat = load / capacity;
  if (sat < 0.7) return 0;
  return Math.min(100, Math.pow((sat - 0.7) / 0.3, 2) * 35 + Math.random() * 3);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function Slider({ label, value, min, max, step = 1, onChange, format, color = "text-primary", disabled }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn("text-[11px] font-mono font-bold", color)}>{format ? format(value) : value}</span>
      </div>
      <div className="relative h-2 bg-secondary rounded-full">
        <div className="absolute h-full rounded-full opacity-50 rounded-full" style={{ width: `${pct}%`, background: "hsl(var(--primary))" }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)} disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
        <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-card shadow top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)` }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function NetworkStressSim() {
  const [scenario, setScenario] = useState("ramp");
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [jitter, setJitter] = useState(30);
  const [propagationFactor, setPropagationFactor] = useState(0.7);
  const [history, setHistory] = useState([]);
  const [clusterState, setClusterState] = useState(
    CLUSTERS.map(c => ({ ...c, latency: c.baseLatency, resonance: 1, drop: 0, load: 0, status: "healthy" }))
  );
  const [events, setEvents] = useState([]);
  const tickRef = useRef(0);
  const intervalRef = useRef(null);

  const addEvent = useCallback((msg, color) => {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents(prev => [{ ts, msg, color }, ...prev].slice(0, 25));
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setTick(0);
    tickRef.current = 0;
    setHistory([]);
    setEvents([]);
    setClusterState(CLUSTERS.map(c => ({ ...c, latency: c.baseLatency, resonance: 1, drop: 0, load: 0, status: "healthy" })));
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      setTick(t);

      const targetTPS = SCENARIOS[scenario].tpsTarget(t);

      setClusterState(prev => {
        const next = prev.map((c, i) => {
          // Propagation: higher levels get spillover from lower
          const spillover = i > 0 ? Math.max(0, (prev[i-1].load - prev[i-1].capacity) * propagationFactor * 0.3) : 0;
          const levelLoad = targetTPS * (1 - i * 0.18) + spillover;
          const load = Math.max(0, levelLoad + (Math.random() - 0.5) * levelLoad * 0.15);
          const latency = calcLatency(c, load, jitter);
          const resonanceLoss = calcResonanceLoss(c, load, t);
          const resonance = Math.max(0, c.resonance - resonanceLoss);
          const drop = calcDropRate(load, c.capacity);
          const sat = load / c.capacity;
          const status = sat > 1.2 ? "saturated" : sat > 0.85 ? "stressed" : sat > 0.5 ? "loaded" : "healthy";
          return { ...c, load: Math.round(load), latency: parseFloat(latency.toFixed(1)), resonance: parseFloat(resonance.toFixed(4)), drop: parseFloat(drop.toFixed(1)), status };
        });

        // Record history point
        const record = { t: `T+${t}s` };
        next.forEach(c => { record[c.name] = c.latency; });
        record["TPS Global"] = Math.round(targetTPS);
        record["Rés. moy."] = parseFloat((next.reduce((s, c) => s + c.resonance, 0) / next.length * 100).toFixed(1));
        record["Pertes"] = parseFloat((next.reduce((s, c) => s + c.drop, 0) / next.length).toFixed(1));

        setHistory(h => [...h, record].slice(-60));

        // Events
        next.forEach(c => {
          if (c.status === "saturated" && prev.find(p => p.id === c.id)?.status !== "saturated")
            addEvent(`🔴 ${c.name} SATURÉ — ${c.load} TPS (cap: ${c.capacity})`, "text-red-400");
          if (c.resonance < 0.5 && prev.find(p => p.id === c.id)?.resonance >= 0.5)
            addEvent(`⚠ ${c.name} résonance critique: ${(c.resonance * 100).toFixed(0)}%`, "text-orange-400");
          if (c.resonance < 0.1 && prev.find(p => p.id === c.id)?.resonance >= 0.1)
            addEvent(`💀 ${c.name} RÉSONANCE EFFONDRÉE`, "text-red-500");
        });

        return next;
      });
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [running, scenario, jitter, propagationFactor, addEvent]);

  const avgRes = clusterState.reduce((s, c) => s + c.resonance, 0) / clusterState.length * 100;
  const avgLatency = clusterState.reduce((s, c) => s + c.latency, 0) / clusterState.length;
  const saturated = clusterState.filter(c => c.status === "saturated").length;
  const totalDrop = clusterState.reduce((s, c) => s + c.drop, 0) / clusterState.length;

  const STATUS_CFG = {
    healthy:   { label: "Sain",     color: "text-green-400",  dot: "bg-green-500"  },
    loaded:    { label: "Chargé",   color: "text-accent",     dot: "bg-yellow-500" },
    stressed:  { label: "Stressé",  color: "text-orange-400", dot: "bg-orange-500" },
    saturated: { label: "Saturé",   color: "text-red-400",    dot: "bg-red-500 animate-pulse" },
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Stress Test Réseau Fractal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Simulation de charge extrême · Latence · Perte de résonance · Saturation des clusters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saturated > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />{saturated} cluster{saturated > 1 ? "s" : ""} saturé{saturated > 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" onClick={reset} disabled={running}>
            <RefreshCw className="h-4 w-4 mr-2" />Reset
          </Button>
          <Button
            className={cn(running && "bg-red-600 hover:bg-red-700")}
            onClick={() => {
              if (!running) addEvent(`▶ Scénario "${SCENARIOS[scenario].label}" démarré`, "text-primary");
              else addEvent("■ Simulation arrêtée", "text-muted-foreground");
              setRunning(r => !r);
            }}>
            {running ? <Square className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Stopper" : "Lancer le stress test"}
          </Button>
        </div>
      </div>

      {/* Config + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scenario + sliders */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Scénario de charge</p>
          <div className="space-y-2">
            {Object.entries(SCENARIOS).map(([key, sc]) => (
              <button key={key} onClick={() => { setScenario(key); if (!running) reset(); }}
                disabled={running}
                className={cn("w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-all",
                  scenario === key ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary/20 border-border text-muted-foreground hover:text-foreground",
                  running && "opacity-60 cursor-not-allowed")}>
                <p className="font-bold mb-0.5">{sc.label}</p>
                <p className="text-[10px] opacity-80">{sc.desc}</p>
              </button>
            ))}
          </div>
          <div className="space-y-4 pt-2 border-t border-border">
            <Slider label="Gigue réseau (jitter)" value={jitter} min={0} max={100}
              onChange={setJitter} format={v => `${v}%`} color="text-orange-400" disabled={running} />
            <Slider label="Facteur de propagation" value={propagationFactor} min={0} max={1} step={0.05}
              onChange={setPropagationFactor} format={v => `×${v.toFixed(2)}`} color="text-accent" disabled={running} />
          </div>
        </div>

        {/* KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          {[
            { label: "Résonance Moy.",  value: `${avgRes.toFixed(1)}%`,      color: avgRes > 70 ? "text-green-400" : avgRes > 40 ? "text-orange-400" : "text-red-400", icon: Activity },
            { label: "Latence Moy.",    value: `${avgLatency.toFixed(0)}ms`,  color: avgLatency < 100 ? "text-green-400" : avgLatency < 400 ? "text-accent" : "text-red-400", icon: Zap },
            { label: "Clusters saturés",value: saturated,                     color: saturated > 0 ? "text-red-400" : "text-green-400", icon: Cpu },
            { label: "Perte paquets",   value: `${totalDrop.toFixed(1)}%`,    color: totalDrop < 1 ? "text-green-400" : totalDrop < 10 ? "text-accent" : "text-red-400", icon: WifiOff },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4">
              <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
            </div>
          ))}

          {/* Cluster status grid */}
          {clusterState.map(c => {
            const st = STATUS_CFG[c.status];
            const sat = Math.min(100, Math.round((c.load / c.capacity) * 100));
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-3 col-span-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={cn("h-2 w-2 rounded-full", st.dot)} />
                  <p className="text-[10px] font-bold text-foreground truncate">{c.name}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Charge</span>
                    <span className="font-mono" style={{ color: c.color }}>{c.load} TPS</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(sat, 100)}%`, background: sat > 100 ? "#ef4444" : sat > 85 ? "#f97316" : c.color }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{sat}% cap.</span>
                    <span className={cn("font-mono", c.drop > 5 ? "text-red-400" : "text-muted-foreground")}>{c.drop.toFixed(1)}% loss</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency per cluster */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Latence par Cluster (ms)</h3>
          </div>
          {history.length < 2 ? (
            <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">Lancez le test pour afficher la latence…</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}ms`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "SLA 500ms", position: "right", fontSize: 8, fill: "#ef4444" }} />
                  {CLUSTERS.map(c => (
                    <Line key={c.id} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={1.5} dot={false} name={c.name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Resonance loss + packet drop */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Résonance Moy. & Pertes Paquets</h3>
          </div>
          {history.length < 2 ? (
            <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">Lancez le test pour afficher les métriques…</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis yAxisId="res" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}%`} />
                  <YAxis yAxisId="drop" orientation="right" domain={[0, 50]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <ReferenceLine yAxisId="res" y={50} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <Line yAxisId="res" type="monotone" dataKey="Rés. moy." stroke="#10b981" strokeWidth={2} dot={false} name="Résonance moy. (%)" />
                  <Line yAxisId="drop" type="monotone" dataKey="Pertes" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Pertes paquets (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* TPS + bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TPS area chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Débit Global (TPS)</h3>
          </div>
          {history.length < 2 ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">En attente…</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={1000} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: "Seuil alerte", position: "right", fontSize: 8, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="TPS Global" stroke="#3b82f6" strokeWidth={2} fill="url(#tpsGrad)" name="TPS" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Current snapshot bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-chart-4" />
            <h3 className="text-sm font-bold text-foreground">Snapshot — Résonance par Cluster</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clusterState.map(c => ({ name: c.name.split("-")[0], resonance: parseFloat((c.resonance * 100).toFixed(1)), latency: c.latency }))} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={50} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.6} />
                <Bar dataKey="resonance" name="Résonance (%)" radius={[4, 4, 0, 0]}>
                  {clusterState.map((c, i) => (
                    <rect key={i} fill={c.resonance < 0.1 ? "#ef4444" : c.resonance < 0.5 ? "#f97316" : c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Event log + cluster detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Event log */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Journal Temps Réel</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">{events.length}</Badge>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Lancez la simulation…</p>
            ) : events.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] bg-secondary/30 rounded-lg px-3 py-1.5">
                <span className="text-muted-foreground font-mono shrink-0">{e.ts}</span>
                <span className={cn("leading-relaxed", e.color)}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cluster detail table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Métriques Détaillées</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left py-2">Cluster</th>
                  <th className="text-right py-2">TPS</th>
                  <th className="text-right py-2">Latence</th>
                  <th className="text-right py-2">Rés.</th>
                  <th className="text-right py-2">Perte</th>
                  <th className="text-right py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {clusterState.map(c => {
                  const st = STATUS_CFG[c.status];
                  return (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                          <span className="font-mono text-foreground">{c.name.split("-")[0]}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right font-mono text-foreground">{c.load}</td>
                      <td className={cn("py-2 text-right font-mono", c.latency > 500 ? "text-red-400" : c.latency > 200 ? "text-accent" : "text-green-400")}>{c.latency.toFixed(0)}ms</td>
                      <td className={cn("py-2 text-right font-mono", c.resonance < 0.3 ? "text-red-400" : c.resonance < 0.6 ? "text-accent" : "text-green-400")}>{(c.resonance * 100).toFixed(0)}%</td>
                      <td className={cn("py-2 text-right font-mono", c.drop > 5 ? "text-red-400" : c.drop > 1 ? "text-accent" : "text-muted-foreground")}>{c.drop.toFixed(1)}%</td>
                      <td className="py-2 text-right">
                        <span className={cn("text-[10px] font-semibold", st.color)}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}