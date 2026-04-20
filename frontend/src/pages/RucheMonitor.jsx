import { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock,
  Zap, RefreshCw, Send, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const STATUS_STYLES = {
  ok:           { c: 'text-green-400',   bg: 'bg-green-500/10 border-green-500/40',    Icon: CheckCircle2, label: 'Opérationnel' },
  no_credits:   { c: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/40',  Icon: AlertTriangle, label: 'Crédit requis' },
  rate_limited: { c: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/40',  Icon: Clock,        label: 'Rate-limited' },
  unavailable:  { c: 'text-muted-foreground', bg: 'bg-muted/20 border-border',         Icon: XCircle,      label: 'Indisponible' },
  error:        { c: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/40',        Icon: XCircle,      label: 'Erreur' },
  exception:    { c: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/40',        Icon: XCircle,      label: 'Exception' },
}

const USECASES = [
  { key: 'cognitive_chat',  label: 'Cognitive Chat' },
  { key: 'agent_orchestr',  label: 'Agent Orchestrator' },
  { key: 'staking_advisor', label: 'Staking Advisor' },
  { key: 'contract_audit',  label: 'Smart Contract Audit' },
  { key: 'skill_test',      label: 'Skill Tester' },
]

export default function RucheMonitor() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [testOpen, setTestOpen] = useState(false)
  const [testUsecase, setTestUsecase] = useState('cognitive_chat')
  const [testQuery, setTestQuery] = useState('Quel est le rôle stratégique de AEGIS-Q ?')
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)

  const load = async () => {
    try {
      setErr(null)
      const res = await axios.get(`${BACKEND}/api/ruche/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        timeout: 120000,
      })
      setData(res.data)
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const runTest = async () => {
    setTestLoading(true); setTestResult(null)
    try {
      const res = await axios.post(
        `${BACKEND}/api/ruche/test`,
        { usecase: testUsecase, query: testQuery },
        { headers: { Authorization: `Bearer ${getToken()}` }, timeout: 120000 },
      )
      setTestResult(res.data)
    } catch (e) {
      setTestResult({ error: e?.message || 'Erreur' })
    } finally {
      setTestLoading(false)
    }
  }

  const bees = data?.bees || []
  const okCount = bees.filter((b) => b.status === 'ok').length
  const totalCount = bees.length

  return (
    <div data-testid="ruche-monitor" className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              🐝 La Ruche
            </h2>
            <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 tracking-widest uppercase">
              Hybrid Federated AI
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            9 abeilles spécialisées · Router Qwen · Reine Gemini · OpenRouter unique
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground font-mono tabular-nums leading-none">
              <span className="text-green-400">{okCount}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span>{totalCount}</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase mt-1">
              Abeilles Actives
            </p>
          </div>
          <Button
            data-testid="ruche-refresh-btn"
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); load() }}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Re-probe
          </Button>
        </div>
      </div>

      {err && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Bees grid */}
      {loading && !data ? (
        <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Probe de la ruche en cours…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bees.map((b) => {
            const st = STATUS_STYLES[b.status] || STATUS_STYLES.error
            const Icon = st.Icon
            return (
              <div
                key={b.role}
                data-testid={`ruche-bee-${b.role}`}
                className={cn(
                  'rounded-xl p-4 border bg-card flex items-start gap-3 relative overflow-hidden',
                  b.status === 'ok' && 'ring-1 ring-green-500/30',
                )}
              >
                <div className="shrink-0 text-2xl leading-none">{b.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-foreground uppercase tracking-widest">{b.role}</span>
                    <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
                      {b.tier}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{b.label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{b.model}</p>
                  <div className={cn('mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold', st.bg)}>
                    <Icon className={cn('h-3 w-3', st.c)} />
                    <span className={st.c}>{st.label}</span>
                  </div>
                  {b.reason && b.status !== 'ok' && (
                    <p className="text-[10px] text-muted-foreground mt-2 leading-snug truncate" title={b.reason}>
                      {b.reason.slice(0, 90)}
                    </p>
                  )}
                  {b.is_embedding && (
                    <p className="text-[9px] text-primary mt-1 font-mono tracking-widest uppercase">EMBEDDING</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Usecase routing */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Routage des cas d'usage
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chaque usecase essaie la primaire puis bascule automatiquement sur les fallbacks
            </p>
          </div>
          <Button
            data-testid="ruche-test-toggle-btn"
            variant="outline"
            size="sm"
            onClick={() => setTestOpen(!testOpen)}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {testOpen ? 'Fermer le test' : 'Tester la ruche'}
          </Button>
        </div>

        <div className="space-y-2">
          {data?.usecases && Object.entries(data.usecases).map(([key, route]) => (
            <div key={key} className="flex items-center gap-3 flex-wrap bg-secondary/30 rounded-lg px-3 py-2">
              <span className="text-xs font-semibold text-foreground min-w-[160px]">{key}</span>
              <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">
                {route.primary}
              </span>
              <span className="text-xs text-muted-foreground">→ fallback :</span>
              {route.fallback.map((f) => (
                <span key={f} className="text-[10px] font-mono text-muted-foreground bg-muted/30 border border-border rounded px-1.5 py-0.5">
                  {f}
                </span>
              ))}
            </div>
          ))}
        </div>

        {testOpen && (
          <div className="mt-5 pt-5 border-t border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Use case</label>
                <select
                  data-testid="ruche-test-usecase-select"
                  value={testUsecase}
                  onChange={(e) => setTestUsecase(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground"
                >
                  {USECASES.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Query</label>
                <input
                  data-testid="ruche-test-query-input"
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground"
                />
              </div>
            </div>
            <Button
              data-testid="ruche-test-run-btn"
              onClick={runTest}
              disabled={testLoading}
              className="gap-1.5"
            >
              {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {testLoading ? 'Ruche en action…' : 'Envoyer à La Ruche'}
            </Button>

            {testResult && (
              <div data-testid="ruche-test-result" className="mt-3 bg-background/60 border border-border rounded-lg p-4">
                {testResult.error ? (
                  <p className="text-sm text-destructive">Erreur : {testResult.error}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Répondu par</span>
                      <span className="text-sm font-semibold text-green-400">
                        {testResult.bee_label || testResult.bee_used || '—'}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        (essais : {testResult.attempts?.length ?? 0})
                      </span>
                    </div>
                    {testResult.attempts?.length > 1 && (
                      <div className="mb-3 space-y-1">
                        {testResult.attempts.map((a, i) => (
                          <div key={i} className="text-[11px] font-mono flex items-center gap-2">
                            <span className={cn(
                              'inline-block w-2 h-2 rounded-full',
                              a.status === 'ok' ? 'bg-green-500' : 'bg-red-500',
                            )} />
                            <span className="text-foreground">{a.role}</span>
                            <span className="text-muted-foreground">· {a.status}</span>
                            {a.reason && <span className="text-muted-foreground/70 truncate">{a.reason.slice(0, 60)}…</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3">
                      {testResult.content}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help card — add credits */}
      {bees.some((b) => b.status === 'no_credits') && (
        <div className="bg-gradient-to-br from-yellow-500/10 to-primary/5 border border-yellow-500/30 rounded-xl p-5">
          <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Activer le reste de la Ruche
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Certaines abeilles (Mistral Large, Llama 4, Gemma, Qwen, Gemini) nécessitent un crédit OpenRouter.
            Ajoutez du crédit sur <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer" className="text-primary underline">openrouter.ai/settings/credits</a> (même $5 débloquent tout),
            puis cliquez sur « Re-probe ». Les abeilles gratuites (Nemotron, MiniMax) + fallback Claude Opus 4.5 fonctionnent déjà sans crédit.
          </p>
        </div>
      )}
    </div>
  )
}
