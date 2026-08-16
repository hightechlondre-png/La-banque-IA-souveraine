import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Activity, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const USECASE_LABELS = {
  cognitive_chat: 'chat cognitif',
  agent_orchestr: 'orchestration agent',
  staking_advisor: 'analyse staking',
  contract_audit: 'audit smart-contract',
  skill_test: 'test de compétence',
  memory_condense: 'condensation mémoire',
  generic: 'requête',
}

function relativeTime(iso) {
  if (!iso) return ''
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `il y a ${Math.round(sec)}s`
  if (sec < 3600) return `il y a ${Math.round(sec / 60)}min`
  if (sec < 86400) return `il y a ${Math.round(sec / 3600)}h`
  return `il y a ${Math.round(sec / 86400)}j`
}

/**
 * Ticker live "preuve sociale" — pop-up bottom-right.
 * Polling /api/public/ruche/recent toutes les 15s, affiche
 * une notification flottante par nouvelle activité détectée.
 */
export default function LiveActivityTicker() {
  const [current, setCurrent] = useState(null)  // notification actuellement visible
  const seenRef = useRef(new Set())  // dedup par created_at
  const visibleTimerRef = useRef(null)
  const queueRef = useRef([])

  const showNext = () => {
    const next = queueRef.current.shift()
    if (!next) return
    setCurrent(next)
    clearTimeout(visibleTimerRef.current)
    visibleTimerRef.current = setTimeout(() => {
      setCurrent(null)
      // Show next after a small gap
      setTimeout(showNext, 800)
    }, 5000)
  }

  useEffect(() => {
    let stopped = false
    let firstCall = true

    const poll = async () => {
      try {
        const res = await axios.get(`${BACKEND}/api/public/ruche/recent?limit=8`, {
          timeout: 8000,
        })
        const items = res.data?.items || []
        if (firstCall) {
          // Au mount : montre le dernier item connu (preuve sociale immédiate)
          // mais marque tous les autres comme déjà vus.
          if (items.length > 0) {
            const showcase = items[0]
            seenRef.current.add(showcase.created_at)
            queueRef.current.push(showcase)
            showNext()
          }
          // Marque les autres items comme vus (pas pop-up rétroactif)
          items.slice(1).forEach((it) => seenRef.current.add(it.created_at))
          firstCall = false
          return
        }
        // Identifie les nouveaux items (en commençant par le plus ancien)
        const fresh = items
          .filter((it) => it.created_at && !seenRef.current.has(it.created_at))
          .reverse()
        fresh.forEach((it) => {
          seenRef.current.add(it.created_at)
          queueRef.current.push(it)
        })
        if (queueRef.current.length > 0) showNext()
      } catch (_) {
        /* silent */
      }
    }

    poll()
    const id = setInterval(() => { if (!stopped) poll() }, 18000)
    return () => {
      stopped = true
      clearInterval(id)
      clearTimeout(visibleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!current) return null

  const usecaseLabel = USECASE_LABELS[current.usecase] || 'requête'

  return (
    <div
      data-testid="live-activity-ticker"
      className={cn(
        'fixed bottom-5 left-5 z-40 max-w-[330px]',
        'animate-in slide-in-from-bottom-4 fade-in-0 duration-300',
      )}
    >
      <div className="bg-card/95 backdrop-blur-md border border-primary/30 rounded-xl shadow-2xl shadow-primary/10 p-3 pr-4 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-primary tracking-widest uppercase flex items-center gap-1">
            <Activity className="h-2.5 w-2.5" />
            Routage Qwen · live
          </p>
          <p className="text-xs text-foreground mt-0.5 leading-snug">
            <span className="font-semibold">{current.bee_label}</span>
            <span className="text-muted-foreground"> a traité un{' '}</span>
            <span className="text-foreground">{usecaseLabel}</span>
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
            {relativeTime(current.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}
