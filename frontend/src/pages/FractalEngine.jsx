import { Brain, Lock, GitBranch, Layers, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const classes = [
  {
    id: "node",
    title: "FractalMemoryNode.java",
    lang: "Java",
    tier: "Core",
    color: "text-accent",
    description: "Nœud atomique du graphe mémoire. Stocke fait, émotion, niveau fractal et vecteur de résonance.",
    code: `package nmemb.core;

import java.util.*;
import java.time.Instant;

/**
 * FractalMemoryNode — Unité atomique de mémoire.
 *
 * Chaque nœud encode :
 *   - un fait (concept)
 *   - son niveau fractal L0..L4
 *   - son intensité émotionnelle (emotionWeight)
 *   - son score de résonance (mise à jour par le moteur)
 *   - ses relations causales vers d'autres nœuds
 *   - son tier de mémoire (SHORT_TERM → SEALED)
 */
public final class FractalMemoryNode {

    // ── Identité ──────────────────────────────────────────
    public final String  id;
    public final String  concept;
    public final String  type;          // "EVENT" | "RELATION" | "ENTITY" | "PATTERN"
    public final Instant timestamp;

    // ── Niveaux fractals (L0..L4) ─────────────────────────
    public int     fractalLevel;        // 0 = événement brut, 4 = mémoire stratégique globale
    public String  parentId;            // nœud de niveau supérieur
    public String  contextId;           // contexte narratif / zone / faction

    // ── Poids sémantiques ─────────────────────────────────
    public double  localWeight;         // importance locale [0.0 – 1.0]
    public double  emotionWeight;       // charge émotionnelle [0.0 – 1.0]
    public double  strategicWeight;     // poids stratégique [0.0 – 1.0]
    public double  resonanceScore;      // calculé par ResonanceEngine

    // ── Relations causales ────────────────────────────────
    public List<FractalRelation> relations;

    // ── Tier mémoire ──────────────────────────────────────
    public MemoryTier tier;

    // ── Attributs libres ──────────────────────────────────
    public Map<String, String> attributes;

    // ── Constructeur principal ────────────────────────────
    public FractalMemoryNode(
        String  id,
        String  concept,
        String  type,
        int     fractalLevel,
        double  localWeight,
        double  emotionWeight,
        double  strategicWeight
    ) {
        this.id              = id;
        this.concept         = concept;
        this.type            = type;
        this.fractalLevel    = fractalLevel;
        this.timestamp       = Instant.now();
        this.localWeight     = localWeight;
        this.emotionWeight   = emotionWeight;
        this.strategicWeight = strategicWeight;
        this.resonanceScore  = 0.0;
        this.tier            = MemoryTier.SHORT_TERM;
        this.relations       = new ArrayList<>();
        this.attributes      = new HashMap<>();
    }

    // ── Accesseurs utiles ─────────────────────────────────

    /** Score composite servant à la décision de propagation */
    public double compositeScore() {
        return (localWeight * 0.3)
             + (emotionWeight   * 0.4)
             + (strategicWeight * 0.3);
    }

    /** Un nœud est critique s'il ne peut jamais être supprimé */
    public boolean isCritical() {
        return tier == MemoryTier.SEALED
            || emotionWeight   > 0.85
            || strategicWeight > 0.90;
    }

    @Override
    public String toString() {
        return String.format(
            "[L%d | %s] %s  (resonance=%.2f, tier=%s)",
            fractalLevel, type, concept, resonanceScore, tier
        );
    }
}`
  },
  {
    id: "relation",
    title: "FractalRelation.java",
    lang: "Java",
    tier: "Core",
    color: "text-primary",
    description: "Lien typé et pondéré entre deux nœuds. Supporte la directionnalité et le decay temporel.",
    code: `package nmemb.core;

import java.time.Instant;

/**
 * FractalRelation — Arc du graphe mémoire fractal.
 *
 * Chaque relation encode :
 *   - le type sémantique (RelationType)
 *   - un poids directionnel
 *   - un facteur de decay (affaiblissement dans le temps)
 *   - les identifiants source / cible
 */
public final class FractalRelation {

    public final String       id;
    public final String       sourceId;
    public final String       targetId;
    public final RelationType type;

    public double  weight;          // force du lien [0.0 – 1.0]
    public double  decayFactor;     // affaiblissement par propagation [0.5 – 1.0]
    public boolean bidirectional;

    public final Instant createdAt;

    public FractalRelation(
        String       id,
        String       sourceId,
        String       targetId,
        RelationType type,
        double       weight,
        boolean      bidirectional
    ) {
        this.id            = id;
        this.sourceId      = sourceId;
        this.targetId      = targetId;
        this.type          = type;
        this.weight        = weight;
        this.decayFactor   = 0.72;   // par défaut : decay fractal standard
        this.bidirectional = bidirectional;
        this.createdAt     = Instant.now();
    }

    /** Poids effectif après n sauts de propagation */
    public double effectiveWeight(int hops) {
        return weight * Math.pow(decayFactor, hops);
    }
}

// ── Types de relations (contrat figé) ────────────────────
enum RelationType {

    // Causales
    CAUSES,
    INFLUENCES,

    // Sociales
    CONFLICTS_WITH,
    COOPERATES_WITH,
    BETRAYS,
    PROTECTS,
    FEARS,

    // Cognitives
    REMEMBERS,
    INHERITS,
    EVOLVES_TO
}

// ── Tiers mémoire (contrat figé) ─────────────────────────
enum MemoryTier {
    SHORT_TERM,   // L0-L1 — événement récent
    ACTIVE,       // L2    — cluster narratif actif
    DEEP,         // L3    — branche de monde
    DORMANT,      //         archivé, réactivable
    SEALED        //         inviolable (audit, mort, trahison)
}`
  },
  {
    id: "propagation",
    title: "PropagationEngine.java",
    lang: "Java",
    tier: "Engine",
    color: "text-chart-2",
    description: "Moteur de propagation fractale. Diffuse l'impact d'un événement à travers le graphe mémoire via BFS pondéré.",
    code: `package nmemb.engine;

import nmemb.core.*;
import java.util.*;

/**
 * PropagationEngine — Diffusion fractale BFS pondérée.
 *
 * Algorithme :
 *   1. Part du nœud source (L0)
 *   2. Parcourt les relations par poids décroissant
 *   3. Applique le decay fractal à chaque saut
 *   4. S'arrête quand le poids résiduel < seuil minimal
 *   5. Consolide le MemoryTier de chaque nœud affecté
 */
public class PropagationEngine {

    private final Map<String, FractalMemoryNode> graph;
    private static final double MIN_THRESHOLD  = 0.05;
    private static final int    MAX_DEPTH      = 4;    // L0 → L4

    public PropagationEngine(Map<String, FractalMemoryNode> graph) {
        this.graph = graph;
    }

    // ── Point d'entrée principal ──────────────────────────

    /**
     * Propage l'impact d'un événement source dans le graphe.
     * @param sourceId  identifiant du nœud déclencheur
     * @param intensity force initiale de l'événement [0.0 – 1.0]
     * @return          liste des nœuds impactés avec leur delta
     */
    public List<PropagationResult> propagate(String sourceId, double intensity) {

        List<PropagationResult> results = new ArrayList<>();
        Queue<PropagationTask>  queue   = new PriorityQueue<>(
            Comparator.comparingDouble(t -> -t.currentWeight)  // poids décroissant
        );

        Set<String> visited = new HashSet<>();
        queue.add(new PropagationTask(sourceId, intensity, 0));

        while (!queue.isEmpty()) {

            PropagationTask task = queue.poll();

            if (visited.contains(task.nodeId))         continue;
            if (task.depth    >= MAX_DEPTH)            continue;
            if (task.currentWeight < MIN_THRESHOLD)    continue;

            visited.add(task.nodeId);

            FractalMemoryNode node = graph.get(task.nodeId);
            if (node == null)                          continue;

            // Mise à jour du score de résonance
            double delta = task.currentWeight * node.compositeScore();
            node.resonanceScore = Math.min(1.0, node.resonanceScore + delta);

            // Consolidation du tier
            consolidateTier(node);

            results.add(new PropagationResult(node.id, delta, task.depth));

            // Propagation aux voisins
            for (FractalRelation rel : node.relations) {

                if (visited.contains(rel.targetId)) continue;

                double nextWeight = rel.effectiveWeight(task.depth + 1);

                // Amplification si relation émotionnellement forte
                if (rel.type == RelationType.BETRAYS
                 || rel.type == RelationType.CONFLICTS_WITH) {
                    nextWeight *= 1.35;
                }

                queue.add(new PropagationTask(
                    rel.targetId,
                    nextWeight,
                    task.depth + 1
                ));
            }
        }

        return results;
    }

    // ── Consolidation mémoire ─────────────────────────────

    private void consolidateTier(FractalMemoryNode node) {
        if (node.isCritical()) {
            node.tier = MemoryTier.SEALED;
        } else if (node.resonanceScore > 0.75) {
            node.tier = MemoryTier.DEEP;
        } else if (node.resonanceScore > 0.45) {
            node.tier = MemoryTier.ACTIVE;
        } else if (node.resonanceScore > 0.15) {
            node.tier = MemoryTier.SHORT_TERM;
        } else {
            node.tier = MemoryTier.DORMANT;
        }
    }

    // ── Structures internes ───────────────────────────────

    private static class PropagationTask {
        String nodeId;
        double currentWeight;
        int    depth;

        PropagationTask(String nodeId, double weight, int depth) {
            this.nodeId        = nodeId;
            this.currentWeight = weight;
            this.depth         = depth;
        }
    }

    /** Résultat d'un nœud impacté par la propagation */
    public static class PropagationResult {
        public final String nodeId;
        public final double delta;
        public final int    depth;

        public PropagationResult(String nodeId, double delta, int depth) {
            this.nodeId = nodeId;
            this.delta  = delta;
            this.depth  = depth;
        }

        @Override
        public String toString() {
            return String.format(
                "Node[%s]  Δresonance=+%.3f  depth=L%d",
                nodeId, delta, depth
            );
        }
    }
}`
  },
  {
    id: "index",
    title: "MemoryIndex.java",
    lang: "Java",
    tier: "Index",
    color: "text-chart-4",
    description: "Index composite O(1) pour requêtes par niveau fractal, tier, concept et score de résonance.",
    code: `package nmemb.engine;

import nmemb.core.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * MemoryIndex — Structure d'indexation composite.
 *
 * Maintient 4 index parallèles pour accès O(1) / O(log n) :
 *   - par ID
 *   - par niveau fractal
 *   - par tier mémoire
 *   - par score de résonance (TreeMap trié)
 */
public class MemoryIndex {

    // Index primaire
    private final Map<String, FractalMemoryNode> byId
        = new HashMap<>();

    // Index par niveau fractal (L0..L4)
    private final Map<Integer, List<FractalMemoryNode>> byLevel
        = new HashMap<>();

    // Index par tier mémoire
    private final Map<MemoryTier, List<FractalMemoryNode>> byTier
        = new EnumMap<>(MemoryTier.class);

    // Index trié par résonance (requêtes top-K)
    private final TreeMap<Double, List<FractalMemoryNode>> byResonance
        = new TreeMap<>(Comparator.reverseOrder());

    // ── Insertion ─────────────────────────────────────────

    public void insert(FractalMemoryNode node) {
        byId.put(node.id, node);

        byLevel.computeIfAbsent(
            node.fractalLevel, k -> new ArrayList<>()
        ).add(node);

        byTier.computeIfAbsent(
            node.tier, k -> new ArrayList<>()
        ).add(node);

        byResonance.computeIfAbsent(
            node.resonanceScore, k -> new ArrayList<>()
        ).add(node);
    }

    // ── Requêtes ──────────────────────────────────────────

    public FractalMemoryNode getById(String id) {
        return byId.get(id);
    }

    public List<FractalMemoryNode> getByLevel(int level) {
        return byLevel.getOrDefault(level, Collections.emptyList());
    }

    public List<FractalMemoryNode> getByTier(MemoryTier tier) {
        return byTier.getOrDefault(tier, Collections.emptyList());
    }

    /** Top-K nœuds par score de résonance */
    public List<FractalMemoryNode> topK(int k) {
        return byResonance.values().stream()
            .flatMap(List::stream)
            .limit(k)
            .collect(Collectors.toList());
    }

    /** Nœuds candidats pour le GC (dormants, faible résonance) */
    public List<FractalMemoryNode> gcCandidates() {
        return getByTier(MemoryTier.DORMANT).stream()
            .filter(n -> n.resonanceScore < 0.10)
            .filter(n -> !n.isCritical())
            .collect(Collectors.toList());
    }

    public int size() { return byId.size(); }
}`
  }
];

export default function FractalEngine() {
  const [expanded, setExpanded] = useState({ node: true, relation: false, propagation: false, index: false });
  const [copied, setCopied] = useState(null);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const copyCode = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    toast.success("Code copié");
    setTimeout(() => setCopied(null), 2000);
  };

  const tierStyle = { Core: "border-accent/30 text-accent", Engine: "border-chart-2/30 text-chart-2", Index: "border-chart-4/30 text-chart-4" };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Fractal Memory Engine</h2>
          <p className="text-sm text-muted-foreground mt-1">Squelette Java — N-MEM-B Core · Architecture Verrouillée</p>
        </div>
        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
          <Lock className="h-3 w-3 mr-1" />
          FIGÉ v1.0
        </Badge>
      </div>

      {/* Architecture Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Classes Core", value: "4", icon: Brain, color: "text-accent" },
          { label: "Niveaux Fractals", value: "L0 → L4", icon: Layers, color: "text-primary" },
          { label: "Types Relations", value: "10", icon: GitBranch, color: "text-chart-2" },
          { label: "Complexité Prop.", value: "O(E·log V)", icon: Lock, color: "text-chart-4" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold text-foreground font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Classes */}
      <div className="space-y-3">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Class Header */}
            <button
              onClick={() => toggle(cls.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                  <Brain className={`h-4 w-4 ${cls.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-foreground">{cls.title}</span>
                    <Badge variant="outline" className={cn("text-[10px]", tierStyle[cls.tier])}>{cls.tier}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cls.description}</p>
                </div>
              </div>
              {expanded[cls.id]
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            </button>

            {/* Code Block */}
            {expanded[cls.id] && (
              <div className="border-t border-border relative">
                <button
                  onClick={() => copyCode(cls.id, cls.code)}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors"
                >
                  {copied === cls.id
                    ? <><Check className="h-3 w-3 text-green-400" /> Copié</>
                    : <><Copy className="h-3 w-3" /> Copier</>
                  }
                </button>
                <pre className="bg-background p-5 pr-20 overflow-x-auto text-xs font-mono text-foreground leading-relaxed max-h-[520px] overflow-y-auto">
                  <code>{cls.code}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dependency Map */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Dépendances inter-classes</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {[
            { from: "MemoryIndex", to: "FractalMemoryNode", label: "indexe" },
            { from: "PropagationEngine", to: "FractalMemoryNode", label: "parcourt" },
            { from: "PropagationEngine", to: "FractalRelation", label: "lit" },
            { from: "PropagationEngine", to: "MemoryIndex", label: "requête" },
          ].map((dep, i) => (
            <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
              <span className="text-accent">{dep.from}</span>
              <span className="text-muted-foreground">→ {dep.label} →</span>
              <span className="text-primary">{dep.to}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}