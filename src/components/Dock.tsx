import type { ReactNode } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';
import { useShell, type DockTab } from './shell';
import { ModeTools } from './ToolsPanel';
import { ModeProperties } from './PropertiesPanel';
import type { Mode } from '../modes';

const Icon = ({ d, w = 1.8 }: { d: string; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ADD = 'M12 5v14M5 12h14';
const EDIT = 'M4 20h4L18 10l-4-4L4 16zM14 6l4 4';
const PICTURES = 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6';
const STAGE = 'M3 15l9-5 9 5-9 5zM12 3v7';
const MOODS = 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z';
const SCENE = 'M4 5h16v14H4zM4 9h16M9 5v4M15 5v4';
const DRAW = 'M3 21h18M5 21V8l7-5 7 5v13';

/** Is something picked in the current mode (so Edit means editing it)? */
function useHasSelection(mode: Mode) {
  const set = useProjectStore((s) => s.selectedIds.length > 0 || s.stageSelected);
  const lights = useLightsUI((s) => !!s.selected);
  const blocking = useBlockingUI((s) => !!s.selected);
  const venue = useVenueUI((s) => !!s.selected);
  return mode === 'lights' ? lights : mode === 'blocking' ? blocking : mode === 'venue' ? venue : set;
}

/** Per mode: what the Add tab is called and holds, and what Edit shows with nothing picked. */
const ADD_LABEL: Record<Mode, { tab: string; title: string; icon: string }> = {
  set: { tab: 'Add', title: 'Add to the set', icon: ADD },
  lights: { tab: 'Add', title: 'Add lights', icon: ADD },
  blocking: { tab: 'Cast', title: 'Cast and scenes', icon: ADD },
  venue: { tab: 'Draw', title: 'Draw the building', icon: DRAW },
};
const IDLE_EDIT: Record<Mode, { tab: string; icon: string }> = {
  set: { tab: 'Edit', icon: EDIT },
  lights: { tab: 'Moods', icon: MOODS },
  blocking: { tab: 'Scene', icon: SCENE },
  venue: { tab: 'Venue', icon: EDIT },
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
 * The left side: a strip of big labelled tools, and one panel beside it showing
 * the chosen tool (Add, Edit, Pictures). Clicking the open tool again — or ‹ —
 * tucks the panel away so the stage gets the room.
 */
export function Dock() {
  const mode = useProjectStore((s) => s.mode);
  const dock = useShell((s) => s.dock);
  const setDock = useShell((s) => s.setDock);
  const stageSelected = useProjectStore((s) => s.stageSelected);
  const picked = useHasSelection(mode);
  const tab = mode !== 'set' && dock === 'pictures' ? 'add' : dock;
  const toggle = (t: DockTab) => setDock(tab === t ? null : t);
  const add = ADD_LABEL[mode];
  const edit = picked ? { tab: 'Edit', icon: EDIT } : IDLE_EDIT[mode];
  const title = tab === 'add' ? add.title : tab === 'pictures' ? 'Pictures' : stageSelected ? 'The stage' : picked ? 'Edit' : edit.tab === 'Edit' ? 'Set' : edit.tab;

  return (
    <>
      <nav className="strip" aria-label="Tools">
        <StripButton active={tab === 'add'} label={add.tab} icon={<Icon d={add.icon} w={2.1} />} onClick={() => toggle('add')} tour="library" />
        <StripButton active={tab === 'edit' && !stageSelected} label={edit.tab} icon={<Icon d={edit.icon} />} onClick={() => (stageSelected ? (useProjectStore.getState().selectStage(false), setDock('edit')) : toggle('edit'))} />
        {mode === 'set' && (
          <>
            <StripButton active={tab === 'pictures'} label="Pictures" icon={<Icon d={PICTURES} />} onClick={() => toggle('pictures')} />
            <StripButton
              active={tab === 'edit' && stageSelected}
              label="Stage"
              icon={<Icon d={STAGE} />}
              onClick={() => {
                const s = useProjectStore.getState();
                if (stageSelected && tab === 'edit') return setDock(null);
                s.selectStage(true);
                setDock('edit');
              }}
            />
          </>
        )}
      </nav>
      {tab && (
        <aside className={`dock ${tab === 'edit' ? 'dock--edit' : ''}`} data-tour="panel" aria-label={title}>
          <div className="dock__head">
            {tab !== 'edit' && <h2 className="dock__title">{title}</h2>}
            <button className="dock__tuck" onClick={() => setDock(null)} title="Tuck the panel away" aria-label="Tuck the panel away">
              <Icon d="M15 18l-6-6 6-6" />
            </button>
          </div>
          <div className="dock__body">{tab === 'edit' ? <ModeProperties /> : <ModeTools tab={tab} />}</div>
        </aside>
      )}
    </>
  );
}
