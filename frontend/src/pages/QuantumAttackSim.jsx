import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap, Shield, RefreshCw, Play, Square, AlertTriangle,
  CheckCircle, Lock, Unlock, Activity, TrendingDown, TrendingUp, Clock
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── Constants ─────────────────────────────────────────────
const ATTACK_TYPES = {
  shor: {
    name: "Algorithme de Shor",
    target: "ECDSA / RSA",
    desc: "Factorise les clés publiques en temps polynomial sur ordinateur quantique. Brise ECDSA-256 en ~hours sur CRQC.",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    severity: "critical",
    baseDecay: 0.045,   // per tick
    mitigatedDecay: 0.004,
  },
  grover: {
    name: "Algorithme de Grover",
    target: "AES-128 / SHA-256",
    desc: "Réduit la sécurité par √N. AES-128 → sécurité effective 64 bits. SHA-256 → collision en O(2^128) au lieu de O(2^256).",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    severity: "high",
    baseDecay: 0.022,
    mitigatedDecay: 0.002,
  },
};

const CRYPTO_ALGOS = {
  ecdsa:      { name: "ECDSA-256",          quantum_safe: false, bits: 256,  color: "#ef4444", label: "Vulnérable (Shor)"   },
  rsa:        { name: "RSA-2048",           quantum_safe: false, bits: 2048, color: "#f97316", label: "Vulnérable (Shor)"   },
  aes128:     { name: "AES-128",            quantum_safe: false, bits: 128,  color: "#f59e0b", label: "Affaibli (Grover)"   },
  dilithium:  { name: "CRYSTALS-Dilithium", quantum_safe: true,  bits: 2528, color: "#10b981", label: "Résistant PQC ✓"     },
  falcon:     { name: "Falcon-512",         quantum_safe: true,  bits: 512,  color: "#3b82f6", label: "Résistant PQC ✓"     },
  kyber:      { name: "CRYSTALS-Kyber",     quantum_safe: true,  bits: 3168, color: "#8b5cf6", label: "Résistant PQC ✓"     },
};

const INITIAL_NODES = [
  { id: "n0",  label: "GovernanceCore",    algo: "ecdsa",     migrated: false, resilience: 1.0, critical: true  },
  { id: "n1",  label: "TokenVault",        algo: "rsa",       migrated: false, resilience: 1.0, critical: true  },
  { id: "n2",  label: "BurnMechanism",     algo: "aes128",    migrated: false, resilience: 1.0, critical: false },
  { id: "n3",  label: "StakingPool",       algo: "ecdsa",     migrated: false, resilience: 1.0, critical: false },
  { id: "n4",  label: "ResonanceOracle",   algo: "rsa",       migrated: false, resilience: 1.0, critical: true  },
  { id: "n5",  label: "MemoryRegistry",    algo: "aes128",    migrated: false, resilience: 1.0, critical: false },
  { id: "n6",  label: "MultiSigWallet",    algo: "dilithium", migrated: true,  resilience: 1.0, critical: true  },
  { id: "n7",  label: "AuditTrailLedger",  algo: "falcon",    migrated: true,  resilience: 1.0, critical: false },
  { id: "n8",  label: "FractalSentinel",   algo: "kyber",     migrated: true,  resilience: 1.0, critical: false },
];

const TICK_MS = 600;

// ── Helpers ───────────────────────────────────────────────
function computeNetworkResilience(nodes) {
  const avg = nodes.reduce((s, n) => s + n.resilience, 0) / nodes.length;
  return parseFloat((avg * 100).toFixed(1));
}

