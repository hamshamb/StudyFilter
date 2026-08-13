import React from "react";
import { createStore, list, str, useStore } from "@/lib/store";

/**
 * Starred elements.
 *
 * In its own module rather than beside the component that uses it, because
 * React Fast Refresh can only hot-swap a file that exports components and
 * nothing else. A file exporting both `ElementView` and a hook forces Vite to
 * invalidate the whole module on every edit — which is what produced a screen
 * of "does not provide an export named" errors after a large file sync.
 */

const store = createStore<string[]>({
  key: "sf_element_favourites",
  version: 1,
  fallback: () => [],
  parse: (raw) => list(raw, (item) => str(item) || null),
});

export function useElementFavourites() {
  const saved = useStore(store);
  return React.useMemo(
    () => ({
      saved,
      has: (symbol: string) => saved.includes(symbol),
      toggle: (symbol: string) =>
        store.set((prev) =>
          prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
        ),
    }),
    [saved],
  );
}

export function readFavouriteElements(): string[] {
  return store.get();
}
