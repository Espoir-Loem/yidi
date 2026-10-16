/**
 * @yidik/scene - regles d'arbre pures du scenegraph (doc 04 §2, doc 10 §5).
 *
 * Aucun import d'Automerge ni d'API plateforme : ces regles restent testables
 * seules, et le departage d'ordre `(order, id)` est la decision D3 (doc 10 §2).
 */
import type { SceneNode } from "@yidik/ast";

/** Tri deterministe des freres : `(order, id)` (D3, doc 04 §2). */
export function compareSiblings(
  a: Pick<SceneNode, "order" | "id">,
  b: Pick<SceneNode, "order" | "id">,
): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Fausse si le noeud est une tombstone (`deleted`), D4 (doc 10 §2). */
export function isVisible(node: Pick<SceneNode, "deleted">): boolean {
  return node.deleted !== true;
}

/**
 * Enfants visibles d'un parent, tries `(order, id)`.
 * `parentId === null` designe la racine du document.
 */
export function childrenOf(
  nodes: Readonly<Record<string, SceneNode>>,
  parentId: string | null,
): SceneNode[] {
  const children: SceneNode[] = [];
  for (const node of Object.values(nodes)) {
    if (isVisible(node) && node.parentId === parentId) children.push(node);
  }
  return children.sort(compareSiblings);
}
