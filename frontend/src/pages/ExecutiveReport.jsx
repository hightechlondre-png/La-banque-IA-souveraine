import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import {
  FileDown, Loader2, TrendingUp, TrendingDown, Shield, Activity,
  Award, AlertTriangle, CheckCircle, Brain, Coins, RefreshCw, Clock
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Static reference data ─────────────────────────────────
const MONETARY_KPI = [
  { label: "Total Supply",      value: "100M AQ",  trend: "+0.0%",  up: null  },
  { label: "Capitalisation",    value: "$847M",    trend: "+12.4%", up: true  },
  { label: "Holders",           value: "24,871",   trend: "+3.2%",  up: true  },
  { label: "Staked",            value: "38.7%",    trend: "+1.8%",  up: true  },
  { label: "Burn cumulé",       value: "1.24M AQ", trend: "-1.24%", up: false },
  { label: "Inflation actuelle", value: "2.00%/an", trend: "-0.20%/an", up: false },
];

const SUPPLY_PROJECTION = [
  { year: "An 1", supply: 100,   net: 0.5  },
  { year: "An 2", supply: 101.3, net: 0.2  },
  { year: "An 3", supply: 101.8, net: -0.3 },
  { year: "An 4", supply: 101.5, net: -0.9 },
  { year: "An 5", supply: 100.7, net: -1.7 },
];

const ALLOCATION = [
  { name: "Écosystème",  value: 40, color: "#3b82f6" },
  { name: "Réserve IA",  value: 20, color: "#10b981" },
  { name: "Investisseurs",value: 15, color: "#f59e0b" },
  { name: "Staking",     value: 10, color: "#8b5cf6" },
  { name: "Sécurité",    value: 10, color: "#ef4444" },
  { name: "Fondation",   value: 5,  color: "#22d3ee" },
];

const CERTIFICATIONS = [
  { name: "ISO 27001",   status: "in_progress", score: 78,  auditor: "Bureau Veritas" },
  { name: "SOC 2 T2",    status: "planned",      score: 45,  auditor: "Deloitte"       },
  { name: "FIPS 140-3",  status: "planned",      score: 30,  auditor: "NIST/CMVP"      },
  { name: "CertiK",      status: "in_progress",  score: 82,  auditor: "CertiK"         },
  { name: "Trail of Bits",status: "planned",     score: 0,   auditor: "Trail of Bits"  },
];

const SECURITY_ALERTS = [
  { severity: "high",   type: "Reentrancy",      contract: "BurnMechanism.sol",  status: "fixed"      },
  { severity: "high",   type: "Access Control",   contract: "GovernanceCore.sol", status: "fixed"      },
  { severity: "medium", type: "Front-running",    contract: "GovernanceCore.sol", status: "in_progress"},
  { severity: "medium", type: "Oracle Manip.",    contract: "ResonanceOracle.sol",status: "open"       },
  { severity: "low",    type: "Gas Optimization", contract: "MemoryRegistry.sol", status: "open"       },
];

const SEV_COLOR = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", info: "#64748b" };
const STATUS_COLOR = { fixed: "text-green-400", mitigated: "text-primary", in_progress: "text-accent", open: "text-red-400" };
const CERT_STATUS_LABEL = { in_progress: "En cours", planned: "Planifié", active: "Certifié" };

// ── PDF generation ────────────────────────────────────────
function generatePDF(nodes) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const W = 210, margin = 14;

  const drawHeader = (title, y) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, W - margin * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5);
    doc.setTextColor(30, 41, 59);
    return y + 10;
  };

  const drawKV = (k, v, x, y, w = 85) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(k, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(v), x + w - doc.getTextWidth(String(v)), y);
  };

  // ── Cover page ──────────────────────────────────────────
  doc.setFillColor(10, 18, 35);
  doc.rect(0, 0, 210, 297, "F");

  // Accent bar
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 6, 297, "F");

  // Logo area
  doc.setFillColor(20, 30, 55);
  doc.roundedRect(margin, 30, W - margin * 2, 28, 4, 4, "F");
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("AEGIS-Q", margin + 8, 46);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MILITARY FINANCIAL NETWORK — SOVEREIGN AI BANKING", margin + 8, 52);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Rapport Exécutif Consolidé", margin, 85);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("KPIs Monétaires · Santé Réseau Fractal · Certifications · Alertes Sécurité", margin, 93);

  doc.setFillColor(59, 130, 246);
  doc.rect(margin, 100, 50, 0.5, "F");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text(`Généré le ${dateStr} à ${timeStr}`, margin, 108);
  doc.text("CONFIDENTIEL — TOP MANAGEMENT UNIQUEMENT", margin, 114);

  // Summary boxes on cover
  const boxes = [
    { label: "Capitalisation",   val: "$847M",   color: [59, 130, 246] },
    { label: "Score Sécurité",   val: "62%",     color: [16, 185, 129] },
    { label: "Nœuds Actifs",     val: nodes.filter(n => n.tier === "ACTIVE").length || "—", color: [245, 158, 11] },
    { label: "Alertes Critiques",val: "0",        color: [239, 68, 68]  },
  ];
  boxes.forEach((b, i) => {
    const bx = margin + i * 46;
    doc.setFillColor(20, 30, 55);
    doc.roundedRect(bx, 125, 42, 22, 3, 3, "F");
    doc.setFillColor(...b.color);
    doc.rect(bx, 125, 42, 1.5, "F");
    doc.setTextColor(...b.color);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(b.val), bx + 21 - doc.getTextWidth(String(b.val)) / 2, 136);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(b.label, bx + 21 - doc.getTextWidth(b.label) / 2, 142);
  });

  doc.setTextColor(30, 50, 80);
  doc.setFontSize(7);
  doc.text("Page 1 / 4", W - margin - 12, 290);

  // ── Page 2 — Monetary KPIs ─────────────────────────────
  doc.addPage();
  let y = margin;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 6, 297, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("1. Indicateurs Monétaires Clés", margin, y + 8); y += 14;

  // KPI grid 3x2
  MONETARY_KPI.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const bx = margin + col * 61, by = y + row * 18;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx, by, 58, 14, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, by, 58, 14, 2, 2, "S");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(k.label, bx + 3, by + 5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(k.value, bx + 3, by + 11);
    doc.setFontSize(7);
    doc.setTextColor(k.up === true ? 22 : k.up === false ? 220 : 100,
                     k.up === true ? 163 : k.up === false ? 38  : 116,
                     k.up === true ? 74  : k.up === false ? 38  : 139);
    doc.text(k.trend, bx + 52 - doc.getTextWidth(k.trend), by + 5);
  });
  y += 40;

  y = drawHeader("Politique Monétaire — Projection Supply 5 Ans", y);
  SUPPLY_PROJECTION.forEach((row, i) => {
    const bx = margin + i * 37;
    doc.setFillColor(i === 4 ? 16 : 255, i === 4 ? 185 : 255, i === 4 ? 129 : 255);
    doc.roundedRect(bx, y, 34, 18, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(i === 4 ? 255 : 15, i === 4 ? 255 : 23, i === 4 ? 255 : 42);
    doc.text(row.year, bx + 17 - doc.getTextWidth(row.year) / 2, y + 6);
    doc.setFontSize(10);
    doc.text(`${row.supply}M`, bx + 17 - doc.getTextWidth(`${row.supply}M`) / 2, y + 12);
    doc.setFontSize(7);
    const netStr = `Net: ${row.net > 0 ? "+" : ""}${row.net}%`;
    doc.setTextColor(row.net < 0 ? 22 : 220, row.net < 0 ? 163 : 38, row.net < 0 ? 74 : 38);
    doc.text(netStr, bx + 17 - doc.getTextWidth(netStr) / 2, y + 16);
  });
  y += 26;

  y = drawHeader("Répartition Stratégique du Token AQ", y);
  ALLOCATION.forEach((a, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const bx = margin + col * 61, by = y + row * 10;
    doc.setFillColor(...hexToRgb(a.color));
    doc.rect(bx, by + 1, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(`${a.name}`, bx + 6, by + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`${a.value}%`, bx + 55 - doc.getTextWidth(`${a.value}%`), by + 4);
    const barW = (a.value / 100) * 50;
    doc.setFillColor(240, 244, 248);
    doc.rect(bx + 6, by + 5, 50, 2, "F");
    doc.setFillColor(...hexToRgb(a.color));
    doc.rect(bx + 6, by + 5, barW, 2, "F");
  });
  y += 26;

  doc.setTextColor(150);
  doc.setFontSize(7);
  doc.text("Page 2 / 4", W - margin - 12, 290);

  // ── Page 3 — Network Health ─────────────────────────────
  doc.addPage();
  y = margin;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 6, 297, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("2. Santé du Réseau Fractal N-MEM-B", margin, y + 8); y += 14;

  // Node stats
  const tierCounts = { SEALED: 0, DEEP: 0, ACTIVE: 0, SHORT_TERM: 0, DORMANT: 0 };
  nodes.forEach(n => { if (tierCounts[n.tier] !== undefined) tierCounts[n.tier]++; });
  const avgRes = nodes.length ? (nodes.reduce((s, n) => s + (n.resonance ?? 0), 0) / nodes.length) : 0.68;
  const levelCounts = [0, 1, 2, 3, 4].map(l => nodes.filter(n => n.fractal_level === l).length);

  y = drawHeader("Statistiques Réseau — Snapshot Actuel", y);
  const netStats = [
    ["Nœuds totaux",    nodes.length || "—"],
    ["Résonance moy.",  `${(avgRes * 100).toFixed(0)}%`],
    ["SEALED",          tierCounts.SEALED],
    ["ACTIVE",          tierCounts.ACTIVE],
    ["DORMANT",         tierCounts.DORMANT],
    ["DEEP",            tierCounts.DEEP],
  ];
  netStats.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const bx = margin + col * 61, by = y + row * 14;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx, by, 58, 11, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(s[0], bx + 3, by + 4.5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(s[1]), bx + 55 - doc.getTextWidth(String(s[1])), by + 9);
  });
  y += 32;

  y = drawHeader("Distribution par Niveau Fractal", y);
  const levelLabels = ["L0 Événement", "L1 Relation", "L2 Cluster", "L3 Branche", "L4 Stratégique"];
  const levelColors = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"];
  const maxL = Math.max(...levelCounts, 1);
  levelCounts.forEach((cnt, i) => {
    const bx = margin + i * 37;
    const barH = Math.max(2, (cnt / maxL) * 20);
    doc.setFillColor(240, 244, 248);
    doc.rect(bx, y + 20 - 20, 32, 20, "F");
    doc.setFillColor(...hexToRgb(levelColors[i]));
    doc.rect(bx, y + 20 - barH, 32, barH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb(levelColors[i]));
    doc.text(String(cnt || 0), bx + 16 - doc.getTextWidth(String(cnt || 0)) / 2, y + 16 - barH);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    const ll = levelLabels[i].split(" ");
    doc.text(ll[0], bx + 16 - doc.getTextWidth(ll[0]) / 2, y + 24);
    doc.text(ll[1] || "", bx + 16 - doc.getTextWidth(ll[1] || "") / 2, y + 28);
  });
  y += 35;

  y = drawHeader("Mécanismes de Propagation — Paramètres Actifs", y);
  const propParams = [
    ["Decay L0", "0.95"], ["Decay L4", "0.55"], ["Seuil L0", "0.05"],
    ["Seuil L4", "0.45"], ["k decay", "0.02×(lvl+1)"], ["Pruning", "décayRes < seuil"],
  ];
  propParams.forEach((p, i) => {
    drawKV(p[0], p[1], margin + (i % 3) * 61, y + Math.floor(i / 3) * 8 + 4);
  });
  y += 22;

  doc.setTextColor(150);
  doc.setFontSize(7);
  doc.text("Page 3 / 4", W - margin - 12, 290);

  // ── Page 4 — Certs + Security ───────────────────────────
  doc.addPage();
  y = margin;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 0, 6, 297, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("3. Certifications & Sécurité", margin, y + 8); y += 14;

  y = drawHeader("Statut des Certifications Institutionnelles", y);
  CERTIFICATIONS.forEach((cert, i) => {
    const by = y + i * 11;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, by, W - margin * 2, 9, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(cert.name, margin + 3, by + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(cert.auditor, margin + 40, by + 6);
    const statusLabel = CERT_STATUS_LABEL[cert.status] ?? cert.status;
    doc.setTextColor(cert.status === "active" ? 22 : cert.status === "in_progress" ? 245 : 100,
                     cert.status === "active" ? 163 : cert.status === "in_progress" ? 158 : 116,
                     cert.status === "active" ? 74  : cert.status === "in_progress" ? 11  : 139);
    doc.text(statusLabel, margin + 90, by + 6);
    // Score bar
    doc.setFillColor(226, 232, 240);
    doc.rect(margin + 115, by + 3.5, 50, 2.5, "F");
    if (cert.score > 0) {
      doc.setFillColor(59, 130, 246);
      doc.rect(margin + 115, by + 3.5, cert.score / 2, 2.5, "F");
    }
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(`${cert.score}%`, margin + 168, by + 6);
  });
  y += CERTIFICATIONS.length * 11 + 5;

  y = drawHeader("Vulnérabilités Smart Contracts — Résumé Exécutif", y);
  const headers = ["Sévérité", "Type", "Contrat", "Statut"];
  const colX = [margin + 2, margin + 30, margin + 80, margin + 148];
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  headers.forEach((h, i) => doc.text(h, colX[i], y + 4));
  y += 7;

  SECURITY_ALERTS.forEach((alert, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, y + i * 9, W - margin * 2, 9, "F");
    const rgb = hexToRgb(SEV_COLOR[alert.severity] ?? "#64748b");
    doc.setFillColor(...rgb);
    doc.circle(colX[0] + 3, y + i * 9 + 4.5, 1.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb);
    doc.text(alert.severity, colX[0] + 6, y + i * 9 + 5.5);
    doc.setTextColor(15, 23, 42);
    doc.text(alert.type, colX[1], y + i * 9 + 5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(alert.contract, colX[2], y + i * 9 + 5.5);
    const stColor = alert.status === "fixed" ? [22, 163, 74] : alert.status === "open" ? [220, 38, 38] : [245, 158, 11];
    doc.setTextColor(...stColor);
    doc.setFont("helvetica", "bold");
    doc.text(alert.status, colX[3], y + i * 9 + 5.5);
  });
  y += SECURITY_ALERTS.length * 9 + 8;

  y = drawHeader("Recommandations Prioritaires — Top Management", y);
  const recs = [
    "1. Initier la migration cryptographique post-quantique (CRYSTALS-Dilithium) avant Q3 2026.",
    "2. Finaliser l'audit CertiK et obtenir la certification ISO 27001 d'ici Q3 2026.",
    "3. Activer les time-locks 48h pour toutes transactions supérieures à $1M.",
    "4. Lancer le Bug Bounty Program (Immunefi) avec récompense maximale $100K.",
    "5. Recruter un cryptographe post-quantique senior (INRIA / ENS / Polytechnique).",
  ];
  recs.forEach((r, i) => {
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y + i * 8 + 1, 1.5, 5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(r, margin + 4, y + i * 8 + 5);
  });

  doc.setTextColor(150);
  doc.setFontSize(7);
  doc.text("Page 4 / 4", W - margin - 12, 290);
  doc.text(`AEGIS-Q — Rapport Confidentiel — ${dateStr}`, margin, 290);

  doc.save(`AEGIS-Q_Executive_Report_${now.toISOString().slice(0, 10)}.pdf`);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── UI Components ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.fill || p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono text-foreground ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────
export default function ExecutiveReport() {
  const [exporting, setExporting] = useState(false);

  const { data: nodes = [], isLoading, refetch } = useQuery({
    queryKey: ["nodes-exec"],
    queryFn: () => base44.entities.MemoryNode.list("-resonance", 100),
    refetchInterval: 60000,
  });

  const handleExport = async () => {
    setExporting(true);
    setTimeout(() => { generatePDF(nodes); setExporting(false); }, 300);
  };

  // Computed
  const avgRes     = nodes.length ? nodes.reduce((s, n) => s + (n.resonance ?? 0), 0) / nodes.length : 0.68;
  const activeNodes = nodes.filter(n => n.tier === "ACTIVE").length;
  const sealedNodes = nodes.filter(n => n.tier === "SEALED").length;
  const levelData  = [0,1,2,3,4].map(l => ({
    level: `L${l}`, count: nodes.filter(n => n.fractal_level === l).length,
    avgRes: nodes.filter(n => n.fractal_level === l).length
      ? (nodes.filter(n => n.fractal_level === l).reduce((s, n) => s + (n.resonance ?? 0), 0) /
         nodes.filter(n => n.fractal_level === l).length * 100).toFixed(0)
      : 0,
  }));
  const tierData = ["SEALED","DEEP","ACTIVE","SHORT_TERM","DORMANT"].map(t => ({
    name: t, value: nodes.filter(n => n.tier === t).length,
  }));
  const TIER_COLORS = { SEALED: "#ef4444", DEEP: "#8b5cf6", ACTIVE: "#10b981", SHORT_TERM: "#3b82f6", DORMANT: "#64748b" };
  const secureScore = Math.round((SECURITY_ALERTS.filter(a => a.status === "fixed").length / SECURITY_ALERTS.length) * 100);
  const certScore   = Math.round(CERTIFICATIONS.reduce((s, c) => s + c.score, 0) / CERTIFICATIONS.length);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Rapport Exécutif</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tableau de bord consolidé Top Management — KPIs · Réseau · Certifications · Sécurité
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Actualiser
          </button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exporter PDF 4 pages
          </Button>
        </div>
      </div>

      {/* Top KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Capitalisation",    value: "$847M",               icon: Coins,     color: "text-accent",    change: "+12.4%" , up: true  },
          { label: "Score Sécurité",    value: `${secureScore}%`,     icon: Shield,    color: "text-green-400", change: `${SECURITY_ALERTS.filter(a=>a.status==="open").length} ouvertes`, up: null },
          { label: "Score Certif.",     value: `${certScore}%`,       icon: Award,     color: "text-primary",   change: "Moy. 5 certs", up: null },
          { label: "Résonance Réseau",  value: `${(avgRes*100).toFixed(0)}%`, icon: Activity, color: avgRes > 0.6 ? "text-green-400" : "text-orange-400", change: `${activeNodes} nœuds actifs`, up: null },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              {k.up !== null && (
                <span className={cn("text-[10px] font-mono", k.up ? "text-green-400" : "text-red-400")}>{k.change}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono mt-1", k.color)}>{k.value}</p>
            {k.up === null && <p className="text-[10px] text-muted-foreground mt-1">{k.change}</p>}
          </div>
        ))}
      </div>

      {/* Row 1: Monetary + Supply projection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monetary KPIs table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">KPIs Monétaires</h3>
          </div>
          <div className="space-y-3">
            {MONETARY_KPI.map(k => (
              <div key={k.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-mono", k.up === true ? "text-green-400" : k.up === false ? "text-red-400" : "text-muted-foreground")}>
                    {k.trend}
                  </span>
                  <span className="text-xs font-bold font-mono text-foreground">{k.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supply projection chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-bold text-foreground">Projection Supply 5 Ans</h3>
            <Badge variant="outline" className="text-[10px] border-green-500/20 text-green-400 ml-auto">Déflationnaire An 3+</Badge>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SUPPLY_PROJECTION} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis domain={[99, 103]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="supply" name="Supply (M AQ)" radius={[4, 4, 0, 0]}
                  fill="hsl(217,91%,60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Network health + Token allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Level bar chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Santé Réseau — Nœuds par Niveau</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
                <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Nœuds" radius={[4, 4, 0, 0]}>
                  {levelData.map((_, i) => (
                    <Cell key={i} fill={["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {isLoading && <p className="text-xs text-muted-foreground text-center mt-2">Chargement des nœuds…</p>}
        </div>

        {/* Tier pie + Allocation pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-chart-2" />
            <h3 className="text-sm font-bold text-foreground">Distribution Token & Tiers Mémoire</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 h-44">
            <div>
              <p className="text-[10px] text-muted-foreground text-center mb-1">Tiers Réseau</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={tierData} cx="50%" cy="50%" outerRadius={55} dataKey="value" stroke="none">
                    {tierData.map((t, i) => <Cell key={i} fill={TIER_COLORS[t.name] ?? "#64748b"} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground text-center mb-1">Allocation AQ</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={ALLOCATION} cx="50%" cy="50%" innerRadius={28} outerRadius={55} dataKey="value" stroke="none">
                    {ALLOCATION.map((a, i) => <Cell key={i} fill={a.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Certifications + Security alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Certifications */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Statut Certifications</h3>
          </div>
          <div className="space-y-3">
            {CERTIFICATIONS.map(cert => {
              const statusLabel = CERT_STATUS_LABEL[cert.status] ?? cert.status;
              return (
                <div key={cert.name} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-bold text-foreground">{cert.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cert.auditor}</p>
                  </div>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${cert.score}%`, opacity: 0.8 }} />
                  </div>
                  <span className="text-[10px] font-mono text-foreground w-6 text-right">{cert.score}%</span>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0 w-20 justify-center",
                    cert.status === "active" ? "border-green-500/30 text-green-400" :
                    cert.status === "in_progress" ? "border-accent/30 text-accent" : "border-border text-muted-foreground")}>
                    {statusLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security vulnerabilities */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-bold text-foreground">Alertes Sécurité — Smart Contracts</h3>
            <Badge variant="outline" className="text-[10px] border-green-500/20 text-green-400 ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              {SECURITY_ALERTS.filter(a => a.status === "fixed").length}/{SECURITY_ALERTS.length} corrigées
            </Badge>
          </div>
          <div className="space-y-2">
            {SECURITY_ALERTS.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: SEV_COLOR[a.severity] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{a.type}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{a.contract}</p>
                </div>
                <span className={cn("text-[10px] font-bold shrink-0", STATUS_COLOR[a.status] ?? "text-muted-foreground")}>
                  {a.status === "fixed" ? "✓ Corrigé" : a.status === "in_progress" ? "En cours" : "⚠ Ouvert"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export CTA */}
      <div className="bg-card border border-primary/20 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileDown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Export PDF Institutionnel — 4 Pages</p>
            <p className="text-xs text-muted-foreground">Page de couverture · KPIs monétaires · Santé réseau · Certifications & Sécurité</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting} size="lg" className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Générer le Rapport PDF
        </Button>
      </div>
    </div>
  );
}