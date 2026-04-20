import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wifi, WifiOff, Play, Square, RefreshCw, Plus, Trash2,
  AlertTriangle, CheckCircle, Filter, Bell, BellOff,
  Activity, Database, Zap, Settings, ChevronDown, ChevronUp
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ── IoT Sensor types ──────────────────────────────────────
const SENSOR_TYPES = {
  temperature:  { label: "Température",    unit: "°C",  min: -10, max: 90,  color: "#ef4444", baseVal: 22  },
  pressure:     { label: "Pression",       unit: "bar", min: 0,   max: 20,  color: "#3b82f6", baseVal: 8   },
  vibration:    { label: "Vibration",      unit: "Hz",  min: 0,   max: 500, color: "#f59e0b", baseVal: 120 },
  bandwidth:    { label: "Bande passante", unit: "Mbps",min: 0,   max: 1000,color: "#10b981", baseVal: 450 },
  resonance:    { label: "Résonance",      unit: "%",   min: 0,   max: 100, color: "#8b5cf6", baseVal: 72  },
  latency:      { label: "Latence",        unit: "ms",  min: 0,   max: 2000,color: "#f97316", baseVal: 35  },
};

const FRACTAL_CLUSTERS = [
  { id: "L0", name: "L0 — EventCore",     color: "#f59e0b", capacity: 2000 },
  { id: "L1", name: "L1 — RelationMesh",  color: "#3b82f6", capacity: 1200 },
  { id: "L2", name: "L2 — NarrativeHub",  color: "#10b981", capacity: 800  },
  { id: "L3", name: "L3 — WorldBranch",   color: "#8b5cf6", capacity: 400  },
  { id: "L4", name: "L4 — StrategicCore", color: "#ef4444", capacity: 150  },
];

const AGG_METHODS = ["mean", "max", "min", "sum", "p95"];

const TICK_MS = 800;
let sensorCounter = 0;

function genSensorId() { return `s${++sensorCounter}`; }

function makeSensor(type = null, cluster = null) {
  const t = type ?? Object.keys(SENSOR_TYPES)[Math.floor(Math.random() * Object.keys(SENSOR_TYPES).length)];
  const c = cluster ?? FRACTAL_CLUSTERS[Math.floor(Math.random() * FRACTAL_CLUSTERS.length)].id;
  return {
    id: genSensorId(),
    type: t,
    cluster: c,
    label: `${SENSOR_TYPES[t].label} ${genSensorId()}`,
    active: true,
    alertEnabled: true,
    alertMin: null,
    alertMax: null,
    history: [],
  };
}

function simulateValue(sensor) {
  const cfg = SENSOR_TYPES[sensor.type];
  const noise = (Math.random() - 0.5) * (cfg.max - cfg.min) * 0.12;
  const spike = Math.random() < 0.04 ? (Math.random() - 0.5) * (cfg.max - cfg.min) * 0.5 : 0;
  return Math.max(cfg.min, Math.min(cfg.max, cfg.baseVal + noise + spike));
}

