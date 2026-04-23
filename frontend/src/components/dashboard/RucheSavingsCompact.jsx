import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import { TrendingDown, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

/**
 * Widget compact pour la Dashboard home.
 * Affiche les économies tokens + sparkline 14j.
 * Cliquer mène vers /ruche pour les détails.
 */
export default function RucheSavingsCompact() {
  const [savings, setSavings] = useState(null)
  const [trend, setTrend] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getToken()}` }
    Promise.all([
      axios.get(`${BACKEND}/api/ruche/savings?days=30`, { headers, timeout: 10000 }),
      axios.get(`${BACKEND}/api/ruche/savings/trend?days=14`, { headers, timeout: 10000 }),
    ])
      .then(([s, t]) => { setSavings(s.data); setTrend(t.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ratio = savings?.tokens?.savings_ratio || 0
  const saved = savings?.tokens?.saved || 0
  const costSaved = savings?.cost_usd?.saved || 0
  const requests = savings?.total_requests || 0
  const series = trend?.series || []

  // Sparkline SVG
  const maxSaved = Math.max(1, ...series.map((s) => s.tokens_saved))
  const w = 160, h = 40
  const points = series.length > 1
    ? series.map((s, i) => {
        const x = (i / (series.length - 1)) * w
        const y = h - (s.tokens_saved / maxSaved) * h
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
    : ''

  return (
    <Link
      to="/ruche"
      data-testid="dashboard-savings-card"
      className="group bg-card border border-border rounded-xl p-4 hover:border-green-500/30 transition-all relative overflow-hidden block"
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-green-500/10 transition-colors" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
              Token Savings · 30j
            </span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {loading ? (
          <div className="h-[88px] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-muted-foreground animate-pulse" />
          </div>
        ) : requests === 0 ? (
          <div className="py-4">
            <p className="text-2xl font-bold font-mono text-foreground leading-none">0</p>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              Aucune requête Ruche encore. Ouvre le chat cognitif ou l'audit IA pour voir tes économies démarrer.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div>
                <p className="text-3xl font-bold font-mono tabular-nums text-green-400 leading-none">
                  {saved.toLocaleString('fr-FR')}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mt-1.5">
                  Tokens économisés
                </p>
              </div>
              {series.length > 1 && (
                <svg
                  data-testid="savings-sparkline"
                  width={w}
                  height={h}
                  viewBox={`0 0 ${w} ${h}`}
                  className="shrink-0"
                >
                  <defs>
                    <linearGradient id="sparkG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Area under curve */}
                  <polygon
                    points={`0,${h} ${points} ${w},${h}`}
                    fill="url(#sparkG)"
                  />
                </svg>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span>
                  <span className="text-foreground font-semibold">{requests}</span> req
                </span>
                <span>·</span>
                <span>
                  <span className="text-green-400 font-semibold">{Math.round(ratio * 100)}%</span> économisé
                </span>
                <span>·</span>
                <span>
                  <span className="text-yellow-400 font-semibold">${costSaved.toFixed(4)}</span> évité
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Link>
  )
}
