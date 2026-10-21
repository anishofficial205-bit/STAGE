import { TopBar } from './components/TopBar';
import { StagePicker } from './components/StagePicker';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Viewport } from './components/Viewport';
import { ThumbnailRenderer } from './components/Thumbnails';
import { UndoToast } from './components/UndoToast';
import { Tour } from './components/Tour';
import { Shortcuts } from './components/Shortcuts';
import { PdfPagePicker } from './components/graphics/PdfPagePicker';

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <StagePicker />
      <main className="viewport">
        <Viewport />
      </main>
      <PropertiesPanel />
      <UndoToast />
      <Shortcuts />
      <PdfPagePicker />
      <Tour />
      <ThumbnailRenderer />
    </div>
  );
}
