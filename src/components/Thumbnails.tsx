import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
import { templates } from '../templates/registry';
import { applyConstraints, defaultParams } from '../helpers/params';
import { CAMERA_FOV, resetView } from '../helpers/views';
import type { StageTemplate } from '../types';
import { SceneModeContext, StageScene } from './StageScene';

/**
 * Picker thumbnails: each template is rendered once at its default size from a
 * fixed angle in a small hidden canvas, captured as an image and cached in
 * localStorage. A thumbnail is re-rendered automatically when a template's
 * defaults change, so new templates need no extra work.
 */
const CACHE_KEY = 'stage-builder:thumbnails';
const VERSION = 1;
const W = 360;
const H = 220;

const fingerprint = (t: StageTemplate) => `${VERSION}:${JSON.stringify(defaultParams(t))}`;

function readCache(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { fp: string; url: string }>;
    return Object.fromEntries(templates.filter((t) => raw[t.id]?.fp === fingerprint(t)).map((t) => [t.id, raw[t.id].url]));
  } catch {
    return {};
  }
}

function writeCache(images: Record<string, string>) {
  try {
    const out = Object.fromEntries(Object.entries(images).map(([id, url]) => [id, { fp: fingerprint(templates.find((t) => t.id === id)!), url }]));
    localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch {
    // Storage full or unavailable: thumbnails will simply be re-rendered next time.
  }
}

export const useThumbnails = create<{ images: Record<string, string>; add: (id: string, url: string) => void }>((set, get) => ({
  images: readCache(),
  add: (id, url) => {
    const images = { ...get().images, [id]: url };
    set({ images });
    writeCache(images);
  },
}));

/** Renders one template, waits for it to settle, captures it, then moves on. */
function Shooter({ queue, onDone }: { queue: StageTemplate[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const template = queue[index];
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const { params, data } = useMemo(() => {
    const p = applyConstraints(template, defaultParams(template));
    return { params: p, data: template.data?.initial(p) };
  }, [template]);

  useLayoutEffect(() => {
    const v = resetView(template.bounds(params, data), W / H);
    camera.position.set(...v.position);
    camera.lookAt(...v.target);
    camera.updateMatrixWorld();
    frames.current = 0;
  }, [template, params, data, camera]);

  useFrame(() => {
    // A few frames lets instanced seats and shadows settle before capturing.
    if (++frames.current !== 6) return;
    useThumbnails.getState().add(template.id, gl.domElement.toDataURL('image/webp', 0.82));
    if (index + 1 < queue.length) setIndex(index + 1);
    else onDone();
  });

  return <StageScene template={template} params={params} data={data} />;
}

/** Mount once in the app. Renders any missing thumbnails shortly after load, then unmounts its canvas. */
export function ThumbnailRenderer() {
  const images = useThumbnails((s) => s.images);
  const [queue] = useState(() => templates.filter((t) => !images[t.id]));
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (queue.length === 0) return;
    // Let the main view load first.
    const timer = window.setTimeout(() => setActive(true), 900);
    return () => window.clearTimeout(timer);
  }, [queue.length]);
  if (!active || queue.length === 0) return null;
  return (
    <div style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none' }} aria-hidden>
      <Canvas shadows dpr={2} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: CAMERA_FOV, near: 0.1, far: 3000 }}>
        <SceneModeContext.Provider value={{ thumbnail: true }}>
          <Shooter queue={queue} onDone={() => setActive(false)} />
        </SceneModeContext.Provider>
      </Canvas>
    </div>
  );
}
