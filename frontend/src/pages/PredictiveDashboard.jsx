import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Bell, BellOff, TrendingUp, TrendingDown, Activity,
  Brain, Zap, Shield, Eye, CheckCircle, XCircle, Clock, RefreshCw, Loader2
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── Prediction engine ──────────────────────────────────────
function predictResonance(current, decay, emotionBias, hours) {
  const points = [];
  let r = current;
  for (let h = 0; h <= hours; h++) {
    const noise = (Math.random() - 0.5) * 0.04;
    const trend = emotionBias > 0.6 ? 0.008 : -0.005;
    r = Math.max(0, Math.min(1, r * (1 - decay * 0.04) + trend + noise));
    const now = new Date();
    now.setHours(now.getHours() + h);
    points.push({
      time: h === 0 ? "Maintenant" : `+${h}h`,
      predicted: parseFloat(r.toFixed(3)),
      upper: parseFloat(Math.min(1, r + 0.08 + h * 0.003).toFixed(3)),
      lower: parseFloat(Math.max(0, r - 0.08 - h * 0.003).toFixed(3)),
    });
  }
  return points;
}

function buildNetworkForecast(nodes) {
  if (!nodes.length) return [];
  const avgRes   = nodes.reduce((s, n) => s + (n.resonance ?? 0), 0) / nodes.length;
  const avgDecay = 0.18;
  const emotionBias = nodes.reduce((s, n) => s + (n.emotion_weight ?? 0.5), 0) / nodes.length;
  return predictResonance(avgRes, avgDecay, emotionBias, 24);
}

function detectAnomalies(forecast, nodes) {
  const alerts = [];
  const sealedCount  = nodes.filter(n => n.tier === "SEALED").length;
  const criticalRes  = nodes.filter(n => (n.resonance ?? 0) > 0.9).length;
  const dormantCount = nodes.filter(n => n.tier === "DORMANT").length;

  forecast.forEach((pt, i) => {
    if (i === 0) return;
    const delta = pt.predicted - forecast[i - 1].predicted;

    if (pt.predicted > 0.92) alerts.push({
      id: `RES-SPIKE-${i}`, hour: pt.time, severity: "critical",
      type: "Résonance Critique",
      message: `Pic de résonance réseau prévu à ${(pt.predicted * 100).toFixed(0)}% à ${pt.time}`,
      action: "Activer le circuit-breaker et suspendre les transactions >10K AQ",
    });
    else if (delta < -0.04) alerts.push({
      id: `DECAY-${i}`, hour: pt.time, severity: "high",
      type: "Chute de Résonance",
      message: `Effondrement rapide détecté (−${(Math.abs(delta) * 100).toFixed(1)}%) à ${pt.time}`,
      action: "Déclencher la réactivation des nœuds DORMANT prioritaires",
    });
    else if (pt.predicted < 0.3 && i > 6) alerts.push({
      id: `LOW-RES-${i}`, hour: pt.time, severity: "medium",
      type: "Résonance Faible",
      message: `Zone de résonance basse prolongée prévue à ${pt.time}`,
      action: "Injecter des événements de stimulation fractale L0→L2",
    });
  });

  if (criticalRes > 3) alerts.unshift({
    id: "CRIT-NODES", hour: "Immédiat", severity: "critical",
    type: "Nœuds Suractivés",
    message: `${criticalRes} nœuds dépassent 90% de résonance — risque de cascade`,
    action: "Appliquer le pruning d'urgence sur les nœuds suractivés non-SEALED",
  });

  if (dormantCount > nodes.length * 0.4) alerts.push({
    id: "DORMANT-MASS", hour: "+4h", severity: "medium",
    type: "Masse Dormante",
    message: `${dormantCount} nœuds DORMANT (${((dormantCount/nodes.length)*100).toFixed(0)}%) — fragmentation réseau`,
    action: "Réactiver les clusters stratégiques via stimulation émotionnelle L3",
  });

  if (sealedCount > 0) alerts.push({
    id: "SEALED-OK", hour: "Continu", severity: "info",
    type: "Nœuds Scellés",
    message: `${sealedCount} nœuds SEALED protégés — intégrité architecturale maintenue`,
    action: "Surveillance passive — aucune action requise",
  });

  return alerts.slice(0, 8);
}