function aggregate(values, method) {
  if (!values.length) return 0;
  switch (method) {
    case "mean": return values.reduce((a, b) => a + b, 0) / values.length;
    case "max":  return Math.max(...values);
    case "min":  return Math.min(...values);
    case "sum":  return values.reduce((a, b) => a + b, 0);
    case "p95": {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    }
    default: return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ── Custom tooltip ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Sensor card ───────────────────────────────────────────
function SensorCard({ sensor, onUpdate, onRemove, filters }) {
  const cfg    = SENSOR_TYPES[sensor.type];
  const latest = sensor.history[sensor.history.length - 1]?.value ?? cfg.baseVal;
  const isAlertMin = sensor.alertEnabled && sensor.alertMin !== null && latest < sensor.alertMin;
  const isAlertMax = sensor.alertEnabled && sensor.alertMax !== null && latest > sensor.alertMax;
  const isAlert = isAlertMin || isAlertMax;
  const [open, setOpen] = useState(false);

  // Apply filters
  const typeMatch    = filters.type === "all"    || sensor.type === filters.type;
  const clusterMatch = filters.cluster === "all" || sensor.cluster === filters.cluster;
  if (!typeMatch || !clusterMatch) return null;

  const chartData = sensor.history.slice(-20);

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all",
      isAlert ? "border-red-500/40" : sensor.active ? "border-border" : "border-border/40 opacity-60")}>
      <div className="flex items-center gap-3 p-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}40` }}>
          <Activity className="h-4 w-4" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-foreground truncate">{sensor.label}</p>
            {isAlert && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 animate-pulse" />}
          </div>
          <p className="text-[10px] text-muted-foreground">{FRACTAL_CLUSTERS.find(c => c.id === sensor.cluster)?.name} · {cfg.label}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-bold font-mono" style={{ color: isAlert ? "#ef4444" : cfg.color }}>
            {latest.toFixed(1)} <span className="text-[10px] text-muted-foreground">{cfg.unit}</span>
          </p>
        </div>

        {/* Spark line */}
        <div className="w-20 h-8 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="value" stroke={isAlert ? "#ef4444" : cfg.color} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onUpdate(sensor.id, { active: !sensor.active })}
            className={cn("p-1.5 rounded-lg transition-colors", sensor.active ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-secondary")}>
            {sensor.active ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onUpdate(sensor.id, { alertEnabled: !sensor.alertEnabled })}
            className={cn("p-1.5 rounded-lg transition-colors", sensor.alertEnabled ? "text-accent hover:bg-accent/10" : "text-muted-foreground hover:bg-secondary")}>
            {sensor.alertEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onRemove(sensor.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-3 pt-2 space-y-3">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`g-${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={cfg.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" hide />
                <YAxis domain={[cfg.min, cfg.max]} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                {sensor.alertMin !== null && <ReferenceLine y={sensor.alertMin} stroke="#3b82f6" strokeDasharray="3 2" strokeOpacity={0.7} />}
                {sensor.alertMax !== null && <ReferenceLine y={sensor.alertMax} stroke="#ef4444" strokeDasharray="3 2" strokeOpacity={0.7} />}
                <Area type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={1.5} fill={`url(#g-${sensor.id})`} dot={false} name={cfg.label} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Seuil min ({cfg.unit})</label>
              <input type="number" placeholder="—"
                value={sensor.alertMin ?? ""}
                onChange={e => onUpdate(sensor.id, { alertMin: e.target.value === "" ? null : +e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Seuil max ({cfg.unit})</label>
              <input type="number" placeholder="—"
                value={sensor.alertMax ?? ""}
                onChange={e => onUpdate(sensor.id, { alertMax: e.target.value === "" ? null : +e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Cluster fractal</label>
              <select value={sensor.cluster} onChange={e => onUpdate(sensor.id, { cluster: e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary">
                {FRACTAL_CLUSTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Statut</label>
              <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg border",
                isAlert ? "border-red-500/30 bg-red-500/10 text-red-400" : sensor.active ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-border text-muted-foreground")}>
                {isAlert ? <AlertTriangle className="h-3 w-3" /> : sensor.active ? <CheckCircle className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span className="text-[10px] font-semibold">{isAlert ? "ALERTE" : sensor.active ? "Actif" : "Inactif"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function IoTDataFlow() {
  const [sensors, setSensors] = useState(() =>
    Object.keys(SENSOR_TYPES).map(t => makeSensor(t, FRACTAL_CLUSTERS[Math.floor(Math.random() * 3)].id))
  );
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [aggMethod, setAggMethod] = useState("mean");
  const [filters, setFilters] = useState({ type: "all", cluster: "all", alertOnly: false });
  const [clusterHistory, setClusterHistory] = useState([]);
  const [noiseReduction, setNoiseReduction] = useState(0.3); // 0=none, 1=max
  const tickRef = useRef(0);
  const intervalRef = useRef(null);

  // Simulation tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      setTick(t);
      const ts = `T+${t}s`;

      setSensors(prev => prev.map(s => {
        if (!s.active) return s;
        const raw = simulateValue(s);
        // Noise reduction: exponential moving average
        const last = s.history[s.history.length - 1]?.value ?? raw;
        const alpha = 1 - noiseReduction;
        const value = parseFloat((alpha * raw + (1 - alpha) * last).toFixed(3));
        const history = [...s.history, { t: ts, value }].slice(-40);
        return { ...s, history };
      }));
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [running, noiseReduction]);

  // Cluster aggregation history
  useEffect(() => {
    if (tick === 0) return;
    const record = { t: `T+${tick}s` };
    FRACTAL_CLUSTERS.forEach(c => {
      const clusterSensors = sensors.filter(s => s.cluster === c.id && s.active && s.history.length > 0);
      const values = clusterSensors.map(s => {
        const cfg = SENSOR_TYPES[s.type];
        const v = s.history[s.history.length - 1]?.value ?? 0;
        return (v - cfg.min) / (cfg.max - cfg.min) * 100; // normalize to %
      });
      record[c.id] = values.length ? parseFloat(aggregate(values, aggMethod).toFixed(1)) : 0;
    });
    setClusterHistory(h => [...h, record].slice(-50));
  }, [tick]);

  const updateSensor = useCallback((id, patch) => {
    setSensors(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const removeSensor = useCallback((id) => {
    setSensors(prev => prev.filter(s => s.id !== id));
  }, []);

  const addSensor = () => {
    setSensors(prev => [...prev, makeSensor()]);
  };

  // Stats
  const activeSensors  = sensors.filter(s => s.active).length;
  const alertingSensors = sensors.filter(s => {
    if (!s.alertEnabled || !s.history.length) return false;
    const v = s.history[s.history.length - 1].value;
    return (s.alertMin !== null && v < s.alertMin) || (s.alertMax !== null && v > s.alertMax);
  });
  const totalTPS = activeSensors * Math.round(1000 / TICK_MS);

  // Filtered sensors for display
  const visibleSensors = sensors.filter(s => {
    if (filters.type    !== "all" && s.type    !== filters.type)    return false;
    if (filters.cluster !== "all" && s.cluster !== filters.cluster) return false;
    if (filters.alertOnly && !alertingSensors.find(a => a.id === s.id)) return false;
    return true;
  });

  // Cluster snapshot for bar chart
  const clusterSnapshot = FRACTAL_CLUSTERS.map(c => {
    const vals = sensors.filter(s => s.cluster === c.id && s.active && s.history.length > 0).map(s => {
      const cfg = SENSOR_TYPES[s.type];
      const v = s.history[s.history.length - 1]?.value ?? 0;
      return (v - cfg.min) / (cfg.max - cfg.min) * 100;
    });
    return {
      name: c.id,
      value: vals.length ? parseFloat(aggregate(vals, aggMethod).toFixed(1)) : 0,
      sensors: sensors.filter(s => s.cluster === c.id).length,
      color: c.color,
    };
  });

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Flux de Données IoT</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Filtres dynamiques · Seuils d'alerte · Agrégation par cluster fractal · Réduction de bruit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertingSensors.length > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />{alertingSensors.length} alerte{alertingSensors.length > 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" onClick={addSensor}>
            <Plus className="h-4 w-4 mr-2" />Ajouter capteur
          </Button>
          <Button className={cn(running && "bg-red-600 hover:bg-red-700")}
            onClick={() => setRunning(r => !r)}>
            {running ? <Square className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Pause" : "Reprendre"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Capteurs actifs",  value: `${activeSensors}/${sensors.length}`, color: "text-green-400",  icon: Wifi       },
          { label: "Flux total",        value: `${totalTPS} ev/s`,                   color: "text-primary",    icon: Activity   },
          { label: "Alertes actives",   value: alertingSensors.length,               color: alertingSensors.length > 0 ? "text-red-400" : "text-green-400", icon: Bell },
          { label: "Réduction bruit",   value: `${Math.round(noiseReduction * 100)}%`, color: "text-accent",  icon: Filter     },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Controls: Filters + Aggregation + Noise */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          {/* Noise reduction */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[11px] text-muted-foreground">Réduction de bruit (EMA)</span>
              <span className="text-[11px] font-mono font-bold text-accent">{Math.round(noiseReduction * 100)}%</span>
            </div>
            <div className="relative h-2 bg-secondary rounded-full">
              <div className="absolute h-full rounded-full bg-accent/40" style={{ width: `${noiseReduction * 100}%` }} />
              <input type="range" min={0} max={0.95} step={0.05} value={noiseReduction}
                onChange={e => setNoiseReduction(+e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="absolute h-3.5 w-3.5 rounded-full bg-accent border-2 border-card shadow top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `calc(${noiseReduction * 100}% - 7px)` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Brut</span><span>Lissé</span>
            </div>
          </div>

          {/* Aggregation method */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground block">Méthode d'agrégation</span>
            <div className="flex gap-1 flex-wrap">
              {AGG_METHODS.map(m => (
                <button key={m} onClick={() => setAggMethod(m)}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all",
                    aggMethod === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Sensor type filter */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground block">Filtre type capteur</span>
            <div className="flex gap-1 flex-wrap">
              {["all", ...Object.keys(SENSOR_TYPES)].map(t => (
                <button key={t} onClick={() => setFilters(f => ({ ...f, type: t }))}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                    filters.type === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {t === "all" ? "Tous" : SENSOR_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Cluster + alert filter */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground block">Filtre cluster</span>
            <select value={filters.cluster} onChange={e => setFilters(f => ({ ...f, cluster: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary mb-1">
              <option value="all">Tous les clusters</option>
              {FRACTAL_CLUSTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setFilters(f => ({ ...f, alertOnly: !f.alertOnly }))}
              className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all",
                filters.alertOnly ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
              <AlertTriangle className="h-3 w-3" />Alertes uniquement
            </button>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cluster aggregation timeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Agrégation Temporelle par Cluster ({aggMethod})</h3>
          </div>
          {clusterHistory.length < 2 ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">En attente de données…</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={clusterHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={9} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  {FRACTAL_CLUSTERS.map(c => (
                    <Line key={c.id} type="monotone" dataKey={c.id} stroke={c.color} strokeWidth={1.5} dot={false} name={c.name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cluster snapshot bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Snapshot Clusters — Valeur Normalisée ({aggMethod})</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clusterSnapshot} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Valeur normalisée" radius={[4, 4, 0, 0]}>
                  {clusterSnapshot.map((c, i) => (
                    <rect key={i} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {clusterSnapshot.map(c => (
              <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                <span className="text-muted-foreground">{c.name} — {c.sensors} capteur{c.sensors > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert list */}
      {alertingSensors.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-bold text-red-400">Alertes Actives ({alertingSensors.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {alertingSensors.map(s => {
              const cfg = SENSOR_TYPES[s.type];
              const v = s.history[s.history.length - 1]?.value ?? 0;
              const isMin = s.alertMin !== null && v < s.alertMin;
              return (
                <div key={s.id} className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{FRACTAL_CLUSTERS.find(c => c.id === s.cluster)?.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold text-red-400">{v.toFixed(1)} {cfg.unit}</p>
                    <p className="text-[9px] text-muted-foreground">{isMin ? `< min ${s.alertMin}` : `> max ${s.alertMax}`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sensor list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Capteurs ({visibleSensors.length})</h3>
          <span className="text-[10px] text-muted-foreground">{sensors.filter(s => s.active).length} actifs · {sensors.filter(s => !s.active).length} inactifs</span>
        </div>
        <div className="space-y-2">
          {visibleSensors.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun capteur ne correspond aux filtres actifs.</p>
            </div>
          ) : visibleSensors.map(s => (
            <SensorCard key={s.id} sensor={s} onUpdate={updateSensor} onRemove={removeSensor} filters={filters} />
          ))}
        </div>
      </div>
    </div>
  );
}