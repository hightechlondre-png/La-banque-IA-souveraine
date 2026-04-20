import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Clock, Search,
  FileDown, RefreshCw, Lock, Zap, Eye, Code, Loader2, Star,
  TrendingUp, Award, FileSearch
} from "lucide-react";

// ── Simulated vulnerability database ──────────────────────
const VULN_DB = [
  { id: "AEGIS-001", severity: "critical", category: "Reentrancy",         title: "Reentrancy Guard manquant",          contract: "BurnMechanism.sol",   line: 87,  description: "La fonction withdraw() ne protège pas contre les appels récursifs avant la mise à jour de l'état.", recommendation: "Utiliser le pattern checks-effects-interactions ou OpenZeppelin ReentrancyGuard.", status: "fixed" },
  { id: "AEGIS-002", severity: "high",     category: "Access Control",      title: "Rôle admin non protégé",             contract: "GovernanceCore.sol",  line: 142, description: "La fonction setInflationRate() peut être appelée par n'importe quelle adresse sans vérification de rôle.", recommendation: "Implémenter onlyRole(MONETARY_ADMIN_ROLE) via OpenZeppelin AccessControl.", status: "fixed" },
  { id: "AEGIS-003", severity: "high",     category: "Integer Overflow",    title: "Overflow potentiel sur supply calc", contract: "TokenVault.sol",      line: 203, description: "Le calcul burnAmount * multiplier peut dépasser uint256 dans des conditions extrêmes.", recommendation: "Utiliser SafeMath ou Solidity ^0.8.x (overflow checks natifs).", status: "mitigated" },
  { id: "AEGIS-004", severity: "medium",   category: "Front-running",       title: "MEV / Front-running sur vote",       contract: "GovernanceCore.sol",  line: 318, description: "Les transactions de vote sont visibles dans le mempool avant confirmation, permettant le sandwich.", recommendation: "Implémenter un système de commit-reveal pour les votes sensibles.", status: "in_progress" },
  { id: "AEGIS-005", severity: "medium",   category: "Oracle Manipulation", title: "Dépendance oracle prix non sécurisé",contract: "ResonanceOracle.sol", line: 56,  description: "Le prix AQ/USD est récupéré d'une seule source sans agrégation TWAP.", recommendation: "Utiliser Chainlink TWAP + fallback oracle Uniswap v3.", status: "open" },
  { id: "AEGIS-006", severity: "low",      category: "Gas Optimization",    title: "Boucles non bornées en storage",     contract: "MemoryRegistry.sol",  line: 445, description: "La boucle sur nodes[] peut dépasser le block gas limit si trop de nœuds.", recommendation: "Paginer les appels ou utiliser un pattern de mapping avec index.", status: "open" },
  { id: "AEGIS-007", severity: "low",      category: "Centralization",      title: "Clé admin unique sur pause()",       contract: "TokenVault.sol",      line: 67,  description: "Une seule adresse contrôle la fonction pause(), point unique de défaillance.", recommendation: "Multi-sig 3/5 pour les fonctions d'urgence.", status: "mitigated" },
  { id: "AEGIS-008", severity: "info",     category: "Best Practice",       title: "Events manquants sur transferts",    contract: "BurnMechanism.sol",   line: 121, description: "Les fonctions de burn ne émettent pas tous les events recommandés ERC-20.", recommendation: "Émettre BurnExecuted(address indexed, uint256 amount) sur chaque burn.", status: "fixed" },
];

