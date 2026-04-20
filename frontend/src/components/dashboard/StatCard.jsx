import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, change, changeType = "up", suffix = "" }) {
  return (
    <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300">
      <div className="absolute inset-0 rounded-xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          {change && (
            <span className={cn(
              "text-xs font-mono font-medium px-2 py-0.5 rounded-full",
              changeType === "up" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
            )}>
              {changeType === "up" ? "+" : ""}{change}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {value}<span className="text-sm text-muted-foreground ml-1">{suffix}</span>
        </p>
      </div>
    </div>
  );
}