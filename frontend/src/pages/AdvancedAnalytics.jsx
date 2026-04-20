import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Activity, TrendingUp, TrendingDown, Zap, Network,
  RefreshCw, BarChart2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, ComposedChart
} from "recharts";

// ── Simulation helpers ────────────────────────────────────
function rnd(min, max) { return min + Math.random() * (max - min); }
function fmt(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
function now() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeInitialHistory(n) {
  const base = Date.now() - n * 5000;
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(base + i * 5000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const vol = rnd(180000, 620000);
    const vel = rnd(0.8, 3.2);
    const nodes = Math.round(24800 + i * 3 + rnd(-10, 20));
    const tps = rnd(120, 890);
    const burns = rnd(800, 4200);
    const staked = rnd(37.2, 39.8);
    return { t, vol, vel, nodes, tps, burns, staked };
  });
}

const DAILY_VOL = [
  { day: "Lun", vol: 4.2, txn: 18400 }, { day: "Mar", vol: 5.8, txn: 22100 },
  { day: "Mer", vol: 3.9, txn: 15600 }, { day: "Jeu", vol: 7.1, txn: 31200 },
  { day: "Ven", vol: 6.4, txn: 28900 }, { day: "Sam", vol: 2.8, txn: 11300 },
  { day: "Dim", vol: 3.3, txn: 13800 },
];

const NODE_GROWTH = [
  { month: "Oct", L0: 8200, L1: 5100, L2: 3400, L3: 1800, L4: 420 },
  { month: "Nov", L0: 9100, L1: 5600, L2: 3900, L3: 2100, L4: 490 },
  { month: "Déc", L0: 10400, L1: 6200, L2: 4300, L3: 2400, L4: 560 },
  { month: "Jan", L0: 12100, L1: 7100, L2: 4900, L3: 2800, L4: 640 },
  { month: "Fév", L0: 14800, L1: 8400, L2: 5700, L3: 3300, L4: 720 },
  { month: "Mar", L0: 18200, L1: 9800, L2: 6400, L3: 3900, L4: 810 },
  { month: "Avr", L0: 21600, L1: 11200, L2: 7200, L3: 4400, L4: 871 },
];

