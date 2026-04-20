import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle, Loader2,
  RefreshCw, Zap, Lock, Activity, FileSearch, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ── Contracts registry ────────────────────────────────────
const CONTRACTS = [
  { id: "c1", name: "GovernanceCore.sol",    cluster: "L4-StratCore",   lines: 1243, version: "0.8.20", deployed: "2026-01-12" },
  { id: "c2", name: "TokenVault.sol",         cluster: "L3-Finance",     lines: 892,  version: "0.8.20", deployed: "2026-01-12" },
  { id: "c3", name: "BurnMechanism.sol",      cluster: "L2-Tokenomics",  lines: 445,  version: "0.8.20", deployed: "2026-01-14" },
  { id: "c4", name: "StakingPool.sol",        cluster: "L2-Tokenomics",  lines: 534,  version: "0.8.20", deployed: "2026-02-01" },
  { id: "c5", name: "ResonanceOracle.sol",    cluster: "L3-Finance",     lines: 312,  version: "0.8.20", deployed: "2026-01-18" },
  { id: "c6", name: "MemoryRegistry.sol",     cluster: "L4-StratCore",   lines: 678,  version: "0.8.20", deployed: "2026-01-20" },
  { id: "c7", name: "FractalSentinel.sol",    cluster: "L1-Infra",       lines: 290,  version: "0.8.20", deployed: "2026-02-10" },
  { id: "c8", name: "MultiSigWallet.sol",     cluster: "L1-Infra",       lines: 410,  version: "0.8.20", deployed: "2026-01-30" },
];

// ── Vulnerability definitions ─────────────────────────────
const VULN_TYPES = {
  reentrancy: {
    label: "Reentrancy",
    color: "#ef4444",
    desc: "Appel externe avant mise à jour de l'état — risque de drain de fonds.",
    check: (c) => c.name.includes("Vault") || c.name.includes("Staking") || c.name.includes("Burn"),
  },
  overflow: {
    label: "Integer Overflow",
    color: "#f97316",
    desc: "Dépassement de capacité uint256 dans les calculs de supply ou de reward.",
    check: (c) => c.lines > 500,
  },
  access_control: {
    label: "Access Control",
    color: "#f59e0b",
    desc: "Fonctions admin non protégées par onlyRole ou modifier approprié.",
    check: (c) => c.name.includes("Governance") || c.name.includes("Oracle"),
  },
  quantum: {
    label: "Menace Post-Quantique",
    color: "#8b5cf6",
    desc: "Algorithme ECDSA/RSA vulnérable à l'algorithme de Shor sur CRQC.",
    check: (c) => !c.name.includes("Sentinel") && !c.name.includes("MultiSig"),
  },
  gas_griefing: {
    label: "Gas Griefing",
    color: "#3b82f6",
    desc: "Boucles non bornées ou patterns susceptibles de bloquer le block gas limit.",
    check: (c) => c.name.includes("Registry") || c.name.includes("Staking"),
  },
  front_running: {
    label: "Front-Running / MEV",
    color: "#22d3ee",
    desc: "Transactions visibles dans le mempool avant confirmation — sandwich attack.",
    check: (c) => c.name.includes("Oracle") || c.name.includes("Governance"),
  },
};

const SEVERITY = {
  reentrancy:     "critical",
  quantum:        "critical",
  access_control: "high",
  overflow:       "high",
  front_running:  "medium",
  gas_griefing:   "low",
};

