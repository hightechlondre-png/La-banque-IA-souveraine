import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BarChart2, TrendingUp, Activity, Layers, Loader2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, AreaChart, Area
} from "recharts";

const FACTION_COLORS = { FactionA: "#3b82f6", FactionB: "#f59e0b", FactionC: "#10b981", FactionD: "#8b5cf6" };
const LEVEL_COLORS   = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"];
const EVENT_COLORS   = { events_up: "#10b981", events_down: "#ef4444", events_prune: "#f97316", events_tier: "#3b82f6" };
const EVENT_LABELS   = { events_up: "Résonance ↑", events_down: "Résonance ↓", events_prune: "Élagage", events_tier: "Tier Change" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{EVENT_LABELS[p.dataKey] ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">
            {typeof p.value === "number" && p.value <= 1 ? `${(p.value*100).toFixed(0)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default function AnalyticsReports() {
  const [factionView, setFactionView] = useState("line");

  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: ["faction-resonance"],
    queryFn: () => base44.entities.FactionResonance.list("week_index", 20),
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ["memory-nodes"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 50),
  });

  // Map backend fields → chart format
  const factionData = rawRows.map((r) => ({
    week: r.week,
    FactionA: r.faction_a,
    FactionB: r.faction_b,
    FactionC: r.faction_c,
    FactionD: r.faction_d,
  }));

  const levelData = rawRows.map((r) => ({
    week: r.week,
    L0: r.level_l0, L1: r.level_l1, L2: r.level_l2, L3: r.level_l3, L4: r.level_l4,
  }));

  const eventData = rawRows.map((r) => ({
    week: r.week,
    events_up: r.events_up,
    events_down: r.events_down,
    events_prune: r.events_prune,
    events_tier: r.events_tier,
  }));

  // Snapshot par niveau fractal depuis les nœuds réels
  const levelSnapshot = [0,1,2,3,4].map((lvl) => {
    const lvlNodes = nodes.filter((n) => n.fractal_level === lvl);
    const avg = lvlNodes.length ? lvlNodes.reduce((s,n)=>s+n.resonance,0)/lvlNodes.length : 0;
    return { level: `L${lvl}`, resonance: avg, nodes: lvlNodes.length, color: LEVEL_COLORS[lvl] };
  });

  // KPIs
  const latestRow = rawRows[rawRows.length - 1];
  const firstRow  = rawRows[0];
  const avgRes = nodes.length ? (nodes.reduce((s,n)=>s+n.resonance,0)/nodes.length*100).toFixed(0) : "—";
  const avgDelta = latestRow && firstRow
    ? `+${((((latestRow.faction_a+latestRow.faction_b+latestRow.faction_c+latestRow.faction_d)/4)
           - ((firstRow.faction_a+firstRow.faction_b+firstRow.faction_c+firstRow.faction_d)/4))*100).toFixed(0)}%`
    : "—";
  const totalPrune = rawRows.reduce((s,r)=>s+(r.events_prune||0),0);
  const sealed = nodes.filter((n)=>n.tier==="SEALED").length;

  const kpis = [
    { label: "Résonance Moy. (S0)",  value: `${avgRes}%`, change: avgDelta,       up: true  },
    { label: "Nœuds Actifs",         value: nodes.length,  change: `${nodes.filter(n=>n.tier==="ACTIVE").length} ACTIVE`, up: true },
    { label: "Élagages (8 sem.)",    value: totalPrune,    change: "total GC",    up: false },
    { label: "SEALED Nodes",         value: sealed,        change: "inviolables", up: null  },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Rapports Analytiques</h2>
          <p className="text-sm text-muted-foreground mt-1">N-MEM-B — Tendances résonance par faction et par niveau fractal</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Activity className="h-3 w-3 mr-1" />
          {rawRows.length} semaines · {rawRows[0]?.week} → {rawRows[rawRows.length-1]?.week}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{k.value}</p>
            <p className={cn("text-xs font-mono mt-1",
              k.up === true ? "text-green-400" : k.up === false ? "text-red-400" : "text-muted-foreground")}>
              {k.change}
            </p>
          </div>
        ))}
      </div>

      {/* Chart 1 : Faction resonance */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <SectionTitle icon={TrendingUp} title="Résonance Globale par Faction" subtitle="Évolution temporelle" />
          <div className="flex gap-1.5">
            {["line","area"].map((v) => (
              <button key={v} onClick={() => setFactionView(v)}
                className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                  factionView === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {v === "line" ? "Lignes" : "Aire"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {factionView === "line" ? (
              <LineChart data={factionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <YAxis domain={[0.3,0.85]} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`}
                  axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                {Object.entries(FACTION_COLORS).map(([f,c]) => (
                  <Line key={f} type="monotone" dataKey={f} stroke={c} strokeWidth={2} dot={{ r:3 }} />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={factionData}>
                <defs>
                  {Object.entries(FACTION_COLORS).map(([f,c]) => (
                    <linearGradient key={f} id={`grad-${f}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <YAxis domain={[0.3,0.85]} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`}
                  axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                {Object.entries(FACTION_COLORS).map(([f,c]) => (
                  <Area key={f} type="monotone" dataKey={f} stroke={c} strokeWidth={2} fill={`url(#grad-${f})`} />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts 2 + 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={Layers} title="Résonance par Niveau Fractal" subtitle="L0 → L4 évolution temporelle" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <YAxis domain={[0.2,1.0]} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`}
                  axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                {["L0","L1","L2","L3","L4"].map((l,i) => (
                  <Line key={l} type="monotone" dataKey={l} stroke={LEVEL_COLORS[i]}
                    strokeWidth={2} dot={false} strokeDasharray={i>2?"4 3":undefined} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={BarChart2} title="Snapshot Résonance — Actuel" subtitle="Distribution réelle des nœuds par niveau" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelSnapshot} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"hsl(215,20%,55%)" }} />
                <YAxis domain={[0,1]} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`}
                  axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="resonance" radius={[6,6,0,0]}
                  fill="#3b82f6"
                  label={{ position: "top", fontSize: 9, fill: "hsl(215,20%,55%)",
                    formatter: (v) => `${(v*100).toFixed(0)}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {levelSnapshot.map((l) => (
              <div key={l.level} className="flex items-center gap-1.5 text-[10px]">
                <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.level} — {l.nodes} nœuds</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 4 : événements empilés */}
      <div className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Activity} title="Volume d'Événements Mémoire" subtitle="Par type — historique complet" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={eventData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize:10, fill:"hsl(215,20%,55%)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }}
                formatter={(value) => EVENT_LABELS[value] ?? value} />
              {Object.entries(EVENT_COLORS).map(([key,color],i) => (
                <Bar key={key} dataKey={key} stackId="a" fill={color}
                  radius={i===3?[4,4,0,0]:undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}