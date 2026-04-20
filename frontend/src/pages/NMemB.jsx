import { Brain, GitBranch, Layers, Zap, Archive, RefreshCw, Lock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

const codeSnippets = {
  java: {
    label: "Java — Orchestration",
    color: "text-accent",
    code: `package nmemb.core;

import java.util.*;

public final class FractalMemoryNode {
    public String  id;
    public String  concept;
    public String  type;
    public long    timestamp;
    public long    lastActivated;    // epoch ms — pour decay temporel

    public double  localWeight;
    public double  resonanceScore;
    public int     fractalLevel;     // L0 → L4

    public String  contextId;
    public String  parentId;

    public List<String>        relationIds;
    public Map<String, String> attributes;

    /** Decay factor basé sur le niveau fractal.
     *  Plus le niveau est élevé, plus la propagation est lente.
     *  L0 = 0.95 (rapide), L4 = 0.55 (très amorti) */
    public double fractalDecay() {
        return 0.95 - (fractalLevel * 0.10);
    }

    /** Seuil de propagation par niveau fractal.
     *  L0 = 0.05 (permissif), L4 = 0.45 (strict) */
    public double propagationThreshold() {
        return 0.05 + (fractalLevel * 0.10);
    }

    /** Résonance ajustée selon le temps écoulé depuis la
     *  dernière activation (decay temporel). */
    public double decayedResonance(long nowMs) {
        long   ageMs   = nowMs - lastActivated;
        double ageDays = ageMs / 86_400_000.0;
        double k       = 0.02 * (fractalLevel + 1); // L0 lent, L4 rapide
        return resonanceScore * Math.exp(-k * ageDays);
    }

    /** Un nœud est élagable si sa résonance décayée est
     *  sous le seuil et qu'il n'est pas critique. */
    public boolean isPrunable(long nowMs) {
        return !isCritical()
            && decayedResonance(nowMs) < propagationThreshold();
    }

    public boolean isCritical() {
        return tier == MemoryTier.SEALED
            || resonanceScore > 0.85;
    }
}

// ── Relation Types ──────────────────────────────────────
public enum RelationType {
    CAUSES, INFLUENCES, CONFLICTS_WITH,
    COOPERATES_WITH, BETRAYS, INHERITS,
    EVOLVES_TO, REMEMBERS, FEARS, PROTECTS
}

// ── Memory Tiers ────────────────────────────────────────
public enum MemoryTier {
    SHORT_TERM, ACTIVE, DEEP, DORMANT, SEALED
}`
  },
  cpp: {
    label: "C++ — Propagation Avancée",
    color: "text-primary",
    code: `// nmemb/resonance_engine.hpp
#pragma once
#include <unordered_map>
#include <vector>
#include <queue>
#include <cmath>
#include <chrono>

class ResonanceEngine {

    using NodeId = std::string;

    struct Edge {
        NodeId  target;
        double  weight;
        int     relationType;
    };

    struct PropTask {
        NodeId nodeId;
        double currentWeight;
        int    depth;
        bool operator>(const PropTask& o) const {
            return currentWeight < o.currentWeight; // max-heap
        }
    };

    std::unordered_map<NodeId, std::vector<Edge>> graph;
    std::unordered_map<NodeId, double>            resonance;
    std::unordered_map<NodeId, long long>         lastActivated;
    std::unordered_map<NodeId, int>               fractalLevel;

public:

    // ── 1. Decay fractal par niveau ───────────────────────
    double fractalDecay(const NodeId& id) const {
        int lvl = fractalLevel.count(id) ? fractalLevel.at(id) : 0;
        return 0.95 - lvl * 0.10;  // L0=0.95 … L4=0.55
    }

    // ── 2. Seuil de propagation par niveau fractal ────────
    double threshold(const NodeId& id) const {
        int lvl = fractalLevel.count(id) ? fractalLevel.at(id) : 0;
        return 0.05 + lvl * 0.10;  // L0=0.05 … L4=0.45
    }

    // ── 3. Propagation BFS pondérée + seuils ─────────────
    void propagate(const NodeId& source, double intensity) {

        std::priority_queue<PropTask,
            std::vector<PropTask>,
            std::greater<PropTask>> pq;

        std::unordered_set<NodeId> visited;
        pq.push({source, intensity, 0});

        while (!pq.empty()) {
            auto [nodeId, w, depth] = pq.top(); pq.pop();

            if (visited.count(nodeId)) continue;
            if (depth >= 4)            continue;

            // Seuil strict par niveau — bloque si trop faible
            if (w < threshold(nodeId))  continue;

            visited.insert(nodeId);
            resonance[nodeId] = std::min(1.0,
                resonance[nodeId] + w);
            lastActivated[nodeId] = now();

            double decay = fractalDecay(nodeId);

            for (auto& edge : graph[nodeId]) {
                if (!visited.count(edge.target)) {
                    pq.push({
                        edge.target,
                        w * edge.weight * decay,
                        depth + 1
                    });
                }
            }
        }
    }

    // ── 4. Decay temporel de résonance ────────────────────
    void applyTemporalDecay() {
        long long nowMs = now();
        for (auto& [id, score] : resonance) {
            int    lvl    = fractalLevel.count(id) ? fractalLevel.at(id) : 0;
            double ageDays = (nowMs - lastActivated[id]) / 86400000.0;
            double k       = 0.02 * (lvl + 1);
            score = score * std::exp(-k * ageDays);
        }
    }

private:
    long long now() const {
        using namespace std::chrono;
        return duration_cast<milliseconds>(
            system_clock::now().time_since_epoch()
        ).count();
    }
};`
  },
  python: {
    label: "Python — Pruning & GC",
    color: "text-chart-2",
    code: `# nmemb/memory_gc.py
import math, time

class SecureGarbageCollector:
    """
    GC avec élagage intelligent.
    Classe chaque nœud avant action.
    Ne supprime jamais un nœud critique ou SEALED.
    """

    SEALED_TAGS = {
        "justice", "économie", "sécurité",
        "trahison", "mort", "événement_majeur"
    }

    # ── 3. Decay temporel de résonance ─────────────────
    def decayed_resonance(self, node: dict) -> float:
        """Résonance ajustée par le temps et le niveau fractal."""
        age_days = (time.time() - node["lastActivated"]) / 86400
        k        = 0.02 * (node["fractalLevel"] + 1)
        return node["resonanceScore"] * math.exp(-k * age_days)

    # ── 2. Seuil de propagation par niveau fractal ──────
    def propagation_threshold(self, node: dict) -> float:
        return 0.05 + node["fractalLevel"] * 0.10

    # ── 4. Élagage (pruning) des branches faibles ───────
    def prune_branch(self, node: dict, graph: dict) -> list:
        """
        Élague récursivement les descendants d'un nœud
        dont la résonance décayée est sous seuil.
        Retourne les IDs supprimés.
        """
        pruned = []

        for child_id in node.get("relationIds", []):
            child = graph.get(child_id)
            if not child:
                continue

            dr = self.decayed_resonance(child)
            th = self.propagation_threshold(child)

            if dr < th and not self._is_critical(child):
                pruned.append(child_id)
                pruned.extend(self.prune_branch(child, graph))

        for pid in pruned:
            graph.pop(pid, None)

        return pruned

    def _is_critical(self, node: dict) -> bool:
        return (
            node.get("tier") == "SEALED"
            or any(t in node.get("tags", []) for t in self.SEALED_TAGS)
            or node["resonanceScore"] > 0.85
        )

    def classify(self, node: dict) -> str:
        dr = self.decayed_resonance(node)
        th = self.propagation_threshold(node)

        if self._is_critical(node):  return "ARCHIVE_SEALED"
        if dr < th * 0.5:            return "DELETE"
        if dr < th:                  return "COMPRESS"
        return "RETAIN"

    def run_cycle(self, graph: dict):
        """Cycle GC complet sur le graphe mémoire."""
        for node in list(graph.values()):
            match self.classify(node):
                case "ARCHIVE_SEALED":
                    MemoryAuditTrail.seal(node)
                case "DELETE":
                    pruned = self.prune_branch(node, graph)
                    graph.pop(node["id"], None)
                case "COMPRESS":
                    MemoryCompressor.compress(node)`
  }
};

const advancedMechanisms = [
  {
    num: "01",
    title: "Decay Fractal",
    desc: "Facteur d'amortissement lié au niveau fractal. L0 = 0.95 (rapide), L4 = 0.55 (très amorti). Plus le niveau est profond, plus la propagation est freinée.",
    formula: "decay = 0.95 − (fractalLevel × 0.10)",
    color: "text-accent",
    border: "border-accent/30",
  },
  {
    num: "02",
    title: "Seuils de Propagation",
    desc: "Chaque nœud possède un seuil minimal de poids. Un signal trop faible est bloqué avant d'inonder les niveaux inférieurs.",
    formula: "threshold = 0.05 + (fractalLevel × 0.10)",
    color: "text-primary",
    border: "border-primary/30",
  },
  {
    num: "03",
    title: "Resonance Decay Temporel",
    desc: "Les nœuds non réactivés perdent de la résonance exponentiellement. Le taux de déclin k augmente avec le niveau fractal.",
    formula: "resonance(t) = R₀ × e^(−k·t)  où k = 0.02 × (lvl+1)",
    color: "text-chart-2",
    border: "border-chart-2/30",
  },
  {
    num: "04",
    title: "Pruning des Branches Faibles",
    desc: "Les branches dont la résonance décayée est sous seuil sont élaguées récursivement. Les nœuds SEALED et critiques sont immunisés.",
    formula: "prune si decayedResonance(node) < threshold(node) && !isCritical()",
    color: "text-chart-4",
    border: "border-chart-4/30",
  },
];

const pipeline = [
  { step: "01", title: "Capture", desc: "Événement brut : dialogue, combat, alliance, crise, mutation", icon: Zap, color: "text-accent" },
  { step: "02", title: "Encodage Fractal", desc: "Nœud principal + sous-nœuds contextuels + relations causales + score propagation", icon: GitBranch, color: "text-primary" },
  { step: "03", title: "Propagation", desc: "Local → groupe/faction → macro (économie, guerre, écologie)", icon: Layers, color: "text-chart-2" },
  { step: "04", title: "Consolidation", desc: "Court terme → Actif → Profond → Dormant → Archivé", icon: Archive, color: "text-chart-4" },
  { step: "05", title: "Réactivation", desc: "Pattern matching → précédents historiques → risques → opportunités", icon: RefreshCw, color: "text-chart-5" },
];

const fractalLevels = [
  { level: "L0", name: "Événement Brut", desc: "Fait atomique horodaté", color: "border-primary/40 text-primary" },
  { level: "L1", name: "Relation Locale", desc: "Lien direct entre acteurs", color: "border-accent/40 text-accent" },
  { level: "L2", name: "Cluster Narratif", desc: "Social / Biologique / Politique", color: "border-chart-2/40 text-chart-2" },
  { level: "L3", name: "Branche de Monde", desc: "Faction, région, écosystème", color: "border-chart-4/40 text-chart-4" },
  { level: "L4", name: "Mémoire Stratégique", desc: "Historique global du monde", color: "border-chart-5/40 text-chart-5" },
];

const propagationRules = [
  { trigger: "Trahison locale + score émotionnel fort + faction", result: "Propagation → réputation de faction", level: "L1 → L2" },
  { trigger: "Fraude répétée + secteur économique critique", result: "Propagation → stabilité économique régionale", level: "L2 → L3" },
  { trigger: "Mutation biologique rare + environnement instable", result: "Propagation → écologie globale", level: "L3 → L4" },
];

const lockedClasses = [
  "FractalMemoryNode",
  "FractalRelation",
  "ResonanceEngine",
  "MemoryCompressor",
  "MemoryAuditTrail",
  "ContextPortalIndex",
];

export default function NMemB() {
  const [activeTab, setActiveTab] = useState("java");

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">N-MEM-B</h2>
          <p className="text-sm text-muted-foreground mt-1">Mémoire Fractale du Monde Vivant — Architecture Verrouillée</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <Lock className="h-3 w-3 mr-1" />
            ARCHITECTURE VERROUILLÉE
          </Badge>
        </div>
      </div>

      {/* Concept Banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 animate-float">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground mb-1">Principe Fondamental</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Chaque événement du monde est stocké comme un <span className="text-foreground font-medium">fait</span>, une <span className="text-foreground font-medium">relation</span>, une <span className="text-foreground font-medium">trace temporelle</span>, une <span className="text-foreground font-medium">intensité de résonance</span> et un <span className="text-foreground font-medium">niveau fractal</span>.
              Le joueur change le monde — <span className="text-primary font-semibold">le monde réécrit le joueur.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Fractal Levels */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Niveaux Fractals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {fractalLevels.map((fl) => (
            <div key={fl.level} className={cn("bg-card border rounded-xl p-4", fl.color.includes("primary") ? "border-primary/30" : fl.color.includes("accent") ? "border-accent/30" : "border-border")}>
              <div className={cn("text-2xl font-black font-mono mb-1", fl.color.split(" ")[1])}>{fl.level}</div>
              <p className="text-xs font-semibold text-foreground">{fl.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fl.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline Cognitif</h3>
        <div className="space-y-2">
          {pipeline.map((step, i) => (
            <div key={step.step} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-mono text-muted-foreground shrink-0">{step.step}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
              {i < pipeline.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Propagation Rules + Locked Classes — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Règles de Propagation</h3>
          <div className="space-y-3">
            {propagationRules.map((rule, i) => (
              <div key={i} className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{rule.level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1"><span className="text-accent font-mono">SI</span> {rule.trigger}</p>
                <p className="text-xs text-foreground"><span className="text-chart-2 font-mono">→</span> {rule.result}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Classes Verrouillées</h3>
          </div>
          <div className="space-y-2">
            {lockedClasses.map((cls) => (
              <div key={cls} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-4 py-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-sm font-mono text-foreground">{cls}</span>
                <Badge variant="outline" className="ml-auto text-[10px] border-green-500/20 text-green-400">FIGÉ</Badge>
              </div>
            ))}
          </div>

          {/* Pont A/B */}
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Pont N-MEM-A ↔ N-MEM-B</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="bg-secondary px-2 py-1 rounded font-mono">N-MEM-A</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-primary">propagation</span>
              <ArrowRight className="h-3 w-3" />
              <span className="bg-secondary px-2 py-1 rounded font-mono">N-MEM-B</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Rétroaction du monde vers le joueur activée</p>
          </div>
        </div>
      </div>

      {/* Mécanismes Avancés */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Mécanismes de Propagation Avancés</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {advancedMechanisms.map((m) => (
            <div key={m.num} className={cn("bg-card border rounded-xl p-4", m.border)}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-mono font-bold ${m.color}`}>{m.num}</span>
                <h4 className={`text-sm font-bold ${m.color}`}>{m.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{m.desc}</p>
              <div className="bg-background rounded-lg px-3 py-2">
                <code className={`text-[11px] font-mono ${m.color}`}>{m.formula}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Trilingue */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Implémentation Technique Verrouillée</h3>

        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.entries(codeSnippets).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all",
                activeTab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {val.label}
            </button>
          ))}
        </div>

        <pre className="bg-background rounded-xl p-5 overflow-x-auto text-xs font-mono text-foreground border border-border leading-relaxed max-h-[480px] overflow-y-auto">
          <code>{codeSnippets[activeTab].code}</code>
        </pre>
      </div>
    </div>
  );
}