const LEVEL_COLORS = { L0: "#f59e0b", L1: "#3b82f6", L2: "#10b981", L3: "#8b5cf6", L4: "#ef4444" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">
            {typeof p.value === "number" && p.value < 100 ? p.value.toFixed(2) : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, sub, icon: Icon, color, delta, up }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        {delta !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-[10px] font-mono font-bold", up ? "text-green-400" : "text-red-400")}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold font-mono mt-0.5", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function AdvancedAnalytics() {
  const [history, setHistory]     = useState(() => makeInitialHistory(40));
  const [live, setLive]           = useState(true);
  const [range, setRange]         = useState(20);   // points displayed
  const intervalRef               = useRef(null);

  useEffect(() => {
    if (!live) return;
    intervalRef.current = setInterval(() => {
      setHistory(prev => {
        const last = prev[prev.length - 1];
        const newPoint = {
          t:      now(),
          vol:    Math.max(50000, (last.vol ?? 350000) * rnd(0.93, 1.08)),
          vel:    Math.max(0.3, Math.min(5, (last.vel ?? 1.8) + rnd(-0.15, 0.15))),
          nodes:  (last.nodes ?? 24871) + Math.round(rnd(-2, 8)),
          tps:    Math.max(20, Math.min(1200, (last.tps ?? 450) + rnd(-60, 80))),
          burns:  rnd(800, 5000),
          staked: Math.max(35, Math.min(45, (last.staked ?? 38.7) + rnd(-0.05, 0.05))),
        };
        return [...prev, newPoint].slice(-80);
      });
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, [live]);

  const visible  = history.slice(-range);
  const last     = history[history.length - 1] ?? {};
  const prev     = history[history.length - 10] ?? {};

  const volDelta  = prev.vol  ? (((last.vol  - prev.vol)  / prev.vol)  * 100).toFixed(1) : "0";
  const velDelta  = prev.vel  ? (last.vel  - prev.vel).toFixed(2)  : "0";
  const nodeDelta = prev.nodes ? last.nodes - prev.nodes : 0;
  const tpsDelta  = prev.tps  ? (((last.tps  - prev.tps)  / prev.tps)  * 100).toFixed(1) : "0";

  const totalNodesNow = NODE_GROWTH[NODE_GROWTH.length - 1];
  const totalNodes = (totalNodesNow.L0 + totalNodesNow.L1 + totalNodesNow.L2 + totalNodesNow.L3 + totalNodesNow.L4);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Analytics Avancées</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Volumes · Vélocité du token · Croissance des nœuds · TPS — Mise à jour toutes les 3s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[10, 20, 40].map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  range === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {r}pts
              </button>
            ))}
          </div>
          <button onClick={() => setLive(l => !l)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
              live ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-secondary border-border text-muted-foreground")}>
            <Activity className="h-3.5 w-3.5" />{live ? "LIVE" : "PAUSE"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Volume (AQ/s)"     value={fmt(last.vol ?? 0)}        sub="flux sortant"        icon={BarChart2}   color="text-primary"   delta={`${volDelta}%`}  up={parseFloat(volDelta) >= 0} />
        <StatCard label="Vélocité Token"    value={(last.vel ?? 0).toFixed(2)} sub="rotations/période"  icon={Zap}         color="text-accent"    delta={velDelta}        up={parseFloat(velDelta) >= 0} />
        <StatCard label="TPS (transactions)"value={fmt(last.tps ?? 0)}        sub="tx par seconde"     icon={Activity}    color="text-chart-2"   delta={`${tpsDelta}%`}  up={parseFloat(tpsDelta) >= 0} />
        <StatCard label="Nœuds actifs"      value={fmt(last.nodes ?? 0)}      sub="réseau global"      icon={Network}     color="text-green-400" delta={`+${nodeDelta}`} up={nodeDelta >= 0} />
        <StatCard label="Burns (AQ/s)"      value={fmt(last.burns ?? 0)}      sub="mécanisme déflatoire" icon={TrendingDown} color="text-red-400"  />
        <StatCard label="Staking ratio"     value={`${(last.staked ?? 0).toFixed(1)}%`} sub="supply verrouillée" icon={TrendingUp} color="text-chart-4" />
      </div>

      {/* Row 1: Volume + TPS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Volume AQ */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Volume de Transactions (AQ)</h3>
            <Badge variant="outline" className="text-[9px] bg-green-500/10 border-green-500/20 text-green-400 ml-auto animate-pulse">LIVE</Badge>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visible}>
                <defs>
                  <linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={Math.floor(range / 5)} />
                <YAxis tickFormatter={v => fmt(v)} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="vol" name="Volume AQ" stroke="#3b82f6" strokeWidth={2} fill="url(#gVol)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TPS */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-chart-2" />
            <h3 className="text-sm font-bold text-foreground">Transactions par Seconde (TPS)</h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visible}>
                <defs>
                  <linearGradient id="gTps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={Math.floor(range / 5)} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.6}
                  label={{ value: "Seuil normal", position: "right", fontSize: 8, fill: "#f59e0b" }} />
                <Area type="monotone" dataKey="tps" name="TPS" stroke="#10b981" strokeWidth={2} fill="url(#gTps)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Token velocity + Burns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Token velocity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Vélocité du Token AQ</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-4">
            Nombre moyen de fois qu'un AQ change de main sur une période donnée. Vélocité élevée = adoption forte.
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visible}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={Math.floor(range / 5)} />
                <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={2} stroke="#3b82f6" strokeDasharray="4 3" strokeOpacity={0.5}
                  label={{ value: "Référence", position: "right", fontSize: 8, fill: "#3b82f6" }} />
                <Line type="monotone" dataKey="vel" name="Vélocité" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Velocity gauge */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-1000"
                style={{ width: `${Math.min(100, ((last.vel ?? 1) / 5) * 100)}%` }} />
            </div>
            <span className="text-xs font-mono font-bold text-accent w-10 text-right">
              {(last.vel ?? 0).toFixed(2)}×
            </span>
            <span className="text-[10px] text-muted-foreground">/ 5.0 max</span>
          </div>
        </div>

        {/* Burns + Staking */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-bold text-foreground">Mécanisme Déflatoire — Burns & Staking</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visible}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval={Math.floor(range / 5)} />
                <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} tickFormatter={fmt} />
                <YAxis yAxisId="r" orientation="right" domain={[35, 45]} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar yAxisId="l" dataKey="burns" name="Burns AQ" fill="#ef4444" fillOpacity={0.7} radius={[2,2,0,0]} />
                <Line yAxisId="r" type="monotone" dataKey="staked" name="Staking %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Node growth */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-4 w-4 text-green-400" />
          <h3 className="text-sm font-bold text-foreground">Croissance des Nœuds du Réseau — L0 → L4</h3>
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/20 ml-auto">
            {fmt(totalNodes)} nœuds totaux
          </Badge>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={NODE_GROWTH}>
              <defs>
                {Object.entries(LEVEL_COLORS).map(([l, c]) => (
                  <linearGradient key={l} id={`g${l}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
              <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              {Object.entries(LEVEL_COLORS).map(([l, c]) => (
                <Area key={l} type="monotone" dataKey={l} name={l} stroke={c} strokeWidth={2}
                  fill={`url(#g${l})`} stackId="nodes" dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Level breakdown */}
        <div className="grid grid-cols-5 gap-2 mt-3">
          {Object.entries(LEVEL_COLORS).map(([l, c]) => {
            const val = totalNodesNow[l];
            const pct = ((val / totalNodes) * 100).toFixed(1);
            return (
              <div key={l} className="text-center">
                <div className="h-1 rounded-full mb-1" style={{ background: c }} />
                <p className="text-xs font-bold font-mono" style={{ color: c }}>{l}</p>
                <p className="text-[10px] font-mono text-foreground">{fmt(val)}</p>
                <p className="text-[9px] text-muted-foreground">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4: Daily volume + weekly heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily volume */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Volume Hebdomadaire (M AQ)</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAILY_VOL} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="vol" name="Volume (M AQ)" radius={[4,4,0,0]} fill="#3b82f6"
                  label={{ position: "top", fontSize: 8, fill: "hsl(215,20%,55%)", formatter: v => `${v}M` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions count */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-chart-2" />
            <h3 className="text-sm font-bold text-foreground">Nombre de Transactions / Jour</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAILY_VOL} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={fmt} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="txn" name="Transactions" radius={[4,4,0,0]} fill="#10b981"
                  label={{ position: "top", fontSize: 8, fill: "hsl(215,20%,55%)", formatter: v => fmt(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}