import { useEffect, useState } from "react";
import axios from "axios";
import { TrendingUp, TrendingDown, Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/api/base44Client";

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
  "";

const symbols = [
  { key: "BTC", label: "Bitcoin", color: "text-[#f7931a]" },
  { key: "ETH", label: "Ethereum", color: "text-[#8a92b2]" },
  { key: "SOL", label: "Solana", color: "text-[#9945ff]" },
];

function Row({ sym, price, change }) {
  const up = (change ?? 0) >= 0;
  return (
    <div
      data-testid={`market-row-${sym.key.toLowerCase()}`}
      className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-md bg-secondary border border-border flex items-center justify-center">
          <span className={cn("text-[10px] font-bold tracking-wider", sym.color)}>
            {sym.key}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{sym.label}</p>
          <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
            {sym.key} · USD
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-mono font-semibold text-foreground">
          ${typeof price === "number" ? price.toLocaleString("en-US") : "—"}
        </p>
        <div
          className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-mono mt-0.5",
            up ? "text-green-400" : "text-red-400"
          )}
        >
          {up ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {(change ?? 0).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function MarketPulse() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let stopped = false;
    const fetchPrices = async () => {
      try {
        const res = await axios.get(`${BACKEND}/api/market/prices`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 12000,
        });
        if (!stopped) {
          setData(res.data);
          setErr(null);
        }
      } catch (e) {
        if (!stopped) setErr(e?.message || "Erreur réseau");
      }
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 30000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const aq = data?.aq;

  return (
    <div
      data-testid="market-pulse-widget"
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Market Pulse · Temps Réel
          </h3>
          <p className="text-xs text-muted-foreground">
            CoinGecko · rafraîchissement 30s
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          LIVE
        </div>
      </div>

      {/* AQ synthetic card */}
      <div className="mt-1 mb-3 p-3 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              Aegis Token · AQ
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${aq?.usd?.toFixed(4) ?? "—"}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-mono",
              (aq?.change24h ?? 0) >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {(aq?.change24h ?? 0) >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {aq?.change24h?.toFixed(2) ?? "0.00"}%
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground mt-2 font-mono">
          Panier synthétique · 50% BTC · 30% ETH · 20% SOL
        </p>
      </div>

      {/* Coin list */}
      <div>
        {!data && !err && (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement des cours…
          </div>
        )}
        {err && (
          <p className="text-xs text-red-400 py-2">Erreur : {err}</p>
        )}
        {data?.coins &&
          symbols.map((s) => (
            <Row
              key={s.key}
              sym={s}
              price={data.coins[s.key]?.usd}
              change={data.coins[s.key]?.change24h}
            />
          ))}
      </div>
    </div>
  );
}
