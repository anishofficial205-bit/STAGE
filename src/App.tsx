import { TopBar } from './components/TopBar';
import { ToolsPanel } from './components/ToolsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Viewport } from './components/Viewport';
import { ThumbnailRenderer } from './components/Thumbnails';
import { UndoToast } from './components/UndoToast';
import { Tour } from './components/Tour';
import { Shortcuts } from './components/Shortcuts';
import { PdfPagePicker } from './components/graphics/PdfPagePicker';
import { ShortcutsSheet } from './components/ShortcutsSheet';
import { ModeBar } from './components/ModeBar';
import { NextStep } from './components/NextStep';
import { useShell, useTaskDrawers } from './components/shell';
import { DrawerTabs } from './components/DrawerTabs';
import { LabelDeclutter } from './components/LabelDeclutter';
import { Home } from './components/Home';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ViewCube } from './components/ViewCube';
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

/**
 * Focus layout: the 3D stage fills the window and everything else floats over it —
 * the mode rail on the left, the top bar, the mode's tools and the selection panel.
 */
export default function App() {
  const mode = useProjectStore((s) => s.mode);
  const venue = mode === 'venue';
  const layout = useVenueUI((s) => s.layout);
  const panels = useShell((s) => s.panels);
  const drawers = useShell((s) => s.drawers);
  useTaskDrawers();
  useEffect(() => startRecentSync(), []);
  const show = venue ? layout : '3d';
  return (
    <div className={`app app--${mode} ${panels ? '' : 'is-clean'} ${drawers.left ? 'has-left' : ''} ${drawers.right ? 'has-right' : ''}`}>
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
      <ToolsPanel />
      <PropertiesPanel />
      <NextStep />
      <DrawerTabs />
      {!venue && <ViewCube />}
      <LabelDeclutter />
      <CrossModeToast />
      <ItemMenu />
      <Tips />
      <UndoToast />
      <Shortcuts />
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
