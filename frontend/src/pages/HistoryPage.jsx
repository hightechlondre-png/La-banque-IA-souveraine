import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileDown, Filter, Calendar, CheckCircle, Clock, XCircle, Download } from "lucide-react";

// Sample transaction data
const TRANSACTIONS = [
  { id: "TX-001", type: "staking",    amount: 50000,  pool: "Gold",     status: "completed", date: "2026-04-10", action: "Dépôt" },
  { id: "TX-002", type: "governance", amount: 0,      action: "Vote",   status: "completed", date: "2026-04-09", proposal: "Inflation -0.2%" },
  { id: "TX-003", type: "staking",    amount: 12500,  pool: "Gold",     status: "completed", date: "2026-04-08", action: "Gains" },
  { id: "TX-004", type: "governance", amount: 0,      action: "Propose",status: "completed", date: "2026-04-07", proposal: "Burn Rate +0.5%" },
  { id: "TX-005", type: "staking",    amount: 100000, pool: "Silver",   status: "completed", date: "2026-04-05", action: "Dépôt" },
  { id: "TX-006", type: "staking",    amount: 8500,   pool: "Bronze",   status: "pending",   date: "2026-04-04", action: "Dépôt" },
  { id: "TX-007", type: "governance", amount: 0,      action: "Vote",   status: "completed", date: "2026-04-03", proposal: "Resonance Threshold" },
  { id: "TX-008", type: "staking",    amount: 25000,  pool: "Gold",     status: "completed", date: "2026-04-01", action: "Gain" },
  { id: "TX-009", type: "staking",    amount: 200000, pool: "Sovereign",status: "completed", date: "2026-03-28", action: "Dépôt" },
  { id: "TX-010", type: "governance", amount: 0,      action: "Vote",   status: "failed",    date: "2026-03-25", proposal: "Lock 6M Bonus" },
];

const TYPE_LABELS = { staking: "Staking", governance: "Gouvernance" };
const TYPE_COLORS = { staking: "border-chart-2/30 text-chart-2", governance: "border-accent/30 text-accent" };
const STATUS_LABELS = { completed: "Complété", pending: "En attente", failed: "Échoué" };
const STATUS_ICONS = {
  completed: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  pending: { icon: Clock, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

function exportCSV(data) {
  const headers = ["ID", "Type", "Action", "Montant (AQ)", "Pool/Proposal", "Statut", "Date"];
  const csvContent = [
    headers.join(","),
    ...data.map(t =>
      [
        t.id,
        TYPE_LABELS[t.type],
        t.action || "N/A",
        t.amount,
        t.pool || t.proposal || "-",
        STATUS_LABELS[t.status],
        t.date,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `AEGIS-Q_Historique_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

export default function HistoryPage() {
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return TRANSACTIONS.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (searchQuery && !t.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !t.action.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(t.proposal && t.proposal.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      return true;
    });
  }, [filterType, filterStatus, searchQuery]);

  const totalAmount = filtered.filter(t => t.type === "staking").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Historique des Transactions</h2>
          <p className="text-sm text-muted-foreground mt-1">Staking · Gouvernance — Filtres et export fiscal</p>
        </div>
        <Button onClick={() => exportCSV(filtered)} className="gap-2">
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Transactions", value: filtered.length, icon: "📊" },
          { label: "Total Staké (AQ)", value: totalAmount.toLocaleString("fr-FR"), icon: "💰" },
          { label: "Complétées", value: filtered.filter(t => t.status === "completed").length, icon: "✓" },
          { label: "Votes Gouvernance", value: filtered.filter(t => t.type === "governance").length, icon: "🗳️" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <span className="text-2xl mb-2 block">{k.icon}</span>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-lg font-bold text-foreground font-mono mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Filtres</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Chercher par ID, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Type */}
          <div className="flex gap-1.5">
            {["all", "staking", "governance"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
                  filterType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "all" ? "Tous" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex gap-1.5">
            {["all", "completed", "pending", "failed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
                  filterStatus === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "Tous" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-left font-semibold text-foreground">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Action</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Montant</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Détails</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Statut</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((tx) => {
                  const statusCfg = STATUS_ICONS[tx.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{tx.id}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px]", TYPE_COLORS[tx.type])}>
                          {TYPE_LABELS[tx.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{tx.action}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {tx.amount > 0 ? `${tx.amount.toLocaleString("fr-FR")} AQ` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.pool && <span className="text-accent">{tx.pool}</span>}
                        {tx.proposal && <span className="text-chart-2">{tx.proposal}</span>}
                        {!tx.pool && !tx.proposal && "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px]", statusCfg.bg)}>
                          <StatusIcon className={cn("h-3 w-3 mr-1", statusCfg.color)} />
                          {STATUS_LABELS[tx.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{tx.date}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                    Aucune transaction ne correspond aux filtres
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Staking", value: `${totalAmount.toLocaleString("fr-FR")} AQ`, color: "text-chart-2" },
          { label: "Transactions Complétées", value: filtered.filter(t => t.status === "completed").length, color: "text-green-400" },
          { label: "Votes Gouvernance", value: filtered.filter(t => t.type === "governance").length, color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}