const CERTIFICATIONS = [
  { id: "iso27001", name: "ISO 27001", full: "Information Security Management", status: "in_progress", score: 78, expires: null,       issued: null,          auditor: "Bureau Veritas",    nextAudit: "Q3 2026", color: "text-accent",    bg: "bg-accent/10",    border: "border-accent/20"    },
  { id: "soc2",     name: "SOC 2 T2", full: "System & Organization Controls",   status: "planned",     score: 45, expires: null,       issued: null,          auditor: "Deloitte",          nextAudit: "Q4 2026", color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20"   },
  { id: "fips",     name: "FIPS 140-3",full: "Cryptographic Module Validation", status: "planned",     score: 30, expires: null,       issued: null,          auditor: "NIST / CMVP",       nextAudit: "2027",    color: "text-chart-4",   bg: "bg-chart-4/10",   border: "border-chart-4/20"   },
  { id: "certik",   name: "CertiK",    full: "Smart Contract Security Audit",   status: "in_progress", score: 82, expires: "2027-04",  issued: "2026-01",     auditor: "CertiK",            nextAudit: "2027-01", color: "text-chart-2",   bg: "bg-chart-2/10",   border: "border-chart-2/20"   },
  { id: "tob",      name: "Trail of Bits", full: "Formal Security Audit",       status: "planned",     score: 0,  expires: null,       issued: null,          auditor: "Trail of Bits",     nextAudit: "Q3 2026", color: "text-chart-5",   bg: "bg-chart-5/10",   border: "border-chart-5/20"   },
  { id: "pci",      name: "PCI-DSS",   full: "Payment Card Industry",           status: "na",          score: 0,  expires: null,       issued: null,          auditor: "—",                 nextAudit: "—",       color: "text-muted-foreground", bg: "bg-secondary", border: "border-border"   },
];

const CONTRACTS = [
  { name: "TokenVault.sol",      lines: 892,  lang: "Solidity 0.8.20", lastScan: "2026-04-10" },
  { name: "BurnMechanism.sol",   lines: 445,  lang: "Solidity 0.8.20", lastScan: "2026-04-10" },
  { name: "GovernanceCore.sol",  lines: 1243, lang: "Solidity 0.8.20", lastScan: "2026-04-10" },
  { name: "ResonanceOracle.sol", lines: 312,  lang: "Solidity 0.8.20", lastScan: "2026-04-09" },
  { name: "MemoryRegistry.sol",  lines: 678,  lang: "Solidity 0.8.20", lastScan: "2026-04-09" },
  { name: "StakingPool.sol",     lines: 534,  lang: "Solidity 0.8.20", lastScan: "2026-04-08" },
];

const SEV_CONFIG = {
  critical: { label: "Critique",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       bar: "bg-red-500"    },
  high:     { label: "Élevée",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", bar: "bg-orange-500" },
  medium:   { label: "Moyenne",   color: "text-accent",     bg: "bg-accent/10 border-accent/20",         bar: "bg-yellow-500" },
  low:      { label: "Faible",    color: "text-primary",    bg: "bg-primary/10 border-primary/20",       bar: "bg-blue-500"   },
  info:     { label: "Info",      color: "text-muted-foreground", bg: "bg-secondary border-border",      bar: "bg-slate-500"  },
};

const STATUS_CONFIG = {
  fixed:       { label: "Corrigé",     color: "text-green-400",        icon: CheckCircle  },
  mitigated:   { label: "Mitigé",      color: "text-primary",          icon: Shield       },
  in_progress: { label: "En cours",    color: "text-accent",           icon: Zap          },
  open:        { label: "Ouvert",      color: "text-red-400",          icon: XCircle      },
};

const CERT_STATUS = {
  in_progress: { label: "En cours",   color: "text-accent",                  icon: Clock        },
  planned:     { label: "Planifié",   color: "text-primary",                 icon: Clock        },
  active:      { label: "Certifié",   color: "text-green-400",               icon: CheckCircle  },
  na:          { label: "N/A",        color: "text-muted-foreground",        icon: XCircle      },
};

// ── PDF Export ─────────────────────────────────────────────
function exportPDF(vulns, certs) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AEGIS-Q — Rapport de Conformité", 15, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Audit Sécurité Smart Contracts — Généré le ${now}`, 15, 28);
  doc.setTextColor(96, 165, 250);
  doc.text("CONFIDENTIEL — Usage Institutionnel Exclusif", 15, 36);

  let y = 52;
  doc.setTextColor(30, 41, 59);

  // Section 1 — Score global
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("1. Score de Sécurité Global", 15, y); y += 8;

  const fixed = vulns.filter(v => v.status === "fixed").length;
  const score = Math.round((fixed / vulns.length) * 100);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 80, 100);
  doc.text(`Score global : ${score}% (${fixed}/${vulns.length} vulnérabilités corrigées)`, 15, y); y += 6;
  doc.text(`Contrats audités : ${CONTRACTS.length} | Lignes de code : ${CONTRACTS.reduce((s, c) => s + c.lines, 0).toLocaleString()}`, 15, y); y += 12;

  // Section 2 — Certifications
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("2. Statut des Certifications", 15, y); y += 8;

  certs.filter(c => c.status !== "na").forEach(cert => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`${cert.name} — ${cert.full}`, 15, y);
    const statusLabel = CERT_STATUS[cert.status]?.label ?? cert.status;
    doc.setTextColor(cert.status === "active" ? 34 : cert.status === "in_progress" ? 202 : 100,
                     cert.status === "active" ? 197 : 138, cert.status === "active" ? 94 : 2);
    doc.text(statusLabel, 175, y);
    doc.setTextColor(100, 120, 140);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(`Auditeur : ${cert.auditor} | Prochain audit : ${cert.nextAudit} | Score : ${cert.score}%`, 20, y);
    y += 8;
  });

  y += 4;

  // Section 3 — Vulnérabilités
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("3. Vulnérabilités Identifiées", 15, y); y += 8;

  const order = ["critical", "high", "medium", "low", "info"];
  order.forEach(sev => {
    const items = vulns.filter(v => v.severity === sev);
    if (!items.length) return;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(sev === "critical" ? 220 : sev === "high" ? 234 : 100,
                     sev === "critical" ? 38  : sev === "high" ? 88  : 100,
                     sev === "critical" ? 38  : sev === "high" ? 12  : 100);
    doc.text(`${SEV_CONFIG[sev].label} (${items.length})`, 15, y); y += 6;

    items.forEach(v => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`[${v.id}] ${v.title}`, 20, y); y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 100, 120);
      doc.text(`Contrat : ${v.contract} | Ligne : ${v.line} | Statut : ${STATUS_CONFIG[v.status]?.label}`, 20, y); y += 4;
      const descLines = doc.splitTextToSize(v.description, 170);
      doc.text(descLines, 20, y); y += descLines.length * 4 + 2;
    });
    y += 4;
  });

  // Section 4 — Recommandations
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("4. Recommandations Prioritaires", 15, y); y += 8;
  [
    "1. Implémenter CRYSTALS-Dilithium (post-quantique) sur toutes les signatures.",
    "2. Compléter la certification ISO 27001 avant Q3 2026.",
    "3. Activer les time-locks 48h pour les transactions > $1M.",
    "4. Lancer le programme Bug Bounty sur Immunefi ($100K max).",
    "5. Multi-sig 5/9 pour les contrats de gouvernance core.",
  ].forEach(line => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 70, 90);
    doc.text(line, 15, y); y += 7;
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 160, 175);
    doc.text(`AEGIS-Q Rapport Conformité — ${now} — Page ${i}/${pages}`, 15, 290);
    doc.text("Confidentiel — Ne pas distribuer sans autorisation", 120, 290);
  }

  doc.save(`AEGIS-Q_Compliance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Main Component ─────────────────────────────────────────
export default function SecurityAudit() {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(true);
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);

  const runScan = () => {
    setScanning(true);
    setScanned(false);
    setTimeout(() => { setScanning(false); setScanned(true); }, 3200);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      exportPDF(VULN_DB, CERTIFICATIONS);
      setExporting(false);
    }, 400);
  };

  const filtered = VULN_DB.filter(v => {
    if (filterSev !== "all" && v.severity !== filterSev) return false;
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    return true;
  });

  const totalLines = CONTRACTS.reduce((s, c) => s + c.lines, 0);
  const fixedCount = VULN_DB.filter(v => v.status === "fixed").length;
  const openCritical = VULN_DB.filter(v => v.severity === "critical" && v.status === "open").length;
  const scoreGlobal = Math.round((fixedCount / VULN_DB.length) * 100);

  const sevCounts = ["critical", "high", "medium", "low", "info"].map(s => ({
    sev: s, count: VULN_DB.filter(v => v.severity === s).length,
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Audit de Sécurité</h2>
          <p className="text-sm text-muted-foreground mt-1">Scanner automatisé · Certifications · Export rapport institutionnel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {scanning ? "Scan en cours…" : "Relancer le scan"}
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Scan progress */}
      {scanning && (
        <div className="bg-card border border-primary/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Analyse statique en cours…</p>
          </div>
          <div className="space-y-1.5">
            {CONTRACTS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-foreground">{c.name}</span>
                <span className="text-muted-foreground">{c.lines} lignes</span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: `${60 + i * 8}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Score Sécurité Global",  value: `${scoreGlobal}%`,    icon: Shield,     color: scoreGlobal > 70 ? "text-green-400" : "text-orange-400" },
          { label: "Vulnérabilités totales", value: VULN_DB.length,        icon: FileSearch, color: "text-primary" },
          { label: "Critiques ouvertes",     value: openCritical,          icon: AlertTriangle, color: openCritical > 0 ? "text-red-400" : "text-green-400" },
          { label: "Lignes de code auditées",value: totalLines.toLocaleString(), icon: Code, color: "text-accent" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Certifications */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Statut des Certifications</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CERTIFICATIONS.map((cert) => {
            const cs = CERT_STATUS[cert.status];
            const CIcon = cs.icon;
            return (
              <div key={cert.id} className={cn("border rounded-xl p-4", cert.border)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className={cn("text-sm font-bold", cert.color)}>{cert.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{cert.full}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0 ml-2", cert.border, cs.color)}>
                    <CIcon className="h-3 w-3 mr-1" />{cs.label}
                  </Badge>
                </div>
                {cert.status !== "na" && (
                  <>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-1.5">
                      <div className={cn("h-full rounded-full", cert.color.replace("text-", "bg-"))}
                        style={{ width: `${cert.score}%`, opacity: 0.8 }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Auditeur : {cert.auditor}</span>
                      <span className="font-mono">{cert.score}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Prochain audit : {cert.nextAudit}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contracts scanned */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Code className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Contrats Analysés</h3>
          <Badge variant="outline" className="text-[10px] border-primary/20 text-primary ml-auto">
            {CONTRACTS.length} contrats · {totalLines.toLocaleString()} lignes
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {CONTRACTS.map((c) => {
            const contractVulns = VULN_DB.filter(v => v.contract === c.name);
            const hasOpen = contractVulns.some(v => v.status === "open");
            const hasCritical = contractVulns.some(v => v.severity === "critical");
            return (
              <div key={c.name} className={cn("flex items-center gap-3 rounded-lg px-4 py-3 border",
                hasCritical ? "border-red-500/30 bg-red-500/5" :
                hasOpen ? "border-orange-500/20 bg-orange-500/5" : "border-border bg-secondary/20")}>
                <div className={cn("h-2 w-2 rounded-full shrink-0", hasCritical ? "bg-red-500" : hasOpen ? "bg-orange-500" : "bg-green-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.lines} lignes · {c.lang}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-muted-foreground">{contractVulns.length} vuln.</p>
                  <p className="text-[10px] text-muted-foreground">{c.lastScan}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Severity distribution */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4">Distribution par Sévérité</h3>
        <div className="flex items-end gap-3 h-20 mb-3">
          {sevCounts.map(({ sev, count }) => {
            const max = Math.max(...sevCounts.map(s => s.count));
            return (
              <div key={sev} className="flex-1 flex flex-col items-center gap-1">
                <span className={cn("text-xs font-mono font-bold", SEV_CONFIG[sev].color)}>{count}</span>
                <div className="w-full rounded-t-sm" style={{ height: `${(count / max) * 60}px`, background: SEV_CONFIG[sev].bar, opacity: 0.8 }} />
                <span className="text-[9px] text-muted-foreground">{SEV_CONFIG[sev].label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vulnerability list */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-foreground">Vulnérabilités Détectées</h3>
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {["all", "critical", "high", "medium", "low", "info"].map((s) => (
                <button key={s} onClick={() => setFilterSev(s)}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                    filterSev === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Tous" : SEV_CONFIG[s]?.label}
                </button>
              ))}
            </div>
            <div className="w-px bg-border" />
            <div className="flex gap-1">
              {["all", "open", "in_progress", "mitigated", "fixed"].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                    filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Tous" : STATUS_CONFIG[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((v) => {
            const sev = SEV_CONFIG[v.severity];
            const st = STATUS_CONFIG[v.status];
            const StIcon = st.icon;
            const isOpen = expanded === v.id;
            return (
              <div key={v.id} className={cn("bg-card border rounded-xl overflow-hidden", sev.bg)}>
                <button onClick={() => setExpanded(isOpen ? null : v.id)}
                  className="w-full text-left p-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded border", sev.bg, sev.color)}>
                      {sev.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{v.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{v.contract}:{v.line}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <StIcon className={cn("h-3.5 w-3.5", st.color)} />
                      <span className={cn("text-[10px] font-semibold", st.color)}>{st.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">ID</p>
                        <p className="font-mono text-foreground">{v.id}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Catégorie</p>
                        <p className="font-mono text-foreground">{v.category}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Contrat · Ligne</p>
                        <p className="font-mono text-foreground">{v.contract} · L{v.line}</p>
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">Description</p>
                      <p className="text-xs text-foreground leading-relaxed">{v.description}</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-[10px] text-primary mb-1 font-semibold">Recommandation</p>
                      <p className="text-xs text-foreground leading-relaxed">{v.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}