import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "@/api/base44Client";
import { Loader2, TrendingUp, DollarSign, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
  "";

const STAGE_LABELS = {
  landing_view: "Visites Landing",
  public_audit_run: "Audits Publics",
  signup: "Inscriptions",
  brochure_view: "Vues Tarifs",
  checkout_initiated: "Stripe Initiés",
  checkout_paid: "Conversions",
};

const STAGE_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#f97316", "#10b981",
];

export default function FunnelWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${BACKEND}/api/analytics/funnel?days=30`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 15000,
        });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled)
          setErr(e?.response?.data?.detail || e?.message || "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Chargement du funnel…</span>
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-6">
        <p className="text-sm text-destructive">Erreur funnel : {err}</p>
      </div>
    );
  }

  const stages = data?.stages || [];
  const topCount = stages[0]?.unique_sessions || 0;
  const paidCount = data?.paid_sessions || 0;
  const revenue = data?.estimated_revenue_usd || 0;

  return (
    <div
      data-testid="funnel-widget"
      className="bg-card border border-border rounded-xl p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Funnel de Conversion — 30 jours
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
              Live · Refresh 30s
            </p>
          </div>
        </div>

        {/* Revenue card */}
        <div className="flex items-center gap-2 bg-gradient-to-br from-green-500/10 to-primary/10 border border-green-500/30 rounded-lg px-4 py-2">
          <DollarSign className="h-4 w-4 text-green-400" />
          <div className="text-right">
            <p className="text-lg font-bold text-green-400 font-mono leading-none">
              ${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-muted-foreground font-mono tracking-widest mt-0.5">
              REVENUE · {paidCount} PAID
            </p>
          </div>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="space-y-3">
        {stages.map((s, i) => {
          const color = STAGE_COLORS[i % STAGE_COLORS.length];
          const pct = topCount > 0 ? (s.unique_sessions / topCount) * 100 : 0;
          const conv = s.conversion_from_top_pct ?? 0;
          const isBottom = s.stage === "checkout_paid";
          return (
            <div
              key={s.stage}
              data-testid={`funnel-stage-${s.stage}`}
              className={cn(
                "relative rounded-lg bg-secondary/30 border border-border/50 overflow-hidden",
                isBottom && "ring-1 ring-green-500/30"
              )}
            >
              <div
                className="absolute inset-y-0 left-0 opacity-15"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  background: color,
                  transition: "width 500ms ease-out",
                }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="text-[10px] font-mono text-muted-foreground tracking-widest w-4 shrink-0"
                    style={{ color }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-foreground truncate">
                    {STAGE_LABELS[s.stage] || s.stage}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
                      Users
                    </p>
                    <p className="text-xs font-bold text-foreground font-mono">
                      {s.unique_users}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
                      Sessions
                    </p>
                    <p className="text-xs font-bold text-foreground font-mono tabular-nums">
                      {s.unique_sessions}
                    </p>
                  </div>
                  <div
                    className="font-mono text-xs font-bold tabular-nums min-w-[54px]"
                    style={{ color }}
                  >
                    {conv.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stages.every((s) => s.unique_sessions === 0) && (
        <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
          Aucun événement sur les 30 derniers jours. Les métriques s'alimentent automatiquement dès
          qu'un visiteur arrive sur la landing, lance un audit public ou initie un paiement.
        </p>
      )}
    </div>
  );
}
