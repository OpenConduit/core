import { extensionRegistry } from '../../extensionRegistry';
import { hookRegistry } from '../../../hooks/hookRegistry';
import { commandRegistry } from '../../../commands/commandRegistry';
import { service } from '../../../services';
import type { McpTool } from '../../../types';

// ─── Tool definition ─────────────────────────────────────────────────────────────────────

const WEB_FETCH_TOOL: McpTool = {
  serverId: '__builtin__',
  name: 'web_fetch',
  description:
    'Fetch the content of a web page and return its readable text. Use this when the user asks you to read, summarise, or analyse a URL.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to fetch (must begin with http:// or https://).',
      },
      showBrowser: {
        type: 'boolean',
        description: 'If true, show the browser window so the user can see the page being loaded.',
      },
    },
    required: ['url'],
  },
};

// ─── Registration ─────────────────────────────────────────────────────────────────────

extensionRegistry.registerExtension(
  {
    id: 'openconduit.web-fetch',
    name: 'Web Fetch',
    version: '1.0.0',
    description: 'Allows the AI to fetch and read web pages on demand.',
    author: 'OpenConduit',
    activate(api) {
      hookRegistry.registerBeforeSend('openconduit.web-fetch', (request) => {
        const enabled = api.settings.get<boolean>('webFetch.enabled');
        if (!enabled) return request;

        const existing = request.builtinTools ?? [];
        if (existing.some((t) => t.name === 'web_fetch')) return request;

        return { ...request, builtinTools: [...existing, WEB_FETCH_TOOL] };
      });

      commandRegistry.register({
        id: 'openconduit.web-fetch.test',
        label: 'Web Fetch: Run Test',
        action() {
          if (!service.webtools) {
            api.ui.showNotification({ message: 'Restart the app to enable the test feature.', type: 'warning' });
            return;
          }
          void service.webtools.test('fetch').then((result) => {
            api.ui.showNotification({
              message: result.message,
              type: result.ok ? 'success' : 'error',
            });
          });
        },
      });

      commandRegistry.register({
        id: 'openconduit.web-fetch.openBrowser',
        label: 'Web Fetch: Open Browser',
        action() {
          void service.updater.openExternal('https://example.com');
        },
      });
    },
  },
  {
    settingsTab: {
      id: 'web-fetch',
      label: 'Web Fetch',
      order: 45,
      sections: [
        {
          title: 'Web Fetch',
          description:
            'When enabled, the AI can fetch and read any URL you mention or paste into the chat.',
          properties: [
            {
              key: 'webFetch.enabled',
              title: 'Enable Web Fetch',
              type: 'boolean',
              description: 'Inject the web_fetch tool into every chat request.',
              default: false,
              order: 1,
            },
            {
              key: 'webFetch.showBrowser',
              title: 'Show Browser Window',
              type: 'boolean',
              description:
                'Open a visible browser window while fetching pages. Useful for pages that require interaction or login.',
              default: false,
              order: 2,
            },
            {
              key: '_btn.webFetch.test',
              title: 'Run Test',
              type: 'button',
              buttonLabel: 'Run Test',
              command: 'openconduit.web-fetch.test',
              description: 'Fetch example.com and show how many characters were returned.',
              order: 3,
            },
            {
              key: '_btn.webFetch.openBrowser',
              title: 'Open Browser',
              type: 'button',
              buttonLabel: 'Open Browser',
              command: 'openconduit.web-fetch.openBrowser',
              description: 'Open example.com in your system browser.',
              order: 4,
            },
          ],
        },
      ],
    },
  }
);