function buildLevelForecast(nodes) {
  return Array.from({ length: 25 }, (_, h) => {
    const row = { time: h === 0 ? "Now" : `+${h}h` };
    [0, 1, 2, 3, 4].forEach(lvl => {
      const lvlNodes = nodes.filter(n => n.fractal_level === lvl);
      const base = lvlNodes.length ? lvlNodes.reduce((s, n) => s + (n.resonance ?? 0), 0) / lvlNodes.length : 0.4;
      const wave = Math.sin(h * 0.4 + lvl * 1.2) * 0.06;
      const decay = base * Math.exp(-0.015 * (lvl + 1) * h);
      row[`L${lvl}`] = parseFloat(Math.max(0.05, Math.min(1, decay + wave + (Math.random() - 0.5) * 0.02)).toFixed(3));
    });
    return row;
  });
}

// ── Sub-components ─────────────────────────────────────────
const SEV = {
  critical: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",       icon: XCircle,       dot: "bg-red-500"    },
  high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: AlertTriangle, dot: "bg-orange-500" },
  medium:   { color: "text-accent",     bg: "bg-accent/10 border-accent/20",         icon: Clock,         dot: "bg-yellow-500" },
  info:     { color: "text-primary",    bg: "bg-primary/10 border-primary/20",        icon: CheckCircle,   dot: "bg-blue-500"   },
};

