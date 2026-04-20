import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, Copy, CheckCircle, FileText, Globe, Shield,
  Coins, Users, Code, TrendingUp, Lock, BookOpen, ChevronDown,
  ChevronUp, AlertTriangle, Building, Zap
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────
const TOKEN = {
  name:        "AEGIS-Q",
  symbol:      "AQ",
  decimals:    18,
  totalSupply: "100,000,000",
  type:        "ERC-20 (Ethereum compatible)",
  network:     "Ethereum Mainnet / Base L2",
  contract:    "0xAEG1S00000000000000000000000000000000AQ",  // placeholder — à remplacer au déploiement
  website:     "https://aegis-q.io",
  whitepaper:  "https://aegis-q.io/whitepaper.pdf",
  github:      "https://github.com/aegis-q",
  twitter:     "https://twitter.com/AegisQToken",
  telegram:    "https://t.me/AegisQOfficial",
  description: "AEGIS-Q (AQ) est un token utilitaire militaire-financier adossé à un réseau de mémoire fractale (N-MEM-B) géré par IA souveraine. Il permet le financement, la gouvernance décentralisée et la rémunération des nœuds du réseau AEGIS, conçu pour une infrastructure bancaire souveraine de nouvelle génération.",
};

const ALLOCATION = [
  { name: "Écosystème & Jeu Vivant",   pct: 40, tokens: "40,000,000", vesting: "4 ans linéaire",    color: "#3b82f6" },
  { name: "Réserve IA / Infrastructure",pct: 20, tokens: "20,000,000", vesting: "Bloqué 24 mois",    color: "#10b981" },
  { name: "Investisseurs Privés",       pct: 15, tokens: "15,000,000", vesting: "Cliff 6m + 18m lin.",color: "#f59e0b" },
  { name: "Staking Technologique",      pct: 10, tokens: "10,000,000", vesting: "Récompenses live",   color: "#8b5cf6" },
  { name: "Sécurité & Audit",           pct: 10, tokens: "10,000,000", vesting: "2 ans linéaire",     color: "#ef4444" },
  { name: "Fondation Souveraine",       pct: 5,  tokens: "5,000,000",  vesting: "Bloqué 36 mois",     color: "#22d3ee" },
];

const MONETARY = [
  { label: "Inflation initiale",    value: "2.00% / an",       note: "Décroissante"        },
  { label: "Decay rate",            value: "−0.20% / an",      note: "Compression annuelle"},
  { label: "Burn par transaction",  value: "1.5%",             note: "+ burns smart contract"},
  { label: "Objectif long terme",   value: "Déflationnaire",   note: "À partir de l'An 3"  },
  { label: "Mécanisme de contrôle", value: "DAO + AUDIT-DS IA",note: "Gouvernance hybride"  },
];

const TEAM = [
  { name: "Dr. Alix Verne",    role: "CEO & Co-Fondateur",         bg: "Ingénieur IA — ENS Paris / DeepMind Alumni" },
  { name: "Marcus Kwon",       role: "CTO — Architecture Réseau",  bg: "Ex-Palantir · Spécialiste mémoire fractale" },
  { name: "Sarah El-Amine",    role: "CFO — Tokenomics",           bg: "CFA · Ex-Deutsche Bank · DeFi Protocol Lead" },
  { name: "Ivan Petrović",     role: "CISO — Cryptographie PQC",   bg: "PhD Cryptographie · INRIA · NIST PQC Panel"  },
  { name: "Léa Tanaka",        role: "CLO — Juridique & Conformité",bg: "Avocate RGPD · Delaware LLC Expert"          },
];

const AUDITS = [
  { firm: "CertiK",        status: "in_progress", score: 82, type: "Smart Contract",      date: "Jan 2026"  },
  { firm: "Trail of Bits", status: "planned",      score: 0,  type: "Audit Formel",        date: "Q3 2026"   },
  { firm: "Bureau Veritas",status: "in_progress", score: 78, type: "ISO 27001",            date: "Q3 2026"   },
  { firm: "Deloitte",      status: "planned",      score: 0,  type: "SOC 2 Type II",       date: "Q4 2026"   },
];

