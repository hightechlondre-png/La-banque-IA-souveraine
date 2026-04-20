import { useState } from "react";
import axios from "axios";
import { getToken } from "@/api/base44Client";
import { Brain, Sparkles, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
  "";

export default function StakingAdvisor({
  amount,
  poolName,
  poolApy,
  lockDays,
  multiplier,
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const ask = async () => {
    if (!amount || amount <= 0) {
      setErr("Montant invalide");
      return;
    }
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await axios.post(
        `${BACKEND}/api/market/staking-advice`,
        {
          amount_aq: Number(amount),
          pool_name: poolName,
          pool_apy_pct: poolApy,
          lock_days: lockDays,
          multiplier,
        },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 90000,
        }
      );
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Erreur IA");
    } finally {
      setLoading(false);
    }
  };

  const aqChange = data?.computation?.aq_change24h ?? 0;

  return (
    <div
      data-testid="staking-advisor"
      className="bg-gradient-to-br from-primary/5 via-card to-accent/5 border border-primary/20 rounded-xl p-5 relative overflow-hidden"
    >
      {/* Glow orb */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              Analyse Stratégique IA
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
              Claude Opus 4.5 · Marché Temps Réel
            </p>
          </div>
        </div>
        <Button
          data-testid="staking-advisor-ask-btn"
          onClick={ask}
          disabled={loading}
          size="sm"
          className="shrink-0 gap-1.5 h-9"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyse…
            </>
          ) : (
            <>
              <Brain className="h-3.5 w-3.5" />
              Demander l'IA
            </>
          )}
        </Button>
      </div>

      {err && (
        <div
          data-testid="staking-advisor-error"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs mb-3"
        >
          {err}
        </div>
      )}

      {data && (
        <div data-testid="staking-advisor-result" className="relative space-y-4">
          {/* Computation strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-card/50 border border-border rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">APY effectif</p>
              <p className="text-sm font-bold text-green-400 font-mono">
                {data.computation.effective_apy_pct}%
              </p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">Récompense</p>
              <p className="text-sm font-bold text-foreground font-mono">
                {data.computation.reward_aq.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} AQ
              </p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">Valeur finale</p>
              <p className="text-sm font-bold text-foreground font-mono">
                ${data.computation.final_usd.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">AQ · 24h</p>
              <div className={cn(
                "flex items-center gap-0.5 text-sm font-bold font-mono",
                aqChange >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {aqChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {aqChange.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* AI Advice */}
          <div className="bg-background/40 border border-border rounded-lg p-4 text-sm">
            <ReactMarkdown
              className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-foreground"
              components={{
                p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="text-primary font-semibold">{children}</strong>,
                h1: ({ children }) => <h4 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h4>,
                h2: ({ children }) => <h4 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h4>,
                h3: ({ children }) => <h5 className="text-xs font-bold text-primary mt-2 mb-1 uppercase tracking-wider">{children}</h5>,
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-primary">{children}</code>
                  ) : (
                    <pre className="bg-secondary rounded-lg p-3 overflow-x-auto my-2"><code className="text-xs font-mono">{children}</code></pre>
                  ),
              }}
            >
              {data.advice}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!data && !err && !loading && (
        <p className="relative text-xs text-muted-foreground">
          Cliquez sur <span className="text-primary font-semibold">« Demander l'IA »</span> pour obtenir une analyse Claude Opus 4.5 prenant en compte les cours BTC/ETH/SOL en temps réel, votre pool et votre stratégie de lock-up.
        </p>
      )}
    </div>
  );
}
