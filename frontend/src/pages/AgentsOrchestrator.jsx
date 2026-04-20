import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Play, Zap, Brain, CheckCircle, AlertTriangle, Clock, Activity } from "lucide-react";

const ROLE_COLORS = {
  analyst: "text-primary",
  optimizer: "text-accent",
  monitor: "text-chart-2",
  executor: "text-orange-400",
  coordinator: "text-chart-4",
};

const ROLE_ICONS = {
  analyst: Brain,
  optimizer: Zap,
  monitor: Activity,
  executor: Play,
  coordinator: Brain,
};

export default function AgentsOrchestrator() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executions, setExecutions] = useState([]);

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => base44.entities.Agent.list("-created_date", 50),
  });

  const { data: executionHistory = [] } = useQuery({
    queryKey: ["executions"],
    queryFn: () => base44.entities.AgentExecution.list("-created_date", 20),
    refetchInterval: 3000,
  });

  const handleExecute = async () => {
    if (!selectedAgent || !prompt.trim()) return;
    
    setExecuting(true);
    try {
      const response = await base44.functions.invoke("orchestrateAgent", {
        agent_id: selectedAgent.id,
        prompt: prompt.trim(),
      });

      setExecutions(prev => [{
        id: response.data.execution_id,
        agent: selectedAgent.name,
        prompt,
        status: response.data.status,
        result: response.data.result,
        time_ms: response.data.time_ms,
      }, ...prev]);
      
      setPrompt("");
    } catch (err) {
      console.error("Execution error:", err);
    }
    setExecuting(false);
  };

  const activeAgents = agents.filter(a => a.status === "idle" || a.status === "running");
  const topExecution = executionHistory[0];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Orchestrateur d'Agents Autonomes</h2>
        <p className="text-sm text-muted-foreground mt-1">Déployez et orchestrez des agents IA collaboratifs pour automatiser les tâches complexes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Agents actifs", value: activeAgents.length, icon: Brain, color: "text-primary" },
          { label: "Exécutions totales", value: executionHistory.length, icon: Activity, color: "text-accent" },
          { label: "Réussi", value: executionHistory.filter(e => e.status === "success").length, icon: CheckCircle, color: "text-green-400" },
          { label: "En cours", value: executionHistory.filter(e => e.status === "running").length, icon: Loader2, color: "text-yellow-400" },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4">
              <Icon className={`h-4 w-4 ${k.color} mb-2`} />
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold text-foreground font-mono">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Main layout: agents + executor side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Agents list */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Agents Disponibles</h3>
          <div className="space-y-2">
            {activeAgents.map(agent => {
              const RoleIcon = ROLE_ICONS[agent.role] || Brain;
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RoleIcon className={`h-3.5 w-3.5 ${ROLE_COLORS[agent.role]}`} />
                    <span className="text-xs font-bold text-foreground">{agent.name}</span>
                    <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0">
                      {agent.total_executions || 0}x
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{agent.description}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(agent.skills || []).slice(0, 2).map(skill => (
                      <span key={skill} className="text-[8px] bg-secondary/50 text-muted-foreground px-1 py-0.5 rounded">
                        {skill.substring(0, 8)}
                      </span>
                    ))}
                    {(agent.skills || []).length > 2 && (
                      <span className="text-[8px] text-muted-foreground">+{agent.skills.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
            {activeAgents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun agent actif</p>
            )}
          </div>
        </div>

        {/* Executor panel */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">
              Exécuter une Tâche
            </h3>
            {selectedAgent ? (
              <>
                <div className="bg-secondary/40 rounded-lg p-3 mb-3 flex items-center gap-2">
                  <Zap className={`h-4 w-4 ${ROLE_COLORS[selectedAgent.role]}`} />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">{selectedAgent.name}</p>
                    <p className="text-muted-foreground">{selectedAgent.role}</p>
                  </div>
                </div>

                <textarea
                  placeholder="Décrivez la tâche à accomplir..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-24 p-3 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                />

                <Button
                  onClick={handleExecute}
                  disabled={executing || !prompt.trim()}
                  className="w-full mt-3 gap-2"
                >
                  {executing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Exécution en cours...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Exécuter
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="bg-secondary/30 rounded-lg p-8 text-center">
                <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Sélectionnez un agent pour commencer</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution log */}
      {executionHistory.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Historique des Exécutions</h3>
          <div className="space-y-2">
            {executionHistory.slice(0, 10).map((exec, i) => (
              <div key={exec.id || i} className={cn(
                "border rounded-lg p-3 text-xs",
                exec.status === "success" ? "border-green-500/20 bg-green-500/5" :
                exec.status === "running" ? "border-accent/20 bg-accent/5" :
                exec.status === "failed" ? "border-red-500/20 bg-red-500/5" :
                "border-border bg-secondary/20"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{exec.agent_name}</p>
                    <p className="text-muted-foreground line-clamp-1 mt-0.5">{exec.prompt}</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[9px] shrink-0",
                    exec.status === "success" ? "border-green-500/30 text-green-400" :
                    exec.status === "running" ? "border-accent/30 text-accent" :
                    "border-red-500/30 text-red-400"
                  )}>
                    {exec.status === "success" ? <CheckCircle className="h-3 w-3 mr-1" /> :
                     exec.status === "running" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> :
                     <AlertTriangle className="h-3 w-3 mr-1" />}
                    {exec.status}
                  </Badge>
                </div>
                {exec.execution_time_ms && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ⏱ {(exec.execution_time_ms / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}