import { extensionRegistry } from '../../extensionRegistry';
import { useUiStore } from '../../../stores/uiStore';
import CompareArea from './CompareArea';

const COMPARE_VIEW_ID = 'openconduit.compare.view';

extensionRegistry.registerExtension(
  {
    id: 'openconduit.compare',
    name: 'Compare',
    version: '1.0.0',
    description: 'Side-by-side model comparison for the main chat area.',
    author: 'OpenConduit',
  },
  {
    mainViews: [
      {
        id: COMPARE_VIEW_ID,
        component: CompareArea,
      },
    ],
    commands: [
      {
        id: 'openconduit.compare.toggle',
        label: 'Toggle Compare Mode',
        shortcut: '⌘⇧C',
        keybinding: { key: 'c', mod: true, shift: true },
        action: () => {
          const { activeMainViewId, setActiveMainViewId } = useUiStore.getState();
          setActiveMainViewId(activeMainViewId === COMPARE_VIEW_ID ? null : COMPARE_VIEW_ID);
        },
      },
    ],
  }
);
