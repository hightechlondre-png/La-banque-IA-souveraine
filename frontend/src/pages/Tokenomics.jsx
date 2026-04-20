import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { Coins, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const allocation = [
  { name: "Écosystème Jeu Vivant", value: 40, tokens: "40,000,000", color: "hsl(217, 91%, 60%)" },
  { name: "Réserve IA / Infrastructure", value: 20, tokens: "20,000,000", color: "hsl(160, 60%, 45%)" },
  { name: "Investisseurs Privés", value: 15, tokens: "15,000,000", color: "hsl(45, 93%, 58%)" },
  { name: "Staking Technologique", value: 10, tokens: "10,000,000", color: "hsl(280, 65%, 60%)" },
  { name: "Sécurité & Audit", value: 10, tokens: "10,000,000", color: "hsl(340, 75%, 55%)" },
  { name: "Fondation Souveraine", value: 5, tokens: "5,000,000", color: "hsl(200, 70%, 50%)" },
];

const flowIn = [
  { name: "Joueurs", value: 35 },
  { name: "Investisseurs", value: 25 },
  { name: "Vente Assets", value: 22 },
  { name: "Location IA", value: 18 },
];

const flowOut = [
  { name: "Achats Jeu", value: 30 },
  { name: "Staking", value: 28 },
  { name: "Invest. IA", value: 25 },
  { name: "Marketplace", value: 17 },
];

export default function Tokenomics() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Tokenomics</h2>
        <p className="text-sm text-muted-foreground mt-1">Structure monétaire professionnelle AEGIS-Q</p>
      </div>

      {/* Token Info */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Coins className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Token</p>
              <p className="text-xl font-bold text-foreground">AEGIS-Q</p>
            </div>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block" />
          <div>
            <p className="text-xs text-muted-foreground">Symbole</p>
            <p className="text-lg font-mono font-bold text-foreground">AQ</p>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block" />
          <div>
            <p className="text-xs text-muted-foreground">Supply Max</p>
            <p className="text-lg font-mono font-bold text-foreground">100,000,000</p>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block" />
          <div>
            <p className="text-xs text-muted-foreground">Décimales</p>
            <p className="text-lg font-mono font-bold text-foreground">18</p>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block" />
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">Privée Hybride</Badge>
          </div>
        </div>
      </div>

      {/* Allocation Table + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Répartition Stratégique</h3>
          <div className="space-y-3">
            {allocation.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground font-medium">{item.name}</span>
                    <span className="text-sm font-mono font-semibold text-foreground">{item.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.tokens} AQ</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex items-center justify-center">
          <div className="w-56 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                  {allocation.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-xs text-foreground font-medium">{payload[0].name}</p>
                    <p className="text-sm font-bold text-primary font-mono">{payload[0].value}%</p>
                  </div>
                ) : null} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Economy Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-semibold text-foreground">Entrée de monnaie</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowIn} layout="vertical" barSize={16}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} width={90} />
                <Bar dataKey="value" fill="hsl(160, 60%, 45%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-foreground">Sortie de monnaie</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOut} layout="vertical" barSize={16}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} width={90} />
                <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monetary Policy */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Politique Monétaire IA</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Inflation Initiale", value: "2.00% / an", sub: "Contrôlée par AUDIT-DS", color: "text-accent" },
            { label: "Decay Rate", value: "−0.20% / an", sub: "Compression annuelle", color: "text-red-400" },
            { label: "Burn Transaction", value: "1.5%", sub: "+ smart contract burns", color: "text-orange-400" },
            { label: "Objectif Net", value: "Déflationnaire", sub: "Après 5 ans", color: "text-green-400" },
          ].map((item) => (
            <div key={item.label} className="bg-secondary/50 rounded-xl p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
              <p className={`text-base font-bold font-mono ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* 5-year projection */}
        <div className="mt-4 bg-secondary/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Projection Supply sur 5 ans (simulation)</p>
          <div className="flex items-end gap-2 h-16">
            {[
              { year: "An 1", supply: 100, inf: "+2%" },
              { year: "An 2", supply: 101.3, inf: "+1.8%" },
              { year: "An 3", supply: 101.8, inf: "+1.4%" },
              { year: "An 4", supply: 101.5, inf: "+0.9%" },
              { year: "An 5", supply: 100.7, inf: "−0.3%" },
            ].map((d, i, arr) => {
              const max = Math.max(...arr.map(x => x.supply));
              const h = Math.round((d.supply / max) * 100);
              const isDown = i > 0 && d.supply < arr[i-1].supply;
              return (
                <div key={d.year} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-[9px] font-mono font-bold ${isDown ? 'text-green-400' : 'text-accent'}`}>{d.inf}</span>
                  <div className="w-full rounded-t-sm transition-all"
                    style={{ height: `${h}%`, background: isDown ? 'hsl(160,60%,45%)' : 'hsl(45,93%,58%)', opacity: 0.8 }} />
                  <span className="text-[9px] text-muted-foreground">{d.year}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Structure Juridique — Delaware</h3>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="outline" className="border-accent/30 text-accent">AEGIS Labs LLC</Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="border-primary/30 text-primary">AEGIS Finance LLC</Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="border-chart-2/30 text-chart-2">AEGIS-Q Token</Badge>
        </div>
      </div>
    </div>
  );
}