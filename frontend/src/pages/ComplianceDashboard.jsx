import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import {
  ShieldCheck, ShieldX, ShieldAlert, RefreshCw, Loader2,
  FileDown, CheckCircle, XCircle, AlertTriangle, Zap, Brain,
  Activity, Clock, ChevronDown, ChevronUp
} from "lucide-react";

// ── Standards & Controls ──────────────────────────────────
const STANDARDS = {
  soc2: {
    name: "SOC 2 Type II",
    color: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10",
    controls: [
      { id: "CC6.1", name: "Contrôle d'accès logique",    check: n => n.tier !== "DORMANT" && n.resonance > 0.3 },
      { id: "CC6.6", name: "Chiffrement des données",      check: n => n.fractal_level >= 1 },
      { id: "CC7.1", name: "Détection des anomalies",      check: n => n.resonance < 0.95 },
      { id: "CC7.2", name: "Monitoring continu",           check: n => !!n.last_activated },
      { id: "CC9.1", name: "Gestion des risques tiers",    check: n => n.tier !== "DORMANT" },
      { id: "A1.1",  name: "Disponibilité opérationnelle", check: n => n.resonance > 0.2 },
    ],
  },
  iso27001: {
    name: "ISO 27001",
    color: "text-accent",
    border: "border-accent/30",
    bg: "bg-accent/10",
    controls: [
      { id: "A.8.1",  name: "Inventaire des actifs",          check: n => !!n.concept && !!n.type },
      { id: "A.9.2",  name: "Gestion des accès utilisateurs", check: n => n.tier !== "DORMANT" },
      { id: "A.10.1", name: "Cryptographie & chiffrement",    check: n => n.fractal_level >= 1 },
      { id: "A.12.4", name: "Journalisation & surveillance",  check: n => !!n.last_activated },
      { id: "A.14.2", name: "Sécurité du développement",      check: n => n.emotion_weight < 0.9 },
      { id: "A.16.1", name: "Gestion des incidents",          check: n => n.resonance > 0.15 },
    ],
  },
};

// ── Severity helpers ───────────────────────────────────────
function scorePct(node, standard) {
  const controls = STANDARDS[standard].controls;
  const passed = controls.filter(c => c.check(node)).length;
  return Math.round((passed / controls.length) * 100);
}

function overallScore(node) {
  const s = (scorePct(node, "soc2") + scorePct(node, "iso27001")) / 2;
  return Math.round(s);
}

function severityOf(score) {
  if (score >= 85) return "compliant";
  if (score >= 60) return "warning";
  return "critical";
}

const SEV = {
  compliant: { label: "Conforme",       color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   icon: CheckCircle  },
  warning:   { label: "Avertissement",  color: "text-accent",     bg: "bg-accent/10 border-accent/20",         icon: ShieldAlert  },
  critical:  { label: "Non-conforme",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: ShieldX      },
};

