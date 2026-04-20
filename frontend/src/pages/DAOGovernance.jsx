import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Vote, Lock, CheckCircle, XCircle, Clock,
  Plus, Zap, BarChart2, Activity, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Constants ─────────────────────────────────────────────
const MULTIPLIER_TABLE = [
  { days: 7,   label: "7 jours", mult: 1.0  },
  { days: 30,  label: "1 mois",  mult: 1.25 },
  { days: 90,  label: "3 mois",  mult: 1.6  },
  { days: 180, label: "6 mois",  mult: 2.0  },
  { days: 365, label: "1 an",    mult: 3.0  },
  { days: 730, label: "2 ans",   mult: 4.5  },
];

const PARAM_LABELS = {
  INFLATION_RATE:      "Taux d'Inflation",
  BURN_RATE:           "Taux de Burn",
  RESONANCE_THRESHOLD: "Seuil de Résonance",
  DECAY_RATE:          "Taux de Decay",
};

const STATUS_CFG = {
  active:   { label: "En cours",   color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  passed:   { label: "Acceptée",   color: "text-primary",   bg: "bg-primary/10 border-primary/20"    },
  rejected: { label: "Rejetée",    color: "text-red-400",   bg: "bg-red-500/10 border-red-500/20"    },
  pending:  { label: "En attente", color: "text-accent",    bg: "bg-accent/10 border-accent/30"      },
};

// ── Helpers ───────────────────────────────────────────────
function votingPower(aqAmount, lockDays) {
  const entry = [...MULTIPLIER_TABLE].reverse().find(e => lockDays >= e.days) ?? MULTIPLIER_TABLE[0];
  return Math.round(aqAmount * entry.mult);
}

function timeLeft(dateStr) {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Terminé";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d > 0 ? `${d}j ${h}h` : `${h}h`;
}

function fmtAQ(n) {
  if (!n) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function totalVotes(p) { return (p.votes_for || 0) + (p.votes_against || 0); }
function forPct(p)     { const t = totalVotes(p); return t ? ((p.votes_for || 0) / t * 100).toFixed(1) : 0; }
function againstPct(p) { const t = totalVotes(p); return t ? ((p.votes_against || 0) / t * 100).toFixed(1) : 0; }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono text-foreground ml-auto">{fmtAQ(p.value)} AQ</span>
        </div>
      ))}
    </div>
  );
};

