import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, Shield, Cpu, BarChart2, Lock, Zap, Network, BookOpen,
  CheckCircle, Globe, TrendingUp, Users, Star, ArrowRight, Hexagon
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    color: "text-primary bg-primary/10",
    title: "Orchestration Multi-Agents IA",
    desc: "Déployez des agents autonomes hiérarchiques capables de se déléguer des tâches, spawner des sous-agents et exécuter des workflows complexes sans intervention humaine.",
  },
  {
    icon: Shield,
    color: "text-chart-2 bg-chart-2/10",
    title: "Mémoire Fractale N-MEM-B",
    desc: "Système de mémoire à 5 niveaux fractals (L0→L4) avec propagation de résonance, decay temporel et garbage collection intelligente des connaissances.",
  },
  {
    icon: BookOpen,
    color: "text-accent bg-accent/10",
    title: "Base de Connaissances RAG",
    desc: "Indexez des PDFs, documents Notion et sources privées. Les agents consultent automatiquement la base via recherche sémantique vectorielle pour enrichir leurs réponses.",
  },
  {
    icon: Cpu,
    color: "text-chart-4 bg-chart-4/10",
    title: "Gestionnaire de Skills",
    desc: "Définissez des compétences spécialisées avec prompts systèmes personnalisés, testez-les en bac à sable et suivez leur taux de succès individuel en temps réel.",
  },
  {
    icon: BarChart2,
    color: "text-chart-5 bg-chart-5/10",
    title: "Rapports PDF Automatisés",
    desc: "Générez des rapports exécutifs PDF multi-pages avec graphiques de performance, historique d'exécutions et KPIs détaillés pour vos administrateurs.",
  },
  {
    icon: Lock,
    color: "text-red-400 bg-red-500/10",
    title: "Sécurité Militaire Grade",
    desc: "Audit smart contracts continu, protection quantique CRYSTALS-Dilithium, multisig 5/9, conformité SOC 2 / ISO 27001 et scanner IA de vulnérabilités.",
  },
];

const MODULES = [
  { name: "Dashboard Central", desc: "Vue temps réel de tout le système" },
  { name: "Tokenomics AEGIS-Q", desc: "Structure monétaire 100M AQ" },
  { name: "Staking Technologique", desc: "APY jusqu'à 40% — 4 pools" },
  { name: "Gouvernance DAO", desc: "Vote décentralisé on-chain" },
  { name: "Audit Continus", desc: "Scanner IA de vulnérabilités" },
  { name: "Bridge Cross-Chain", desc: "Lock & Mint multi-réseau" },
  { name: "Simulation Fractale 3D", desc: "Propagation N-MEM-B interactive" },
  { name: "Compliance Temps Réel", desc: "SOC 2 — ISO 27001 monitoring" },
  { name: "Alertes Telegram", desc: "Notifications prix instantanées" },
  { name: "Orchestrateur Agents", desc: "Spawning récursif profondeur 3" },
  { name: "Réseau Agents Visuels", desc: "Graph interactif SVG/D3" },
  { name: "Intelligence Prédictive", desc: "Forecasting 24h réseau" },
];

const STATS = [
  { value: "100M", label: "AQ Tokens en circulation", icon: "🪙" },
  { value: "40%", label: "APY maximum Sovereign pool", icon: "📈" },
  { value: "5 niveaux", label: "Architecture mémoire fractale", icon: "🧠" },
  { value: "12+", label: "Réseaux blockchain supportés", icon: "🔗" },
  { value: "99.97%", label: "Uptime garanti SLA", icon: "⚡" },
  { value: "< 4s", label: "Temps de confirmation AEGIS-Q", icon: "⏱" },
];

const PLANS = [
  {
    name: "Starter",
    price: "$299",
    period: "/mois",
    color: "border-border",
    badge: null,
    features: [
      "5 agents autonomes actifs",
      "10 skills personnalisés",
      "Base de connaissances 1 GB",
      "Rapports PDF mensuels",
      "Support email 48h",
    ],
  },
  {
    name: "Professional",
    price: "$999",
    period: "/mois",
    color: "border-primary",
    badge: "Le plus populaire",
    features: [
      "50 agents autonomes actifs",
      "Unlimited skills",
      "Base de connaissances 50 GB",
      "Rapports PDF hebdomadaires",
      "Alertes Telegram illimitées",
      "Bridge cross-chain inclus",
      "Support prioritaire 4h",
    ],
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    color: "border-accent",
    badge: "Institutionnel",
    features: [
      "Agents illimités",
      "Infrastructure dédiée",
      "SLA 99.99% garanti",
      "Conformité SOC 2 / ISO 27001",
      "Intégration Sovereign Vault",
      "Audit sécurité continu",
      "Account Manager dédié",
    ],
  },
];

const USECASES = [
  {
    icon: "🏦",
    title: "Banques & Institutions Financières",
    desc: "Automatisez la surveillance des risques, la conformité réglementaire et l'analyse de portefeuilles via des agents IA souverains.",
  },
  {
    icon: "🏛️",
    title: "Gouvernements & Secteur Public",
    desc: "Déployez une infrastructure monétaire numérique souveraine avec traçabilité complète et audit immutable.",
  },
  {
    icon: "🏢",
    title: "Entreprises Web3 & DeFi",
    desc: "Intégrez la liquidité cross-chain, la gouvernance DAO et les smart contracts audités dans votre stack.",
  },
  {
    icon: "🔬",
    title: "R&D & IA Labs",
    desc: "Exploitez la mémoire fractale N-MEM-B et l'orchestration multi-agents pour des expérimentations IA avancées.",
  },
];

