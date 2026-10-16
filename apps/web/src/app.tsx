/**
 * Coquille applicative (phase 0, doc 10 §5) : aucune fonctionnalite produit.
 * Prouve la liaison du workspace en consommant un type de @yidik/ast et une
 * regle pure de @yidik/scene ; l'affichage illustre le departage (order, id).
 */
import type { SceneNode } from "@yidik/ast";
import { compareSiblings } from "@yidik/scene";

const demo: SceneNode[] = [
  { id: "n2", type: "frame", parentId: null, order: "a1" },
  { id: "n1", type: "frame", parentId: null, order: "a1" },
];
const demoOrder = demo
  .sort(compareSiblings)
  .map((node) => node.id)
  .join(" < ");

export function App() {
  return (
    <main>
      <h1>Yidik</h1>
      <p>Squelette du depot (phase 0) : aucune fonctionnalite produit.</p>
      <p>
        Paquets lies : <code>@yidik/ast</code>, <code>@yidik/scene</code>
      </p>
      <p>
        Departage deterministe (order, id) : <code>{demoOrder}</code>
      </p>
    </main>
  );
}
