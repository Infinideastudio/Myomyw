import { useEffect, useState, type DependencyList } from "react";
import type { MatchController } from "./types.ts";

/**
 * Creates a match controller for the lifetime of a component (or until `deps`
 * change) and disposes it afterwards. Returns null during the first render.
 */
export function useController<T extends MatchController>(create: () => T, deps: DependencyList): T | null {
  const [controller, setController] = useState<T | null>(null);
  useEffect(() => {
    const created = create();
    setController(created);
    return () => created.dispose();
  }, deps);
  return controller;
}
