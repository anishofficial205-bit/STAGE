/**
 * Lives inside the canvas and provides the export functions: render a view at
 * any resolution (optionally drawing the dimension labels into the image),
 * and record an orbit "turntable" video.
 */
import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useProjectStore } from '../../store/useProjectStore';
import { exporter, labelRegistry, useExportState, type CaptureOptions } from '../../export/state';
import { formatLength } from '../../units';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Draw measurement lines and labels onto a 2D canvas the same size as the render. */
function drawLabels(ctx: CanvasRenderingContext2D, camera: THREE.Camera, w: number, h: number) {
  const units = useProjectStore.getState().units;
  const toScreen = (v: [number, number, number]) => {
    const p = new THREE.Vector3(...v).project(camera);
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, behind: p.z > 1 };
  };
  // Scale with the image so labels stay readable when the render is shrunk onto a page.
  const scale = Math.max(1, w / 1100);
  ctx.lineWidth = 2 * scale;
  ctx.font = `600 ${13 * scale}px Inter, system-ui, sans-serif`;
  for (const l of labelRegistry) {
    const a = toScreen(l.a);
    const b = toScreen(l.b);
    if (a.behind || b.behind) continue;
    ctx.strokeStyle = '#2f6fde';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const len = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1], l.b[2] - l.a[2]);
    const text = `${l.label ? `${l.label} ` : ''}${formatLength(len, units)}`;
    const tw = ctx.measureText(text).width;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#c7d7f7';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.roundRect(mx - tw / 2 - 6 * scale, my - 11 * scale, tw + 12 * scale, 22 * scale, 4 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1f4fa8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, my + 0.5);
    ctx.lineWidth = 2 * scale;
  }
}

export function Capturer() {
  const { gl, scene, camera, controls, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const ctrl = controls as unknown as { target: THREE.Vector3; enabled: boolean; update: () => void } | null;

    /** Hide UI, wait for React to re-render, run `fn`, then put everything back. */
    const withExportMode = async <T,>(fn: () => Promise<T> | T): Promise<T> => {
      useExportState.getState().set({ exporting: true });
      await nextFrame();
      await nextFrame();
      const saved = { pos: cam.position.clone(), target: ctrl?.target.clone(), aspect: cam.aspect, ratio: gl.getPixelRatio(), w: size.width, h: size.height };
      try {
        return await fn();
      } finally {
        cam.position.copy(saved.pos);
        if (ctrl && saved.target) ctrl.target.copy(saved.target);
        gl.setPixelRatio(saved.ratio);
        gl.setSize(saved.w, saved.h, false);
        cam.aspect = saved.aspect;
        cam.updateProjectionMatrix();
        ctrl?.update();
        useExportState.getState().set({ exporting: false });
      }
    };

    exporter.capture = (o: CaptureOptions) =>
      withExportMode(async () => {
        if (o.view) {
          cam.position.set(...o.view.position);
          cam.lookAt(...o.view.target);
          if (ctrl) ctrl.target.set(...o.view.target);
        }
        gl.setPixelRatio(1);
        gl.setSize(o.width, o.height, false);
        cam.aspect = o.width / o.height;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, cam);
        // Read the pixels before the browser presents the frame.
        if (!o.labels) return gl.domElement.toDataURL(o.type ?? 'image/png', 0.92);
        const out = document.createElement('canvas');
        out.width = o.width;
        out.height = o.height;
        const ctx = out.getContext('2d')!;
        ctx.drawImage(gl.domElement, 0, 0);
        drawLabels(ctx, cam, o.width, o.height);
        return out.toDataURL(o.type ?? 'image/png', 0.92);
      });

    exporter.turntable = (seconds, [w, h]) =>
      withExportMode(
        () =>
          new Promise<Blob>((resolve, reject) => {
            const target = ctrl?.target.clone() ?? new THREE.Vector3();
            const offset = cam.position.clone().sub(target);
            const radius = Math.hypot(offset.x, offset.z);
            const start = Math.atan2(offset.x, offset.z);
            gl.setPixelRatio(1);
            gl.setSize(w, h, false);
            cam.aspect = w / h;
            cam.updateProjectionMatrix();
            if (ctrl) ctrl.enabled = false;
            const stream = gl.domElement.captureStream(30);
            const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
            const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8_000_000 } : undefined);
            const chunks: Blob[] = [];
            rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
            rec.onerror = () => reject(new Error('Recording failed'));
            rec.onstop = () => {
              if (ctrl) ctrl.enabled = true;
              resolve(new Blob(chunks, { type: 'video/webm' }));
            };
            const t0 = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - t0) / (seconds * 1000));
              const a = start + t * Math.PI * 2;
              cam.position.set(target.x + Math.sin(a) * radius, cam.position.y, target.z + Math.cos(a) * radius);
              cam.lookAt(target);
              gl.render(scene, cam);
              if (t < 1) requestAnimationFrame(tick);
              else rec.stop();
            };
            rec.start(250);
            requestAnimationFrame(tick);
          }),
      );

    return () => {
      exporter.capture = null;
      exporter.turntable = null;
    };
  }, [gl, scene, camera, controls, size]);

  return null;
}
