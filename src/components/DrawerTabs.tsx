import { useShell } from './shell';

/** On narrow screens Layers is a drawer: this button slides it in and out. */
export function DrawerTabs() {
  const open = useShell((s) => s.layers);
  return (
    <div className="drawer-tabs">
      <button className={`drawer-tab drawer-tab--right ${open ? 'is-open' : ''}`} onClick={() => useShell.getState().setLayers(!open)} aria-expanded={open}>
        {open ? 'Hide layers ›' : '‹ Layers'}
      </button>
    </div>
  );
}
