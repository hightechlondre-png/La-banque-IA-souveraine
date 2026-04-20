import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { jsPDF } from "jspdf";
import {
  ScanLine, Loader2, FileDown, AlertTriangle, CheckCircle,
  XCircle, Shield, Code, ChevronDown, ChevronUp, RefreshCw, Zap
} from "lucide-react";

// ── Sample contracts for quick load ──────────────────────
const SAMPLES = {
  reentrancy: {
    name: "VulnerableVault.sol",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");
        // VULNERABLE: state updated AFTER external call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }

    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }
}`
  },
  overflow: {
    name: "TokenMint.sol",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

contract TokenMint {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    address public owner;

    constructor() {
        owner = msg.sender;
        totalSupply = 1000000 * 10**18;
        balances[owner] = totalSupply;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        // VULNERABLE: no overflow protection (Solidity 0.7)
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) public {
        // VULNERABLE: no access control
        totalSupply += amount;
        balances[to] += amount;
    }
}`
  },
  safe: {
    name: "SecureStaking.sol",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SecureStaking is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    IERC20 public immutable stakingToken;
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakingTimestamp;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address _token) {
        stakingToken = IERC20(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        stakedBalance[msg.sender] += amount;
        stakingTimestamp[msg.sender] = block.timestamp;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(stakedBalance[msg.sender] >= amount, "Insufficient stake");
        stakedBalance[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }
}`
  }
};

const SEV_CONFIG = {
  CRITIQUE:  { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",       bar: "#ef4444", icon: XCircle      },
  ÉLEVÉE:    { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", bar: "#f97316", icon: AlertTriangle },
  MOYENNE:   { color: "text-accent",     bg: "bg-accent/10 border-accent/30",         bar: "#f59e0b", icon: AlertTriangle },
  FAIBLE:    { color: "text-primary",    bg: "bg-primary/10 border-primary/30",       bar: "#3b82f6", icon: Shield        },
  INFO:      { color: "text-muted-foreground", bg: "bg-secondary border-border",      bar: "#64748b", icon: Shield        },
};

function VulnCard({ v, idx }) {
  const [open, setOpen] = useState(false);
  const cfg = SEV_CONFIG[v.severite] ?? SEV_CONFIG.INFO;
  const Icon = cfg.icon;

  return (
    <div className={cn("border rounded-xl overflow-hidden", cfg.bg)}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 flex-wrap">
        <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
        <Badge variant="outline" className={cn("text-[9px] shrink-0", cfg.color, "border-current/40")}>{v.severite}</Badge>
        <span className="text-sm font-bold text-foreground flex-1">{v.titre}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{v.categorie}</span>
        {v.ligne && <span className="text-[10px] font-mono text-muted-foreground">L{v.ligne}</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase">Description</p>
            <p className="text-xs text-foreground leading-relaxed">{v.description}</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-[10px] text-primary mb-1 font-bold uppercase">Recommandation</p>
            <p className="text-xs text-foreground leading-relaxed">{v.recommandation}</p>
          </div>
          {v.code_fix && (
            <div className="bg-background rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase">Exemple de correction</p>
              <pre className="text-[10px] font-mono text-green-400 whitespace-pre-wrap overflow-x-auto">{v.code_fix}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function exportPDF(contractName, result) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const W = 210, m = 14;

  // Cover
  doc.setFillColor(10, 18, 35);
  doc.rect(0, 0, W, 297, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 6, 297, "F");

  doc.setTextColor(59, 130, 246);
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("AEGIS-Q", m, 35);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Rapport d'Audit IA — Smart Contract", m, 50);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Contrat : ${contractName}`, m, 60);
  doc.text(`Généré le ${now} par AEGIS-Q AI Audit Engine`, m, 67);
  doc.text("CONFIDENTIEL", m, 74);

  const score = result.score_securite ?? 0;
  const scoreColor = score >= 80 ? [16, 185, 129] : score >= 50 ? [245, 158, 11] : [239, 68, 68];
  doc.setFillColor(...scoreColor);
  doc.roundedRect(m, 85, 50, 22, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(`${score}/100`, m + 25 - doc.getTextWidth(`${score}/100`) / 2, 98);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Score Sécurité", m + 25 - doc.getTextWidth("Score Sécurité") / 2, 103);

  // Page 2 — vulnerabilities
  doc.addPage();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, W, 297, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 6, 297, "F");

  let y = m;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("Vulnérabilités Détectées", m, y + 8); y += 16;

  const vulns = result.vulnerabilites ?? [];
  vulns.forEach((v) => {
    if (y > 260) { doc.addPage(); y = m; }
    const cfg = { CRITIQUE: [220, 38, 38], ÉLEVÉE: [234, 88, 12], MOYENNE: [202, 138, 4], FAIBLE: [59, 130, 246] };
    const c = cfg[v.severite] ?? [100, 116, 139];
    doc.setFillColor(...c);
    doc.rect(m, y, 3, 8, "F");
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text(`[${v.severite}] ${v.titre}`, m + 5, y + 5.5);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 100, 120);
    y += 10;
    const descLines = doc.splitTextToSize(v.description, W - m * 2 - 5);
    doc.text(descLines, m + 5, y); y += descLines.length * 4 + 2;
    const recLines = doc.splitTextToSize(`→ ${v.recommandation}`, W - m * 2 - 5);
    doc.setTextColor(59, 130, 246);
    doc.text(recLines, m + 5, y); y += recLines.length * 4 + 6;
  });

  // Summary
  if (result.resume) {
    if (y > 230) { doc.addPage(); y = m; }
    doc.setFillColor(30, 41, 59);
    doc.rect(m, y, W - m * 2, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Résumé Exécutif", m + 3, y + 5); y += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(result.resume, W - m * 2);
    doc.text(lines, m, y);
  }

  doc.save(`AEGIS-Q_Audit_${contractName.replace(".sol", "")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Main ─────────────────────────────────────────────────
export default function AIAuditPage() {
  const [code, setCode]       = useState("");
  const [name, setName]       = useState("MonContrat.sol");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadSample = (key) => {
    setCode(SAMPLES[key].code);
    setName(SAMPLES[key].name);
    setResult(null);
  };

  const runAudit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un auditeur de sécurité expert en smart contracts Solidity.
Analyse ce contrat et retourne un rapport JSON structuré.

Contrat à auditer (${name}):
\`\`\`solidity
${code}
\`\`\`

Retourne UNIQUEMENT un JSON valide avec cette structure exacte:
{
  "score_securite": <0-100>,
  "vulnerabilites": [
    {
      "titre": "...",
      "severite": "CRITIQUE|ÉLEVÉE|MOYENNE|FAIBLE|INFO",
      "categorie": "Reentrancy|Access Control|Integer Overflow|Front-running|Gas|Logic|Best Practice|...",
      "ligne": <numéro ou null>,
      "description": "...",
      "recommandation": "...",
      "code_fix": "// exemple de correction (optionnel, max 3 lignes)"
    }
  ],
  "points_positifs": ["...", "..."],
  "resume": "Résumé exécutif en 2-3 phrases.",
  "conforme_erc20": true|false|null,
  "post_quantique": false
}`,
      response_json_schema: {
        type: "object",
        properties: {
          score_securite: { type: "number" },
          vulnerabilites: { type: "array", items: { type: "object" } },
          points_positifs: { type: "array", items: { type: "string" } },
          resume: { type: "string" },
          conforme_erc20: {},
          post_quantique: { type: "boolean" },
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => { exportPDF(name, result); setExporting(false); }, 300);
  };

  const vulns = result?.vulnerabilites ?? [];
  const critiques = vulns.filter(v => v.severite === "CRITIQUE").length;
  const elevees   = vulns.filter(v => v.severite === "ÉLEVÉE").length;
  const score     = result?.score_securite ?? null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Audit IA — Smart Contracts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scanner vos contrats Solidity via IA · Détection temps réel · Export PDF institutionnel
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Zap className="h-3 w-3 mr-1" />Powered by AEGIS AI Engine
        </Badge>
      </div>

      {/* Code editor + controls */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Code Solidity</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground self-center">Exemples :</span>
            {Object.entries(SAMPLES).map(([k, s]) => (
              <button key={k} onClick={() => loadSample(k)}
                className="px-2.5 py-1 rounded-lg bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <input value={name} onChange={e => setName(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-48" />
          <span className="text-[10px] text-muted-foreground">Nom du contrat</span>
        </div>

        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="// Collez votre code Solidity ici…&#10;pragma solidity ^0.8.20;&#10;&#10;contract MonContrat { ... }"
          rows={16}
          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-y"
        />

        <div className="flex gap-2">
          <Button onClick={runAudit} disabled={loading || !code.trim()} className="flex-1">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyse IA en cours…</>
              : <><ScanLine className="h-4 w-4 mr-2" />Lancer l'Audit IA</>}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            </Button>
          )}
          {result && (
            <Button variant="outline" onClick={() => { setResult(null); setCode(""); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-card border border-primary/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-bold text-foreground">AEGIS AI Engine — Analyse en cours…</p>
          </div>
          <div className="space-y-2">
            {["Parsing AST Solidity", "Analyse des flux de contrôle", "Détection patterns vulnérables", "Vérification conformité ERC", "Calcul score de sécurité"].map(s => (
              <div key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score + KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={cn("border rounded-xl p-4 text-center",
              score >= 80 ? "border-green-500/30 bg-green-500/5" :
              score >= 50 ? "border-accent/30 bg-accent/5" : "border-red-500/30 bg-red-500/5")}>
              <p className="text-xs text-muted-foreground mb-1">Score Sécurité</p>
              <p className={cn("text-4xl font-black font-mono",
                score >= 80 ? "text-green-400" : score >= 50 ? "text-accent" : "text-red-400")}>
                {score}
              </p>
              <p className="text-[10px] text-muted-foreground">/100</p>
            </div>
            <div className="bg-card border border-red-500/20 rounded-xl p-4">
              <XCircle className="h-4 w-4 text-red-400 mb-1" />
              <p className="text-xs text-muted-foreground">Critiques</p>
              <p className="text-2xl font-bold font-mono text-red-400">{critiques}</p>
            </div>
            <div className="bg-card border border-orange-500/20 rounded-xl p-4">
              <AlertTriangle className="h-4 w-4 text-orange-400 mb-1" />
              <p className="text-xs text-muted-foreground">Élevées</p>
              <p className="text-2xl font-bold font-mono text-orange-400">{elevees}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <Shield className="h-4 w-4 text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Total détectées</p>
              <p className="text-2xl font-bold font-mono text-primary">{vulns.length}</p>
            </div>
          </div>

          {/* Résumé */}
          {result.resume && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-bold text-foreground mb-2">Résumé Exécutif IA</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.resume}</p>
            </div>
          )}

          {/* Points positifs */}
          {result.points_positifs?.length > 0 && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <p className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />Points positifs
              </p>
              <ul className="space-y-1">
                {result.points_positifs.map((p, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-green-400 shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vulnerability list */}
          {vulns.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">
                Vulnérabilités Détectées ({vulns.length})
              </h3>
              {vulns.map((v, i) => <VulnCard key={i} v={v} idx={i} />)}
            </div>
          ) : (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-green-400">Aucune vulnérabilité détectée</p>
              <p className="text-xs text-muted-foreground mt-1">Le contrat semble conforme aux bonnes pratiques.</p>
            </div>
          )}

          {/* Export CTA */}
          <div className="bg-card border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-foreground">Exporter le rapport PDF</p>
              <p className="text-xs text-muted-foreground">Rapport institutionnel complet — vulnérabilités, recommandations, score.</p>
            </div>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              Générer PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}