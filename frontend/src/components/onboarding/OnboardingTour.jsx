import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import {
  Hexagon, Sparkles, TrendingDown, ArrowRight, X,
  Check, Zap, Crown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const STEPS = [
  {
    icon: Hexagon,
    eyebrow: 'Étape 1 / 3',
    title: 'Bienvenue dans la Ruche 🐝',
    body:
      'AEGIS-Q n\'est pas UN modèle d\'IA — c\'est une fédération de 9 IA spécialisées orchestrées en temps réel. Chaque tâche est routée vers l\'abeille la plus pertinente par le superviseur Qwen3.',
    highlight: '9 abeilles · 1 superviseur sémantique · <3s de routage',
    cta: 'Découvrir les abeilles',
    next: 'C\'est compris',
  },
  {
    icon: Sparkles,
    eyebrow: 'Étape 2 / 3',
    title: 'Teste ta première abeille ⚡',
    body:
      'Le chat cognitif te connecte automatiquement à Mistral Large (commandant stratégique). L\'audit de smart contract appelle Llama 4 Maverick (expert code). L\'analyse de staking interroge DeepSeek R1 (raisonnement financier).',
    highlight: 'Pas de configuration, Qwen choisit pour toi.',
    cta: 'Ouvrir le chat cognitif',
    ctaPath: '/chat',
    next: 'Continuer',
  },
  {
    icon: TrendingDown,
    eyebrow: 'Étape 3 / 3',
    title: 'Suis tes économies en temps réel 💎',
    body:
      'Chaque requête routée par Qwen utilise un budget tokens spécialisé (400-1000 tok) plutôt qu\'un modèle généraliste à 2000 tok. Tu verras tes économies cumulées et ton ratio sur la Dashboard.',
    highlight: '~60% de tokens économisés en moyenne · matérialisation premium',
    cta: 'Voir ma Dashboard',
    ctaPath: '/dashboard',
    next: 'Activer la Ruche',
  },
]

export default function OnboardingTour({ user, onComplete }) {
  const navigate = useNavigate()
  const initialStep = Math.min(user?.onboarding_step ?? 0, STEPS.length - 1)
  const [step, setStep] = useState(initialStep)
  const [closing, setClosing] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Fade in après mount
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Si déjà complété, ne rien afficher
  if (user?.onboarding_completed) return null

  const current = STEPS[step]

  const persist = async (patch) => {
    try {
      await axios.patch(`${BACKEND}/api/auth/onboarding`, patch, {
        headers: { Authorization: `Bearer ${getToken()}` },
        timeout: 8000,
      })
    } catch (_) {/* silent */}
  }

  const next = async () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1
      setStep(nextStep)
      persist({ step: nextStep })
    } else {
      setClosing(true)
      await persist({ completed: true })
      setTimeout(() => {
        if (onComplete) onComplete()
      }, 200)
    }
  }

  const skip = async () => {
    setClosing(true)
    await persist({ completed: true })
    setTimeout(() => { if (onComplete) onComplete() }, 200)
  }

  const ctaClick = () => {
    if (current.ctaPath) {
      navigate(current.ctaPath)
      // Marque comme complété côté serveur (l'utilisateur va explorer)
      persist({ completed: true })
      setClosing(true)
      setTimeout(() => { if (onComplete) onComplete() }, 200)
    }
  }

  const Icon = current.icon

  return (
    <div
      data-testid="onboarding-tour"
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4',
        'bg-background/80 backdrop-blur-md',
        'transition-opacity duration-200',
        show && !closing ? 'opacity-100' : 'opacity-0',
      )}
      onClick={(e) => { if (e.target === e.currentTarget) skip() }}
    >
      <div
        data-testid="onboarding-card"
        className={cn(
          'relative max-w-lg w-full bg-card border border-primary/20 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden',
          'transition-all duration-300',
          show && !closing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4',
        )}
      >
        {/* Background flair */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/15 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-accent/10 blur-[80px] pointer-events-none" />

        {/* Skip button */}
        <button
          data-testid="onboarding-skip-btn"
          onClick={skip}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors z-10"
          aria-label="Passer le tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="relative p-7 pt-9">
          {/* Eyebrow + icon */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-primary tracking-widest uppercase">
                {current.eyebrow}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mt-0.5">
                AEGIS-Q · Onboarding
              </p>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {current.title}
          </h2>

          {/* Body */}
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {current.body}
          </p>

          {/* Highlight pill */}
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-mono text-primary">{current.highlight}</span>
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 mt-6 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-8 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-secondary',
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              data-testid="onboarding-skip-text-btn"
              variant="ghost"
              size="sm"
              onClick={skip}
              className="text-muted-foreground hover:text-foreground"
            >
              Passer le tour
            </Button>
            <div className="flex-1" />
            {current.ctaPath && (
              <Button
                data-testid="onboarding-cta-btn"
                variant="outline"
                onClick={ctaClick}
                className="gap-1.5"
              >
                {current.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              data-testid="onboarding-next-btn"
              onClick={next}
              className="gap-1.5"
            >
              {step === STEPS.length - 1 ? (
                <>
                  <Crown className="h-3.5 w-3.5" />
                  {current.next}
                  <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  {current.next}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
