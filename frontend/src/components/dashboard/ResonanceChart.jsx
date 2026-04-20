import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const MAX_POINTS = 20;

const TIER_COLORS = {
  SEALED: "#ef4444",
  DEEP: "#8b5cf6",
  ACTIVE: "#10b981",
  SHORT_TERM: "#3b82f6",
  DORMANT: "#64748b",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground truncate max-w-[120px]">{p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">{(p.value * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function ResonanceChart() {
  const [series, setSeries] = useState([]);   // [{time, [concept]: resonance}]
  const [tracked, setTracked] = useState({}); // { node_id: { concept, color } }

  useEffect(() => {
    // Initial load — top 5 nodes by resonance
    base44.entities.MemoryNode.list("-resonance", 5).then((nodes) => {
      const map = {};
      nodes.forEach((n) => { map[n.node_id] = { concept: n.concept, tier: n.tier }; });
      setTracked(map);

      const point = { time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
      nodes.forEach((n) => { point[n.concept] = n.resonance; });
      setSeries([point]);
    });
  }, []);

  useEffect(() => {
    const unsub = base44.entities.MemoryNode.subscribe((event) => {
      if (event.type !== "create" && event.type !== "update") return;
      const n = event.data;

      setTracked((prev) => {
        // Track top nodes (keep at most 6)
        const updated = { ...prev, [n.node_id]: { concept: n.concept, tier: n.tier } };
        return updated;
      });

      setSeries((prev) => {
        const point = {
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        // carry forward last values
        const last = prev[prev.length - 1] || {};
        Object.keys(last).forEach((k) => { if (k !== "time") point[k] = last[k]; });
        point[n.concept] = n.resonance;

        const next = [...prev, point];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    });
    return unsub;
  }, []);

  const concepts = [...new Set(Object.values(tracked).map((t) => t.concept))].slice(0, 6);
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#22d3ee"];

  return (
    <div className="bg-card border border-border rounded-xl p-5 col-span-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Résonance Temps Réel</h3>
          <p className="text-xs text-muted-foreground">Évolution historique des nœuds actifs — mise à jour automatique</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          LIVE
        </div>
      </div>

      {series.length < 2 ? (
        <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">
          En attente de données… (démarrez la Simulation ou attendez des événements réels)
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
              <XAxis dataKey="time" axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              {concepts.map((concept, i) => (
                <Line key={concept} type="monotone" dataKey={concept}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                  dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}