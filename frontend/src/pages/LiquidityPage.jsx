import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Droplets, TrendingUp, ArrowDownUp, Plus, Minus, RefreshCw,
  ChevronDown, ChevronUp, Zap, Info
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

// ── Pool data ─────────────────────────────────────────────
const POOLS = [
  {
    id: "aq-eth",
    pair: "AQ / ETH",
    token0: "AQ",  token1: "ETH",
    apy: 42.8,  tvl: 24600000, vol24h: 3400000,
    fee: 0.3,   color0: "#3b82f6", color1: "#8b5cf6",
    price0: 8.47, price1: 3250,
    myLpTokens: 1240.5, myShare: 0.81,
    apyHistory: Array.from({length:14},(_,i)=>({ day:`J-${13-i}`, apy: 38+Math.sin(i*0.7)*8+Math.random()*4 })),
  },
  {
    id: "aq-usdc",
    pair: "AQ / USDC",
    token0: "AQ",  token1: "USDC",
    apy: 28.4,  tvl: 41200000, vol24h: 7100000,
    fee: 0.05,  color0: "#3b82f6", color1: "#10b981",
    price0: 8.47, price1: 1,
    myLpTokens: 4820.0, myShare: 1.24,
    apyHistory: Array.from({length:14},(_,i)=>({ day:`J-${13-i}`, apy: 25+Math.cos(i*0.5)*5+Math.random()*3 })),
  },
  {
    id: "aq-sol",
    pair: "AQ / SOL",
    token0: "AQ",  token1: "SOL",
    apy: 61.2,  tvl: 8900000, vol24h: 1200000,
    fee: 0.3,   color0: "#3b82f6", color1: "#f59e0b",
    price0: 8.47, price1: 142,
    myLpTokens: 0, myShare: 0,
    apyHistory: Array.from({length:14},(_,i)=>({ day:`J-${13-i}`, apy: 54+Math.sin(i*1.1)*12+Math.random()*6 })),
  },
  {
    id: "aq-btc",
    pair: "AQ / BTC",
    token0: "AQ",  token1: "BTC",
    apy: 19.7,  tvl: 62000000, vol24h: 9800000,
    fee: 0.05,  color0: "#3b82f6", color1: "#ef4444",
    price0: 8.47, price1: 72000,
    myLpTokens: 0, myShare: 0,
    apyHistory: Array.from({length:14},(_,i)=>({ day:`J-${13-i}`, apy: 17+Math.cos(i*0.4)*4+Math.random()*2 })),
  },
];

