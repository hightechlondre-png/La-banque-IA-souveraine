import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BarChart2, TrendingUp, TrendingDown, Zap, Droplets, Lock,
  ArrowUpRight, ArrowDownRight, Activity, Calendar
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";

// ── Data generation helpers ───────────────────────────────
function genDays(n, base, variance, trend = 0) {
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v + (Math.random() - 0.48) * variance + trend);
    const d = new Date(Date.now() - (n - 1 - i) * 86400000);
    return { date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), value: parseFloat(v.toFixed(2)) };
  });
}

const WINDOWS = [
  { label: "7J",  days: 7  },
  { label: "30J", days: 30 },
  { label: "90J", days: 90 },
  { label: "1A",  days: 365 },
];

// ── Static datasets ───────────────────────────────────────
const TX_HISTORY_FULL = genDays(365, 12000, 3000, 8);
const PORTFOLIO_FULL  = genDays(365, 42000, 2000, 30);
const STAKING_FULL    = genDays(365, 0, 40, 2).map((d, i) => ({ ...d, value: i * 2.4 + Math.random() * 10 }));
const LIQUIDITY_FULL  = genDays(365, 0, 30, 1.5).map((d, i) => ({ ...d, value: i * 1.6 + Math.random() * 8 }));

const NETWORK_VOL = [
  { network: "AEGIS-Q", vol: 847, color: "#3b82f6" },
  { network: "Ethereum", vol: 312, color: "#8b5cf6" },
  { network: "Solana",   vol: 189, color: "#f59e0b" },
  { network: "BNB",      vol: 98,  color: "#10b981" },
  { network: "Base",     vol: 54,  color: "#ef4444" },
];

const REVENUE_BREAKDOWN = [
  { name: "Staking AQ",       value: 34.2, color: "#3b82f6" },
  { name: "LP AQ/ETH",        value: 18.7, color: "#8b5cf6" },
  { name: "LP AQ/USDC",       value: 12.4, color: "#10b981" },
  { name: "Frais trading",    value: 8.1,  color: "#f59e0b" },
  { name: "Governance",       value: 3.6,  color: "#ef4444" },
];

const MONTHLY_REVENUE = [
  { month: "Oct",  staking: 1240, liquidity: 820,  fees: 310 },
  { month: "Nov",  staking: 1580, liquidity: 940,  fees: 380 },
  { month: "Déc",  staking: 1420, liquidity: 1100, fees: 290 },
  { month: "Jan",  staking: 1890, liquidity: 1240, fees: 420 },
  { month: "Fév",  staking: 2100, liquidity: 1380, fees: 510 },
  { month: "Mar",  staking: 2340, liquidity: 1520, fees: 580 },
  { month: "Avr",  staking: 2680, liquidity: 1780, fees: 640 },
];

const TOP_TX = [
  { type: "Stake",    amount: "+500,000 AQ", usd: "+$4,235", date: "10/04/2026", status: "success" },
  { type: "LP Dépôt", amount: "+2.4 ETH",   usd: "+$7,800", date: "08/04/2026", status: "success" },
  { type: "Swap",     amount: "−10,000 AQ", usd: "−$84.7",  date: "05/04/2026", status: "success" },
  { type: "Reward",   amount: "+1,240 AQ",  usd: "+$10.5",  date: "01/04/2026", status: "success" },
  { type: "Bridge",   amount: "−0.5 ETH",   usd: "−$1,625", date: "28/03/2026", status: "pending" },
  { type: "Unstake",  amount: "+50,000 AQ", usd: "+$423.5", date: "20/03/2026", status: "success" },
];

const STATUS_COLOR = { success: "text-green-400", pending: "text-accent", failed: "text-red-400" };
const TYPE_ICON    = { Stake: Lock, "LP Dépôt": Droplets, Swap: Activity, Reward: Zap, Bridge: ArrowUpRight, Unstake: Lock };

// ── Tooltip ───────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">{prefix}{Number(p.value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{suffix}</span>
        </div>
      ))}
    </div>
  );
};

