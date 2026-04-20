import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AgentGraph from "@/components/AgentGraph";
import { Badge } from "@/components/ui/badge";
import { Loader2, Network, GitBranch, Activity } from "lucide-react";

export default function AgentNetwork() {
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => base44.entities.Agent.list("-created_date", 100),
    refetchInterval: 5000,
  });

  const { data: executions = [], isLoading: execLoading } = useQuery({
    queryKey: ["executions"],
    queryFn: () => base44.entities.AgentExecution.list("-created_date", 100),
    refetchInterval: 3000,
  });

  const isLoading = agentsLoading || execLoading;

  // Compute statistics
  const totalExecs = executions.length;
  const successExecs = executions.filter((e) => e.status === "success").length;
  const runningExecs = executions.filter((e) => e.status === "running").length;
  const avgDepth =
    executions.length > 0
      ? (
          executions.reduce((s, e) => s + (e.depth || 1), 0) / executions.length
        ).toFixed(1)
      : 0;
  const totalSpawned = executions.reduce(
    (s, e) => s + (e.spawned_agents?.length || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          Réseau d'Agents Autonomes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Visualisation interactive des relations agent-to-agent, skills exécutés et flux de données en temps réel
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Agents actifs", value: agents.length, icon: "🤖", color: "text-primary" },
          {
            label: "Exécutions",
            value: totalExecs,
            icon: "⚡",
            color: "text-accent",
          },
          {
            label: "Succès",
            value: successExecs,
            icon: "✓",
            color: "text-green-400",
          },
          {
            label: "Profondeur moy.",
            value: avgDepth,
            icon: "📊",
            color: "text-blue-400",
          },
          {
            label: "Agents spawned",
            value: totalSpawned,
            icon: "🌿",
            color: "text-orange-400",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-card border border-border rounded-xl p-3 text-center"
          >
            <p className="text-lg mb-1">{k.icon}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Main graph */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            Graphe Réseau d'Exécution
          </h3>
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          💡 Cliquez sur les nœuds pour voir les détails · Scroll pour zoomer ·
          Drag pour naviguer
        </div>
        {isLoading ? (
          <div className="h-[500px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AgentGraph agents={agents} executions={executions} />
        )}
      </div>

      {/* Execution table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-chart-2" />
          <h3 className="text-sm font-bold text-foreground">
            Historique des Exécutions
          </h3>
        </div>
        <div className="space-y-2">
          {executions.slice(0, 15).map((exec, i) => (
            <div
              key={exec.id || i}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/30"
            >
              <Badge
                variant="outline"
                className={
                  exec.status === "success"
                    ? "border-green-500/30 text-green-400"
                    : exec.status === "running"
                    ? "border-accent/30 text-accent"
                    : "border-red-500/30 text-red-400"
                }
              >
                {exec.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {exec.agent_name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {exec.prompt}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {exec.spawned_agents?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {exec.spawned_agents.length}
                  </span>
                )}
                {exec.execution_time_ms && (
                  <span>⏱ {(exec.execution_time_ms / 1000).toFixed(1)}s</span>
                )}
                <span className="text-muted-foreground/70">L{exec.depth}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}