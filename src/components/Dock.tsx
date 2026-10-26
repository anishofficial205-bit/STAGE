import type { ReactNode } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useShell, type DockTab } from './shell';
import { ModeTools } from './ToolsPanel';
import type { Mode } from '../modes';

const Icon = ({ d, w = 1.8 }: { d: string; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ADD = 'M12 5v14M5 12h14';
const PICTURES = 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6';
const STAGE = 'M3 15l9-5 9 5-9 5zM12 3v7';
const DRAW = 'M3 21h18M5 21V8l7-5 7 5v13';

/** Per mode: what the Add tool is called and what its panel is headed. */
const ADD_LABEL: Record<Mode, { tab: string; title: string; icon: string }> = {
  set: { tab: 'Add', title: 'Add to the set', icon: ADD },
  lights: { tab: 'Add', title: 'Add lights', icon: ADD },
  blocking: { tab: 'Cast', title: 'Cast and scenes', icon: ADD },
  venue: { tab: 'Draw', title: 'Draw the building', icon: DRAW },
};

function StripButton({ active, label, icon, onClick, tour }: { active: boolean; label: string; icon: ReactNode; onClick: () => void; tour?: string }) {
  return (
    <button className={`strip__btn ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active} data-tour={tour}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * The left side: a strip of big labelled tools, and one panel beside it with the
 * chosen tool (Add, Pictures). Clicking the open tool again — or ‹ — tucks the
 * panel away. Editing what's picked happens on the right, under Layers.
 */
export function Dock() {
  const mode = useProjectStore((s) => s.mode);
  const dock = useShell((s) => s.dock);
  const setDock = useShell((s) => s.setDock);
  const stageSelected = useProjectStore((s) => s.stageSelected);
  const tab = mode !== 'set' && dock === 'pictures' ? 'add' : dock;
  const toggle = (t: DockTab) => setDock(tab === t ? null : t);
  const add = ADD_LABEL[mode];
  const title = tab === 'pictures' ? 'Pictures' : add.title;

  return (
    <>
      <nav className="strip" aria-label="Tools">
        <StripButton active={tab === 'add'} label={add.tab} icon={<Icon d={add.icon} w={2.1} />} onClick={() => toggle('add')} tour="library" />
        {mode === 'set' && (
          <>
            <StripButton active={tab === 'pictures'} label="Pictures" icon={<Icon d={PICTURES} />} onClick={() => toggle('pictures')} />
            <StripButton active={stageSelected} label="Stage" icon={<Icon d={STAGE} />} onClick={() => useProjectStore.getState().selectStage(!stageSelected)} />
          </>
        )}
      </nav>
      {tab && (
        <aside className="dock" aria-label={title}>
          <div className="dock__head">
            <h2 className="dock__title">{title}</h2>
            <button className="dock__tuck" onClick={() => setDock(null)} title="Tuck the panel away" aria-label="Tuck the panel away">
              <Icon d="M15 18l-6-6 6-6" />
            </button>
          </div>
          <div className="dock__body">
            <ModeTools tab={tab} />
          </div>
        </aside>
      )}
    </>
  );
}
