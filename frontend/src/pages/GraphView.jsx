import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ZoomIn, ZoomOut, X, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Edges statiques (relations entre nœuds) ───────────────
const EDGES = [
  { source: "n7",  target: "n0",  type: "CAUSES",          weight: 0.90 },
  { source: "n0",  target: "n1",  type: "INFLUENCES",      weight: 0.80 },
  { source: "n1",  target: "n2",  type: "INFLUENCES",      weight: 0.65 },
  { source: "n2",  target: "n3",  type: "CAUSES",          weight: 0.55 },
  { source: "n3",  target: "n4",  type: "INFLUENCES",      weight: 0.40 },
  { source: "n5",  target: "n6",  type: "EVOLVES_TO",      weight: 0.70 },
  { source: "n6",  target: "n11", type: "INHERITS",        weight: 0.45 },
  { source: "n7",  target: "n8",  type: "CAUSES",          weight: 0.85 },
  { source: "n8",  target: "n10", type: "INFLUENCES",      weight: 0.75 },
  { source: "n10", target: "n4",  type: "INFLUENCES",      weight: 0.35 },
  { source: "n9",  target: "n2",  type: "COOPERATES_WITH", weight: 0.50 },
  { source: "n12", target: "n8",  type: "INFLUENCES",      weight: 0.60 },
  { source: "n12", target: "n1",  type: "CONFLICTS_WITH",  weight: 0.70 },
  { source: "n13", target: "n4",  type: "INFLUENCES",      weight: 0.55 },
  { source: "n11", target: "n4",  type: "INHERITS",        weight: 0.50 },
  { source: "n0",  target: "n12", type: "INFLUENCES",      weight: 0.55 },
];

const levelColor = (l) => ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"][l] ?? "#64748b";
const tierOpacity = { SEALED: 1, DEEP: 0.9, ACTIVE: 0.8, SHORT_TERM: 0.65, DORMANT: 0.45 };
const edgeColor = {
  CAUSES: "#ef4444", INFLUENCES: "#3b82f6", EVOLVES_TO: "#10b981",
  INHERITS: "#8b5cf6", COOPERATES_WITH: "#22d3ee", CONFLICTS_WITH: "#f97316",
};

function initPositions(nodes, w, h) {
  return nodes.map((n) => ({
    ...n,
    x: w / 2 + (Math.random() - 0.5) * 400,
    y: h / 2 + (Math.random() - 0.5) * 300,
    vx: 0, vy: 0,
    r: 14 + n.resonance * 12,
  }));
}

function tick(positions, edges, w, h) {
  const next = positions.map((n) => ({ ...n }));
  const K = 80, REPEL = 4500, DAMP = 0.82, CENTER = 0.012;
  next.forEach((n) => { n.vx += (w/2 - n.x) * CENTER; n.vy += (h/2 - n.y) * CENTER; });
  for (let i = 0; i < next.length; i++) {
    for (let j = i+1; j < next.length; j++) {
      const dx = next[i].x - next[j].x || 0.01, dy = next[i].y - next[j].y || 0.01;
      const d2 = dx*dx + dy*dy, f = REPEL/d2, d = Math.sqrt(d2);
      next[i].vx += (dx/d)*f; next[i].vy += (dy/d)*f;
      next[j].vx -= (dx/d)*f; next[j].vy -= (dy/d)*f;
    }
  }
  const idxMap = {};
  next.forEach((n,i) => (idxMap[n.node_id] = i));
  edges.forEach(({ source, target, weight }) => {
    const si = idxMap[source], ti = idxMap[target];
    if (si === undefined || ti === undefined) return;
    const dx = next[ti].x - next[si].x, dy = next[ti].y - next[si].y;
    const d = Math.sqrt(dx*dx + dy*dy) || 1;
    const f = ((d - K*(1+(1-weight)))/d) * 0.04;
    next[si].vx += dx*f; next[si].vy += dy*f;
    next[ti].vx -= dx*f; next[ti].vy -= dy*f;
  });
  next.forEach((n) => {
    n.vx *= DAMP; n.vy *= DAMP;
    n.x = Math.max(n.r+10, Math.min(w-n.r-10, n.x+n.vx));
    n.y = Math.max(n.r+10, Math.min(h-n.r-10, n.y+n.vy));
  });
  return next;
}

