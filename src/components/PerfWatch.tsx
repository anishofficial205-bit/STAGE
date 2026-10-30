import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useExportState } from '../export/state';
import { useNotices } from './Notices';

/**
 * Watches the 3D view's frame rate (inside the Canvas). Below ~18 frames a
 * second for two 4-second stretches in a row, it suggests lightening things.
 */
export function PerfWatch() {
  const acc = useRef({ frames: 0, time: 0, slowRuns: 0, since: performance.now() });
  useFrame((_, dt) => {
    const a = acc.current;
    // Settle in first; ignore hidden tabs, exports and long pauses (tab switches, dialogs).
    if (performance.now() - a.since < 10_000 || document.hidden || useExportState.getState().exporting || dt > 1.5) return;
    a.frames++;
    a.time += dt;
    if (a.time < 4) return;
    const fps = a.frames / a.time;
    a.frames = 0;
    a.time = 0;
    a.slowRuns = fps < 18 ? a.slowRuns + 1 : 0;
    if (a.slowRuns >= 2) {
      a.slowRuns = 0;
      useNotices.getState().show('slow');
    }
  });
  return null;
}
