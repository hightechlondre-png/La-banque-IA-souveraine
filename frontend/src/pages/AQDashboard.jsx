import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import NotificationContainer from "@/components/NotificationContainer";
import { useNotificationSystem } from "@/hooks/useNotificationSystem";
import StakingCalculator from "@/components/StakingCalculator";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, Coins, Lock, Vote,
  Activity, Zap, Users, RefreshCw
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function fmt(n, d = 2) { return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

// ── Generate 90 days of price history ─────────────────────
function genPriceHistory() {
  let price = 8.42;
  return Array.from({ length: 90 }, (_, i) => {
    const d = new Date("2026-01-12");
    d.setDate(d.getDate() + i);
    price = Math.max(5, price + rand(-0.4, 0.52));
    const vol = Math.round(rand(800000, 4200000));
    return {
      date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      price: parseFloat(price.toFixed(3)),
      vol,
      ma7: 0,
      ma20: 0,
    };
  });
}

function addMA(data, key, window) {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, r) => s + r.price, 0) / slice.length;
    return { ...d, [key]: parseFloat(avg.toFixed(3)) };
  });
}

// ── Generate 12 months staking volumes ───────────────────
function genStakingHistory() {
  const months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  let bronze = 30, silver = 90, gold = 180, sovereign = 8;
  return months.map((m) => {
    bronze   = Math.max(10,  bronze   + rand(-5, 8));
    silver   = Math.max(50,  silver   + rand(-8, 12));
    gold     = Math.max(100, gold     + rand(-10, 15));
    sovereign= Math.max(5,   sovereign+ rand(-1, 2));
    return {
      month: m,
      Bronze: parseFloat(bronze.toFixed(1)),
      Silver: parseFloat(silver.toFixed(1)),
      Gold:   parseFloat(gold.toFixed(1)),
      Sovereign: parseFloat(sovereign.toFixed(1)),
      total:  parseFloat((bronze + silver + gold + sovereign).toFixed(1)),
    };
  });
}

// ── Generate governance data ───────────────────────────────
const GOV_PROPOSALS = [
  { name: "Inflation −0.2%", pour: 68, contre: 32, quorum: 71, status: "passed"  },
  { name: "Burn +0.5%",      pour: 54, contre: 46, quorum: 71, status: "active"  },
  { name: "Decay Rate ×0.9", pour: 41, contre: 59, quorum: 71, status: "active"  },
  { name: "Seuil résonance",  pour: 79, contre: 21, quorum: 71, status: "passed"  },
  { name: "Lock 6M bonus",   pour: 33, contre: 67, quorum: 71, status: "rejected"},
];

const PARTICIPATION_DATA = [
  { week: "S-8", participation: 42, aqVoted: 18.2 },
  { week: "S-7", participation: 48, aqVoted: 20.8 },
  { week: "S-6", participation: 44, aqVoted: 19.1 },
  { week: "S-5", participation: 51, aqVoted: 22.3 },
  { week: "S-4", participation: 55, aqVoted: 24.0 },
  { week: "S-3", participation: 60, aqVoted: 26.5 },
  { week: "S-2", participation: 58, aqVoted: 25.1 },
  { week: "S-1", participation: 63, aqVoted: 27.8 },
  { week: "S0",  participation: 67, aqVoted: 29.4 },
];

const HOLDER_DIST = [
  { name: "Whales (>1M)",    value: 38, color: "#8b5cf6" },
  { name: "Institutions",    value: 27, color: "#3b82f6" },
  { name: "Stakers",         value: 22, color: "#10b981" },
  { name: "Retail",          value: 13, color: "#f59e0b" },
];