// ── Section title ─────────────────────────────────────────
const SectionTitle = ({ icon: Icon, title, sub, color = "text-primary" }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/10")}>
      <Icon className={cn("h-4 w-4", color)} />
    </div>
    <div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

// ── Main ─────────────────────────────────────────────────
export default function UserAnalytics() {
  const [window, setWindow] = useState(1); // index in WINDOWS

  const days = WINDOWS[window].days;

  const txSlice        = TX_HISTORY_FULL.slice(-days);
  const portfolioSlice = PORTFOLIO_FULL.slice(-days);
  const stakingSlice   = STAKING_FULL.slice(-days);
  const liquiditySlice = LIQUIDITY_FULL.slice(-days);

  // KPIs
  const portfolioNow   = portfolioSlice.at(-1)?.value ?? 0;
  const portfolioStart = portfolioSlice[0]?.value ?? 1;
  const portfolioDelta = ((portfolioNow - portfolioStart) / portfolioStart * 100).toFixed(1);
  const portfolioUp    = portfolioDelta >= 0;

  const totalRevenue   = (REVENUE_BREAKDOWN.reduce((s, r) => s + r.value, 0)).toFixed(1);
  const totalTxVol     = txSlice.reduce((s, d) => s + d.value, 0);

  // Cumulative revenue for area chart
  const cumulativeRev = useMemo(() => {
    const stk = stakingSlice.map(d => d.value);
    const liq = liquiditySlice.map(d => d.value);
    return stakingSlice.map((d, i) => ({
      date: d.date,
      staking: parseFloat(stk[i].toFixed(2)),
      liquidité: parseFloat(liq[i].toFixed(2)),
      total: parseFloat((stk[i] + liq[i]).toFixed(2)),
    }));
  }, [stakingSlice, liquiditySlice]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Tableau de Bord Analytique</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Performances · Volume · Revenus Staking & Liquidité · Historique transactionnel
          </p>
        </div>
        {/* Window selector */}
        <div className="flex gap-1.5 bg-secondary rounded-xl p-1">
          {WINDOWS.map((w, i) => (
            <button key={w.label} onClick={() => setWindow(i)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                window === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Valeur Portefeuille",   value: `$${portfolioNow.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`, delta: `${portfolioUp ? "+" : ""}${portfolioDelta}%`, up: portfolioUp, icon: TrendingUp },
          { label: "Volume Échangé",        value: `$${(totalTxVol/1000).toFixed(0)}K`,                 delta: "+8.4%",  up: true,  icon: Activity   },
          { label: "Revenus Totaux",        value: `${totalRevenue} AQ`,                                 delta: "+14.2%", up: true,  icon: Zap        },
          { label: "Transactions",          value: days < 30 ? "142" : days < 100 ? "584" : "2,341",    delta: "+3.1%",  up: true,  icon: BarChart2  },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <k.icon className="h-4 w-4 text-primary" />
              <span className={cn("text-[10px] font-mono font-bold", k.up ? "text-green-400" : "text-red-400")}>
                {k.up ? <ArrowUpRight className="h-3 w-3 inline" /> : <ArrowDownRight className="h-3 w-3 inline" />}
                {k.delta}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold font-mono text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Portfolio performance + Network volume */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Portfolio curve */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={TrendingUp} title="Performance du Portefeuille" sub={`${WINDOWS[window].label} · Valeur totale en USD`} />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioSlice}>
                <defs>
                  <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip prefix="$" />} />
                <ReferenceLine y={portfolioStart} stroke="hsl(222,30%,28%)" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="value" name="Portefeuille" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPortfolio)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network volume */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={BarChart2} title="Volume par Réseau" sub="Cumul $M" color="text-accent" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={NETWORK_VOL} layout="vertical" barSize={18}>
                <XAxis type="number" hide />
                <YAxis dataKey="network" type="category" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} width={72} />
                <Tooltip content={<ChartTooltip suffix="M" prefix="$" />} />
                <Bar dataKey="vol" name="Volume" radius={[0, 6, 6, 0]}>
                  {NETWORK_VOL.map((n, i) => <Cell key={i} fill={n.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transaction volume + Revenue breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TX volume */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={Activity} title="Volume de Transactions" sub={`Historique ${WINDOWS[window].label}`} color="text-chart-2" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={txSlice.filter((_, i) => i % Math.max(1, Math.floor(txSlice.length / 30)) === 0)} barSize={days <= 7 ? 32 : 12}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip prefix="$" />} />
                <Bar dataKey="value" name="Volume" radius={[4, 4, 0, 0]}>
                  {txSlice.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? "#3b82f6" : "#8b5cf6"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionTitle icon={Zap} title="Ventilation des Revenus" sub="Par source de rendement" color="text-accent" />
          <div className="flex items-center gap-4">
            <div className="h-52 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={REVENUE_BREAKDOWN} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={2} dataKey="value" stroke="none">
                    {REVENUE_BREAKDOWN.map((r, i) => <Cell key={i} fill={r.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip suffix=" AQ" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {REVENUE_BREAKDOWN.map(r => (
                <div key={r.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-[11px] text-muted-foreground flex-1 truncate">{r.name}</span>
                  <span className="text-[11px] font-mono font-bold text-foreground">{r.value} AQ</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-xs">
                <span className="text-muted-foreground font-bold">Total</span>
                <span className="font-mono font-black text-primary">{totalRevenue} AQ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative revenue staking + liquidity */}
      <div className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Droplets} title="Revenus Cumulatifs — Staking & Liquidité" sub={`Accumulation ${WINDOWS[window].label}`} color="text-chart-2" />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeRev}>
              <defs>
                <linearGradient id="gradStaking" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v.toFixed(0)} AQ`} />
              <Tooltip content={<ChartTooltip suffix=" AQ" />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="staking" name="Staking" stroke="#3b82f6" strokeWidth={2} fill="url(#gradStaking)" />
              <Area type="monotone" dataKey="liquidité" name="Liquidité" stroke="#10b981" strokeWidth={2} fill="url(#gradLiq)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly stacked revenue */}
      <div className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Calendar} title="Revenus Mensuels Empilés" sub="Staking · Liquidité · Frais de trading" color="text-chart-4" />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_REVENUE} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v} AQ`} />
              <Tooltip content={<ChartTooltip suffix=" AQ" />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="staking"   name="Staking"   stackId="a" fill="#3b82f6" />
              <Bar dataKey="liquidity" name="Liquidité"  stackId="a" fill="#10b981" />
              <Bar dataKey="fees"      name="Frais"      stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TX history table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <SectionTitle icon={Activity} title="Historique des Transactions" sub="Dernières opérations" />
        <div className="space-y-2">
          {TOP_TX.map((tx, i) => {
            const Icon = TYPE_ICON[tx.type] ?? Activity;
            const isIn = tx.amount.startsWith("+");
            return (
              <div key={i} className="flex items-center gap-4 bg-secondary/40 rounded-xl px-4 py-3 flex-wrap">
                <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{tx.type}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{tx.date}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-bold font-mono", isIn ? "text-green-400" : "text-foreground")}>{tx.amount}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.usd}</p>
                </div>
                <Badge variant="outline" className={cn("text-[9px] shrink-0 w-16 justify-center", STATUS_COLOR[tx.status])}>
                  {tx.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}