// ── Proposal Card ─────────────────────────────────────────
function ProposalCard({ proposal, onVote, isVoting }) {
  const [open, setOpen]   = useState(false);
  const [voted, setVoted] = useState(null);
  const cfg     = STATUS_CFG[proposal.status] ?? STATUS_CFG.pending;
  const isActive = proposal.status === "active";
  const forP    = forPct(proposal);
  const againstP = againstPct(proposal);
  const total   = totalVotes(proposal);

  const cast = (choice) => {
    if (voted || !isActive) return;
    setVoted(choice);
    onVote(proposal.id, choice);
  };

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", isActive ? "border-primary/20" : "border-border")}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-5 hover:bg-secondary/10 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={cn("text-[9px]", cfg.bg, cfg.color)}>{cfg.label}</Badge>
              {proposal.parameter && (
                <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">
                  {PARAM_LABELS[proposal.parameter] ?? proposal.parameter}
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-bold text-foreground leading-snug">{proposal.title}</h4>
            {proposal.author && <p className="text-[10px] text-muted-foreground mt-0.5">Par {proposal.author}</p>}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {proposal.ends_at && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />{timeLeft(proposal.ends_at)}
              </div>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Vote bars */}
        {total > 0 ? (
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-green-400 font-semibold">Pour</span>
                <span className="text-green-400 font-mono">{forP}% — {fmtAQ(proposal.votes_for)} AQ</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${forP}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-red-400 font-semibold">Contre</span>
                <span className="text-red-400 font-mono">{againstP}% — {fmtAQ(proposal.votes_against)} AQ</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${againstP}%` }} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Total : {fmtAQ(total)} AQ · Quorum requis : {proposal.quorum_required ?? 51}%
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Aucun vote enregistré.</p>
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {/* Description */}
          {proposal.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{proposal.description}</p>
          )}
          {proposal.rationale && (
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-bold uppercase">Justification</p>
              <p className="text-xs text-foreground leading-relaxed">{proposal.rationale}</p>
            </div>
          )}

          {/* Parameter change */}
          {proposal.parameter && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Valeur actuelle</p>
                <p className="text-sm font-bold font-mono text-red-400">{proposal.current_value} {proposal.unit}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Valeur proposée</p>
                <p className="text-sm font-bold font-mono text-green-400">{proposal.proposed_value} {proposal.unit}</p>
              </div>
            </div>
          )}

          {/* Pie chart */}
          {total > 0 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Pour",   value: proposal.votes_for     || 0, fill: "#10b981" },
                      { name: "Contre", value: proposal.votes_against || 0, fill: "#ef4444" },
                    ]}
                    cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    dataKey="value" stroke="none" paddingAngle={2}>
                    {[0,1].map(i => <Cell key={i} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vote buttons */}
          {isActive && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Votre vote</p>
              {voted ? (
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5">
                  {isVoting ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                  <span className="text-sm text-primary font-semibold">
                    {isVoting ? "Enregistrement…" : `Vote enregistré : ${voted === "for" ? "Pour" : "Contre"}`}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => cast("for")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Pour
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => cast("against")}>
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />Contre
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function DAOGovernance() {
  const qc = useQueryClient();
  const [filter, setFilter]     = useState("all");
  const [aqAmount, setAqAmount] = useState(5000);
  const [lockDays, setLockDays] = useState(90);
  const [showCreate, setShowCreate] = useState(false);
  const [newProp, setNewProp]   = useState({
    title: "", parameter: "INFLATION_RATE", current_value: "",
    proposed_value: "", unit: "%", description: "", rationale: "",
    quorum_required: 51,
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [votingId, setVotingId] = useState(null);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn:  () => base44.entities.MonetaryProposal.list("-created_date", 50),
    refetchInterval: 15000,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, choice, vp }) => {
      const proposal = proposals.find(p => p.id === id);
      if (!proposal) return;
      const patch = choice === "for"
        ? { votes_for: (proposal.votes_for || 0) + vp, votes_for_aq: (proposal.votes_for_aq || 0) + aqAmount }
        : { votes_against: (proposal.votes_against || 0) + vp, votes_against_aq: (proposal.votes_against_aq || 0) + aqAmount };
      return base44.entities.MonetaryProposal.update(id, patch);
    },
    onSuccess: () => { qc.invalidateQueries(["proposals"]); setVotingId(null); },
    onError: () => setVotingId(null),
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.MonetaryProposal.create({
      ...newProp,
      current_value:  parseFloat(newProp.current_value)  || 0,
      proposed_value: parseFloat(newProp.proposed_value) || 0,
      quorum_required: parseInt(newProp.quorum_required) || 51,
      status: "active",
      votes_for: 0, votes_against: 0, votes_for_aq: 0, votes_against_aq: 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries(["proposals"]);
      setNewProp({ title: "", parameter: "INFLATION_RATE", current_value: "", proposed_value: "", unit: "%", description: "", rationale: "", quorum_required: 51, ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
      setShowCreate(false);
    },
  });

  const handleVote = (id, choice) => {
    const vp = votingPower(aqAmount, lockDays);
    setVotingId(id);
    voteMutation.mutate({ id, choice, vp });
  };

  const vp    = votingPower(aqAmount, lockDays);
  const entry = [...MULTIPLIER_TABLE].reverse().find(e => lockDays >= e.days) ?? MULTIPLIER_TABLE[0];

  const filtered = filter === "all" ? proposals : proposals.filter(p => p.status === filter);
  const counts   = ["active","passed","rejected","pending"].reduce((a, s) => ({ ...a, [s]: proposals.filter(p => p.status === s).length }), {});

  const overviewData = proposals.slice(0, 8).map(p => ({
    name:   p.title.length > 18 ? p.title.slice(0, 18) + "…" : p.title,
    Pour:   p.votes_for     || 0,
    Contre: p.votes_against || 0,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Gouvernance Décentralisée</h2>
          <p className="text-sm text-muted-foreground mt-1">DAO AEGIS-Q · Votes persistés en base · Staking pondéré par le temps</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <Activity className="h-3 w-3 mr-1" />{proposals.length} proposition{proposals.length !== 1 ? "s" : ""}
          </Badge>
          <Button onClick={() => setShowCreate(o => !o)}>
            <Plus className="h-4 w-4 mr-2" />Nouvelle proposition
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En cours",   value: counts.active   || 0, color: "text-green-400", icon: Vote        },
          { label: "Acceptées",  value: counts.passed   || 0, color: "text-primary",   icon: CheckCircle },
          { label: "Rejetées",   value: counts.rejected || 0, color: "text-red-400",   icon: XCircle     },
          { label: "En attente", value: counts.pending  || 0, color: "text-accent",    icon: Clock       },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Staking power */}
      <div className="bg-card border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Pouvoir de Vote — Staking Pondéré par le Temps</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Montant AQ</span>
              <span className="font-mono font-bold text-foreground">{aqAmount.toLocaleString()} AQ</span>
            </div>
            <div className="relative h-2 bg-secondary rounded-full">
              <div className="absolute h-full rounded-full bg-primary/40" style={{ width: `${(aqAmount / 100000) * 100}%` }} />
              <input type="range" min={100} max={100000} step={100} value={aqAmount}
                onChange={e => setAqAmount(+e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-card shadow top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `calc(${(aqAmount / 100000) * 100}% - 7px)` }} />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground block">Durée de lock</span>
            <div className="flex gap-1 flex-wrap">
              {MULTIPLIER_TABLE.map(m => (
                <button key={m.days} onClick={() => setLockDays(m.days)}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                    lockDays === m.days ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col justify-center">
            <p className="text-[10px] text-muted-foreground mb-1">Multiplicateur</p>
            <p className="text-2xl font-black text-accent font-mono">×{entry.mult}</p>
            <div className="border-t border-primary/20 mt-2 pt-2">
              <p className="text-[10px] text-muted-foreground">Pouvoir de vote</p>
              <p className="text-xl font-black text-primary font-mono">{vp.toLocaleString()} VP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview chart */}
      {overviewData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Résultats des Votes — Vue Globale</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <YAxis tickFormatter={v => fmtAQ(v)} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar dataKey="Pour"   stackId="a" fill="#10b981" name="Pour"   />
                <Bar dataKey="Contre" stackId="a" fill="#ef4444" radius={[4,4,0,0]} name="Contre" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Nouvelle Proposition</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Titre *</label>
              <input value={newProp.title} onChange={e => setNewProp(p => ({ ...p, title: e.target.value }))}
                placeholder="Titre de la proposition…"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Paramètre cible</label>
              <select value={newProp.parameter} onChange={e => setNewProp(p => ({ ...p, parameter: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                {Object.entries(PARAM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Unité</label>
              <input value={newProp.unit} onChange={e => setNewProp(p => ({ ...p, unit: e.target.value }))}
                placeholder="%, bps, …"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Valeur actuelle</label>
              <input type="number" value={newProp.current_value} onChange={e => setNewProp(p => ({ ...p, current_value: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Valeur proposée</label>
              <input type="number" value={newProp.proposed_value} onChange={e => setNewProp(p => ({ ...p, proposed_value: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Quorum requis (%)</label>
              <input type="number" min={1} max={100} value={newProp.quorum_required} onChange={e => setNewProp(p => ({ ...p, quorum_required: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Date de clôture</label>
              <input type="date" value={newProp.ends_at} onChange={e => setNewProp(p => ({ ...p, ends_at: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Description *</label>
              <textarea value={newProp.description} onChange={e => setNewProp(p => ({ ...p, description: e.target.value }))}
                rows={3} placeholder="Décrivez la proposition…"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Justification</label>
              <textarea value={newProp.rationale} onChange={e => setNewProp(p => ({ ...p, rationale: e.target.value }))}
                rows={2} placeholder="Pourquoi ce changement est nécessaire…"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={() => createMutation.mutate()}
              disabled={!newProp.title.trim() || !newProp.description.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Publier la proposition
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all",      label: `Toutes (${proposals.length})` },
          { key: "active",   label: `En cours (${counts.active || 0})` },
          { key: "pending",  label: `En attente (${counts.pending || 0})` },
          { key: "passed",   label: `Acceptées (${counts.passed || 0})` },
          { key: "rejected", label: `Rejetées (${counts.rejected || 0})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1 rounded-lg text-[10px] font-semibold transition-all",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des propositions…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Vote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucune proposition dans cette catégorie.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />Créer la première proposition
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProposalCard key={p.id} proposal={p} onVote={handleVote} isVoting={votingId === p.id} />
          ))}
        </div>
      )}
    </div>
  );
}