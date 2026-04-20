import { Lock, TrendingUp, Clock, Zap, Gift, Calculator, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ── Pool definitions ──────────────────────────────────────
const POOLS = [
  { name: "Bronze",   apy: 8,  lockDays: 30,  min: 1000,      minLabel: "1,000",    staked: "45M",  capacity: 45, icon: "🥉", color: "#f59e0b" },
  { name: "Silver",   apy: 15, lockDays: 90,  min: 10000,     minLabel: "10,000",   staked: "120M", capacity: 60, icon: "🥈", color: "#94a3b8" },
  { name: "Gold",     apy: 25, lockDays: 180, min: 100000,    minLabel: "100,000",  staked: "210M", capacity: 84, icon: "🥇", color: "#f59e0b" },
  { name: "Sovereign",apy: 40, lockDays: 365, min: 1000000,   minLabel: "1,000,000",staked: "12M",  capacity: 12, icon: "👑", color: "#8b5cf6" },
];

// Lock-up multiplier tiers (bonus on top of base APY)
const LOCKUP_MULTIPLIERS = [
  { days: 30,  label: "1 mois",   mult: 1.0,  badge: "Standard" },
  { days: 60,  label: "2 mois",   mult: 1.15, badge: "+15%"     },
  { days: 90,  label: "3 mois",   mult: 1.25, badge: "+25%"     },
  { days: 180, label: "6 mois",   mult: 1.5,  badge: "+50%"     },
  { days: 365, label: "1 an",     mult: 2.0,  badge: "×2"       },
  { days: 730, label: "2 ans",    mult: 3.0,  badge: "×3 🔥"    },
];

const MY_STAKES = [
  { pool: "Gold",   amount: 500000, rewards: 12500, unlock: "2026-10-05", apy: 25 },
  { pool: "Silver", amount: 50000,  rewards: 1875,  unlock: "2026-07-04", apy: 15 },
];

// ── Compound interest curve builder ──────────────────────
function buildCurve(principal, apyPct, lockDays, multIdx) {
  const mult = LOCKUP_MULTIPLIERS[multIdx]?.mult ?? 1;
  const effectiveAPY = (apyPct * mult) / 100;
  const points = 40;
  return Array.from({ length: points + 1 }, (_, i) => {
    const day = Math.round((lockDays / points) * i);
    const value = principal * Math.pow(1 + effectiveAPY, day / 365);
    const rewards = value - principal;
    return { day, value: parseFloat(value.toFixed(2)), rewards: parseFloat(rewards.toFixed(2)) };
  });
}

// ── Custom tooltip ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">Jour {label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono text-foreground ml-auto">
            {Number(p.value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AQ
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Live reward ticker ────────────────────────────────────
function RewardTicker({ value }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(v => parseFloat((v + value * (0.00001 + Math.random() * 0.00002)).toFixed(4)));
    }, 800);
    return () => clearInterval(interval);
  }, [value]);
  return (
    <span className="text-green-400 font-mono font-bold text-2xl tabular-nums">
      {display.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function Staking() {
  const [selectedPool, setSelectedPool]   = useState(0);          // pool index
  const [lockupIdx, setLockupIdx]         = useState(2);          // multiplier index
  const [amount, setAmount]               = useState("10000");

  const pool      = POOLS[selectedPool];
  const lockup    = LOCKUP_MULTIPLIERS[lockupIdx];
  const principal = Math.max(0, parseFloat(amount.replace(/\s/g, "")) || 0);
  const effectiveAPY = pool.apy * lockup.mult;
  const dailyRate    = effectiveAPY / 100 / 365;
  const rewardAfterLock = principal * (Math.pow(1 + dailyRate, lockup.days) - 1);
  const rewardPerDay    = principal * dailyRate;

  const curve = useMemo(
    () => buildCurve(principal, pool.apy, lockup.days, lockupIdx),
    [principal, pool.apy, lockup.days, lockupIdx]
  );

  const totalNetworkStaked = 387;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Staking Technologique</h2>
        <p className="text-sm text-muted-foreground mt-1">Sécurisez le réseau AEGIS-Q · Récompenses temps réel · Courbe d'accumulation interactive</p>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Lock,      label: "Total Staked",           value: "387M AQ"   },
          { icon: TrendingUp,label: "APY Moyen",              value: "22%"        },
          { icon: Gift,      label: "Récompenses Distribuées",value: "14.2M AQ"  },
          { icon: Clock,     label: "Prochaine Distribution", value: "4h 32m"    },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className="h-4 w-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold text-foreground font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pool selector */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Pools de Staking</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {POOLS.map((p, i) => (
            <button key={p.name} onClick={() => setSelectedPool(i)}
              className={cn(
                "bg-card border rounded-xl p-4 text-left cursor-pointer transition-all hover:scale-[1.02]",
                selectedPool === i ? "border-primary shadow-lg shadow-primary/10" : "border-border"
              )}>
              <div className="text-xl mb-2">{p.icon}</div>
              <p className="text-sm font-bold text-foreground">{p.name}</p>
              <p className="text-lg font-black font-mono text-green-400 mt-1">{p.apy}%</p>
              <p className="text-[10px] text-muted-foreground">APY base</p>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{p.lockDays}j lock · {p.minLabel} AQ min</span>
                  <span>{p.capacity}%</span>
                </div>
                <Progress value={p.capacity} className="h-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Calculator + Curve side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Calculator */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Calculateur de Récompenses</h3>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">Montant à staker (AQ)</label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-lg font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">AQ</span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[1000, 10000, 100000, 1000000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="px-2.5 py-1 bg-secondary rounded-lg text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                  {v >= 1000000 ? "1M" : v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Lock-up selector */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">Durée de Lock-up</label>
            <div className="space-y-1.5">
              {LOCKUP_MULTIPLIERS.map((l, i) => {
                const effAPY = (pool.apy * l.mult).toFixed(1);
                return (
                  <button key={i} onClick={() => setLockupIdx(i)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                      lockupIdx === i
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-muted-foreground"
                    )}>
                    <div className={cn("h-2 w-2 rounded-full shrink-0", lockupIdx === i ? "bg-primary" : "bg-muted-foreground/30")} />
                    <span className="text-xs font-semibold text-foreground flex-1">{l.label}</span>
                    <Badge variant="outline" className={cn("text-[9px] shrink-0",
                      lockupIdx === i ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>
                      {l.badge}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-green-400 w-12 text-right">{effAPY}% APY</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">APY effectif</span>
              <span className="text-base font-black font-mono text-green-400">{effectiveAPY.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Récompense / jour</span>
              <span className="text-sm font-bold font-mono text-foreground">{rewardPerDay.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} AQ</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total récompenses ({lockup.days}j)</span>
              <span className="text-lg font-black font-mono text-green-400">
                +{rewardAfterLock.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Multiplicateur</span>
              <span className="text-sm font-bold font-mono text-accent">×{lockup.mult}</span>
            </div>
          </div>

          <Button className="w-full gap-2" size="lg">
            <Zap className="h-4 w-4" />
            Staker {principal > 0 ? `${principal.toLocaleString("fr-FR")} AQ` : ""} — {pool.name}
          </Button>
        </div>

        {/* Accumulation Curve */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">Courbe d'Accumulation d'Intérêts</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Pool {pool.name} · {lockup.label} · APY {effectiveAPY.toFixed(1)}%
              </p>
            </div>
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
              Temps réel
            </Badge>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradRewards" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={v => `J${v}`} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={principal} stroke="hsl(222,30%,28%)" strokeDasharray="4 3"
                  label={{ value: "Capital", position: "left", fontSize: 8, fill: "hsl(215,20%,55%)" }} />
                <Area type="monotone" dataKey="value" name="Valeur totale"
                  stroke="#3b82f6" strokeWidth={2} fill="url(#gradValue)" />
                <Area type="monotone" dataKey="rewards" name="Récompenses"
                  stroke="#10b981" strokeWidth={2} fill="url(#gradRewards)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* End-of-lock summary */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Capital initial",       value: `${principal.toLocaleString("fr-FR")} AQ`, color: "text-primary" },
              { label: `Gains (${lockup.days}j)`, value: `+${rewardAfterLock.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ`, color: "text-green-400" },
              { label: "Total final",           value: `${(principal + rewardAfterLock).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ`, color: "text-accent" },
            ].map(k => (
              <div key={k.label} className="bg-secondary/40 rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{k.label}</p>
                <p className={cn("text-xs font-bold font-mono", k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live reward ticker for active stakes */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Mes Stakes Actifs — Récompenses Temps Réel</h3>
        <div className="space-y-3">
          {MY_STAKES.map((s, i) => {
            const daily = s.amount * (s.apy / 100 / 365);
            return (
              <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-xl p-4 flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="border-primary/30 text-primary">{s.pool}</Badge>
                  <div>
                    <p className="text-sm font-semibold text-foreground font-mono">
                      {s.amount.toLocaleString("fr-FR")} AQ
                    </p>
                    <p className="text-xs text-muted-foreground">Déverrouillage : {s.unlock} · APY {s.apy}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <RewardTicker value={s.rewards} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">AQ accumulés</p>
                  <p className="text-[10px] text-green-400 font-mono">+{daily.toFixed(2)} AQ/jour</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}