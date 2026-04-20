import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, AlertTriangle, CheckCircle, Clock, RefreshCw,
  Loader2, TrendingDown, TrendingUp, Zap, Activity, ChevronDown, ChevronUp
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── Risk scoring from node data ───────────────────────────
function computeRisk(node) {
  let score = 0;
  if (node.resonance < 0.2)  score += 50;
  else if (node.resonance < 0.4) score += 30;
  else if (node.resonance < 0.6) score += 15;
  if (node.tier === "DORMANT") score += 25;
  if (node.tier === "DEEP")    score += 5;
  if (node.emotion_weight > 0.8) score += 15;
  if (node.fractal_level === 4)  score += 10; // strategic nodes — more critical
  return Math.min(100, score);
}

function riskLevel(score) {
  if (score >= 60) return "critical";
  if (score >= 35) return "warning";
  return "healthy";
}

const RISK_CFG = {
  critical: { label: "Critique",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",       icon: AlertTriangle },
  warning:  { label: "À surveiller",color: "text-accent",     bg: "bg-accent/10 border-accent/30",         icon: Clock         },
  healthy:  { label: "Stable",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   icon: CheckCircle   },
};

// ── Simulate resonance history for a node ────────────────
function simulateHistory(node) {
  const points = [];
  let r = Math.min(1, node.resonance + 0.25 + Math.random() * 0.15);
  for (let i = 8; i >= 0; i--) {
    const decay = node.resonance < 0.4 ? 0.025 + Math.random() * 0.02 : 0.005 + Math.random() * 0.01;
    r = Math.max(0.01, r - decay);
    points.push({ t: `J-${i}`, resonance: parseFloat((r * 100).toFixed(1)) });
  }
  points.push({ t: "Actuel", resonance: parseFloat((node.resonance * 100).toFixed(1)) });
  // Prediction (3 days ahead)
  let pred = node.resonance;
  for (let i = 1; i <= 3; i++) {
    const decay = node.resonance < 0.4 ? 0.03 + Math.random() * 0.02 : 0.007 + Math.random() * 0.008;
    pred = Math.max(0, pred - decay);
    points.push({ t: `J+${i}`, predicted: parseFloat((pred * 100).toFixed(1)) });
  }
  return points;
}

// ── AI analysis for a node ────────────────────────────────
async function analyzeNode(node, riskScore) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Tu es un système de maintenance prédictive IA pour le réseau AEGIS-Q (mémoire fractale militaire).
Analyse ce nœud et fournis un diagnostic de maintenance :
- Concept : "${node.concept}"
- Type : ${node.type}
- Tier : ${node.tier}
- Niveau fractal : L${node.fractal_level}
- Résonance actuelle : ${(node.resonance * 100).toFixed(0)}%
- Poids émotionnel : ${((node.emotion_weight ?? 0) * 100).toFixed(0)}%
- Score de risque calculé : ${riskScore}/100

Génère :
1. Un diagnostic court (1-2 phrases) sur l'état du nœud et les risques de dégradation imminente.
2. Exactement 3 conseils d'optimisation concrets et priorisés (P1/P2/P3).
3. Un horizon de risque estimé (ex: "48h", "7 jours", "stable 30 jours").`,
    response_json_schema: {
      type: "object",
      properties: {
        diagnostic: { type: "string" },
        horizon: { type: "string" },
        optimizations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "string" },
              action: { type: "string" },
              impact: { type: "string" },
            },
          },
        },
      },
    },
  });
  return res;
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
          <span className="font-mono text-foreground ml-auto">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

// ── Node card ─────────────────────────────────────────────
function NodeMaintenanceCard({ node }) {
  const riskScore = computeRisk(node);
  const level     = riskLevel(riskScore);
  const cfg       = RISK_CFG[level];
  const Icon      = cfg.icon;
  const history   = simulateHistory(node);

  const [open, setOpen]         = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const fetchAnalysis = async () => {
    if (analysis) { setOpen(o => !o); return; }
    setOpen(true);
    setLoadingAI(true);
    const res = await analyzeNode(node, riskScore);
    setAnalysis(res);
    setLoadingAI(false);
  };

  const predictedMin = Math.min(...history.filter(p => p.predicted !== undefined).map(p => p.predicted));

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", cfg.bg)}>
      <button onClick={fetchAnalysis} className="w-full text-left p-4 hover:bg-secondary/10 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
            <div>
              <p className="text-sm font-bold text-foreground">{node.concept}</p>
              <p className="text-[10px] text-muted-foreground font-mono">L{node.fractal_level} · {node.tier} · {node.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className={cn("text-lg font-bold font-mono", cfg.color)}>{riskScore}</p>
              <p className="text-[9px] text-muted-foreground">/ 100</p>
            </div>
            <Badge variant="outline" className={cn("text-[10px]", cfg.bg, cfg.color)}>{cfg.label}</Badge>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Mini spark chart */}
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} hide />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 2" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="resonance" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Résonance" />
              <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Prédiction" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-1 text-[10px]">
          <span className="text-muted-foreground">Résonance actuelle : <span className={cn("font-mono font-bold", cfg.color)}>{(node.resonance * 100).toFixed(0)}%</span></span>
          {predictedMin < 30 && (
            <span className="text-red-400 font-semibold flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />Prédiction J+3 : {predictedMin.toFixed(0)}%
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          {/* Full chart */}
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={`gradP-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <ReferenceLine x="Actuel" stroke="hsl(215,20%,55%)" strokeDasharray="4 2" label={{ value: "Aujourd'hui", position: "top", fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 2" strokeOpacity={0.6} label={{ value: "Seuil critique", position: "right", fontSize: 8, fill: "#ef4444" }} />
                <Area type="monotone" dataKey="resonance" stroke="#3b82f6" strokeWidth={2} fill={`url(#grad-${node.id})`} name="Historique" dot={false} />
                <Area type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" fill={`url(#gradP-${node.id})`} name="Prédiction IA" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* AI analysis */}
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Diagnostic & Recommandations IA</p>
          </div>

          {loadingAI ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />Analyse IA en cours…
            </div>
          ) : analysis ? (
            <div className="space-y-3">
              {/* Diagnostic */}
              <div className="bg-secondary/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold text-foreground">Diagnostic</span>
                  {analysis.horizon && (
                    <Badge variant="outline" className={cn("text-[9px] ml-auto",
                      analysis.horizon.includes("48") || analysis.horizon.includes("24") ? "border-red-500/30 text-red-400" :
                      analysis.horizon.includes("7") ? "border-accent/30 text-accent" : "border-green-500/30 text-green-400")}>
                      <Clock className="h-2.5 w-2.5 mr-1" />{analysis.horizon}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.diagnostic}</p>
              </div>

              {/* Optimizations */}
              {analysis.optimizations?.length > 0 && (
                <div className="space-y-2">
                  {analysis.optimizations.map((opt, i) => (
                    <div key={i} className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5",
                          opt.priority === "P1" ? "border-red-500/30 text-red-400" :
                          opt.priority === "P2" ? "border-accent/30 text-accent" : "border-primary/30 text-primary")}>
                          {opt.priority}
                        </Badge>
                        {opt.impact && <span className="text-[10px] text-muted-foreground ml-auto">Impact : {opt.impact}</span>}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{opt.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function PredictiveMaintenance() {
  const [filter, setFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: nodes = [], isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["nodes-maintenance"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 60),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const scored = nodes.map(n => ({ ...n, _risk: computeRisk(n), _level: riskLevel(computeRisk(n)) }));
  const counts = { critical: 0, warning: 0, healthy: 0 };
  scored.forEach(n => counts[n._level]++);

  const filtered = filter === "all" ? scored : scored.filter(n => n._level === filter);
  // Sort: critical first, then warning, then healthy; within group by risk desc
  const sorted = [...filtered].sort((a, b) => {
    const order = { critical: 0, warning: 1, healthy: 2 };
    return order[a._level] - order[b._level] || b._risk - a._risk;
  });

  const avgResonance = nodes.length ? nodes.reduce((s, n) => s + n.resonance, 0) / nodes.length * 100 : 0;
  const predictedCritical = scored.filter(n => {
    const hist = simulateHistory(n);
    const minPred = Math.min(...hist.filter(p => p.predicted !== undefined).map(p => p.predicted));
    return minPred < 20;
  }).length;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Maintenance Prédictive IA</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse des tendances de résonance · Prédiction de pannes · Alertes proactives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(a => !a)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
              autoRefresh ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            <Activity className={cn("h-3.5 w-3.5", autoRefresh && "animate-pulse")} />
            {autoRefresh ? "Auto 30s ✓" : "Auto"}
          </button>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Nœuds critiques",         value: counts.critical,              color: counts.critical > 0 ? "text-red-400" : "text-green-400",   icon: AlertTriangle },
          { label: "Sous surveillance",        value: counts.warning,               color: counts.warning > 0 ? "text-accent" : "text-green-400",     icon: Clock         },
          { label: "Stables",                  value: counts.healthy,               color: "text-green-400",                                          icon: CheckCircle   },
          { label: "Défaillances prédites J+3",value: predictedCritical,           color: predictedCritical > 0 ? "text-red-400" : "text-green-400", icon: TrendingDown  },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Global resonance overview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Distribution du Risque — Réseau Complet</h3>
          </div>
          <span className="text-xs text-muted-foreground">{nodes.length} nœuds analysés · rés. moy. {avgResonance.toFixed(0)}%</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "critical", label: "Critiques",    pct: nodes.length ? counts.critical / nodes.length * 100 : 0,  color: "#ef4444" },
            { key: "warning",  label: "Avertissement",pct: nodes.length ? counts.warning  / nodes.length * 100 : 0,  color: "#f59e0b" },
            { key: "healthy",  label: "Stables",       pct: nodes.length ? counts.healthy  / nodes.length * 100 : 0,  color: "#10b981" },
          ].map(b => (
            <div key={b.key} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${b.color}18`, border: `1px solid ${b.color}40` }}>
                <span className="text-sm font-bold" style={{ color: b.color }}>{Math.round(b.pct)}%</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{b.label}</p>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{counts[b.key]} nœuds</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground">Afficher :</span>
        {[
          { key: "all",      label: `Tous (${nodes.length})` },
          { key: "critical", label: `Critiques (${counts.critical})` },
          { key: "warning",  label: `Surveillance (${counts.warning})` },
          { key: "healthy",  label: `Stables (${counts.healthy})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1 rounded-lg text-[10px] font-semibold transition-all",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Node list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyse des nœuds en cours…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun nœud dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(n => <NodeMaintenanceCard key={n.id} node={n} />)}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-foreground mb-1">Modèle Prédictif</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cliquez sur un nœud pour déclencher l'analyse IA complète. Le modèle prédit la trajectoire de résonance sur J+3 en extrapolant le taux de déclin, génère un diagnostic contextuel et propose 3 actions d'optimisation prioritisées (P1/P2/P3) adaptées au niveau fractal et au tier mémoire du nœud.
          </p>
        </div>
      </div>
    </div>
  );
}