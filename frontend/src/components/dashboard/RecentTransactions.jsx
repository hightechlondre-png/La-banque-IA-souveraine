import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const transactions = [
  { type: "in", from: "0x7a3f...9e2d", amount: "+50,000 AQ", label: "Staking Reward", time: "2 min" },
  { type: "out", from: "0x4b1c...8f3a", amount: "-12,500 AQ", label: "Marketplace", time: "15 min" },
  { type: "in", from: "0x9d5e...1c7b", amount: "+200,000 AQ", label: "Investisseur", time: "1h" },
  { type: "out", from: "0x2f8a...6d4e", amount: "-5,000 AQ", label: "Achat In-Game", time: "3h" },
  { type: "in", from: "0x6c2d...3a9f", amount: "+75,000 AQ", label: "Location IA", time: "5h" },
];

export default function RecentTransactions() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Transactions Récentes</h3>
      <div className="space-y-3">
        {transactions.map((tx, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              tx.type === "in" ? "bg-green-500/10" : "bg-red-500/10"
            )}>
              {tx.type === "in" 
                ? <ArrowDownLeft className="h-4 w-4 text-green-400" /> 
                : <ArrowUpRight className="h-4 w-4 text-red-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{tx.label}</p>
              <p className="text-xs text-muted-foreground font-mono">{tx.from}</p>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-sm font-mono font-semibold",
                tx.type === "in" ? "text-green-400" : "text-red-400"
              )}>
                {tx.amount}
              </p>
              <p className="text-[10px] text-muted-foreground">{tx.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}