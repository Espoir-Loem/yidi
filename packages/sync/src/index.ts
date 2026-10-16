/**
 * @yidik/sync - document Automerge du scenegraph (decisions D1-D5, doc 10 §5-6).
 *
 * Seule dependance runtime externe autorisee des paquets (doc 10 §4).
 * Discipline API Automerge 3.5 : `change()` et `merge()` consomment les
 * documents passes - les enveloppes clonent quand c'est necessaire et
 * retournent toujours le nouveau document. Ne reutilisez pas les entrees
 * apres un appel : reprenez la valeur retournee.
 */

import type { Doc, SyncMessage, SyncState } from "@automerge/automerge";
import * as A from "@automerge/automerge";
import type { SceneDocumentShape, SceneNode } from "@yidik/ast";
import { SCHEMA_VERSION } from "@yidik/ast";

export type SceneDoc = Doc<SceneDocumentShape>;

/** Egalite profonde de valeurs JSON simples (objets, tableaux, primitives). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameValue(item, b[index]))
    );
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/**
 * Cree le document scenegraph **d'origine** d'un projet (schema versionne,
 * doc 02 §1). Un document n'a qu'une origine : les replicas derivent d'elle
 * par clone, `save()`/`load()` ou synchronisation - jamais par un second
 * appel a `createSceneDocument()` (deux origines fusionnees entrent en
 * conflit au niveau de la carte racine ; test dedie dans la suite).
 */
export function createSceneDocument(): SceneDoc {
  return A.from<SceneDocumentShape>({ schemaVersion: SCHEMA_VERSION, nodes: {} });
}

/**
 * Replica vierge, sans origine locale : point de depart d'un pair qui rejoint
 * un document existant par synchronisation. A ne pas confondre avec
 * `createSceneDocument()`, qui cree l'origine du document.
 */
export function createEmptyReplica(): SceneDoc {
  return A.init<SceneDocumentShape>();
}

/**
 * Insere un noeud s'il est absent ; sinon met a jour **champ par champ** les
 * proprietes fournies (les autres sont conservees), et **uniquement celles qui
 * changent** : un champ re-fourni a l'identique n'ecrit aucune operation, ce
 * qui evite des conflits fantomes sur des champs non touches (doc 04 §2 : les
 * attributs sont des registres independants). Les valeurs `undefined` sont
 * ignorees.
 */
export function upsertNode(doc: SceneDoc, node: SceneNode): SceneDoc {
  return A.change(doc, (draft) => {
    const existing = draft.nodes[node.id];
    if (existing === undefined) {
      draft.nodes[node.id] = { ...node };
      return;
    }
    const fields = existing as Record<string, unknown>;
    for (const [key, value] of Object.entries(node)) {
      if (value === undefined) continue;
      if (sameValue(fields[key], value)) continue;
      fields[key] = value;
    }
  });
}

/**
 * Supprime un noeud par **tombstone applicative** (`deleted = true`) : la cle
 * ne disparait jamais du document (D4, doc 10 §2) ; l'element reste
 * recuperable via l'historique. Sans effet si le noeud est absent.
 */
export function removeNode(doc: SceneDoc, id: string): SceneDoc {
  return A.change(doc, (draft) => {
    const node = draft.nodes[id];
    if (node !== undefined) node.deleted = true;
  });
}

/**
 * Fusionne deux documents **issus d'une origine commune** (replicas d'un meme
 * document) : les entrees sont clonees puis consommees par Automerge
 * (doc 04 §1) - retourne le document fusionne. Fusionner deux documents
 * d'origines independantes produit un conflit au niveau de la carte racine
 * (contrat « une seule origine »).
 */
export function mergeScenes(local: SceneDoc, remote: SceneDoc): SceneDoc {
  return A.merge(A.clone(local), A.clone(remote));
}

/**
 * Valeurs concurrentes d'une propriete de noeud - l'entree de l'UI de merge
 * (registre MVR, doc 04 §2). `undefined` s'il n'y a pas de conflit ouvert ou
 * si le noeud est absent.
 */
export function conflictsFor(
  doc: SceneDoc,
  id: string,
  property: keyof SceneNode,
): Record<string, unknown> | undefined {
  const node = doc.nodes[id];
  if (node === undefined) return undefined;
  return A.getConflicts(node, property) as Record<string, unknown> | undefined;
}

/** Persistance binaire du document (doc 04 §1). */
export function saveScene(doc: SceneDoc): Uint8Array {
  return A.save(doc);
}

/** Recharge un document depuis son binaire - produit un document frais. */
export function loadScene(bytes: Uint8Array): SceneDoc {
  return A.load<SceneDocumentShape>(bytes);
}

/** Prochain message de synchronisation pour un pair (protocole Automerge, doc 04 §1). */
export function nextSyncMessage(doc: SceneDoc, state: SyncState): [SyncState, SyncMessage | null] {
  return A.generateSyncMessage(doc, state);
}

/**
 * Applique un message recu : le document est consomme, retourne le nouveau
 * document. Triplet `[document, etat, null]` - le troisieme element est
 * reserve par l'API 3.5 (toujours `null`).
 */
export function receiveSyncMessage(
  doc: SceneDoc,
  state: SyncState,
  message: SyncMessage,
): [SceneDoc, SyncState, null] {
  return A.receiveSyncMessage(doc, state, message);
}
