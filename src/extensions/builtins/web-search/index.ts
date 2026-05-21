import { extensionRegistry } from '../../extensionRegistry';
import { hookRegistry } from '../../../hooks/hookRegistry';
import { commandRegistry } from '../../../commands/commandRegistry';
import { service } from '../../../services';
import type { McpTool } from '../../../types';

// ─── Tool definition ─────────────────────────────────────────────────────────────────────

const WEB_SEARCH_TOOL: McpTool = {
  serverId: '__builtin__',
  name: 'web_search',
  description:
    'Search the web and return a list of results (title, URL, snippet) matching the query. Use this when you need up-to-date information or when the user explicitly asks you to search the web.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query.',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 20).',
      },
    },
    required: ['query'],
  },
};

// ─── Registration ─────────────────────────────────────────────────────────────────────

extensionRegistry.registerExtension(
  {
    id: 'openconduit.web-search',
    name: 'Web Search',
    version: '1.0.0',
    description: 'Allows the AI to search the web using Google, Bing, DuckDuckGo, Brave, Tavily, Exa, or Jina.',
    author: 'OpenConduit',
    activate(api) {
      // Inject web_search tool into chat requests when enabled
      hookRegistry.registerBeforeSend('openconduit.web-search', (request) => {
        const enabled = api.settings.get<boolean>('webSearch.enabled');
        if (!enabled) return request;

        const existing = request.builtinTools ?? [];
        if (existing.some((t) => t.name === 'web_search')) return request;

        return { ...request, builtinTools: [...existing, WEB_SEARCH_TOOL] };
      });

      // Test command: run a live search with current settings and notify result
      commandRegistry.register({
        id: 'openconduit.web-search.test',
        label: 'Web Search: Run Test',
        action() {
          if (!service.webtools) {
            api.ui.showNotification({ message: 'Restart the app to enable the test feature.', type: 'warning' });
            return;
          }
          api.ui.showNotification({ message: 'Running search test…', type: 'info' });
          void service.webtools.test('search').then((result) => {
            api.ui.showNotification({
              message: result.message,
              type: result.ok ? 'success' : 'error',
            });
          });
        },
      });

      // Open Browser command: open the current engine's site in the system browser
      commandRegistry.register({
        id: 'openconduit.web-search.openBrowser',
        label: 'Web Search: Open Browser',
        action() {
          const engine = api.settings.get<string>('webSearch.engine') ?? 'google';
          const urls: Record<string, string> = {
            duckduckgo: 'https://duckduckgo.com',
            google: 'https://www.google.com',
            'google-api': 'https://programmablesearchengine.google.com/controlpanel/create',
            bing: 'https://www.bing.com',
            brave: 'https://search.brave.com',
            tavily: 'https://app.tavily.com',
            exa: 'https://exa.ai',
            jina: 'https://jina.ai',
          };
          void service.updater.openExternal(urls[engine] ?? 'https://www.google.com');
        },
      });
    },
  },
  {
    settingsTab: {
      id: 'web-search',
      label: 'Web Search',
      order: 46,
      sections: [
        {
          title: 'Web Search',
          description:
            'When enabled, the AI can search the web to answer questions requiring current information.',
          properties: [
            {
              key: 'webSearch.enabled',
              title: 'Enable Web Search',
              type: 'boolean',
              description: 'Inject the web_search tool into every chat request.',
              default: false,
              order: 1,
            },
            {
              key: 'webSearch.engine',
              title: 'Search Engine',
              type: 'string',
              enum: ['google', 'bing', 'duckduckgo', 'brave', 'tavily', 'exa', 'jina', 'google-api'],
              enumDescriptions: [
                'Google (Free) — browser-based, no API key required',
                'Bing (Free) — browser-based, no API key required',
                'DuckDuckGo (Free) — browser-based, no API key required',
                'Brave Search — requires API key',
                'Tavily — AI-optimised, requires API key',
                'Exa — neural search, requires API key',
                'Jina AI — reader-optimised, requires API key',
                'Google Custom Search — requires API key + Search Engine ID',
              ],
              description: 'The search provider to use.',
              default: 'google',
              order: 2,
            },
            {
              key: 'webSearch.apiKey',
              title: 'API Key',
              type: 'string',
              sensitive: true,
              placeholder: 'Required for Brave, Tavily, Exa, Jina and Google Custom Search',
              description: 'API key for the selected search engine (not needed for free engines).',
              order: 3,
            },
            {
              key: 'webSearch.googleCx',
              title: 'Google Search Engine ID (CX)',
              type: 'string',
              placeholder: 'e.g. 017576662512468239146:omuauf_lfve',
              description: 'Required only for Google Custom Search. Find yours in the Programmable Search Engine control panel.',
              order: 4,
            },
            {
              key: 'webSearch.maxResults',
              title: 'Max Results',
              type: 'number',
              minimum: 1,
              maximum: 20,
              step: 1,
              description: 'Maximum number of results returned per search.',
              default: 5,
              order: 5,
            },
            {
              key: 'webSearch.showBrowser',
              title: 'Show Browser Window',
              type: 'boolean',
              description: 'Show a browser window while searching (applies to free browser-based engines).',
              default: false,
              order: 6,
            },
            {
              key: '_btn.webSearch.test',
              title: 'Run Test',
              type: 'button',
              buttonLabel: 'Run Test',
              command: 'openconduit.web-search.test',
              description: 'Search for “test” using the current engine and show results count.',
              order: 7,
            },
            {
              key: '_btn.webSearch.openBrowser',
              title: 'Open Browser',
              type: 'button',
              buttonLabel: 'Open Browser',
              command: 'openconduit.web-search.openBrowser',
              description: 'Open the selected search engine’s website in your browser.',
              order: 8,
            },
          ],
        },
        {
          title: 'Exclusions',
          description: 'Sites to omit from every search.',
          properties: [
            {
              key: 'webSearch.excludeWebsites',
              title: 'Excluded Sites',
              type: 'string',
              multiline: true,
              placeholder: 'reddit.com\nquora.com',
              description: 'One hostname per line. Results from these sites will be filtered out.',
              order: 1,
            },
          ],
        },
      ],
    },
  }
);


