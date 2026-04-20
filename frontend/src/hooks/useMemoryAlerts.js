import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Surveille en temps réel :
 *  - MemoryNode : résonance > 0.9 → alerte critique
 *  - AuditEvent : type === "PRUNE" → alerte élagage
 */
export function useMemoryAlerts() {
  // Garde une trace des nœuds déjà alertés pour éviter les doublons
  const alertedNodes = useRef(new Set());

  useEffect(() => {
    const unsubNode = base44.entities.MemoryNode.subscribe((event) => {
      if (event.type === "create" || event.type === "update") {
        const node = event.data;
        const key = `${node.node_id}-${Math.floor((node.resonance ?? 0) * 10)}`;

        if ((node.resonance ?? 0) >= 0.9 && !alertedNodes.current.has(key)) {
          alertedNodes.current.add(key);
          toast.error(`⚠ Résonance Critique`, {
            description: `${node.concept} (L${node.fractal_level}) — ${(node.resonance * 100).toFixed(0)}% · Tier: ${node.tier}`,
            duration: 6000,
            position: "top-right",
          });
        }
      }
    });

    const unsubAudit = base44.entities.AuditEvent.subscribe((event) => {
      if (event.type === "create" && event.data?.type === "PRUNE") {
        const audit = event.data;
        toast.warning(`✂ Élagage Mémoire`, {
          description: `${audit.concept} (L${audit.fractal_level}) supprimé — ${audit.trigger}`,
          duration: 5000,
          position: "top-right",
        });
      }

      if (event.type === "create" && event.data?.type === "TIER_CHANGE") {
        const audit = event.data;
        if (audit.tier_to === "SEALED") {
          toast.info(`🔒 Nœud Scellé`, {
            description: `${audit.concept} → SEALED · ${audit.trigger}`,
            duration: 5000,
            position: "top-right",
          });
        }
      }
    });

    return () => {
      unsubNode();
      unsubAudit();
    };
  }, []);
}