const SEV_CFG = {
  critical: { label: "Critique", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"       },
  high:     { label: "Élevée",   color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium:   { label: "Moyenne",  color: "text-accent",     bg: "bg-accent/10 border-accent/30"         },
  low:      { label: "Faible",   color: "text-primary",    bg: "bg-primary/10 border-primary/20"       },
  safe:     { label: "Sûr",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20"   },
};

const CLUSTERS = ["L1-Infra", "L2-Tokenomics", "L3-Finance", "L4-StratCore"];
const CLUSTER_COLORS = { "L1-Infra": "#10b981", "L2-Tokenomics": "#f59e0b", "L3-Finance": "#3b82f6", "L4-StratCore": "#8b5cf6" };

// ── Scan engine (deterministic + noise) ──────────────────
function runScan(contract, tick) {
  const noise = Math.sin(tick * 0.3 + contract.id.charCodeAt(1)) * 0.08;
  const vulns = Object.entries(VULN_TYPES)
    .filter(([k, v]) => v.check(contract))
    .map(([k]) => ({ type: k, severity: SEVERITY[k] }));

  const baseScore = Math.max(20, 100 - vulns.length * 14 + Math.round(noise * 10));
  return { vulns, score: Math.min(100, baseScore) };
}

function overallScore(results) {
  if (!results.length) return 0;
  return Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
}

function clusterScore(cluster, results) {
  const ids = CONTRACTS.filter(c => c.cluster === cluster).map(c => c.id);
  const rs  = results.filter(r => ids.includes(r.id));
  return rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0;
}

function scoreColor(s) {
  if (s >= 80) return "text-green-400";
  if (s >= 60) return "text-accent";
  if (s >= 40) return "text-orange-400";
  return "text-red-400";
}
function scoreBarColor(s) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#f59e0b";
  if (s >= 40) return "#f97316";
  return "#ef4444";
}

// ── Contract row ─────────────────────────────────────────
function ContractRow({ contract, result, scanning }) {
  const [open, setOpen] = useState(false);
  const critCount = result?.vulns.filter(v => SEVERITY[v.type] === "critical").length ?? 0;

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all",
      critCount > 0 ? "border-red-500/30" : "border-border")}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-secondary/10 transition-colors flex items-center gap-4">

        {/* Status dot */}
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0",
          scanning ? "bg-accent animate-pulse" :
          !result ? "bg-muted-foreground" :
          critCount > 0 ? "bg-red-500" : result.score >= 80 ? "bg-green-500" : "bg-orange-500")} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-bold text-foreground">{contract.name}</span>
            <Badge variant="outline" className="text-[9px]"
              style={{ borderColor: CLUSTER_COLORS[contract.cluster] + "55", color: CLUSTER_COLORS[contract.cluster] }}>
              {contract.cluster}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{contract.lines} lignes</span>
          </div>
        </div>

        {scanning ? (
          <div className="flex items-center gap-1.5 text-[10px] text-accent shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" />Scan…
          </div>
        ) : result ? (
          <div className="flex items-center gap-3 shrink-0">
            {result.vulns.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <span className="text-[10px] text-red-400 font-mono font-bold">{result.vulns.length} vuln.</span>
            )}
            <span className={cn("text-lg font-black font-mono", scoreColor(result.score))}>{result.score}</span>
            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${result.score}%`, background: scoreBarColor(result.score) }} />
            </div>
          </div>
        ) : null}

        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
               : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && result && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ["Version",  contract.version],
              ["Déployé",  contract.deployed],
              ["Lignes",   contract.lines],
              ["Score",    `${result.score}/100`],
            ].map(([k,v]) => (
              <div key={k} className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{k}</p>
                <p className="font-mono text-foreground">{v}</p>
              </div>
            ))}
          </div>

          {result.vulns.length === 0 ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">Aucune vulnérabilité détectée</span>
            </div>
          ) : (
            <div className="space-y-2">
              {result.vulns.map(v => {
                const sev = SEV_CFG[v.severity];
                const def = VULN_TYPES[v.type];
                return (
                  <div key={v.type} className={cn("border rounded-lg px-3 py-2.5", sev.bg)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn("text-xs font-bold", sev.color)}>{def.label}</span>
                      <Badge variant="outline" className={cn("text-[9px]", sev.bg, sev.color)}>{sev.label}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{def.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function SmartContractAudit() {
  const [results, setResults]     = useState({});     // { contractId: { score, vulns } }
  const [scanning, setScanning]   = useState({});     // { contractId: bool }
  const [tick, setTick]           = useState(0);
  const [autoScan, setAutoScan]   = useState(true);
  const [filter, setFilter]       = useState("all");
  const [events, setEvents]       = useState([]);
  const intervalRef               = useRef(null);

  const addEvent = (msg, color) => {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents(e => [{ ts, msg, color }, ...e].slice(0, 20));
  };

  const scanContract = (contract, t) => {
    setScanning(s => ({ ...s, [contract.id]: true }));
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const res = runScan(contract, t ?? tick);
      setResults(r => ({ ...r, [contract.id]: res }));
      setScanning(s => ({ ...s, [contract.id]: false }));
      const critical = res.vulns.filter(v => SEVERITY[v.type] === "critical").length;
      if (critical > 0)
        addEvent(`⚠ ${contract.name} — ${critical} vuln. critique${critical > 1 ? "s" : ""} détectée${critical > 1 ? "s" : ""}`, "text-red-400");
      else if (res.vulns.length === 0)
        addEvent(`✓ ${contract.name} — Aucune vulnérabilité`, "text-green-400");
      else
        addEvent(`⚡ ${contract.name} — ${res.vulns.length} vulnérabilité${res.vulns.length > 1 ? "s" : ""} détectée${res.vulns.length > 1 ? "s" : ""}`, "text-accent");
    }, delay);
  };

  const runFullScan = () => {
    const t = tick + 1;
    setTick(t);
    CONTRACTS.forEach((c, i) => setTimeout(() => scanContract(c, t), i * 300));
    addEvent("▶ Scan complet lancé sur 8 contrats…", "text-primary");
  };

  // Initial scan + auto-refresh
  useEffect(() => {
    runFullScan();
  }, []);

  useEffect(() => {
    if (autoScan) {
      intervalRef.current = setInterval(() => {
        const t = Date.now();
        setTick(t);
        // Scan one random contract per cycle
        const c = CONTRACTS[Math.floor(Math.random() * CONTRACTS.length)];
        scanContract(c, t);
      }, 8000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoScan, tick]);

  // Computed
  const allResults  = CONTRACTS.map(c => ({ ...c, result: results[c.id] }));
  const readyCount  = Object.keys(results).length;
  const globalScore = overallScore(Object.entries(results).map(([id, r]) => ({ ...r, id })));
  const totalVulns  = Object.values(results).reduce((s, r) => s + r.vulns.length, 0);
  const critVulns   = Object.values(results).reduce((s, r) => s + r.vulns.filter(v => SEVERITY[v.type] === "critical").length, 0);

  const clusterData = CLUSTERS.map(cl => ({
    cluster: cl.replace("L", "L").replace("-", " "),
    score:   clusterScore(cl, Object.entries(results).map(([id, r]) => ({ ...r, id }))),
    color:   CLUSTER_COLORS[cl],
  }));

  const vulnFreq = Object.entries(VULN_TYPES).map(([k, v]) => ({
    name:  v.label,
    count: Object.values(results).filter(r => r.vulns.some(x => x.type === k)).length,
    color: v.color,
  })).sort((a, b) => b.count - a.count);

  const radarData = Object.entries(VULN_TYPES).map(([k, v]) => ({
    subject: v.label.replace(" Post-Quantique", " PQ").replace("Integer ", ""),
    risk: Object.values(results).filter(r => r.vulns.some(x => x.type === k)).length,
    fullMark: CONTRACTS.length,
  }));

  const filtered = filter === "all" ? allResults
    : filter === "critical" ? allResults.filter(r => r.result?.vulns.some(v => SEVERITY[v.type] === "critical"))
    : filter === "safe"     ? allResults.filter(r => r.result?.vulns.length === 0)
    : allResults.filter(r => r.result && r.result.score < 80 && !r.result.vulns.some(v => SEVERITY[v.type] === "critical"));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-foreground font-mono">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Audit Automatique — Smart Contracts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scanner temps réel · Reentrancy · Overflow · Menaces Post-Quantiques · Scores par cluster
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoScan(a => !a)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
              autoScan ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-secondary border-border text-muted-foreground")}>
            <Activity className="h-3.5 w-3.5" />
            {autoScan ? "Auto-scan ON" : "Auto-scan OFF"}
          </button>
          <Button onClick={runFullScan}>
            <RefreshCw className="h-4 w-4 mr-2" />Scanner tout
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Score Sécurité Global", value: readyCount > 0 ? `${globalScore}/100` : "—", icon: ShieldCheck, color: scoreColor(globalScore) },
          { label: "Contrats analysés",     value: `${readyCount}/${CONTRACTS.length}`,          icon: FileSearch,  color: "text-primary"        },
          { label: "Vulnérabilités totales",value: totalVulns,                                   icon: AlertTriangle,color: totalVulns > 0 ? "text-orange-400" : "text-green-400" },
          { label: "Critiques ouvertes",    value: critVulns,                                    icon: XCircle,     color: critVulns > 0 ? "text-red-400" : "text-green-400"     },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Cluster scores + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cluster bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Score de Sécurité par Cluster</h3>
          </div>
          <div className="space-y-4">
            {clusterData.map(c => (
              <div key={c.cluster}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono font-bold" style={{ color: CLUSTER_COLORS[CLUSTERS.find(cl => cl.replace("-", " ").replace("L", "L") === c.cluster || cl.split("-")[0] + " " + cl.split("-")[1] === c.cluster) ?? CLUSTERS[0]] || c.color }}>{c.cluster}</span>
                  <span className={cn("font-mono font-bold", scoreColor(c.score))}>{c.score}/100</span>
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${c.score}%`, background: scoreBarColor(c.score) }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clusterData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="cluster" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Score" radius={[4,4,0,0]}>
                  {clusterData.map((c, i) => (
                    <Cell key={i} fill={scoreBarColor(c.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Carte des Risques — Types de Vulnérabilités</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(222,30%,16%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Radar name="Contrats affectés" dataKey="risk"
                  stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Vuln frequency */}
          <div className="flex flex-wrap gap-2 mt-2">
            {vulnFreq.map(v => (
              <div key={v.name} className="flex items-center gap-1.5 text-[9px]">
                <div className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                <span className="text-muted-foreground">{v.name} ({v.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contract list */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-foreground">Contrats Analysés ({CONTRACTS.length})</h3>
          <div className="flex gap-1.5">
            {[
              { key: "all",      label: `Tous (${CONTRACTS.length})` },
              { key: "critical", label: `Critique (${allResults.filter(r => r.result?.vulns.some(v => SEVERITY[v.type] === "critical")).length})` },
              { key: "risk",     label: "À risque" },
              { key: "safe",     label: `Sûrs (${allResults.filter(r => r.result?.vulns.length === 0).length})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map(item => (
            <ContractRow
              key={item.id}
              contract={item}
              result={item.result}
              scanning={!!scanning[item.id]}
            />
          ))}
        </div>
      </div>

      {/* Event log */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Journal d'Audit Temps Réel</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">{events.length} événements</Badge>
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">Scan en cours…</p>
          ) : events.map((e, i) => (
            <div key={i} className="flex items-start gap-3 text-[10px] bg-secondary/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground font-mono shrink-0">{e.ts}</span>
              <span className={cn("leading-relaxed", e.color)}>{e.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}