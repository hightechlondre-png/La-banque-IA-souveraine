import { cn } from "@/lib/utils";
import { X, AlertCircle, CheckCircle, Info, Bell } from "lucide-react";

export default function NotificationContainer({ notifications, onRemove }) {
  const typeConfig = {
    success: { bg: "bg-green-500/10", border: "border-green-500/20", icon: CheckCircle, color: "text-green-400" },
    error: { bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertCircle, color: "text-red-400" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertCircle, color: "text-amber-400" },
    info: { bg: "bg-primary/10", border: "border-primary/20", icon: Info, color: "text-primary" },
    staking: { bg: "bg-chart-2/10", border: "border-chart-2/20", icon: Bell, color: "text-chart-2" },
    governance: { bg: "bg-accent/10", border: "border-accent/20", icon: Bell, color: "text-accent" },
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm">
      {notifications.map((notif) => {
        const cfg = typeConfig[notif.type] || typeConfig.info;
        const Icon = cfg.icon;
        
        return (
          <div
            key={notif.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border pointer-events-auto",
              "animate-in slide-in-from-right-full duration-300",
              cfg.bg,
              cfg.border
            )}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
            <p className="text-sm text-foreground flex-1">{notif.message}</p>
            <button
              onClick={() => onRemove(notif.id)}
              className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}