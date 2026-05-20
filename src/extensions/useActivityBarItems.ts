import { useState, useEffect } from 'react';
import { extensionRegistry } from './extensionRegistry';
import type { ActivityBarContribution } from './types';

/**
 * Returns the current list of extension-contributed activity bar items,
 * re-rendering whenever a new extension registers (e.g. after dynamic load).
 */
export function useActivityBarItems(): ActivityBarContribution[] {
  const [items, setItems] = useState(() => extensionRegistry.getActivityBarItems());

  useEffect(() => {
    // Sync in case extensions registered between initial render and effect
    setItems(extensionRegistry.getActivityBarItems());
    return extensionRegistry.subscribe(() => {
      setItems(extensionRegistry.getActivityBarItems());
    });
  }, []);

  return items;
}
