import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Shield, Lock, Brain, Vote, Coins, FileSearch, Globe, FlaskConical,
  Handshake, Map, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp,
  Zap, Flame, TrendingUp, TrendingDown, Server, Eye, BookOpen, Users, Star
} from "lucide-react";

const PRIORITY = {
  critical: { label: "CRITIQUE",  color: "bg-red-500/10 text-red-400 border-red-500/20"     },
  high:     { label: "ÉLEVÉE",    color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  medium:   { label: "MOYENNE",   color: "bg-accent/10 text-accent border-accent/20"         },
  info:     { label: "RESEARCH",  color: "bg-primary/10 text-primary border-primary/20"      },
};

const STATUS = {
  todo:        { label: "À faire",       color: "text-muted-foreground", icon: Clock        },
  in_progress: { label: "En cours",      color: "text-accent",           icon: Zap          },
  done:        { label: "Implémenté",    color: "text-green-400",        icon: CheckCircle  },
  planned:     { label: "Planifié",      color: "text-primary",          icon: TrendingUp   },
};

const sections = [
  {
    id: "quantum",
    icon: Shield,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    title: "Sécurité Quantique",
    subtitle: "Priorité Absolue — 2026",
    priority: "critical",
    urgency: "20-30% du Bitcoin menacé par l'informatique quantique. Les tokens quantum-resistant ont déjà bondi de +50%.",
    items: [
      { status: "in_progress", label: "Cryptographie post-quantique — Lattice-based (CRYSTALS-Dilithium, Falcon)", detail: "Algorithmes résistants aux attaques de Shor & Grover. CRYSTALS-Dilithium est le standard NIST PQC 2024." },
      { status: "planned",     label: "Migration signatures résistantes — Quantum Resistant Ledger (QRL)", detail: "Remplacement des signatures ECDSA par XMSS (eXtended Merkle Signature Scheme) ou CRYSTALS-Dilithium." },
      { status: "todo",        label: "Politique strict de non-réutilisation d'adresses", detail: "Chaque adresse n'est utilisée qu'une seule fois — empêche la reconstitution des clés publiques via transactions." },
      { status: "todo",        label: "HSM militaires + enclaves TEE (Trusted Execution Environments)", detail: "Stockage des clés privées dans des modules hardware certifiés FIPS 140-3 Level 4." },
    ],
    algorithms: ["CRYSTALS-Dilithium (NIST PQC)", "Falcon (signature compacte)", "XMSS (hash-based)", "NTRU (lattice-based)"],
  },
  {
    id: "audit",
    icon: FileSearch,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    title: "Audit & Certification",
    subtitle: "Niveau Militaire",
    priority: "critical",
    urgency: "Sans certification externe, aucun partenaire institutionnel (défense, banque centrale) ne peut intégrer AEGIS-Q.",
    items: [
      { status: "todo",        label: "Audit sécurité complet — CertiK / Trail of Bits", detail: "Audit formel du smart contract, des mécanismes de burn, et du système de gouvernance on-chain." },
      { status: "todo",        label: "Certification ISO 27001 — Sécurité de l'information", detail: "Standard international incontournable pour les systèmes militaires et financiers critiques." },
      { status: "todo",        label: "Pentesting régulier — Architecture multi-signatures", detail: "Tests d'intrusion trimestriels sur les 3/5 multisig, time-locks, et cold storage." },
      { status: "planned",     label: "Bug Bounty Program — Communauté + Immunefi", detail: "Programme de récompenses : $500 (low) → $100K (critical). Attire les meilleurs chercheurs en sécurité." },
    ],
    tags: ["CertiK", "Trail of Bits", "ISO 27001", "SOC 2 Type II", "Immunefi"],
  },
  {
    id: "fractal",
    icon: Brain,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    title: "Optimisation Fractale N-MEM-B",
    subtitle: "Architecture Cognitive",
    priority: "high",
    urgency: "Les FNNs (Fractal Neural Networks) atteignent 93.26% d'accuracy. Benchmark critique pour validation scientifique.",
    items: [
      { status: "planned",     label: "Benchmarking performances — Latence L0→L4", detail: "Mesure du throughput de propagation par niveau fractal. Objectif : <50ms L0, <500ms L4." },
      { status: "todo",        label: "Tests de charge — Relations sémantiques (10M+ nœuds)", detail: "Simulation de 10 millions de nœuds simultanés avec propagation BFS optimisée." },
      { status: "todo",        label: "Auto-optimisation clusters narratifs L2", detail: "Algorithme d'auto-clustering basé sur la densité de résonance — réduction du pruning inutile." },
      { status: "todo",        label: "Découplage capacité/calcul linéaire", detail: "Séparation du graphe de mémoire (stockage) et du moteur de propagation (compute) — scaling horizontal." },
      { status: "planned",     label: "Comparaison FNN — 93.26% accuracy baseline", detail: "Validation scientifique par rapport aux Fractal Neural Networks publiés sur NIH/PubMed." },
    ],
    metrics: [
      { label: "FNN Baseline",      value: "93.26%", color: "text-accent"   },
      { label: "Target L0 Latency", value: "<50ms",  color: "text-primary"  },
      { label: "Node Scale Target", value: "10M+",   color: "text-chart-2"  },
      { label: "Pruning Reduction", value: "−40%",   color: "text-green-400"},
    ],
  },
  {
    id: "dao",
    icon: Vote,
    color: "text-chart-4",
    bg: "bg-chart-4/10",
    border: "border-chart-4/20",
    title: "Gouvernance DAO Avancée",
    subtitle: "État de l'Art 2026",
    priority: "high",
    urgency: "Les DAOs intégrant des agents IA pour la prise de décision collective représentent le paradigme dominant en 2026.",
    items: [
      { status: "in_progress", label: "Vote quadratique — Éviter la concentration de pouvoir", detail: "Coût d'un vote = √(AQ engagés). Limite l'influence des gros holders et renforce la démocratie tokenomique." },
      { status: "planned",     label: "AI-Powered DAO — Agents autonomes pour propositions", detail: "AUDIT-DS génère automatiquement des propositions monétaires basées sur les métriques de résonance." },
      { status: "todo",        label: "Transparency Logs immuables on-chain", detail: "Chaque décision de gouvernance est hash-timestampée et archivée sur la blockchain AEGIS." },
      { status: "todo",        label: "DAO-Centered AI — Gouvernance de l'intelligence cognitive", detail: "La communauté vote sur les paramètres du moteur fractal : seuils, decay, propagation weights." },
    ],
    tags: ["Vote Quadratique", "AI Proposals", "On-chain Logs", "Multi-DAO", "Delegation"],
  },
  {
    id: "tokenomics",
    icon: Coins,
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    title: "Tokenomics Avancé",
    subtitle: "Modèle Déflationnaire Hybride",
    priority: "high",
    urgency: "Optimisations basées sur EIP-1559 (Ethereum) + modèles de buy-back/burn des top protocoles DeFi.",
    items: [
      { status: "done",        label: "Burn automatique 1.5% transactions + smart contract burns", detail: "Implémenté. Mécanisme actif sur toutes les transactions réseau." },
      { status: "planned",     label: "Buy-back Program — Revenus réseau → rachat/burn", detail: "20% des revenus du protocole alloués au rachat mensuel d'AQ sur le marché secondaire." },
      { status: "planned",     label: "Staking rewards en sAQ + Emission Decay schedule", detail: "Réduction progressive de l'inflation : 2% → 1.8% → 1.4% → 0.9% → déflationnaire (An 5)." },
      { status: "todo",        label: "EIP-1559 style — Base fee burn adaptatif", detail: "Fee de base dynamique ajustée par l'IA selon la congestion réseau — portion brûlée automatiquement." },
    ],
    schedule: [
      { year: "An 1", inflation: "+2.0%", burn: "1.5%", net: "+0.5%" },
      { year: "An 2", inflation: "+1.8%", burn: "1.6%", net: "+0.2%" },
      { year: "An 3", inflation: "+1.4%", burn: "1.7%", net: "−0.3%" },
      { year: "An 4", inflation: "+0.9%", burn: "1.8%", net: "−0.9%" },
      { year: "An 5", inflation: "+0.3%", burn: "2.0%", net: "−1.7%" },
    ],
  },
  {
    id: "multisig",
    icon: Lock,
    color: "text-chart-2",
    bg: "bg-chart-2/10",
    border: "border-chart-2/20",
    title: "Sécurité Multi-Signatures",
    subtitle: "Niveau Institutionnel",
    priority: "high",
    urgency: "Architecture 3/5 actuelle = bon début. Renforcements institutionnels requis pour opérations >$1M.",
    items: [
      { status: "done",        label: "3/5 Multi-signature architecture", detail: "Base implémentée. Extension à 5/9 recommandée pour cold storage institutionnel." },
      { status: "planned",     label: "Time-locks 24-48h — Transactions >$1M", detail: "Délai de confirmation obligatoire avec fenêtre d'annulation pour prévenir les attaques flash." },
      { status: "todo",        label: "Distribution géographique — Clés sur 5 continents", detail: "Résilience géopolitique : aucune juridiction ne peut contraindre >40% des signataires." },
      { status: "todo",        label: "MPC (Multi-Party Computation) — Complément MuSig2", detail: "Calcul distribué de signatures sans jamais exposer les clés complètes en mémoire." },
      { status: "todo",        label: "Insurance custodiale — Lloyd's of London / Coincover", detail: "Couverture $100M+ pour les actifs en cold storage institutionnel." },
    ],
    tags: ["3/5 → 5/9 MuSig", "Time-lock 48h", "5 Continents", "MPC", "HSM FIPS 140-3"],
  },
  {
    id: "compliance",
    icon: Globe,
    color: "text-chart-5",
    bg: "bg-chart-5/10",
    border: "border-chart-5/20",
    title: "Conformité Réglementaire",
    subtitle: "Finances Militaires",
    priority: "medium",
    urgency: "Compliance OTAN/UE potentiellement applicable selon le périmètre d'utilisation institutionnelle.",
    items: [
      { status: "planned",     label: "KYC/AML niveau institutionnel — Self-Sovereign Identity (SSI)", detail: "Identité décentralisée vérifiable sans dépendance à une autorité centrale (W3C DID standard)." },
      { status: "todo",        label: "RBAC — Role-Based Access Control militaire", detail: "Hiérarchie d'accès : Opérateur < Analyste < Commandant < SuperAdmin. Logs immuables par rôle." },
      { status: "todo",        label: "Conformité RGPD + Data Sovereignty défense", detail: "Les données de mémoire fractale ne quittent pas le territoire souverain. Enclaves chiffrées locales." },
      { status: "todo",        label: "Compliance OTAN/UE — NIS2 + DORA si applicable", detail: "Directive NIS2 (cybersécurité) et DORA (résilience opérationnelle) pour entités financières critiques." },
    ],
    tags: ["SSI / W3C DID", "RBAC", "RGPD", "NIS2", "DORA", "OTAN"],
  },
  {
    id: "research",
    icon: FlaskConical,
    color: "text-chart-3",
    bg: "bg-chart-3/10",
    border: "border-chart-3/20",
    title: "Recherche & Publication",
    subtitle: "Crédibilité Académique",
    priority: "info",
    urgency: "La publication scientifique est le vecteur de crédibilité le plus puissant pour attirer partenaires défense et académiques.",
    items: [
      { status: "planned",     label: "Publication — Fractal Memory + Blockchain (NeurIPS / ICML)", detail: "Premier article décrivant N-MEM-B comme architecture de mémoire cognitive décentralisée." },
      { status: "planned",     label: "Whitepaper technique — Architecture AEGIS-Q complète", detail: "Document de 40-60 pages couvrant cryptographie, tokenomics, gouvernance et mémoire fractale." },
      { status: "todo",        label: "Benchmark public — Comparaison FNN / N-MEM-B", detail: "Publier les résultats de benchmark sur arXiv pour peer review avant soumission conférence." },
      { status: "todo",        label: "Conférences cibles : NeurIPS, ICML, AAMAS, IEEE S&P", detail: "IEEE S&P pour la sécurité quantique, AAMAS pour les agents autonomes en gouvernance DAO." },
    ],
    targets: ["NeurIPS", "ICML", "AAMAS", "IEEE S&P", "arXiv", "NIH/PubMed"],
  },
  {
    id: "partnerships",
    icon: Handshake,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    title: "Partenariats Stratégiques",
    subtitle: "Cibles Prioritaires",
    priority: "medium",
    urgency: "Les partenariats défense/academia débloquent financements, crédibilité et accès aux marchés institutionnels.",
    items: [
      { status: "todo",        label: "Défense/Cyber — Thales, Airbus Defence, NATO CCD COE", detail: "Le NATO Cooperative Cyber Defence Centre of Excellence (Tallinn) est le partenaire naturel." },
      { status: "todo",        label: "Blockchain enterprise — ConsenSys, R3 Corda", detail: "R3 Corda est la blockchain de référence pour les systèmes financiers militaires et institutionnels." },
      { status: "todo",        label: "IA Cognitive — DeepMind (Research), Inria", detail: "Collaboration académique sur la mémoire contextuelle et la gouvernance d'agents autonomes." },
      { status: "todo",        label: "Universités — MIT Media Lab, Inria, Max Planck Institute", detail: "Programmes de co-publication et accès aux clusters HPC pour benchmarking N-MEM-B." },
    ],
    tags: ["NATO CCD COE", "Thales", "R3 Corda", "DeepMind", "MIT Media Lab", "Inria"],
  },
];

const roadmap = [
  {
    quarter: "Q2 2026", label: "URGENT — Maintenant",
    color: "border-red-500/40 bg-red-500/5",
    dot: "bg-red-500",
    tasks: ["Audit sécurité complet (CertiK)", "Prototype cryptographie post-quantique (CRYSTALS-Dilithium)", "Whitepaper technique v1", "Recruter cryptographe post-quantique"],
  },
  {
    quarter: "Q3 2026", label: "Construction",
    color: "border-accent/40 bg-accent/5",
    dot: "bg-accent",
    tasks: ["Testnet publique N-MEM-B", "DAO Governance v1 + vote quadratique", "Partenariats académiques (Inria, MIT)", "Bug Bounty Program lancé"],
  },
  {
    quarter: "Q4 2026", label: "Déploiement",
    color: "border-primary/40 bg-primary/5",
    dot: "bg-primary",
    tasks: ["Mainnet souverain", "Certification ISO 27001", "Publication scientifique (arXiv + conférence)", "Multi-sig 5/9 + MPC opérationnel"],
  },
  {
    quarter: "2027", label: "Scale International",
    color: "border-chart-2/40 bg-chart-2/5",
    dot: "bg-chart-2",
    tasks: ["Intégration défense (NATO CCD COE)", "Écosystème développeurs (SDK public)", "Insurance custodiale $100M+", "Compliance OTAN/UE finalisée"],
  },
];

function SectionCard({ section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  const prio = PRIORITY[section.priority];
  const doneCount = section.items.filter(i => i.status === "done").length;
  const progress = Math.round((doneCount / section.items.length) * 100);

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", section.border)}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-5 hover:bg-secondary/10 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", section.bg)}>
              <Icon className={`h-5 w-5 ${section.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                <Badge variant="outline" className={cn("text-[10px]", prio.color)}>{prio.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-mono text-foreground">{doneCount}/{section.items.length}</p>
              <div className="h-1.5 w-20 bg-secondary rounded-full overflow-hidden mt-1">
                <div className={cn("h-full rounded-full", section.color.replace("text-", "bg-"))}
                  style={{ width: `${progress}%`, opacity: 0.8 }} />
              </div>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {section.urgency && (
          <div className="flex items-start gap-2 mt-3 bg-secondary/40 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{section.urgency}</p>
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-3 space-y-4">
          {/* Items */}
          <div className="space-y-2">
            {section.items.map((item, i) => {
              const s = STATUS[item.status] ?? STATUS.todo;
              const SIcon = s.icon;
              return (
                <div key={i} className="bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <SIcon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", s.color)} />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
                      <span className={cn("text-[9px] font-semibold uppercase tracking-wide mt-1 inline-block", s.color)}>{s.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tags / Algorithms */}
          {(section.algorithms || section.tags || section.targets) && (
            <div className="flex flex-wrap gap-1.5">
              {(section.algorithms ?? section.tags ?? section.targets).map((t) => (
                <span key={t} className={cn("text-[10px] font-mono px-2 py-0.5 rounded-md border", section.border, section.color, section.bg)}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Metrics */}
          {section.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {section.metrics.map((m) => (
                <div key={m.label} className="bg-secondary/50 rounded-lg px-3 py-2 text-center">
                  <p className={cn("text-base font-bold font-mono", m.color)}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tokenomics schedule */}
          {section.schedule && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    <th className="text-left py-1.5 font-medium">Période</th>
                    <th className="text-center py-1.5 font-medium">Inflation</th>
                    <th className="text-center py-1.5 font-medium">Burn</th>
                    <th className="text-right py-1.5 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {section.schedule.map((row) => (
                    <tr key={row.year} className="border-t border-border/50">
                      <td className="py-1.5 font-mono text-foreground">{row.year}</td>
                      <td className="py-1.5 text-center text-accent font-mono">{row.inflation}</td>
                      <td className="py-1.5 text-center text-orange-400 font-mono">{row.burn}</td>
                      <td className={cn("py-1.5 text-right font-mono font-bold",
                        row.net.startsWith("−") ? "text-green-400" : "text-muted-foreground")}>
                        {row.net}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategicRoadmap() {
  const [activeTab, setActiveTab] = useState("intel");
  const totalItems = sections.flatMap(s => s.items);
  const doneItems = totalItems.filter(i => i.status === "done");
  const inProgressItems = totalItems.filter(i => i.status === "in_progress");
  const criticalSections = sections.filter(s => s.priority === "critical");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Intelligence Stratégique</h2>
          <p className="text-sm text-muted-foreground mt-1">AEGIS-Q — Analyse 2026 · Sécurité Quantique · Gouvernance DAO · Architecture Souveraine</p>
        </div>
        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />2026 — URGENCE QUANTIQUE
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Domaines couverts",   value: sections.length,          icon: Map,         color: "text-primary"  },
          { label: "Actions totales",     value: totalItems.length,        icon: Star,        color: "text-accent"   },
          { label: "Implémentées",        value: doneItems.length,         icon: CheckCircle, color: "text-green-400"},
          { label: "Critiques",           value: criticalSections.length,  icon: AlertTriangle,color: "text-red-400" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "intel", label: "Analyse & Recommandations", icon: Brain },
          { key: "roadmap", label: "Roadmap 2026-2027",        icon: Map   },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              activeTab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "intel" && (
        <div className="space-y-3">
          {sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>
      )}

      {activeTab === "roadmap" && (
        <div className="space-y-4">
          {/* Quantum Alert */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400 mb-1">Alerte Quantique — Action Immédiate Requise</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                En 2026, 20-30% du Bitcoin est vulnérable à l'informatique quantique. Les tokens quantum-resistant ont bondi de +50%.
                La migration de AEGIS-Q vers CRYSTALS-Dilithium doit commencer <span className="text-red-400 font-semibold">maintenant</span>,
                avant que des ordinateurs quantiques cryptographiquement pertinents (CRQC) ne soient opérationnels (horizon 2027-2030).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roadmap.map((q) => (
              <div key={q.quarter} className={cn("border rounded-xl p-5 space-y-3", q.color)}>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2.5 w-2.5 rounded-full", q.dot)} />
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{q.quarter}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{q.label}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {q.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-1.5", q.dot)} />
                      <span className="text-foreground">{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Priorities this week */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-bold text-foreground">Priorités Cette Semaine</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Shield,       color: "text-red-400",    bg: "bg-red-500/10",    label: "Sécurité Quantique",     action: "Commencer la migration CRYSTALS-Dilithium — Contacter QRL Foundation" },
                { icon: FileSearch,   color: "text-orange-400", bg: "bg-orange-500/10", label: "Audit Sécurité",         action: "Contacter CertiK et Trail of Bits pour devis d'audit complet" },
                { icon: Globe,        color: "text-chart-5",    bg: "bg-chart-5/10",    label: "Legal & Compliance",     action: "Structurer la conformité militaire — Conseil spécialisé défense" },
                { icon: Users,        color: "text-chart-2",    bg: "bg-chart-2/10",    label: "Recrutement",            action: "Recruter un cryptographe post-quantique — INRIA/ENS/Polytechnique" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 bg-secondary/30 rounded-lg p-3">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                    <item.icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}