// ── Custom tooltip ────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
          <span className="font-mono text-foreground ml-auto">
            {typeof p.value === "number" && p.value < 1000
              ? p.value.toFixed(p.value < 10 ? 3 : 1)
              : Number(p.value).toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, change, up, color = "text-primary" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn("h-4 w-4", color)} />
        {change !== undefined && (
          <span className={cn("text-[10px] font-mono font-bold flex items-center gap-0.5",
            up ? "text-green-400" : "text-red-400")}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold font-mono mt-0.5", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────
function SectionHeader({ title, sub, badge }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-1.5" />
          {badge}
        </Badge>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function AQDashboard() {
  const [priceRange, setPriceRange] = useState("90j");
  const [livePrice, setLivePrice] = useState(8.847);
  const [liveStaked, setLiveStaked] = useState(387.4);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { notifications, addNotification, removeNotification } = useNotificationSystem();
  const [notifiedThresholds, setNotifiedThresholds] = useState({ staking: false, governance: false });

  const rawPrices = addMA(addMA(genPriceHistory(), "ma7", 7), "ma20", 20);
  const rangeMap = { "30j": 30, "60j": 60, "90j": 90 };
  const priceData = rawPrices.slice(-rangeMap[priceRange]);
  const stakingData = genStakingHistory();

  // Live price ticker + threshold monitoring
  useEffect(() => {
    const t = setInterval(() => {
      setLivePrice((p) => parseFloat(Math.max(7, p + rand(-0.015, 0.018)).toFixed(3)));
      setLiveStaked((s) => {
        const newVal = parseFloat((s + rand(-0.05, 0.08)).toFixed(1));
        if (newVal >= 400 && !notifiedThresholds.staking) {
          addNotification("🎯 Seuil de staking atteint : 400M AQ verrouillés !", "staking", 6000);
          setNotifiedThresholds(prev => ({ ...prev, staking: true }));
        }
        return newVal;
      });
      setLastRefresh(new Date());
    }, 3000);
    return () => clearInterval(t);
  }, [notifiedThresholds.staking, addNotification]);

  useEffect(() => {
    const hasActive = GOV_PROPOSALS.some(p => p.status === "active");
    if (hasActive && !notifiedThresholds.governance) {
      const activeProposals = GOV_PROPOSALS.filter(p => p.status === "active");
      addNotification(`📋 ${activeProposals.length} nouvelle(s) proposition(s) de gouvernance active(s)`, "governance", 7000);
      setNotifiedThresholds(prev => ({ ...prev, governance: true }));
    }
  }, [notifiedThresholds.governance, addNotification]);

  const priceChange = ((livePrice - 8.42) / 8.42 * 100).toFixed(2);
  const priceUp = livePrice >= 8.42;

  const currentStaking = stakingData[stakingData.length - 1];
  const govParticipation = PARTICIPATION_DATA[PARTICIPATION_DATA.length - 1].participation;

  return (
    <>
    <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard AQ — Performances</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Token · Staking · Gouvernance — Données temps réel
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin-slow" />
          Mise à jour : {lastRefresh.toLocaleTimeString("fr-FR")}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Coins}    label="Prix AQ"           value={`$${livePrice}`}      sub="USD"            change={`${priceUp ? "+" : ""}${priceChange}%`} up={priceUp}    color="text-accent" />
        <KpiCard icon={Activity} label="Capitalisation"    value="$847M"                sub="Fully diluted"  change="+12.4%"  up={true}  color="text-primary" />
        <KpiCard icon={Lock}     label="Total Staké"       value={`${fmt(liveStaked)}M`} sub="AQ verrouillés" change="+1.8%"   up={true}  color="text-chart-2" />
        <KpiCard icon={Vote}     label="Participation Gov" value={`${govParticipation}%`} sub="dernier vote"  change="+4pt"    up={true}  color="text-chart-4" />
      </div>

      {/* ── Section 1 : Prix AQ ─────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <SectionHeader title="Performance du Token AQ" sub="Cours USD · Moyennes mobiles MA7 / MA20" badge="Live" />
          <div className="flex gap-1.5 -mt-4">
            {["30j", "60j", "90j"].map((r) => (
              <button key={r} onClick={() => setPriceRange(r)}
                className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                  priceRange === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Live price banner */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className={cn("text-3xl font-black font-mono", priceUp ? "text-green-400" : "text-red-400")}>
            ${livePrice}
          </div>
          <div className={cn("flex items-center gap-1 text-sm font-bold",
            priceUp ? "text-green-400" : "text-red-400")}>
            {priceUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {priceUp ? "+" : ""}{priceChange}% (90j)
          </div>
          <div className="flex gap-4 text-xs ml-auto flex-wrap">
            {[
              { label: "24h High", val: `$${(livePrice * 1.032).toFixed(3)}` },
              { label: "24h Low",  val: `$${(livePrice * 0.971).toFixed(3)}` },
              { label: "Vol 24h",  val: "$2.84M" },
            ].map((k) => (
              <div key={k.label}>
                <p className="text-muted-foreground">{k.label}</p>
                <p className="font-mono font-semibold text-foreground">{k.val}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                interval={Math.floor(priceData.length / 8)} />
              <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                tickFormatter={(v) => `$${v.toFixed(2)}`} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="price" name="Prix AQ"
                stroke="#f59e0b" strokeWidth={2} fill="url(#gradPrice)" />
              <Line type="monotone" dataKey="ma7"  name="MA7"  stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="ma20" name="MA20" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Volume bars */}
        <div className="h-16 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }} barSize={3}>
              <Bar dataKey="vol" name="Volume" fill="#3b82f6" opacity={0.5} radius={[2, 2, 0, 0]} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-1">Volume journalier (AQ)</p>
      </div>

      {/* ── Section 2 : Staking ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Staking area chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <SectionHeader title="Volumes de Staking" sub="Évolution mensuelle par pool (M AQ)" badge="Live" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stakingData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  {[
                    { key: "Bronze",    color: "#f59e0b" },
                    { key: "Silver",    color: "#94a3b8" },
                    { key: "Gold",      color: "#eab308" },
                    { key: "Sovereign", color: "#8b5cf6" },
                  ].map(({ key, color }) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={(v) => `${v}M`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {[
                  { key: "Bronze",    color: "#f59e0b" },
                  { key: "Silver",    color: "#94a3b8" },
                  { key: "Gold",      color: "#eab308" },
                  { key: "Sovereign", color: "#8b5cf6" },
                ].map(({ key, color }) => (
                  <Area key={key} type="monotone" dataKey={key} stackId="a"
                    stroke={color} strokeWidth={1.5} fill={`url(#grad-${key})`} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Staking KPI strip */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "Bronze",    val: `${currentStaking.Bronze.toFixed(0)}M`,    color: "text-amber-500"   },
              { label: "Silver",    val: `${currentStaking.Silver.toFixed(0)}M`,    color: "text-slate-400"   },
              { label: "Gold",      val: `${currentStaking.Gold.toFixed(0)}M`,      color: "text-yellow-400"  },
              { label: "Sovereign", val: `${currentStaking.Sovereign.toFixed(1)}M`, color: "text-chart-4"     },
            ].map((k) => (
              <div key={k.label} className="bg-secondary/40 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className={cn("text-sm font-bold font-mono", k.color)}>{k.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Holder distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionHeader title="Distribution Holders" sub="Répartition du supply circulant" />
          <div className="h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={HOLDER_DIST} cx="50%" cy="50%"
                  innerRadius={52} outerRadius={76}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {HOLDER_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {HOLDER_DIST.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                <span className="text-xs font-mono font-bold text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3 : Gouvernance ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Participation chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionHeader title="Participation Gouvernance" sub="% de holders votants · AQ engagés (M)" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={PARTICIPATION_DATA} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis yAxisId="pct" domain={[30, 80]} axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="aq" orientation="right" axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }}
                  tickFormatter={(v) => `${v}M`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <ReferenceLine yAxisId="pct" y={51} stroke="hsl(222,30%,28%)" strokeDasharray="4 3"
                  label={{ value: "Quorum", position: "right", fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Line yAxisId="pct" type="monotone" dataKey="participation" name="Participation %"
                  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="aq" type="monotone" dataKey="aqVoted" name="AQ Votés (M)"
                  stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Staking Calculator */}
        <StakingCalculator />
      </div>

      {/* ── Section 4 : Proposals ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Proposals */}
        <div className="bg-card border border-border rounded-xl p-5">
          <SectionHeader title="Propositions de Gouvernance" sub="Résultats des votes récents" />
          <div className="space-y-3">
            {GOV_PROPOSALS.map((p) => {
              const passed   = p.status === "passed";
              const rejected = p.status === "rejected";
              const active   = p.status === "active";
              return (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{p.name}</span>
                    <Badge variant="outline" className={cn("text-[10px]",
                      passed   ? "border-green-500/30 text-green-400" :
                      rejected ? "border-red-500/30 text-red-400" :
                                 "border-accent/30 text-accent")}>
                      {passed ? "✓ Adoptée" : rejected ? "✗ Rejetée" : "⏳ En vote"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-secondary">
                    <div className="h-full bg-green-500 transition-all"
                      style={{ width: `${p.pour}%`, opacity: 0.8 }} />
                    <div className="h-full bg-red-500 transition-all"
                      style={{ width: `${p.contre}%`, opacity: 0.8 }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="text-green-400">{p.pour}% Pour</span>
                    <span className="text-red-400">{p.contre}% Contre</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gov KPIs */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "Propositions",  val: GOV_PROPOSALS.length },
              { label: "Adoptées",      val: GOV_PROPOSALS.filter(p => p.status === "passed").length },
              { label: "En cours",      val: GOV_PROPOSALS.filter(p => p.status === "active").length },
            ].map((k) => (
              <div key={k.label} className="bg-secondary/40 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold font-mono text-foreground">{k.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}