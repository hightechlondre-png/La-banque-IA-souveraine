import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Hexagon, Loader2, ShieldCheck, Lock, Mail } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { loginWithCredentials, registerWithCredentials } = useAuth()
  const [mode, setMode] = useState('login') // or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await loginWithCredentials(email, password)
      } else {
        await registerWithCredentials(email, password, fullName)
      }
      navigate('/')
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Erreur d'authentification"
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden"
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="w-full max-w-md mx-auto px-6 relative">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Hexagon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-foreground">AEGIS-Q</h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-widest">
              MILITARY · SOVEREIGN · AI
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {mode === 'login' ? 'Accès Sécurisé' : 'Enrôlement Opérateur'}
            </h2>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
                  Nom complet
                </label>
                <input
                  data-testid="register-fullname-input"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ingénieur IA Cognitive"
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@aegis-q.mil"
                className="mt-1 w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Mot de passe
              </label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs"
              >
                {error}
              </div>
            )}

            <Button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'login' ? (
                'Se connecter'
              ) : (
                'Créer le compte'
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border text-center">
            {mode === 'login' ? (
              <button
                data-testid="switch-to-register-btn"
                onClick={() => setMode('register')}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Pas encore enrôlé ? <span className="text-primary font-semibold">Créer un compte</span>
              </button>
            ) : (
              <button
                data-testid="switch-to-login-btn"
                onClick={() => setMode('login')}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Déjà enrôlé ? <span className="text-primary font-semibold">Se connecter</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-muted-foreground font-mono tracking-widest">
          BUILD · 2026.Q1 · CLAUDE OPUS 4.5
        </p>
        <p className="text-center mt-2 text-[10px] text-muted-foreground">
          <Link to="/" className="underline hover:text-primary">Retour</Link>
        </p>
      </div>
    </div>
  )
}
