import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Flame, Activity, CheckCircle,
  XCircle, Clock, Plus, Vote, Loader2, ChevronDown, ChevronUp,
  Shield, Info
} from "lucide-react";

const PARAM_CONFIG = {
  INFLATION_RATE:       { label: "Taux d'Inflation",       icon: TrendingUp,   color: "text-accent",    unit: "% / an",  min: 0,   max: 10  },
  BURN_RATE:            { label: "Taux de Burn",            icon: Flame,        color: "text-orange-400",unit: "%",       min: 0,   max: 10  },
  RESONANCE_THRESHOLD:  { label: "Seuil de Résonance",      icon: Activity,     color: "text-primary",   unit: "%",       min: 50,  max: 100 },
  DECAY_RATE:           { label: "Decay Rate Inflation",    icon: TrendingDown, color: "text-red-400",   unit: "% / an",  min: -5,  max: 0   },
};

const STATUS_CONFIG = {
  active:   { label: "En cours",  color: "bg-primary/10 text-primary border-primary/20",     icon: Clock      },
  passed:   { label: "Approuvé", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  rejected: { label: "Rejeté",   color: "bg-red-500/10 text-red-400 border-red-500/20",       icon: XCircle    },
  pending:  { label: "En attente",color: "bg-muted/30 text-muted-foreground border-border",   icon: Clock      },
};

const CURRENT_PARAMS = {
  INFLATION_RATE:      { value: 2.00, label: "Inflation Actuelle"     },
  BURN_RATE:           { value: 1.50, label: "Burn Actuel"            },
  RESONANCE_THRESHOLD: { value: 90,   label: "Seuil Résonance Actuel" },
  DECAY_RATE:          { value: -0.20,label: "Decay Rate Actuel"      },
};

const DEFAULT_PROPOSALS = [
  { title: "Réduire l'inflation à 1.5% / an", description: "Accélérer la trajectoire déflationnaire en réduisant l'inflation de 2% à 1.5% dès l'an prochain.", parameter: "INFLATION_RATE", current_value: 2.0, proposed_value: 1.5, unit: "% / an", status: "active", votes_for: 1240, votes_against: 380, votes_for_aq: 3200000, votes_against_aq: 950000, quorum_required: 51, ends_at: new Date(Date.now() + 3 * 86400000).toISOString(), author: "0x7a3f...9e2d", rationale: "Le marché montre une maturité suffisante pour absorber une compression plus rapide de l'offre." },
  { title: "Augmenter le burn à 2% par transaction", description: "Intensifier le mécanisme de destruction pour atteindre la déflation nette dès l'an 4.", parameter: "BURN_RATE", current_value: 1.5, proposed_value: 2.0, unit: "%", status: "active", votes_for: 890, votes_against: 710, votes_for_aq: 2100000, votes_against_aq: 1800000, quorum_required: 60, ends_at: new Date(Date.now() + 5 * 86400000).toISOString(), author: "0x4b1c...8f3a", rationale: "Un burn accru réduit la supply circulante et valorise les holders long terme." },
  { title: "Abaisser le seuil de résonance à 85%", description: "Permettre des alertes plus précoces pour les nœuds fractals critiques.", parameter: "RESONANCE_THRESHOLD", current_value: 90, proposed_value: 85, unit: "%", status: "passed", votes_for: 2100, votes_against: 300, votes_for_aq: 5400000, votes_against_aq: 600000, quorum_required: 51, ends_at: new Date(Date.now() - 1 * 86400000).toISOString(), author: "0x9d5e...1c7b", rationale: "Meilleure détection des comportements anormaux avant qu'ils ne deviennent critiques." },
];

function ProposalForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", parameter: "INFLATION_RATE", proposed_value: "", rationale: "" });
  const [loading, setLoading] = useState(false);

  const current = CURRENT_PARAMS[form.parameter];
  const cfg = PARAM_CONFIG[form.parameter];

  const submit = async () => {
    if (!form.title || !form.proposed_value) { toast.error("Remplissez tous les champs"); return; }
    setLoading(true);
    await base44.entities.MonetaryProposal.create({
      ...form,
      proposed_value: parseFloat(form.proposed_value),
      current_value: current.value,
      unit: cfg.unit,
      status: "active",
      votes_for: 0, votes_against: 0,
      votes_for_aq: 0, votes_against_aq: 0,
      quorum_required: 51,
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      author: "0x" + Math.random().toString(16).slice(2, 10) + "…",
    });
    toast.success("Proposition soumise", { description: "Elle sera visible dans quelques instants." });
    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Nouvelle Proposition</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Titre</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Réduire l'inflation à 1.8%…"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Paramètre ciblé</label>
            <select value={form.parameter} onChange={e => setForm(f => ({ ...f, parameter: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
              {Object.entries(PARAM_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-secondary/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Valeur actuelle</p>
              <p className="text-sm font-mono font-bold text-foreground">{current.value} {cfg.unit}</p>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Valeur proposée</label>
              <input type="number" value={form.proposed_value}
                onChange={e => setForm(f => ({ ...f, proposed_value: e.target.value }))}
                placeholder={`Ex: ${current.value - 0.5}`}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Justification</label>
            <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
              rows={3} placeholder="Expliquez l'impact attendu de ce changement…"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Soumettre
          </Button>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </div>
  );
}

function ProposalCard({ proposal, onVote }) {
  const cfg = PARAM_CONFIG[proposal.parameter] ?? {};
  const statusCfg = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const ParamIcon = cfg.icon ?? Activity;
  const [expanded, setExpanded] = useState(false);

  const totalAq = (proposal.votes_for_aq ?? 0) + (proposal.votes_against_aq ?? 0);
  const pctFor = totalAq > 0 ? ((proposal.votes_for_aq ?? 0) / totalAq * 100) : 0;
  const quorumReached = pctFor >= (proposal.quorum_required ?? 51);

  const delta = (proposal.proposed_value - proposal.current_value);
  const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ${proposal.unit ?? ""}`;

  const endsAt = proposal.ends_at ? new Date(proposal.ends_at) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 86400000)) : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0`}>
              <ParamIcon className={`h-3.5 w-3.5 ${cfg.color ?? "text-primary"}`} />
            </div>
            <span className="text-sm font-bold text-foreground">{proposal.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={cn("text-[10px]", statusCfg.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />{statusCfg.label}
            </Badge>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap mb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{proposal.current_value} {proposal.unit}</span>
            <span className="text-muted-foreground">→</span>
            <span className={cn("font-mono font-bold", delta < 0 ? "text-red-400" : "text-green-400")}>{proposal.proposed_value} {proposal.unit}</span>
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary", delta < 0 ? "text-red-400" : "text-green-400")}>{deltaStr}</span>
          </div>
          {daysLeft !== null && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {daysLeft > 0 ? `${daysLeft}j restants` : "Terminé"}
            </div>
          )}
        </div>

        {/* Vote bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span className="text-green-400">Pour — {(proposal.votes_for_aq ?? 0).toLocaleString()} AQ ({pctFor.toFixed(0)}%)</span>
            <span className="text-red-400">Contre — {(proposal.votes_against_aq ?? 0).toLocaleString()} AQ</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
            <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${pctFor}%` }} />
            <div className="h-full bg-red-500 rounded-r-full transition-all" style={{ width: `${100 - pctFor}%` }} />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className={cn("h-1.5 w-1.5 rounded-full", quorumReached ? "bg-green-500" : "bg-muted-foreground")} />
            Quorum {proposal.quorum_required ?? 51}% — {quorumReached ? "atteint ✓" : "non atteint"}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{proposal.description}</p>
          {proposal.rationale && (
            <div className="flex gap-2 bg-secondary/50 rounded-lg p-3">
              <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">{proposal.rationale}</p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground font-mono">Soumis par {proposal.author ?? "Anonyme"}</p>

          {proposal.status === "active" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onVote(proposal.id, "for")}>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Pour (1 AQ = 1 vote)
              </Button>
              <Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => onVote(proposal.id, "against")}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />Contre
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernanceAI() {
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const qc = useQueryClient();

  const { data: dbProposals = [], isLoading } = useQuery({
    queryKey: ["monetary-proposals"],
    queryFn: () => base44.entities.MonetaryProposal.list("-created_date", 50),
  });

  // Merge defaults (shown if db is empty) with real ones
  const proposals = dbProposals.length > 0 ? dbProposals : DEFAULT_PROPOSALS;

  const filtered = filterStatus === "all" ? proposals : proposals.filter(p => p.status === filterStatus);

  const vote = async (id, side) => {
    if (!id) { toast.info("Vote enregistré (proposition par défaut — non persistée)"); return; }
    const p = proposals.find(x => x.id === id);
    if (!p) return;
    const aqWeight = 10000; // 10K AQ par vote simulé
    await base44.entities.MonetaryProposal.update(id, {
      votes_for:      side === "for"     ? (p.votes_for ?? 0) + 1     : p.votes_for,
      votes_against:  side === "against" ? (p.votes_against ?? 0) + 1 : p.votes_against,
      votes_for_aq:   side === "for"     ? (p.votes_for_aq ?? 0) + aqWeight : p.votes_for_aq,
      votes_against_aq: side === "against" ? (p.votes_against_aq ?? 0) + aqWeight : p.votes_against_aq,
    });
    toast.success(side === "for" ? "Vote POUR enregistré ✓" : "Vote CONTRE enregistré ✗", { duration: 2000 });
    qc.invalidateQueries(["monetary-proposals"]);
  };

  const kpis = [
    { label: "Propositions Actives", value: proposals.filter(p => p.status === "active").length, icon: Vote, color: "text-primary" },
    { label: "Approuvées",           value: proposals.filter(p => p.status === "passed").length, icon: CheckCircle, color: "text-green-400" },
    { label: "Rejetées",             value: proposals.filter(p => p.status === "rejected").length, icon: XCircle, color: "text-red-400" },
    { label: "Paramètres Gouvernés", value: 4, icon: Shield, color: "text-accent" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Gouvernance Monétaire IA</h2>
          <p className="text-sm text-muted-foreground mt-1">Vote décentralisé sur les paramètres de la politique monétaire AEGIS-Q — 1 AQ = 1 vote</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />Nouvelle Proposition
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Current Params Banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Paramètres Actuels Contrôlés par AUDIT-DS</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(PARAM_CONFIG).map(([key, cfg]) => {
            const cur = CURRENT_PARAMS[key];
            const Icon = cfg.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                  <p className={`text-sm font-mono font-bold ${cfg.color}`}>{cur.value} {cfg.unit}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "active", "passed", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
            {s === "all" ? "Toutes" : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Proposals list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, i) => (
            <ProposalCard key={p.id ?? i} proposal={p} onVote={vote} />
          ))}
          {filtered.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Vote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune proposition dans cette catégorie.</p>
            </div>
          )}
        </div>
      )}

      {showForm && <ProposalForm onClose={() => setShowForm(false)} onCreated={() => qc.invalidateQueries(["monetary-proposals"])} />}
    </div>
  );
}