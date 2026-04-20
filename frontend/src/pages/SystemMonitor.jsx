import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, Wifi, Brain, AlertTriangle, CheckCircle, Zap, RefreshCw } from "lucide-react";
import ResonancePrediction from "@/components/monitor/ResonancePrediction";

// ── Simulated latency history ──────────────────────────
function useLatencyHistory() {
  const [history, setHistory] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      t: i,
      aegis: 3 + Math.random() * 4,
      eth: 120 + Math.random() * 60,
      sol: 20 + Math.random() * 15,
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(1),
          {
            t: last.t + 1,
            aegis: Math.max(1, last.aegis + (Math.random() - 0.48) * 2),
            eth: Math.max(50, last.eth + (Math.random() - 0.5) * 30),
            sol: Math.max(10, last.sol + (Math.random() - 0.5) * 8),
          },
        ];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return history;
}

// ── Resonance heatmap cell ─────────────────────────────
function HeatCell({ value, label }) {
  const r = Math.min(1, Math.max(0, value));
  const bg =
    r >= 0.85 ? "bg-red-500"
    : r >= 0.65 ? "bg-orange-400"
    : r >= 0.4  ? "bg-green-500"
    : r >= 0.15 ? "bg-primary"
    : "bg-secondary";
  const opacity = 0.2 + r * 0.8;

  return (
    <div
      className={cn("relative rounded-lg flex flex-col items-center justify-center p-2 transition-all duration-500 cursor-default", bg)}
      style={{ opacity }}
      title={`${label}: ${(r * 100).toFixed(0)}%`}
    >
      <p className="text-[9px] font-mono text-white font-bold leading-tight text-center truncate w-full text-center">
        {label.length > 10 ? label.slice(0, 9) + "…" : label}
      </p>
      <p className="text-[11px] font-black text-white mt-0.5">{(r * 100).toFixed(0)}%</p>
    </div>
  );
}

// ── Anomaly detector ───────────────────────────────────
function detectAnomalies(nodes) {
  const anomalies = [];
  nodes.forEach((n) => {
    if (n.resonance > 0.9) anomalies.push({ node: n, type: "SURCHAUFFE", sev: "critical" });
    else if (n.tier === "DORMANT" && n.resonance > 0.7)
      anomalies.push({ node: n, type: "TIER INCOHÉRENT", sev: "high" });
    else if (n.resonance < 0.08)
      anomalies.push({ node: n, type: "RÉSONANCE CRITIQUE", sev: "high" });
  });
  return anomalies.slice(0, 8);
}

const SEV_COLOR = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
};

const TIER_HEALTH = {
  SEALED: { bar: "bg-red-400", label: "🔒 SEALED" },
  DEEP: { bar: "bg-purple-400", label: "🌊 DEEP" },
  ACTIVE: { bar: "bg-green-400", label: "✅ ACTIVE" },
  SHORT_TERM: { bar: "bg-primary", label: "⚡ SHORT TERM" },
  DORMANT: { bar: "bg-slate-400", label: "💤 DORMANT" },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="text-muted-foreground font-mono mb-1">t={label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono text-foreground ml-auto">{p.value.toFixed(1)}ms</span>
        </div>
      ))}
    </div>
  );
};