const EXCHANGES = [
  {
    category: "Agrégateurs de données",
    color: "text-primary", border: "border-primary/20", bg: "bg-primary/5",
    items: [
      { name: "CoinGecko",      logo: "🦎", url: "https://www.coingecko.com/en/coins/add", status: "À soumettre", effort: "Gratuit · 2-4 sem.", note: "Remplir le formulaire avec contract address, site web, réseaux sociaux" },
      { name: "CoinMarketCap",  logo: "📊", url: "https://coinmarketcap.com/request/",      status: "À soumettre", effort: "Gratuit · 4-8 sem.", note: "Nécessite volume de trading prouvé sur un DEX" },
      { name: "CryptoCompare",  logo: "📈", url: "https://www.cryptocompare.com/coins/add", status: "À soumettre", effort: "Gratuit · 1-2 sem.", note: "Processus simple, bon pour la visibilité initiale" },
    ],
  },
  {
    category: "DEX — Décentralisés (Priority 1)",
    color: "text-chart-2", border: "border-chart-2/20", bg: "bg-chart-2/5",
    items: [
      { name: "Uniswap V3",     logo: "🦄", url: "https://app.uniswap.org/",               status: "Capital requis", effort: "~$50K liquidité min", note: "Créer une pool ETH/AQ ou USDC/AQ. Aucun listing officiel requis — juste du capital." },
      { name: "Curve Finance",  logo: "⚡", url: "https://curve.fi/",                       status: "Soumission DAO",  effort: "Vote CRV requis",    note: "Soumettre proposition à la Curve DAO pour une pool dédiée" },
      { name: "1inch",          logo: "🔀", url: "https://1inch.io/",                       status: "Auto (DEX agg)", effort: "Automatique si Uniswap", note: "Agrégation automatique une fois listé sur Uniswap" },
      { name: "PancakeSwap",    logo: "🥞", url: "https://pancakeswap.finance/",            status: "Capital requis", effort: "~$20K sur BSC",      note: "Alternative moins coûteuse sur BNB Chain" },
    ],
  },
  {
    category: "CEX — Centralisés Tier 2 (Priority 2)",
    color: "text-accent", border: "border-accent/20", bg: "bg-accent/5",
    items: [
      { name: "Gate.io",        logo: "🔐", url: "https://www.gate.io/listing_application",  status: "Candidature", effort: "$50K–$200K",   note: "Frais de listing + preuve de communauté + audit requis" },
      { name: "KuCoin",         logo: "🌐", url: "https://www.kucoin.com/listing",            status: "Candidature", effort: "$100K–$500K",  note: "Processus rigoureux, bon volume requis (>$500K/j)" },
      { name: "MEXC",           logo: "📱", url: "https://www.mexc.com/listing",              status: "Candidature", effort: "$20K–$100K",   note: "Plus accessible, bon pour early stage" },
      { name: "Bybit",          logo: "🚀", url: "https://www.bybit.com/en/listing-apply/",  status: "Candidature", effort: "$100K+",        note: "Forte audience retail, processus 3-6 mois" },
    ],
  },
  {
    category: "CEX — Tier 1 (Objectif 2027)",
    color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5",
    items: [
      { name: "Binance",   logo: "🟡", url: "https://www.binance.com/en/listing-application", status: "Moyen terme", effort: "$1M–$5M+",   note: "Critères: volume >$1M/j, communauté >50K, audit complet, conformité légale internationale" },
      { name: "Coinbase",  logo: "🔵", url: "https://www.coinbase.com/apply-asset",            status: "Moyen terme", effort: "Processus long", note: "Standard sécuritaire très élevé, SOC 2 + conformité US requise" },
      { name: "Kraken",    logo: "🐙", url: "https://www.kraken.com/listings",                status: "Moyen terme", effort: "Processus long", note: "Critères de conformité stricts, bien adapté aux projets institutionnels" },
    ],
  },
];

const CHECKLIST = [
  { done: true,  item: "Smart contract ERC-20 rédigé",                  category: "Technique"    },
  { done: true,  item: "Architecture tokenomics finalisée",              category: "Finance"      },
  { done: true,  item: "Whitepaper v1 rédigé",                          category: "Documentation"},
  { done: true,  item: "Audit CertiK en cours (82% complété)",          category: "Sécurité"     },
  { done: false, item: "Déploiement contrat sur mainnet",                category: "Technique"    },
  { done: false, item: "Création pool de liquidité Uniswap V3",         category: "Liquidité"    },
  { done: false, item: "Soumission CoinGecko + CoinMarketCap",          category: "Visibilité"   },
  { done: false, item: "Audit Trail of Bits (audit formel)",             category: "Sécurité"     },
  { done: false, item: "Certification ISO 27001 obtenue",               category: "Conformité"   },
  { done: false, item: "Communauté >10K (Twitter + Telegram)",          category: "Marketing"    },
  { done: false, item: "Volume trading >$500K/j prouvé (30 jours)",     category: "Volume"       },
  { done: false, item: "Listing Gate.io / MEXC / KuCoin",               category: "Exchange Tier2"},
  { done: false, item: "Certification SOC 2 Type II",                   category: "Conformité"   },
  { done: false, item: "Volume trading >$1M/j prouvé (90 jours)",       category: "Volume"       },
  { done: false, item: "Listing Binance / Coinbase / Kraken",           category: "Exchange Tier1"},
];

