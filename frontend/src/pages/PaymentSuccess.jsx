import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, Hexagon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  const [state, setState] = useState('polling') // polling | paid | failed | expired
  const [info, setInfo] = useState(null)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      setState('failed')
      return
    }
    let cancelled = false
    const MAX = 8
    let a = 0

    const poll = async () => {
      if (cancelled) return
      a += 1
      setAttempts(a)
      try {
        const res = await axios.get(
          `${BACKEND}/api/payments/checkout/status/${sessionId}`,
          { headers: { Authorization: `Bearer ${getToken()}` }, timeout: 10000 },
        )
        setInfo(res.data)
        if (res.data?.payment_status === 'paid') {
          setState('paid')
          return
        }
        if (res.data?.status === 'expired') {
          setState('expired')
          return
        }
      } catch (e) {
        if (a >= MAX) {
          setState('failed')
          return
        }
      }
      if (a >= MAX) {
        setState('expired')
        return
      }
      setTimeout(poll, 2500)
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const Header = (
    <div className="flex items-center gap-3 justify-center mb-6">
      <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
        <Hexagon className="h-6 w-6 text-primary" />
      </div>
      <div className="text-left">
        <h1 className="text-lg font-bold tracking-wider text-foreground">AEGIS-Q</h1>
        <p className="text-[10px] text-muted-foreground font-mono tracking-widest">
          PAYMENT STATUS
        </p>
      </div>
    </div>
  )

  return (
    <div
      data-testid="payment-success-page"
      className="min-h-screen bg-background flex items-center justify-center px-6"
    >
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 text-center">
        {Header}

        {state === 'polling' && (
          <div data-testid="payment-polling">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              Vérification du paiement…
            </h2>
            <p className="text-xs text-muted-foreground">
              Tentative {attempts}/8 · Session : {sessionId?.slice(0, 20)}…
            </p>
          </div>
        )}

        {state === 'paid' && (
          <div data-testid="payment-paid">
            <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Paiement confirmé
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              Montant : <span className="text-foreground font-mono">
                ${((info?.amount_total ?? 0) / 100).toFixed(2)} {info?.currency?.toUpperCase()}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Plan activé : <span className="text-primary font-semibold">
                {info?.metadata?.package_id || 'AEGIS-Q'}
              </span>
            </p>
            <Button
              data-testid="payment-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              Accéder à la Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {(state === 'failed' || state === 'expired') && (
          <div data-testid="payment-failed">
            <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {state === 'expired' ? 'Session expirée' : 'Paiement échoué'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {state === 'expired'
                ? 'La vérification a pris trop de temps. Votre email de confirmation fait foi.'
                : 'Impossible de vérifier le paiement. Contactez le support si un débit a eu lieu.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Link to="/brochure">
                <Button variant="outline">Retour aux tarifs</Button>
              </Link>
              <Link to="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
