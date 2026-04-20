import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  FileDown, Loader2, CheckCircle, XCircle, Activity, Cpu, Star, Clock,
} from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono text-foreground ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function exportPDF({ agentExecs, skillExecs, agentStats, skillStats, dateRange }) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // ── Cover Page ──────────────────────────────────────────
  doc.setFillColor(8, 15, 36);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(26, 42, 80);
  doc.rect(0, 0, 210, 60, "F");

  doc.setTextColor(96, 165, 250);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("AEGIS-Q — RAPPORT EXÉCUTIF IA", 15, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Rapport de Performance", 15, 35);
  doc.setFontSize(14);
  doc.text("Agents & Skills Autonomes", 15, 45);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10);
  doc.text(`Généré le ${now}`, 15, 56);

  // ── Summary KPIs ───────────────────────────────────────
  let y = 75;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé Exécutif", 15, y);
  y += 10;

  const kpis = [
    ["Exécutions d'agents", agentExecs.length],
    ["Taux de succès (agents)", `${agentStats.successRate}%`],
    ["Tests de skills", skillExecs.length],
    ["Taux de succès (skills)", `${skillStats.successRate}%`],
    ["Temps moyen agents", `${agentStats.avgTime}ms`],
    ["Tokens consommés", agentStats.totalTokens.toLocaleString()],
  ];

  kpis.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? 15 : 110;
    const row = y + Math.floor(i / 2) * 14;
    doc.setFillColor(26, 42, 80);
    doc.roundedRect(col, row - 6, 85, 12, 2, 2, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, col + 4, row);
    doc.setTextColor(96, 165, 250);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(value), col + 4, row + 5);
  });

  y += Math.ceil(kpis.length / 2) * 14 + 12;

  // ── Agent Executions Table ─────────────────────────────
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Historique des Exécutions d'Agents", 15, y);
  y += 8;

  // Table headers
  doc.setFillColor(37, 56, 100);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Agent", 17, y + 5);
  doc.text("Prompt", 65, y + 5);
  doc.text("Statut", 140, y + 5);
  doc.text("Profondeur", 165, y + 5);
  y += 9;

  const agentRows = agentExecs.slice(0, 15);
  agentRows.forEach((exec, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFillColor(i % 2 === 0 ? 15 : 20, i % 2 === 0 ? 23 : 28, i % 2 === 0 ? 42 : 50);
    doc.rect(15, y - 2, 180, 8, "F");
    doc.setTextColor(200, 210, 230);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text((exec.agent_name || "—").substring(0, 18), 17, y + 3);
    doc.text((exec.prompt || "").substring(0, 35), 65, y + 3);
    const statusColor = exec.status === "success" ? [74, 222, 128] : exec.status === "failed" ? [248, 113, 113] : [250, 204, 21];
    doc.setTextColor(...statusColor);
    doc.text(exec.status || "—", 140, y + 3);
    doc.setTextColor(200, 210, 230);
    doc.text(String(exec.depth || 1), 168, y + 3);
    y += 8;
  });

  if (agentExecs.length > 15) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text(`... et ${agentExecs.length - 15} autres exécutions`, 17, y + 4);
    y += 10;
  }

  y += 8;

  // ── Skill Executions Table ─────────────────────────────
  if (y > 240) { doc.addPage(); y = 20; }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Historique des Tests de Skills", 15, y);
  y += 8;

  doc.setFillColor(37, 56, 100);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Skill", 17, y + 5);
  doc.text("Input", 70, y + 5);
  doc.text("Statut", 150, y + 5);
  doc.text("Temps (ms)", 167, y + 5);
  y += 9;

  const skillRows = skillExecs.slice(0, 15);
  skillRows.forEach((exec, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFillColor(i % 2 === 0 ? 15 : 20, i % 2 === 0 ? 23 : 28, i % 2 === 0 ? 42 : 50);
    doc.rect(15, y - 2, 180, 8, "F");
    doc.setTextColor(200, 210, 230);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text((exec.skill_name || "—").substring(0, 20), 17, y + 3);
    doc.text((exec.test_input || "").substring(0, 40), 70, y + 3);
    const statusColor = exec.status === "success" ? [74, 222, 128] : [248, 113, 113];
    doc.setTextColor(...statusColor);
    doc.text(exec.status || "—", 150, y + 3);
    doc.setTextColor(200, 210, 230);
    doc.text(String(exec.execution_time_ms || "—"), 170, y + 3);
    y += 8;
  });

  // ── Footer on all pages ────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 287, 210, 10, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`AEGIS-Q Performance Report — ${now} — Page ${i}/${pages}`, 15, 293);
    doc.text("CONFIDENTIEL — Administrateurs uniquement", 140, 293);
  }

  doc.save(`AEGIS-Q_Agent_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AgentReports() {
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState("7d");

  const { data: agentExecs = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agent-executions"],
    queryFn: () => base44.entities.AgentExecution.list("-created_date", 200),
  });

  const { data: skillExecs = [], isLoading: loadingSkills } = useQuery({
    queryKey: ["skill-executions-report"],
    queryFn: () => base44.entities.SkillExecution.list("-created_date", 200),
  });

  const isLoading = loadingAgents || loadingSkills;

  // Filter by date range
  const filterByDate = (items) => {
    const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86400000);
    return items.filter((e) => new Date(e.created_date) >= since);
  };

  const filteredAgents = filterByDate(agentExecs);
  const filteredSkills = filterByDate(skillExecs);

  // Agent stats
  const agentStats = useMemo(() => {
    const success = filteredAgents.filter((e) => e.status === "success").length;
    const avgTime = filteredAgents.filter((e) => e.execution_time_ms).length
      ? Math.round(filteredAgents.reduce((s, e) => s + (e.execution_time_ms || 0), 0) / filteredAgents.filter((e) => e.execution_time_ms).length)
      : 0;
    const totalTokens = filteredAgents.reduce((s, e) => s + (e.tokens_used || 0), 0);
    return {
      successRate: filteredAgents.length ? ((success / filteredAgents.length) * 100).toFixed(1) : "0",
      avgTime,
      totalTokens,
      success,
      failed: filteredAgents.filter((e) => e.status === "failed").length,
    };
  }, [filteredAgents]);

  // Skill stats
  const skillStats = useMemo(() => {
    const success = filteredSkills.filter((e) => e.status === "success").length;
    const avgTime = filteredSkills.filter((e) => e.execution_time_ms).length
      ? Math.round(filteredSkills.reduce((s, e) => s + (e.execution_time_ms || 0), 0) / filteredSkills.filter((e) => e.execution_time_ms).length)
      : 0;
    return {
      successRate: filteredSkills.length ? ((success / filteredSkills.length) * 100).toFixed(1) : "0",
      avgTime,
      success,
      failed: filteredSkills.filter((e) => e.status === "failed").length,
    };
  }, [filteredSkills]);

  // Daily bar chart data
  const dailyData = useMemo(() => {
    const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 30;
    return Array.from({ length: Math.min(days, 14) }, (_, i) => {
      const date = new Date(Date.now() - (Math.min(days, 14) - 1 - i) * 86400000);
      const label = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      const agentDay = filteredAgents.filter((e) => {
        const d = new Date(e.created_date);
        return d >= dayStart && d <= dayEnd;
      });
      const skillDay = filteredSkills.filter((e) => {
        const d = new Date(e.created_date);
        return d >= dayStart && d <= dayEnd;
      });
      return {
        label,
        agents: agentDay.length,
        skills: skillDay.length,
        successes: agentDay.filter((e) => e.status === "success").length,
      };
    });
  }, [filteredAgents, filteredSkills, dateFilter]);

  // Agent by name chart
  const agentByName = useMemo(() => {
    const map = {};
    filteredAgents.forEach((e) => {
      if (!map[e.agent_name]) map[e.agent_name] = { name: e.agent_name, total: 0, success: 0 };
      map[e.agent_name].total++;
      if (e.status === "success") map[e.agent_name].success++;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((a) => ({ ...a, rate: a.total ? ((a.success / a.total) * 100).toFixed(0) : 0 }));
  }, [filteredAgents]);

  // Skill by name chart
  const skillByName = useMemo(() => {
    const map = {};
    filteredSkills.forEach((e) => {
      if (!map[e.skill_name]) map[e.skill_name] = { name: e.skill_name, total: 0, success: 0 };
      map[e.skill_name].total++;
      if (e.status === "success") map[e.skill_name].success++;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredSkills]);

  // Pie data
  const agentPieData = [
    { name: "Succès", value: agentStats.success, color: "#10b981" },
    { name: "Échecs", value: agentStats.failed, color: "#ef4444" },
    { name: "En cours", value: filteredAgents.filter((e) => e.status === "running" || e.status === "pending").length, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const handleExport = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 300));
    exportPDF({
      agentExecs: filteredAgents,
      skillExecs: filteredSkills,
      agentStats,
      skillStats,
      dateRange: dateFilter,
    });
    setExporting(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Rapports de Performance IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse des exécutions agents & skills — Export PDF institutionnel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
            {["7d", "30d", "90d"].map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  dateFilter === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Génération...</>
            ) : (
              <><FileDown className="h-4 w-4" />Exporter PDF</>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Exécutions agents", value: filteredAgents.length, icon: Cpu, color: "text-primary" },
              { label: "Taux succès agents", value: `${agentStats.successRate}%`, icon: CheckCircle, color: "text-green-400" },
              { label: "Tests skills", value: filteredSkills.length, icon: Star, color: "text-accent" },
              { label: "Taux succès skills", value: `${skillStats.successRate}%`, icon: Activity, color: "text-chart-2" },
            ].map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Daily activity + Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Activité Journalière</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    <Bar dataKey="agents" name="Agents" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="skills" name="Skills" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Statuts Agents</h3>
              {agentPieData.length > 0 ? (
                <>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={agentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                          {agentPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {agentPieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-mono text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
                  Aucune donnée
                </div>
              )}
            </div>
          </div>

          {/* Agents by name + Skills by name */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Performance par Agent</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentByName} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="success" name="Succès" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} opacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Performance par Skill</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skillByName} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="success" name="Succès" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" name="Total" fill="#8b5cf6" radius={[0, 4, 4, 0]} opacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent executions table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">
                Historique Récent — Exécutions Agents
              </h3>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                {filteredAgents.length} entrées
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-semibold">Agent</th>
                    <th className="text-left pb-2 font-semibold">Prompt</th>
                    <th className="text-left pb-2 font-semibold">Statut</th>
                    <th className="text-left pb-2 font-semibold">Profondeur</th>
                    <th className="text-left pb-2 font-semibold">Tokens</th>
                    <th className="text-left pb-2 font-semibold">Temps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredAgents.slice(0, 10).map((exec, i) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-2 font-semibold text-foreground">{exec.agent_name}</td>
                      <td className="py-2 text-muted-foreground max-w-48 truncate">{exec.prompt}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px]",
                            exec.status === "success"
                              ? "border-green-500/20 text-green-400"
                              : exec.status === "failed"
                              ? "border-red-500/20 text-red-400"
                              : "border-accent/20 text-accent"
                          )}
                        >
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="py-2 font-mono text-muted-foreground">L{exec.depth || 1}</td>
                      <td className="py-2 font-mono text-muted-foreground">{exec.tokens_used || "—"}</td>
                      <td className="py-2 font-mono text-muted-foreground">
                        {exec.execution_time_ms ? `${exec.execution_time_ms}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAgents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Aucune exécution dans cette période
                </p>
              )}
            </div>
          </div>

          {/* Additional info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Tokens agents", value: agentStats.totalTokens.toLocaleString(), color: "text-primary" },
              { label: "Temps moy. agents", value: `${agentStats.avgTime}ms`, color: "text-accent" },
              { label: "Temps moy. skills", value: `${skillStats.avgTime}ms`, color: "text-chart-2" },
              { label: "Profondeur moy.", value: filteredAgents.length ? (filteredAgents.reduce((s, e) => s + (e.depth || 1), 0) / filteredAgents.length).toFixed(1) : "—", color: "text-chart-4" },
            ].map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className={`text-base font-bold font-mono mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}