import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Écosystème Jeu", value: 40, color: "hsl(217, 91%, 60%)" },
  { name: "Réserve IA", value: 20, color: "hsl(160, 60%, 45%)" },
  { name: "Investisseurs", value: 15, color: "hsl(45, 93%, 58%)" },
  { name: "Staking", value: 10, color: "hsl(280, 65%, 60%)" },
  { name: "Sécurité & Audit", value: 10, color: "hsl(340, 75%, 55%)" },
  { name: "Fondation", value: 5, color: "hsl(200, 70%, 50%)" },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs font-medium text-foreground">{payload[0].name}</p>
        <p className="text-sm font-bold text-primary font-mono">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export default function TokenDistribution() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Répartition AEGIS-Q</h3>
      <div className="flex items-center gap-4">
        <div className="w-40 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <span className="font-mono font-semibold text-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}