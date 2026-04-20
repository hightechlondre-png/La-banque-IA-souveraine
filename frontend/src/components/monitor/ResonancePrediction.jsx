import { useState, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BrainCircuit, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const SEV_CONFIG = {
  critical: {
    label: "CRITIQUE",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  warning: {
    label: "AVERTISSEMENT",
    border: "border-orange-500/30",
    bg: "bg-orange-500/8",
    text: "text-orange-400",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  anomaly: {
    label: "ANOMALIE",
    border: "border-accent/30",
    bg: "bg-accent/8",
    text: "text-accent",
    badge: "bg-accent/10 text-accent border-accent/20",
  },
};

const TREND_ICON = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
};

const TREND_COLOR = {
  rising: "text-red-400",
  falling: "text-green-400",
  stable: "text-muted-foreground",
};

function MiniPredChart({ current, predictions }) {
  const data = [
    { t: 0, v: current, type: "current" },
    ...predictions.map((v, i) => ({ t: i + 1, v, type: "predicted" })),
  ];
  const maxV = Math.max(...data.map((d) => d.v));
  const threshold = 0.9;

  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="t" hide />
        <YAxis domain={[0, 1]} hide />
        <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={maxV >= threshold ? "#ef4444" : maxV >= 0.75 ? "#f59e0b" : "#3b82f6"}
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, index } = props;
            if (index === 0) return <circle key={index} cx={cx} cy={cy} r={3} fill="#3b82f6" />;
            return <circle key={index} cx={cx} cy={cy} r={2.5} fill={maxV >= threshold ? "#ef4444" : "#f59e0b"} opacity={0.7} />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AlertCard({ alert, expanded, onToggle }) {
  const cfg = SEV_CONFIG[alert.severity];
  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all", cfg.border, cfg.bg)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <AlertTriangle className={cn("h-4 w-4 shrink-0", cfg.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-[9px] shrink-0", cfg.badge)}>
              {cfg.label}
            </Badge>
            <span className="text-xs font-semibold text-foreground truncate">{alert.concept}</span>
          </div>
          <p className={cn("text-[10px] mt-0.5", cfg.text)}>{alert.message}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-mono font-bold text-foreground">
            {(alert.current * 100).toFixed(0)}%
            <span className="text-muted-foreground mx-1">→</span>
            <span className={cfg.text}>{(alert.predicted_peak * 100).toFixed(0)}%</span>
          </p>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-white/10 px-4 pb-3 pt-2">
          <p className="text-[10px] text-muted-foreground">
            <span className="text-foreground font-semibold">Recommandation : </span>
            {alert.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

function PredictionRow({ pred }) {
  const TrendIcon = TREND_ICON[pred.trend];
  const trendColor = TREND_COLOR[pred.trend];
  const anomalyPct = pred.anomaly_score * 100;

  return (
    <div className="bg-secondary/30 rounded-xl p-3 grid grid-cols-[1fr_80px_60px_60px] gap-2 items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{pred.concept}</p>
        <p className="text-[10px] text-muted-foreground">L{pred.fractal_level} · {pred.tier}</p>
      </div>
      <div>
        <MiniPredChart current={pred.current} predictions={pred.predicted_5steps} />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
          <span className={cn("text-[10px] font-mono font-bold", trendColor)}>
            {pred.slope > 0 ? "+" : ""}{(pred.slope * 100).toFixed(1)}%
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">slope/cycle</p>
      </div>
      <div className="text-center">
        <div
          className={cn(
            "text-xs font-bold font-mono rounded-lg px-1.5 py-1",
            anomalyPct >= 50 ? "bg-red-500/20 text-red-400"
            : anomalyPct >= 25 ? "bg-orange-500/20 text-orange-400"
            : "bg-secondary text-muted-foreground"
          )}
        >
          {anomalyPct.toFixed(0)}%
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">anomalie</p>
      </div>
    </div>
  );
}

const AUTO_REFRESH_INTERVAL = 60_000; // 60s

export default function ResonancePrediction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const runPrediction = useCallback(async () => {
    setLoading(true);
    setNextRefresh(AUTO_REFRESH_INTERVAL / 1000);
    try {
      const res = await base44.functions.invoke("predictResonance", {});
      setData(res.data);
      setLastRun(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-launch on mount + schedule refresh every 60s
  useEffect(() => {
    runPrediction();
    intervalRef.current = setInterval(runPrediction, AUTO_REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setNextRefresh((n) => (n <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : n - 1));
    }, 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [runPrediction]);

  const stats = data?.stats;
  const alerts = data?.alerts || [];
  const predictions = data?.predictions || [];

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Prédiction ML de Résonance</h3>
            <p className="text-[10px] text-muted-foreground">
              Régression linéaire · Lissage exponentiel · Détection d'anomalies z-score
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3">
            {lastRun && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Dernière : {lastRun.toLocaleTimeString("fr-FR")}
              </span>
            )}
            {!loading && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                ↻ {nextRefresh}s
              </span>
            )}
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1" />
              AUTO
            </Badge>
            <Button size="sm" variant="outline" onClick={runPrediction} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              {loading ? "Analyse…" : "Maintenant"}
            </Button>
          </div>
        </div>
      </div>

      {!data && !loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Initialisation de l'analyse ML…</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Analyse des tendances historiques…</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stats KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Nœuds analysés", value: stats.total_nodes, color: "text-primary" },
              { label: "Tendance haussière", value: stats.rising_nodes, color: "text-orange-400" },
              { label: "Critiques prédits", value: stats.critical_predicted, color: "text-red-400" },
              { label: "Avertissements", value: stats.warning_predicted, color: "text-accent" },
              { label: "Anomalies", value: stats.anomaly_detected, color: "text-chart-4" },
            ].map((k) => (
              <div key={k.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                Alertes Proactives ({alerts.length})
              </h4>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {alerts.map((alert, i) => (
                  <AlertCard
                    key={i}
                    alert={alert}
                    expanded={expandedAlert === i}
                    onToggle={() => setExpandedAlert(expandedAlert === i ? null : i)}
                  />
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <span className="text-green-400 text-lg">✓</span>
              <p className="text-sm text-green-400 font-semibold">Aucune surcharge prédite — tous les nœuds sont stables</p>
            </div>
          )}

          {/* Predictions Table */}
          {predictions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-foreground mb-2">
                Top 20 Nœuds par Score d'Anomalie
                <span className="text-muted-foreground font-normal ml-2">
                  — Courbe : réel → prédiction 5 cycles · Ligne rouge = seuil 90%
                </span>
              </h4>
              <div className="grid grid-cols-[1fr_80px_60px_60px] gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                <span>Nœud</span>
                <span className="text-center">Tendance prédite</span>
                <span className="text-center">Pente</span>
                <span className="text-center">Score</span>
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {predictions.map((pred, i) => (
                  <PredictionRow key={i} pred={pred} />
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Μ={stats.population_mean} · σ={stats.population_std} · Généré : {new Date(data.generated_at).toLocaleTimeString("fr-FR")}
          </p>
        </>
      )}
    </div>
  );
}