import { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import { TrendingDown, Loader2, Coins, Zap, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const WINDOWS = [
  { key: 7, label: '7j' },
  { key: 30, label: '30j' },
  { key: 90, label: '90j' },
]

/**
 * Affiche les économies tokens/coût grâce au routage Qwen vs un modèle
 * généraliste unique (baseline = Mistral Large @ 2000 tok/req).
 */
export default function RucheSavings({ className = '' }) {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  const load = async (w) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BACKEND}/api/ruche/savings?days=${w}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        timeout: 15000,
      })
      setData(res.data)
    } catch (e) {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(days) }, [days])

  const ratio = data?.tokens?.savings_ratio || 0
  const saved = data?.tokens?.saved || 0
  const costSaved = data?.cost_usd?.saved || 0
  const requests = data?.total_requests || 0
  const bees = data?.by_bee || []
  const maxCount = Math.max(1, ...bees.map((b) => b.count))

  return (
    <div
      data-testid="ruche-savings"
      className={cn(
        'bg-card border border-border rounded-xl p-5 relative overflow-hidden',
        className,
      )}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-400" />
              Token Savings
              <span className="text-[9px] font-mono text-green-400 bg-green-500/10 border border-green-500/30 rounded px-1.5 py-0.5 tracking-widest uppercase">
                Live
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Économies réalisées grâce au routage Qwen → abeille spécialisée, vs un modèle généraliste unique (baseline 2000 tok/requête).
            </p>
          </div>
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                data-testid={`savings-window-${w.key}`}
                onClick={() => setDays(w.key)}
                className={cn(
                  'text-[10px] font-mono px-2.5 py-1 rounded-md border transition-colors',
                  days === w.key
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-secondary/30 border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Calcul en cours…</span>
          </div>
        ) : requests === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune requête dans cette fenêtre. Utilise une abeille (Chat, Audit, Staking) pour voir les économies.
            </p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <KPI
                icon={Layers}
                label="Requêtes"
                value={requests.toLocaleString('fr-FR')}
                sub={`${data.tokens.ruche_actual.toLocaleString('fr-FR')} tok`}
                color="text-foreground"
              />
              <KPI
                icon={Zap}
                label="Tokens économisés"
                value={saved.toLocaleString('fr-FR')}
                sub={`vs ${data.tokens.baseline_single_model.toLocaleString('fr-FR')} baseline`}
                color="text-green-400"
              />
              <KPI
                icon={TrendingDown}
                label="Ratio économies"
                value={`${Math.round(ratio * 100)}%`}
                sub={`${days}j glissants`}
                color="text-green-400"
              />
              <KPI
                icon={Coins}
                label="Coût évité"
                value={`$${costSaved.toFixed(4)}`}
                sub={`vs $${data.cost_usd.baseline_single_model.toFixed(4)}`}
                color="text-yellow-400"
              />
            </div>

            {/* Répartition par abeille */}
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">
                Répartition Qwen par abeille
              </p>
              <div className="space-y-1.5">
                {bees.map((b) => (
                  <div
                    key={b.bee_role}
                    data-testid={`savings-bee-${b.bee_role}`}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="font-semibold text-foreground min-w-[140px] truncate">
                      {b.bee_label || b.bee_role}
                    </span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 transition-all"
                        style={{ width: `${(b.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-muted-foreground tabular-nums w-12 text-right">
                      {b.count}×
                    </span>
                    <span className="font-mono text-muted-foreground/70 tabular-nums w-20 text-right">
                      {b.tokens_used.toLocaleString('fr-FR')} tok
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KPI({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-secondary/30 border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3 w-3', color)} />
        <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">{label}</span>
      </div>
      <p className={cn('text-xl font-bold font-mono tabular-nums leading-none', color)}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  )
}
