import React from 'react';
import TasksPanel from './TasksPanel';
import { extensionRegistry } from '../../extensionRegistry';

const TASKS_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

extensionRegistry.registerExtension(
  {
    id: 'openconduit.tasks',
    name: 'Tasks',
    version: '1.0.0',
    description: 'Tracks AI-generated tasks and their completion status.',
    author: 'OpenConduit',
  },
  {
    bottomPanelTabs: [
      {
        id: 'tasks',
        label: 'Tasks',
        order: 5,
        icon: TASKS_ICON,
        content: () => React.createElement(TasksPanel),
      },
    ],
  }
);
