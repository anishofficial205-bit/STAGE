/**
 * LED wall — a screen made of square panels. Standing walls sit on a ground
 * stack with rear braces; hanging walls have a flybar on top. The screen face
 * glows slightly so it reads as lit, especially at night.
 */
import * as THREE from 'three';
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import { FaceMat } from '../faceMaterial';
import type { SetObjectType } from '../types';

const BASE = 0.15; // ground stack height when standing
const FRAME = 0.06;
const DEPTH = 0.1;

const hanging = (p: Params) => str(p, 'mount') === 'hanging';
/** Number of rear braces on a standing wall: one every couple of metres, at least two. */
const braces = (w: number) => Math.max(2, Math.round(w / 2) + 1);
const dims = (p: Params) => ({ w: num(p, 'panelsWide') * num(p, 'panelSize'), h: num(p, 'panelsHigh') * num(p, 'panelSize') });

const screenTextures = new Map<string, THREE.Texture>();
/** A standby-screen look: a soft blue/violet gradient with faint panel seams. */
function screenTexture(cols: number, rows: number) {
  const key = `${cols}x${rows}`;
  const hit = screenTextures.get(key);
  if (hit) return hit;
  const px = 64;
  const c = document.createElement('canvas');
  c.width = Math.min(2048, cols * px);
  c.height = Math.min(2048, rows * px);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#1b3d8f');
  grad.addColorStop(1, '#4a2a86');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * c.width;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * c.height;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  screenTextures.set(key, t);
  return t;
}

export const ledWallObject: SetObjectType = {
  id: 'led-wall',
  name: 'LED wall',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <rect x="3" y="4" width="18" height="12" />
      <path d="M9 4v12M15 4v12M3 10h18M8 20h8" />
    </Icon>
  ),
  placement: (p) => (hanging(p) ? 'hanging' : 'floor'),
  hangGap: 0.4,
  params: [
    { key: 'panelsWide', label: 'Panels wide', group: 'Size', type: 'number', unit: 'none', default: 8, min: 1, max: 80, step: 1 },
    { key: 'panelsHigh', label: 'Panels high', group: 'Size', type: 'number', unit: 'none', default: 5, min: 1, max: 40, step: 1 },
    { key: 'panelSize', label: 'Panel size', group: 'Size', type: 'number', default: 0.5, min: 0.25, max: 1.5, step: 0.05, help: 'Width and height of one square LED panel.' },
    { key: 'pixelsPerPanel', label: 'Pixels per panel', group: 'Screen', type: 'number', unit: 'none', default: 128, min: 16, max: 1024, step: 1, help: 'Resolution of one panel (e.g. 128 means 128 × 128). Used to check graphics have enough pixels.' },
    { key: 'frame', label: 'Frame', group: 'Build', type: 'boolean', default: true },
    {
      key: 'mount',
      label: 'Mounting',
      group: 'Build',
      type: 'select',
      default: 'standing',
      options: [
        { value: 'standing', label: 'Standing (ground stack)' },
        { value: 'hanging', label: 'Hanging (flown)' },
      ],
    },
  ],
  constraints: (p) => p,
  size: (p) => {
    const { w, h } = dims(p);
    const f = bool(p, 'frame') ? 2 * FRAME : 0;
    return { width: w + f, depth: hanging(p) ? DEPTH : 0.9, height: h + f + (hanging(p) ? 0.1 : BASE) };
  },
  resize: (p) => ({ width: { key: 'panelsWide', scale: 1 / num(p, 'panelSize') } }),
  build: (p) => {
    const { w, h } = dims(p);
    const f = bool(p, 'frame') ? FRAME : 0;
    const y0 = (hanging(p) ? 0 : BASE) + f; // bottom of the screen
    const map = screenTexture(num(p, 'panelsWide'), num(p, 'panelsHigh'));
    const zFront = hanging(p) ? DEPTH / 2 : 0.45; // standing walls have braces behind, so the screen sits at the front
    return (
      <>
        <mesh position={[0, y0 + h / 2, zFront - DEPTH / 2]} castShadow receiveShadow>
          <boxGeometry args={[w, h, DEPTH]} />
          <meshStandardMaterial attach="material-0" color="#1a1d22" />
          <meshStandardMaterial attach="material-1" color="#1a1d22" />
          <meshStandardMaterial attach="material-2" color="#1a1d22" />
          <meshStandardMaterial attach="material-3" color="#1a1d22" />
          {/* Front: the lit screen */}
          <FaceMat attach="material-4" face="screen" color="#ffffff" map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.85} roughness={0.35} />
          <FaceMat attach="material-5" face="back" color="#22262c" roughness={0.6} />
        </mesh>
        {f > 0 && (
          <>
            <Cube at={[0, y0 - f / 2, zFront - DEPTH / 2]} size={[w + 2 * f, f, DEPTH + 0.02]} color={SET.dark} />
            <Cube at={[0, y0 + h + f / 2, zFront - DEPTH / 2]} size={[w + 2 * f, f, DEPTH + 0.02]} color={SET.dark} />
            <Cube at={[-w / 2 - f / 2, y0 + h / 2, zFront - DEPTH / 2]} size={[f, h, DEPTH + 0.02]} color={SET.dark} />
            <Cube at={[w / 2 + f / 2, y0 + h / 2, zFront - DEPTH / 2]} size={[f, h, DEPTH + 0.02]} color={SET.dark} />
          </>
        )}
        {hanging(p) ? (
          <Cube at={[0, y0 + h + f + 0.05, 0]} size={[w + 0.2, 0.08, 0.12]} color={SET.metal} />
        ) : (
          <>
            <Cube at={[0, BASE / 2, 0]} size={[w + 2 * f, BASE, 0.9]} color={SET.dark} />
            {/* Rear braces every couple of metres */}
            {Array.from({ length: braces(w) }, (_, i) => {
              const x = -w / 2 + (w * i) / (braces(w) - 1);
              const top = y0 + h * 0.75;
              const len = Math.hypot(top - BASE, 0.75);
              return (
                <mesh key={i} position={[x, (top + BASE) / 2, zFront - DEPTH - 0.375]} rotation-x={-Math.atan2(0.75, top - BASE)} castShadow>
                  <boxGeometry args={[0.05, len, 0.05]} />
                  <meshStandardMaterial color={SET.metal} roughness={0.5} metalness={0.5} />
                </mesh>
              );
            })}
          </>
        )}
      </>
    );
  },
  faces: (p) => {
    const { w, h } = dims(p);
    return [
      { id: 'screen', name: 'Screen (front)', width: w, height: h },
      { id: 'back', name: 'Back', width: w, height: h },
    ];
  },
};
