import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Loader2,
  Copy, Check, Code2, AlertTriangle, Sparkles, ChevronRight, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const SEVERITY_STYLES = {
  CRITIQUE: 'bg-red-500/15 text-red-400 border-red-500/40',
  'ÉLEVÉE': 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  ELEVEE: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  MOYENNE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  FAIBLE: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  INFO: 'bg-muted text-muted-foreground border-border',
}

const EXAMPLE = `pragma solidity ^0.8.0;

contract Vault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success,) = msg.sender.call{value: amount}("");
        balances[msg.sender] = 0;
    }
}`

function ScoreDial({ score }) {
  const getColor = (s) => {
    if (s >= 80) return { c: 'text-green-400', bg: 'stroke-green-400', label: 'SECURE' }
    if (s >= 60) return { c: 'text-yellow-400', bg: 'stroke-yellow-400', label: 'WARN' }
    if (s >= 40) return { c: 'text-orange-400', bg: 'stroke-orange-400', label: 'RISK' }
    return { c: 'text-red-400', bg: 'stroke-red-400', label: 'UNSAFE' }
  }
  const { c, bg, label } = getColor(score)
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle cx="50" cy="50" r="42" className="stroke-border fill-none" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="42"
          className={cn('fill-none transition-all duration-700 ease-out', bg)}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold font-mono tabular-nums', c)}>{score}</span>
        <span className={cn('text-[9px] font-mono tracking-widest', c)}>{label}</span>
      </div>
    </div>
  )
}

