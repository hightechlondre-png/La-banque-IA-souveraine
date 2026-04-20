import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Coins, Lock, Vote, Wallet, Shield, Brain, 
  ChevronLeft, ChevronRight, Hexagon, Network, FileSearch, BarChart2, Map, Activity, FileDown, Zap, ShieldCheck, Gauge, Wrench, Radio, BarChart, Globe, Scale, ScanLine, ArrowLeftRight, Droplets, FileText, Bell, Cpu, GitGraph, Wrench as WrenchIcon, BookOpen, FileBarChart, Presentation, MonitorDot
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/tokenomics", label: "Tokenomics", icon: Coins },
  { path: "/staking", label: "Staking", icon: Lock },
  { path: "/governance", label: "Gouvernance", icon: Vote },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/security", label: "Sécurité", icon: Shield },
  { path: "/audit-ds", label: "AUDIT-DS", icon: Brain },
  { path: "/sentinel", label: "Sentinel", icon: Hexagon },
  { path: "/nmem-a", label: "N-MEM-A", icon: Brain },
  { path: "/nmem-b", label: "N-MEM-B", icon: Network },
  { path: "/fractal-engine", label: "Fractal Engine", icon: Brain },
  { path: "/graph-view", label: "Graphe N-MEM-B", icon: Network },
  { path: "/audit-trail", label: "Audit Trail", icon: FileSearch },
  { path: "/analytics", label: "Rapports Analytiques", icon: BarChart2 },
  { path: "/governance-ai", label: "Gouvernance Monétaire", icon: Vote },
  { path: "/strategic", label: "Intel Stratégique", icon: Map },
  { path: "/security-audit", label: "Audit Sécurité", icon: FileSearch },
  { path: "/fractal-sim", label: "Simulation 3D", icon: Brain },
  { path: "/predictive", label: "Prédictif 24h", icon: Activity },
  { path: "/executive", label: "Rapport Exécutif", icon: FileDown },
  { path: "/quantum-sim", label: "Attaques Quantiques", icon: Zap },
  { path: "/compliance", label: "Conformité Temps Réel", icon: ShieldCheck },
  { path: "/stress", label: "Stress Test Réseau", icon: Gauge },
  { path: "/maintenance", label: "Maintenance Prédictive", icon: Wrench },
  { path: "/iot", label: "Flux IoT Temps Réel", icon: Radio },
  { path: "/resources", label: "Ressources Clusters", icon: BarChart },
  { path: "/listing", label: "Token Listing Guide", icon: Globe },
  { path: "/dao", label: "DAO Gouvernance", icon: Scale },
  { path: "/contract-audit", label: "Audit Smart Contracts", icon: ScanLine },
  { path: "/zkp", label: "Zero-Knowledge Proofs", icon: Lock },
  { path: "/ai-audit", label: "Audit IA Contrats", icon: ScanLine },
  { path: "/liquidity", label: "Fourniture Liquidité", icon: Droplets },
  { path: "/bridge", label: "Bridge Cross-Chain", icon: ArrowLeftRight },
  { path: "/advanced-analytics", label: "Analytics Avancées", icon: BarChart2 },
  { path: "/user-analytics", label: "Analytics Utilisateur", icon: BarChart2 },
  { path: "/security-scanner", label: "Scanner Sécurité IA", icon: Shield },
  { path: "/cognitive-ai", label: "Cognitive AI · Gemma", icon: Brain },
  { path: "/aq-dashboard", label: "Dashboard AQ Perfs", icon: BarChart2 },
  { path: "/history", label: "Historique Transactions", icon: FileText },
  { path: "/telegram-alerts", label: "Alertes Telegram AQ", icon: Bell },
  { path: "/agents", label: "Orchestrateur Agents IA", icon: Cpu },
  { path: "/agent-network", label: "Réseau Agents Autonomes", icon: GitGraph },
  { path: "/skills", label: "Gestionnaire de Skills", icon: WrenchIcon },
  { path: "/knowledge-base", label: "Base de Connaissances RAG", icon: BookOpen },
  { path: "/agent-reports", label: "Rapports Performance IA", icon: FileBarChart },
  { path: "/brochure", label: "Plaquette SaaS", icon: Presentation },
  { path: "/monitor", label: "Monitoring Temps Réel", icon: MonitorDot },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-[72px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-wide">AEGIS-Q</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest">MILITARY FINANCE</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}