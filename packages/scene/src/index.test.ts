import type { SceneNode } from "@yidik/ast";
import { describe, expect, it } from "vitest";
import { childrenOf, compareSiblings, isVisible } from "./index";

function node(id: string, order: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, type: "frame", parentId: null, order, ...extra };
}

describe("compareSiblings (D3 : departage (order, id))", () => {
  it("l'ordre prime, l'id tranche a order egal", () => {
    const nodes = [node("n3", "a2"), node("n1", "a1"), node("n2", "a1")];
    expect(nodes.sort(compareSiblings).map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("est un ordre total : antisymetrie sur toutes les paires et tri stable", () => {
    const nodes = [node("b", "z"), node("a", "z"), node("c", "a"), node("d", "m"), node("e", "z")];
    for (const x of nodes) {
      for (const y of nodes) {
        // antisymetrie : 1 + (-1) = 0, 0 + 0 = 0 (evite le piege +0/-0 de Math.sign)
        expect(Math.sign(compareSiblings(x, y)) + Math.sign(compareSiblings(y, x))).toBe(0);
      }
    }
    expect([...nodes].sort(compareSiblings).map((n) => n.id)).toEqual(["c", "d", "a", "b", "e"]);
  });
});

describe("isVisible / childrenOf", () => {
  it("exclut les tombstones et trie les enfants visibles", () => {
    const deletedNode = node("n3", "a3", { deleted: true });
    const nodes: Record<string, SceneNode> = {
      n1: node("n1", "a2"),
      n2: node("n2", "a1"),
      n3: deletedNode,
      n4: node("n4", "a1", { parentId: "n1" }),
    };
    expect(isVisible(deletedNode)).toBe(false);
    expect(childrenOf(nodes, null).map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(childrenOf(nodes, "n1").map((n) => n.id)).toEqual(["n4"]);
  });
});