const CATEGORY_COLOR = {
  "Technique":      "text-primary",
  "Finance":        "text-accent",
  "Documentation":  "text-chart-2",
  "Sécurité":       "text-red-400",
  "Liquidité":      "text-green-400",
  "Visibilité":     "text-purple-400",
  "Conformité":     "text-orange-400",
  "Marketing":      "text-pink-400",
  "Volume":         "text-chart-4",
  "Exchange Tier2": "text-yellow-400",
  "Exchange Tier1": "text-cyan-400",
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", `bg-primary/10`)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function TokenListing() {
  const [openExchange, setOpenExchange] = useState(null);

  const doneCount = CHECKLIST.filter(c => c.done).length;
  const readyPct  = Math.round((doneCount / CHECKLIST.length) * 100);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="bg-card border border-primary/30 rounded-2xl p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Coins className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-3xl font-black text-foreground tracking-tight">AEGIS-Q</h1>
              <Badge className="bg-accent/10 text-accent border-accent/30 text-sm px-3 py-1">$AQ</Badge>
              <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">ERC-20</Badge>
              <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">UTILITY TOKEN</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{TOKEN.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground mb-1">Progression listing</p>
            <p className="text-3xl font-black text-primary font-mono">{readyPct}%</p>
            <p className="text-[10px] text-muted-foreground">{doneCount}/{CHECKLIST.length} étapes</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${readyPct}%` }} />
        </div>
      </div>

      {/* Token details */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionHeader icon={Code} title="Informations Techniques du Token" subtitle="À fournir dans tous les formulaires de listing" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Nom",            value: TOKEN.name,        copy: true  },
            { label: "Symbole",        value: TOKEN.symbol,      copy: true  },
            { label: "Décimales",      value: TOKEN.decimals,    copy: true  },
            { label: "Supply totale",  value: TOKEN.totalSupply, copy: false },
            { label: "Standard",       value: TOKEN.type,        copy: false },
            { label: "Réseau",         value: TOKEN.network,     copy: false },
            { label: "Contrat",        value: TOKEN.contract,    copy: true, mono: true, full: true },
            { label: "Site web",       value: TOKEN.website,     copy: true, link: true  },
            { label: "Whitepaper",     value: TOKEN.whitepaper,  copy: true, link: true  },
            { label: "GitHub",         value: TOKEN.github,      copy: false, link: true },
          ].map(f => (
            <div key={f.label} className={cn("flex items-center justify-between gap-3 bg-secondary/40 rounded-lg px-4 py-3", f.full && "sm:col-span-2")}>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground mb-0.5">{f.label}</p>
                {f.link ? (
                  <a href={f.value} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                    {f.value} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <p className={cn("text-sm font-semibold text-foreground truncate", f.mono && "font-mono text-xs")}>{f.value}</p>
                )}
              </div>
              {f.copy && <CopyButton text={String(f.value)} />}
            </div>
          ))}
        </div>

        {/* Social links */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "Twitter/X",  url: TOKEN.twitter,   color: "border-sky-500/30 text-sky-400"     },
            { label: "Telegram",   url: TOKEN.telegram,  color: "border-blue-500/30 text-blue-400"   },
            { label: "GitHub",     url: TOKEN.github,    color: "border-gray-500/30 text-gray-400"   },
            { label: "Whitepaper", url: TOKEN.whitepaper,color: "border-accent/30 text-accent"       },
          ].map(s => (
            <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:opacity-80 transition-opacity", s.color)}>
              <ExternalLink className="h-3 w-3" />{s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Tokenomics */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionHeader icon={TrendingUp} title="Tokenomics & Vesting" subtitle="Distribution officielle à fournir aux plateformes" color="text-accent" />
        <div className="space-y-3 mb-5">
          {ALLOCATION.map(a => (
            <div key={a.name} className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: a.color }} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{a.name}</span>
                  <span className="text-sm font-mono font-bold text-foreground">{a.pct}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: a.color }} />
                </div>
                <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">{a.tokens} AQ</span>
                  <span>Vesting : {a.vesting}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MONETARY.map(m => (
            <div key={m.label} className="bg-secondary/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <p className="text-xs font-bold text-foreground font-mono">{m.value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{m.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionHeader icon={Users} title="Équipe Fondatrice" subtitle="Identités vérifiables requises par Binance, Coinbase et CoinGecko" color="text-chart-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM.map(m => (
            <div key={m.name} className="flex items-start gap-3 bg-secondary/40 rounded-xl p-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{m.name.split(" ").map(n => n[0]).join("").slice(0,2)}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{m.name}</p>
                <p className="text-[10px] text-accent font-semibold">{m.role}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.bg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audits */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionHeader icon={Shield} title="Certifications & Audits de Sécurité" subtitle="Requis par toutes les plateformes sérieuses avant listing" color="text-red-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AUDITS.map(a => (
            <div key={a.firm} className={cn("border rounded-xl p-4", a.status === "in_progress" ? "border-accent/30" : "border-border")}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-foreground">{a.firm}</p>
                <Badge variant="outline" className={cn("text-[9px]",
                  a.status === "in_progress" ? "border-accent/30 text-accent" : "border-border text-muted-foreground")}>
                  {a.status === "in_progress" ? "En cours" : "Planifié"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">{a.type} · {a.date}</p>
              {a.score > 0 && (
                <>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${a.score}%` }} />
                  </div>
                  <p className="text-[10px] font-mono text-primary">{a.score}% complété</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Exchange listing guide */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionHeader icon={Globe} title="Guide de Listing — Étapes par Plateforme" subtitle="Cliquez sur chaque plateforme pour voir les instructions détaillées" color="text-green-400" />
        <div className="space-y-4">
          {EXCHANGES.map(group => (
            <div key={group.category} className={cn("border rounded-xl overflow-hidden", group.border)}>
              <button
                onClick={() => setOpenExchange(openExchange === group.category ? null : group.category)}
                className={cn("w-full flex items-center justify-between px-4 py-3 text-left", group.bg)}>
                <span className={cn("text-sm font-bold", group.color)}>{group.category}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[9px]", group.border, group.color)}>{group.items.length} plateformes</Badge>
                  {openExchange === group.category ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {openExchange === group.category && (
                <div className="border-t border-border/50 p-4 space-y-3">
                  {group.items.map(item => (
                    <div key={item.name} className="bg-secondary/30 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{item.logo}</span>
                          <div>
                            <p className="text-sm font-bold text-foreground">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item.effort}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{item.status}</Badge>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2 gap-1">
                              <ExternalLink className="h-3 w-3" />Ouvrir
                            </Button>
                          </a>
                        </div>
                      </div>
                      <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                        <p className="text-[11px] text-foreground leading-relaxed">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <SectionHeader icon={FileText} title="Checklist Complète de Listing" subtitle={`${doneCount}/${CHECKLIST.length} étapes complétées`} color="text-chart-4" />
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-primary font-mono">{readyPct}%</p>
            <p className="text-[10px] text-muted-foreground">prêt</p>
          </div>
        </div>
        <div className="space-y-2">
          {CHECKLIST.map((item, i) => (
            <div key={i} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
              item.done ? "bg-green-500/5 border-green-500/20" : "bg-secondary/20 border-border")}>
              {item.done
                ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                : <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />}
              <span className={cn("text-sm flex-1", item.done ? "text-foreground line-through opacity-60" : "text-foreground")}>{item.item}</span>
              <Badge variant="outline" className={cn("text-[9px] shrink-0", CATEGORY_COLOR[item.category])}>
                {item.category}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Legal notice */}
      <div className="bg-card border border-accent/20 rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-foreground mb-1">Notice Légale Importante</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Avant tout listing public, AEGIS-Q doit obtenir un avis juridique dans chaque juridiction cible (notamment US, EU, UK). 
            Le token AQ est un <strong className="text-foreground">utility token</strong>, non un security token, mais cette classification doit être 
            validée par un cabinet spécialisé (Perkins Coie, DLA Piper, ou équivalent). La structure Delaware LLC est en place. 
            La conformité KYC/AML doit être opérationnelle avant tout CEX Tier 1.
          </p>
        </div>
      </div>
    </div>
  );
}