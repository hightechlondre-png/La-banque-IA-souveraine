import { Hexagon, Brain, Coins, Wallet, Shield, Vote } from "lucide-react";

const nodes = [
  { icon: Hexagon, label: "AEGIS Chain", sub: "Blockchain Privée", color: "text-primary" },
  { icon: Coins, label: "AEGIS-Q Token", sub: "1B Supply", color: "text-accent" },
  { icon: Brain, label: "AUDIT-DS", sub: "IA Financière", color: "text-chart-2" },
  { icon: Wallet, label: "Wallet AEGIS", sub: "Souverain", color: "text-chart-4" },
  { icon: Shield, label: "Sécurité", sub: "Niveau Banque", color: "text-chart-5" },
  { icon: Vote, label: "Gouvernance", sub: "DAO", color: "text-chart-3" },
];

export default function ArchitectureMap() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Architecture AEGIS Network</h3>
      <div className="grid grid-cols-3 gap-3">
        {nodes.map((node) => (
          <div key={node.label} className="group bg-secondary/50 rounded-lg p-4 text-center hover:bg-secondary transition-colors cursor-default">
            <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <node.icon className={`h-5 w-5 ${node.color}`} />
            </div>
            <p className="text-xs font-semibold text-foreground">{node.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{node.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}