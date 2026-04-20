import { useState, useEffect } from "react";
import { Brain, Shield, Heart, Swords, Users, Star, AlertTriangle, ArrowRight, RefreshCw, Lock, Zap, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ── Données simulées ───────────────────────────────────────
const playerMemory = {
  id: "PLAYER_001",
  name: "Commandant Arès",
  tier: "ACTIVE",
  resonanceGlobal: 0.74,

  traits: [
    { id: "courage",     label: "Courage",       value: 88, color: "text-accent",   bg: "bg-accent",   icon: Shield },
    { id: "empathy",     label: "Empathie",       value: 34, color: "text-chart-2",  bg: "bg-chart-2",  icon: Heart },
    { id: "aggression",  label: "Agressivité",    value: 72, color: "text-red-400",  bg: "bg-red-400",  icon: Swords },
    { id: "charisma",    label: "Charisme",       value: 61, color: "text-primary",  bg: "bg-primary",  icon: Star },
    { id: "paranoia",    label: "Paranoïa",       value: 55, color: "text-chart-4",  bg: "bg-chart-4",  icon: Eye },
    { id: "loyalty",     label: "Loyauté",        value: 79, color: "text-chart-5",  bg: "bg-chart-5",  icon: Users },
  ],

  choices: [
    { id: "c1", action: "Trahison d'un allié pour le Conseil", impact: "high",   emotion: "guilt",   fractalLevel: 2, timestamp: "J-14" },
    { id: "c2", action: "Défense de la Cité contre le Chaos",  impact: "high",   emotion: "pride",   fractalLevel: 3, timestamp: "J-11" },
    { id: "c3", action: "Refus d'exécuter un civil innocent",  impact: "medium", emotion: "relief",  fractalLevel: 1, timestamp: "J-7"  },
    { id: "c4", action: "Alliance secrète — Faction Ombre",    impact: "high",   emotion: "fear",    fractalLevel: 2, timestamp: "J-3"  },
    { id: "c5", action: "Sacrifice d'une ressource critique",  impact: "low",    emotion: "resolve", fractalLevel: 1, timestamp: "J-1"  },
  ],

  reputation: [
    { faction: "Conseil Impérial",  score: 82, trend: "up"   },
    { faction: "Faction Ombre",     score: 47, trend: "up"   },
    { faction: "Peuple de la Cité", score: 29, trend: "down" },
    { faction: "Gardiens du Chaos", score: 11, trend: "down" },
  ],

  traumas: [
    { id: "t1", event: "Mort de Lyria — Compagne de guerre", intensity: 0.91, tier: "SEALED",  active: true  },
    { id: "t2", event: "Trahison du Commandant Vex",         intensity: 0.74, tier: "DEEP",    active: true  },
    { id: "t3", event: "Siège de la Forteresse Nord",        intensity: 0.48, tier: "ACTIVE",  active: false },
  ],

  alliances: [
    { name: "Marek — Stratège",      type: "COOPERATES_WITH", strength: 0.88, status: "stable"  },
    { name: "Seraphine — Espionne",  type: "FEARS",           strength: 0.52, status: "fragile" },
    { name: "Lord Cael",             type: "CONFLICTS_WITH",  strength: 0.67, status: "hostile" },
  ],
};

const syncEvents = [
  { id: "s1", playerAction: "Trahison — Alliance Ombre",     nmembNode: "faction.ombre.trust",     delta: +0.31, level: "L2", time: "2 min" },
  { id: "s2", playerAction: "Défense de la Cité",            nmembNode: "city.stability",          delta: +0.18, level: "L3", time: "11 min" },
  { id: "s3", playerAction: "Trauma réactivé — Lyria",       nmembNode: "world.memory.loss.grief", delta: +0.09, level: "L4", time: "34 min" },
  { id: "s4", playerAction: "Réputation Peuple — effondrement", nmembNode: "city.population.morale", delta: -0.22, level: "L2", time: "1h" },
];

const impactStyle = {
  high:   "bg-red-500/10 text-red-400 border-red-500/30",
  medium: "bg-accent/10 text-accent border-accent/30",
  low:    "bg-primary/10 text-primary border-primary/30",
};

const emotionStyle = {
  guilt:   "text-purple-400",
  pride:   "text-accent",
  relief:  "text-chart-2",
  fear:    "text-red-400",
  resolve: "text-primary",
};

const trendIcon = { up: "▲", down: "▼" };

// ── Composant jauge de trait ───────────────────────────────
function TraitBar({ trait }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <trait.icon className={`h-4 w-4 ${trait.color}`} />
          <span className="text-sm font-medium text-foreground">{trait.label}</span>
        </div>
        <span className={`text-lg font-bold font-mono ${trait.color}`}>{trait.value}</span>
      </div>
      <div className="h-2 rounded-full bg-background overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${trait.bg} opacity-80`}
          style={{ width: `${trait.value}%` }}
        />
      </div>
    </div>
  );
}

