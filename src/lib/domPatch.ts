/**
 * Protège React quand un outil externe (traduction automatique du navigateur,
 * extensions) déplace des nœuds de la page : évite le plantage
 * « insertBefore / removeChild : le nœud n'est pas un enfant de ce nœud ».
 */
export const installDomMutationGuard = () => {
  if (typeof Node === 'undefined' || (Node.prototype as any).__aquaGuard) return;
  (Node.prototype as any).__aquaGuard = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) return originalRemoveChild.call(child.parentNode, child) as T;
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
};
