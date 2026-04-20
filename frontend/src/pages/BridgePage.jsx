import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight, CheckCircle, Clock, XCircle, AlertTriangle,
  Copy, ExternalLink, ChevronDown, Loader2, Bell, BellOff,
  Zap, Shield, Activity, RefreshCw, Flame, TrendingUp, TrendingDown
} from "lucide-react";

// ── Chain config ──────────────────────────────────────────
const CHAINS = {
  aegis: {
    name: "AEGIS-Q Network",
    symbol: "AQ",
    logo: "⬡",
    color: "#3b82f6",
    bg: "bg-primary/10 border-primary/30",
    text: "text-primary",
    fee: 0.001,
    confirmations: 2,
    avgTime: 4,
    baseGas: 0.0001,
    gasUnit: "AQ",
  },
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    logo: "Ξ",
    color: "#8b5cf6",
    bg: "bg-chart-4/10 border-chart-4/30",
    text: "text-chart-4",
    fee: 0.0018,
    confirmations: 12,
    avgTime: 180,
    wrappedSymbol: "wAQ",
    baseGas: 22,
    gasUnit: "Gwei",
    standard: "ERC-20",
  },
  polygon: {
    name: "Polygon",
    symbol: "MATIC",
    logo: "⬟",
    color: "#8b5cf6",
    bg: "bg-chart-4/10 border-chart-4/30",
    text: "text-chart-4",
    fee: 0.0008,
    confirmations: 128,
    avgTime: 30,
    wrappedSymbol: "wAQ",
    baseGas: 80,
    gasUnit: "Gwei",
    standard: "ERC-20",
  },
  arbitrum: {
    name: "Arbitrum One",
    symbol: "ETH",
    logo: "🔵",
    color: "#22d3ee",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    text: "text-cyan-400",
    fee: 0.0005,
    confirmations: 1,
    avgTime: 10,
    wrappedSymbol: "wAQ",
    baseGas: 0.1,
    gasUnit: "Gwei",
    standard: "ERC-20",
  },
  bsc: {
    name: "BNB Chain",
    symbol: "BNB",
    logo: "🟡",
    color: "#f59e0b",
    bg: "bg-accent/10 border-accent/30",
    text: "text-accent",
    fee: 0.001,
    confirmations: 15,
    avgTime: 45,
    wrappedSymbol: "wAQ",
    baseGas: 3,
    gasUnit: "Gwei",
    standard: "BEP-20",
  },
  optimism: {
    name: "Optimism",
    symbol: "ETH",
    logo: "🔴",
    color: "#ef4444",
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-400",
    fee: 0.0006,
    confirmations: 1,
    avgTime: 8,
    wrappedSymbol: "wAQ",
    baseGas: 0.05,
    gasUnit: "Gwei",
    standard: "ERC-20",
  },
  base: {
    name: "Base",
    symbol: "ETH",
    logo: "🔷",
    color: "#3b82f6",
    bg: "bg-primary/10 border-primary/30",
    text: "text-primary",
    fee: 0.0004,
    confirmations: 1,
    avgTime: 6,
    wrappedSymbol: "wAQ",
    baseGas: 0.08,
    gasUnit: "Gwei",
    standard: "ERC-20",
  },
  solana: {
    name: "Solana",
    symbol: "SOL",
    logo: "◎",
    color: "#10b981",
    bg: "bg-chart-2/10 border-chart-2/30",
    text: "text-chart-2",
    fee: 0.00025,
    confirmations: 32,
    avgTime: 25,
    wrappedSymbol: "wAQ",
    baseGas: 0.000005,
    gasUnit: "SOL",
    standard: "SPL Token",
  },
};

const BRIDGE_RATES = {
  "aegis-ethereum": 1.0,
  "aegis-solana":   1.0,
  "ethereum-aegis": 1.0,
  "solana-aegis":   1.0,
};

