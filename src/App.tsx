import { TopBar } from './components/TopBar';
import { Dock } from './components/Dock';
import { LayersSide } from './components/PropertiesPanel';
import { QuickBar } from './components/QuickBar';
import { CameraBar } from './components/CameraBar';
import { Viewport } from './components/Viewport';
import { ThumbnailRenderer } from './components/Thumbnails';
import { UndoToast } from './components/UndoToast';
import { Tour } from './components/Tour';
import { Shortcuts } from './components/Shortcuts';
import { PdfPagePicker } from './components/graphics/PdfPagePicker';
import { ShortcutsSheet } from './components/ShortcutsSheet';
import { ModeBar } from './components/ModeBar';
import { useShell } from './components/shell';
import { DrawerTabs } from './components/DrawerTabs';
import { LabelDeclutter } from './components/LabelDeclutter';
import { Home } from './components/Home';
import { NewProjectDialog } from './components/NewProjectDialog';
import { CrossModeToast } from './components/CrossModeToast';
import { Tips } from './components/Tips';
import { useEffect } from 'react';
import { startRecentSync } from './projects/library';
import { LightPlot } from './components/lights/LightPlot';
import { PlanView } from './components/venue/PlanView';
import { VenueViewBar } from './components/venue/VenuePanels';
import { useProjectStore } from './store/useProjectStore';
import { useVenueUI } from './venue/ui';
import { ItemMenu } from './components/layers/ItemMenu';
import { useLightsMode } from './components/lights/LightsPanels';
import { useBlockingKeys } from './components/blocking/BlockingPanels';

/**
 * The 3D stage fills the window and everything else floats over it: the top bar
 * (project, the View menu, share), the tool strip and its panel on the left,
 * Layers and Edit on the right, a quick bar over whatever is picked, and the
 * modes at the bottom.
 */
/** Each mode's keyboard shortcuts and setup, active whether or not its panels are open. */
function ModeEffects() {
  useLightsMode();
  useBlockingKeys();
  return null;
}

export default function App() {
  const mode = useProjectStore((s) => s.mode);
  const venue = mode === 'venue';
  const layout = useVenueUI((s) => s.layout);
  const panels = useShell((s) => s.panels);
  const dock = useShell((s) => s.dock);
  const layers = useShell((s) => s.layers);
  useEffect(() => startRecentSync(), []);
  const show = venue ? layout : '3d';
  return (
    <div className={`app app--${mode} ${panels ? '' : 'is-clean'} ${dock ? 'has-dock' : ''} ${layers ? 'has-layers' : ''}`}>
      <main className={`viewport viewport--${show}`}>
        {show !== '3d' && (
          <div className="viewport__plan">
            <PlanView />
            <VenueViewBar />
          </div>
        )}
        <div className="viewport__3d">
          <Viewport />
        </div>
        {venue && show === '3d' && <VenueViewBar />}
      </main>
      <ModeBar />
      <TopBar />
      <Dock />
      <LayersSide />
      <QuickBar />
      <CameraBar />
      <DrawerTabs />
      <LabelDeclutter />
      <CrossModeToast />
      <ItemMenu />
      <Tips />
      <UndoToast />
      <Shortcuts />
      <ModeEffects />
      <PdfPagePicker />
      <ShortcutsSheet />
      <LightPlot />
      <Tour />
      <ThumbnailRenderer />
      <Home />
      <NewProjectDialog />
    </div>
  );
}
