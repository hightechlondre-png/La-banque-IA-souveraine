import { Vote, CheckCircle, XCircle, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const proposals = [
  {
    id: "AEG-001",
    title: "Augmenter les récompenses de staking Gold à 30%",
    status: "active",
    votesFor: 72,
    votesAgainst: 28,
    quorum: 85,
    endsIn: "2j 14h",
    author: "0x7a3f...9e2d",
  },
  {
    id: "AEG-002",
    title: "Intégrer nouveau module AUDIT-DS v2.0",
    status: "active",
    votesFor: 91,
    votesAgainst: 9,
    quorum: 95,
    endsIn: "5j 8h",
    author: "0x4b1c...8f3a",
  },
  {
    id: "AEG-003",
    title: "Réduire les frais marketplace à 0.5%",
    status: "passed",
    votesFor: 88,
    votesAgainst: 12,
    quorum: 100,
    endsIn: "Terminé",
    author: "0x9d5e...1c7b",
  },
  {
    id: "AEG-004",
    title: "Ajouter bridge vers Ethereum",
    status: "rejected",
    votesFor: 35,
    votesAgainst: 65,
    quorum: 100,
    endsIn: "Terminé",
    author: "0x2f8a...6d4e",
  },
];

const statusConfig = {
  active: { label: "En cours", color: "bg-primary/10 text-primary border-primary/20" },
  passed: { label: "Approuvé", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Rejeté", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function Governance() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Gouvernance DAO</h2>
          <p className="text-sm text-muted-foreground mt-1">Vote décentralisé — 1 AQ staké = 1 vote</p>
        </div>
        <Button>
          <Vote className="h-4 w-4 mr-2" />
          Nouvelle Proposition
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <Vote className="h-4 w-4 text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Propositions Totales</p>
          <p className="text-lg font-bold text-foreground">47</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <Users className="h-4 w-4 text-accent mb-2" />
          <p className="text-xs text-muted-foreground">Participants Uniques</p>
          <p className="text-lg font-bold text-foreground">8,421</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <CheckCircle className="h-4 w-4 text-green-400 mb-2" />
          <p className="text-xs text-muted-foreground">Taux d'Approbation</p>
          <p className="text-lg font-bold text-foreground">78.7%</p>
        </div>
      </div>

      {/* Proposals */}
      <div className="space-y-3">
        {proposals.map((p) => {
          const config = statusConfig[p.status];
          return (
            <div key={p.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{p.id}</span>
                    <Badge variant="outline" className={config.color}>{config.label}</Badge>
                  </div>
                  <h4 className="text-base font-semibold text-foreground">{p.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">par {p.author}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {p.endsIn}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden flex">
                    <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${p.votesFor}%` }} />
                    <div className="h-full bg-red-500 rounded-r-full transition-all" style={{ width: `${p.votesAgainst}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    <span className="font-mono">{p.votesFor}% Pour</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <XCircle className="h-3 w-3" />
                    <span className="font-mono">{p.votesAgainst}% Contre</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Quorum:</span>
                  <Progress value={p.quorum} className="h-1 flex-1 max-w-32" />
                  <span className="font-mono">{p.quorum}%</span>
                </div>
              </div>

              {p.status === "active" && (
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Voter Pour
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Voter Contre
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}