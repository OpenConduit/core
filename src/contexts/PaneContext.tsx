import { createContext, useContext } from 'react';

/**
 * Identifies which split pane a component tree lives in.
 * Used by ArtifactBlock to direct "Open in pane" to the opposite pane.
 */
export const PaneContext = createContext<'left' | 'right'>('left');

export function usePaneContext() {
  return useContext(PaneContext);
}