// ── AI corrective actions via InvokeLLM ───────────────────
async function generateCorrectiveActions(node, failures) {
  if (!failures.length) return [];
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert en conformité SOC 2 et ISO 27001 pour un réseau de mémoire fractale IA militaire (AEGIS-Q).
Nœud : "${node.concept}" (type: ${node.type}, tier: ${node.tier}, résonance: ${(node.resonance * 100).toFixed(0)}%, niveau fractal: L${node.fractal_level}).
Contrôles échoués : ${failures.map(f => f.name).join(", ")}.
Génère exactement ${Math.min(4, failures.length + 1)} actions correctives concrètes, courtes et prioritisées.
Chaque action doit mentionner le contrôle concerné, l'action technique précise et l'urgence (P1/P2/P3).`,
    response_json_schema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "string" },
              control: { type: "string" },
              action: { type: "string" },
              effort: { type: "string" },
            },
          },
        },
      },
    },
  });
  return res?.actions ?? [];
}

// ── PDF export ────────────────────────────────────────────
function exportPDF(nodes, scannedAt) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const W = 210, M = 14;

  // Header
  doc.setFillColor(10, 18, 35);
  doc.rect(0, 0, W, 38, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 5, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("AEGIS-Q — Rapport de Conformité", M, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`SOC 2 Type II · ISO 27001 — Généré le ${now}`, M, 25);
  doc.text("CONFIDENTIEL", M, 32);

  let y = 48;
  const nonCompliant = nodes.filter(n => severityOf(overallScore(n)) === "critical");
  const warnings     = nodes.filter(n => severityOf(overallScore(n)) === "warning");
  const compliant    = nodes.filter(n => severityOf(overallScore(n)) === "compliant");

  // Summary
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé Exécutif", M, y); y += 8;

  const avgScore = nodes.length ? Math.round(nodes.reduce((s, n) => s + overallScore(n), 0) / nodes.length) : 0;
  const stats = [
    ["Score Global", `${avgScore}%`], ["Nœuds Conformes", compliant.length],
    ["Avertissements", warnings.length], ["Non-conformes", nonCompliant.length],
  ];
  stats.forEach((s, i) => {
    const bx = M + i * 47;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(bx, y, 43, 14, 2, 2, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
    doc.text(s[0], bx + 3, y + 5);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text(String(s[1]), bx + 3, y + 11);
  });
  y += 22;

  // Non-compliant nodes
  if (nonCompliant.length) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(220, 38, 38);
    doc.text(`Non-conformités Critiques (${nonCompliant.length})`, M, y); y += 7;
    nonCompliant.forEach(n => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(M, y, W - M * 2, 16, 2, 2, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text(`${n.concept} (L${n.fractal_level} · ${n.tier})`, M + 3, y + 6);
      doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      const soc = scorePct(n, "soc2"), iso = scorePct(n, "iso27001");
      doc.text(`SOC 2: ${soc}%  |  ISO 27001: ${iso}%  |  Score global: ${overallScore(n)}%`, M + 3, y + 12);
      y += 19;
    });
    y += 4;
  }

  // Warning nodes
  if (warnings.length) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(245, 158, 11);
    doc.text(`Avertissements (${warnings.length})`, M, y); y += 7;
    warnings.forEach(n => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
      doc.text(`• ${n.concept} — SOC 2: ${scorePct(n, "soc2")}% | ISO: ${scorePct(n, "iso27001")}%`, M + 2, y);
      y += 6;
    });
    y += 4;
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(150);
  doc.text(`AEGIS-Q Compliance Report — ${now} — Confidentiel`, M, 290);

  doc.save(`AEGIS-Q_Compliance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Node card ─────────────────────────────────────────────
function NodeCard({ node }) {
  const [open, setOpen] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [actions, setActions] = useState(null);

  const soc  = scorePct(node, "soc2");
  const iso  = scorePct(node, "iso27001");
  const total = overallScore(node);
  const sev  = severityOf(total);
  const cfg  = SEV[sev];
  const Icon = cfg.icon;

  const socFailures = STANDARDS.soc2.controls.filter(c => !c.check(node));
  const isoFailures = STANDARDS.iso27001.controls.filter(c => !c.check(node));
  const allFailures = [...new Map([...socFailures, ...isoFailures].map(f => [f.id, f])).values()];

  const fetchAI = async () => {
    if (actions !== null) { setOpen(true); return; }
    setLoadingAI(true);
    setOpen(true);
    const result = await generateCorrectiveActions(node, allFailures);
    setActions(result);
    setLoadingAI(false);
  };

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", sev === "critical" ? "border-red-500/30" : sev === "warning" ? "border-accent/20" : "border-border")}>
      <button onClick={() => open ? setOpen(false) : fetchAI()} className="w-full text-left p-4 hover:bg-secondary/10 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{node.concept}</p>
              <p className="text-[10px] text-muted-foreground font-mono">L{node.fractal_level} · {node.tier} · rés. {(node.resonance * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={cn("text-[10px]", cfg.bg, cfg.color)}>{cfg.label}</Badge>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {[["SOC 2 T2", soc, "text-primary"], ["ISO 27001", iso, "text-accent"]].map(([label, score, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16">{label}</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: score >= 85 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444" }} />
              </div>
              <span className={cn("text-[10px] font-mono font-bold w-8 text-right", color)}>{score}%</span>
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Failed controls */}
          {allFailures.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Contrôles échoués ({allFailures.length})</p>
              <div className="space-y-1.5">
                {allFailures.map(f => (
                  <div key={f.id} className="flex items-center gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                    <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                    <span className="text-[10px] font-mono text-muted-foreground">{f.id}</span>
                    <span className="text-[10px] text-foreground">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI corrective actions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Actions Correctives IA</p>
            </div>
            {loadingAI ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analyse IA en cours…
              </div>
            ) : actions === null ? null : actions.length === 0 ? (
              <p className="text-xs text-green-400">✓ Aucune action corrective requise.</p>
            ) : (
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <div key={i} className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[9px] px-1.5",
                        a.priority === "P1" ? "border-red-500/30 text-red-400" :
                        a.priority === "P2" ? "border-accent/30 text-accent" : "border-primary/30 text-primary")}>
                        {a.priority}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">{a.control}</span>
                      {a.effort && <span className="text-[10px] text-muted-foreground ml-auto">⏱ {a.effort}</span>}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{a.action}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function ComplianceDashboard() {
  const [scanning, setScanning] = useState(false);
  const [scannedAt, setScannedAt] = useState(null);
  const [filterStd, setFilterStd] = useState("all");
  const [filterSev, setFilterSev] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const autoRef = useRef(null);

  const { data: nodes = [], isLoading, refetch } = useQuery({
    queryKey: ["nodes-compliance"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 50),
  });

  const scan = async () => {
    setScanning(true);
    await refetch();
    setScannedAt(new Date());
    setScanning(false);
  };

  // Auto-scan every 60s
  useEffect(() => {
    if (autoScan) {
      scan();
      autoRef.current = setInterval(scan, 60000);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoScan]);

  // Compute stats
  const scored = nodes.map(n => ({ ...n, _score: overallScore(n), _sev: severityOf(overallScore(n)) }));
  const avgScore = scored.length ? Math.round(scored.reduce((s, n) => s + n._score, 0) / scored.length) : 0;
  const counts = { compliant: 0, warning: 0, critical: 0 };
  scored.forEach(n => counts[n._sev]++);

  const filtered = scored.filter(n => {
    if (filterSev !== "all" && n._sev !== filterSev) return false;
    if (filterStd !== "all") {
      const score = filterStd === "soc2" ? scorePct(n, "soc2") : scorePct(n, "iso27001");
      if (score >= 85) return false; // only show non-perfect for standard filter
    }
    return true;
  });

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => { exportPDF(scored, scannedAt); setExporting(false); }, 300);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Conformité Temps Réel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scan automatique SOC 2 · ISO 27001 — Actions correctives générées par IA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {scannedAt && (
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />Dernier scan : {scannedAt.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={() => setAutoScan(a => !a)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
              autoScan ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            <Activity className={cn("h-3.5 w-3.5", autoScan && "animate-pulse")} />
            {autoScan ? "Auto ✓" : "Auto (60s)"}
          </button>
          <Button variant="outline" onClick={scan} disabled={scanning || isLoading}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Scanner
          </Button>
          <Button onClick={handleExport} disabled={exporting || !scored.length}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            Rapport PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Score Global",      value: `${avgScore}%`,       color: avgScore >= 85 ? "text-green-400" : avgScore >= 60 ? "text-accent" : "text-red-400", icon: ShieldCheck },
          { label: "Nœuds Conformes",  value: counts.compliant,     color: "text-green-400", icon: CheckCircle  },
          { label: "Avertissements",    value: counts.warning,       color: "text-accent",    icon: ShieldAlert  },
          { label: "Non-conformes",     value: counts.critical,      color: "text-red-400",   icon: ShieldX      },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Standard overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(STANDARDS).map(([key, std]) => {
          const scores = scored.map(n => scorePct(n, key));
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          const failing = scores.filter(s => s < 85).length;
          return (
            <div key={key} className={cn("bg-card border rounded-xl p-5", std.border)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", std.bg)}>
                    <ShieldCheck className={cn("h-4 w-4", std.color)} />
                  </div>
                  <p className={cn("text-sm font-bold", std.color)}>{std.name}</p>
                </div>
                <p className={cn("text-2xl font-bold font-mono", avg >= 85 ? "text-green-400" : avg >= 60 ? "text-accent" : "text-red-400")}>{avg}%</p>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: avg >= 85 ? "#10b981" : avg >= 60 ? "#f59e0b" : "#ef4444" }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{std.controls.length} contrôles</span>
                <span className={failing > 0 ? "text-red-400" : "text-green-400"}>{failing} nœuds sous seuil</span>
              </div>
              <div className="mt-3 space-y-1">
                {std.controls.map(c => {
                  const passed = scored.filter(n => c.check(n)).length;
                  const pct = scored.length ? Math.round((passed / scored.length) * 100) : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-muted-foreground w-12">{c.id}</span>
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 85 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      <span className="text-muted-foreground w-16 truncate">{c.name}</span>
                      <span className={cn("font-mono font-bold w-7 text-right", pct >= 85 ? "text-green-400" : pct >= 60 ? "text-accent" : "text-red-400")}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + node list */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-foreground">Filtres :</span>
          <div className="flex gap-1.5">
            {["all", "critical", "warning", "compliant"].map(s => (
              <button key={s} onClick={() => setFilterSev(s)}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  filterSev === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {s === "all" ? "Tous" : SEV[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-1.5">
            {["all", "soc2", "iso27001"].map(s => (
              <button key={s} onClick={() => setFilterStd(s)}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  filterStd === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {s === "all" ? "Tous standards" : STANDARDS[s]?.name ?? s}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} nœud{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading || scanning ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{scanning ? "Scan en cours…" : "Chargement des nœuds…"}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <ShieldCheck className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun nœud ne correspond aux filtres sélectionnés.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => <NodeCard key={n.id} node={n} />)}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
        <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-foreground mb-1">Analyse IA des Actions Correctives</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cliquez sur un nœud pour déclencher l'analyse IA contextuelle. Le modèle génère des actions correctives priorisées (P1/P2/P3) basées sur les contrôles SOC 2 et ISO 27001 échoués, le type de nœud, son niveau fractal et ses paramètres de résonance.
          </p>
        </div>
      </div>
    </div>
  );
}