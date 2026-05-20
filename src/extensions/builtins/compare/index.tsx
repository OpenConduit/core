import { extensionRegistry } from '../../extensionRegistry';
import { useUiStore } from '../../../stores/uiStore';

extensionRegistry.registerExtension(
  {
    id: 'openconduit.compare',
    name: 'Compare',
    version: '1.0.0',
    description: 'Side-by-side model comparison for the main chat area.',
    author: 'OpenConduit',
  },
  {
    commands: [
      {
        id: 'openconduit.compare.toggle',
        label: 'Toggle Compare Mode',
        shortcut: '⌘⇧C',
        keybinding: { key: 'c', mod: true, shift: true },
        action: () => {
          const { isCompareMode, setCompareMode } = useUiStore.getState();
          setCompareMode(!isCompareMode);
        },
      },
    ],
  }
);
