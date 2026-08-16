import { Search, Hexagon, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export default function TopBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const displayName = user?.full_name || user?.email || "Opérateur";
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      data-testid="topbar"
      className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 gap-3 bg-card/50 backdrop-blur-sm sticky top-0 z-30"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            data-testid="topbar-search-input"
            type="text"
            placeholder="Rechercher..."
            className="h-9 w-full pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Badge
          variant="outline"
          className="hidden md:inline-flex bg-primary/5 text-primary border-primary/20 font-mono text-xs"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
          AEGIS MILITARY — LIVE
        </Badge>
        <NotificationCenter />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            data-testid="topbar-user-menu-btn"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all",
              open && "border-primary/50"
            )}
          >
            <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              {user ? (
                <span className="text-[10px] font-bold text-primary tracking-wider">
                  {initials}
                </span>
              ) : (
                <Hexagon className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-[11px] font-medium text-foreground truncate max-w-[140px]">
                {displayName}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground tracking-wider uppercase">
                {user?.role || "operator"}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </button>

          {open && (
            <div
              data-testid="topbar-user-menu"
              className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl shadow-primary/10 overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-medium text-foreground truncate">
                  {user?.email || "anonymous"}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">
                  ID · {user?.id ? user.id.slice(0, 8) : "—"}
                </p>
              </div>
              <div className="py-1">
                <button
                  data-testid="topbar-profile-btn"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  Profil opérateur
                </button>
                <button
                  data-testid="topbar-logout-btn"
                  onClick={() => {
                    setOpen(false);
                    logout(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