export default function SystemMonitor() {
  const latencyHistory = useLatencyHistory();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: nodes = [] } = useQuery({
    queryKey: ["monitor-nodes"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 80),
    refetchInterval: 5000,
  });

  const anomalies = useMemo(() => detectAnomalies(nodes), [nodes]);

  // Tier distribution
  const tierCounts = useMemo(() => {
    const map = {};
    nodes.forEach((n) => {
      map[n.tier] = (map[n.tier] || 0) + 1;
    });
    return map;
  }, [nodes]);

  // Level distribution
  const levelAvg = useMemo(() => {
    return [0, 1, 2, 3, 4].map((lvl) => {
      const lvlNodes = nodes.filter((n) => n.fractal_level === lvl);
      return {
        level: `L${lvl}`,
        avg: lvlNodes.length
          ? lvlNodes.reduce((s, n) => s + n.resonance, 0) / lvlNodes.length
          : 0,
        count: lvlNodes.length,
      };
    });
  }, [nodes]);

  // Global health score
  const healthScore = useMemo(() => {
    if (!nodes.length) return 100;
    const criticals = nodes.filter((n) => n.resonance > 0.9 || n.resonance < 0.05).length;
    return Math.max(0, 100 - (criticals / nodes.length) * 100).toFixed(0);
  }, [nodes]);

  const avgResonance = nodes.length
    ? (nodes.reduce((s, n) => s + n.resonance, 0) / nodes.length * 100).toFixed(1)
    : "—";

  const latestLatency = latencyHistory[latencyHistory.length - 1];
  const networkStatus = latestLatency.aegis < 6 ? "optimal" : latestLatency.aegis < 10 ? "degraded" : "critical";

  // Heatmap: top 40 nodes by resonance
  const heatmapNodes = useMemo(() => nodes.slice(0, 40), [nodes]);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Monitoring Temps Réel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Santé des nœuds · Latence réseau · Carte de chaleur de résonance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1.5" />
            LIVE — {now.toLocaleTimeString("fr-FR")}
          </Badge>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Santé Globale",
            value: `${healthScore}%`,
            icon: CheckCircle,
            color: Number(healthScore) > 80 ? "text-green-400" : Number(healthScore) > 60 ? "text-accent" : "text-red-400",
          },
          {
            label: "Nœuds Actifs",
            value: nodes.length,
            icon: Brain,
            color: "text-primary",
          },
          {
            label: "Latence AEGIS-Q",
            value: `${latestLatency.aegis.toFixed(1)}ms`,
            icon: Wifi,
            color: networkStatus === "optimal" ? "text-green-400" : "text-orange-400",
          },
          {
            label: "Anomalies",
            value: anomalies.length,
            icon: AlertTriangle,
            color: anomalies.length > 0 ? "text-red-400" : "text-green-400",
          },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Latency Chart + Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Latence Réseau Live</h3>
            </div>
            <div className="flex gap-3 text-[10px]">
              {[
                { key: "aegis", color: "#3b82f6", label: "AEGIS-Q" },
                { key: "eth", color: "#8b5cf6", label: "Ethereum" },
                { key: "sol", color: "#10b981", label: "Solana" },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: n.color }} />
                  <span className="text-muted-foreground">{n.label}</span>
                  <span className="font-mono text-foreground">
                    {latestLatency[n.key].toFixed(1)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyHistory}>
                <defs>
                  {[
                    { id: "aegis", color: "#3b82f6" },
                    { id: "eth", color: "#8b5cf6" },
                    { id: "sol", color: "#10b981" },
                  ].map((g) => (
                    <linearGradient key={g.id} id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={g.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={g.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={(v) => `${v.toFixed(0)}ms`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="aegis" name="AEGIS-Q" stroke="#3b82f6" strokeWidth={2} fill="url(#grad-aegis)" />
                <Area type="monotone" dataKey="eth" name="Ethereum" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#grad-eth)" />
                <Area type="monotone" dataKey="sol" name="Solana" stroke="#10b981" strokeWidth={1.5} fill="url(#grad-sol)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-bold text-foreground">Anomalies Détectées</h3>
            {anomalies.length > 0 && (
              <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-[9px]">
                {anomalies.length}
              </Badge>
            )}
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {anomalies.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <p className="text-xs text-muted-foreground">Aucune anomalie détectée</p>
              </div>
            ) : (
              anomalies.map((a, i) => (
                <div key={i} className={cn("border rounded-lg px-3 py-2", SEV_COLOR[a.sev])}>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-bold">{a.type}</p>
                    <p className="text-[9px] font-mono">{(a.node.resonance * 100).toFixed(0)}%</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                    {a.node.concept} — L{a.node.fractal_level} · {a.node.tier}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resonance Heatmap */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Carte de Chaleur — Résonance des Nœuds</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            {[
              { bg: "bg-primary", label: "Faible" },
              { bg: "bg-green-500", label: "Normal" },
              { bg: "bg-orange-400", label: "Élevé" },
              { bg: "bg-red-500", label: "Critique" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`h-2.5 w-2.5 rounded ${l.bg}`} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {heatmapNodes.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-xs gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Chargement des nœuds…
          </div>
        ) : (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
            {heatmapNodes.map((n) => (
              <HeatCell key={n.id} value={n.resonance} label={n.concept} />
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 text-right">
          Mise à jour toutes les 5s · {heatmapNodes.length} nœuds affichés
        </p>
      </div>

      {/* ML Prediction Module */}
      <ResonancePrediction />

      {/* Node Health by Tier + Level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tier distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Santé par Tier Mémoire</h3>
          <div className="space-y-2.5">
            {Object.entries(TIER_HEALTH).map(([tier, cfg]) => {
              const count = tierCounts[tier] || 0;
              const pct = nodes.length ? (count / nodes.length) * 100 : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{cfg.label}</span>
                    <span className="font-mono text-foreground">{count} nœuds ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", cfg.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Level avg resonance */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Résonance Moyenne par Niveau Fractal</h3>
          <div className="space-y-2.5">
            {levelAvg.map((l) => {
              const pct = l.avg * 100;
              const barColor =
                pct >= 85 ? "bg-red-500" : pct >= 65 ? "bg-orange-400" : pct >= 35 ? "bg-green-400" : "bg-primary";
              return (
                <div key={l.level}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-mono">{l.level}</span>
                    <span className="font-mono text-foreground">
                      {pct.toFixed(0)}% · {l.count} nœuds
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", barColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}