export default function SaasBrochure() {
  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-20">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-card via-background to-card border border-border rounded-2xl p-10 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-8 left-8 w-40 h-40 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-8 right-8 w-40 h-40 rounded-full bg-accent blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hexagon className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-foreground tracking-widest">AEGIS-Q</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">Military-Grade AI Finance</p>
            </div>
          </div>
          <h2 className="text-4xl font-black text-foreground leading-tight mb-4">
            La Banque IA Souveraine<br />
            <span className="text-primary">de Nouvelle Génération</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            AEGIS-Q est une plateforme financière autonome combinant orchestration multi-agents IA, 
            mémoire fractale avancée, tokenomics déflationnaire et sécurité de grade militaire — 
            conçue pour les institutions souveraines et les acteurs Web3 exigeants.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block mr-2" />
              Système opérationnel
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary px-4 py-1.5">
              Audit CertiK en cours
            </Badge>
            <Badge variant="outline" className="border-accent/30 text-accent px-4 py-1.5">
              Token AQ — Supply 100M
            </Badge>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black text-primary font-mono">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Core Features ─────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <Badge variant="outline" className="border-primary/30 text-primary mb-3">Fonctionnalités Clés</Badge>
          <h2 className="text-2xl font-black text-foreground">Une plateforme. Tout l'écosystème.</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            6 modules stratégiques intégrés nativement pour couvrir l'intégralité de vos besoins financiers IA.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── All Modules ───────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-foreground">12 Modules Intégrés</h2>
          <p className="text-xs text-muted-foreground mt-1">Une suite complète accessible depuis un tableau de bord unifié</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MODULES.map((m) => (
            <div key={m.name} className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/30">
              <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <Badge variant="outline" className="border-chart-2/30 text-chart-2 mb-3">Architecture Technique</Badge>
          <h2 className="text-2xl font-black text-foreground">Conçu pour la souveraineté & la scalabilité</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Network,
              color: "text-primary",
              title: "Couche Infrastructure",
              items: ["Réseau privé AEGIS-Q", "Nœuds validateurs militaires", "Consensus PoA souverain", "Bridge multi-chain (7+ réseaux)"],
            },
            {
              icon: Brain,
              color: "text-accent",
              title: "Couche Intelligence",
              items: ["Agents autonomes récursifs", "Mémoire fractale 5 niveaux", "RAG base de connaissances", "LLM Claude / GPT / Gemini"],
            },
            {
              icon: Shield,
              color: "text-chart-2",
              title: "Couche Sécurité",
              items: ["Chiffrement post-quantique", "Multisig 5/9 governance", "Audit smart contracts continu", "Conformité SOC2 / ISO27001"],
            },
          ].map((layer) => (
            <div key={layer.title} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <layer.icon className={`h-5 w-5 ${layer.color}`} />
                <h3 className="text-sm font-bold text-foreground">{layer.title}</h3>
              </div>
              <ul className="space-y-2">
                {layer.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <Badge variant="outline" className="border-chart-4/30 text-chart-4 mb-3">Cas d'Usage</Badge>
          <h2 className="text-2xl font-black text-foreground">Pour qui est AEGIS-Q ?</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {USECASES.map((u) => (
            <div key={u.title} className="bg-card border border-border rounded-xl p-5 flex gap-4">
              <span className="text-3xl shrink-0">{u.icon}</span>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">{u.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <Badge variant="outline" className="border-accent/30 text-accent mb-3">Tarification</Badge>
          <h2 className="text-2xl font-black text-foreground">Choisissez votre niveau de puissance</h2>
          <p className="text-sm text-muted-foreground mt-2">Tous les plans incluent l'accès au dashboard, l'authentification 2FA et les mises à jour</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`bg-card border-2 ${plan.color} rounded-2xl p-6 relative flex flex-col`}>
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4">
                  {plan.badge}
                </Badge>
              )}
              <div className="mb-4">
                <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-2xl font-black text-foreground">{plan.price}</span>
                  <span className="text-xs text-muted-foreground pb-1">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-5"
                variant={plan.name === "Professional" ? "default" : "outline"}
              >
                {plan.name === "Enterprise" ? "Contactez-nous" : "Démarrer"}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-primary/10 via-card to-accent/10 border border-primary/20 rounded-2xl p-10 text-center">
        <h2 className="text-2xl font-black text-foreground mb-3">
          Prêt à déployer votre infrastructure IA souveraine ?
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
          Rejoignez les institutions qui font confiance à AEGIS-Q pour leur infrastructure financière IA. 
          Démo personnalisée disponible sous 48h.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button size="lg" className="gap-2">
            <Zap className="h-4 w-4" />
            Demander une démo
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            <Globe className="h-4 w-4" />
            Documentation technique
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-6 font-mono">
          contact@aegis-q.io · +33 1 XX XX XX XX · aegis-q.io
        </p>
      </section>

    </div>
  );
}