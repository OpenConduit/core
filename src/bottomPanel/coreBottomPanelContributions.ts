import React from 'react';
import { bottomPanelRegistry } from './bottomPanelRegistry';
import ToolCallsTab from './tabs/ToolCallsTab';
import TokenUsageTab from './tabs/TokenUsageTab';
import DebugConsoleTab from './tabs/DebugConsoleTab';

bottomPanelRegistry.register({
  id: 'tool-calls',
  label: 'Tool Calls',
  order: 10,
  icon: React.createElement('svg', {
    className: 'w-3.5 h-3.5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.5,
      d: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
    })
  ),
  content: (conversationId) => React.createElement(ToolCallsTab, { conversationId }),
});

bottomPanelRegistry.register({
  id: 'token-usage',
  label: 'Token Usage',
  order: 20,
  icon: React.createElement('svg', {
    className: 'w-3.5 h-3.5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.5,
      d: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    })
  ),
  content: (conversationId) => React.createElement(TokenUsageTab, { conversationId }),
});

bottomPanelRegistry.register({
  id: 'debug-console',
  label: 'Debug Console',
  order: 30,
  icon: React.createElement('svg', {
    className: 'w-3.5 h-3.5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.5,
      d: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z',
    })
  ),
  content: () => React.createElement(DebugConsoleTab),
});
