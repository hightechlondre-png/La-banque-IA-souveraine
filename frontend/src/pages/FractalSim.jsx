import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Pause, Zap, Brain, Activity, Layers } from "lucide-react";

// ── Default simulation parameters ────────────────────────
const DEFAULT_PARAMS = {
  resonanceRate:    0.72,   // 0 → 1
  recursionDepth:   3,      // 1 → 5
  memoryDecay:      0.18,   // 0 → 1
  propagationSpeed: 0.55,   // 0 → 1
  emotionWeight:    0.45,   // 0 → 1
  pruningThreshold: 0.25,   // 0 → 1
  nodeCount:        60,     // 10 → 120
  linkDensity:      0.28,   // 0 → 1
};

const LEVEL_COLORS = [0xf59e0b, 0x3b82f6, 0x10b981, 0x8b5cf6, 0xef4444];
const TIER_OPACITY = { 0: 1.0, 1: 0.85, 2: 0.70, 3: 0.55, 4: 0.40 };

// ── Build graph from params ───────────────────────────────
function buildGraph(params) {
  const { nodeCount, recursionDepth, linkDensity } = params;
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    level: Math.floor(Math.random() * (recursionDepth + 1)),
    resonance: 0.2 + Math.random() * 0.8,
    tier: Math.floor(Math.random() * 5),
    x: (Math.random() - 0.5) * 80,
    y: (Math.random() - 0.5) * 80,
    z: (Math.random() - 0.5) * 80,
  }));

  const edges = [];
  const maxEdges = Math.floor(nodeCount * linkDensity * 3);
  for (let i = 0; i < maxEdges; i++) {
    const a = Math.floor(Math.random() * nodeCount);
    const b = Math.floor(Math.random() * nodeCount);
    if (a !== b) edges.push({ a, b, weight: 0.2 + Math.random() * 0.8 });
  }
  return { nodes, edges };
}