// ── Pont de synchronisation animé ─────────────────────────
function SyncBridge({ events }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full bg-primary transition-opacity duration-700", pulse ? "opacity-100" : "opacity-30")} />
          <h3 className="text-sm font-semibold text-foreground">Pont N-MEM-A ↔ N-MEM-B</h3>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">LIVE SYNC</Badge>
        </div>
        <RefreshCw className={cn("h-3.5 w-3.5 text-primary transition-transform duration-700", pulse && "rotate-180")} />
      </div>

      {/* Bridge visual */}
      <div className="flex items-center justify-center gap-4 py-3 mb-4">
        <div className="bg-secondary rounded-lg px-4 py-2 text-xs font-bold font-mono text-accent">N-MEM-A</div>
        <div className="flex-1 flex items-center gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-0.5 rounded-full transition-all duration-300",
                (i + (pulse ? 0 : 1)) % 2 === 0 ? "bg-primary" : "bg-primary/20"
              )}
            />
          ))}
        </div>
        <div className="bg-secondary rounded-lg px-4 py-2 text-xs font-bold font-mono text-primary">N-MEM-B</div>
      </div>

      {/* Sync events */}
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg p-3">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{ev.playerAction}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{ev.nmembNode}</p>
            </div>
            <Badge variant="outline" className="text-[10px] border-border shrink-0">{ev.level}</Badge>
            <span className={cn("text-xs font-mono font-bold shrink-0", ev.delta > 0 ? "text-green-400" : "text-red-400")}>
              {ev.delta > 0 ? "+" : ""}{ev.delta.toFixed(2)}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{ev.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────
export default function NMemA() {
  const [activeTab, setActiveTab] = useState("traits");
  const tabs = [
    { id: "traits",    label: "Traits",     icon: Brain   },
    { id: "choices",   label: "Choix",      icon: Swords  },
    { id: "traumas",   label: "Traumatismes", icon: AlertTriangle },
    { id: "alliances", label: "Alliances",  icon: Users   },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">N-MEM-A</h2>
          <p className="text-sm text-muted-foreground mt-1">Mémoire Cognitive du Joueur — Choix · Émotions · Réputation · Alliances</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-accent/10 text-accent border-accent/20">
            <Brain className="h-3 w-3 mr-1" />
            {playerMemory.name}
          </Badge>
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 inline-block animate-pulse" />
            ACTIF
          </Badge>
        </div>
      </div>

      {/* Global Resonance Bar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Résonance Cognitive Globale</h3>
          </div>
          <span className="text-2xl font-black font-mono text-primary">{(playerMemory.resonanceGlobal * 100).toFixed(0)}%</span>
        </div>
        <Progress value={playerMemory.resonanceGlobal * 100} className="h-3" />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-mono">
          <span>DORMANT</span><span>SHORT_TERM</span><span>ACTIVE</span><span>DEEP</span><span>SEALED</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              activeTab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "traits" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {playerMemory.traits.map((t) => <TraitBar key={t.id} trait={t} />)}
        </div>
      )}

      {activeTab === "choices" && (
        <div className="space-y-2">
          {playerMemory.choices.map((c) => (
            <div key={c.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
              <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">L{c.fractalLevel}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{c.action}</p>
                <span className={`text-xs font-medium ${emotionStyle[c.emotion]}`}>● {c.emotion}</span>
              </div>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", impactStyle[c.impact])}>
                {c.impact.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono shrink-0">{c.timestamp}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "traumas" && (
        <div className="space-y-3">
          {playerMemory.traumas.map((tr) => (
            <div key={tr.id} className={cn(
              "bg-card border rounded-xl p-5",
              tr.tier === "SEALED" ? "border-red-500/30" : tr.tier === "DEEP" ? "border-accent/30" : "border-border"
            )}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={cn("h-5 w-5 shrink-0", tr.tier === "SEALED" ? "text-red-400" : "text-accent")} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tr.event}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn("text-[10px]",
                        tr.tier === "SEALED" ? "border-red-500/30 text-red-400" :
                        tr.tier === "DEEP"   ? "border-accent/30 text-accent"   :
                        "border-primary/30 text-primary"
                      )}>
                        {tr.tier === "SEALED" && <Lock className="h-2.5 w-2.5 mr-1" />}
                        {tr.tier}
                      </Badge>
                      {tr.active && <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">ACTIF</Badge>}
                    </div>
                  </div>
                </div>
                <span className={cn("text-xl font-black font-mono shrink-0",
                  tr.intensity > 0.8 ? "text-red-400" : tr.intensity > 0.5 ? "text-accent" : "text-primary"
                )}>
                  {(tr.intensity * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={tr.intensity * 100} className="h-1.5" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "alliances" && (
        <div className="space-y-3">
          {/* Reputation */}
          <h3 className="text-sm font-semibold text-foreground">Réputation par Faction</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {playerMemory.reputation.map((r) => (
              <div key={r.faction} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{r.faction}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs", r.trend === "up" ? "text-green-400" : "text-red-400")}>
                      {trendIcon[r.trend]}
                    </span>
                    <span className="text-base font-bold font-mono text-foreground">{r.score}</span>
                  </div>
                </div>
                <Progress value={r.score} className="h-1.5" />
              </div>
            ))}
          </div>

          {/* Alliances */}
          <h3 className="text-sm font-semibold text-foreground">Liens Actifs</h3>
          <div className="space-y-2">
            {playerMemory.alliances.map((al) => (
              <div key={al.name} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{al.name}</span>
                <Badge variant="outline" className={cn("text-[10px]",
                  al.type === "COOPERATES_WITH" ? "border-chart-2/30 text-chart-2" :
                  al.type === "FEARS"           ? "border-accent/30 text-accent"   :
                  "border-red-500/30 text-red-400"
                )}>{al.type}</Badge>
                <div className="flex items-center gap-2 w-24">
                  <Progress value={al.strength * 100} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono text-muted-foreground">{(al.strength * 100).toFixed(0)}%</span>
                </div>
                <Badge className={cn("text-[10px] shrink-0",
                  al.status === "stable"  ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  al.status === "fragile" ? "bg-accent/10 text-accent border-accent/20"          :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                )}>{al.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pont de synchronisation */}
      <SyncBridge events={syncEvents} />
    </div>
  );
}