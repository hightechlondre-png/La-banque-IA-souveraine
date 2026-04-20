import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import {
  Shield, ShieldCheck, Brain, Zap, Lock, Activity,
  ChevronRight, Sparkles, Code2, Hexagon, GitBranch, Github,
  ArrowRight, TrendingUp, Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    icon: Brain,
    title: 'Cognitive AI Souveraine',
    desc: 'Claude Opus 4.5 branché sur mémoire fractale N-MEM-B 5 niveaux, audit trail signé, gouvernance DAO.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit IA de Smart Contracts',
    desc: 'Détection reentrancy, access control, overflow et +20 catégories en 30 secondes. Badge cryptographique signé HMAC-SHA256.',
  },
  {
    icon: Activity,
    title: 'Tokenomique Déflationniste',
    desc: 'Staking multi-tiers (Standard/Premium/Gold), burn rate DAO-piloté, bridge cross-chain avec fraud proofs.',
  },
  {
    icon: Network,
    title: 'IA Cognitive Hybride Fédérée',
    desc: 'Agents autonomes (analyst, optimizer, monitor, executor, coordinator) avec skills & RAG TF-IDF.',
  },
  {
    icon: Lock,
    title: 'Cryptographie Post-Quantique',
    desc: 'Kyber / Dilithium + Zero-Knowledge Proofs pour les transactions sensibles. Simulation Quantum Attack.',
  },
  {
    icon: TrendingUp,
    title: 'Market Pulse Temps Réel',
    desc: 'Prix BTC/ETH/SOL via CoinGecko, synthétique AQ en panier pondéré, alertes DAO configurables.',
  },
]

const METRICS = [
  { value: '51+', label: 'Modules opérationnels' },
  { value: '6', label: 'Cas d\'usage Claude Opus' },
  { value: '10', label: 'Entités persistées' },
  { value: '100%', label: 'Tests backend green' },
]

export default function Landing() {
  useEffect(() => {
    const BACKEND =
      import.meta.env.REACT_APP_BACKEND_URL ||
      (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
      ''
    axios
      .post(
        `${BACKEND}/api/analytics/track`,
        { event: 'landing_view' },
        {
          headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
          timeout: 5000,
        },
      )
      .catch(() => {})
  }, [])

  return (
    <div
      data-testid="landing-page"
      className="min-h-screen bg-background text-foreground relative overflow-x-hidden"
    >
      {/* Grid background */}
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="fixed -top-32 -right-40 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-32 -left-40 w-[520px] h-[520px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Hexagon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-foreground leading-none">AEGIS-Q</h1>
              <p className="text-[9px] text-muted-foreground font-mono tracking-widest mt-0.5">
                SOVEREIGN · MILITARY · AI
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/public-audit">
              <Button
                data-testid="landing-audit-nav-btn"
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Audit Gratuit
              </Button>
            </Link>
            <Link to="/login">
              <Button data-testid="landing-login-btn" variant="outline" size="sm">
                Connexion
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-14 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-mono tracking-widest uppercase text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live · Claude Opus 4.5
          </span>
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
            Build 2026.Q1
          </span>
        </div>

        <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.95] text-foreground max-w-5xl">
          La banque IA souveraine,
          <br />
          <span className="text-primary">cognitive</span> et <span className="text-primary">quantum-safe</span>.
        </h2>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          AEGIS-Q combine IA cognitive hybride fédérée, tokenomique déflationniste, gouvernance DAO et cybersécurité cognitive dans une infrastructure militaire de niveau souverain. Propulsée par <span className="text-foreground font-semibold">Claude Opus 4.5</span>.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/public-audit">
            <Button data-testid="landing-cta-audit-btn" size="lg" className="gap-2 h-12 text-sm px-6">
              <Sparkles className="h-4 w-4" />
              Auditer un Smart Contract gratuitement
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button
              data-testid="landing-cta-dashboard-btn"
              size="lg"
              variant="outline"
              className="gap-2 h-12 text-sm px-6"
            >
              Accéder à la Dashboard
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Metrics strip */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
          {METRICS.map((m) => (
            <div
              key={m.label}
              className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4"
            >
              <p className="text-3xl font-bold text-foreground font-mono tabular-nums">{m.value}</p>
              <p className="text-[11px] text-muted-foreground tracking-wider mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="mb-10">
          <p className="text-[10px] font-mono text-primary tracking-widest uppercase mb-2">Capacités</p>
          <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground max-w-3xl">
            Une plateforme, toute la chaîne de valeur cognitive.
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="text-base font-bold text-foreground mb-1.5">{f.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Public audit CTA strip */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 rounded-2xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-mono text-primary tracking-widest uppercase">
                  API PUBLIC · GRATUIT · 3 AUDITS/HEURE
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
                Votre smart contract, audité par Claude Opus 4.5 en 30 secondes.
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Collez votre Solidity, obtenez un score /100, la liste des vulnérabilités classées par sévérité,
                et un badge cryptographique signé HMAC-SHA256 embarquable sur GitHub.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap shrink-0">
              <Link to="/public-audit">
                <Button
                  data-testid="landing-cta-audit-strip-btn"
                  size="lg"
                  className="gap-2 h-12"
                >
                  <Shield className="h-4 w-4" />
                  Lancer un audit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-muted-foreground">
          {[
            { icon: Lock, label: 'HMAC-SHA256 Signed' },
            { icon: Zap, label: 'Real-time CoinGecko' },
            { icon: GitBranch, label: 'DAO Governance' },
            { icon: Brain, label: 'Claude Opus 4.5' },
            { icon: ShieldCheck, label: 'Zero-Knowledge Proofs' },
          ].map(({ icon: I, label }) => (
            <div key={label} className="flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase">
              <I className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border mt-14">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between gap-4">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
            AEGIS-Q · 2026 · Sovereign Military AI Banking
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <Link to="/public-audit" className="hover:text-primary transition-colors">Audit gratuit</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
