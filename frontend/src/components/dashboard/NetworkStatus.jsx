import { Activity, Cpu, Database, Zap } from "lucide-react";

const metrics = [
  { label: "Blocs", value: "1,847,293", icon: Database },
  { label: "TPS", value: "12,400", icon: Zap },
  { label: "Nœuds", value: "48", icon: Cpu },
  { label: "Uptime", value: "99.99%", icon: Activity },
];

export default function NetworkStatus() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <h3 className="text-sm font-semibold text-foreground">AEGIS Chain — Réseau</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <m.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{m.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground font-mono">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}