import React from 'react';
import PipelinesPanel from './PipelinesPanel';
import { usePipelinesStore } from './pipelinesStore';
import { extensionRegistry } from '../../extensionRegistry';

const PIPELINES_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M4 6h16M4 10h16M4 14h8m-8 4h5"
    />
  </svg>
);

extensionRegistry.registerExtension(
  {
    id: 'openconduit.pipelines',
    name: 'Pipelines',
    version: '1.0.0',
    description: 'Build and run reusable multi-step AI pipelines.',
    author: 'OpenConduit',
  },
  {
    activityBarItems: [
      {
        panelId: 'pipelines',
        label: 'Pipelines',
        icon: PIPELINES_ICON,
        panel: PipelinesPanel,
        order: 40,
      },
    ],
    stores: [
      {
        id: 'openconduit.pipelines.store',
        store: usePipelinesStore,
      },
    ],
    commands: [
      {
        id: 'openconduit.pipelines.open',
        label: 'Open Pipelines Panel',
        action() {
          // Activate the pipelines panel by setting it as the active sidebar item.
          // The activityBar handles this — just dispatch the keyboard shortcut panel
          // open via uiStore when it becomes available.
          // For now, command palette gives discoverability.
        },
      },
    ],
  },
);
