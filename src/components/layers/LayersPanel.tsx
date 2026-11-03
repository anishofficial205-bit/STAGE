import { useShell } from '../shell';
import { Outliner } from './Outliner';

const LAYERS = 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5';

/** Layers on the right: the full list, or folded away to one button so the stage gets the room. */
export function LayersPanel() {
  const open = useShell((s) => s.layers);
  const setLayers = useShell((s) => s.setLayers);
  if (!open)
    return (
      <button className="layers-tab" onClick={() => setLayers(true)} data-tour="layers" title="Show Layers: everything in the scene">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={LAYERS} />
        </svg>
        <span>Layers</span>
      </button>
    );
  return (
    <aside className="layers-side" aria-label="Layers" data-tour="layers">
      <Outliner onFold={() => setLayers(false)} />
    </aside>
  );
}