const fmt = (n, dec=2) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtM = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${(n/1e3).toFixed(0)}K`;

// ── APY live ticker ───────────────────────────────────────
function ApyTicker({ base }) {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const t = setInterval(() => setVal(v => parseFloat((base + (Math.random()-0.5)*0.4).toFixed(2))), 2000);
    return () => clearInterval(t);
  }, [base]);
  return <span className="font-mono font-black text-green-400">{val.toFixed(2)}%</span>;
}

// ── Custom tooltip ────────────────────────────────────────
const ApyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      <p className="text-green-400 font-bold font-mono">{payload[0].value.toFixed(2)}% APY</p>
    </div>
  );
};

// ── Deposit modal (inline) ────────────────────────────────
function DepositPanel({ pool, onClose }) {
  const [amt0, setAmt0] = useState("");
  const [amt1, setAmt1] = useState("");
  const [done, setDone] = useState(false);

  const handleAmt0 = (v) => {
    setAmt0(v);
    const n = parseFloat(v) || 0;
    setAmt1(n > 0 ? fmt(n * pool.price0 / pool.price1, 6) : "");
  };
  const handleAmt1 = (v) => {
    setAmt1(v);
    const n = parseFloat(v) || 0;
    setAmt0(n > 0 ? fmt(n * pool.price1 / pool.price0, 4) : "");
  };

  const lpEstimate = useMemo(() => {
    const n = parseFloat(amt0) || 0;
    return n > 0 ? (n * pool.price0 / pool.tvl * 1000000).toFixed(4) : "0";
  }, [amt0, pool]);

  if (done) return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-3">
      <div className="text-4xl">✓</div>
      <p className="text-sm font-bold text-green-400">Liquidité ajoutée avec succès !</p>
      <p className="text-xs text-muted-foreground">+{lpEstimate} LP tokens crédités sur votre position {pool.pair}.</p>
      <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
    </div>
  );

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />Ajouter de la Liquidité — {pool.pair}
        </h4>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕ Annuler</button>
      </div>

      {[{label: pool.token0, val: amt0, set: handleAmt0, price: pool.price0}, {label: pool.token1, val: amt1, set: handleAmt1, price: pool.price1}].map((f,i) => (
        <div key={i} className="bg-secondary/50 rounded-xl p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{f.label}</span>
            <span>≈ ${fmt((parseFloat(f.val)||0)*f.price, 2)} USD</span>
          </div>
          <div className="flex gap-2">
            <input value={f.val} onChange={e => f.set(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-mono text-foreground focus:outline-none" />
            <Badge variant="outline" className="border-primary/30 text-primary text-sm px-3">{f.label}</Badge>
          </div>
          <div className="flex gap-2 mt-2">
            {[25,50,75,100].map(p => (
              <button key={p} onClick={() => f.set(fmt(1000*p/100,4))}
                className="px-2 py-0.5 bg-secondary rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {p}%
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-secondary/30 rounded-xl px-4 py-3 space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">LP tokens estimés</span><span className="font-mono text-foreground font-bold">{lpEstimate} LP</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Part de pool estimée</span><span className="font-mono text-foreground">{lpEstimate > 0 ? "<0.01%" : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">APY actuel</span><span className="font-mono text-green-400 font-bold">{pool.apy.toFixed(2)}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Frais de pool</span><span className="font-mono text-foreground">{pool.fee}%</span></div>
      </div>

      <Button className="w-full" disabled={!parseFloat(amt0)} onClick={() => setDone(true)}>
        <Droplets className="h-4 w-4 mr-2" />Déposer dans le Pool
      </Button>
    </div>
  );
}

// ── Withdraw modal (inline) ───────────────────────────────
function WithdrawPanel({ pool, onClose }) {
  const [pct, setPct] = useState(50);
  const [done, setDone] = useState(false);
  const lpOut = (pool.myLpTokens * pct / 100).toFixed(4);
  const aq    = ((pool.myLpTokens * pct / 100) * pool.price0 * 0.5).toFixed(2);
  const tkn   = ((pool.myLpTokens * pct / 100) * pool.price0 * 0.5 / pool.price1).toFixed(6);

  if (done) return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-3">
      <div className="text-4xl">✓</div>
      <p className="text-sm font-bold text-green-400">Retrait effectué !</p>
      <p className="text-xs text-muted-foreground">Vous avez récupéré {aq} {pool.token0} + {tkn} {pool.token1}.</p>
      <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
    </div>
  );

  return (
    <div className="bg-card border border-red-500/20 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Minus className="h-4 w-4 text-red-400" />Retirer de la Liquidité — {pool.pair}
        </h4>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕ Annuler</button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Pourcentage à retirer</span>
          <span className="font-mono font-bold text-foreground">{pct}%</span>
        </div>
        <input type="range" min={1} max={100} value={pct} onChange={e => setPct(+e.target.value)}
          className="w-full accent-primary cursor-pointer" />
        <div className="flex gap-2">
          {[25,50,75,100].map(p => (
            <button key={p} onClick={() => setPct(p)}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border",
                pct === p ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
              {p === 100 ? "MAX" : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">LP tokens brûlés</span><span className="font-mono text-red-400">{lpOut} LP</span></div>
        <div className="h-px bg-border" />
        <div className="flex justify-between"><span className="text-muted-foreground">Vous recevez {pool.token0}</span><span className="font-mono text-foreground">{aq} AQ</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Vous recevez {pool.token1}</span><span className="font-mono text-foreground">{tkn} {pool.token1}</span></div>
      </div>

      <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => setDone(true)}>
        <Minus className="h-4 w-4 mr-2" />Retirer {pct}% de la position
      </Button>
    </div>
  );
}

// ── Pool card ─────────────────────────────────────────────
function PoolCard({ pool, onDeposit, onWithdraw }) {
  const [expanded, setExpanded] = useState(false);
  const hasPosition = pool.myLpTokens > 0;
  const myValueUSD = pool.myLpTokens * pool.price0 * 0.5 * 2;

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all",
      hasPosition ? "border-primary/30" : "border-border")}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-5 hover:bg-secondary/20 transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Token icons */}
          <div className="flex -space-x-2 shrink-0">
            <div className="h-8 w-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold"
              style={{ background: `${pool.color0}33`, color: pool.color0 }}>{pool.token0[0]}</div>
            <div className="h-8 w-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold"
              style={{ background: `${pool.color1}33`, color: pool.color1 }}>{pool.token1[0]}</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{pool.pair}</p>
            <p className="text-[10px] text-muted-foreground">Fee {pool.fee}% · TVL {fmtM(pool.tvl)}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-black"><ApyTicker base={pool.apy} /></div>
            <p className="text-[10px] text-muted-foreground">APY</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-mono text-foreground font-bold">{fmtM(pool.vol24h)}</p>
            <p className="text-[10px] text-muted-foreground">Vol 24h</p>
          </div>
          {hasPosition && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Ma position</Badge>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-5 space-y-4">
          {/* APY chart */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">APY sur 14 jours</p>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pool.apyHistory}>
                  <defs>
                    <linearGradient id={`grad-${pool.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis domain={['auto','auto']} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}%`} />
                  <Tooltip content={<ApyTooltip />} />
                  <Area type="monotone" dataKey="apy" stroke="#10b981" strokeWidth={2} fill={`url(#grad-${pool.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pool stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "TVL", value: fmtM(pool.tvl) },
              { label: "Vol. 24h", value: fmtM(pool.vol24h) },
              { label: "Frais 24h", value: fmtM(pool.vol24h * pool.fee / 100) },
            ].map(s => (
              <div key={s.label} className="bg-secondary/40 rounded-lg px-3 py-2 text-center">
                <p className="text-muted-foreground text-[10px]">{s.label}</p>
                <p className="font-mono font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* My position */}
          {hasPosition && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 text-xs">
              <p className="text-[10px] font-bold text-primary uppercase mb-2">Ma Position</p>
              <div className="flex justify-between"><span className="text-muted-foreground">LP Tokens</span><span className="font-mono text-foreground">{fmt(pool.myLpTokens, 4)} LP</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Part du pool</span><span className="font-mono text-foreground">{pool.myShare}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valeur estimée</span><span className="font-mono text-green-400 font-bold">${fmt(myValueUSD, 2)}</span></div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1" size="sm" onClick={() => onDeposit(pool)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Ajouter
            </Button>
            {hasPosition && (
              <Button className="flex-1" size="sm" variant="outline"
                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => onWithdraw(pool)}>
                <Minus className="h-3.5 w-3.5 mr-1.5" />Retirer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function LiquidityPage() {
  const [depositPool, setDepositPool]   = useState(null);
  const [withdrawPool, setWithdrawPool] = useState(null);
  const [sortBy, setSortBy] = useState("apy");

  const myPools    = POOLS.filter(p => p.myLpTokens > 0);
  const totalTvl   = POOLS.reduce((s, p) => s + p.tvl, 0);
  const myValueUSD = myPools.reduce((s, p) => s + p.myLpTokens * p.price0 * 0.5 * 2, 0);
  const sortedPools = [...POOLS].sort((a, b) =>
    sortBy === "apy" ? b.apy - a.apy : sortBy === "tvl" ? b.tvl - a.tvl : b.vol24h - a.vol24h
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Fourniture de Liquidité</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Déposez des paires de tokens · APY temps réel · Gérez vos positions LP
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Droplets className="h-3 w-3 mr-1" />{POOLS.length} pools actifs
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "TVL Total",        value: fmtM(totalTvl),              icon: Droplets,   color: "text-primary"   },
          { label: "Meilleur APY",     value: `${Math.max(...POOLS.map(p=>p.apy)).toFixed(1)}%`, icon: TrendingUp, color: "text-green-400" },
          { label: "Ma Valeur Totale", value: `$${fmt(myValueUSD, 2)}`,     icon: Zap,        color: "text-accent"    },
          { label: "Mes Pools",        value: myPools.length,               icon: ArrowDownUp,color: "text-chart-4"   },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* My positions summary */}
      {myPools.length > 0 && (
        <div className="bg-card border border-primary/20 rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />Mes Positions LP
          </h3>
          <div className="space-y-3">
            {myPools.map(p => {
              const val = p.myLpTokens * p.price0 * 0.5 * 2;
              const daily = val * p.apy / 100 / 365;
              return (
                <div key={p.id} className="flex items-center gap-4 bg-secondary/40 rounded-xl px-4 py-3 flex-wrap">
                  <div className="flex -space-x-2 shrink-0">
                    <div className="h-7 w-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold"
                      style={{ background: `${p.color0}33`, color: p.color0 }}>{p.token0[0]}</div>
                    <div className="h-7 w-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold"
                      style={{ background: `${p.color1}33`, color: p.color1 }}>{p.token1[0]}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{p.pair}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{fmt(p.myLpTokens, 4)} LP · {p.myShare}% du pool</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground font-mono">${fmt(val, 2)}</p>
                    <p className="text-[10px] text-green-400 font-mono">+${daily.toFixed(2)}/jour</p>
                  </div>
                  <div className="text-right">
                    <ApyTicker base={p.apy} />
                    <p className="text-[10px] text-muted-foreground">APY</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 px-2.5 text-[10px]" onClick={() => { setWithdrawPool(null); setDepositPool(p); }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => { setDepositPool(null); setWithdrawPool(p); }}>
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deposit / Withdraw panels */}
      {depositPool && (
        <DepositPanel pool={depositPool} onClose={() => setDepositPool(null)} />
      )}
      {withdrawPool && (
        <WithdrawPanel pool={withdrawPool} onClose={() => setWithdrawPool(null)} />
      )}

      {/* All pools */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-foreground">Tous les Pools de Liquidité</h3>
          <div className="flex gap-1.5">
            {["apy","tvl","vol24h"].map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={cn("px-3 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  sortBy === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {s === "vol24h" ? "Volume" : s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {sortedPools.map(p => (
            <PoolCard key={p.id} pool={p}
              onDeposit={pool => { setWithdrawPool(null); setDepositPool(pool); window.scrollTo({top:0,behavior:"smooth"}); }}
              onWithdraw={pool => { setDepositPool(null); setWithdrawPool(pool); window.scrollTo({top:0,behavior:"smooth"}); }}
            />
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          En fournissant de la liquidité, vous percevez une part des frais de trading générés par le pool ({" "}
          <span className="text-foreground font-mono">0.05% – 0.3%</span> par swap). Les positions LP sont exposées au risque de perte impermanente.
          L'APY affiché est calculé sur les 24 dernières heures et peut varier.
        </p>
      </div>
    </div>
  );
}