import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { StagePicker } from './components/StagePicker';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Viewport } from './components/Viewport';
import { useProjectStore } from './store/useProjectStore';
import { ThumbnailRenderer } from './components/Thumbnails';
import { UndoToast } from './components/UndoToast';
import { Tour } from './components/Tour';

export default function App() {
  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <StagePicker />
      <main className="viewport">
        <Viewport />
      </main>
      <PropertiesPanel />
      <UndoToast />
      <Tour />
      <ThumbnailRenderer />
    </div>
  );
}