const LEVEL_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name || p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">
            {typeof p.value === "number" ? `${(p.value * 100).toFixed(0)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────
export default function PredictiveDashboard() {
  const [alertsMuted, setAlertsMuted] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const { data: nodes = [], isLoading, refetch } = useQuery({
    queryKey: ["mem-nodes-predict"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 80),
    refetchInterval: 30000,
  });

  const forecast      = buildNetworkForecast(nodes);
  const levelForecast = buildLevelForecast(nodes);
  const alerts        = detectAnomalies(forecast, nodes);

  const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
  const highAlerts     = alerts.filter(a => a.severity === "high").length;

  const avgRes     = nodes.length ? (nodes.reduce((s, n) => s + (n.resonance ?? 0), 0) / nodes.length) : 0;
  const peak24h    = forecast.length ? Math.max(...forecast.map(p => p.predicted)) : 0;
  const trough24h  = forecast.length ? Math.min(...forecast.map(p => p.predicted)) : 0;
  const trend      = forecast.length > 1 ? forecast[forecast.length - 1].predicted - forecast[0].predicted : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  const muteAlert = (id) => setAlertsMuted(m => ({ ...m, [id]: !m[id] }));

  const visibleAlerts = alerts.filter(a => !alertsMuted[a.id]);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Tableau de Bord Prédictif</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Prévisions réseau 24h · Détection d'anomalies · Alertes automatiques N-MEM-B
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalAlerts > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {criticalAlerts} alerte{criticalAlerts > 1 ? "s" : ""} critique{criticalAlerts > 1 ? "s" : ""}
            </Badge>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
          <span className="text-[10px] text-muted-foreground font-mono">
            {lastRefresh.toLocaleTimeString("fr-FR")}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Résonance Actuelle",  value: `${(avgRes * 100).toFixed(0)}%`,   icon: Activity,     color: avgRes > 0.7 ? "text-green-400" : avgRes > 0.4 ? "text-accent" : "text-red-400" },
              { label: "Pic Prévu 24h",       value: `${(peak24h * 100).toFixed(0)}%`,  icon: TrendingUp,   color: peak24h > 0.9 ? "text-red-400" : "text-accent" },
              { label: "Creux Prévu 24h",     value: `${(trough24h * 100).toFixed(0)}%`,icon: TrendingDown, color: trough24h < 0.3 ? "text-red-400" : "text-primary" },
              { label: "Tendance 24h",        value: `${trend >= 0 ? "+" : ""}${(trend * 100).toFixed(1)}%`, icon: trend >= 0 ? TrendingUp : TrendingDown, color: trend >= 0 ? "text-green-400" : "text-red-400" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Alert banner */}
          {visibleAlerts.filter(a => a.severity === "critical").length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-400 mb-1">⚠ Anomalies Critiques Détectées</p>
                <div className="space-y-1">
                  {visibleAlerts.filter(a => a.severity === "critical").map(a => (
                    <p key={a.id} className="text-xs text-muted-foreground">{a.message}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main forecast chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Prévision Résonance Réseau — 24 Heures</h3>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary ml-auto">
                Modèle Decay Fractal + Biais Émotionnel
              </Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <defs>
                    <linearGradient id="gradUpper" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval={3} />
                  <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0.9} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.7}
                    label={{ value: "⚠ Critique", position: "right", fontSize: 9, fill: "#ef4444" }} />
                  <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.7}
                    label={{ value: "⚠ Bas", position: "right", fontSize: 9, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradUpper)" name="Borne haute" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="none" name="Borne basse" />
                  <Area type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={2.5}
                    fill="url(#gradPred)" name="Résonance prévue" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-blue-500 inline-block" /> Prévision centrale</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-blue-500/20 inline-block" /> Intervalle de confiance</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-red-500 inline-block" style={{ borderTop: "2px dashed" }} /> Seuil critique (90%)</span>
            </div>
          </div>

          {/* Level forecast + alerts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Level resonance forecast */}
            <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-bold text-foreground">Prévision par Niveau Fractal — 24h</h3>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={levelForecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false}
                      tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval={4} />
                    <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                      axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    {[0, 1, 2, 3, 4].map(l => (
                      <Line key={l} type="monotone" dataKey={`L${l}`} stroke={LEVEL_COLORS[l]}
                        strokeWidth={1.5} dot={false} strokeDasharray={l > 2 ? "4 3" : undefined} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alerts panel */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-bold text-foreground">Alertes Automatiques</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {visibleAlerts.length}/{alerts.length}
                </Badge>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                {alerts.map(alert => {
                  const cfg = SEV[alert.severity];
                  const Icon = cfg.icon;
                  const muted = alertsMuted[alert.id];
                  return (
                    <div key={alert.id} className={cn("border rounded-lg p-3 transition-opacity", cfg.bg, muted && "opacity-30")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("text-[10px] font-bold", cfg.color)}>{alert.type}</span>
                              <span className="text-[9px] text-muted-foreground font-mono">{alert.hour}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{alert.message}</p>
                          </div>
                        </div>
                        <button onClick={() => muteAlert(alert.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                          {muted ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                        </button>
                      </div>
                      {!muted && (
                        <div className="mt-2 bg-black/20 rounded px-2 py-1">
                          <p className="text-[9px] text-muted-foreground">
                            <span className={cn("font-bold", cfg.color)}>Action : </span>
                            {alert.action}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Node heatmap — top 10 at-risk nodes */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-chart-4" />
              <h3 className="text-sm font-bold text-foreground">Nœuds à Risque — Prochaines 24h</h3>
              <span className="text-xs text-muted-foreground ml-1">(résonance élevée ou décroissance rapide)</span>
            </div>
            <div className="space-y-2">
              {nodes
                .sort((a, b) => Math.abs((b.resonance ?? 0) - 0.9) - Math.abs((a.resonance ?? 0) - 0.9))
                .slice(0, 10)
                .map((n, i) => {
                  const res = n.resonance ?? 0;
                  const risk = res > 0.85 ? "critical" : res > 0.7 ? "high" : res < 0.25 ? "medium" : "low";
                  const cfg = SEV[risk];
                  const Icon = cfg.icon;
                  const LEVEL_HEX = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"];
                  return (
                    <div key={n.id ?? i} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${LEVEL_HEX[n.fractal_level ?? 0]}22` }}>
                        <span className="text-[9px] font-mono font-bold"
                          style={{ color: LEVEL_HEX[n.fractal_level ?? 0] }}>L{n.fractal_level ?? 0}</span>
                      </div>
                      <span className="text-xs text-foreground font-medium w-40 truncate">{n.concept ?? `Node #${i}`}</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${res * 100}%`, background: res > 0.85 ? "#ef4444" : res > 0.7 ? "#f97316" : res < 0.25 ? "#f59e0b" : "#3b82f6" }} />
                      </div>
                      <span className="text-xs font-mono text-foreground w-10 text-right">{(res * 100).toFixed(0)}%</span>
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                      <span className={cn("text-[10px] font-semibold w-16", cfg.color)}>{risk}</span>
                    </div>
                  );
                })}
              {!nodes.length && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Aucun nœud — démarrez la simulation pour alimenter les données.
                </p>
              )}
            </div>
          </div>

          {/* Summary footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Nœuds analysés",    value: nodes.length,                                          icon: Brain,    color: "text-primary" },
              { label: "Alertes actives",    value: visibleAlerts.filter(a => a.severity !== "info").length, icon: AlertTriangle, color: highAlerts + criticalAlerts > 0 ? "text-red-400" : "text-green-400" },
              { label: "Nœuds SEALED",      value: nodes.filter(n => n.tier === "SEALED").length,          icon: Shield,   color: "text-chart-5" },
              { label: "Nœuds DORMANT",     value: nodes.filter(n => n.tier === "DORMANT").length,         icon: Zap,      color: "text-muted-foreground" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <k.icon className={`h-5 w-5 shrink-0 ${k.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}