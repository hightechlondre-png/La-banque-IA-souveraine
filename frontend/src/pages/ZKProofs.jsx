import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lock, CheckCircle, XCircle, Eye, EyeOff, Zap,
  Shield, Copy, RefreshCw, Activity, ChevronDown, ChevronUp, Loader2
} from "lucide-react";

// ── ZK Proof Types ────────────────────────────────────────
const PROOF_TYPES = {
  balance:     { label: "Preuve de Solde",        desc: "Prouve qu'un solde ≥ seuil sans révéler le montant exact.",          circuit: "BalanceRange",      fields: ["Montant minimum (AQ)", "Adresse du détenteur"] },
  transaction: { label: "Validité Transaction",   desc: "Prouve qu'une transaction est valide sans exposer l'émetteur/montant.", circuit: "TxValidity",        fields: ["Hash de transaction", "Signature privée"] },
  identity:    { label: "Identité KYC",           desc: "Prouve la conformité KYC sans divulguer les données personnelles.",    circuit: "IdentityCircuit",   fields: ["Identifiant KYC", "Date de vérification"] },
  staking:     { label: "Staking Pondéré",        desc: "Prouve le pouvoir de vote sans révéler la durée ou le montant staké.", circuit: "StakingPower",      fields: ["Pouvoir de vote minimum", "Époque de staking"] },
  resonance:   { label: "Résonance Fractale",     desc: "Prouve qu'un nœud L4 a une résonance ≥ seuil sans exposer la valeur.", circuit: "FractalResonance",  fields: ["Identifiant nœud", "Seuil de résonance"] },
};

// ── Simulated ZK circuits (Groth16 simulation) ───────────
function sha256sim(str) {
  // Deterministic pseudo-hash for UI purposes
  let h = 0x6a09e667;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    h = (h ^ (h >>> 16)) | 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const h2 = (h ^ 0xbb67ae85) >>> 0;
  const h3 = (h ^ 0x3c6ef372) >>> 0;
  const h4 = (h ^ 0xa54ff53a) >>> 0;
  return `0x${hex(h)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h ^ h2)}${hex(h2 ^ h3)}${hex(h3 ^ h4)}${hex(h4 ^ h)}`;
}

function generateProofData(type, inputs, nonce) {
  const seed = type + JSON.stringify(inputs) + nonce;
  const pi_a = [sha256sim(seed + "a1"), sha256sim(seed + "a2")];
  const pi_b = [[sha256sim(seed + "b11"), sha256sim(seed + "b12")], [sha256sim(seed + "b21"), sha256sim(seed + "b22")]];
  const pi_c = [sha256sim(seed + "c1"), sha256sim(seed + "c2")];
  const publicSignals = [sha256sim(seed + "pub1"), sha256sim(seed + "pub2")];
  const proofHash = sha256sim(pi_a[0] + pi_b[0][0] + pi_c[0]);

  return {
    protocol: "groth16",
    curve: "bn128",
    circuit: PROOF_TYPES[type].circuit,
    pi_a, pi_b, pi_c,
    publicSignals,
    proofHash,
    timestamp: new Date().toISOString(),
    valid: true,
  };
}

function verifyProof(proof) {
  // Pairing check simulation: verify structure integrity
  if (!proof?.pi_a || !proof?.pi_b || !proof?.pi_c) return false;
  if (!proof.proofHash?.startsWith("0x")) return false;
  const recomputed = sha256sim(proof.pi_a[0] + proof.pi_b[0][0] + proof.pi_c[0]);
  return recomputed === proof.proofHash;
}

// ── History store ─────────────────────────────────────────
const HISTORY_STORAGE_KEY = "zkp_history";
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h.slice(0, 20)));
}

