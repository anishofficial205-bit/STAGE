import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
import { templates } from '../templates/registry';
import { applyConstraints, defaultParams } from '../helpers/params';
import { CAMERA_FOV, resetView } from '../helpers/views';
import type { Params, StageTemplate } from '../types';
import { useTheme, type Theme } from './theme';
import { SceneModeContext, StageScene } from './StageScene';

/**
 * Picker thumbnails: each stage type (and a few variants, e.g. a theatre with a
 * balcony) is rendered once from a fixed angle in a small hidden canvas, in the
 * app's light or dark look, captured as an image and cached in localStorage.
 * A picture is re-rendered automatically when its settings change, so new
 * stage types need no extra work.
 */
const CACHE_KEY = 'stage-builder:thumbnails';
const VERSION = 2;
const W = 360;
const H = 220;

/** Extra pictures beyond each stage type at its default size. */
export const VARIANTS: { key: string; templateId: string; params: Params; turn?: number }[] = [
  // Seen more from the side, so the two floors of seating show.
  { key: 'proscenium:balcony', templateId: 'proscenium', params: { balcony: true, balconyRows: 8 }, turn: 62 },
];

interface Shot {
  key: string;
  template: StageTemplate;
  params: Params;
  /** Degrees to turn the usual camera round the stage. */
  turn?: number;
}
const shots = (): Shot[] => [
  ...templates.map((t) => ({ key: t.id, template: t, params: defaultParams(t) })),
  ...VARIANTS.map((v) => {
    const t = templates.find((x) => x.id === v.templateId)!;
    return { key: v.key, template: t, params: { ...defaultParams(t), ...v.params }, turn: v.turn };
  }),
];
const fingerprint = (s: Shot, theme: Theme) => `${VERSION}:${theme}:${s.turn ?? 0}:${JSON.stringify(s.params)}`;
const slot = (key: string, theme: Theme) => `${key}@${theme}`;

function readCache(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { fp: string; url: string }>;
    const out: Record<string, string> = {};
    for (const s of shots()) for (const theme of ['light', 'dark'] as Theme[]) if (raw[slot(s.key, theme)]?.fp === fingerprint(s, theme)) out[slot(s.key, theme)] = raw[slot(s.key, theme)].url;
    return out;
  } catch {
    return {};
  }
}

function writeCache(images: Record<string, string>) {
  try {
    const all = shots();
    const out = Object.fromEntries(
      Object.entries(images).flatMap(([k, url]) => {
        const [key, theme] = k.split('@') as [string, Theme];
        const s = all.find((x) => x.key === key);
        return s ? [[k, { fp: fingerprint(s, theme), url }]] : [];
      }),
    );
    localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch {
    // Storage full or unavailable: thumbnails will simply be re-rendered next time.
  }
}

const useThumbnailStore = create<{ images: Record<string, string>; add: (key: string, theme: Theme, url: string) => void }>((set, get) => ({
  images: readCache(),
  add: (key, theme, url) => {
    const images = { ...get().images, [slot(key, theme)]: url };
    set({ images });
    writeCache(images);
  },
}));

/** Pictures by stage type (or variant key) in the current look — the other look's picture until this one is ready. */
export function useThumbnails<T>(select: (s: { images: Record<string, string> }) => T): T {
  const theme = useTheme((s) => s.theme);
  const all = useThumbnailStore((s) => s.images);
  const images = useMemo(() => {
    const other: Theme = theme === 'light' ? 'dark' : 'light';
    const out: Record<string, string> = {};
    for (const s of shots()) {
      const url = all[slot(s.key, theme)] ?? all[slot(s.key, other)];
      if (url) out[s.key] = url;
    }
    return out;
  }, [all, theme]);
  return select({ images });
}

/** Renders one stage, waits for it to settle, captures it, then moves on. */
function Shooter({ queue, theme, onDone }: { queue: Shot[]; theme: Theme; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const shot = queue[index];
  const template = shot.template;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const { params, data } = useMemo(() => {
    const p = applyConstraints(template, shot.params);
    return { params: p, data: template.data?.initial(p) };
  }, [template, shot]);

  useLayoutEffect(() => {
    const v = resetView(template.bounds(params, data), W / H);
    if (shot.turn) {
      // Swing the camera round the target, a little lower and closer.
      const a = (shot.turn * Math.PI) / 180;
      const [dx, dy, dz] = [v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]];
      v.position = [v.target[0] + (dx * Math.cos(a) + dz * Math.sin(a)) * 0.85, v.target[1] + dy * 0.6, v.target[2] + (-dx * Math.sin(a) + dz * Math.cos(a)) * 0.85];
    }
    camera.position.set(...v.position);
    camera.lookAt(...v.target);
    camera.updateMatrixWorld();
    frames.current = 0;
  }, [template, params, data, camera, shot]);

  useFrame(() => {
    // A few frames lets instanced seats and shadows settle before capturing.
    if (++frames.current !== 6) return;
    useThumbnailStore.getState().add(shot.key, theme, gl.domElement.toDataURL('image/webp', 0.82));
    if (index + 1 < queue.length) setIndex(index + 1);
    else onDone();
  });

  return <StageScene template={template} params={params} data={data} />;
}

/** Mount once in the app. Renders any missing thumbnails shortly after load, then unmounts its canvas. */
export function ThumbnailRenderer() {
  const theme = useTheme((s) => s.theme);
  // The pictures missing for the current look (worked out again when the look changes).
  const queue = useMemo(() => {
    const images = useThumbnailStore.getState().images;
    return shots().filter((s) => !images[slot(s.key, theme)]);
  }, [theme]);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (queue.length === 0) return;
    // Let the main view load first.
    const timer = window.setTimeout(() => setActive(true), 900);
    return () => window.clearTimeout(timer);
  }, [queue]);
  if (!active || queue.length === 0) return null;
  return (
    <div style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none' }} aria-hidden>
      <Canvas shadows dpr={2} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: CAMERA_FOV, near: 0.1, far: 3000 }}>
        <SceneModeContext.Provider value={{ thumbnail: true }}>
          <Shooter key={theme} queue={queue} theme={theme} onDone={() => setActive(false)} />
        </SceneModeContext.Provider>
      </Canvas>
    </div>
  );
}