export default function PublicAudit() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('Contract.sol')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  const run = async () => {
    if (code.trim().length < 20) {
      setError('Collez au moins 20 caractères de Solidity.')
      return
    }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await axios.post(`${BACKEND}/api/public/audit`,
        { code, name },
        { timeout: 120000, headers: { 'Content-Type': 'application/json' } },
      )
      setResult(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  const badgeSvgUrl = result?.audit_id
    ? `${BACKEND}/api/public/badge/${result.audit_id}.svg`
    : null
  const verifyUrl = result?.badge_token
    ? `${BACKEND}/api/public/badge/verify?token=${encodeURIComponent(result.badge_token)}`
    : null
  const markdownSnippet = badgeSvgUrl
    ? `[![Audited by AEGIS-Q](${badgeSvgUrl})](${verifyUrl})`
    : ''

  const score = result?.score ?? 0

  return (
    <div
      data-testid="public-audit-page"
      className="min-h-screen bg-background text-foreground relative overflow-x-hidden"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/15 blur-[100px]" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-[100px]" />

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wider text-foreground">
                AEGIS-Q · Audit IA Public
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest">
                POWERED BY CLAUDE OPUS 4.5 · 3 AUDITS GRATUITS/HEURE
              </p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm" data-testid="public-audit-login-btn">
              Se connecter <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <div className="mb-8 max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
            Auditez votre <span className="text-primary">smart contract</span> en 30 secondes.
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Collez votre Solidity. Notre IA militaire Claude Opus 4.5 détecte reentrancy,
            overflow, access control et +20 catégories de vulnérabilités. Obtenez un badge
            <span className="text-foreground font-semibold"> signé cryptographiquement</span>
            {' '}embarquable sur GitHub ou votre site.
          </p>
        </div>

        {/* Input + Run */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-1.5">
                <Code2 className="h-3 w-3" /> Solidity Source
              </label>
              <input
                data-testid="public-audit-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MyContract.sol"
                className="h-7 px-2 rounded bg-secondary border border-border text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-40"
              />
            </div>
            <textarea
              data-testid="public-audit-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={EXAMPLE}
              rows={14}
              className="w-full bg-background border border-border rounded-lg p-3 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
            />
            <div className="flex items-center justify-between mt-3">
              <button
                data-testid="public-audit-example-btn"
                onClick={() => setCode(EXAMPLE)}
                className="text-[11px] font-mono text-primary hover:underline"
              >
                Charger l'exemple vulnérable →
              </button>
              <Button
                data-testid="public-audit-run-btn"
                onClick={run}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Lancer l'audit IA
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div data-testid="public-audit-error" className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Comment ça marche
            </h3>
            <ul className="space-y-2.5 text-[11px] text-muted-foreground leading-relaxed">
              <li className="flex gap-2"><span className="text-primary font-mono">01</span><span>Claude Opus 4.5 analyse votre code ligne par ligne.</span></li>
              <li className="flex gap-2"><span className="text-primary font-mono">02</span><span>Score sur 100 + liste de vulnérabilités classées par sévérité.</span></li>
              <li className="flex gap-2"><span className="text-primary font-mono">03</span><span>Badge SVG signé HMAC-SHA256 — infalsifiable.</span></li>
              <li className="flex gap-2"><span className="text-primary font-mono">04</span><span>Liberté : audit permanent via URL publique.</span></li>
            </ul>
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Pour des <span className="text-foreground font-semibold">audits illimités</span>, rapports PDF sans watermark et intégration CI/CD,
                <Link to="/login" className="text-primary hover:underline ml-1">créez un compte opérateur</Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div data-testid="public-audit-result" className="space-y-5">
            {/* Score + meta */}
            <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-xl p-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <ScoreDial score={score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-foreground">{name}</h3>
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded">
                      ID {result.audit_id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {result.result?.resume || 'Audit terminé.'}
                  </p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground px-2 py-1 rounded bg-secondary border border-border">
                      {result.watermark}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {result.limits?.remaining ?? 0}/{result.limits?.per_ip_per_hour ?? 3} audits restants
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Badge cryptographique
              </h3>
              <div className="flex items-center gap-3 flex-wrap mb-4">
                {badgeSvgUrl && (
                  <img src={badgeSvgUrl} alt="Badge AEGIS-Q" className="h-11" />
                )}
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  data-testid="public-audit-verify-link"
                >
                  Vérifier la signature <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                  Snippet Markdown (README / site)
                </label>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 bg-background border border-border rounded-lg p-3 text-[10px] font-mono text-foreground overflow-x-auto whitespace-nowrap">
                    {markdownSnippet}
                  </code>
                  <Button
                    data-testid="public-audit-copy-btn"
                    variant="outline"
                    size="sm"
                    onClick={() => copy(markdownSnippet, 'md')}
                    className="h-[42px] shrink-0"
                  >
                    {copied === 'md' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Vulnerabilities */}
            {result.result?.vulnerabilites?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  {result.result.vulnerabilites.length} vulnérabilité{result.result.vulnerabilites.length > 1 ? 's' : ''} détectée{result.result.vulnerabilites.length > 1 ? 's' : ''}
                </h3>
                <div className="space-y-3">
                  {result.result.vulnerabilites.map((v, i) => (
                    <div
                      key={i}
                      className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                      data-testid={`public-audit-vuln-${i}`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={cn(
                              'text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded border',
                              SEVERITY_STYLES[v.severite] || SEVERITY_STYLES.INFO,
                            )}>
                              {v.severite}
                            </span>
                            {v.categorie && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {v.categorie}
                              </span>
                            )}
                            {v.ligne != null && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border px-1.5 py-0.5 rounded">
                                L.{v.ligne}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground leading-snug">{v.titre}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-2">{v.description}</p>
                      {v.recommandation && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">
                            Recommandation
                          </p>
                          <p className="text-xs text-foreground leading-relaxed">{v.recommandation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positive points */}
            {result.result?.points_positifs?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-400" />
                  Points positifs
                </h3>
                <ul className="space-y-2">
                  {result.result.points_positifs.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <Check className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <footer className="mt-16 text-center text-[10px] text-muted-foreground font-mono tracking-widest">
          AEGIS-Q · 2026 · Sovereign Military AI
        </footer>
      </div>
    </div>
  )
}
