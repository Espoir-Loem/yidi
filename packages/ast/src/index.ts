/**
 * @yidik/ast - types du Visual AST (doc 02 §1, brouillon v0).
 *
 * Contraintes de la frontiere (doc 10 §4-5) :
 * - zero dependance, zero runtime : types et constantes uniquement ;
 * - aucune API DOM ni Node ;
 * - le typage fin par variante (union discriminee des `props`) est un chantier
 *   de la phase 1 ; le modele reste celui du FRD (brouillon v0).
 */

/** Version de schema du document scenegraph (migrations, doc 02 §1). */
export const SCHEMA_VERSION = 1;

/** Types de noeuds du MVP (doc 02 §1). */
export type NodeType =
  | "frame"
  | "text"
  | "image"
  | "form_input"
  | "form_select"
  | "form_button"
  | "container";

/** Specification de mise en page (moteur Auto Layout interne, doc 02 §1 - brouillon v0). */
export type LayoutSpec = {
  display?: "flex" | "grid" | "none";
  direction?: "row" | "column";
  gap?: number;
  padding?: [number, number, number, number];
};

/** Reference de jetons uniquement - aucune valeur brute dans le document (doc 02 §1). */
export type StyleRef = {
  bg?: string;
  fg?: string;
};

/**
 * Noeud du scenegraph.
 * `id` est immuable (doc 04 §3) ; `order` est un index fractionnaire, jamais de
 * renumeration en masse ; `deleted` est la tombstone applicative (D4, doc 10 §2) :
 * la suppression gagne et ne supprime jamais la cle.
 */
export type SceneNode = {
  id: string;
  type: NodeType;
  parentId: string | null;
  order: string;
  deleted?: boolean;
  layout?: LayoutSpec;
  style?: StyleRef;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
};

/** Forme racine du document scenegraph (doc 10 §6). */
export type SceneDocumentShape = {
  schemaVersion: number;
  nodes: Record<string, SceneNode>;
};
