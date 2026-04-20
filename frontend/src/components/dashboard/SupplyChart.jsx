import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", supply: 1000 },
  { month: "Fév", supply: 1000 },
  { month: "Mar", supply: 1002 },
  { month: "Avr", supply: 1005 },
  { month: "Mai", supply: 1008 },
  { month: "Jun", supply: 1010 },
  { month: "Jul", supply: 1012 },
  { month: "Aoû", supply: 1015 },
  { month: "Sep", supply: 1017 },
  { month: "Oct", supply: 1018 },
  { month: "Nov", supply: 1019 },
  { month: "Déc", supply: 1020 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-primary font-mono">{payload[0].value}M AQ</p>
      </div>
    );
  }
  return null;
};

export default function SupplyChart() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Supply — Inflation Contrôlée IA</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">+2.0% / AN</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
            <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="supply"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fill="url(#supplyGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}