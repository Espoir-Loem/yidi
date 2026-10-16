/**
 * Scenarios du Spike B (annexe 2026-10-16) encodes comme suite de non-regression :
 * a) meme attribut concurrent -> MVR expose, resolution ; b) suppression vs
 * modification -> regle silencieuse ; c) collision de rang -> departage (order, id) ;
 * d) modifications disjointes -> fusion silencieuse. Plus : test de propriete par
 * permutations (~25 graines en CI ; campagne 100+ hors CI, annexe), persistance
 * binaire et convergence par messages de synchronisation.
 */
import * as A from "@automerge/automerge";
import type { SceneNode } from "@yidik/ast";
import { childrenOf } from "@yidik/scene";
import { describe, expect, it } from "vitest";
import type { SceneDoc } from "./index";
import {
  conflictsFor,
  createEmptyReplica,
  createSceneDocument,
  loadScene,
  mergeScenes,
  nextSyncMessage,
  receiveSyncMessage,
  removeNode,
  saveScene,
  upsertNode,
} from "./index";

function makeNode(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, type: "frame", parentId: null, order: "a1", ...extra };
}

/** Base commune aux scenarios : deux noeuds, des champs varies. */
function baseDoc(): SceneDoc {
  let doc = createSceneDocument();
  doc = upsertNode(doc, makeNode("n01", { style: { bg: "tokens.surface" } }));
  doc = upsertNode(doc, makeNode("n02", { props: { placeholder: "nom@entreprise.com" } }));
  return doc;
}

/** Projection texte stable (cles triees) : compare etat final et conflits. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

/** Liste stable des conflits ouverts, par noeud et propriete. */
function conflictsSnapshot(doc: SceneDoc): string {
  const properties: (keyof SceneNode)[] = ["parentId", "order", "deleted", "style", "props"];
  const lines: string[] = [];
  for (const id of Object.keys(doc.nodes).sort()) {
    for (const property of properties) {
      const conflicts = conflictsFor(doc, id, property);
      if (conflicts !== undefined) lines.push(`${id}.${property} = ${stable(conflicts)}`);
    }
  }
  return lines.join("\n");
}

