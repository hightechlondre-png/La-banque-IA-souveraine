import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, Calculator } from "lucide-react";

const POOLS = [
  { name: "Bronze",    baseApy: 8,  lockDays: 30,  icon: "🥉" },
  { name: "Silver",    baseApy: 15, lockDays: 90,  icon: "🥈" },
  { name: "Gold",      baseApy: 25, lockDays: 180, icon: "🥇" },
  { name: "Sovereign", baseApy: 40, lockDays: 365, icon: "👑" },
];

const LOCKUP_MULTIPLIERS = [
  { days: 30,  label: "1 mois",   mult: 1.0  },
  { days: 60,  label: "2 mois",   mult: 1.15 },
  { days: 90,  label: "3 mois",   mult: 1.25 },
  { days: 180, label: "6 mois",   mult: 1.5  },
  { days: 365, label: "1 an",     mult: 2.0  },
  { days: 730, label: "2 ans",    mult: 3.0  },
];

export default function StakingCalculator() {
  const [selectedPool, setSelectedPool] = useState(0);
  const [lockupIdx, setLockupIdx] = useState(2);
  const [amount, setAmount] = useState("10000");

  const pool = POOLS[selectedPool];
  const lockup = LOCKUP_MULTIPLIERS[lockupIdx];
  const principal = Math.max(0, parseFloat(amount.replace(/\s/g, "")) || 0);
  const effectiveApy = pool.baseApy * lockup.mult;
  const dailyRate = effectiveApy / 100 / 365;
  const rewardAfterLock = principal * (Math.pow(1 + dailyRate, lockup.days) - 1);
  const totalValue = principal + rewardAfterLock;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Calculatrice de Rendement</h3>
      </div>

      {/* Pool selector */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">
          Pool de Staking
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POOLS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => setSelectedPool(i)}
              className={cn(
                "px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all text-center",
                selectedPool === i
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-base mb-1 block">{p.icon}</span>
              <div className="text-[10px]">{p.name}</div>
              <div className="text-[10px] text-primary font-black">{p.baseApy}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">
          Montant à staker (AQ)
        </label>
        <div className="relative">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-base font-mono font-bold text-foreground focus:outline-none focus:border-primary"
            placeholder="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
            AQ
          </span>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {[1000, 10000, 100000, 1000000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="px-2.5 py-1 bg-secondary/50 rounded-lg text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {v >= 1000000 ? "1M" : v >= 1000 ? `${v / 1000}K` : v}
            </button>
          ))}
        </div>
      </div>

      {/* Lockup selector */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">
          Durée de Lock-up
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {LOCKUP_MULTIPLIERS.map((l, i) => {
            const effApy = (pool.baseApy * l.mult).toFixed(1);
            return (
              <button
                key={i}
                onClick={() => setLockupIdx(i)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-left text-xs transition-all",
                  lockupIdx === i
                    ? "bg-primary/10 border-primary/30"
                    : "bg-secondary border-border hover:border-muted-foreground"
                )}
              >
                <div className="font-semibold text-foreground">{l.label}</div>
                <div className={cn("text-[10px] font-mono font-bold", lockupIdx === i ? "text-primary" : "text-muted-foreground")}>
                  {effApy}% APY
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {principal > 0 && (
        <div className="bg-secondary/40 rounded-xl p-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">APY Effectif</p>
              <p className="text-lg font-black font-mono text-green-400">{effectiveApy.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Multiplicateur</p>
              <p className="text-lg font-black font-mono text-accent">×{lockup.mult}</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Capital Initial</p>
              <p className="text-base font-bold font-mono text-foreground">
                {principal.toLocaleString("fr-FR")} AQ
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Récompenses ({lockup.days}j)</p>
              <p className="text-base font-bold font-mono text-green-400">
                +{rewardAfterLock.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-foreground">Valeur Finale</span>
            <span className="text-lg font-black font-mono text-accent">
              {totalValue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ
            </span>
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span className="text-muted-foreground">Gain journalier moyen</span>
            <span className="font-mono text-chart-2">
              {(rewardAfterLock / lockup.days).toFixed(2)} AQ/jour
            </span>
          </div>
        </div>
      )}

      {principal === 0 && (
        <div className="bg-secondary/30 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Entrez un montant pour voir les gains potentiels</p>
        </div>
      )}
    </div>
  );
}