export default function GraphView() {
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 580 });
  const [positions, setPositions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);
  const frameRef = useRef(null);
  const posRef = useRef(null);
  const runningRef = useRef(true);

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["memory-nodes"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 50),
  });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: Math.max(480, e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!nodes.length) return;
    const p = initPositions(nodes, dims.w, dims.h);
    posRef.current = p;
    setPositions(p);
  }, [nodes, dims.w, dims.h]);

  useEffect(() => {
    if (!posRef.current) return;
    runningRef.current = true;
    let iter = 0;
    const loop = () => {
      if (!runningRef.current) return;
      if (iter < 300) {
        posRef.current = tick(posRef.current, EDGES, dims.w, dims.h);
        setPositions([...posRef.current]);
        iter++;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { runningRef.current = false; cancelAnimationFrame(frameRef.current); };
  }, [nodes, dims]);

  const isolated = useCallback(() => {
    if (!selected) return null;
    const connected = new Set([selected]);
    EDGES.forEach(({ source, target }) => {
      if (source === selected) connected.add(target);
      if (target === selected) connected.add(source);
    });
    return connected;
  }, [selected]);

  const branch = isolated();

  const resetSim = () => {
    const p = initPositions(nodes, dims.w, dims.h);
    posRef.current = p;
    setPositions(p);
    setSelected(null);
    runningRef.current = true;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (!positions) return null;

  const idxMap = {};
  positions.forEach((n, i) => (idxMap[n.node_id] = i));

  const selectedNode = selected ? positions.find((n) => n.node_id === selected) : null;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Visualisation Graphe</h2>
          <p className="text-sm text-muted-foreground mt-1">N-MEM-B — Exploration interactive des nœuds fractals</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.min(z+0.2, 2.5))}
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z-0.2, 0.4))}
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={resetSim}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
          {selected && (
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs">
              <X className="h-3.5 w-3.5" /> Désélectionner
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[0,1,2,3,4].map((l) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ background: levelColor(l) }} />
            <span className="text-muted-foreground">L{l}</span>
          </div>
        ))}
        <div className="w-px bg-border mx-1" />
        {Object.entries(edgeColor).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 rounded" style={{ background: color }} />
            <span className="text-muted-foreground">{type.toLowerCase().replace(/_/g," ")}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden" style={{ height: dims.h }}>
          <svg ref={svgRef} width="100%" height="100%"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              if (e.target === svgRef.current)
                setDragging({ type: "pan", sx: e.clientX - pan.x, sy: e.clientY - pan.y });
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              if (dragging.type === "pan") {
                setPan({ x: e.clientX - dragging.sx, y: e.clientY - dragging.sy });
              } else if (dragging.type === "node") {
                const rect = svgRef.current.getBoundingClientRect();
                const nx = (e.clientX - rect.left - pan.x) / zoom;
                const ny = (e.clientY - rect.top - pan.y) / zoom;
                posRef.current = posRef.current.map((n) =>
                  n.node_id === dragging.id ? { ...n, x: nx, y: ny, vx: 0, vy: 0 } : n
                );
                setPositions([...posRef.current]);
              }
            }}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}>
            <defs>
              {Object.entries(edgeColor).map(([type, color]) => (
                <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.7" />
                </marker>
              ))}
            </defs>
            <rect width="100%" height="100%" fill="hsl(222,47%,5%)" />
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {EDGES.map((e, i) => {
                const si = idxMap[e.source], ti = idxMap[e.target];
                if (si === undefined || ti === undefined) return null;
                const sn = positions[si], tn = positions[ti];
                const isActive = !branch || (branch.has(e.source) && branch.has(e.target));
                const color = edgeColor[e.type] ?? "#64748b";
                const dx = tn.x-sn.x, dy = tn.y-sn.y, d = Math.sqrt(dx*dx+dy*dy)||1;
                const ex = tn.x-(dx/d)*(tn.r+2), ey = tn.y-(dy/d)*(tn.r+2);
                return (
                  <line key={i} x1={sn.x} y1={sn.y} x2={ex} y2={ey}
                    stroke={color} strokeWidth={e.weight*2.5}
                    strokeOpacity={isActive ? 0.65 : 0.08}
                    markerEnd={`url(#arrow-${e.type})`} />
                );
              })}
              {positions.map((n) => {
                const isSelected = selected === n.node_id;
                const inBranch = !branch || branch.has(n.node_id);
                const color = levelColor(n.fractal_level);
                const opacity = inBranch ? (tierOpacity[n.tier] ?? 0.7) : 0.1;
                return (
                  <g key={n.node_id} style={{ cursor: "pointer", opacity }}
                    onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: "node", id: n.node_id }); }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (dragging?.type === "node") setSelected(n.node_id === selected ? null : n.node_id);
                      setDragging(null);
                    }}>
                    {(isSelected || n.tier === "SEALED") && (
                      <circle cx={n.x} cy={n.y} r={n.r+8} fill={color} opacity={0.18} />
                    )}
                    <circle cx={n.x} cy={n.y} r={n.r} fill={color} fillOpacity={0.18}
                      stroke={color} strokeWidth={isSelected ? 3 : 1.5} />
                    <circle cx={n.x} cy={n.y} r={n.r * n.resonance} fill={color} fillOpacity={0.35} />
                    <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9} fontFamily="monospace" fill="white" fontWeight="bold">
                      L{n.fractal_level}
                    </text>
                    <text x={n.x} y={n.y+n.r+10} textAnchor="middle"
                      fontSize={9} fontFamily="sans-serif"
                      fill={inBranch ? "hsl(210,40%,80%)" : "transparent"}>
                      {n.concept.length > 16 ? n.concept.slice(0,15)+"…" : n.concept}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="w-64 shrink-0 space-y-3">
          {selectedNode ? (
            <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: levelColor(selectedNode.fractal_level) }} />
                <h4 className="text-sm font-bold text-foreground">{selectedNode.concept}</h4>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ["Type",      selectedNode.type],
                  ["Niveau",    `L${selectedNode.fractal_level}`],
                  ["Tier",      selectedNode.tier],
                  ["Résonance", `${(selectedNode.resonance*100).toFixed(0)}%`],
                  ["Émotion",   `${((selectedNode.emotion_weight??0)*100).toFixed(0)}%`],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Relations actives</p>
                <div className="space-y-1">
                  {EDGES.filter((e) => e.source === selected || e.target === selected).map((e, i) => {
                    const other = e.source === selected ? e.target : e.source;
                    const oNode = nodes.find((n) => n.node_id === other);
                    const dir = e.source === selected ? "→" : "←";
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">{dir}</span>
                        <span className="text-foreground truncate">{oNode?.concept}</span>
                        <div className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: edgeColor[e.type] }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Propagation decay</p>
                <p className="text-xs font-mono text-accent">{(0.95 - selectedNode.fractal_level * 0.10).toFixed(2)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Seuil propagation</p>
                <p className="text-xs font-mono text-primary">{(0.05 + selectedNode.fractal_level * 0.10).toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 text-center">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Cliquez sur un nœud pour isoler sa branche de propagation et voir ses métriques.</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Statistiques</h4>
            {[
              ["Nœuds totaux",   nodes.length],
              ["Relations",      EDGES.length],
              ["SEALED",         nodes.filter((n) => n.tier === "SEALED").length],
              ["Branche isolée", branch ? branch.size : "—"],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Niveaux Fractals</h4>
            {["Événement Brut","Relation Locale","Cluster Narratif","Branche de Monde","Mémoire Stratégique"].map((label, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: levelColor(i) }} />
                <span className="text-muted-foreground">L{i} — {label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}