/** Melange deterministe (LCG Numerical Recipes) : ordre reproductible par graine. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    const a = result[index];
    const b = result[swapIndex];
    if (a === undefined || b === undefined) continue;
    result[index] = b;
    result[swapIndex] = a;
  }
  return result;
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error("index hors bornes");
  return item;
}

describe("scenario a - meme attribut modifie des deux cotes (Spike B)", () => {
  it("getConflicts expose les deux valeurs ; la resolution reduit le registre", () => {
    const base = baseDoc();
    const docA = upsertNode(A.clone(base), makeNode("n01", { style: { bg: "bleu" } }));
    const docB = upsertNode(A.clone(base), makeNode("n01", { style: { bg: "vert" } }));

    let merged = mergeScenes(docA, docB);
    const conflicts = conflictsFor(merged, "n01", "style");
    const values = conflicts === undefined ? [] : Object.values(conflicts);
    expect(values).toHaveLength(2);
    expect(values).toEqual(expect.arrayContaining([{ bg: "bleu" }, { bg: "vert" }]));

    merged = upsertNode(merged, makeNode("n01", { style: { bg: "orange" } }));
    expect(conflictsFor(merged, "n01", "style")).toBeUndefined();
    expect(merged.nodes.n01?.style).toEqual({ bg: "orange" });
  });
});

describe("scenario b - suppression vs modification (D4, regle silencieuse)", () => {
  it("la tombstone gagne sans signal ; la modification n'est pas perdue", () => {
    const base = baseDoc();
    const docA = removeNode(A.clone(base), "n02");
    const docB = upsertNode(A.clone(base), makeNode("n02", { props: { placeholder: "modifie" } }));

    const merged = mergeScenes(docA, docB);
    const n02 = merged.nodes.n02;
    expect(n02?.deleted).toBe(true);
    expect(n02?.props).toEqual({ placeholder: "modifie" });
    // aucun conflit signale : la suppression est une regle silencieuse assumee
    expect(conflictsFor(merged, "n02", "deleted")).toBeUndefined();
    expect(childrenOf(merged.nodes, null).map((n) => n.id)).toEqual(["n01"]);
  });
});

describe("scenario c - insertion concurrente au meme rang (D3)", () => {
  it("les deux noeuds survivent sans signal ; departage (order, id) deterministe", () => {
    const base = baseDoc();
    const docA = upsertNode(A.clone(base), makeNode("n10", { order: "a1" }));
    const docB = upsertNode(A.clone(base), makeNode("n11", { order: "a1" }));

    const merged = mergeScenes(docA, docB);
    expect(conflictsFor(merged, "n10", "order")).toBeUndefined();
    expect(childrenOf(merged.nodes, null).map((n) => n.id)).toEqual(["n01", "n02", "n10", "n11"]);
  });
});

describe("scenario d - modifications disjointes", () => {
  it("fusion silencieuse : aucune valeur perdue, aucun conflit", () => {
    const base = baseDoc();
    const docA = upsertNode(A.clone(base), makeNode("n01", { style: { bg: "bleu" } }));
    const docB = upsertNode(A.clone(base), makeNode("n01", { order: "a2" }));

    const merged = mergeScenes(docA, docB);
    expect(merged.nodes.n01?.style).toEqual({ bg: "bleu" });
    expect(merged.nodes.n01?.order).toBe("a2");
    expect(conflictsFor(merged, "n01", "style")).toBeUndefined();
    expect(conflictsFor(merged, "n01", "order")).toBeUndefined();
  });
});

describe("contrat - une seule origine par document (doc 04 §1)", () => {
  it("deux documents d'origines independantes : conflit au niveau de la carte racine", () => {
    const docA = upsertNode(baseDoc(), makeNode("n10", { order: "a1" }));
    const docB = upsertNode(baseDoc(), makeNode("n11", { order: "a1" }));

    const merged = mergeScenes(docA, docB);
    // Les deux cartes `nodes` racine sont concurrentes : l'une est visible,
    // l'autre reste dans le registre de conflits. Les replicas d'un projet
    // derivent de son origine par clone/load/sync, jamais par creation.
    const rootConflicts = A.getConflicts(merged, "nodes");
    expect(Object.values(rootConflicts ?? {})).toHaveLength(2);
    const ids = Object.keys(merged.nodes);
    expect(ids.every((id) => ["n01", "n02", "n10", "n11"].includes(id))).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });
});

describe("propriete - ordre et multiplicite des fusions (doc 04 §3)", () => {
  it("etat final et conflits stables sur 25 permutations (graines fixes)", () => {
    const base = baseDoc();
    const variants: SceneDoc[] = [
      upsertNode(A.clone(base), makeNode("n01", { style: { bg: "bleu" } })),
      upsertNode(A.clone(base), makeNode("n01", { style: { bg: "vert" } })),
      upsertNode(A.clone(base), makeNode("n02", { props: { placeholder: "modifie" } })),
      upsertNode(A.clone(base), makeNode("n03", { order: "a2" })),
      removeNode(A.clone(base), "n02"),
    ];

    // Le test n'est pas vide : le conflit n01.style a bien deux valeurs.
    const probeDocs = variants.map((variant) => A.clone(variant));
    let probe = A.clone(base);
    for (const index of shuffled([0, 1, 2, 3, 4], 1)) {
      probe = mergeScenes(probe, pick(probeDocs, index));
    }
    expect(Object.values(conflictsFor(probe, "n01", "style") ?? {})).toHaveLength(2);

    let reference: string | undefined;
    for (let seed = 1; seed <= 25; seed += 1) {
      const docs = variants.map((variant) => A.clone(variant));
      let merged = A.clone(base);
      for (const index of shuffled([0, 1, 2, 3, 4], seed)) {
        merged = mergeScenes(merged, pick(docs, index));
      }
      // multiplicite : une fusion repetee ne change rien (idempotence)
      merged = mergeScenes(merged, pick(docs, seed % docs.length));
      const snapshot = `${stable(merged)}|${conflictsSnapshot(merged)}`;
      reference ??= snapshot;
      expect(snapshot).toBe(reference);
    }
  });
});

describe("persistance binaire", () => {
  it("save/load : aller-retour sans perte", () => {
    let doc = baseDoc();
    doc = upsertNode(doc, makeNode("n03", { order: "a2" }));

    const reloaded = loadScene(saveScene(doc));
    expect(stable(reloaded)).toBe(stable(doc));
    expect(conflictsFor(reloaded, "n01", "style")).toBeUndefined();
  });
});

describe("protocole de synchronisation (pair a pair, phase 1)", () => {
  it("deux pairs convergent par messages, sans transport", () => {
    let docA = baseDoc();
    let docB = createEmptyReplica();
    let stateA = A.initSyncState();
    let stateB = A.initSyncState();

    for (let round = 0; round < 20; round += 1) {
      const [afterA, messageA] = nextSyncMessage(docA, stateA);
      stateA = afterA;
      if (messageA !== null) {
        const [nextB, stateBAfter] = receiveSyncMessage(docB, stateB, messageA);
        docB = nextB;
        stateB = stateBAfter;
      }

      const [afterB, messageB] = nextSyncMessage(docB, stateB);
      stateB = afterB;
      if (messageB !== null) {
        const [nextA, stateAAfter] = receiveSyncMessage(docA, stateA, messageB);
        docA = nextA;
        stateA = stateAAfter;
      }

      if (messageA === null && messageB === null) break;
    }

    expect(stable(docB)).toBe(stable(docA));
    expect(Object.keys(docB.nodes).sort()).toEqual(["n01", "n02"]);
  });
});
