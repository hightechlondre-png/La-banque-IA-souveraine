import { Shield, Zap, AlertTriangle, Ban, Activity, Lock, Server, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

const codeSnippets = {
  java: `package aegis.security;

public class SentinelFirewall {

    public boolean detectAttack(double amount) {

        if(amount > 500000) {
            return true; // THREAT DETECTED
        }
        return false;
    }

    public void blockTransaction(String address) {
        System.out.println("🔴 Blocked address: " + address);
        logToMilitaryAudit(address, "AUTO_BLOCK");
    }

    private void logToMilitaryAudit(String address, String reason) {
        MilitaryAuditLog.record(address, reason, System.currentTimeMillis());
    }

}`,
  cpp: `#include <iostream>
#include <unordered_map>

class MilitaryLedger {

private:
    std::unordered_map<std::string, long double> balances;

public:

    void secureTransfer(
        std::string from,
        std::string to,
        long double amount
    ) {
        if(balances[from] >= amount) {

            balances[from] -= amount;
            balances[to]   += amount;

            logTransfer(from, to, amount);

        } else {
            std::cout << "⛔ Denied Military Transfer\\n";
        }
    }

    void logTransfer(
        std::string from,
        std::string to,
        long double amount
    ) {
        // Quantum Ledger trace
        QuantumLedger::record(from, to, amount);
    }

};`,
  python: `class MilitaryAudit:

    def detect_anomaly(self, transaction: dict) -> str:

        risk_score = 0

        # Amount threshold check
        if transaction["amount"] > 100_000:
            risk_score += 50

        # Frequency check
        if transaction["frequency"] > 10:
            risk_score += 30

        # Velocity check
        if transaction.get("velocity", 0) > 0.85:
            risk_score += 20

        # AI Pattern recognition
        if self.ai_model.predict(transaction) > 0.9:
            risk_score += 40

        if risk_score > 60:
            self.trigger_emergency_protocol(transaction)
            return "BLOCK"

        return "ALLOW"

    def trigger_emergency_protocol(self, tx):
        SentinelFirewall.freeze(tx["address"])
        QuantumLedger.flag(tx["id"], "MILITARY_BLOCK")`
};

const threats = [
  { type: "DDoS Attempt", source: "198.51.x.x", severity: "critical", status: "blocked", time: "2 min" },
  { type: "Bot Pattern", source: "0x4f2a...7b1c", severity: "high", status: "blocked", time: "14 min" },
  { type: "Anomaly Transaction", source: "0x9d5e...3a8f", severity: "medium", status: "flagged", time: "1h" },
  { type: "Velocity Spike", source: "0x2f8a...6d4e", severity: "low", status: "monitoring", time: "3h" },
];

const metrics = [
  { icon: Shield, label: "Attaques Bloquées (24h)", value: "1,847", color: "text-primary" },
  { icon: Ban, label: "Adresses Bannies", value: "342", color: "text-red-400" },
  { icon: Activity, label: "Transactions Analysées", value: "489,203", color: "text-accent" },
  { icon: Zap, label: "Temps Réponse Moyen", value: "0.3 ms", color: "text-chart-2" },
];

const severityStyle = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-accent/10 text-accent border-accent/30",
  low: "bg-primary/10 text-primary border-primary/30",
};

const statusStyle = {
  blocked: "text-red-400",
  flagged: "text-accent",
  monitoring: "text-primary",
};

export default function Sentinel() {
  const [activeTab, setActiveTab] = useState("java");

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Sentinel Firewall</h2>
          <p className="text-sm text-muted-foreground mt-1">Cyber Défense Militaire — AEGIS Security Layer</p>
        </div>
        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 mr-2 inline-block animate-pulse" />
          SENTINEL ACTIF
        </Badge>
      </div>

      {/* Threat Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4">
            <m.icon className={`h-4 w-4 ${m.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-xl font-bold text-foreground font-mono">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Architecture Militaire */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Architecture Défense Multi-Couche</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: Shield, label: "Sentinel", sub: "Firewall IA", color: "text-primary" },
            { icon: Lock, label: "Multi-Sig", sub: "3/5 Clés", color: "text-accent" },
            { icon: Server, label: "Cold Vault", sub: "Air-Gapped", color: "text-chart-2" },
            { icon: Wifi, label: "Nodes Dist.", sub: "P2P Privé", color: "text-chart-4" },
            { icon: Activity, label: "Quantum Ledger", sub: "Tracabilité", color: "text-chart-5" },
            { icon: AlertTriangle, label: "Emergency", sub: "Protocol", color: "text-destructive" },
          ].map((item) => (
            <div key={item.label} className="bg-secondary/50 rounded-lg p-3 text-center">
              <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center mx-auto mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="text-xs font-semibold text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Threats */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-foreground">Menaces Détectées — Live</h3>
        </div>
        <div className="space-y-2">
          {threats.map((t, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
              <Ban className={`h-4 w-4 shrink-0 ${statusStyle[t.status]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.type}</p>
                <p className="text-xs font-mono text-muted-foreground">{t.source}</p>
              </div>
              <Badge variant="outline" className={`text-[10px] ${severityStyle[t.severity]}`}>{t.severity.toUpperCase()}</Badge>
              <span className="text-xs text-muted-foreground shrink-0">{t.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Code — Sentinel Source */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sentinel — Code Source Militaire</h3>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "java", label: "Java" },
            { key: "cpp", label: "C++" },
            { key: "python", label: "Python" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre className="bg-background rounded-xl p-5 overflow-x-auto text-xs font-mono text-foreground border border-border leading-relaxed">
          <code>{codeSnippets[activeTab]}</code>
        </pre>
      </div>

      {/* Emergency Protocol */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Emergency Protocol</h3>
          <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">STANDBY</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            "Gel des transactions",
            "Audit IA immédiat",
            "Réseau isolé",
            "Redémarrage sécurisé",
          ].map((step, i) => (
            <div key={step} className="flex items-center gap-2 bg-background rounded-lg p-3">
              <span className="text-xs font-mono text-destructive font-bold">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs text-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}