import { Brain, Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Cpu, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const inflationData = [
  { hour: "00h", rate: 2.0 }, { hour: "04h", rate: 2.0 }, { hour: "08h", rate: 1.98 },
  { hour: "12h", rate: 2.01 }, { hour: "16h", rate: 1.99 }, { hour: "20h", rate: 2.0 },
  { hour: "24h", rate: 2.0 },
];

const activityData = [
  { hour: "00h", activity: 0.45 }, { hour: "04h", activity: 0.32 }, { hour: "08h", activity: 0.65 },
  { hour: "12h", activity: 0.82 }, { hour: "16h", activity: 0.78 }, { hour: "20h", activity: 0.71 },
  { hour: "24h", activity: 0.55 },
];

const recentActions = [
  { action: "Inflation ajustée", detail: "2.01% → 2.00%", type: "adjust", time: "2 min" },
  { action: "Transaction flaggée", detail: "150,000 AQ — Analyse en cours", type: "flag", time: "18 min" },
  { action: "Récompense distribuée", detail: "45,000 AQ aux stakers", type: "reward", time: "1h" },
  { action: "Supply régulée", detail: "Activité réseau: 0.78", type: "adjust", time: "2h" },
  { action: "Fraude détectée", detail: "Tentative bloquée — IP banni", type: "block", time: "4h" },
];

const modules = [
  { name: "Inflation Dynamique", status: "online", metric: "2.00%", icon: TrendingUp },
  { name: "Récompenses Joueurs", status: "online", metric: "12.4M AQ/mois", icon: Zap },
  { name: "Anti-Inflation", status: "online", metric: "Actif", icon: TrendingDown },
  { name: "Détection Fraude", status: "online", metric: "99.7% précision", icon: AlertTriangle },
];

export default function AuditDS() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">AUDIT-DS</h2>
        <p className="text-sm text-muted-foreground mt-1">Module IA Financière — Banque Centrale AEGIS</p>
      </div>

      {/* Status Banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-float">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-foreground">AUDIT-DS</h3>
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse inline-block" />
                En Ligne
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Intelligence Artificielle financière — Gestion automatisée de l'inflation, récompenses, staking et sécurité anti-fraude.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Décisions / 24h</p>
              <p className="text-xl font-bold text-foreground font-mono">1,247</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Précision</p>
              <p className="text-xl font-bold text-green-400 font-mono">99.7%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <div key={mod.name} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <mod.icon className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold text-foreground">{mod.name}</h4>
            </div>
            <p className="text-lg font-bold text-foreground font-mono">{mod.metric}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-green-400">Opérationnel</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Taux d'Inflation — Temps Réel</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inflationData}>
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                <YAxis domain={[1.95, 2.05]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-primary font-mono">{payload[0].value}%</p>
                  </div>
                ) : null} />
                <Line type="monotone" dataKey="rate" stroke="hsl(45, 93%, 58%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Activité Réseau</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-chart-2 font-mono">{(payload[0].value * 100).toFixed(0)}%</p>
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="activity" stroke="hsl(160, 60%, 45%)" strokeWidth={2} fill="url(#actGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Actions IA Récentes</h3>
        <div className="space-y-2">
          {recentActions.map((act, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
              {act.type === "flag" || act.type === "block"
                ? <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
                : <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{act.action}</p>
                <p className="text-xs text-muted-foreground">{act.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{act.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}