import { Coins, Users, TrendingUp, Lock } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import TokenDistribution from "../components/dashboard/TokenDistribution";
import NetworkStatus from "../components/dashboard/NetworkStatus";
import SupplyChart from "../components/dashboard/SupplyChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import ArchitectureMap from "../components/dashboard/ArchitectureMap";
import ResonanceChart from "../components/dashboard/ResonanceChart";
import MarketPulse from "../components/dashboard/MarketPulse";
import RucheSavingsCompact from "../components/dashboard/RucheSavingsCompact";

export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">AEGIS-Q — Banque IA Souveraine</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Coins} label="Total Supply" value="100M" suffix="AQ" change="2.0%" changeType="up" />
        <StatCard icon={TrendingUp} label="Capitalisation" value="$847M" change="12.4%" changeType="up" />
        <StatCard icon={Users} label="Holders" value="24,871" change="3.2%" changeType="up" />
        <StatCard icon={Lock} label="Staked" value="38.7%" change="1.8%" changeType="up" />
      </div>

      {/* Ruche Savings (rétention) */}
      <RucheSavingsCompact />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SupplyChart />
        </div>
        <MarketPulse />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TokenDistribution />
        <ResonanceChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentTransactions />
        <NetworkStatus />
        <ArchitectureMap />
      </div>
    </div>
  );
}