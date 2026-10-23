import { useShell } from './shell';

/** On narrow screens: the two buttons that open and close the side drawers. */
export function DrawerTabs() {
  const drawers = useShell((s) => s.drawers);
  const setDrawer = useShell((s) => s.setDrawer);
  return (
    <div className="drawer-tabs">
      <button className={`drawer-tab drawer-tab--left ${drawers.left ? 'is-open' : ''}`} onClick={() => setDrawer('left', !drawers.left)} aria-expanded={drawers.left}>
        {drawers.left ? '‹ Hide tools' : 'Tools ›'}
      </button>
      <button className={`drawer-tab drawer-tab--right ${drawers.right ? 'is-open' : ''}`} onClick={() => setDrawer('right', !drawers.right)} aria-expanded={drawers.right}>
        {drawers.right ? 'Hide details ›' : '‹ Details'}
      </button>
    </div>
  );
}
