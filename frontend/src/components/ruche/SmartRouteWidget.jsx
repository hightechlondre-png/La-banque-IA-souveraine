import { useState } from 'react'
import axios from 'axios'
import { Sparkles, Zap, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const EXAMPLES = [
  'Audit ce smart contract Solidity pour trouver des réentrances',
  'Calcule mon APY de staking sur 10000 AQ pendant 90 jours',
  'Résume cette longue documentation technique en 5 points',
  'Plan multi-étapes pour orchestrer 3 agents autonomes',
]

/**
 * Widget de démo smart-route Qwen — utilisable sur landing (compact)
 * ou sur page publique /la-ruche (full).
 * Appelle /api/public/ruche/smart-route (pas d'auth, rate-limited 5/h par IP).
 */
export default function SmartRouteWidget({ compact = false, className = '' }) {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async () => {
    if (!query.trim()) return
    setLoading(true); setErr(null); setResult(null)
    try {
      const res = await axios.post(
        `${BACKEND}/api/public/ruche/smart-route`,
        { query: query.trim() },
        { timeout: 25000 },
      )
      setResult(res.data)
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-testid="smart-route-widget"
      className={cn(
        'relative rounded-xl border bg-card/80 backdrop-blur-sm',
        compact ? 'p-5 border-primary/30' : 'p-6 border-border',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Auto Route <span className="text-muted-foreground font-normal">· Qwen Superviseur</span>
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
            Tape ta tâche en langage naturel. Qwen3 Embedding calcule la similarité sémantique avec les 7 abeilles spécialisées et sélectionne la meilleure en temps réel.
          </p>
        </div>
        <span className="text-[9px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5 tracking-widest uppercase shrink-0">
          Démo publique · 5/h
        </span>
      </div>

      {/* Examples chips */}
      {!compact && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              data-testid={`smart-route-example-${e.slice(0, 15)}`}
              onClick={() => setQuery(e)}
              className="text-[10px] font-mono text-muted-foreground bg-secondary/50 border border-border hover:border-primary/40 hover:text-foreground rounded-full px-2.5 py-1 transition-colors"
            >
              {e.length > 55 ? e.slice(0, 52) + '…' : e}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          data-testid="smart-route-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={400}
          placeholder="Décris ta tâche…"
          className="h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
        />
        <Button
          data-testid="smart-route-submit-btn"
          onClick={submit}
          disabled={loading || !query.trim()}
          className="gap-1.5 h-11 px-4"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {loading ? 'Qwen route…' : 'Router'}
        </Button>
      </div>

      {err && (
        <div data-testid="smart-route-error" className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      {result && !err && (
        <div data-testid="smart-route-result" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Abeille choisie</span>
            <span className="text-sm font-bold text-green-400">{result.label}</span>
            <span className="text-[11px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">
              sim {(result.similarity || 0).toFixed(3)}
            </span>
            {typeof result.remaining_calls === 'number' && (
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                {result.remaining_calls} / 5 restants
              </span>
            )}
          </div>
          {result.specialty && (
            <p className="text-xs text-foreground/70 leading-relaxed italic">
              → {result.specialty}
            </p>
          )}
          {result.top?.length > 0 && (
            <div className="space-y-1.5 mt-1">
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Top matches Qwen</p>
              {result.top.map((t, i) => (
                <div
                  key={t.label}
                  data-testid={`smart-route-top-${i}`}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="font-mono w-4 text-muted-foreground">#{i + 1}</span>
                  <span className="font-semibold text-foreground min-w-[140px] truncate">{t.label}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all', i === 0 ? 'bg-primary' : 'bg-primary/40')}
                      style={{ width: `${Math.max(0, Math.min(100, (t.similarity || 0) * 100))}%` }}
                    />
                  </div>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {(t.similarity || 0).toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
