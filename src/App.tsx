import { TopBar } from './components/TopBar';
import { StagePicker } from './components/StagePicker';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Viewport } from './components/Viewport';
import { ThumbnailRenderer } from './components/Thumbnails';
import { UndoToast } from './components/UndoToast';
import { Tour } from './components/Tour';
import { Shortcuts } from './components/Shortcuts';
import { PdfPagePicker } from './components/graphics/PdfPagePicker';
import { ShortcutsSheet } from './components/ShortcutsSheet';
import { ModeBar } from './components/ModeBar';
import { PlanView } from './components/venue/PlanView';
import { VenueViewBar } from './components/venue/VenuePanels';
import { useProjectStore } from './store/useProjectStore';
import { useVenueUI } from './venue/ui';

export default function App() {
  const venue = useProjectStore((s) => s.mode === 'venue');
  const layout = useVenueUI((s) => s.layout);
  const show = venue ? layout : '3d';
  return (
    <div className="app">
      <TopBar />
      <StagePicker />
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
        <ModeBar />
        {venue && show === '3d' && <VenueViewBar />}
      </main>
      <PropertiesPanel />
      <UndoToast />
      <Shortcuts />
      <PdfPagePicker />
      <ShortcutsSheet />
      <Tour />
      <ThumbnailRenderer />
    </div>
  );
}
