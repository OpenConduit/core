import React from 'react';
import PersonasPanel from '../../components/PersonasPanel';
import { extensionRegistry } from '../extensionRegistry';

const PERSONAS_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

extensionRegistry.registerExtension(
  {
    id: 'openconduit.personas',
    name: 'Personas',
    version: '1.0.0',
    description: 'Built-in Personas panel — create and manage AI personas.',
    author: 'OpenConduit',
  },
  {
    activityBarItems: [
      {
        panelId: 'personas',
        label: 'Personas',
        icon: PERSONAS_ICON,
        panel: PersonasPanel,
        order: 20,
      },
    ],
  }
);
