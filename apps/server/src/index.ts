/**
 * Coquille du backend Yidik Cloud (phase 0, doc 10 §3.3) : structure seule, aucune
 * fonctionnalite produit. Prouve que les paquets du workspace se consomment sous une
 * cible Node sans DOM ; Fastify, PostgreSQL et Redis arrivent au premier usage reel,
 * avec revue D7 (doc 10 §4).
 */
import type { SceneNode } from "@yidik/ast";
import { compareSiblings } from "@yidik/scene";

/** Ordre deterministe des identifiants d'un lot de noeuds (departage (order, id), D3). */
export function orderNodeIds(nodes: SceneNode[]): string[] {
  return [...nodes].sort(compareSiblings).map((node) => node.id);
}
