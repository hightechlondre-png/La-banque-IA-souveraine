import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import {
  Hexagon, Loader2, CheckCircle2, XCircle, RefreshCw,
  ArrowRight, ExternalLink, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import SmartRouteWidget from '@/components/ruche/SmartRouteWidget'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const STATUS_COLORS = {
  ok: { dot: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500/30', label: 'Opérationnel', Icon: CheckCircle2 },
  rate_limited: { dot: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30', label: 'Surchargée', Icon: XCircle },
  no_credits: { dot: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500/30', label: 'Crédit requis', Icon: XCircle },
  unavailable: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', ring: 'ring-muted/30', label: 'Indisponible', Icon: XCircle },
  error: { dot: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30', label: 'Erreur', Icon: XCircle },
}

export default function PublicRuche() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = async () => {
    try {
      setErr(null)
      const res = await axios.get(`${BACKEND}/api/public/ruche/status`, { timeout: 120000 })
      setData(res.data)
    } catch (e) {
      setErr(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Analytics : track que quelqu'un visualise la ruche publique
    axios.post(`${BACKEND}/api/analytics/track`, { event: 'public_ruche_view' }, { timeout: 5000 }).catch(() => {})
    // SEO / OpenGraph
    document.title = '🐝 La Ruche · AEGIS-Q — 9 IA spécialisées en live'
    const setMeta = (name, content) => {
      let tag = document.querySelector(`meta[property="${name}"]`) || document.querySelector(`meta[name="${name}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        if (name.startsWith('og:')) tag.setAttribute('property', name)
        else tag.setAttribute('name', name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }
    setMeta('description', 'La Ruche d\'AEGIS-Q : 9 IA spécialisées orchestrées en live. Qwen superviseur route intelligemment, Gemini reine gère la mémoire long-terme, Mistral / Llama 4 / DeepSeek R1 / Gemma / Nemotron travaillent de concert.')
    setMeta('og:title', 'La Ruche · AEGIS-Q — Hybrid Federated AI')
    setMeta('og:description', '9 IA spécialisées, routage sémantique Qwen, mémoire fédérée Gemini. Testez le routage en live.')
    setMeta('og:type', 'website')
    setMeta('twitter:card', 'summary_large_image')
  }, [])

  const bees = data?.bees || []
  const okCount = bees.filter((b) => b.status === 'ok').length

  return (
    <div data-testid="public-ruche-page" className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Background flourishes */}
      <div className="fixed inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(96,165,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.4) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      <div className="fixed -top-32 -right-40 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-32 -left-40 w-[520px] h-[520px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Hexagon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-foreground leading-none">AEGIS-Q</h1>
              <p className="text-[9px] text-muted-foreground font-mono tracking-widest mt-0.5">SOVEREIGN · MILITARY · AI</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/public-audit">
              <Button data-testid="public-ruche-audit-btn" variant="ghost" size="sm" className="hidden sm:inline-flex">Audit gratuit</Button>
            </Link>
            <Link to="/login">
              <Button data-testid="public-ruche-login-btn" variant="outline" size="sm">Connexion</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-8">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-mono tracking-widest uppercase text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
            Hybrid Federated AI Swarm
          </span>
          {data?.credits?.remaining != null && (
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary/50 rounded-full border border-border px-2 py-0.5">
              OpenRouter · ${data.credits.remaining.toFixed(2)}
            </span>
          )}
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] text-foreground max-w-4xl">
          🐝 La Ruche — <span className="text-primary">9 IA spécialisées</span>,<br />
          1 superviseur sémantique.
        </h2>
        <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-2xl">
          Pas UNE IA généraliste qu'on surcharge. <span className="text-foreground font-semibold">BEAUCOUP d'IA spécialisées</span>, chacune avec un budget tokens frugal, orchestrées par un superviseur Qwen3 Embedding qui sélectionne la meilleure abeille en <span className="text-foreground font-semibold">&lt;3 secondes</span>.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/login">
            <Button data-testid="public-ruche-cta-signup" size="lg" className="gap-2 h-12 text-sm px-6">
              <Sparkles className="h-4 w-4" />
              Activer toute la Ruche
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#demo">
            <Button data-testid="public-ruche-cta-demo" size="lg" variant="outline" className="gap-2 h-12 text-sm px-6">
              Tester en direct
            </Button>
          </a>
        </div>
      </section>

      {/* Status strip */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-4">
        <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums">
              <span className="text-green-400">{okCount}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-foreground">{bees.length || 9}</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              Abeilles actives
            </span>
          </div>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Statut en temps réel — probes OpenRouter toutes les 60s. Fallback Claude Opus 4.5 garanti.
          </p>
          <Button
            data-testid="public-ruche-refresh-btn"
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); load() }}
            disabled={loading}
            className="gap-1.5 shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </Button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </section>

      {/* Bees grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-4">
        {loading && !data ? (
          <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Probe de la ruche en cours…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {bees.map((b) => {
              const st = STATUS_COLORS[b.status] || STATUS_COLORS.error
              return (
                <div
                  key={b.label}
                  data-testid={`public-bee-${(b.label || '').toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn(
                    'rounded-xl p-4 border bg-card/70 backdrop-blur-sm flex items-start gap-3',
                    b.status === 'ok' && 'ring-1 ring-green-500/20 border-green-500/20',
                  )}
                >
                  <div className="shrink-0 text-2xl leading-none">{b.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', st.dot)} />
                      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{b.tier}</span>
                      {b.is_embedding && <span className="text-[9px] font-mono text-primary tracking-widest">· EMB</span>}
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{b.label}</p>
                    {b.specialty && (
                      <p className="text-[11px] text-foreground/60 mt-1 leading-snug line-clamp-2" title={b.specialty}>
                        {b.specialty}
                      </p>
                    )}
                    {b.budget != null && (
                      <p className="text-[9px] font-mono text-amber-400/80 mt-1 tracking-widest">
                        {b.budget} tok
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Demo widget */}
      <section id="demo" className="relative z-10 max-w-6xl mx-auto px-6 py-10 scroll-mt-8">
        <div className="mb-5">
          <p className="text-[10px] font-mono text-primary tracking-widest uppercase mb-2">Démo live</p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground max-w-3xl">
            Tape ta tâche, vois Qwen choisir.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Aucun compte nécessaire. 5 requêtes/heure par IP. Tu vas voir le top-3 Qwen avec le score de similarité sémantique en temps réel.
          </p>
        </div>
        <SmartRouteWidget />
      </section>

      {/* CTA final */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 rounded-2xl p-8 md:p-10 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="max-w-2xl">
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
                Débloque la Ruche complète.
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Chat cognitif illimité, orchestration d'agents, audit IA de smart contracts, mémoire N-MEM-B fédérée,
                staking advisor DeepSeek R1, et accès à toutes les abeilles spécialisées sans rate-limit.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap shrink-0">
              <Link to="/login">
                <Button data-testid="public-ruche-cta-final" size="lg" className="gap-2 h-12">
                  <Sparkles className="h-4 w-4" />
                  Créer un compte
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/public-audit">
                <Button data-testid="public-ruche-audit-strip" size="lg" variant="outline" className="gap-2 h-12">
                  Tester l'audit <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between gap-3">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
            AEGIS-Q · 2026 · Hybrid Federated Cognitive AI
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Accueil</Link>
            <Link to="/public-audit" className="hover:text-primary transition-colors">Audit gratuit</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