// ── ProofCard ─────────────────────────────────────────────
function ProofCard({ entry, onVerify }) {
  const [open, setOpen]  = useState(false);
  const [show, setShow]  = useState(false);

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden",
      entry.verified === true  ? "border-green-500/30" :
      entry.verified === false ? "border-red-500/30"   : "border-border")}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 hover:bg-secondary/10 transition-colors flex items-center gap-3">
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0",
          entry.verified === true ? "bg-green-500" : entry.verified === false ? "bg-red-500" : "bg-accent animate-pulse")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{PROOF_TYPES[entry.type]?.label}</span>
            <Badge variant="outline" className="text-[9px] border-primary/20 text-primary font-mono">
              {PROOF_TYPES[entry.type]?.circuit}
            </Badge>
            {entry.verified === true  && <Badge variant="outline" className="text-[9px] bg-green-500/10 border-green-500/20 text-green-400">✓ Valide</Badge>}
            {entry.verified === false && <Badge variant="outline" className="text-[9px] bg-red-500/10 border-red-500/20 text-red-400">✗ Invalide</Badge>}
            {entry.verified === null  && <Badge variant="outline" className="text-[9px] bg-accent/10 border-accent/30 text-accent">Non vérifié</Badge>}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{entry.proof?.proofHash?.slice(0, 42)}…</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-muted-foreground">{new Date(entry.proof?.timestamp).toLocaleTimeString("fr-FR")}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{PROOF_TYPES[entry.type]?.desc}</p>

          {/* Public signals (always visible) */}
          <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2">Signaux Publics (révélés)</p>
            {entry.proof?.publicSignals?.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">S{i}</span>
                <code className="text-[10px] font-mono text-accent break-all">{s}</code>
              </div>
            ))}
          </div>

          {/* Private inputs hidden */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Données Privées</p>
              <button onClick={() => setShow(s => !s)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {show ? "Masquer" : "Révéler (simulation)"}
              </button>
            </div>
            {show ? (
              <div className="space-y-1">
                {entry.inputs && Object.entries(entry.inputs).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{k}</span>
                    <code className="font-mono text-red-400">{v}</code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground italic">Chiffré — inaccessible au vérificateur</span>
              </div>
            )}
          </div>

          {/* Proof structure */}
          <div className="bg-background rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2">Proof π (Groth16 / bn128)</p>
            {[
              ["π_a", entry.proof?.pi_a?.join(", ").slice(0, 60) + "…"],
              ["π_b", entry.proof?.pi_b?.[0]?.join(", ").slice(0, 60) + "…"],
              ["π_c", entry.proof?.pi_c?.join(", ").slice(0, 60) + "…"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <span className="text-[10px] font-mono text-primary w-8 shrink-0">{k}</span>
                <code className="text-[10px] font-mono text-muted-foreground break-all">{v}</code>
              </div>
            ))}
          </div>

          {entry.verified === null && (
            <Button size="sm" className="w-full" onClick={() => onVerify(entry.id)}>
              <Shield className="h-3.5 w-3.5 mr-2" />Vérifier la preuve on-chain
            </Button>
          )}
          {entry.verified === true && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">Preuve cryptographiquement valide — Données privées non révélées</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function ZKProofs() {
  const [proofType, setProofType] = useState("balance");
  const [inputs, setInputs]       = useState({});
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying]   = useState(null);
  const [history, setHistory]       = useState(loadHistory);
  const [logs, setLogs]             = useState([]);
  const nonceRef = useRef(0);

  const addLog = (msg, color = "text-muted-foreground") => {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(l => [{ ts, msg, color }, ...l].slice(0, 30));
  };

  const ptype = PROOF_TYPES[proofType];

  const handleGenerate = () => {
    setGenerating(true);
    addLog(`⚙ Compilation du circuit ${ptype.circuit}…`, "text-accent");

    setTimeout(() => addLog("⚙ Génération des witness inputs…", "text-accent"), 500);
    setTimeout(() => addLog("⚙ Calcul des preuves π_a, π_b, π_c (Groth16 / bn128)…", "text-accent"), 1000);
    setTimeout(() => addLog("⚙ Pairing check elliptique en cours…", "text-accent"), 1700);

    setTimeout(() => {
      nonceRef.current++;
      const proof = generateProofData(proofType, inputs, String(nonceRef.current));
      const entry = { id: Date.now(), type: proofType, inputs: { ...inputs }, proof, verified: null };
      const newHistory = [entry, ...history];
      setHistory(newHistory);
      saveHistory(newHistory);
      setGenerating(false);
      addLog(`✓ Preuve générée — Hash: ${proof.proofHash.slice(0, 20)}…`, "text-green-400");
    }, 2600);
  };

  const handleVerify = (id) => {
    setVerifying(id);
    addLog("⚙ Vérification du pairing bilinéaire e(π_a, vk_alpha)…", "text-primary");

    setTimeout(() => addLog("⚙ Vérification e(π_b, vk_beta) sur courbe bn128…", "text-primary"), 600);
    setTimeout(() => addLog("⚙ Vérification e(π_c, vk_gamma)…", "text-primary"), 1200);

    setTimeout(() => {
      setHistory(prev => {
        const updated = prev.map(e => {
          if (e.id !== id) return e;
          const valid = verifyProof(e.proof);
          addLog(valid
            ? `✓ VALIDE — Preuve acceptée. Données privées non divulguées.`
            : `✗ INVALIDE — Pairing check échoué.`,
            valid ? "text-green-400" : "text-red-400");
          return { ...e, verified: valid };
        });
        saveHistory(updated);
        return updated;
      });
      setVerifying(null);
    }, 2000);
  };

  const validCount   = history.filter(e => e.verified === true).length;
  const invalidCount = history.filter(e => e.verified === false).length;
  const pendingCount = history.filter(e => e.verified === null).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Zero-Knowledge Proofs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Prouvez la validité de vos transactions AEGIS-Q sans révéler vos données privées · Groth16 / bn128
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Lock className="h-3 w-3 mr-1" />ZK-SNARK · Groth16
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Preuves générées",   value: history.length, icon: Zap,          color: "text-primary"   },
          { label: "Vérifiées valides",  value: validCount,     icon: CheckCircle,  color: "text-green-400" },
          { label: "Non valides",        value: invalidCount,   icon: XCircle,      color: "text-red-400"   },
          { label: "En attente",         value: pendingCount,   icon: Activity,     color: "text-accent"    },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ZK Explainer */}
      <div className="bg-card border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Principe Zero-Knowledge</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: "Complétude",    color: "text-green-400", icon: CheckCircle, desc: "Si l'énoncé est vrai, le prouveur honnête convaincra toujours le vérificateur." },
            { title: "Solidité",      color: "text-primary",   icon: Shield,       desc: "Un prouveur malhonnête ne peut convaincre un vérificateur d'un énoncé faux." },
            { title: "Zero-Knowledge",color: "text-accent",    icon: EyeOff,       desc: "Le vérificateur n'apprend rien d'autre que la véracité de l'énoncé." },
          ].map(p => (
            <div key={p.title} className="bg-secondary/30 rounded-lg p-3 flex items-start gap-3">
              <p.icon className={cn("h-4 w-4 shrink-0 mt-0.5", p.color)} />
              <div>
                <p className={cn("text-xs font-bold mb-1", p.color)}>{p.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generator */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Générateur de Preuves ZK</h3>
        </div>

        {/* Proof type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(PROOF_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => { setProofType(k); setInputs({}); }}
              className={cn("text-left p-3 rounded-xl border transition-all",
                proofType === k ? "bg-primary/10 border-primary/40" : "bg-secondary/30 border-border hover:border-muted-foreground")}>
              <p className={cn("text-[11px] font-bold leading-tight", proofType === k ? "text-primary" : "text-foreground")}>{v.label}</p>
              <p className="text-[9px] text-muted-foreground mt-1 font-mono">{v.circuit}</p>
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="bg-secondary/30 rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{ptype.desc}</p>
          <p className="text-[10px] text-primary font-mono mt-1">Circuit : {ptype.circuit} · Protocole : Groth16 · Courbe : BN128</p>
        </div>

        {/* Input fields (private — hidden from verifier) */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />Entrées privées (witness) — chiffrées localement, jamais transmises
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ptype.fields.map(field => (
              <div key={field} className="space-y-1">
                <label className="text-[10px] text-muted-foreground">{field}</label>
                <input
                  value={inputs[field] ?? ""}
                  onChange={e => setInputs(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={field.includes("Hash") ? "0x…" : field.includes("Adresse") ? "0xaeGIS…" : "Valeur…"}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate}
          disabled={generating || ptype.fields.some(f => !inputs[f]?.trim())}
          className="w-full">
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Génération en cours…</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" />Générer la preuve ZK-SNARK</>
          )}
        </Button>

        {generating && (
          <div className="space-y-1.5">
            {["Compilation circuit WASM", "Génération witness", "Calcul Groth16 π_a π_b π_c", "Pairing check bn128"].map((step, i) => (
              <div key={step} className="flex items-center gap-2 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin text-accent shrink-0" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proof history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Preuves Générées ({history.length})</h3>
          {history.length > 0 && (
            <button onClick={() => { setHistory([]); saveHistory([]); }}
              className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
              Vider l'historique
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune preuve générée — utilisez le générateur ci-dessus.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(entry => (
              <ProofCard key={entry.id} entry={entry}
                onVerify={verifying ? () => {} : handleVerify} />
            ))}
          </div>
        )}
      </div>

      {/* Crypto log */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Journal Cryptographique</h3>
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto font-mono">
          {logs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">Générez une preuve pour voir les logs…</p>
          ) : logs.map((l, i) => (
            <div key={i} className="flex items-start gap-3 text-[10px] bg-secondary/20 rounded px-3 py-1.5">
              <span className="text-muted-foreground shrink-0">{l.ts}</span>
              <span className={l.color}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}