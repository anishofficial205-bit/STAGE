import { useEffect, type ReactNode } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useShell, type DockTab } from './shell';
import { ModeTools } from './ToolsPanel';
import { ModeProperties } from './PropertiesPanel';
import { Outliner } from './layers/Outliner';
import type { Mode } from '../modes';

const Icon = ({ d, w = 1.8 }: { d: string; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ADD = 'M12 5v14M5 12h14';
const PICTURES = 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6';
const STAGE = 'M3 15l9-5 9 5-9 5zM12 3v7';
const LIBRARY = 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5 1z';
const EDIT = 'M4 20h4L18 10l-4-4L4 16zM14 6l4 4';
const LAYERS = 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5';
const DRAW = 'M3 21h18M5 21V8l7-5 7 5v13';
const FOLD = 'M15 18l-6-6 6-6';

/** Per mode: what the Add tab is called and what its panel is headed. */
const ADD_LABEL: Record<Mode, { tab: string; title: string; icon: string }> = {
  set: { tab: 'Add', title: 'Add to the set', icon: ADD },
  lights: { tab: 'Add', title: 'Add lights', icon: ADD },
  blocking: { tab: 'Cast', title: 'Add performers', icon: ADD },
  venue: { tab: 'Draw', title: 'Draw the building', icon: DRAW },
};

/** A tab in the sidebar. "Stage" isn't a panel of its own: it picks the stage and shows it in Edit. */
type Tab = { id: DockTab | 'stage'; label: string; icon: string; title?: string; tour?: string };

function tabsFor(mode: Mode): Tab[] {
  const add = ADD_LABEL[mode];
  return [
    { id: 'add', label: add.tab, icon: add.icon, title: add.title, tour: 'library' },
    ...(mode === 'set'
      ? [
          { id: 'pictures', label: 'Pictures', icon: PICTURES, title: 'Pictures' } as Tab,
          { id: 'stage', label: 'Stage', icon: STAGE } as Tab,
        ]
      : []),
    { id: 'library', label: 'Library', icon: LIBRARY, title: 'Project library' },
    { id: 'edit', label: 'Edit', icon: EDIT, tour: 'edit' },
    { id: 'layers', label: 'Layers', icon: LAYERS, tour: 'layers' },
  ];
}

function TabButton({ tab, active, onClick, rail }: { tab: Tab; active: boolean; onClick: () => void; rail?: boolean }) {
  return (
    <button
      className={`${rail ? 'strip__btn' : 'side-tab'} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      data-tour={tab.tour}
      title={tab.title ?? tab.label}
    >
      <Icon d={tab.icon} w={tab.icon === ADD ? 2.1 : 1.8} />
      <span>{tab.label}</span>
    </button>
  );
}

function Body({ tab }: { tab: DockTab }): ReactNode {
  if (tab === 'edit') return <ModeProperties />;
  if (tab === 'layers') return <Outliner />;
  return <ModeTools tab={tab} />;
}

/**
 * The left sidebar: one panel at a time (Add, Pictures, Library, Edit, Layers),
 * switched by its tabs. Folded, it's a slim rail of the same tabs, so the rest
 * of the window is all stage.
 */
export function Dock() {
  const mode = useProjectStore((s) => s.mode);
  const dock = useShell((s) => s.dock);
  const setDock = useShell((s) => s.setDock);
  const stageSelected = useProjectStore((s) => s.stageSelected);
  const tabs = tabsFor(mode);
  const tab = dock && tabs.some((t) => t.id === dock) ? dock : dock ? 'add' : null;
  const activeId = tab === 'edit' && mode === 'set' && stageSelected ? 'stage' : tab;
  const open = (t: Tab) => {
    if (t.id === 'stage') {
      useProjectStore.getState().selectStage(true);
      setDock('edit');
      return;
    }
    setDock(tab === t.id ? null : t.id);
  };
  const current = tabs.find((t) => t.id === tab);
  // Picking the stage (in the view or in Layers) shows its settings, if the panel is open.
  useEffect(() => {
    if (stageSelected && useShell.getState().dock) useShell.getState().setDock('edit');
  }, [stageSelected]);

  if (!tab)
    return (
      <nav className="strip" aria-label="Panels">
        {tabs.map((t) => (
          <TabButton key={t.id} tab={t} rail active={t.id === 'stage' && stageSelected} onClick={() => open(t)} />
        ))}
      </nav>
    );

  return (
    <aside className={`dock dock--${tab}`} aria-label={current?.title ?? current?.label ?? 'Panel'}>
      <div className="side-tabs" role="tablist">
        {tabs.map((t) => (
          <TabButton key={t.id} tab={t} active={t.id === activeId} onClick={() => open(t)} />
        ))}
        <button className="side-tabs__fold" onClick={() => setDock(null)} title="Fold the panel away" aria-label="Fold the panel away">
          <Icon d={FOLD} />
        </button>
      </div>
      {current?.title && (
        <div className="dock__head">
          <h2 className="dock__title">{current.title}</h2>
        </div>
      )}
      <div className="dock__body" data-tour="panel">
        <Body tab={tab} />
      </div>
    </aside>
  );
}
