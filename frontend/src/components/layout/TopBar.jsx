import { Search, Hexagon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import NotificationCenter from "@/components/notifications/NotificationCenter";

export default function TopBar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="h-9 w-64 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
          AEGIS MILITARY — LIVE
        </Badge>
        <NotificationCenter />
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Hexagon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </header>
  );
}