import { useEffect, useState } from 'react'
import axios from 'axios'
import { TrendingDown, Users, Sparkles, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

function fmt(n) {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('fr-FR')
}

/**
 * Stats publiques collectives de la Ruche. Preuve sociale anonymisée.
 * Aucune PII — seulement les counts agrégés.
 */
export default function PublicRucheStats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${BACKEND}/api/public/ruche/stats`, { timeout: 10000 })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  const all = data.all_time || {}
  const week = data.this_week || {}
  const bees = data.by_bee_30d || []
  const maxCount = Math.max(1, ...bees.map((b) => b.count))
  const topBee = bees[0]

  if (all.total_requests === 0) return null  // Pas de données encore

  return (
    <section data-testid="public-ruche-stats" className="relative z-10 max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <p className="text-[10px] font-mono text-primary tracking-widest uppercase mb-2 flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          Preuve sociale · Données collectives
        </p>
        <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground max-w-3xl leading-tight">
          La Ruche en action — <span className="text-green-400">collectivement</span>.
        </h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Statistiques anonymisées de tous les utilisateurs AEGIS-Q. Aucune donnée personnelle. Mise à jour toutes les 60 secondes.
        </p>
      </div>

      {/* Big stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatBig
          icon={TrendingDown}
          value={fmt(all.tokens_saved)}
          suffix="tokens"
          label="Économisés au total"
          sub={`${Math.round((all.savings_ratio || 0) * 100)}% vs modèle unique`}
          color="text-green-400"
          tone="green"
        />
        <StatBig
          icon={Sparkles}
          value={fmt(all.total_requests)}
          suffix="requêtes"
          label="Routées par Qwen"
          sub={`${fmt(week.requests)} cette semaine`}
          color="text-primary"
          tone="blue"
        />
        <StatBig
          icon={Users}
          value={`$${(all.cost_saved_usd || 0).toFixed(2)}`}
          suffix=""
          label="Coût évité (collectif)"
          sub={`${all.unique_users || 0} utilisateurs actifs`}
          color="text-yellow-400"
          tone="yellow"
        />
      </div>

      {/* Top bee social proof */}
      {topBee && (
        <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 md:p-5 mb-5">
          <p className="text-sm text-foreground leading-relaxed">
            🏆 Ce mois, <span className="font-bold text-primary">{topBee.bee_label}</span> a traité{' '}
            <span className="font-bold text-foreground">{topBee.count}</span> requêtes —
            <span className="text-muted-foreground"> l'abeille la plus sollicitée par le superviseur Qwen.</span>
          </p>
        </div>
      )}

      {/* By bee repartition */}
      {bees.length > 0 && (
        <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-5">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3">
            Répartition Qwen par abeille · 30 derniers jours
          </p>
          <div className="space-y-2">
            {bees.map((b, i) => (
              <div
                key={b.bee_label}
                data-testid={`stat-bee-${i}`}
                className="flex items-center gap-3 text-[11px]"
              >
                <span className="font-mono w-5 text-muted-foreground text-right">#{i + 1}</span>
                <span className="font-semibold text-foreground min-w-[160px] truncate">
                  {b.bee_label}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', i === 0 ? 'bg-primary' : 'bg-primary/40')}
                    style={{ width: `${(b.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-muted-foreground tabular-nums w-12 text-right">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function StatBig({ icon: Icon, value, suffix, label, sub, color, tone }) {
  const bgTone = {
    green: 'from-green-500/5 to-transparent',
    blue: 'from-primary/5 to-transparent',
    yellow: 'from-yellow-500/5 to-transparent',
  }[tone]
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-5 border bg-card/60 backdrop-blur-sm bg-gradient-to-br',
      bgTone,
    )}>
      <Icon className={cn('h-4 w-4 mb-3', color)} />
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={cn('text-3xl sm:text-4xl font-bold font-mono tabular-nums leading-none', color)}>
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-mono text-muted-foreground">{suffix}</span>
        )}
      </div>
      <p className="text-[11px] font-mono text-muted-foreground tracking-widest uppercase mt-2">
        {label}
      </p>
      {sub && <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  )
}