// ── Simulate tx hash ──────────────────────────────────────
function fakeTxHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function fakeAddr() {
  return "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function fmt(n) { return parseFloat(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function fmtTime(s) { return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; }

// ── Status config ─────────────────────────────────────────
const STATUS = {
  pending:    { label: "En attente",   icon: Clock,         color: "text-accent",     bg: "bg-accent/10 border-accent/30",         dot: "bg-accent animate-pulse"  },
  confirming: { label: "Confirmation", icon: Activity,      color: "text-primary",    bg: "bg-primary/10 border-primary/30",       dot: "bg-primary animate-pulse" },
  bridging:   { label: "Bridging",     icon: ArrowLeftRight,color: "text-chart-4",   bg: "bg-chart-4/10 border-chart-4/30",       dot: "bg-chart-4 animate-pulse" },
  completed:  { label: "Complété",     icon: CheckCircle,   color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   dot: "bg-green-500"             },
  failed:     { label: "Échoué",       icon: XCircle,       color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       dot: "bg-red-500"               },
};

// ── TxCard ────────────────────────────────────────────────
function TxCard({ tx, onExpand, expanded }) {
  const st = STATUS[tx.status];
  const Icon = st.icon;
  const fromChain = CHAINS[tx.from];
  const toChain   = CHAINS[tx.to];
  const elapsed   = Math.floor((Date.now() - tx.startedAt) / 1000);

  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all", st.bg)}>
      <button onClick={() => onExpand(tx.id)} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status dot */}
          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", st.dot)} />

          {/* From → To */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{fromChain.logo}</span>
            <span className="text-xs font-mono text-muted-foreground">{fromChain.name.split(" ")[0]}</span>
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-lg">{toChain.logo}</span>
            <span className="text-xs font-mono text-muted-foreground">{toChain.name.split(" ")[0]}</span>
          </div>

          {/* Amount */}
          <span className="text-sm font-bold font-mono text-foreground">
            {fmt(tx.amount)} AQ
          </span>

          {/* Status badge */}
          <Badge variant="outline" className={cn("text-[9px] ml-auto shrink-0", st.color, "border-current/30")}>
            <Icon className="h-3 w-3 mr-1" />{st.label}
          </Badge>

          {/* Confirmations */}
          {tx.status === "confirming" && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {tx.confirmations}/{CHAINS[tx.from].confirmations} conf.
            </span>
          )}

          <span className="text-[9px] text-muted-foreground">{fmtTime(elapsed)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {/* Progress bar */}
          {tx.status !== "completed" && tx.status !== "failed" && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progression</span>
                <span>{Math.round(tx.progress)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${tx.progress}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-mono">
                <span>Verrou source</span><span>Confirmations</span><span>Mint destination</span>
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Source",      `${fromChain.logo} ${fromChain.name}`],
              ["Destination", `${toChain.logo} ${toChain.name}`],
              ["Montant",     `${fmt(tx.amount)} AQ`],
              ["Reçu",        `${fmt(tx.received)} ${toChain.wrappedSymbol ?? "AQ"}`],
              ["Frais bridge",`${fmt(tx.fee)} AQ`],
              ["Temps prévu", fmtTime(CHAINS[tx.from].avgTime)],
            ].map(([k, v]) => (
              <div key={k} className="bg-secondary/40 rounded-lg px-3 py-2">
                <p className="text-[9px] text-muted-foreground mb-0.5">{k}</p>
                <p className="font-mono text-foreground text-[11px]">{v}</p>
              </div>
            ))}
          </div>

          {/* Tx hashes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-24 shrink-0">Tx source</span>
              <code className="text-[10px] font-mono text-primary flex-1 truncate">{tx.txHashSrc}</code>
              <button onClick={() => navigator.clipboard.writeText(tx.txHashSrc)} className="text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
            </div>
            {tx.txHashDst && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24 shrink-0">Tx destination</span>
                <code className="text-[10px] font-mono text-chart-2 flex-1 truncate">{tx.txHashDst}</code>
                <button onClick={() => navigator.clipboard.writeText(tx.txHashDst)} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {tx.status === "completed" && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
              <span className="text-xs text-green-400 font-semibold">
                Bridge complété — {fmt(tx.received)} {toChain.wrappedSymbol ?? "AQ"} disponibles sur {toChain.name}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Gas tracker ──────────────────────────────────────────
function useGasTracker() {
  const [gas, setGas] = useState(() => {
    const init = {};
    Object.entries(CHAINS).forEach(([k, c]) => {
      init[k] = { slow: c.baseGas * 0.7, standard: c.baseGas, fast: c.baseGas * 1.4, trend: 0 };
    });
    return init;
  });

  useEffect(() => {
    const update = () => {
      setGas(prev => {
        const next = {};
        Object.entries(prev).forEach(([k, g]) => {
          const base = CHAINS[k].baseGas;
          const noise = (Math.random() - 0.48) * base * 0.3;
          const std = Math.max(base * 0.5, g.standard + noise);
          next[k] = {
            slow: parseFloat((std * 0.7).toFixed(4)),
            standard: parseFloat(std.toFixed(4)),
            fast: parseFloat((std * 1.5).toFixed(4)),
            trend: noise > 0 ? 1 : -1,
          };
        });
        return next;
      });
    };
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, []);

  return gas;
}

// ── Gas badge ─────────────────────────────────────────────
function GasBadge({ chainKey, gas }) {
  const chain = CHAINS[chainKey];
  const g = gas[chainKey];
  if (!g) return null;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <Flame className="h-3 w-3 text-orange-400" />
      <span className="text-muted-foreground">Gas:</span>
      <span className="text-green-400">{g.slow}</span>
      <span className="text-muted-foreground">/</span>
      <span className="text-accent">{g.standard}</span>
      <span className="text-muted-foreground">/</span>
      <span className="text-red-400">{g.fast}</span>
      <span className="text-muted-foreground">{chain.gasUnit}</span>
      {g.trend > 0
        ? <TrendingUp className="h-3 w-3 text-red-400" />
        : <TrendingDown className="h-3 w-3 text-green-400" />}
    </div>
  );
}

// ── Gas panel ─────────────────────────────────────────────
function GasPanel({ gas, selectedFrom, selectedTo }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-orange-400" />
        <h4 className="text-xs font-bold text-foreground">Frais de Gaz Temps Réel</h4>
        <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400 ml-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1" />
          Live
        </Badge>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-3 text-[9px] text-muted-foreground px-1 mb-1">
          <span>Réseau</span><span className="text-center">Standard</span><span className="text-right">Tendance</span>
        </div>
        {Object.entries(CHAINS).map(([k, c]) => {
          const g = gas[k];
          if (!g) return null;
          const isSelected = k === selectedFrom || k === selectedTo;
          return (
            <div key={k} className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
              isSelected ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"
            )}>
              <div className="flex items-center gap-2">
                <span className="text-base">{c.logo}</span>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">{c.name.split(" ")[0]}</p>
                  <div className="flex gap-1 text-[9px]">
                    <span className="text-green-400">{g.slow}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-accent">{g.standard}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-red-400">{g.fast}</span>
                    <span className="text-muted-foreground ml-0.5">{c.gasUnit}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {g.trend > 0
                  ? <TrendingUp className="h-3 w-3 text-red-400" />
                  : <TrendingDown className="h-3 w-3 text-green-400" />}
                {isSelected && <span className="text-[9px] text-primary ml-1">●</span>}
              </div>
            </div>
          );
        })}
        <p className="text-[9px] text-muted-foreground text-center pt-1">Lent / Standard / Rapide · Mise à jour toutes les 5s</p>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function BridgePage() {
  const [fromChain, setFromChain] = useState("aegis");
  const [toChain,   setToChain]   = useState("ethereum");
  const [amount,    setAmount]    = useState("");
  const [address,   setAddress]   = useState("");
  const [txList,    setTxList]    = useState([]);
  const [expanded,  setExpanded]  = useState(null);
  const [submitting,setSubmitting]= useState(false);
  const [notifs,    setNotifs]    = useState(true);
  const [alerts,    setAlerts]    = useState([]);
  const [gasSpeed,  setGasSpeed]  = useState("standard");
  const gas = useGasTracker();
  const tickRef = useRef(null);

  const fromC   = CHAINS[fromChain];
  const toC     = CHAINS[toChain];
  const rate    = BRIDGE_RATES[`${fromChain}-${toChain}`] ?? 1;
  const fee     = fromC.fee * (parseFloat(amount) || 0);
  const received = Math.max(0, (parseFloat(amount) || 0) - fee) * rate;
  const currentGas = gas[fromChain]?.[gasSpeed] ?? fromC.baseGas;
  const gasUSD = fromChain === "ethereum" ? (currentGas * 21000 * 0.000000001 * 2500).toFixed(4)
               : fromChain === "polygon"  ? (currentGas * 21000 * 0.000000001 * 0.8).toFixed(6)
               : fromChain === "bsc"      ? (currentGas * 21000 * 0.000000001 * 350).toFixed(5)
               : fromChain === "aegis"    ? (currentGas * 0.0085).toFixed(6)
               : (currentGas * 21000 * 0.000000001 * 2500).toFixed(6);

  // Swap chains
  const swap = () => { setFromChain(toChain); setToChain(fromChain); };

  // Disable same-chain select
  const chainOptions = Object.entries(CHAINS).filter(([k]) => k !== "aegis" || fromChain === "aegis");

  // Push alert
  const pushAlert = (msg, color = "text-green-400") => {
    const id = Date.now();
    setAlerts(a => [{ id, msg, color }, ...a].slice(0, 5));
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 6000);
  };

  // Simulate bridge tx progression
  const simulateTx = (tx) => {
    const totalMs = CHAINS[tx.from].avgTime * 1000;
    const step = 200;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += step;
      const pct = Math.min(100, (elapsed / totalMs) * 100);

      setTxList(prev => prev.map(t => {
        if (t.id !== tx.id) return t;

        let status = "confirming";
        let confirmations = Math.floor((pct / 100) * CHAINS[tx.from].confirmations);
        let progress = pct;
        let txHashDst = t.txHashDst;

        if (pct >= 60 && t.status !== "bridging" && t.status !== "completed") {
          status = "bridging";
          if (!txHashDst) txHashDst = fakeTxHash();
          if (notifs) pushAlert(`⚡ Bridge en cours — ${fmt(tx.amount)} AQ vers ${CHAINS[tx.to].name}`, "text-accent");
        } else if (pct < 60) {
          status = "confirming";
        }

        if (pct >= 100) {
          clearInterval(interval);
          if (notifs) pushAlert(`✓ Bridge complété — ${fmt(tx.received)} ${CHAINS[tx.to].wrappedSymbol ?? "AQ"} reçus sur ${CHAINS[tx.to].name}`, "text-green-400");
          return { ...t, status: "completed", progress: 100, confirmations: CHAINS[tx.from].confirmations, txHashDst };
        }

        return { ...t, status, progress, confirmations, txHashDst };
      }));
    }, step);

    return interval;
  };

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0 || !address) return;
    setSubmitting(true);

    setTimeout(() => {
      const tx = {
        id:           Date.now(),
        from:         fromChain,
        to:           toChain,
        amount:       parseFloat(amount),
        received:     received,
        fee:          fee,
        address:      address,
        status:       "confirming",
        confirmations:0,
        progress:     0,
        txHashSrc:    fakeTxHash(),
        txHashDst:    null,
        startedAt:    Date.now(),
      };
      setTxList(prev => [tx, ...prev]);
      setExpanded(tx.id);
      setAmount("");
      setAddress("");
      setSubmitting(false);
      if (notifs) pushAlert(`⟳ Transaction bridge initiée — ${fmt(tx.amount)} AQ`, "text-primary");
      simulateTx(tx);
    }, 1200);
  };

  // Stats
  const completed  = txList.filter(t => t.status === "completed");
  const pending    = txList.filter(t => t.status !== "completed" && t.status !== "failed");
  const totalBridged = completed.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 max-w-5xl relative">
      {/* Notification toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {alerts.map(a => (
          <div key={a.id} className="bg-card border border-border rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 text-sm pointer-events-auto animate-in slide-in-from-right">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <span className={cn("font-semibold", a.color)}>{a.msg}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Bridge Décentralisé</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transférez vos tokens AQ entre AEGIS-Q, Ethereum et Solana — Lock & Mint cross-chain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotifs(n => !n)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all",
              notifs ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground")}>
            {notifs ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            {notifs ? "Notifs actives" : "Notifs off"}
          </button>
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <Shield className="h-3 w-3 mr-1" />Lock &amp; Mint Protocol
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tx en attente",     value: pending.length,           color: "text-accent",    icon: Clock        },
          { label: "Tx complétées",     value: completed.length,          color: "text-green-400", icon: CheckCircle  },
          { label: "Total bridgé (AQ)", value: totalBridged.toFixed(2),  color: "text-primary",   icon: ArrowLeftRight },
          { label: "Frais économisés",  value: `${(fee * 0.6).toFixed(4)} AQ`, color: "text-chart-2", icon: Zap },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bridge form + Chain info side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Bridge Form */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Initier un Bridge</h3>
          </div>

          {/* Chain selector */}
          <div className="flex items-center gap-3">
            {/* From */}
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Source</label>
              <div className="relative">
                <select value={fromChain} onChange={e => { setFromChain(e.target.value); if (e.target.value === toChain) setToChain(fromChain); }}
                  className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary pr-8">
                  {Object.entries(CHAINS).map(([k, c]) => (
                    <option key={k} value={k}>{c.logo} {c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Swap button */}
            <button onClick={swap} className="mt-5 h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* To */}
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Destination</label>
              <div className="relative">
                <select value={toChain} onChange={e => { setToChain(e.target.value); if (e.target.value === fromChain) setFromChain(toChain); }}
                  className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary pr-8">
                  {Object.entries(CHAINS).filter(([k]) => k !== fromChain).map(([k, c]) => (
                    <option key={k} value={k}>{c.logo} {c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Montant AQ</label>
              <span className="text-[10px] text-muted-foreground">Solde : 12,450.00 AQ</span>
            </div>
            <div className="relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-lg font-mono font-bold text-foreground focus:outline-none focus:border-primary pr-20" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={() => setAmount("12450")} className="text-[10px] text-primary font-bold hover:underline">MAX</button>
                <span className="text-xs font-mono text-muted-foreground">AQ</span>
              </div>
            </div>
          </div>

          {/* Gas speed selector */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Vitesse du gaz</label>
              <GasBadge chainKey={fromChain} gas={gas} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {["slow", "standard", "fast"].map(speed => (
                <button key={speed} onClick={() => setGasSpeed(speed)}
                  className={cn(
                    "py-2 rounded-lg text-[11px] font-bold border transition-all",
                    gasSpeed === speed
                      ? speed === "slow"     ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : speed === "standard" ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  )}>
                  {speed === "slow" ? "🐢 Lent" : speed === "standard" ? "⚡ Standard" : "🚀 Rapide"}
                  <div className="text-[9px] font-mono mt-0.5 opacity-70">
                    {gas[fromChain]?.[speed] ?? "…"} {fromC.gasUnit}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {parseFloat(amount) > 0 && (
            <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taux de conversion</span>
                <span className="font-mono text-foreground">1 AQ = 1 {toC.wrappedSymbol ?? "AQ"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais bridge ({(fromC.fee * 100).toFixed(3)}%)</span>
                <span className="font-mono text-red-400">−{fmt(fee)} AQ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais de gaz ({gasSpeed})</span>
                <span className="font-mono text-orange-400">{currentGas} {fromC.gasUnit} ≈ ${gasUSD}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temps estimé</span>
                <span className="font-mono text-accent">{fmtTime(fromC.avgTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmations requises</span>
                <span className="font-mono text-foreground">{fromC.confirmations} blocs</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between font-bold">
                <span className="text-foreground">Vous recevez</span>
                <span className="font-mono text-green-400">{fmt(received)} {toC.wrappedSymbol ?? "AQ"}</span>
              </div>
            </div>
          )}

          {/* Recipient address */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Adresse {toC.name}
            </label>
            <div className="flex gap-2">
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder={toChain === "solana" ? "Adresse Solana (base58)…" : "0x…"}
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary" />
              <button onClick={() => setAddress(fakeAddr())}
                className="px-3 py-2 rounded-lg bg-secondary border border-border text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Demo
              </button>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !amount || parseFloat(amount) <= 0 || !address} className="w-full">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signature en cours…</>
            ) : (
              <><ArrowLeftRight className="h-4 w-4 mr-2" />Initier le Bridge</>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Protocole Lock &amp; Mint sécurisé par multisig AEGIS-Q · Audit CertiK
          </p>
        </div>

        {/* Chain info panel */}
        <div className="lg:col-span-2 space-y-3">
          {/* Destination chain */}
          <div className={cn("border rounded-xl p-4", toC.bg)}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{toC.logo}</span>
              <div>
                <p className={cn("text-sm font-bold", toC.text)}>{toC.name}</p>
                <p className="text-[10px] text-muted-foreground">Réseau destination</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                ["Token minté",  toC.wrappedSymbol ?? "AQ"],
                ["Confirmations",`${toC.confirmations} blocs`],
                ["Standard",     toC.standard ?? "Native"],
                ["Gas actuel",   `${gas[toChain]?.standard ?? "…"} ${toC.gasUnit}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Protocole</p>
            {[
              ["Mécanisme",   "Lock & Mint"],
              ["Sécurité",    "Multisig 5/9"],
              ["Audit",       "CertiK ✓"],
              ["Liquidité",   "Pool décentralisé"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            Suivi des Transactions
            {pending.length > 0 && (
              <Badge className="ml-2 bg-accent/10 text-accent border-accent/30 text-[10px]">
                {pending.length} en cours
              </Badge>
            )}
          </h3>
          {txList.length > 0 && (
            <button onClick={() => setTxList([])} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
              Effacer
            </button>
          )}
        </div>

        {txList.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <ArrowLeftRight className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune transaction — initiez votre premier bridge ci-dessus.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txList.map(tx => (
              <TxCard key={tx.id} tx={tx}
                expanded={expanded === tx.id}
                onExpand={id => setExpanded(prev => prev === id ? null : id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}