// ── Slider control ────────────────────────────────────────
function Slider({ label, value, min, max, step = 0.01, onChange, format, color = "text-primary" }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn("text-[11px] font-mono font-bold", color)}>{format ? format(value) : value}</span>
      </div>
      <div className="relative h-2 bg-secondary rounded-full">
        <div className="absolute h-full rounded-full bg-primary/40" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-card shadow top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)` }} />
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-center">
      <p className={cn("text-sm font-bold font-mono", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function FractalSim() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const graphRef = useRef(null);
  const meshesRef = useRef({ nodes: [], edges: [] });
  const paramsRef = useRef(DEFAULT_PARAMS);
  const mouseRef = useRef({ down: false, x: 0, y: 0, rotX: 0.3, rotY: 0.5 });
  const autoRotRef = useRef(true);
  const tickRef = useRef(0);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, activeNodes: 0, avgResonance: 0, prunedPct: 0 });

  // Keep ref in sync
  useEffect(() => { paramsRef.current = params; }, [params]);

  const set = useCallback((key, val) => setParams(p => ({ ...p, [key]: val })), []);

  // ── Three.js setup ──────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d1a);
    scene.fog = new THREE.Fog(0x060d1a, 100, 220);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
    camera.position.set(0, 0, 140);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pt = new THREE.PointLight(0x3b82f6, 2, 200);
    pt.position.set(50, 50, 50);
    scene.add(pt);
    const pt2 = new THREE.PointLight(0xf59e0b, 1.5, 150);
    pt2.position.set(-50, -50, -30);
    scene.add(pt2);

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(160, 16, 0x1e293b, 0x0f172a);
    grid.rotation.x = Math.PI / 6;
    scene.add(grid);

    // Mouse drag
    const onDown = (e) => { mouseRef.current.down = true; mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; autoRotRef.current = false; };
    const onUp   = () => { mouseRef.current.down = false; };
    const onMove = (e) => {
      if (!mouseRef.current.down) return;
      mouseRef.current.rotY += (e.clientX - mouseRef.current.x) * 0.005;
      mouseRef.current.rotX += (e.clientY - mouseRef.current.y) * 0.005;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const onWheel = (e) => { camera.position.z = Math.max(50, Math.min(250, camera.position.z + e.deltaY * 0.2)); };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("wheel", onWheel, { passive: true });

    // Resize
    const ro = new ResizeObserver(() => {
      const W2 = el.clientWidth, H2 = el.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(frameRef.current);
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // ── Build / rebuild graph meshes ───────────────────────
  const buildScene = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old meshes
    meshesRef.current.nodes.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    meshesRef.current.edges.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    meshesRef.current = { nodes: [], edges: [] };

    const p = paramsRef.current;
    const graph = buildGraph(p);
    graphRef.current = graph;

    // Nodes
    graph.nodes.forEach((n) => {
      const r = 1.2 + n.resonance * p.resonanceRate * 3;
      const geo = new THREE.SphereGeometry(r, 12, 8);
      const color = LEVEL_COLORS[n.level % LEVEL_COLORS.length];
      const mat = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: TIER_OPACITY[n.tier] * (n.resonance > p.pruningThreshold ? 1 : 0.2),
        emissive: color,
        emissiveIntensity: n.resonance * p.resonanceRate * 0.6,
        shininess: 80,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(n.x, n.y, n.z);
      mesh.userData = n;
      scene.add(mesh);
      meshesRef.current.nodes.push(mesh);
    });

    // Edges
    graph.edges.forEach((e) => {
      const na = graph.nodes[e.a], nb = graph.nodes[e.b];
      const points = [new THREE.Vector3(na.x, na.y, na.z), new THREE.Vector3(nb.x, nb.y, nb.z)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: e.weight * p.linkDensity * 0.6,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      meshesRef.current.edges.push(line);
    });

    // Stats
    const active = graph.nodes.filter(n => n.resonance > p.pruningThreshold).length;
    const avgRes = (graph.nodes.reduce((s, n) => s + n.resonance, 0) / graph.nodes.length);
    const pruned = graph.nodes.filter(n => n.resonance <= p.pruningThreshold).length;
    setStats({
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      activeNodes: active,
      avgResonance: (avgRes * 100).toFixed(0),
      prunedPct: ((pruned / graph.nodes.length) * 100).toFixed(0),
    });
  }, []);

  // Rebuild when structural params change
  useEffect(() => {
    buildScene();
  }, [params.nodeCount, params.recursionDepth, params.linkDensity, buildScene]);

  // ── Animation loop ────────────────────────────────────
  useEffect(() => {
    let run = true;
    const animate = () => {
      if (!run) return;
      frameRef.current = requestAnimationFrame(animate);
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      const p = paramsRef.current;
      tickRef.current += 0.016;
      const t = tickRef.current;

      // Auto-rotate
      if (autoRotRef.current) {
        mouseRef.current.rotY += 0.003;
      }

      // Apply camera orbit
      const dist = cameraRef.current.position.z;
      cameraRef.current.position.x = dist * Math.sin(mouseRef.current.rotY) * Math.cos(mouseRef.current.rotX);
      cameraRef.current.position.y = dist * Math.sin(mouseRef.current.rotX);
      cameraRef.current.position.z = dist * Math.cos(mouseRef.current.rotY) * Math.cos(mouseRef.current.rotX);
      cameraRef.current.lookAt(0, 0, 0);

      // Animate node resonance
      if (running) {
        meshesRef.current.nodes.forEach((mesh, i) => {
          const n = mesh.userData;
          const wave = Math.sin(t * p.propagationSpeed * 2 + i * 0.4 + n.level * 0.8);
          const decayed = n.resonance * Math.exp(-p.memoryDecay * 0.01 * t);
          const eff = Math.max(0.05, Math.min(1, decayed + wave * 0.08 * p.emotionWeight));
          const r = 1.2 + eff * p.resonanceRate * 3;
          mesh.scale.setScalar(r / (1.2 + n.resonance * p.resonanceRate * 3));
          mesh.material.emissiveIntensity = eff * p.resonanceRate * 0.7;
          mesh.material.opacity = TIER_OPACITY[n.tier] * (eff > p.pruningThreshold ? 1 : 0.15);
          // Pulse glow on high resonance
          if (eff > 0.8) {
            mesh.material.emissiveIntensity = 0.8 + Math.sin(t * 4 + i) * 0.2;
          }
        });

        // Animate edges
        meshesRef.current.edges.forEach((line, i) => {
          const pulse = 0.3 + Math.sin(t * p.propagationSpeed * 3 + i * 0.6) * 0.2;
          line.material.opacity = pulse * p.linkDensity * 0.7;
        });
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();
    return () => { run = false; cancelAnimationFrame(frameRef.current); };
  }, [running]);

  const reset = () => {
    setParams(DEFAULT_PARAMS);
    paramsRef.current = DEFAULT_PARAMS;
    buildScene();
    autoRotRef.current = true;
    mouseRef.current.rotX = 0.3;
    mouseRef.current.rotY = 0.5;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] space-y-0 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Simulation Fractale 3D</h2>
          <p className="text-sm text-muted-foreground mt-1">Propagation N-MEM-B — Visualisation interactive en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", running ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted/30 text-muted-foreground border-border")}>
            <span className={cn("h-1.5 w-1.5 rounded-full inline-block mr-1.5", running ? "bg-green-500 animate-pulse" : "bg-muted-foreground")} />
            {running ? "LIVE" : "PAUSE"}
          </Badge>
          <button onClick={() => setRunning(r => !r)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Pause" : "Reprendre"}
          </button>
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Reset
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <StatPill label="Nœuds"        value={stats.nodes}         color="text-primary"   />
        <StatPill label="Liens"         value={stats.edges}         color="text-accent"    />
        <StatPill label="Nœuds Actifs" value={stats.activeNodes}   color="text-green-400" />
        <StatPill label="Rés. Moy."    value={`${stats.avgResonance}%`} color="text-chart-4" />
        <StatPill label="Élagués"      value={`${stats.prunedPct}%`}    color="text-red-400" />
      </div>

      {/* Main layout: 3D canvas + controls */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* 3D Viewport */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-border relative bg-[#060d1a]">
          <div ref={mountRef} className="w-full h-full" style={{ minHeight: 400 }} />

          {/* Overlay legend */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
            {["L0 — Événement Brut", "L1 — Relation", "L2 — Cluster", "L3 — Branche", "L4 — Stratégique"].map((l, i) => (
              <div key={l} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: `#${LEVEL_COLORS[i].toString(16).padStart(6, "0")}` }} />
                <span className="text-[9px] text-slate-400 font-mono">{l}</span>
              </div>
            ))}
          </div>

          {/* Drag hint */}
          <div className="absolute top-3 right-3 text-[9px] text-slate-500 font-mono bg-black/40 px-2 py-1 rounded">
            Drag pour orbiter · Scroll pour zoom
          </div>
        </div>

        {/* Control panel */}
        <div className="w-64 shrink-0 bg-card border border-border rounded-xl p-4 space-y-4 overflow-y-auto">

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-bold text-foreground">Résonance</p>
            </div>
            <div className="space-y-3">
              <Slider label="Taux de résonance" value={params.resonanceRate}
                min={0} max={1} onChange={v => set("resonanceRate", v)}
                format={v => `${(v * 100).toFixed(0)}%`} color="text-primary" />
              <Slider label="Poids émotionnel" value={params.emotionWeight}
                min={0} max={1} onChange={v => set("emotionWeight", v)}
                format={v => `${(v * 100).toFixed(0)}%`} color="text-chart-5" />
              <Slider label="Seuil d'élagage" value={params.pruningThreshold}
                min={0} max={0.9} onChange={v => set("pruningThreshold", v)}
                format={v => `${(v * 100).toFixed(0)}%`} color="text-red-400" />
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-3.5 w-3.5 text-accent" />
              <p className="text-xs font-bold text-foreground">Architecture Fractale</p>
            </div>
            <div className="space-y-3">
              <Slider label="Profondeur récursive" value={params.recursionDepth}
                min={1} max={5} step={1} onChange={v => set("recursionDepth", v)}
                format={v => `L0 → L${v}`} color="text-accent" />
              <Slider label="Nombre de nœuds" value={params.nodeCount}
                min={10} max={120} step={5} onChange={v => set("nodeCount", v)}
                format={v => v} color="text-chart-2" />
              <Slider label="Densité des liens" value={params.linkDensity}
                min={0.05} max={1} onChange={v => set("linkDensity", v)}
                format={v => `${(v * 100).toFixed(0)}%`} color="text-chart-4" />
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-3.5 w-3.5 text-chart-2" />
              <p className="text-xs font-bold text-foreground">Propagation</p>
            </div>
            <div className="space-y-3">
              <Slider label="Vitesse de propagation" value={params.propagationSpeed}
                min={0} max={1} onChange={v => set("propagationSpeed", v)}
                format={v => `×${(v * 2).toFixed(1)}`} color="text-chart-2" />
              <Slider label="Decay mémoire" value={params.memoryDecay}
                min={0} max={1} onChange={v => set("memoryDecay", v)}
                format={v => `${(v * 100).toFixed(0)}%/s`} color="text-orange-400" />
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          {/* Presets */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Préréglages</p>
            <div className="space-y-1.5">
              {[
                { label: "Calme",        icon: "🟢", params: { resonanceRate: 0.3, propagationSpeed: 0.2, memoryDecay: 0.05, pruningThreshold: 0.1,  nodeCount: 40,  recursionDepth: 2, linkDensity: 0.2 } },
                { label: "Normal",       icon: "🔵", params: DEFAULT_PARAMS },
                { label: "Turbulent",    icon: "🟡", params: { resonanceRate: 0.85, propagationSpeed: 0.9, memoryDecay: 0.4,  pruningThreshold: 0.35, nodeCount: 80,  recursionDepth: 4, linkDensity: 0.5 } },
                { label: "Crise Totale", icon: "🔴", params: { resonanceRate: 1.0,  propagationSpeed: 1.0, memoryDecay: 0.9,  pruningThreshold: 0.6,  nodeCount: 110, recursionDepth: 5, linkDensity: 0.9 } },
              ].map((preset) => (
                <button key={preset.label} onClick={() => setParams(p => ({ ...p, ...preset.params }))}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors text-left">
                  <span>{preset.icon}</span>
                  <span className="font-semibold">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Formulae */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Formules Actives</p>
            <p className="text-[10px] font-mono text-accent">decay = {(0.95 - (params.recursionDepth - 1) * 0.10).toFixed(2)}</p>
            <p className="text-[10px] font-mono text-primary">threshold = {(0.05 + (params.recursionDepth - 1) * 0.10).toFixed(2)}</p>
            <p className="text-[10px] font-mono text-orange-400">k = {(0.02 * params.recursionDepth * params.memoryDecay).toFixed(4)}</p>
            <p className="text-[10px] font-mono text-chart-2">speed = ×{(params.propagationSpeed * 2).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}