function computeMigrationProgress(nodes) {
  const migrated = nodes.filter(n => CRYPTO_ALGOS[n.algo].quantum_safe).length;
  return Math.round((migrated / nodes.length) * 100);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">
            {typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────
export default function QuantumAttackSim() {
  const [attackType, setAttackType] = useState("shor");
  const [nodes, setNodes] = useState(INITIAL_NODES.map(n => ({ ...n })));
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [qubits, setQubits] = useState(4096);   // simulated CRQC qubits
  const intervalRef = useRef(null);

  const attack = ATTACK_TYPES[attackType];

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setNodes(INITIAL_NODES.map(n => ({ ...n })));
    setHistory([]);
    setEvents([]);
    setTick(0);
  }, []);

  const migrateNode = (nodeId) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      return { ...n, algo: "dilithium", migrated: true };
    }));
    const node = nodes.find(n => n.id === nodeId);
    addEvent("migration", `✓ ${node?.label} migré vers CRYSTALS-Dilithium`, "text-green-400");
  };

  const migrateAll = () => {
    setNodes(prev => prev.map(n => ({
      ...n,
      algo: CRYPTO_ALGOS[n.algo].quantum_safe ? n.algo : "dilithium",
      migrated: true,
    })));
    addEvent("migration", "✓ Migration globale CRYSTALS-Dilithium activée", "text-green-400");
  };

  const addEvent = (type, msg, color) => {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents(prev => [{ ts, type, msg, color }, ...prev].slice(0, 30));
  };

  // Simulation tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setTick(t => t + 1);
      setNodes(prev => {
        const cfg = ATTACK_TYPES[attackType];
        const qubitFactor = Math.min(1, qubits / 10000);
        return prev.map(n => {
          const algoInfo = CRYPTO_ALGOS[n.algo];
          const decay = algoInfo.quantum_safe
            ? cfg.mitigatedDecay * 0.2
            : cfg.baseDecay * qubitFactor * (attackType === "shor" && n.algo === "aes128" ? 0.4 : 1);
          const newRes = Math.max(0, n.resilience - decay * (0.7 + Math.random() * 0.6));
          return { ...n, resilience: parseFloat(newRes.toFixed(4)) };
        });
      });
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [running, attackType, qubits]);

  // Record history + events
  useEffect(() => {
    if (tick === 0) return;
    const netRes = computeNetworkResilience(nodes);
    const migPct = computeMigrationProgress(nodes);
    const vulnAvg = nodes.filter(n => !CRYPTO_ALGOS[n.algo].quantum_safe)
      .reduce((s, n) => s + n.resilience, 0) /
      Math.max(1, nodes.filter(n => !CRYPTO_ALGOS[n.algo].quantum_safe).length) * 100;
    const safeAvg = nodes.filter(n => CRYPTO_ALGOS[n.algo].quantum_safe)
      .reduce((s, n) => s + n.resilience, 0) /
      Math.max(1, nodes.filter(n => CRYPTO_ALGOS[n.algo].quantum_safe).length) * 100;

    setHistory(h => [...h, {
      tick: `T+${tick * (TICK_MS / 1000)}s`,
      réseau: netRes,
      vulnérable: parseFloat(vulnAvg.toFixed(1)),
      "PQC protégé": parseFloat(safeAvg.toFixed(1)),
      migration: migPct,
    }].slice(-40));

    // Auto-events
    nodes.forEach(n => {
      if (n.resilience < 0.5 && n.resilience > 0.48 && !CRYPTO_ALGOS[n.algo].quantum_safe) {
        addEvent("alert", `⚠ ${n.label} : résilience critique (${(n.resilience * 100).toFixed(0)}%)`, "text-red-400");
      }
      if (n.resilience < 0.01 && !CRYPTO_ALGOS[n.algo].quantum_safe) {
        addEvent("breach", `💀 ${n.label} COMPROMIS — clé cryptographique exposée`, "text-red-500");
      }
    });
  }, [tick]);

  const netResilience = computeNetworkResilience(nodes);
  const migPct = computeMigrationProgress(nodes);
  const compromised = nodes.filter(n => n.resilience < 0.05 && !CRYPTO_ALGOS[n.algo].quantum_safe).length;
  const atRisk = nodes.filter(n => n.resilience < 0.5 && !CRYPTO_ALGOS[n.algo].quantum_safe).length;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Simulation Attaques Quantiques</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Shor · Grover · Résilience réseau · Migration CRYSTALS-Dilithium temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compromised > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />{compromised} nœud{compromised > 1 ? "s" : ""} compromis
            </Badge>
          )}
          <Button variant="outline" onClick={reset} disabled={running}>
            <RefreshCw className="h-4 w-4 mr-2" />Reset
          </Button>
          <Button
            onClick={() => { setRunning(r => !r); if (!running) addEvent("sim", `▶ Attaque ${attack.name} démarrée (${qubits.toLocaleString()} qubits)`, "text-orange-400"); else addEvent("sim", "■ Simulation arrêtée", "text-muted-foreground"); }}
            className={cn(running ? "bg-red-600 hover:bg-red-700" : "")}>
            {running ? <Square className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Stopper l'attaque" : "Lancer l'attaque"}
          </Button>
        </div>
      </div>

      {/* Attack config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attack selector */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Type d'Attaque</p>
          {Object.entries(ATTACK_TYPES).map(([key, a]) => (
            <button key={key} onClick={() => { setAttackType(key); if (!running) reset(); }}
              disabled={running}
              className={cn("w-full text-left p-3 rounded-xl border transition-all",
                attackType === key ? a.bg : "bg-secondary/30 border-border hover:border-muted-foreground",
                running && "opacity-60 cursor-not-allowed")}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className={cn("h-4 w-4", attackType === key ? a.color : "text-muted-foreground")} />
                <span className={cn("text-sm font-bold", attackType === key ? a.color : "text-foreground")}>{a.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1">Cible : {a.target}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{a.desc}</p>
            </button>
          ))}

          {/* Qubit slider */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <span className="text-[11px] text-muted-foreground">Puissance CRQC (qubits)</span>
              <span className="text-[11px] font-mono font-bold text-red-400">{qubits.toLocaleString()}</span>
            </div>
            <div className="relative h-2 bg-secondary rounded-full">
              <div className="absolute h-full rounded-full bg-red-500/40 rounded-full"
                style={{ width: `${(qubits / 20000) * 100}%` }} />
              <input type="range" min={1000} max={20000} step={500} value={qubits}
                onChange={e => setQubits(+e.target.value)} disabled={running}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="absolute h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-card shadow top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `calc(${(qubits / 20000) * 100}% - 7px)` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1K (actuel 2026)</span><span>10K (horizon 2028)</span><span>20K (CRQC)</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          {[
            { label: "Résilience Réseau",  value: `${netResilience}%`,  icon: Activity,    color: netResilience > 70 ? "text-green-400" : netResilience > 40 ? "text-orange-400" : "text-red-400" },
            { label: "Migration PQC",      value: `${migPct}%`,          icon: Shield,      color: migPct > 70 ? "text-green-400" : "text-accent" },
            { label: "Nœuds Compromis",   value: compromised,            icon: Unlock,      color: compromised > 0 ? "text-red-400" : "text-green-400" },
            { label: "À Risque (<50%)",   value: atRisk,                 icon: AlertTriangle, color: atRisk > 0 ? "text-orange-400" : "text-green-400" },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4">
              <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
            </div>
          ))}

          {/* Algo legend */}
          <div className="col-span-2 sm:col-span-4 bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-bold text-foreground mb-3">Algorithmes Cryptographiques</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CRYPTO_ALGOS).map(([k, a]) => (
                <div key={k} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono",
                  a.quantum_safe ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20")}>
                  <div className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  <span className={a.quantum_safe ? "text-green-400" : "text-red-400"}>{a.name}</span>
                  {a.quantum_safe ? <Lock className="h-2.5 w-2.5 text-green-400" /> : <Unlock className="h-2.5 w-2.5 text-red-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Node resilience grid */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Résilience des Nœuds en Temps Réel</h3>
          </div>
          <Button size="sm" onClick={migrateAll} variant="outline"
            className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs">
            <Shield className="h-3.5 w-3.5 mr-1.5" />Migration Globale → Dilithium
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {nodes.map(n => {
            const algo = CRYPTO_ALGOS[n.algo];
            const resPct = n.resilience * 100;
            const isCompromised = resPct < 5;
            const isAtRisk = resPct < 50 && !algo.quantum_safe;
            return (
              <div key={n.id} className={cn("border rounded-xl p-4 transition-all",
                isCompromised ? "border-red-500/60 bg-red-500/10" :
                isAtRisk ? "border-orange-500/30 bg-orange-500/5" :
                algo.quantum_safe ? "border-green-500/20 bg-green-500/5" : "border-border")}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-foreground">{n.label}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: algo.color }} />
                      <p className="text-[10px] font-mono" style={{ color: algo.color }}>{algo.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {n.critical && <Badge variant="outline" className="text-[9px] border-accent/30 text-accent px-1">CRITICAL</Badge>}
                    {algo.quantum_safe
                      ? <Lock className="h-3.5 w-3.5 text-green-400" />
                      : <Unlock className="h-3.5 w-3.5 text-red-400" />}
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Résilience</span>
                    <span className={cn("font-mono font-bold",
                      isCompromised ? "text-red-400" : isAtRisk ? "text-orange-400" : "text-green-400")}>
                      {resPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${resPct}%`,
                        background: isCompromised ? "#ef4444" : isAtRisk ? "#f97316" : algo.quantum_safe ? "#10b981" : "#3b82f6",
                      }} />
                  </div>
                </div>

                {isCompromised ? (
                  <p className="text-[10px] text-red-400 font-bold">💀 COMPROMIS</p>
                ) : !algo.quantum_safe ? (
                  <button onClick={() => migrateNode(n.id)}
                    className="text-[10px] text-green-400 hover:text-green-300 font-semibold transition-colors flex items-center gap-1">
                    <Shield className="h-3 w-3" />Migrer vers Dilithium
                  </button>
                ) : (
                  <p className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />{algo.label}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resilience timeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-bold text-foreground">Évolution Résilience sous Attaque</h3>
          </div>
          {history.length < 2 ? (
            <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">
              Lancez l'attaque pour visualiser l'évolution…
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="tick" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval={4} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={50} stroke="#f97316" strokeDasharray="4 3" strokeOpacity={0.7} label={{ value: "Seuil danger", position: "right", fontSize: 8, fill: "#f97316" }} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.7} label={{ value: "Compromis", position: "right", fontSize: 8, fill: "#ef4444" }} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="réseau" stroke="#3b82f6" strokeWidth={2} dot={false} name="Réseau global" />
                  <Line type="monotone" dataKey="vulnérable" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Nœuds vulnérables" />
                  <Line type="monotone" dataKey="PQC protégé" stroke="#10b981" strokeWidth={1.5} dot={false} name="Nœuds PQC" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Migration progress */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-bold text-foreground">Progression Migration PQC</h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nodes.map(n => ({
                name: n.label.replace(/([A-Z])/g, ' $1').trim().slice(0, 12),
                resilience: parseFloat((n.resilience * 100).toFixed(1)),
                status: CRYPTO_ALGOS[n.algo].quantum_safe ? 1 : 0,
              }))} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={50} stroke="#f97316" strokeDasharray="4 3" strokeOpacity={0.6} />
                <Bar dataKey="resilience" name="Résilience" radius={[4, 4, 0, 0]}>
                  {nodes.map(n => (
                    <rect key={n.id} fill={
                      CRYPTO_ALGOS[n.algo].quantum_safe ? "#10b981" :
                      n.resilience < 0.05 ? "#ef4444" : n.resilience < 0.5 ? "#f97316" : "#3b82f6"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Migration status + event log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PQC comparison */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Comparaison Algorithmes — Résistance Quantique</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(CRYPTO_ALGOS).map(([k, a]) => {
              const nodeCount = nodes.filter(n => n.algo === k).length;
              const avgRes = nodes.filter(n => n.algo === k).length
                ? nodes.filter(n => n.algo === k).reduce((s, n) => s + n.resilience, 0) /
                  nodes.filter(n => n.algo === k).length * 100
                : 100;
              return (
                <div key={k} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                  <div className="w-36 shrink-0">
                    <p className="text-[11px] font-mono font-bold text-foreground">{a.name}</p>
                    <p className={cn("text-[9px]", a.quantum_safe ? "text-green-400" : "text-red-400")}>{a.label}</p>
                  </div>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${avgRes}%`, background: a.color, opacity: 0.8 }} />
                  </div>
                  <span className="text-[10px] font-mono text-foreground w-10 text-right">{avgRes.toFixed(0)}%</span>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">{nodeCount} nœud{nodeCount > 1 ? "s" : ""}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progression migration globale</span>
              <span className={cn("font-mono font-bold", migPct > 70 ? "text-green-400" : "text-accent")}>{migPct}%</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden mt-2">
              <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${migPct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>{nodes.filter(n => CRYPTO_ALGOS[n.algo].quantum_safe).length} nœuds protégés</span>
              <span>{nodes.filter(n => !CRYPTO_ALGOS[n.algo].quantum_safe).length} nœuds vulnérables</span>
            </div>
          </div>
        </div>

        {/* Event log */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Journal d'Événements</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">{events.length} événements</Badge>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-72 min-h-[120px]">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Lancez une simulation pour voir les événements…
              </p>
            ) : events.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] bg-secondary/30 rounded-lg px-3 py-2">
                <span className="text-muted-foreground font-mono shrink-0">{e.ts}</span>
                <span className={cn("leading-relaxed", e.color)}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Educational banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Zap, color: "text-red-400", bg: "bg-red-500/10", title: "Algorithme de Shor", body: "Tourne en O(log³N) sur CRQC. Brise ECDSA et RSA en factorisant leur groupe cyclique. Un CRQC à 4000 qubits logiques suffira (horizon 2028–2032)." },
          { icon: Zap, color: "text-orange-400", bg: "bg-orange-500/10", title: "Algorithme de Grover", body: "Accélération quadratique √N. AES-256 requis pour remplacer AES-128. SHA-256 reste viable mais SHA-512 recommandé pour les signatures." },
          { icon: Shield, color: "text-green-400", bg: "bg-green-500/10", title: "CRYSTALS-Dilithium", body: "Standard NIST PQC 2024. Basé sur les réseaux euclidiens (lattice). Résistant à Shor et Grover. Clé publique : 1312 octets, signature : 2420 octets." },
        ].map(b => (
          <div key={b.title} className="flex items-start gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", b.bg)}>
              <b.icon className={cn("h-4 w-4", b.color)} />
            </div>
            <div>
              <p className={cn("text-xs font-bold mb-1", b.color)}>{b.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{b.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}