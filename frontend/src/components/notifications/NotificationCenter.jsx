import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, Trash2, AlertTriangle, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";

const SEV_ICON = {
  critical: AlertTriangle,
  warning:  Zap,
  info:     Info,
};

const SEV_COLOR = {
  critical: "text-red-400",
  warning:  "text-accent",
  info:     "text-primary",
};

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

// ── Toast for newest notification ────────────────────────
function Toast({ notif, cats, onDismiss }) {
  const cfg = cats[notif.category];
  const Icon = SEV_ICON[notif.severity] ?? Info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 5000);
    return () => clearTimeout(t);
  }, [notif.id]);

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 max-w-sm w-full border rounded-xl p-4 shadow-2xl backdrop-blur-md",
      "animate-in slide-in-from-right-4 duration-300",
      cfg.darkBg, cfg.border
    )}>
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${cfg.color}22` }}>
          <Icon className="h-4 w-4" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className="text-[9px] px-1.5" style={{ color: cfg.color, borderColor: `${cfg.color}44` }}>
              {cfg.label}
            </Badge>
            {notif.severity === "critical" && (
              <span className="text-[9px] text-red-400 font-bold animate-pulse">● CRITIQUE</span>
            )}
          </div>
          <p className="text-xs font-bold text-foreground">{notif.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Notification panel ────────────────────────────────────
function NotifPanel({ notifications, cats, onMarkRead, onMarkAllRead, onDismiss, onClearAll, onClose }) {
  const [filter, setFilter] = useState("all");

  const filtered = notifications.filter(n => filter === "all" ? true : filter === "unread" ? !n.read : n.category === filter);
  const categories = [...new Set(notifications.map(n => n.category))];

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5">
              {notifications.filter(n => !n.read).length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMarkAllRead} title="Tout marquer comme lu"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClearAll} title="Tout effacer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto no-scrollbar">
        {["all", "unread", ...categories].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all shrink-0",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>
            {f === "all" ? "Toutes" : f === "unread" ? "Non lues" : cats[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[420px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Aucune notification</p>
          </div>
        ) : (
          filtered.map(n => {
            const cfg = cats[n.category];
            const Icon = SEV_ICON[n.severity] ?? Info;
            return (
              <div key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-secondary/30",
                  !n.read && "bg-secondary/20"
                )}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${cfg.color}18` }}>
                  <Icon className={cn("h-4 w-4", SEV_COLOR[n.severity])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(n.ts)}</span>
                  </div>
                  <p className={cn("text-xs font-semibold", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
                  <button onClick={e => { e.stopPropagation(); onDismiss(n.id); }}
                    className="text-muted-foreground hover:text-red-400 transition-colors mt-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main exported component ───────────────────────────────
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [toastNotif, setToastNotif] = useState(null);
  const prevLenRef = useRef(null);
  const panelRef = useRef(null);

  const { notifications, unread, markRead, markAllRead, dismiss, clearAll, CATEGORIES } = useNotifications();

  // Show toast for new incoming notifications
  useEffect(() => {
    if (prevLenRef.current !== null && notifications.length > prevLenRef.current) {
      setToastNotif(notifications[0]);
    }
    prevLenRef.current = notifications.length;
  }, [notifications.length]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      {/* Bell button */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <NotifPanel
            notifications={notifications}
            cats={CATEGORIES}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDismiss={dismiss}
            onClearAll={clearAll}
            onClose={() => setOpen(false)}
          />
        )}
      </div>

      {/* Toast */}
      {toastNotif && (
        <Toast
          notif={toastNotif}
          cats={CATEGORIES}
          onDismiss={() => setToastNotif(null)}
        />
      )}
    </>
  );
}