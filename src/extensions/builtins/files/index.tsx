import React from 'react';
import FilesPanel from './FilesPanel';
import { extensionRegistry } from '../../extensionRegistry';

const FILES_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
    />
  </svg>
);

extensionRegistry.registerExtension(
  {
    id: 'openconduit.files',
    name: 'Files',
    version: '1.0.0',
    description: 'Browse and preview files saved from conversations.',
    author: 'OpenConduit',
  },
  {
    activityBarItems: [
      {
        panelId: 'files',
        label: 'Files',
        icon: FILES_ICON,
        panel: FilesPanel,
        order: 30,
      },
    ],
  }
);
