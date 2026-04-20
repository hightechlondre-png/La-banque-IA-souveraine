import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Zap,
  FileSearch, Loader2, Copy, ChevronDown, ChevronUp,
  Lock, Code, Activity, BarChart2, RefreshCw
} from "lucide-react";

// ── Vulnerability categories ──────────────────────────────
const VULN_TYPES = {
  reentrancy:   { label: "Reentrancy",         color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",      icon: "🔄" },
  overflow:     { label: "Overflow/Underflow",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30",icon: "⚠️" },
  access:       { label: "Access Control",      color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30",icon: "🔐" },
  logic:        { label: "Logique Métier",      color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30",icon: "🧠" },
  dos:          { label: "Déni de Service",     color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/30",    icon: "🛑" },
  gas:          { label: "Optimisation Gaz",    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",    icon: "⛽" },
  oracle:       { label: "Oracle Manipulation", color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/30",    icon: "🔮" },
  flashloan:    { label: "Flash Loan Attack",   color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30",icon: "⚡" },
};

const SEV_CONFIG = {
  critical: { label: "Critique", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",       bar: "bg-red-500",    ring: "ring-red-500/30" },
  high:     { label: "Élevée",   color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", bar: "bg-orange-500", ring: "ring-orange-500/30" },
  medium:   { label: "Moyenne",  color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", bar: "bg-yellow-500", ring: "ring-yellow-500/30" },
  low:      { label: "Faible",   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",     bar: "bg-blue-500",   ring: "ring-blue-500/30"  },
  info:     { label: "Info",     color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30",     bar: "bg-gray-500",   ring: "ring-gray-500/30"  },
};

// ── Sample contracts ──────────────────────────────────────
const SAMPLES = [
  {
    name: "Vulnerable Vault",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient");
        // ❌ Reentrancy: state update AFTER external call
        (bool success,) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] -= amount;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}`,
  },
  {
    name: "Unsafe Token",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract UnsafeToken {
    mapping(address => uint256) balances;
    address public owner;

    constructor() public { owner = msg.sender; }

    // ❌ No overflow protection (pre-0.8)
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    // ❌ Missing access control
    function mint(address to, uint256 amount) public {
        balances[to] += amount;
    }

    // ❌ Locked ETH — no withdrawal function
    receive() external payable {}
}`,
  },
  {
    name: "Secure Contract",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SecureVault is ReentrancyGuard, Ownable {
    mapping(address => uint256) private balances;
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ✅ Checks-Effects-Interactions + nonReentrant
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount; // effect first
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`,
  },
];

// ── Score ring ────────────────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "Sûr" : score >= 60 ? "Modéré" : score >= 40 ? "Risqué" : "Critique";
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(222,30%,16%)" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color }}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <Badge variant="outline" className="text-xs" style={{ color, borderColor: `${color}44` }}>
        {label}
      </Badge>
    </div>
  );
}

// ── Vuln card ─────────────────────────────────────────────
function VulnCard({ vuln, idx }) {
  const [open, setOpen] = useState(false);
  const sev = SEV_CONFIG[vuln.severity] ?? SEV_CONFIG.info;
  const type = VULN_TYPES[vuln.type] ?? {};

  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all", sev.bg)}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base shrink-0">{type.icon ?? "🔍"}</span>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-bold", sev.color)}>{vuln.title}</p>
            <p className="text-[10px] text-muted-foreground">{type.label ?? vuln.type} · Ligne {vuln.line ?? "?"}</p>
          </div>
          <Badge variant="outline" className={cn("text-[9px] shrink-0", sev.color, "border-current/40")}>
            {sev.label}
          </Badge>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Description</p>
            <p className="text-xs text-foreground leading-relaxed">{vuln.description}</p>
          </div>
          {vuln.code_snippet && (
            <div className="bg-background rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-mono">Code problématique</p>
              <pre className="text-[11px] font-mono text-red-300 whitespace-pre-wrap overflow-x-auto">{vuln.code_snippet}</pre>
            </div>
          )}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <p className="text-[10px] text-green-400 mb-1 font-semibold">✅ Recommandation</p>
            <p className="text-xs text-foreground leading-relaxed">{vuln.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function SecurityScanner() {
  const [code, setCode]         = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [filterSev, setFilterSev] = useState("all");
  const abortRef = useRef(null);

  const loadSample = (sample) => {
    setCode(sample.code);
    setResult(null);
  };

  const scan = async () => {
    if (!code.trim()) return;
    setScanning(true);
    setResult(null);
    setError(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un auditeur de sécurité expert en smart contracts Solidity. Analyse ce contrat et retourne un rapport JSON détaillé.

CONTRAT À ANALYSER:
\`\`\`solidity
${code}
\`\`\`

Retourne un JSON avec exactement cette structure:
{
  "score": <entier 0-100, 100 = parfaitement sûr>,
  "summary": "<résumé exécutif en 1-2 phrases>",
  "contract_name": "<nom du contrat détecté>",
  "solidity_version": "<version pragma détectée>",
  "total_lines": <nombre de lignes>,
  "vulnerabilities": [
    {
      "type": "<un de: reentrancy|overflow|access|logic|dos|gas|oracle|flashloan>",
      "severity": "<critical|high|medium|low|info>",
      "title": "<titre court>",
      "line": <numéro de ligne ou null>,
      "description": "<explication détaillée>",
      "code_snippet": "<extrait de code concerné ou null>",
      "recommendation": "<correction recommandée>"
    }
  ],
  "positive_points": ["<point fort 1>", "<point fort 2>"],
  "gas_estimate": "<estimation coût déploiement>",
  "audit_notes": "<notes supplémentaires>"
}

Sois précis, exhaustif et professionnel. Détecte TOUTES les vulnérabilités présentes.`,
      response_json_schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          summary: { type: "string" },
          contract_name: { type: "string" },
          solidity_version: { type: "string" },
          total_lines: { type: "number" },
          vulnerabilities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                severity: { type: "string" },
                title: { type: "string" },
                line: { type: "number" },
                description: { type: "string" },
                code_snippet: { type: "string" },
                recommendation: { type: "string" },
              }
            }
          },
          positive_points: { type: "array", items: { type: "string" } },
          gas_estimate: { type: "string" },
          audit_notes: { type: "string" },
        }
      }
    });

    setResult(res);
    setScanning(false);
  };

  const filteredVulns = result?.vulnerabilities?.filter(v =>
    filterSev === "all" ? true : v.severity === filterSev
  ) ?? [];

  const sevCounts = result ? ["critical","high","medium","low","info"].map(s => ({
    s, count: result.vulnerabilities?.filter(v => v.severity === s).length ?? 0
  })) : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Scanner IA Sécurité</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse statique intelligente · Reentrancy · Overflow · Access Control · Vulnérabilités logiques
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Zap className="h-3 w-3 mr-1" />
          IA Powered · Temps réel
        </Badge>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left — Code input */}
        <div className="space-y-3">
          {/* Samples */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Exemples :</span>
            {SAMPLES.map(s => (
              <button key={s.name} onClick={() => loadSample(s)}
                className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                {s.name}
              </button>
            ))}
            <button onClick={() => { setCode(""); setResult(null); }}
              className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-[11px] text-muted-foreground hover:text-red-400 transition-all ml-auto">
              <RefreshCw className="h-3 w-3 inline mr-1" />Reset
            </button>
          </div>

          {/* Code editor */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-mono text-muted-foreground">Solidity Source Code</span>
              </div>
              {code && (
                <button onClick={() => navigator.clipboard.writeText(code)}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <textarea
              value={code}
              onChange={e => { setCode(e.target.value); setResult(null); }}
              placeholder={`// Collez votre code Solidity ici...\n// ou sélectionnez un exemple ci-dessus\n\npragma solidity ^0.8.20;\n\ncontract MonContrat {\n    // ...\n}`}
              className="w-full h-96 bg-background p-4 text-xs font-mono text-foreground resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-[10px] text-muted-foreground font-mono">
                {code.split("\n").length} lignes · {code.length} caractères
              </span>
              <Button onClick={scan} disabled={scanning || !code.trim()} size="sm" className="gap-2">
                {scanning
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyse en cours…</>
                  : <><FileSearch className="h-3.5 w-3.5" />Analyser</>
                }
              </Button>
            </div>
          </div>

          {/* Vuln type legend */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">Catégories détectées</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(VULN_TYPES).map(([k, v]) => (
                <div key={k} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] border", v.bg)}>
                  <span>{v.icon}</span>
                  <span className={v.color}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Results */}
        <div className="space-y-3">
          {/* Loading state */}
          {scanning && (
            <div className="bg-card border border-primary/30 rounded-xl p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Shield className="absolute inset-0 m-auto h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Analyse IA en cours…</p>
                <p className="text-xs text-muted-foreground mt-1">Détection des vulnérabilités · Audit statique · Rapport</p>
              </div>
              <div className="w-full space-y-2">
                {["Parsing AST Solidity", "Détection reentrancy", "Vérification overflow", "Audit access control", "Analyse logique métier"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!scanning && !result && (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-4 text-center h-96 justify-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Scanner Prêt</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Collez votre code Solidity ou choisissez un exemple, puis cliquez sur "Analyser"
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Reentrancy", "Overflow", "Access Control", "Logic Bugs", "DoS", "Flash Loan"].map(t => (
                  <span key={t} className="px-2.5 py-1 bg-secondary rounded-lg text-[10px] text-muted-foreground border border-border">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !scanning && (
            <div className="space-y-3">
              {/* Score + summary */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-5 flex-wrap">
                  <ScoreRing score={Math.round(result.score ?? 50)} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {result.contract_name ?? "Contrat Analysé"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{result.summary}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Version", result.solidity_version ?? "—"],
                        ["Lignes",  result.total_lines ?? code.split("\n").length],
                        ["Vulnérabilités", result.vulnerabilities?.length ?? 0],
                        ["Coût gaz", result.gas_estimate ?? "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-secondary/50 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-muted-foreground">{k}</p>
                          <p className="font-mono text-foreground">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Severity distribution */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <BarChart2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground">Distribution des Risques</span>
                  <div className="flex gap-1 ml-auto flex-wrap">
                    {["all", "critical", "high", "medium", "low", "info"].map(s => (
                      <button key={s} onClick={() => setFilterSev(s)}
                        className={cn("px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
                          filterSev === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                        {s === "all" ? "Tous" : SEV_CONFIG[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2 h-12">
                  {sevCounts.map(({ s, count }) => {
                    const max = Math.max(...sevCounts.map(x => x.count), 1);
                    const cfg = SEV_CONFIG[s];
                    return (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                        onClick={() => setFilterSev(filterSev === s ? "all" : s)}>
                        <span className={cn("text-[9px] font-mono font-bold", cfg.color)}>{count}</span>
                        <div className={cn("w-full rounded-t-sm transition-all", cfg.bar)}
                          style={{ height: count ? `${(count / max) * 36}px` : "2px", opacity: count ? 0.85 : 0.2 }} />
                        <span className="text-[8px] text-muted-foreground">{cfg.label.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Positive points */}
              {result.positive_points?.length > 0 && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-bold text-green-400">Points Positifs</span>
                  </div>
                  <ul className="space-y-1">
                    {result.positive_points.map((p, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-2">
                        <span className="text-green-400 shrink-0 mt-0.5">✓</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Audit notes */}
              {result.audit_notes && (
                <div className="bg-secondary/40 border border-border rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Notes d'Audit</p>
                  <p className="text-xs text-foreground leading-relaxed">{result.audit_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vulnerability list — full width */}
      {result && !scanning && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-bold text-foreground">
              Vulnérabilités Détectées
            </h3>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {filteredVulns.length} / {result.vulnerabilities?.length ?? 0}
            </Badge>
          </div>

          {filteredVulns.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-semibold">Aucune vulnérabilité pour ce filtre</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVulns.map((v, i) => (
                <VulnCard key={i} vuln={v} idx={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}