import { Shield, Lock, Fingerprint, AlertTriangle, CheckCircle, Eye, FileSearch, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const secLevels = [
  {
    level: 1,
    title: "Infrastructure",
    icon: Lock,
    color: "text-primary",
    items: [
      { name: "Multi-Signature Wallet", status: "active", score: 100 },
      { name: "Cold Storage", status: "active", score: 100 },
      { name: "Hardware Keys", status: "active", score: 100 },
    ],
  },
  {
    level: 2,
    title: "IA & Comportement",
    icon: Eye,
    color: "text-accent",
    items: [
      { name: "IA Anti-Fraude", status: "active", score: 98 },
      { name: "Analyse Comportementale", status: "active", score: 97 },
      { name: "Audit Fractal", status: "active", score: 95 },
    ],
  },
  {
    level: 3,
    title: "Conformité",
    icon: Scale,
    color: "text-chart-2",
    items: [
      { name: "AML (Anti Money Laundering)", status: "active", score: 100 },
      { name: "KYC (Know Your Customer)", status: "active", score: 100 },
      { name: "Audit Fiscal", status: "active", score: 96 },
    ],
  },
];

const alerts = [
  { type: "info", message: "Audit de sécurité planifié dans 3 jours", time: "1h" },
  { type: "success", message: "Transaction suspecte bloquée avec succès", time: "4h" },
  { type: "success", message: "Mise à jour des clés de chiffrement terminée", time: "12h" },
];

export default function Security() {
  const overallScore = 98.4;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Sécurité Cyber</h2>
        <p className="text-sm text-muted-foreground mt-1">Architecture sécurité — Niveau Banque</p>
      </div>

      {/* Overall Score */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400 font-mono">{overallScore}</p>
              <p className="text-[10px] text-muted-foreground">/ 100</p>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-bold text-foreground">Score de Sécurité Global</h3>
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Excellent</Badge>
            </div>
            <Progress value={overallScore} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              Tous les systèmes opérationnels. Dernière vérification il y a 12 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Security Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {secLevels.map((level) => (
          <div key={level.level} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                <level.icon className={`h-5 w-5 ${level.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-mono">NIVEAU {level.level}</p>
                <h4 className="text-sm font-bold text-foreground">{level.title}</h4>
              </div>
            </div>
            <div className="space-y-3">
              {level.items.map((item) => (
                <div key={item.name} className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-400" />
                      <span className="text-[10px] font-mono text-green-400">{item.score}%</span>
                    </div>
                  </div>
                  <Progress value={item.score} className="h-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Alertes Récentes</h3>
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
              {alert.type === "info"
                ? <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
                : <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
              }
              <span className="text-sm text-foreground flex-1">{alert.message}</span>
              <span className="text-xs text-muted-foreground shrink-0">{alert.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}